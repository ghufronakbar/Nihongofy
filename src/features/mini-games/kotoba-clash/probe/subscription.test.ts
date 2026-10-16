import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToProbe } from "./subscription";

afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: "https://redis.invalid", token: "test-only", channel: "isolated" };

function streamFixture() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const fetch = vi.fn().mockResolvedValue(new Response(stream));
  vi.stubGlobal("fetch", fetch);
  return { controller, fetch, write: (value: string) => controller.enqueue(new TextEncoder().encode(value)) };
}

describe("Upstash streaming subscription", () => {
  it("waits for subscribe ACK, parses chunk boundaries, and reports a lost stream", async () => {
    const fixture = streamFixture();
    const events = vi.fn();
    const subscription = subscribeToProbe(config, events);
    const done = subscription.done.catch((error: unknown) => error);
    let ready = false;
    void subscription.ready.then(() => { ready = true; });
    fixture.write("data: sub");
    await Promise.resolve();
    expect(ready).toBe(false);
    fixture.write("scribe,isolated,1\r\n\r\n");
    await subscription.ready;
    const event = { revision: 4, sourceInstance: "0803802e-36c7-41c4-85cb-ec24ce391d09" };
    const message = `data: message,isolated,${JSON.stringify(event)}\n\n`;
    fixture.write(message.slice(0, 45));
    fixture.write(message.slice(45));
    await vi.waitFor(() => expect(events).toHaveBeenCalledExactlyOnceWith(event));
    fixture.controller.close();
    expect(await done).toEqual(new Error("Probe subscription ended"));
    expect(fixture.fetch).toHaveBeenCalledWith(
      "https://redis.invalid/subscribe/isolated",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("rejects readiness when Redis refuses the subscription", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const subscription = subscribeToProbe(config, vi.fn());
    const results = await Promise.allSettled([subscription.ready, subscription.done]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
  });

  it("bounds memory for an unterminated upstream frame", async () => {
    const fixture = streamFixture();
    const subscription = subscribeToProbe(config, vi.fn());
    const results = Promise.allSettled([subscription.ready, subscription.done]);
    fixture.write("x".repeat(16_385));
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"]);
  });
});
