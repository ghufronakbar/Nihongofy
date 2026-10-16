import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ redis: { get: fixture.get }, redisKey: (...parts: string[]) => parts.join(":") }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/constants", () => ({ env: { SESSION_SECRET: "test-secret-not-for-runtime" } }));
import { revalidateSession } from "./auth";

beforeEach(() => fixture.get.mockReset());

describe("uncached session revalidation for long-lived connections", () => {
  const session = { userId: 1, sessionId: randomUUID() };
  const metadata = () => ({ ...session, deviceName: "Test", createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() });
  it("checks the registry on every call and immediately sees revocation", async () => {
    fixture.get.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(null);
    expect(await revalidateSession(session)).toEqual(session);
    expect(await revalidateSession(session)).toBeNull();
    expect(fixture.get).toHaveBeenCalledTimes(2);
  });
  it("rejects expired, mismatched, or unavailable registry data", async () => {
    fixture.get.mockResolvedValueOnce({ ...metadata(), expiresAt: new Date(0).toISOString() });
    expect(await revalidateSession(session)).toBeNull();
    fixture.get.mockResolvedValueOnce({ ...metadata(), userId: 2 });
    expect(await revalidateSession(session)).toBeNull();
    fixture.get.mockResolvedValueOnce({ ...metadata(), sessionId: randomUUID() });
    expect(await revalidateSession(session)).toBeNull();
    fixture.get.mockRejectedValueOnce(new Error("unavailable"));
    expect(await revalidateSession(session)).toBeNull();
  });
  it("validates input before accessing Redis", async () => {
    expect(await revalidateSession({ userId: 1 })).toBeNull();
    expect(fixture.get).not.toHaveBeenCalled();
  });
});
