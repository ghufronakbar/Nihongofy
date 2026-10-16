import "server-only";

import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import { verifyClashPrincipal } from "./auth";
import { ClashCommandService } from "./command-service";
import { clashPublisher } from "./publisher";
import { PrismaClashRepository } from "./repository";

export const clashCommands = new ClashCommandService(
  new PrismaClashRepository(prisma),
  clashPublisher,
  verifyClashPrincipal,
  (error) => { reportServerError("kotoba_clash.publish.failed", error); },
);
