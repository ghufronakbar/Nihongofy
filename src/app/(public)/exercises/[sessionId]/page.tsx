import { notFound } from "next/navigation";
import { getPracticeSession } from "@/features/practice/actions";
import { PracticeRunner } from "@/features/practice/components/practice-runner";
import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";
import { FEATURES } from "@/constants";
import { DictionaryBoundary } from "@/features/dictionary/components/dictionary-boundary";

export const metadata: Metadata = privateMetadata(
  "Sesi latihan",
  "Sesi latihan soal JLPT dengan koreksi instan.",
);

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

  return <DictionaryBoundary contextKey={`practice:${sessionId}`} scope={false}>
    <PracticeRunner practiceSession={practiceSession} reportEnabled={FEATURES.report} />
  </DictionaryBoundary>;
}
