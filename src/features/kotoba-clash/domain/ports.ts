import type { ClashQuestionSnapshot } from "../schemas";

export type ClashIdentity =
  | { kind: "account"; userId: number }
  | { kind: "guest"; hash: string; expiresAt: number };

export type ClashInvalidation = {
  protocolVersion: 1;
  type: "room_changed";
  roomId: string;
  revision: number;
};

export interface ClashPublisher {
  publish(event: ClashInvalidation): Promise<void>;
}

export type ClashAssignment = { id: string; question: ClashQuestionSnapshot };

export class ClashError extends Error {
  constructor(public readonly code:
    | "UNAUTHORIZED" | "NOT_FOUND" | "EXPIRED" | "CLOSED" | "HOST_REQUIRED"
    | "STALE_CONFIG" | "NOT_READY" | "CAPACITY" | "ACTIVE_MATCH" | "INVALID_QUESTIONS"
    | "INVALID_CHOICE" | "NOT_PLAYING" | "OUTSIDE_WINDOW" | "ALREADY_ANSWERED"
    | "NICKNAME_TAKEN" | "KICKED" | "INVALID_TARGET" | "RATE_LIMITED" | "UNAVAILABLE"
    | "SOLO_PRIVATE" | "MODE_MISMATCH") {
    super(code);
    this.name = "ClashError";
  }
}
