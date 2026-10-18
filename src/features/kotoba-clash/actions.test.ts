import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClashError } from "./domain/ports";

const fixture = vi.hoisted(() => ({
  principal: vi.fn(), verify: vi.fn(), create: vi.fn(), publish: vi.fn(), limit: vi.fn(), read: vi.fn(), kick: vi.fn(), rename: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "192.0.2.10" }) }));
vi.mock("@/constants", () => ({ env: { SESSION_SECRET: "fixture-secret" }, KOTOBA_ROOM_CREATE_RATE_LIMIT: { maximum: 20, seconds: 60 } }));
vi.mock("@/lib/server-logger", () => ({ reportServerError: vi.fn() }));
vi.mock("./server/auth", () => ({
  readClashPrincipal: fixture.principal, verifyClashPrincipal: fixture.verify,
  requireClashEnabled: vi.fn(), createClashGuest: vi.fn(),
}));
vi.mock("./server/presence", () => ({ limitClash: fixture.limit, requireClashRuntime: vi.fn(), clashPresence: {} }));
vi.mock("./server/catalog", () => ({ getClashCatalog: vi.fn(), sampleClashQuestions: vi.fn() }));
vi.mock("./server/runtime", () => ({
  clashLobby: { create: fixture.create, kick: fixture.kick, rename: fixture.rename }, publishClashChange: fixture.publish, clashState: { read: fixture.read }, clashCommands: {},
}));
import { createClashRoomAction, kickClashMemberAction, renameClashMemberAction } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  fixture.principal.mockResolvedValue({ kind: "account" });
  fixture.verify.mockResolvedValue({ kind: "account", userId: 1 });
  fixture.create.mockResolvedValue({ id: randomUUID(), code: "ABCD2345", revision: 0, duplicate: false, closedRooms: [] });
});

describe("Kotoba Clash lobby edits", () => {
  it("validates member edits before reading or writing room data", async () => {
    expect(await kickClashMemberAction({ roomId: randomUUID(), memberId: "invalid" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await renameClashMemberAction({ roomId: randomUUID(), nickname: "Valid", userId: 2 })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(fixture.read).not.toHaveBeenCalled();
    expect(fixture.kick).not.toHaveBeenCalled();
    expect(fixture.rename).not.toHaveBeenCalled();
  });
  it("broadcasts only committed lobby edits and returns an actor-scoped snapshot", async () => {
    const roomId = randomUUID();
    const memberId = randomUUID();
    fixture.kick.mockResolvedValue({ revision: 2 });
    fixture.rename.mockRejectedValueOnce(new ClashError("NICKNAME_TAKEN"));
    fixture.read.mockResolvedValue({ id: roomId });
    expect(await renameClashMemberAction({ roomId, nickname: "Taken" })).toMatchObject({ ok: false, code: "NICKNAME_TAKEN" });
    expect(fixture.publish).not.toHaveBeenCalled();
    expect(await kickClashMemberAction({ roomId, memberId })).toEqual({ ok: true, data: { id: roomId } });
    expect(fixture.kick).toHaveBeenCalledWith({ kind: "account", userId: 1 }, { roomId, memberId });
    expect(fixture.publish).toHaveBeenCalledExactlyOnceWith(roomId, 2);
    expect(fixture.read).toHaveBeenLastCalledWith({ kind: "account", userId: 1 }, roomId);
  });
});

describe("Kotoba Clash room creation", () => {
  it("uses independent account buckets for hosts sharing one IP, with the relaxed limit", async () => {
    fixture.verify.mockResolvedValueOnce({ kind: "account", userId: 1 }).mockResolvedValueOnce({ kind: "account", userId: 2 });
    expect((await createClashRoomAction({ nickname: "Host one", requestId: randomUUID() })).ok).toBe(true);
    expect((await createClashRoomAction({ nickname: "Host two", requestId: randomUUID() })).ok).toBe(true);
    const subjects = fixture.limit.mock.calls.map((call) => call[1] as unknown);
    expect(subjects[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(subjects[0]).not.toBe(subjects[1]);
    expect(fixture.limit).toHaveBeenCalledTimes(2);
    for (const call of fixture.limit.mock.calls) expect(call).toEqual(["create-account", expect.any(String), 20, 60]);
  });
  it("rejects a guest or revoked session before creation or consuming an account bucket", async () => {
    fixture.verify.mockResolvedValueOnce({ kind: "guest", hash: "fixture", expiresAt: Date.now() + 60000 });
    expect(await createClashRoomAction({ nickname: "Guest" })).toMatchObject({ ok: false, code: "HOST_REQUIRED" });
    fixture.verify.mockRejectedValueOnce(new ClashError("UNAUTHORIZED"));
    expect(await createClashRoomAction({ nickname: "Revoked" })).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(fixture.create).not.toHaveBeenCalled();
    expect(fixture.limit).not.toHaveBeenCalled();
  });
  it("still rejects excessive creation before touching room data", async () => {
    fixture.limit.mockRejectedValueOnce(new ClashError("RATE_LIMITED"));
    expect(await createClashRoomAction({ nickname: "Host" })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(fixture.create).not.toHaveBeenCalled();
    expect(fixture.publish).not.toHaveBeenCalled();
  });
  it("publishes old-room revisions after replacement and returns only the new room", async () => {
    const roomId = randomUUID();
    const closedRooms = [{ id: randomUUID(), revision: 8 }, { id: randomUUID(), revision: 3 }];
    const order: string[] = [];
    fixture.create.mockImplementation(async () => {
      order.push("commit");
      return { id: roomId, code: "ABCD2345", revision: 0, closedRooms, duplicate: false };
    });
    fixture.publish.mockImplementation(async () => { order.push("publish"); });
    const request = { nickname: "Host", requestId: roomId };
    expect(await createClashRoomAction(request)).toEqual({ ok: true, data: { id: roomId, code: "ABCD2345", revision: 0 } });
    expect(fixture.create).toHaveBeenCalledWith({ kind: "account", userId: 1 }, { ...request, mode: "multiplayer" });
    expect(order).toEqual(["commit", "publish", "publish"]);
    for (const room of closedRooms) expect(fixture.publish).toHaveBeenCalledWith(room.id, room.revision);
  });
  it("does not broadcast closures when the transaction fails or an existing request is retried", async () => {
    fixture.create.mockRejectedValueOnce(new ClashError("CLOSED"));
    expect(await createClashRoomAction({ nickname: "Host", requestId: randomUUID() })).toMatchObject({ ok: false, code: "CLOSED" });
    fixture.create.mockResolvedValueOnce({ id: randomUUID(), code: "ABCD2345", revision: 2, duplicate: true, closedRooms: [] });
    expect((await createClashRoomAction({ nickname: "Host", requestId: randomUUID() })).ok).toBe(true);
    expect(fixture.publish).not.toHaveBeenCalled();
  });
  it("validates the mode and forwards solo creation with the authenticated owner", async () => {
    expect(await createClashRoomAction({ nickname: "Host", mode: "invalid" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(fixture.create).not.toHaveBeenCalled();
    const request = { nickname: "Host", mode: "solo", requestId: randomUUID() };
    expect((await createClashRoomAction(request)).ok).toBe(true);
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith({ kind: "account", userId: 1 }, request);
  });
});
