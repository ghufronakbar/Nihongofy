import { notFound } from "next/navigation";
import { getExamQuestions } from "@/features/exam/actions";
import { ExamProvider } from "@/features/exam/components/exam-provider";
import { ExamRunner } from "@/features/exam/components/exam-runner";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ attemptId: string; session: string }>;
}) {
  const { attemptId, session } = await params;
  const isGuest = attemptId === "guest";
  const attemptIdNum = isGuest ? 0 : Number(attemptId);
  const sessionNum = Number(session);

  if ((!isGuest && (!Number.isInteger(attemptIdNum) || attemptIdNum <= 0)) || !Number.isInteger(sessionNum)) {
    notFound();
  }

  const { attempt, testPackageItems } = await getExamQuestions(attemptIdNum, sessionNum);

  const questions = testPackageItems.flatMap((item) =>
    item.questions.map((question) => ({
      ...question,
      mondaiType: item.mondaiType,
      instruction: item.instruction,
    })),
  );

  return (
    <ExamProvider attemptId={attemptIdNum} session={sessionNum}>
      <ExamRunner
        attemptId={attemptIdNum}
        session={sessionNum}
        testPackageName={attempt.testPackage.name}
        questions={questions}
      />
    </ExamProvider>
  );
}
