import "server-only";

import { z } from "zod";
import { env } from "@/constants";
import { CACHE_KEYS } from "@/constants/cache-key";
import { redis, redisKey } from "@/lib/redis";
import { PROBE_LEASE_MS, PROBE_MAX_CONNECTIONS, PROBE_TTL_SECONDS, probeState } from "./protocol";

// Commit and duplicate detection are atomic; publishing deliberately happens afterwards.
const MUTATE = `
local raw = redis.call('GET', KEYS[1])
local state = raw and cjson.decode(raw) or { revision = 0, members = {} }
local previous = state.members[ARGV[1]]
local status = 'duplicate'
if ARGV[2] == 'join' then
  if previous == nil then state.members[ARGV[1]] = 0; status = 'applied' end
else
  local sequence = tonumber(ARGV[2])
  if previous == nil then return cjson.encode({ status = 'missing', state = state }) end
  if sequence == previous then status = 'duplicate'
  elseif sequence ~= previous + 1 then return cjson.encode({ status = 'sequence', state = state })
  else state.members[ARGV[1]] = sequence; status = 'applied' end
end
if status == 'applied' then state.revision = state.revision + 1 end
redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[3])
return cjson.encode({ status = status, state = state })
`;

const ADMIT = `
local count = redis.call('INCR', KEYS[2])
if count == 1 then redis.call('EXPIRE', KEYS[2], 60) end
if count > 80 then return 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[4]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[1], 90)
return 1
`;

const RENEW = `
if not redis.call('ZSCORE', KEYS[1], ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], 90)
return 1
`;

const mutationResult = z.object({
  status: z.enum(["applied", "duplicate", "missing", "sequence"]),
  state: probeState,
});

export function createProbeStore(runId: string) {
  const key = (part: "state" | "leases" | "handshakes") => redisKey(...CACHE_KEYS.kotobaProbe(runId, part));
  return {
    channel: redisKey(...CACHE_KEYS.kotobaProbeChannel(runId)),
    async admit(lease: string) {
      const now = Date.now();
      return await redis.eval(ADMIT, [key("leases"), key("handshakes")], [now, now + PROBE_LEASE_MS, lease, PROBE_MAX_CONNECTIONS]) === 1;
    },
    async renew(lease: string) {
      return await redis.eval(RENEW, [key("leases")], [Date.now() + PROBE_LEASE_MS, lease]) === 1;
    },
    async release(lease: string) { await redis.zrem(key("leases"), lease); },
    async mutate(clientId: string, command: "join" | number) {
      return mutationResult.parse(await redis.eval(MUTATE, [key("state")], [clientId, command, PROBE_TTL_SECONDS]));
    },
    async snapshot() { return probeState.parse(await redis.get<unknown>(key("state"))); },
    async publish(event: unknown) { await redis.publish(this.channel, JSON.stringify(event)); },
    async cleanup() { await redis.del(key("state"), key("leases"), key("handshakes")); },
    subscriptionConfig: { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN },
  };
}

export type ProbeStore = ReturnType<typeof createProbeStore>;
