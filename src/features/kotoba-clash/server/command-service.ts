import "server-only";

import type { ClashAnswerSchema, ClashStartSchema } from "../schemas";
import type { z } from "zod";
import type { ClashAssignment, ClashIdentity, ClashPublisher } from "../domain/ports";
import type { PrismaClashRepository } from "./repository";

type Commands = Pick<PrismaClashRepository, "start" | "submitAnswer" | "reconcile">;

export class ClashCommandService<TPrincipal> {
  constructor(
    private readonly repository: Commands,
    private readonly publisher: ClashPublisher,
    private readonly authenticate: (principal: TPrincipal) => Promise<ClashIdentity>,
    private readonly reportPublishFailure: (error: unknown) => void,
  ) {}

  private async publish(roomId: string, revision: number) {
    try {
      await this.publisher.publish({ protocolVersion: 1, type: "room_changed", roomId, revision });
    } catch (error: unknown) {
      this.reportPublishFailure(error);
    }
  }

  async start(principal: TPrincipal, input: z.infer<typeof ClashStartSchema>, questions: ClashAssignment[]) {
    const identity = await this.authenticate(principal);
    const result = await this.repository.start(identity, input, questions);
    if (!result.duplicate) await this.publish(input.roomId, result.revision);
    return result;
  }

  async submitAnswer(principal: TPrincipal, input: z.infer<typeof ClashAnswerSchema>) {
    const identity = await this.authenticate(principal);
    const result = await this.repository.submitAnswer(identity, input);
    if (!result.duplicate) await this.publish(input.roomId, result.revision);
    return result;
  }

  async reconcile(principal: TPrincipal, roomId: string, matchId: string) {
    const identity = await this.authenticate(principal);
    const result = await this.repository.reconcile(identity, roomId, matchId);
    if (result.changed) await this.publish(roomId, result.revision);
    return result;
  }
}
