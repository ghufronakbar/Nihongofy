import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { env } from "@/constants";
import { authorizeProbe } from "@/features/mini-games/kotoba-clash/probe/guard";
import { PROBE_PATH, probeClientId } from "@/features/mini-games/kotoba-clash/probe/protocol";
import { createProbeRuntime } from "@/features/mini-games/kotoba-clash/probe/server";
import { reportServerError } from "@/lib/server-logger";

const port = z.coerce.number().int().min(1024).max(65535).parse(process.argv[2] ?? 4101);
const base = `http://127.0.0.1:${port}`;
const runId = z.string().regex(/^[a-zA-Z0-9-]{8,64}$/).parse(env.KOTOBA_PROBE_RUN_ID);
const expiresAt = Date.parse(z.string().parse(env.KOTOBA_PROBE_EXPIRES_AT));
const probe = createProbeRuntime(runId, expiresAt);
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });

function asRequest(req: IncomingMessage) {
  const headers = new Headers();
  for (const key of ["authorization", "origin"]) {
    const value = req.headers[key];
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(new URL(req.url ?? "/", base), { method: req.method, headers });
}

const server = createServer(async (req, res) => {
  try {
    const request = asRequest(req);
    const status = new URL(request.url).pathname === PROBE_PATH ? authorizeProbe(request, env) : 404;
    if (status !== 200) { res.writeHead(status).end(); return; }
    if (req.method === "DELETE") {
      await probe.cleanup();
      res.writeHead(204).end();
    } else res.writeHead(426).end();
  } catch (error) {
    reportServerError("kotoba.probe.local_http_failed", error);
    res.writeHead(503).end();
  }
});

server.on("upgrade", async (req, socket, head) => {
  const lease = randomUUID();
  let admitted = false;
  try {
    const request = asRequest(req);
    const url = new URL(request.url);
    const status = url.pathname === PROBE_PATH ? authorizeProbe(request, env) : 404;
    const clientId = probeClientId.safeParse(url.searchParams.get("client"));
    if (status !== 200 || !clientId.success) {
      socket.end(`HTTP/1.1 ${status === 200 ? 400 : status} Rejected\r\nConnection: close\r\n\r\n`);
      return;
    }
    admitted = await probe.store.admit(lease);
    if (!admitted) { socket.end("HTTP/1.1 429 Rejected\r\nConnection: close\r\n\r\n"); return; }
    wss.handleUpgrade(req, socket, head, (ws) => probe.attach(ws, clientId.data, lease));
  } catch (error) {
    if (admitted) await probe.store.release(lease).catch(() => undefined);
    reportServerError("kotoba.probe.local_upgrade_failed", error);
    socket.destroy();
  }
});

// Loopback only: this bootstrap exercises real process loss, not a public VPS release.
server.listen(port, "127.0.0.1", () => { console.log(`Kotoba probe listening on loopback port ${port}`); });
