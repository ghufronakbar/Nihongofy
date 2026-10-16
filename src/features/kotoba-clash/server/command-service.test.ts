import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClashCommandService } from "./command-service";

describe("Kotoba Clash commit then publish", () => {
  it("keeps the committed ACK when publish fails and does not republish a duplicate", async () => {
    const order: string[] = [];
    const repository = {
      start: vi.fn(), reconcile: vi.fn(),
      submitAnswer: vi.fn().mockImplementation(async () => {
        order.push("commit");
        return { roundId: "round", acceptedAt: 10, duplicate: false, revision: 2 };
      }),
    };
    const publish = vi.fn().mockImplementation(async () => { order.push("publish"); throw new Error("simulated outage"); });
    const report = vi.fn();
    const authenticate = vi.fn().mockResolvedValue({ kind: "account", userId: 1 });
    const service = new ClashCommandService(repository, { publish }, authenticate, report);
    const input = { roomId: randomUUID(), matchId: randomUUID(), roundId: randomUUID(), requestId: randomUUID(), choice: 1 };
    const identity = { kind: "account" as const, userId: 1 };
    const result = await service.submitAnswer(identity, input);
    expect(order).toEqual(["commit", "publish"]);
    expect(result.acceptedAt).toBe(10);
    expect(report).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]![0]).toEqual({ protocolVersion: 1, type: "room_changed", roomId: input.roomId, revision: 2 });
    repository.submitAnswer.mockResolvedValue({ ...result, duplicate: true });
    await service.submitAnswer(identity, input);
    expect(publish).toHaveBeenCalledOnce();
    expect(authenticate).toHaveBeenCalledTimes(2);
  });
  it("does not publish a rejected transaction", async () => {
    const repository = { start: vi.fn(), reconcile: vi.fn(), submitAnswer: vi.fn().mockRejectedValue(new Error("rejected")) };
    const publish = vi.fn();
    const service = new ClashCommandService(repository, { publish }, async () => ({ kind: "account", userId: 1 }), vi.fn());
    await expect(service.submitAnswer({ kind: "account", userId: 1 }, {
      roomId: randomUUID(), matchId: randomUUID(), roundId: randomUUID(), requestId: randomUUID(), choice: 1,
    })).rejects.toThrow("rejected");
    expect(publish).not.toHaveBeenCalled();
  });
  it("rejects a revoked principal before touching persistence", async () => {
    const repository = { start: vi.fn(), reconcile: vi.fn(), submitAnswer: vi.fn() };
    const publish = vi.fn();
    const service = new ClashCommandService(repository, { publish }, async () => { throw new Error("revoked"); }, vi.fn());
    await expect(service.reconcile({}, randomUUID(), randomUUID())).rejects.toThrow("revoked");
    expect(repository.reconcile).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
