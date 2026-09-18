import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationRunner } from "@/features/conversation/components/conversation-runner";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { getConversationSession } from "@/features/conversation/queries";

export default async function ConversationRunnerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!FEATURES.conversation) notFound();

  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await getSession();

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <ConversationSignInGate next={`/conversation/${sessionId}`} />
      </div>
    );
  }

  // Kepemilikan diperiksa di dalam query, jadi session milik orang lain tidak
  // pernah terbaca dan tampil sebagai notFound seperti session yang tidak ada.
  const conversation = await getConversationSession(id);
  if (!conversation || conversation.mode !== "TEXT") notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <ConversationRunner session={conversation} />
    </div>
  );
}
