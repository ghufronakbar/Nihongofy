import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  features: { dictionary: true },
  limit: vi.fn(), lookup: vi.fn(), cache: vi.fn(), error: vi.fn(), headers: vi.fn(),
}));
vi.mock("@/constants", () => ({ FEATURES: mocks.features, env: { SESSION_SECRET: "test-dictionary-secret" } }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ unstable_cache: mocks.cache }));
vi.mock("@/lib/redis-rate-limit", () => ({ limitByRedis: mocks.limit }));
vi.mock("@/lib/server-logger", () => ({ logServerEvent: vi.fn(), reportServerError: mocks.error }));
vi.mock("./reader", () => ({ dictionaryManifest: { version: "test-version" }, dictionaryReader: () => ({}), dictionaryReaderMetrics: () => ({}) }));
vi.mock("./lookup", () => ({ lookupDictionary: mocks.lookup }));
import { lookupDictionaryAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.features.dictionary = true;
  mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.1" }));
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.cache.mockImplementation((fn: () => Promise<unknown>) => fn);
  mocks.lookup.mockResolvedValue({ query: "勉強", hits: [], version: "test-version", language: "eng", sourceDate: "2026-10-12", truncated: false });
});
afterEach(() => vi.useRealTimers());

describe("public dictionary action", () => {
  it("rejects a disabled feature and invalid direct calls before using infrastructure", async () => {
    mocks.features.dictionary = false;
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: false, code: "disabled" });
    mocks.features.dictionary = true;
    for (const value of [null, {}, "English", "あ".repeat(41)]) {
      expect(await lookupDictionaryAction(value)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("uses a versioned language cache, and hashes the limiter identity", async () => {
    expect(await lookupDictionaryAction(" 勉強 ")).toMatchObject({ ok: true, result: { hits: [] } });
    expect(mocks.cache.mock.calls[0][1]).toEqual(["dictionary-lookup-v1", "test-version", "eng", "勉強"]);
    expect(mocks.limit.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(mocks.limit.mock.calls)).not.toContain("203.0.113.1");
  });

  it("distinguishes capacity denial and infrastructure failure from empty dictionary results", async () => {
    mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 27 });
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: false, code: "busy", retryAfterSeconds: 27 });
    expect(mocks.lookup).not.toHaveBeenCalled();
    mocks.lookup.mockRejectedValueOnce(new Error("bad shard with private selected text"));
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private selected text");
  });

  it("holds concurrency slots until timed-out underlying work actually finishes", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => { finish = resolve; });
    mocks.lookup.mockImplementation(async () => { await wait; return { hits: [] }; });
    const requests = Array.from({ length: 8 }, () => lookupDictionaryAction("勉強"));
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: false, code: "busy" });
    await vi.advanceTimersByTimeAsync(5_001);
    expect(await Promise.all(requests)).toEqual(Array.from({ length: 8 }, () => expect.objectContaining({ ok: false, code: "unavailable" })));
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: false, code: "busy" });
    finish?.();
    await vi.advanceTimersByTimeAsync(0);
    mocks.lookup.mockResolvedValueOnce({ hits: [] });
    expect(await lookupDictionaryAction("勉強")).toMatchObject({ ok: true });
  });
});
