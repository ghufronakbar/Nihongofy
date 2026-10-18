"use server";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "@/constants";
import { CodeSchema, CreateSchema, JoinSchema } from "./contracts";
import { createRaceGuest, readRacePrincipal, requireRaceEnabled, verifyRacePrincipal } from "./server/auth";
import { limitRace, requireRaceRuntime } from "./server/presence";
import { publishRaceChange, raceFailure, raceRepository } from "./server/runtime";
import { RaceError } from "./domain/engine";

async function limitEntry() {
  requireRaceEnabled(); await requireRaceRuntime();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await limitRace("entry", createHmac("sha256", env.SESSION_SECRET).update(ip).digest("hex"), 30);
}
export async function createRaceRoomAction(raw: unknown) {
  try {
    await limitEntry(); const input = CreateSchema.parse(raw);
    const principal = await readRacePrincipal();
    if (!principal || principal.kind !== "account") throw new RaceError("Masuk untuk membuat room.");
    const identity = await verifyRacePrincipal(principal);
    if (identity.kind !== "account") throw new RaceError("Masuk untuk membuat room.");
    const data = await raceRepository.create(identity.userId, input.nickname, input.requestId, input.mode);
    return { ok: true as const, data };
  } catch (error: unknown) { return { ok: false as const, ...raceFailure(error) }; }
}
export async function joinRaceRoomAction(raw: unknown) {
  try {
    await limitEntry(); const input = JoinSchema.parse(raw);
    const principal = await readRacePrincipal();
    let identity;
    if (principal) {
      try { identity = await verifyRacePrincipal(principal); }
      catch (error: unknown) { if (principal.kind === "account") throw error; identity = await createRaceGuest(); }
    } else identity = await createRaceGuest();
    const data = await raceRepository.join(identity, input.code, input.nickname);
    await publishRaceChange(data.roomId);
    return { ok: true as const, data };
  } catch (error: unknown) { return { ok: false as const, ...raceFailure(error) }; }
}

const ReadSchema = z.strictObject({ code: CodeSchema, matchId: z.uuid().optional() });
export async function getRaceRoomAction(raw: unknown) {
  try {
    requireRaceEnabled(); await requireRaceRuntime();
    const input = ReadSchema.parse(raw);
    const principal = await readRacePrincipal();
    if (!principal) return { ok: false as const, message: null };
    const identity = await verifyRacePrincipal(principal);
    const roomId = await raceRepository.lookup(identity, input.code);
    if (!roomId) return { ok: false as const, message: null };
    // Personal snapshots are never shared through a cache.
    const data = await raceRepository.run(identity, { type: "sync", roomId, requestId: randomUUID() }, input.matchId);
    return { ok: true as const, data };
  } catch (error: unknown) { return { ok: false as const, ...raceFailure(error) }; }
}
