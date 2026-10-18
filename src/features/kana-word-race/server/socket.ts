import "server-only";
import { randomUUID } from "node:crypto";
import type { RawData, WebSocket } from "ws";
import { z } from "zod";
import { CommandSchema } from "../contracts";
import { RaceError } from "../domain/engine";
import { verifyRacePrincipal, type RacePrincipal } from "./auth";
import { racePresence, requireRaceRuntime, limitRace, type RaceConnection } from "./presence";
import { publishRaceChange, raceFailure, raceRepository } from "./runtime";
import { subscribeRaceRoom } from "./subscription";

type Client = { refresh: () => Promise<void>; ws: WebSocket };
const rooms = new Map<string, { clients: Set<Client>; subscription: ReturnType<typeof subscribeRaceRoom> }>();
function send(ws: WebSocket, message: object) { if (ws.readyState === 1) ws.send(JSON.stringify(message)); }

export function attachRaceSocket(ws: WebSocket, principal: RacePrincipal, connection: RaceConnection) {
  let room = rooms.get(connection.roomId);
  if (!room) {
    const clients = new Set<Client>();
    const subscription = subscribeRaceRoom(connection.roomId, () => { for (const client of clients) void client.refresh(); });
    room = { clients, subscription }; rooms.set(connection.roomId, room);
    void subscription.done.catch(() => { for (const client of clients) client.ws.close(1013, "Subscription unavailable"); });
  }
  let closed = false; let refreshing = false; let again = false;
  let boundary: ReturnType<typeof setTimeout> | undefined;
  async function authorized() {
    await requireRaceRuntime();
    const identity = await verifyRacePrincipal(principal);
    if (!await racePresence.owns(connection)) throw new RaceError("Room dibuka di tab lain.", true);
    return identity;
  }
  async function refresh() {
    if (closed) return;
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      do {
        again = false;
        const identity = await authorized();
        const state = await raceRepository.run(identity, { type: "sync", roomId: connection.roomId, requestId: randomUUID() });
        if (closed) return;
        send(ws, { type: "snapshot", state, online: await racePresence.online(connection.roomId) });
        clearTimeout(boundary);
        if (state.closed) { ws.close(4004, "Room closed"); return; }
        if (state.match && state.match.phase !== "FINISHED") boundary = setTimeout(() => { void refresh(); }, Math.max(60, state.match.endsAt - state.serverNow + 40));
      } while (again && !closed);
    } catch (error: unknown) {
      const failure = raceFailure(error);
      send(ws, { type: "error", requestId: null, ...failure });
      ws.close(failure.terminal ? 4003 : 1013, "Refresh required");
    } finally { refreshing = false; }
  }
  const client = { ws, refresh }; room.clients.add(client);
  let alive = true; let heartbeatBusy = false;
  ws.on("pong", () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (closed || heartbeatBusy) return;
    if (!alive) { ws.terminate(); return; }
    alive = false; ws.ping(); heartbeatBusy = true;
    void authorized().then(async () => {
      if (!await racePresence.change(connection, "renew")) throw new RaceError("Koneksi sudah digantikan.", true);
      await refresh();
    }).catch((error: unknown) => { send(ws, { type: "error", requestId: null, ...raceFailure(error) }); ws.close(4003, "Session unavailable"); }).finally(() => { heartbeatBusy = false; });
  }, 20_000);
  const rotation = setTimeout(() => ws.close(1012, "Connection refresh"), 270_000);
  ws.on("error", () => ws.terminate());
  ws.on("close", () => {
    closed = true; clearInterval(heartbeat); clearTimeout(rotation); clearTimeout(boundary);
    room.clients.delete(client);
    if (!room.clients.size) { room.subscription.close(); rooms.delete(connection.roomId); }
    void racePresence.change(connection, "release").then(async (released) => { if (released) await publishRaceChange(connection.roomId); }).catch(() => undefined);
  });
  let queued = room.subscription.ready.then(refresh).then(() => publishRaceChange(connection.roomId)).catch(() => ws.close(1013, "Subscription unavailable"));
  let pending = 0; let windowStart = Date.now(); let count = 0;
  ws.on("message", (raw: RawData, binary: boolean) => {
    if (Date.now() - windowStart >= 1000) { windowStart = Date.now(); count = 0; }
    if (binary || ++count > 4 || pending >= 4) { ws.close(1008, "Rate limit"); return; }
    pending++;
    queued = queued.then(async () => {
      if (closed) return;
      let requestId: string | null = null;
      try {
        const bytes = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const data: unknown = JSON.parse(bytes.toString("utf8"));
        const envelope = z.object({ requestId: z.uuid() }).safeParse(data);
        if (envelope.success) requestId = envelope.data.requestId;
        const parsed = CommandSchema.safeParse(data);
        if (!parsed.success) throw new RaceError("Perintah tidak valid.");
        const command = parsed.data; requestId = command.requestId;
        if (command.roomId !== connection.roomId) throw new RaceError("Room tidak sesuai.", true);
        const identity = await authorized();
        await limitRace("command", connection.memberId, 120);
        await raceRepository.run(identity, command);
        await refresh();
        send(ws, { type: "ack", requestId });
        if (command.type !== "sync") await publishRaceChange(connection.roomId);
      } catch (error: unknown) {
        const failure = raceFailure(error); send(ws, { type: "error", requestId, ...failure });
        if (failure.terminal) ws.close(4003, "Access ended");
      }
    }).finally(() => { pending--; });
  });
}
