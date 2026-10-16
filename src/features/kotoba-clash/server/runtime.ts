import "server-only";

import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import { verifyClashPrincipal } from "./auth";
import { ClashCommandService } from "./command-service";
import { clashPublisher } from "./publisher";
import { PrismaClashRepository } from "./repository";
import { PrismaClashLobbyRepository } from "./lobby-repository";
import { PrismaClashState } from "./state";

const clashRepository = new PrismaClashRepository(prisma);
export const clashLobby = new PrismaClashLobbyRepository(prisma);
export const clashState = new PrismaClashState(prisma, clashRepository);
export const clashCommands = new ClashCommandService(
  clashRepository,
  clashPublisher,
  verifyClashPrincipal,
  (error) => { reportServerError("kotoba_clash.publish.failed", error); },
);

export async function publishClashChange(roomId: string, revision: number) {
  try { await clashPublisher.publish({ protocolVersion: 1, type: "room_changed", roomId, revision }); }
  catch (error: unknown) { reportServerError("kotoba_clash.publish.failed", error); }
}
