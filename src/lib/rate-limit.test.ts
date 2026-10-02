import { describe, expect, it } from "vitest";
import { consumeRateLimit, formatRetryAfter, type RateLimitCounter } from "./rate-limit";

/** Penghitung di memori dengan jam buatan, meniru INCR + EXPIRE NX + TTL. */
function memoryCounter(clock: { now: number }): RateLimitCounter {
  const entries = new Map<string, { count: number; expiresAt: number }>();
  return {
    async hit(key, windowSeconds) {
      const current = entries.get(key);
      const entry =
        current && current.expiresAt > clock.now
          ? current
          : { count: 0, expiresAt: clock.now + windowSeconds * 1000 };
      entry.count += 1;
      entries.set(key, entry);
      return { count: entry.count, ttlSeconds: Math.ceil((entry.expiresAt - clock.now) / 1000) };
    },
  };
}

const windows = [
  { seconds: 60, max: 3 },
  { seconds: 3_600, max: 5 },
];

describe("consumeRateLimit", () => {
  it("mengizinkan sampai batas, lalu menolak dengan sisa waktu jendela", async () => {
    const clock = { now: 0 };
    const counter = memoryCounter(clock);
    const key = (window: { seconds: number }) => `user:1:${window.seconds}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await consumeRateLimit(counter, key, windows)).toEqual({ allowed: true });
    }
    clock.now = 20_000;
    expect(await consumeRateLimit(counter, key, windows)).toEqual({
      allowed: false,
      retryAfterSeconds: 40,
    });
  });

  it("jendela panjang tetap menahan setelah jendela pendek berganti", async () => {
    const clock = { now: 0 };
    const counter = memoryCounter(clock);
    const key = (window: { seconds: number }) => `user:1:${window.seconds}`;

    for (let minute = 0; minute < 5; minute += 1) {
      clock.now = minute * 61_000;
      expect((await consumeRateLimit(counter, key, windows)).allowed).toBe(true);
    }
    clock.now = 6 * 61_000;
    const result = await consumeRateLimit(counter, key, windows);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.retryAfterSeconds).toBe(3_600 - 366);
  });

  it("subjek berbeda tidak saling memengaruhi", async () => {
    const clock = { now: 0 };
    const counter = memoryCounter(clock);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await consumeRateLimit(counter, (window) => `user:1:${window.seconds}`, windows);
    }
    expect(
      await consumeRateLimit(counter, (window) => `user:2:${window.seconds}`, windows),
    ).toEqual({ allowed: true });
  });

  it("TTL yang hilang dianggap satu jendela penuh", async () => {
    const counter: RateLimitCounter = { hit: async () => ({ count: 99, ttlSeconds: -1 }) };
    expect(await consumeRateLimit(counter, () => "k", [{ seconds: 60, max: 1 }])).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });
});

describe("formatRetryAfter", () => {
  it("memilih satuan yang dibulatkan ke atas", () => {
    expect(formatRetryAfter(12)).toBe("12 detik");
    expect(formatRetryAfter(61)).toBe("2 menit");
    expect(formatRetryAfter(3_601)).toBe("2 jam");
  });
});
