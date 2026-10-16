import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClashError } from "../domain/ports";
import type { ClashRoomSnapshot } from "../contracts";

const fixture = vi.hoisted(() => ({ verify: vi.fn(), read: vi.fn(), submit: vi.fn(), owns: vi.fn(), runtime: vi.fn(), online: vi.fn(), change: vi.fn(), publish: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ verifyClashPrincipal: fixture.verify }));
vi.mock("./runtime", () => ({ clashCommands: { submitAnswer: fixture.submit }, clashState: { read: fixture.read }, publishClashChange: fixture.publish }));
vi.mock("./presence", () => ({ clashPresence: { owns: fixture.owns, online: fixture.online, change: fixture.change }, requireClashRuntime: fixture.runtime }));
vi.mock("./subscription", () => ({ subscribeClashRoom: () => ({ ready: Promise.resolve(), done: new Promise<void>(() => undefined), close: vi.fn() }) }));
vi.mock("@/lib/server-logger", () => ({ reportServerError: vi.fn() }));
import { attachClashSocket } from "./socket";

let server: WebSocketServer;
let client: WebSocket;
let messages: unknown[];
const roomId = randomUUID();
const memberId = randomUUID();
const matchId = randomUUID();
const roundId = randomUUID();
const initial: ClashRoomSnapshot = {
  id: roomId, code: "ABCD2345", revision: 0, serverNow: Date.now(), closed: false, configRevision: 0, config: null,
  viewer: { memberId, isHost: false, spectating: false }, members: [], match: null,
};

async function until(test: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) { if (test()) return; await delay(5); }
  throw new Error("Timed out waiting for socket event");
}

beforeEach(async () => {
  vi.clearAllMocks();
  fixture.verify.mockReset().mockResolvedValue({ kind: "guest", hash: "fixture", expiresAt: Date.now() + 60000 });
  fixture.owns.mockReset().mockResolvedValue(true);
  fixture.runtime.mockReset().mockResolvedValue(undefined);
  fixture.read.mockResolvedValue(initial);
  fixture.online.mockResolvedValue([memberId]);
  fixture.change.mockResolvedValue(true);
  fixture.submit.mockResolvedValue({ roundId, acceptedAt: 12345, revision: 1, duplicate: false });
  server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  server.on("connection", (ws) => attachClashSocket(ws, { kind: "guest", hash: "fixture" }, { roomId, memberId, owner: randomUUID() }));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  messages = [];
  client = new WebSocket(`ws://127.0.0.1:${address.port}`);
  client.on("message", (bytes) => { const value: unknown = JSON.parse(bytes.toString()); messages.push(value); });
  await until(() => messages.length > 0);
});

afterEach(async () => {
  client.terminate();
  for (const ws of server.clients) ws.terminate();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("product WebSocket command boundary", () => {
  function answer(overrides: object = {}) {
    return { protocolVersion: 1, type: "submit_answer", requestId: randomUUID(), roomId, matchId, roundId, choice: 2, ...overrides };
  }
  it("returns only a private acceptance ACK and reauthenticates before committing", async () => {
    const command = answer();
    client.send(JSON.stringify(command));
    await until(() => messages.some((value) => typeof value === "object" && value !== null && "type" in value && value.type === "answer_ack"));
    const ack = messages.find((value) => typeof value === "object" && value !== null && "type" in value && value.type === "answer_ack");
    expect(ack).toEqual({ protocolVersion: 1, type: "answer_ack", requestId: command.requestId, roundId, acceptedAt: 12345 });
    expect(fixture.verify.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fixture.submit).toHaveBeenCalledOnce();
  });
  it("does not let a socket switch to an unrelated room", async () => {
    client.send(JSON.stringify(answer({ roomId: randomUUID() })));
    await until(() => JSON.stringify(messages).includes("UNAUTHORIZED"));
    expect(fixture.submit).not.toHaveBeenCalled();
  });
  it("rejects revoked credentials before an answer reaches persistence", async () => {
    fixture.verify.mockRejectedValue(new ClashError("UNAUTHORIZED"));
    client.send(JSON.stringify(answer()));
    await until(() => JSON.stringify(messages).includes("UNAUTHORIZED"));
    expect(fixture.submit).not.toHaveBeenCalled();
  });
  it("closes a replaced connection before it can submit", async () => {
    fixture.owns.mockResolvedValue(false);
    const closed = once(client, "close");
    client.send(JSON.stringify(answer()));
    expect((await closed)[0]).toBe(4009);
    expect(fixture.submit).not.toHaveBeenCalled();
  });
  it("rejects protocol extras and binary frames", async () => {
    client.send(JSON.stringify(answer({ correctChoice: 2 })));
    await until(() => JSON.stringify(messages).includes("INVALID_INPUT"));
    expect(fixture.submit).not.toHaveBeenCalled();
    const closed = once(client, "close");
    client.send(Buffer.from("binary"));
    expect((await closed)[0]).toBe(1008);
  });
});
