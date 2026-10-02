/**
 * Rate limit fixed-window di atas penghitung bersama (Redis di produksi).
 *
 * Murni dan tanpa import server supaya bisa diuji dengan penghitung buatan;
 * pengikatnya ke Redis ada di `redis-rate-limit.ts`. Setiap percobaan menambah
 * penghitung, termasuk yang ditolak: yang dibatasi adalah percobaan, jadi
 * mengulang terus-menerus tidak membuka celah.
 */

export type RateLimitWindow = {
  /** Panjang jendela dalam detik. */
  seconds: number;
  /** Percobaan maksimal di dalam satu jendela. */
  max: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitCounter = {
  /** Menambah penghitung `key` dan mengembalikan nilai serta sisa umurnya. */
  hit(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
};

export async function consumeRateLimit(
  counter: RateLimitCounter,
  keyFor: (window: RateLimitWindow) => string,
  windows: readonly RateLimitWindow[],
): Promise<RateLimitResult> {
  let retryAfterSeconds = 0;

  for (const window of windows) {
    const { count, ttlSeconds } = await counter.hit(keyFor(window), window.seconds);
    if (count > window.max) {
      // TTL yang hilang (-1/-2) dianggap jendela penuh, bukan "boleh sekarang".
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        ttlSeconds > 0 ? ttlSeconds : window.seconds,
      );
    }
  }

  return retryAfterSeconds > 0 ? { allowed: false, retryAfterSeconds } : { allowed: true };
}

/** "30 detik", "5 menit", "2 jam" — untuk pesan penolakan. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} detik`;
  if (seconds < 3_600) return `${Math.ceil(seconds / 60)} menit`;
  return `${Math.ceil(seconds / 3_600)} jam`;
}
