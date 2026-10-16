import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  flags: { kotobaClash: true }, get: vi.fn(), set: vi.fn(), cookieSet: vi.fn(),
  getSession: vi.fn(), revalidateSession: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/constants", () => ({ FEATURES: fixture.flags, KOTOBA_GUEST_COOKIE_NAME: "__Host-kotoba_guest" }));
vi.mock("@/lib/auth", () => ({ getSession: fixture.getSession, revalidateSession: fixture.revalidateSession }));
vi.mock("@/lib/redis", () => ({ redis: { get: fixture.get, set: fixture.set }, redisKey: (...parts: string[]) => parts.join(":") }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: fixture.cookieSet }) }));

import { createClashGuest, verifyClashPrincipal } from "./auth";
import { CLASH_RETENTION_MS } from "../domain/rules";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.flags.kotobaClash = true;
});

describe("Kotoba Clash principal verification", () => {
  it("stores only the credential hash and fixed expiry in Redis with a secure separate cookie", async () => {
    const identity = await createClashGuest();
    const [name, token, options] = fixture.cookieSet.mock.calls[0]!;
    expect(name).toBe("__Host-kotoba_guest");
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(options.expires.getTime()).toBe(identity.expiresAt);
    expect(fixture.set).toHaveBeenCalledWith(expect.stringContaining(identity.hash), { expiresAt: identity.expiresAt }, { px: CLASH_RETENTION_MS });
    expect(JSON.stringify(fixture.set.mock.calls)).not.toContain(token);
  });
  it("verifies guests against the registry without extending their original lifetime", async () => {
    const principal = { kind: "guest" as const, hash: "a".repeat(64) };
    const expiresAt = Date.now() + 10_000;
    fixture.get.mockResolvedValue({ expiresAt });
    expect(await verifyClashPrincipal(principal)).toEqual({ ...principal, expiresAt });
    expect(await verifyClashPrincipal(principal)).toEqual({ ...principal, expiresAt });
    expect(fixture.get).toHaveBeenCalledTimes(2);
    expect(fixture.set).not.toHaveBeenCalled();
    fixture.get.mockResolvedValue({ expiresAt: Date.now() - 1 });
    await expect(verifyClashPrincipal(principal)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    fixture.get.mockResolvedValue(null);
    await expect(verifyClashPrincipal(principal)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rechecks accounts and rejects feature-off commands before registry/database access", async () => {
    const principal = { kind: "account" as const, session: { userId: 1, sessionId: "session" } };
    fixture.revalidateSession.mockResolvedValueOnce(principal.session).mockResolvedValueOnce(null);
    expect(await verifyClashPrincipal(principal)).toEqual({ kind: "account", userId: 1 });
    await expect(verifyClashPrincipal(principal)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    fixture.flags.kotobaClash = false;
    await expect(verifyClashPrincipal(principal)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fixture.revalidateSession).toHaveBeenCalledTimes(2);
    expect(fixture.get).not.toHaveBeenCalled();
  });
});
