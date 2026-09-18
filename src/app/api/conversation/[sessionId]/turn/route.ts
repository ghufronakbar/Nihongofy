import { FEATURES } from "@/constants";
import { reportServerError } from "@/lib/server-logger";
import {
  DENIED,
  persistTurns,
  requireOwnedSession,
  toConversationLevel,
  type ActionFailure,
} from "@/features/conversation/lib/session-guard";
import { GenerateReplySchema } from "@/features/conversation/schemas";
import { ChatProviderError, getChatProvider } from "@/features/conversation/lib/provider";

export const runtime = "nodejs";

// Streaming tidak dapat dilayani Server Action, jadi jalur ini memakai Route
// Handler — pengecualian yang sama seperti `/api/flashcard/export` dan
// `/api/account/export`. Seluruh guard tetap dijalankan di sini: flag fitur,
// session, kepemilikan, dan validasi Zod. Handler tidak pernah bersandar pada
// pemeriksaan yang sudah dilakukan halaman.
//
// Formatnya NDJSON: satu objek JSON per baris. Lebih sederhana daripada SSE dan
// cukup untuk kebutuhan ini.

function line(payload: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

function failureResponse(failure: ActionFailure, status: number) {
  return new Response(`${JSON.stringify({ type: "error", ...failure })}\n`, {
    status,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!FEATURES.conversation) return failureResponse(DENIED.disabled, 404);

  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) return failureResponse(DENIED.notFound, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failureResponse(DENIED.invalid, 400);
  }

  const parsed = GenerateReplySchema.safeParse(body);
  if (!parsed.success || parsed.data.sessionId !== id) {
    return failureResponse(DENIED.invalid, 400);
  }

  const gate = await requireOwnedSession(id);
  if (!gate.ok) {
    return failureResponse(gate, gate.reason === "unauthorized" ? 401 : 404);
  }

  const { mockFailure, ...input } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = getChatProvider().replyStream({
          personaKey: gate.conversation.personaKey,
          jlptLevel: toConversationLevel(gate.conversation.jlptLevel),
          topicKeys: gate.conversation.topicKeys,
          userMessage: input.userMessage,
          history: input.history.map((turn) => ({
            role: turn.role,
            contentJa: turn.contentJa,
          })),
          mockFailure,
        });

        for await (const chunk of chunks) {
          if (chunk.type === "delta") {
            controller.enqueue(line({ type: "delta", text: chunk.text }));
            continue;
          }

          // Penyimpanan tetap di server dan baru dijalankan setelah balasan
          // lengkap, supaya giliran separuh jadi tidak pernah tersimpan.
          const persisted = await persistTurns({
            sessionId: gate.conversation.id,
            userId: gate.userId,
            transcriptRetained: gate.conversation.transcriptRetained,
            startOrder: gate.conversation.turnCount,
            userMessage: input.userMessage,
            inputSource: input.inputSource,
            reply: chunk.reply,
          });

          controller.enqueue(
            line({
              type: "done",
              contentJa: chunk.reply.contentJa,
              contentTranslation: chunk.reply.contentTranslation,
              contentRomaji: chunk.reply.contentRomaji,
              userTurnId: persisted.userTurnId,
            }),
          );
        }
      } catch (error) {
        if (error instanceof ChatProviderError) {
          controller.enqueue(
            line({ type: "error", reason: error.reason, message: error.message }),
          );
        } else {
          reportServerError("conversation.stream_failed", error);
          controller.enqueue(
            line({
              type: "error",
              reason: "provider_error",
              message: "Terjadi kesalahan tak terduga. Coba kirim ulang pesanmu.",
            }),
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Mencegah proxy menahan buffer sehingga aliran benar-benar sampai
      // sepotong demi sepotong.
      "X-Accel-Buffering": "no",
    },
  });
}

