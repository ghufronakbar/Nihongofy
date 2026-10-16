import { z } from "zod";

export const PROBE_PATH = "/api/internal/kotoba-clash-probe";
export const PROBE_TTL_SECONDS = 60 * 60;
export const PROBE_LEASE_MS = 60_000;
export const PROBE_MAX_CONNECTIONS = 24;
export const probeClientId = z.string().regex(/^p(?:0[0-9]|1[0-9])$/);

export const probeState = z.object({
  revision: z.number().int().nonnegative(),
  members: z.record(probeClientId, z.number().int().nonnegative()),
});

export const probeCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sync") }).strict(),
  z.object({
    type: z.literal("advance"),
    sequence: z.number().int().min(1).max(10_000),
    fault: z.enum(["omit", "duplicate", "publish-failure"]).optional(),
  }).strict(),
  z.object({ type: z.literal("disconnect") }).strict(),
]);

export const probeRevision = z.object({
  revision: z.number().int().nonnegative(),
  sourceInstance: z.uuid(),
}).strict();

export type ProbeState = z.infer<typeof probeState>;
export type ProbeCommand = z.infer<typeof probeCommand>;

// Upstash REST SUBSCRIBE emits one SSE data line per subscribe/message envelope.
export function parseSubscriptionLine(line: string, channel: string): unknown {
  const prefix = `data: message,${channel},`;
  if (!line.startsWith(prefix)) return undefined;
  return JSON.parse(line.slice(prefix.length));
}
