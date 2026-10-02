"use client";

import { useRouter } from "next/navigation";
import { NewPublicNoteForm } from "@/features/question-comment/components/discussion-sheet";

/** Form tulis langsung ke diskusi publik di halaman kata; halaman di-refresh setelahnya. */
export function VocabDiscussionComposer({ vocabId }: { vocabId: number }) {
  const router = useRouter();

  return (
    <NewPublicNoteForm
      target={{ type: "vocab", vocabId }}
      placeholder="Bagikan jembatan keledai, nuansa, atau pertanyaan tentang kata ini..."
      onDone={() => router.refresh()}
    />
  );
}
