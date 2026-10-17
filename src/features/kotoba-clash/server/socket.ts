import "server-only";

import type { WebSocket, RawData } from "ws";
import { ClashClientMessageSchema } from "../schemas";
import { ClashError } from "../domain/ports";
import { verifyClashPrincipal, type ClashPrincipal } from "./auth";
import { clashCommands, clashState, publishClashChange } from "./runtime";
import { clashPresence, requireClashRuntime, type ClashConnection } from "./presence";
import { clashFailure } from "./errors";
import { subscribeClashRoom } from "./subscription";
import { reportServerError } from "@/lib/server-logger";

type Client = { ws: WebSocket; refresh: () => Promise<void> };
const rooms = new Map<string, { clients: Set<Client>; subscription: ReturnType<typeof subscribeClashRoom> }>();

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  if (ws.bufferedAmount > 512_000) { ws.close(1013, "Slow connection"); return; }
  ws.send(JSON.stringify({ protocolVersion: 1, ...data as object }));
}

function roomRuntime(roomId: string) {
  const existing = rooms.get(roomId);
  if (existing) return existing;
  const clients = new Set<Client>();
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const subscription = subscribeClashRoom(roomId, () => {
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = undefined;
      for (const client of clients) void client.refresh();
    }, 200);
  });
  const room = { clients, subscription };
  rooms.set(roomId, room);
  void subscription.done.catch((error: unknown) => {
    if (rooms.get(roomId) !== room) return;
    reportServerError("kotoba_clash.subscription.failed", error);
    for (const client of clients) client.ws.close(1013, "Reconnect required");
  });
  return room;
}

export function attachClashSocket(ws: WebSocket, principal: ClashPrincipal, connection: ClashConnection) {
  const room = roomRuntime(connection.roomId);
  let closed = false;
  let refreshing = false;
  let refreshAgain = false;
  let boundary: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  let windowStart = Date.now();
  let count = 0;
  let pending = 0;

  async function authorized() {
    await requireClashRuntime();
    const identity = await verifyClashPrincipal(principal);
    if (!await clashPresence.owns(connection)) { ws.close(4009, "Opened in another tab"); throw new ClashError("UNAUTHORIZED"); }
    return identity;
  }

  async function refresh() {
    if (closed) return;
    if (refreshing) { refreshAgain = true; return; }
    refreshing = true;
    try {
      do {
        refreshAgain = false;
        const identity = await authorized();
        const state = await clashState.read(identity, connection.roomId);
        if (closed) return;
        send(ws, { type: "snapshot", state, online: await clashPresence.online(connection.roomId) });
        clearTimeout(boundary);
        const phase = state.match?.phase;
        if (phase && "endsAt" in phase) {
          boundary = setTimeout(() => { void refresh(); }, Math.max(50, phase.endsAt - state.serverNow + 30));
        }
        if (state.closed) { ws.close(4004, "Room closed"); return; }
      } while (refreshAgain && !closed);
    } catch (error) {
      const failure = clashFailure(error);
      send(ws, { type: "command_error", requestId: null, code: failure.code, message: failure.message });
      ws.close(failure.code === "KICKED" ? 4005 : failure.code === "UNAUTHORIZED" ? 4003 : 1013, "Reconnect required");
    } finally { refreshing = false; }
  }

  const client = { ws, refresh };
  room.clients.add(client);
  let heartbeatBusy = false;
  const heartbeat = setInterval(() => {
    if (heartbeatBusy || closed) return;
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
    heartbeatBusy = true;
    void (async () => {
      await authorized();
      if (!await clashPresence.change(connection, "renew")) { ws.close(4009, "Connection replaced"); return; }
      // Periodic authoritative sync repairs lost invalidations and rechecks idle revocation.
      await refresh();
    })().catch((error: unknown) => {
      const failure = clashFailure(error);
      send(ws, { type: "command_error", requestId: null, code: failure.code, message: failure.message });
      ws.close(failure.code === "UNAUTHORIZED" ? 4003 : 1013, "Connection unavailable");
    }).finally(() => { heartbeatBusy = false; });
  }, 20_000);
  const rotation = setTimeout(() => ws.close(1012, "Connection refresh"), 270_000);
  ws.on("pong", () => { alive = true; });
  ws.on("error", () => ws.terminate());
  ws.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(rotation);
    clearTimeout(boundary);
    room.clients.delete(client);
    if (room.clients.size === 0) { rooms.delete(connection.roomId); room.subscription.close(); }
    void clashPresence.change(connection, "release").then(async (released) => {
      if (released) await publishClashChange(connection.roomId, 0);
    }).catch((error: unknown) => { reportServerError("kotoba_clash.lease.release_failed", error); });
  });

  // Subscribe before the initial read; no state change is lost between them.
  let queue = room.subscription.ready.then(async () => {
    await refresh();
    await publishClashChange(connection.roomId, 0);
  }).catch((error: unknown) => { if (closed) return; clashFailure(error); ws.close(1013, "Subscription unavailable"); });
  ws.on("message", (raw: RawData, binary: boolean) => {
    if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); count = 0; }
    if (binary || ++count > 4 || pending >= 4) { ws.close(1008, "Rate limit"); return; }
    pending++;
    queue = queue.then(async () => {
      if (closed) return;
      let requestId: string | null = null;
      try {
        const bytes = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const value: unknown = JSON.parse(bytes.toString("utf8"));
        const message = ClashClientMessageSchema.parse(value);
        requestId = message.requestId;
        if (message.roomId !== connection.roomId) throw new ClashError("UNAUTHORIZED");
        await authorized();
        if (message.type === "submit_answer") {
          const ack = await clashCommands.submitAnswer(principal, {
            roomId: message.roomId, matchId: message.matchId, roundId: message.roundId, requestId: message.requestId, choice: message.choice,
          });
          send(ws, { type: "answer_ack", requestId, roundId: ack.roundId, acceptedAt: ack.acceptedAt });
        }
        await refresh();
      } catch (error) {
        const failure = clashFailure(error);
        send(ws, { type: "command_error", requestId, code: failure.code, message: failure.message });
      }
    }).finally(() => { pending--; });
  });
}
