import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import {
  env,
  MAX_ACTIVE_SESSIONS,
  SESSION_ACTIVITY_UPDATE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/constants";
import { redis, redisKey } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const encodedSecret = new TextEncoder().encode(env.SESSION_SECRET);

const SessionPayloadSchema = z.object({
  userId: z.number().int().positive(),
  sessionId: z.uuid(),
});

const SessionMetadataSchema = z.object({
  sessionId: z.uuid(),
  userId: z.number().int().positive(),
  deviceName: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export type SessionPayload = z.infer<typeof SessionPayloadSchema>;
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

function sessionKey(sessionId: string) {
  return redisKey("auth", "session", sessionId);
}

function userSessionsKey(userId: number) {
  return redisKey("auth", "user-sessions", userId);
}

function getDeviceName(userAgent: string | null) {
  if (!userAgent) return "Perangkat tidak dikenal";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /CriOS\//.test(userAgent)
        ? "Chrome"
        : /FxiOS\//.test(userAgent)
          ? "Firefox"
          : /Chrome\//.test(userAgent)
            ? "Chrome"
            : /Firefox\//.test(userAgent)
              ? "Firefox"
              : /Safari\//.test(userAgent)
                ? "Safari"
                : "Browser";

  const platform = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "perangkat lain";

  return `${browser} di ${platform}`;
}

async function encrypt(payload: SessionPayload, durationSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(`${durationSeconds}s`)
    .sign(encodedSecret);
}

async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ["HS256"],
    });
    const parsed = SessionPayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function deleteSessionEntries(userId: number, sessionIds: string[]) {
  if (sessionIds.length === 0) return;

  const transaction = redis.multi();
  for (const sessionId of sessionIds) {
    transaction.del(sessionKey(sessionId));
  }
  transaction.zrem(userSessionsKey(userId), ...sessionIds);
  await transaction.exec();
}

export async function createSession(userId: number) {
  const requestHeaders = await headers();
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletionScheduledFor: true },
  });
  if (!user || (user.deletionScheduledFor && user.deletionScheduledFor <= now)) {
    throw new Error("Account is not available for a new session.");
  }

  const defaultExpiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
  const expiresAt =
    user.deletionScheduledFor && user.deletionScheduledFor < defaultExpiresAt
      ? user.deletionScheduledFor
      : defaultExpiresAt;
  const durationSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - now.getTime()) / 1000),
  );
  const sessionId = crypto.randomUUID();
  const metadata: SessionMetadata = {
    sessionId,
    userId,
    deviceName: getDeviceName(requestHeaders.get("user-agent")),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const transaction = redis.multi();
  transaction.set(sessionKey(sessionId), metadata, { ex: durationSeconds });
  transaction.zadd(userSessionsKey(userId), { score: expiresAt.getTime(), member: sessionId });
  transaction.expire(userSessionsKey(userId), durationSeconds);
  await transaction.exec();

  const sessionIds = await redis.zrange<string[]>(userSessionsKey(userId), 0, -1);
  const overflow = sessionIds.slice(0, Math.max(0, sessionIds.length - MAX_ACTIVE_SESSIONS));
  await deleteSessionEntries(userId, overflow);

  const token = await encrypt({ userId, sessionId }, durationSeconds);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return sessionId;
}

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  if (!payload) return null;

  try {
    const rawMetadata = await redis.get<unknown>(sessionKey(payload.sessionId));
    const parsedMetadata = SessionMetadataSchema.safeParse(rawMetadata);
    if (
      !parsedMetadata.success ||
      parsedMetadata.data.userId !== payload.userId ||
      new Date(parsedMetadata.data.expiresAt).getTime() <= Date.now()
    ) {
      return null;
    }

    const lastSeenAt = new Date(parsedMetadata.data.lastSeenAt).getTime();
    if (Date.now() - lastSeenAt >= SESSION_ACTIVITY_UPDATE_SECONDS * 1000) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((new Date(parsedMetadata.data.expiresAt).getTime() - Date.now()) / 1000),
      );
      await redis.set(
        sessionKey(payload.sessionId),
        { ...parsedMetadata.data, lastSeenAt: new Date().toISOString() },
        { ex: remainingSeconds },
      );
    }

    return payload;
  } catch {
    // Session validation fails closed when Redis cannot confirm revocation state.
    return null;
  }
});

export async function listUserSessions(userId: number) {
  const indexKey = userSessionsKey(userId);
  await redis.zremrangebyscore(indexKey, 0, Date.now());
  const sessionIds = await redis.zrange<string[]>(indexKey, 0, -1, { rev: true });
  if (sessionIds.length === 0) return [];

  const values = await redis.mget<unknown[]>(...sessionIds.map(sessionKey));
  const staleSessionIds: string[] = [];
  const sessions: SessionMetadata[] = [];

  values.forEach((value, index) => {
    const parsed = SessionMetadataSchema.safeParse(value);
    if (!parsed.success || parsed.data.userId !== userId) {
      const sessionId = sessionIds[index];
      if (sessionId) staleSessionIds.push(sessionId);
      return;
    }
    sessions.push(parsed.data);
  });

  if (staleSessionIds.length > 0) {
    await redis.zrem(indexKey, ...staleSessionIds);
  }

  return sessions;
}

export async function revokeUserSession(userId: number, sessionId: string) {
  const rawMetadata = await redis.get<unknown>(sessionKey(sessionId));
  const parsed = SessionMetadataSchema.safeParse(rawMetadata);
  if (!parsed.success || parsed.data.userId !== userId) return false;

  await deleteSessionEntries(userId, [sessionId]);
  return true;
}

export async function revokeAllUserSessions(userId: number, exceptSessionId?: string) {
  const sessionIds = await redis.zrange<string[]>(userSessionsKey(userId), 0, -1);
  const revokedSessionIds = exceptSessionId
    ? sessionIds.filter((sessionId) => sessionId !== exceptSessionId)
    : sessionIds;
  await deleteSessionEntries(userId, revokedSessionIds);
  return revokedSessionIds.length;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  cookieStore.delete(SESSION_COOKIE_NAME);
  if (!token) return;

  const payload = await decrypt(token);
  if (!payload) return;

  try {
    await revokeUserSession(payload.userId, payload.sessionId);
  } catch {
    // The browser cookie is still removed even if Redis is temporarily unavailable.
  }
}
