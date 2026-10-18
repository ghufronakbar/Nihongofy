import "server-only";

import { z } from "zod";
import { CACHE_KEYS } from "@/constants/cache-key";
import { redis, redisKey } from "@/lib/redis";
import { RaceError } from "../domain/engine";

export const RACE_LEASE_MS = 60_000;
export type RaceConnection = { roomId: string; memberId: string; owner: string };

export const RACE_LEASE_SCRIPT = `
local now = tonumber(ARGV[1])
local member = ARGV[2]
local owner = ARGV[3]
local operation = ARGV[4]
local ttl = tonumber(ARGV[5])
local rows = redis.call('HGETALL', KEYS[1])
for i = 1, #rows, 2 do
  local value = cjson.decode(rows[i+1])
  if value.untilAt <= now then redis.call('HDEL', KEYS[1], rows[i]) end
end
local old = redis.call('HGET', KEYS[1], member)
if operation ~= 'acquire' and (not old or cjson.decode(old).owner ~= owner) then return 0 end
if operation == 'release' then
  redis.call('HDEL', KEYS[1], member)
  return 1
end
if operation == 'acquire' and not old and redis.call('HLEN', KEYS[1]) >= 20 then return 0 end
redis.call('HSET', KEYS[1], member, cjson.encode({owner=owner, untilAt=now+ttl}))
redis.call('PEXPIRE', KEYS[1], ttl)
return 1
`;

const leaseSchema = z.object({ owner: z.uuid(), untilAt: z.number() });

export const racePresence = {
  async change(connection: RaceConnection, operation: "acquire" | "renew" | "release") {
    const result = await redis.eval(RACE_LEASE_SCRIPT,
      [redisKey(...CACHE_KEYS.kanaRaceRoomLease(connection.roomId))],
      [Date.now(), connection.memberId, connection.owner, operation, RACE_LEASE_MS]);
    return result === 1;
  },
  async owns(connection: RaceConnection) {
    const raw = await redis.hget<unknown>(redisKey(...CACHE_KEYS.kanaRaceRoomLease(connection.roomId)), connection.memberId);
    const value = leaseSchema.safeParse(raw);
    return value.success && value.data.owner === connection.owner && value.data.untilAt > Date.now();
  },
  async online(roomId: string) {
    const rows = await redis.hgetall<Record<string, unknown>>(redisKey(...CACHE_KEYS.kanaRaceRoomLease(roomId)));
    return Object.entries(rows ?? {}).flatMap(([memberId, raw]) => {
      // hgetall values may be JSON strings or automatically decoded objects.
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      const value = leaseSchema.safeParse(parsed);
      return value.success && value.data.untilAt > Date.now() && z.uuid().safeParse(memberId).success ? [memberId] : [];
    });
  },
};

export async function requireRaceRuntime() {
  const raw = await redis.get<unknown>(redisKey(...CACHE_KEYS.kanaRaceRuntimeControl));
  if (raw === null) return;
  const control = z.strictObject({ enabled: z.boolean(), protocolVersion: z.literal(1) }).safeParse(raw);
  if (!control.success || !control.data.enabled) throw new RaceError("Permainan sedang dinonaktifkan.", true);
}

export async function limitRace(scope: string, hashedSubject: string, maximum: number, seconds = 60) {
  const count = await redis.eval(`
    local n = redis.call('INCR', KEYS[1])
    if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return n`, [redisKey(...CACHE_KEYS.kanaRaceRateLimit(scope, hashedSubject))], [seconds]);
  if (z.number().parse(count) > maximum) throw new RaceError("Terlalu banyak permintaan. Tunggu sebentar.");
}
