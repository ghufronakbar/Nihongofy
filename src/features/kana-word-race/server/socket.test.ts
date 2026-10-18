import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG, ServerMessageSchema, type RaceSnapshot } from "../contracts";

const fixture = vi.hoisted(() => ({
  enabled: true, callbacks: new Map<string, () => void>(),
  owners: new Map<string, string>(), states: new Map<string, RaceSnapshot>(),
  run: vi.fn(), verify: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ verifyRacePrincipal: fixture.verify }));
vi.mock("./presence", () => ({
  requireRaceRuntime: async () => { if (!fixture.enabled) throw new Error("Disabled"); }, limitRace: async () => undefined,
  racePresence: {
    owns: async (connection: { memberId: string; owner: string }) => fixture.owners.get(connection.memberId) === connection.owner,
    online: async () => [...fixture.owners.keys()],
    change: async (connection: { memberId: string; owner: string }, operation: string) => { if (fixture.owners.get(connection.memberId) !== connection.owner) return false; if (operation === "release") fixture.owners.delete(connection.memberId); return true; },
  },
}));
vi.mock("./runtime", () => ({
  raceRepository: { run: fixture.run },
  publishRaceChange: async (roomId: string) => fixture.callbacks.get(roomId)?.(),
  raceFailure: (error: unknown) => ({ message: error instanceof Error ? error.message : "Unavailable", terminal: error instanceof Error && "terminal" in error && error.terminal === true }),
}));
vi.mock("./subscription", () => ({ subscribeRaceRoom: (roomId: string, callback: () => void) => {
  fixture.callbacks.set(roomId, callback);
  return { ready: Promise.resolve(), done: new Promise<void>(() => undefined), close: () => fixture.callbacks.delete(roomId) };
} }));
import { attachRaceSocket } from "./socket";

const dispose: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of dispose.splice(0)) await close(); fixture.callbacks.clear(); fixture.owners.clear(); fixture.states.clear(); vi.clearAllMocks(); fixture.enabled = true; });

async function network() {
  const roomId = randomUUID(); const server = createServer(); const sockets = new WebSocketServer({ server, maxPayload: 2048 });
  sockets.on("connection", (ws, request) => {
    const memberId = new URL(request.url!, "http://localhost").searchParams.get("member")!;
    const owner = randomUUID(); fixture.owners.set(memberId, owner);
    attachRaceSocket(ws, { kind: "guest", hash: memberId }, { roomId, memberId, owner });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing listener");
  const port = address.port;
  dispose.push(async () => { for (const client of sockets.clients) client.terminate(); await new Promise<void>((resolve) => sockets.close(() => server.close(() => resolve()))); });
  fixture.verify.mockImplementation(async (principal: { hash: string }) => ({ kind: "guest", hash: principal.hash, expiresAt: Date.now() + 100000 }));
  fixture.run.mockImplementation(async (identity: { hash: string }, command: { type: string }) => {
    const state = fixture.states.get(identity.hash)!;
    if (command.type === "ready") { state.members[0]!.ready = true; }
    return structuredClone(state);
  });
  async function connect(memberId: string) {
    const state: RaceSnapshot = { roomId, code: "ABCD2345", revision: 1, serverNow: Date.now(), closed: false, viewer: { memberId, host: false }, config: DEFAULT_CONFIG, stock: { "3": 20 }, members: [{ id: memberId, nickname: `Player ${fixture.states.size}`, ready: false }], match: null };
    fixture.states.set(memberId, state);
    const messages: unknown[] = [];
    const client = new WebSocket(`ws://127.0.0.1:${port}/?member=${memberId}`);
    client.on("message", (raw) => { messages.push(JSON.parse(raw.toString()) as unknown); });
    await once(client, "open");
    await vi.waitFor(() => expect(messages.some((message) => ServerMessageSchema.parse(message).type === "snapshot")).toBe(true));
    return { client, messages };
  }
  return { roomId, connect };
}

describe("Kana Race socket over loopback WebSocket", () => {
  it("broadcast invalidation refreshes each connection's own projection; commands receive ACK", async () => {
    const { roomId, connect } = await network(); const a = randomUUID(); const b = randomUUID();
    const alice = await connect(a); const bob = await connect(b);
    const requestId = randomUUID(); alice.client.send(JSON.stringify({ type: "ready", roomId, requestId, revision: 1, ready: true }));
    await vi.waitFor(() => expect(alice.messages.some((raw) => { const event = ServerMessageSchema.parse(raw); return event.type === "ack" && event.requestId === requestId; })).toBe(true));
    fixture.callbacks.get(roomId)!();
    await vi.waitFor(() => expect(bob.messages.length).toBeGreaterThan(1));
    for (const [client, memberId] of [[alice, a], [bob, b]] as const) for (const raw of client.messages) {
      const event = ServerMessageSchema.parse(raw); if (event.type === "snapshot") expect(event.state.viewer.memberId).toBe(memberId);
    }
    expect(fixture.callbacks.size).toBe(1);
  });
  it("rejects commands on the displaced tab before calling the repository", async () => {
    const { roomId, connect } = await network(); const memberId = randomUUID(); const old = await connect(memberId);
    await connect(memberId); fixture.run.mockClear();
    const close = once(old.client, "close");
    old.client.send(JSON.stringify({ type: "sync", roomId, requestId: randomUUID() }));
    const [code] = await close; expect(code).toBe(4003);
    expect(fixture.run).not.toHaveBeenCalled();
  });
  it("bounds binary/payload abuse and checks revocation on every command", async () => {
    const { roomId, connect } = await network(); const alice = await connect(randomUUID());
    const binaryClose = once(alice.client, "close"); alice.client.send(Buffer.from("bad")); expect((await binaryClose)[0]).toBe(1008);
    const bob = await connect(randomUUID()); fixture.verify.mockRejectedValueOnce(new Error("Revoked")); fixture.run.mockClear();
    bob.client.send(JSON.stringify({ type: "sync", roomId, requestId: randomUUID() }));
    await vi.waitFor(() => expect(bob.messages.some((raw) => { const event = ServerMessageSchema.parse(raw); return event.type === "error" && event.message === "Revoked"; })).toBe(true));
    expect(fixture.run).not.toHaveBeenCalled();
  });
});
