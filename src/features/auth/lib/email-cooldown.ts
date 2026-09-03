import "server-only";

import { EMAIL_SEND_COOLDOWN_SECONDS } from "@/constants";
import { redis, redisKey } from "@/lib/redis";
import { hashAuthSubject } from "./rate-limit";

function cooldownKey(scope: string, subject: string) {
  return redisKey("auth", "email-cooldown", hashAuthSubject(scope, subject));
}

export async function acquireEmailCooldown(scope: string, subject: string) {
  const key = cooldownKey(scope, subject);
  const nonce = crypto.randomUUID();
  const result = await redis.set(key, nonce, {
    nx: true,
    ex: EMAIL_SEND_COOLDOWN_SECONDS,
  });

  if (result === "OK") {
    return { allowed: true as const, nonce, retryAfterSeconds: EMAIL_SEND_COOLDOWN_SECONDS };
  }

  const ttl = await redis.ttl(key);
  return {
    allowed: false as const,
    nonce: null,
    retryAfterSeconds: Math.max(1, ttl),
  };
}

export async function getEmailCooldownSeconds(scope: string, subject: string) {
  const ttl = await redis.ttl(cooldownKey(scope, subject));
  return Math.max(0, ttl);
}

export async function releaseEmailCooldown(scope: string, subject: string, nonce: string) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;
  await redis.eval<[string], number>(script, [cooldownKey(scope, subject)], [nonce]);
}
