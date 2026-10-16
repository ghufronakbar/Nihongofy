import "server-only";

import { CACHE_KEYS } from "@/constants/cache-key";
import { redis, redisKey } from "@/lib/redis";
import type { ClashPublisher } from "../domain/ports";
import { z } from "zod";

export const ClashInvalidationSchema = z.strictObject({
  protocolVersion: z.literal(1), type: z.literal("room_changed"),
  roomId: z.uuid(), revision: z.number().int().nonnegative(),
});

export const clashPublisher: ClashPublisher = {
  async publish(event) {
    const safe = ClashInvalidationSchema.parse(event);
    await redis.publish(redisKey(...CACHE_KEYS.kotobaRoomChannel(safe.roomId)), safe);
  },
};
