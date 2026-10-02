"use client";

import { DiscussionComposer } from "@/features/question-comment/components/discussion-composer";

/** Form tulis langsung ke diskusi publik di halaman kata. */
export function VocabDiscussionComposer({
  vocabId,
  postingSuspended = false,
}: {
  vocabId: number;
  postingSuspended?: boolean;
}) {
  return (
    <DiscussionComposer
      target={{ type: "vocab", vocabId }}
      postingSuspended={postingSuspended}
      placeholder="Bagikan jembatan keledai, nuansa, atau pertanyaan tentang kata ini..."
    />
  );
}
