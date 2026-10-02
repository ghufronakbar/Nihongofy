import "server-only";

import { redis, redisKey } from "@/lib/redis";
import {
  consumeRateLimit,
  type RateLimitCounter,
  type RateLimitResult,
  type RateLimitWindow,
} from "./rate-limit";

// INCR, EXPIRE NX, dan TTL dalam satu transaksi: jendela dimulai pada percobaan
// pertama dan tidak pernah diperpanjang oleh percobaan berikutnya.
const redisCounter: RateLimitCounter = {
  async hit(key, windowSeconds) {
    const [count, , ttlSeconds] = await redis
      .multi()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .ttl(key)
      .exec<[number, 0 | 1, number]>();
    return { count, ttlSeconds };
  },
};

/**
 * Rate limit per subjek (biasanya user id) untuk satu cakupan aksi. Gagal
 * tertutup: bila Redis tidak dapat dihubungi, error-nya diteruskan — session
 * pun tidak dapat divalidasi tanpa Redis, jadi aksi ini memang tidak akan jalan.
 */
export function limitByRedis(
  scope: string,
  subject: string | number,
  windows: readonly RateLimitWindow[],
): Promise<RateLimitResult> {
  return consumeRateLimit(
    redisCounter,
    (window) => redisKey("rate", scope, subject, `${window.seconds}s`),
    windows,
  );
}
