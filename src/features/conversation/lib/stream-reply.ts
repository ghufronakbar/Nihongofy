"use client";

import { extractPartialJapanese } from "./provider/parse-reply";
import type { ConversationInputSource } from "../schemas";

// Pembaca aliran NDJSON dari route handler. Dipisahkan dari komponen supaya
// kedua runner memakai jalur yang sama dan mudah diuji.

export type StreamCallbacks = {
  /** Dipanggil tiap kali bagian Jepang bertambah. */
  onPartial: (contentJa: string) => void;
};

export type StreamOutcome =
  | {
      ok: true;
      contentJa: string;
      contentTranslation: string | null;
      contentRomaji: string | null;
      userTurnId: number | null;
    }
  | { ok: false; reason: string; message: string };

export type StreamInput = {
  sessionId: number;
  userMessage: string;
  inputSource: ConversationInputSource;
  history: {
    role: "USER" | "ASSISTANT";
    contentJa: string;
    contentTranslation: string | null;
    contentRomaji: string | null;
  }[];
  mockFailure?: string;
};

const NETWORK_FAILURE: StreamOutcome = {
  ok: false,
  reason: "provider_error",
  message: "Koneksi ke layanan percakapan terputus. Coba kirim ulang pesanmu.",
};

export async function streamConversationReply(
  input: StreamInput,
  callbacks: StreamCallbacks,
): Promise<StreamOutcome> {
  let response: Response;

  try {
    response = await fetch(`/api/conversation/${input.sessionId}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return NETWORK_FAILURE;
  }

  if (!response.body) return NETWORK_FAILURE;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let outcome: StreamOutcome | null = null;

  const handleLine = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      // Baris rusak dilewati; aliran tetap berlanjut.
      return;
    }

    if (typeof event !== "object" || event === null) return;
    const payload = event as Record<string, unknown>;

    if (payload.type === "delta" && typeof payload.text === "string") {
      raw += payload.text;
      callbacks.onPartial(extractPartialJapanese(raw));
      return;
    }

    if (payload.type === "done" && typeof payload.contentJa === "string") {
      outcome = {
        ok: true,
        contentJa: payload.contentJa,
        contentTranslation:
          typeof payload.contentTranslation === "string" ? payload.contentTranslation : null,
        contentRomaji: typeof payload.contentRomaji === "string" ? payload.contentRomaji : null,
        userTurnId: typeof payload.userTurnId === "number" ? payload.userTurnId : null,
      };
      return;
    }

    if (payload.type === "error") {
      outcome = {
        ok: false,
        reason: typeof payload.reason === "string" ? payload.reason : "provider_error",
        message:
          typeof payload.message === "string"
            ? payload.message
            : "Layanan percakapan sedang bermasalah.",
      };
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    handleLine(buffer);
  } catch {
    return NETWORK_FAILURE;
  }

  // Aliran berakhir tanpa penutup: perlakukan sebagai kegagalan, bukan sebagai
  // balasan kosong yang tampak berhasil.
  return outcome ?? NETWORK_FAILURE;
}
