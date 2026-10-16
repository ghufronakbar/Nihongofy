import { z } from "zod";
import { redis, redisKey } from "../src/lib/redis";
import { CACHE_KEYS } from "../src/constants/cache-key";

const mode = z.enum(["status", "enable", "disable"]).parse(process.argv[2] ?? "status");
async function main() {
  const key = redisKey(...CACHE_KEYS.kotobaRuntimeControl);
  if (mode !== "status") await redis.set(key, { enabled: mode === "enable", protocolVersion: 1 });
  const raw = await redis.get<unknown>(key);
  const control = raw === null ? { enabled: true, protocolVersion: 1 } : z.object({ enabled: z.boolean(), protocolVersion: z.literal(1) }).parse(raw);
  console.log(JSON.stringify({ ...control, environmentFlagsStillRequired: true, drainWithinSeconds: 20 }));
}
void main().catch(() => { console.error("Unable to read or update Kotoba Clash runtime control."); process.exitCode = 1; });
