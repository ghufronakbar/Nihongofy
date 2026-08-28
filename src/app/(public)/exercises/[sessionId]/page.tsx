import { notFound } from "next/navigation";
import { getPracticeSession } from "@/features/practice/actions";
import { PracticeRunner } from "@/features/practice/components/practice-runner";

export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const isGuest = sessionId === "guest";
  const sessionIdNumber = isGuest ? 0 : Number(sessionId);

  if (!isGuest && (!Number.isInteger(sessionIdNumber) || sessionIdNumber <= 0)) {
    notFound();
  }

  const practiceSession = await getPracticeSession({ sessionId: sessionIdNumber });

  return <PracticeRunner practiceSession={practiceSession} />;
}
