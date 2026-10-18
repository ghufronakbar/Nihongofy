import "server-only";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import { CACHE_KEYS } from "@/constants/cache-key";
import { redis, redisKey } from "@/lib/redis";
import { RaceError } from "../domain/engine";
import { RaceRepository } from "./repository";
export const raceRepository = new RaceRepository(prisma);
export async function publishRaceChange(roomId: string) {
  try { await redis.publish(redisKey(...CACHE_KEYS.kanaRaceRoomChannel(roomId)), { roomId, version: 1 }); }
  catch { reportServerError("kana_race.publish.failed", new Error("Room invalidation unavailable")); }
}
export function raceFailure(error: unknown) {
  if (error instanceof RaceError) return { message: error.message, terminal: error.terminal };
  reportServerError("kana_race.operation.failed", new Error("Game operation unavailable"));
  return { message: "Koneksi atau layanan sedang bermasalah. Coba lagi.", terminal: false };
}
