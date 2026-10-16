import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { CLASH_RETENTION_MS } from "../domain/rules";

export const GuestTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function hashGuestToken(raw: unknown): string | null {
  const parsed = GuestTokenSchema.safeParse(raw);
  if (!parsed.success) return null;
  const bytes = Buffer.from(parsed.data, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== parsed.data) return null;
  return createHash("sha256").update(parsed.data).digest("hex");
}

export function createGuestCredential(now: number) {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashGuestToken(token)!, expiresAt: now + CLASH_RETENTION_MS };
}

export function createRoomCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}
