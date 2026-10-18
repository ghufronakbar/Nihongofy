import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { FEATURES } from "@/constants";
import { CACHE_KEYS } from "@/constants/cache-key";
import { getSession, revalidateSession, type SessionPayload } from "@/lib/auth";
import { redis, redisKey } from "@/lib/redis";
import { RaceError, RETENTION_MS } from "../domain/engine";
import type { RaceIdentity } from "./repository";

const COOKIE = "__Host-kana_race_guest";
export type RacePrincipal = { kind: "account"; session: SessionPayload } | { kind: "guest"; hash: string };
export function requireRaceEnabled() { if (!FEATURES.kanaWordRace) throw new RaceError("Permainan tidak tersedia.", true); }
function hashToken(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) return null;
  return createHash("sha256").update(value).digest("hex");
}
export async function readRacePrincipal(): Promise<RacePrincipal | null> {
  requireRaceEnabled();
  const session = await getSession();
  if (session) return { kind: "account", session };
  const hash = hashToken((await cookies()).get(COOKIE)?.value);
  return hash ? { kind: "guest", hash } : null;
}
export async function verifyRacePrincipal(principal: RacePrincipal): Promise<RaceIdentity> {
  requireRaceEnabled();
  if (principal.kind === "account") {
    const session = await revalidateSession(principal.session);
    if (!session) throw new RaceError("Session berakhir. Masuk kembali.", true);
    return { kind: "account", userId: session.userId };
  }
  const value = z.object({ expiresAt: z.number() }).safeParse(await redis.get<unknown>(redisKey(...CACHE_KEYS.kanaRaceGuest(principal.hash))));
  if (!value.success || value.data.expiresAt <= Date.now()) throw new RaceError("Akses guest berakhir. Gabung kembali.", true);
  return { kind: "guest", hash: principal.hash, expiresAt: value.data.expiresAt };
}
export async function createRaceGuest(): Promise<RaceIdentity> {
  requireRaceEnabled();
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token)!;
  const expiresAt = Date.now() + RETENTION_MS;
  await redis.set(redisKey(...CACHE_KEYS.kanaRaceGuest(hash)), { expiresAt }, { px: RETENTION_MS });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: new Date(expiresAt) });
  return { kind: "guest", hash, expiresAt };
}
