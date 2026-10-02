import type { Metadata } from "next";
import type { MondaiType } from "@prisma/client";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { toPlainJapanese } from "@/lib/japanese-markup";
import { pageMetadata } from "@/lib/seo";

// Metadata halaman diskusi. Diskusi terbuka untuk mesin pencari supaya catatan
// pengguna ikut membantu orang yang mencari soal, kata, atau pola tertentu.
// Halaman diskusi yang belum punya entri tampil diberi `noindex, follow`: isinya
// hanya duplikat soal/kartu yang sudah terindeks di tempat lain.

const DESCRIPTION_LIMIT = 155;

function clip(text: string) {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= DESCRIPTION_LIMIT) return plain;
  return `${plain.slice(0, DESCRIPTION_LIMIT - 1).replace(/\s+\S*$/, "")}…`;
}

type DiscussionQuestionSummary = {
  id: number;
  order: number;
  questionText: string | null;
  testPackageItem: {
    mondaiType: MondaiType;
    testPackage: { name: string; jlptLevel: string };
  };
};

export function questionDiscussionMetadata(
  question: DiscussionQuestionSummary,
  entryCount: number,
): Metadata {
  const { testPackageItem } = question;
  const { testPackage } = testPackageItem;
  const label = `${mondaiTypeFullLabel(testPackageItem.mondaiType)} ${testPackage.name} soal ${question.order}`;
  const questionText = question.questionText ? toPlainJapanese(question.questionText) : "";

  return pageMetadata({
    title: `Diskusi ${label}`,
    description: clip(
      `${entryCount} catatan dan pembahasan pengguna untuk soal JLPT ${testPackage.jlptLevel} ini. ${questionText}`,
    ),
    // Permalink satu thread memakai canonical yang sama: isinya bagian dari halaman ini.
    path: `/discussion/question/${question.id}`,
    noindex: entryCount === 0 ? "follow" : undefined,
  });
}

export function vocabDiscussionMetadata(
  vocab: { id: number; level: string; wordPlain: string; reading: string; meaningsId: string[] },
  entryCount: number,
): Metadata {
  const word =
    vocab.reading !== vocab.wordPlain ? `${vocab.wordPlain} (${vocab.reading})` : vocab.wordPlain;
  return pageMetadata({
    title: `Diskusi kata ${word} – JLPT ${vocab.level}`,
    description: clip(
      `Arti ${vocab.wordPlain}: ${vocab.meaningsId.join("; ")}. ${entryCount} catatan, jembatan keledai, dan pertanyaan pengguna tentang kata ini.`,
    ),
    path: `/flashcard/discussion/${vocab.id}`,
    noindex: entryCount === 0 ? "follow" : undefined,
  });
}

/** Indeks diskusi: halaman pertama diindeks, halaman lanjutan hanya ditelusuri. */
export function discussionIndexMetadata(
  input: { title: string; description: string; path: string },
  page: string | undefined,
): Metadata {
  return pageMetadata({ ...input, noindex: page && page !== "1" ? "follow" : undefined });
}
