import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createGuestCredential, createRoomCode, hashGuestToken } from "./guest-credential";
import { ClashRoomCodeSchema } from "../schemas";
import { CLASH_RETENTION_MS } from "../domain/rules";

describe("Kotoba Clash guest credential", () => {
  it("creates independent 256-bit credentials with an absolute seven-day expiry", () => {
    const first = createGuestCredential(1_000);
    const second = createGuestCredential(1_000);
    expect(first.token).toHaveLength(43);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.hash).not.toBe(first.token);
    expect(first.hash).not.toBe(second.hash);
    expect(first.expiresAt).toBe(1_000 + CLASH_RETENTION_MS);
    expect(hashGuestToken(first.token)).toBe(first.hash);
  });
  it("rejects malformed and noncanonical bearer tokens", () => {
    expect(hashGuestToken(undefined)).toBeNull();
    expect(hashGuestToken("a".repeat(42))).toBeNull();
    expect(hashGuestToken("!".repeat(43))).toBeNull();
    expect(hashGuestToken("A".repeat(42) + "B")).toBeNull();
  });
  it("generates nonsequential codes in the invitation alphabet", () => {
    const codes = Array.from({ length: 100 }, createRoomCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => ClashRoomCodeSchema.safeParse(code).success)).toBe(true);
  });
});
