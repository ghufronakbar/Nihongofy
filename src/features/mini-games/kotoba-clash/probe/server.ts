import "server-only";

import { randomUUID } from "node:crypto";
import type { WebSocket, RawData } from "ws";
import { reportServerError } from "@/lib/server-logger";
import { probeCommand } from "./protocol";
import { createProbeStore } from "./store";
import { subscribeToProbe } from "./subscription";

export function createProbeRuntime(runId: string, expiresAt: number) {
  const instanceId = randomUUID();
  const store = createProbeStore(runId);
  const sockets = new Set<WebSocket>();
  let subscription: ReturnType<typeof subscribeToProbe> | undefined;
  const report = (event: string, error: unknown) => reportServerError(`kotoba.probe.${event}`, error, { instanceId });

  function send(ws: WebSocket, value: unknown) {
    if (ws.readyState !== ws.OPEN) return;
    if (ws.bufferedAmount > 16_384) { ws.close(1013, "Slow consumer"); return; }
    ws.send(JSON.stringify(value));
  }

  function subscribe() {
    if (subscription) return subscription;
    const current = subscribeToProbe({ ...store.subscriptionConfig, channel: store.channel }, (event) => {
      for (const ws of sockets) send(ws, { type: "event", ...event, receiverInstance: instanceId });
    });
    subscription = current;
    void current.done.catch((error: unknown) => {
      if (subscription !== current) return;
      subscription = undefined;
      report("subscription_failed", error);
      for (const ws of sockets) ws.close(1013, "Resubscribe required");
    });
    return current;
  }

  function attach(ws: WebSocket, clientId: string, lease: string) {
    sockets.add(ws);
    let closed = false;
    let alive = true;
    let busy = 0;
    let windowStart = Date.now();
    let windowCount = 0;
    let renewing = false;
    const release = () => { void store.release(lease).catch((error: unknown) => report("release_failed", error)); };
    const heartbeat = setInterval(() => {
      if (Date.now() >= expiresAt) { ws.close(1008, "Probe expired"); return; }
      if (!alive) { ws.terminate(); return; }
      alive = false;
      ws.ping();
      if (renewing) return;
      renewing = true;
      void store.renew(lease).then((valid) => {
        if (!valid) ws.close(1013, "Lease expired");
      }).catch((error: unknown) => {
        report("lease_failed", error);
        ws.close(1013, "Lease unavailable");
      }).finally(() => { renewing = false; });
    }, 20_000);
    ws.on("pong", () => { alive = true; });
    ws.on("error", (error) => { report("socket_failed", error); ws.terminate(); });
    ws.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      sockets.delete(ws);
      release();
      if (sockets.size === 0 && subscription) {
        const current = subscription;
        subscription = undefined;
        current.close();
      }
    });

    // Subscribe before taking the snapshot; revisions handle messages racing the snapshot.
    let queue = (async () => {
      await subscribe().ready;
      if (closed) return;
      const result = await store.mutate(clientId, "join");
      send(ws, { type: "welcome", clientId, instanceId, state: result.state });
    })().catch((error: unknown) => {
      report("initialize_failed", error);
      ws.close(1013, "Snapshot unavailable");
    });

    ws.on("message", (raw: RawData, binary: boolean) => {
      const now = Date.now();
      if (now >= expiresAt) { ws.close(1008, "Probe expired"); return; }
      if (now - windowStart >= 1000) { windowStart = now; windowCount = 0; }
      if (binary || ++windowCount > 4 || busy >= 4) { ws.close(1008, "Probe rate limit"); return; }
      busy++;
      queue = queue.then(async () => {
        if (closed || ws.readyState !== ws.OPEN) return;
        const bytes = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const value: unknown = JSON.parse(bytes.toString("utf8"));
        const command = probeCommand.parse(value);
        if (command.type === "disconnect") { ws.close(4001, "Injected disconnect"); return; }
        if (command.type === "sync") {
          send(ws, { type: "snapshot", instanceId, state: await store.snapshot() });
          return;
        }
        const result = await store.mutate(clientId, command.sequence);
        send(ws, { type: "ack", sequence: command.sequence, status: result.status, revision: result.state.revision, instanceId });
        if (result.status !== "applied" || command.fault === "omit") return;
        const event = { revision: result.state.revision, sourceInstance: instanceId };
        try {
          if (command.fault === "publish-failure") throw new Error("Injected publish failure after commit");
          await store.publish(event);
          if (command.fault === "duplicate") await store.publish(event);
        } catch (error) {
          report("publish_failed", error);
          send(ws, { type: "warning", code: "publish-failed", revision: result.state.revision });
        }
      }).catch((error: unknown) => {
        report("command_failed", error);
        ws.close(1013, "Command failed; resync required");
      }).finally(() => { busy--; });
    });
  }

  return {
    store,
    attach,
    async cleanup() {
      for (const ws of sockets) ws.close(1001, "Probe cleanup");
      await store.cleanup();
    },
  };
}
