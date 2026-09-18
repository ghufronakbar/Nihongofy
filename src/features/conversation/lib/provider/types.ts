import type { ConversationLevel } from "../../types";

// Antarmuka yang dilihat feature. Nama model, prompt, header API, dan detail
// vendor tidak boleh bocor melewati batas ini (§4.4).

export type ChatRequest = {
  personaKey: string;
  jlptLevel: ConversationLevel;
  topicKeys: readonly string[];
  userMessage: string;
  history: readonly {
    role: "USER" | "ASSISTANT";
    contentJa: string;
  }[];
  /** Hanya bermakna pada provider mock; diabaikan provider nyata. */
  mockFailure?: string;
};

export type ChatReply = {
  contentJa: string;
  contentTranslation: string | null;
  contentRomaji: string | null;
  /** Metadata audit; diisi provider nyata pada Tahap E. */
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  moderationFlagged: boolean;
};

export type ChatFailureReason =
  | "timeout"
  | "provider_error"
  | "quota_exceeded"
  | "moderation_blocked";

export class ChatProviderError extends Error {
  readonly reason: ChatFailureReason;

  constructor(reason: ChatFailureReason, message: string) {
    super(message);
    this.name = "ChatProviderError";
    this.reason = reason;
  }
}

export type FeedbackRequest = {
  personaKey: string;
  jlptLevel: ConversationLevel;
  /** Kalimat pelajar yang dikoreksi. */
  userMessage: string;
};

export type FeedbackCorrection = {
  original: string;
  corrected: string;
  reason: string;
  severity: "info" | "minor" | "major";
};

export type FeedbackReply = {
  corrections: FeedbackCorrection[];
  summary: string;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** Potongan aliran balasan: teks bertambah, lalu satu hasil akhir. */
export type ChatStreamChunk =
  | { type: "delta"; text: string }
  | { type: "final"; reply: ChatReply };

export type ChatProvider = {
  readonly id: string;
  reply(request: ChatRequest): Promise<ChatReply>;
  replyStream(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
  feedback(request: FeedbackRequest): Promise<FeedbackReply>;
};
