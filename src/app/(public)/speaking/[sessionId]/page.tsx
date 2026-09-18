import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { SpeakingRunner } from "@/features/conversation/components/speaking-runner";
import { getConversationSession } from "@/features/conversation/queries";

export default async function SpeakingRunnerPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!FEATURES.speaking) notFound();

  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await getSession();

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <ConversationSignInGate next={`/speaking/${sessionId}`} />
      </div>
    );
  }

  const conversation = await getConversationSession(id);
  if (!conversation || conversation.mode !== "VOICE") notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <SpeakingRunner session={conversation} />
    </div>
  );
}
