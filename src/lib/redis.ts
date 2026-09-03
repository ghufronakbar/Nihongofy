import "server-only";

import { Redis } from "@upstash/redis";
import { env } from "@/constants";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: true,
});

export function redisKey(...parts: Array<string | number>) {
  return [env.REDIS_PREFIX, ...parts].join(":");
}
