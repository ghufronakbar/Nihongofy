"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env, KOTOBA_ROOM_CREATE_RATE_LIMIT } from "@/constants";
import { ClashError } from "./domain/ports";
import { ClashConfigureSchema, ClashCreateSchema, ClashJoinSchema, ClashReadySchema, ClashRoomCodeSchema, ClashRoomInputSchema, ClashStartSchema, ClashIdSchema } from "./schemas";
import { createClashGuest, readClashPrincipal, verifyClashPrincipal, requireClashEnabled } from "./server/auth";
import { clashBoundary } from "./server/errors";
import { getClashCatalog, sampleClashQuestions } from "./server/catalog";
import { clashCommands, clashLobby, clashState, publishClashChange } from "./server/runtime";
import { clashPresence, limitClash, requireClashRuntime } from "./server/presence";

async function actor(scope: string, allowGuest = false) {
  requireClashEnabled();
  await requireClashRuntime();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const hash = createHmac("sha256", env.SESSION_SECRET).update(`kotoba:${ip}`).digest("hex");
  if (scope !== "create") await limitClash(scope, hash, 40);
  let principal = await readClashPrincipal();
  if (!principal && allowGuest) {
    const guest = await createClashGuest();
    principal = { kind: "guest", hash: guest.hash };
  }
  if (!principal) throw new ClashError("UNAUTHORIZED");
  const identity = await verifyClashPrincipal(principal).catch(async (error: unknown) => {
    if (!allowGuest || principal?.kind !== "guest" || !(error instanceof ClashError) || error.code !== "UNAUTHORIZED") throw error;
    const guest = await createClashGuest();
    principal = { kind: "guest", hash: guest.hash };
    return guest;
  });
  if (scope === "create") {
    if (identity.kind !== "account") throw new ClashError("HOST_REQUIRED");
    const subject = createHmac("sha256", env.SESSION_SECRET).update(`kotoba:account:${identity.userId}`).digest("hex");
    await limitClash("create-account", subject, KOTOBA_ROOM_CREATE_RATE_LIMIT.maximum, KOTOBA_ROOM_CREATE_RATE_LIMIT.seconds);
  }
  return { principal, identity };
}

export async function createClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashCreateSchema.parse(raw);
    const { identity } = await actor("create");
    const result = await clashLobby.create(identity, input);
    await Promise.all(result.closedRooms.map((room) => publishClashChange(room.id, room.revision)));
    return { id: result.id, code: result.code, revision: result.revision };
  });
}

export async function joinClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashJoinSchema.parse(raw);
    const { identity } = await actor("join", true);
    const result = await clashLobby.join(identity, input);
    await publishClashChange(result.roomId, result.revision);
    return clashState.read(identity, result.roomId);
  });
}

export async function getClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const code = ClashRoomCodeSchema.parse(raw);
    const { identity } = await actor("read");
    // Live snapshots are actor-scoped and deliberately excluded from shared Next caches.
    return clashState.read(identity, code, true);
  });
}

export async function configureClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashConfigureSchema.parse(raw);
    const { identity } = await actor("configure");
    const state = await clashState.read(identity, input.roomId);
    if (!state.viewer.isHost) throw new ClashError("HOST_REQUIRED");
    // Verify actual stock again; catalog data may have changed since the lobby loaded.
    await sampleClashQuestions(input.config);
    const result = await clashLobby.configure(identity, input);
    await publishClashChange(input.roomId, result.revision);
    return clashState.read(identity, input.roomId);
  });
}

export async function readyClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashReadySchema.parse(raw);
    const { identity } = await actor("ready");
    await clashState.read(identity, input.roomId);
    const result = await clashLobby.ready(identity, input);
    await publishClashChange(input.roomId, result.revision);
    return clashState.read(identity, input.roomId);
  });
}

export async function startClashMatchAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashStartSchema.parse(raw);
    const { identity, principal } = await actor("start");
    const state = await clashState.read(identity, input.roomId);
    if (!state.viewer.isHost) throw new ClashError("HOST_REQUIRED");
    if (!state.config) throw new ClashError("STALE_CONFIG");
    const questions = await sampleClashQuestions(state.config);
    await clashCommands.start(principal, input, questions, await clashPresence.online(input.roomId));
    return clashState.read(identity, input.roomId);
  });
}

export async function closeClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashRoomInputSchema.parse(raw);
    const { identity } = await actor("close");
    const result = await clashLobby.close(identity, input);
    await publishClashChange(input.roomId, result.revision);
    return { closed: true };
  });
}

export async function participateClashRoomAction(raw: unknown) {
  return clashBoundary(async () => {
    const input = ClashRoomInputSchema.parse(raw);
    const { identity } = await actor("participate");
    await clashState.read(identity, input.roomId);
    const result = await clashLobby.participate(identity, input);
    await publishClashChange(input.roomId, result.revision);
    return clashState.read(identity, input.roomId);
  });
}

export async function getClashCatalogAction() {
  return clashBoundary(async () => { await actor("catalog"); return getClashCatalog(); });
}

export async function getClashResultsAction(rawCode: unknown, rawMatchId: unknown) {
  return clashBoundary(async () => {
    const code = ClashRoomCodeSchema.parse(rawCode);
    const matchId = ClashIdSchema.parse(rawMatchId);
    const { identity } = await actor("results");
    return clashState.results(identity, code, matchId);
  });
}
