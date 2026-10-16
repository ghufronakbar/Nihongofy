import { parseSubscriptionLine, probeRevision } from "./protocol";

export function subscribeToProbe(
  config: { url: string; token: string; channel: string },
  onRevision: (revision: { revision: number; sourceInstance: string }) => void,
) {
  const controller = new AbortController();
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const done = (async () => {
    try {
      const response = await fetch(`${config.url}/subscribe/${encodeURIComponent(config.channel)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, Accept: "text/event-stream" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error("Probe subscription unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) throw new Error("Probe subscription ended");
          buffer += decoder.decode(result.value, { stream: true });
          if (buffer.length > 16_384) throw new Error("Probe subscription frame too large");
          let newline: number;
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newline).trimEnd();
            buffer = buffer.slice(newline + 1);
            if (line.startsWith(`data: subscribe,${config.channel},`)) {
              clearTimeout(timeout);
              resolveReady();
            }
            const event = parseSubscriptionLine(line, config.channel);
            if (event !== undefined) onRevision(probeRevision.parse(event));
          }
        }
      } finally { await reader.cancel().catch(() => undefined); }
    } catch (error) {
      rejectReady(error);
      throw error;
    } finally { clearTimeout(timeout); }
  })();
  return { ready, done, close: () => controller.abort() };
}
