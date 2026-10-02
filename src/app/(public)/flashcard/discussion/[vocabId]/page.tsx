import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { getVocabForDiscussion } from "@/features/flashcard/data";
import { getFlashcardSettings } from "@/features/flashcard/lib/collection";
import { FLASHCARD_DEFAULT_DISPLAY } from "@/features/flashcard/schemas";
import { VocabCardView } from "@/features/flashcard/components/vocab-card-view";
import { VocabDiscussionComposer } from "@/features/flashcard/components/vocab-discussion-composer";
import { getDiscussion, getOwnVocabNotes } from "@/features/question-comment/queries";
import { CommentItem } from "@/features/question-comment/components/comment-item";
import { DiscussionPageThreads } from "@/features/question-comment/components/discussion-permalink-thread";
import { QuestionCommentForm } from "@/features/question-comment/components/question-comment-form";
import { ReportButton } from "@/features/report/components/report-button";
import { privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ vocabId: string }> };

export const metadata: Metadata = privateMetadata(
  "Diskusi kata",
  "Catatan pribadi dan diskusi publik untuk satu kata flashcard.",
);

/**
 * Satu kata: isi kartu lengkap, catatan pribadi user, dan seluruh thread
 * publiknya. Jawaban kartu memang ditampilkan — halaman ini dibuka sengaja,
 * bukan di tengah sesi belajar.
 */
export default async function VocabDiscussionPage({ params }: Props) {
  const { vocabId: rawVocabId } = await params;
  const vocabId = Number(rawVocabId);
  if (!Number.isInteger(vocabId) || vocabId <= 0) notFound();

  const [vocab, session] = await Promise.all([getVocabForDiscussion(vocabId), getSession()]);
  if (!vocab) notFound();

  const target = { type: "vocab" as const, vocabId };
  const [roots, ownNotes, settings] = await Promise.all([
    getDiscussion(target),
    session ? getOwnVocabNotes(session.userId, [vocabId]) : null,
    session ? getFlashcardSettings(session.userId) : null,
  ]);
  const notes = ownNotes?.get(vocabId) ?? [];
  const display = settings?.display ?? FLASHCARD_DEFAULT_DISPLAY;
  const entryCount = roots.reduce(
    (total, root) => total + root.replies.length + (root.state === "VISIBLE" ? 1 : 0),
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/flashcard/discussion" className="text-sm font-black underline">
        ← Semua diskusi kosakata
      </Link>

      <VocabCardView
        content={vocab.content}
        revealed
        isNew={false}
        textScale={display.textScale}
        furiganaVisible={display.showFuriganaOnBack}
      />

      {FEATURES.report ? (
        <div className="flex justify-end">
          <ReportButton
            target={{ targetType: "FLASHCARD_VOCAB", vocabId }}
            variant="neo"
            label="Laporkan kartu"
            subject={
              <span lang="ja" className="font-japanese">
                {vocab.content.wordPlain}
              </span>
            }
            className="px-3 py-2 text-xs"
          />
        </div>
      ) : null}

      {vocab.retired ? (
        <p className="neo-surface p-4 text-sm font-bold text-muted-foreground">
          Kata ini sudah tidak ada di katalog. Catatan dan diskusinya tetap dapat dibaca, tetapi
          tidak menerima tulisan baru.
        </p>
      ) : null}

      {session ? (
        <section className="neo-surface flex flex-col gap-3 p-5" aria-labelledby="own-notes">
          <h2 id="own-notes" className="inline-flex items-center gap-1.5 text-lg font-black">
            <NotebookPen className="size-5" aria-hidden /> Catatanku
          </h2>
          <p className="text-xs font-semibold text-muted-foreground">
            Tampil di sisi belakang kartu ini di deck mana pun. Catatan privat hanya terlihat
            olehmu; bagikan ke diskusi bila ingin dibaca orang lain.
          </p>
          {notes.map((note) => (
            <CommentItem key={note.id} comment={note} canShare />
          ))}
          {!vocab.retired ? (
            <QuestionCommentForm
              target={target}
              placeholder="Catatan untuk kata ini, mis. jembatan keledai..."
            />
          ) : null}
        </section>
      ) : null}

      <section className="neo-surface flex flex-col gap-4 p-5" aria-labelledby="public-discussion">
        <h2 id="public-discussion" className="text-lg font-black">
          Diskusi ({entryCount})
        </h2>
        <DiscussionPageThreads
          roots={roots}
          currentUserId={session?.userId ?? null}
          reportEnabled={FEATURES.report}
          emptyText="Belum ada diskusi untuk kata ini."
        />
        <div className="border-t-2 border-neo-ink/15 pt-4">
          {!session ? (
            <Link
              href={`/login?next=/flashcard/discussion/${vocabId}`}
              className="text-sm font-bold underline"
            >
              Masuk untuk ikut berdiskusi
            </Link>
          ) : !vocab.retired ? (
            <VocabDiscussionComposer vocabId={vocabId} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
