import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import WebSocket from "ws";
import { z } from "zod";

const config = z.object({
  KOTOBA_PROBE_URLS: z.string().transform((value) => value.split(",").map((url) => z.url().parse(url))),
  KOTOBA_PROBE_SECRET: z.string().min(32),
  KOTOBA_PROBE_ORIGIN: z.url(),
  KOTOBA_PROBE_SECONDS: z.coerce.number().int().min(10).max(1200).default(960),
  KOTOBA_PROBE_REPORT: z.string().default(".vercel/kotoba-probe-report.json"),
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
}).parse(process.env);

const path = "/api/internal/kotoba-clash-probe";
const stateSchema = z.object({ revision: z.number().int(), members: z.record(z.string(), z.number().int()) });
const wireSchema = z.object({
  type: z.enum(["welcome", "snapshot", "event", "ack", "warning"]),
  state: stateSchema.optional(),
  instanceId: z.uuid().optional(),
  sourceInstance: z.uuid().optional(),
  receiverInstance: z.uuid().optional(),
  sequence: z.number().int().optional(),
  revision: z.number().int().optional(),
  status: z.enum(["applied", "duplicate", "missing", "sequence"]).optional(),
  code: z.string().optional(),
});
const headers = {
  Authorization: `Bearer ${config.KOTOBA_PROBE_SECRET}`,
  Origin: config.KOTOBA_PROBE_ORIGIN,
  ...(config.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { "x-vercel-protection-bypass": config.VERCEL_AUTOMATION_BYPASS_SECRET } : {}),
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clients = [];
const instances = new Set();
const latencies = [];
const metrics = {
  run: randomUUID(), startedAt: new Date().toISOString(), targetHosts: config.KOTOBA_PROBE_URLS.map((url) => new URL(url).host),
  requestedSeconds: config.KOTOBA_PROBE_SECONDS, clients: 20, peakReady: 0,
  connections: 0, reconnects: 0, unexpectedResponses: {}, closeCodes: {},
  applied: 0, duplicateAcks: 0, publishFailureWarnings: 0,
  events: 0, crossInstanceDeliveries: 0, staleOrDuplicateEvents: 0, snapshots: 0,
  injectedDisconnects: 0, failures: [], security: [],
  sentPayloadBytes: 0, receivedPayloadBytes: 0, cutoffCandidates: 0,
  connectionLifetimesSeconds: [], reconnectDelayMs: [],
};
let stopping = false;

function send(client, value) {
  if (!client.ready || client.ws.readyState !== WebSocket.OPEN) return false;
  const serialized = JSON.stringify(value);
  metrics.sentPayloadBytes += Buffer.byteLength(serialized);
  client.ws.send(serialized);
  return true;
}

function connect(client) {
  if (stopping) return;
  const url = new URL(path, client.base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("client", client.id);
  const ws = new WebSocket(url, { headers, handshakeTimeout: 15_000, maxPayload: 16_384 });
  client.ws = ws;
  client.ready = false;
  const openedAt = performance.now();
  ws.on("unexpected-response", (_request, response) => {
    const status = String(response.statusCode);
    metrics.unexpectedResponses[status] = (metrics.unexpectedResponses[status] ?? 0) + 1;
    response.resume();
    ws.terminate();
  });
  ws.on("error", () => { /* Close handler retries; never print request headers. */ });
  ws.on("message", (raw) => {
    metrics.receivedPayloadBytes += raw.length;
    try {
      const message = wireSchema.parse(JSON.parse(raw.toString()));
      if (message.instanceId) instances.add(message.instanceId);
      if (message.type === "welcome") {
        if (!message.state || !message.instanceId) throw new Error("Incomplete welcome");
        metrics.connections++;
        if (client.welcomes++ > 0) metrics.reconnects++;
        if (client.disconnectedAt) metrics.reconnectDelayMs.push(Math.round(performance.now() - client.disconnectedAt));
        client.ready = true;
        client.backoff = 250;
        if (client.pending) send(client, { type: "advance", sequence: client.pending.sequence });
      }
      if (message.state) {
        metrics.snapshots++;
        if ((message.state.members[client.id] ?? -1) < client.acked) throw new Error("State regressed after reconnect");
        if (!client.state || message.state.revision >= client.state.revision) client.state = message.state;
        client.snapshotAt = performance.now();
      }
      if (message.type === "event") {
        metrics.events++;
        if (message.sourceInstance !== message.receiverInstance) metrics.crossInstanceDeliveries++;
        if (message.revision <= client.revision) metrics.staleOrDuplicateEvents++;
        client.revision = Math.max(client.revision, message.revision ?? 0);
      }
      if (message.type === "ack") {
        if (message.status === "applied") metrics.applied++;
        else if (message.status === "duplicate") metrics.duplicateAcks++;
        else throw new Error("Sequence or membership rejected");
        if (client.pending?.sequence === message.sequence) {
          latencies.push(performance.now() - client.pending.sentAt);
          client.acked = message.sequence;
          client.pending = undefined;
        }
      }
      if (message.type === "warning" && message.code === "publish-failed") metrics.publishFailureWarnings++;
    } catch {
      metrics.failures.push({ client: client.id, reason: "Invalid response or inconsistent state" });
    }
  });
  ws.on("close", (code) => {
    client.ready = false;
    client.disconnectedAt = performance.now();
    const lifetime = Math.round((performance.now() - openedAt) / 1000);
    metrics.connectionLifetimesSeconds.push(lifetime);
    if (!stopping && code !== 4001 && lifetime >= 290) metrics.cutoffCandidates++;
    metrics.closeCodes[code] = (metrics.closeCodes[code] ?? 0) + 1;
    if (!stopping) {
      const delay = client.backoff + Math.random() * 500;
      client.backoff = Math.min(client.backoff * 2, 10_000);
      setTimeout(() => connect(client), delay);
    }
  });
}

async function securityChecks() {
  for (const base of config.KOTOBA_PROBE_URLS) {
    for (const [name, overrides, expected] of [
      ["no-secret", { Authorization: "" }, 401],
      ["wrong-secret", { Authorization: "Bearer invalid" }, 401],
      ["foreign-origin", { Origin: "https://foreign.invalid" }, 403],
      ["no-origin", { Origin: "" }, 403],
    ]) {
      const response = await fetch(new URL(path, base), { headers: { ...headers, ...overrides }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
      metrics.security.push({ host: new URL(base).host, name, status: response.status, expected });
      if (response.status !== expected) throw new Error("Probe guard or deployment protection blocked the test");
    }
  }
}

async function until(predicate, timeoutMs, reason) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeoutMs) throw new Error(reason);
    await wait(100);
  }
}

try {
  await securityChecks();
  for (let index = 0; index < 20; index++) {
    const client = {
      id: `p${String(index).padStart(2, "0")}`, base: config.KOTOBA_PROBE_URLS[index % config.KOTOBA_PROBE_URLS.length],
      ready: false, acked: 0, welcomes: 0, backoff: 250, revision: 0, snapshotAt: 0,
    };
    clients.push(client);
    connect(client);
    await wait(100);
  }
  await until(() => clients.every((client) => client.ready), 45_000, "20 clients did not become ready");
  const start = performance.now();
  let step = 0;
  while (performance.now() - start < config.KOTOBA_PROBE_SECONDS * 1000) {
    step++;
    metrics.peakReady = Math.max(metrics.peakReady, clients.filter((client) => client.ready).length);
    for (const [index, client] of clients.entries()) {
      if (!client.ready) continue;
      if (client.pending) {
        send(client, { type: "advance", sequence: client.pending.sequence });
      } else {
        const sequence = client.acked + 1;
        const fault = index === 0 ? ({ 2: "duplicate", 3: "omit", 4: "publish-failure" })[step] : undefined;
        client.pending = { sequence, sentAt: performance.now() };
        send(client, { type: "advance", sequence, ...(fault ? { fault } : {}) });
      }
      await wait(30);
    }
    if (step === 5) send(clients[0], { type: "advance", sequence: clients[0].pending?.sequence ?? clients[0].acked });
    if (step % 3 === 0) for (const client of clients) send(client, { type: "sync" });
    if (step === 7) for (const client of clients) { if (send(client, { type: "disconnect" })) metrics.injectedDisconnects++; }
    if (step % 6 === 0) console.log(JSON.stringify({ elapsedSeconds: Math.round((performance.now() - start) / 1000), ready: clients.filter((client) => client.ready).length, reconnects: metrics.reconnects, instances: instances.size, crossInstanceDeliveries: metrics.crossInstanceDeliveries }));
    await wait(Math.min(10_000, Math.max(0, config.KOTOBA_PROBE_SECONDS * 1000 - (performance.now() - start))));
  }
  metrics.actualSeconds = Math.round((performance.now() - start) / 1000);
  await until(() => clients.every((client) => client.ready && !client.pending), 20_000, "Pending commands did not settle");
  const syncedAt = performance.now();
  for (const client of clients) send(client, { type: "sync" });
  await until(() => clients.every((client) => client.snapshotAt > syncedAt), 15_000, "Final snapshots unavailable");
  for (const client of clients) {
    if (Object.keys(client.state.members).length !== 20 || clients.some((other) => client.state.members[other.id] !== other.acked)) {
      throw new Error("Final snapshots disagree with the acknowledged ledger");
    }
  }
  metrics.finalRevision = clients[0].state.revision;
  metrics.finalSequences = Object.fromEntries(clients.map((client) => [client.id, client.acked]));
  if (metrics.failures.length) throw new Error("Protocol inconsistencies recorded");
  if (config.KOTOBA_PROBE_URLS.length > 1 && metrics.crossInstanceDeliveries === 0) throw new Error("Cross-instance delivery was not observed");
  metrics.result = "PASS";
} catch (error) {
  metrics.result = "FAIL";
  metrics.failure = error instanceof Error ? error.message : "Probe failed";
  process.exitCode = 1;
} finally {
  stopping = true;
  for (const client of clients) client.ws?.terminate();
  await wait(1000);
  try {
    const response = await fetch(new URL(path, config.KOTOBA_PROBE_URLS[0]), { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) });
    metrics.cleanupStatus = response.status;
    if (response.status !== 204) { metrics.result = "FAIL"; process.exitCode = 1; }
  } catch { metrics.cleanupStatus = "unavailable"; metrics.result = "FAIL"; process.exitCode = 1; }
  latencies.sort((a, b) => a - b);
  const percentile = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0);
  metrics.ackLatencyMs = { samples: latencies.length, p50: percentile(0.5), p95: percentile(0.95), max: percentile(1) };
  metrics.instanceIds = [...instances];
  metrics.finishedAt = new Date().toISOString();
  await mkdir(dirname(config.KOTOBA_PROBE_REPORT), { recursive: true });
  await writeFile(config.KOTOBA_PROBE_REPORT, JSON.stringify(metrics, null, 2) + "\n");
  console.log(JSON.stringify(metrics, null, 2));
}
