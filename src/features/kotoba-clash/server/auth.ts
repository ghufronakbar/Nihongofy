import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { FEATURES, KOTOBA_GUEST_COOKIE_NAME } from "@/constants";
import { CACHE_KEYS } from "@/constants/cache-key";
import { getSession, revalidateSession, type SessionPayload } from "@/lib/auth";
import { redis, redisKey } from "@/lib/redis";
import { ClashError, type ClashIdentity } from "../domain/ports";
import { CLASH_RETENTION_MS } from "../domain/rules";
import { createGuestCredential, hashGuestToken } from "./guest-credential";

export type ClashPrincipal =
  | { kind: "account"; session: SessionPayload }
  | { kind: "guest"; hash: string };

export function requireClashEnabled() {
  if (!FEATURES.kotobaClash) throw new ClashError("NOT_FOUND");
}

export async function readClashPrincipal(): Promise<ClashPrincipal | null> {
  requireClashEnabled();
  const session = await getSession();
  if (session) return { kind: "account", session };
  const hash = hashGuestToken((await cookies()).get(KOTOBA_GUEST_COOKIE_NAME)?.value);
  return hash ? { kind: "guest", hash } : null;
}

export async function createClashGuest() {
  requireClashEnabled();
  const credential = createGuestCredential(Date.now());
  await redis.set(redisKey(...CACHE_KEYS.kotobaGuest(credential.hash)), { expiresAt: credential.expiresAt }, { px: CLASH_RETENTION_MS });
  (await cookies()).set(KOTOBA_GUEST_COOKIE_NAME, credential.token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    expires: new Date(credential.expiresAt),
  });
  return { kind: "guest" as const, hash: credential.hash, expiresAt: credential.expiresAt };
}

export async function verifyClashPrincipal(principal: ClashPrincipal): Promise<ClashIdentity> {
  requireClashEnabled();
  if (principal.kind === "guest") {
    const raw = await redis.get<unknown>(redisKey(...CACHE_KEYS.kotobaGuest(principal.hash)));
    const metadata = z.object({ expiresAt: z.number().int().positive() }).safeParse(raw);
    if (!metadata.success || metadata.data.expiresAt <= Date.now()) throw new ClashError("UNAUTHORIZED");
    return { kind: "guest", hash: principal.hash, expiresAt: metadata.data.expiresAt };
  }
  const session = await revalidateSession(principal.session);
  if (!session) throw new ClashError("UNAUTHORIZED");
  return { kind: "account", userId: session.userId };
}
