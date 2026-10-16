import "server-only";

import { env } from "@/constants";
import { CACHE_KEYS } from "@/constants/cache-key";
import { redisKey } from "@/lib/redis";
import { ClashInvalidationSchema } from "./publisher";

export function subscribeClashRoom(roomId: string, onChange: () => void) {
  const channel = redisKey(...CACHE_KEYS.kotobaRoomChannel(roomId));
  const controller = new AbortController();
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const timeout = setTimeout(() => controller.abort(), 8000);
  const done = (async () => {
    try {
      const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/subscribe/${encodeURIComponent(channel)}`, {
        method: "POST", headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, Accept: "text/event-stream" },
        signal: controller.signal, cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error("Room subscription unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) throw new Error("Room subscription ended");
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 16_384) throw new Error("Subscription frame too large");
          let newline: number;
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newline).trimEnd();
            buffer = buffer.slice(newline + 1);
            if (line.startsWith(`data: subscribe,${channel},`)) { clearTimeout(timeout); resolveReady(); }
            const prefix = `data: message,${channel},`;
            if (line.startsWith(prefix)) {
              const raw: unknown = JSON.parse(line.slice(prefix.length));
              const event = ClashInvalidationSchema.parse(raw);
              if (event.roomId === roomId) onChange();
            }
          }
        }
      } finally { await reader.cancel().catch(() => undefined); }
    } catch (error) { rejectReady(error); throw error; }
    finally { clearTimeout(timeout); }
  })();
  return { ready, done, close: () => controller.abort() };
}
