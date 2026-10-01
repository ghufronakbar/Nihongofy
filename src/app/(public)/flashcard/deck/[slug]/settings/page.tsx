import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDeckForUser, getSubscribedDecks } from "@/features/flashcard/data";
import { DeckConfigForm } from "@/features/flashcard/components/deck-config-form";
import { FlashcardDeckSlugSchema } from "@/features/flashcard/schemas";
import { privateMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = privateMetadata(
  "Pengaturan deck",
  "Batas harian, learning steps, urutan, dan FSRS untuk satu deck flashcard.",
);

/**
 * Deck options ala Anki untuk satu deck. `?new=1` dipakai alur tambah deck:
 * deck sudah ditambahkan dengan pengaturan bawaan, dan halaman ini menawarkan
 * untuk mengubahnya sebelum mulai belajar.
 */
export default async function DeckSettingsPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const parsedSlug = FlashcardDeckSlugSchema.safeParse(rawSlug);
  if (!parsedSlug.success) notFound();
  const slug = parsedSlug.data;

  const session = await getSession();
  if (!session) redirect(`/login?next=/flashcard/deck/${slug}/settings`);

  const [access, subscribed] = await Promise.all([
    getDeckForUser(session.userId, slug),
    getSubscribedDecks(session.userId),
  ]);
  if (!access) notFound();
  // Pengaturan milik langganan deck; deck yang belum (atau tidak lagi)
  // ditambahkan tidak punya pengaturan untuk diubah.
  if (!access.subscribed) redirect(`/flashcard/deck/${slug}`);

  const isNew = (await searchParams).new === "1";
  const deckHref = `/flashcard/deck/${slug}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href={deckHref} className="text-sm font-black underline">
        ← Kembali ke deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">Pengaturan deck</h1>
      <p className="mt-1 text-lg font-black">{access.deck.name}</p>
      <p className="mt-2 font-bold text-muted-foreground">
        Hanya berlaku untuk kartu di deck ini. Kata yang juga ada di deck lain dijadwalkan dengan
        pengaturan deck itu. Tombol ↺ mengembalikan satu pengaturan ke nilai bawaannya.
      </p>

      {isNew ? (
        <div
          role="status"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border-[3px] border-neo-ink bg-neo-green px-4 py-3 text-sm font-extrabold text-black shadow-neo-sm"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Deck ditambahkan dengan pengaturan bawaan. Ubah di bawah, atau langsung mulai.
          </span>
          <Link href={deckHref} className="neo-button bg-white px-3 py-1.5 text-xs">
            Pakai bawaan
          </Link>
        </div>
      ) : null}

      <div className="mt-7">
        <DeckConfigForm
          slug={slug}
          config={access.config}
          copySources={subscribed
            .filter((deck) => deck.slug !== slug)
            .map((deck) => ({ slug: deck.slug, name: deck.name, config: deck.config }))}
          doneHref={deckHref}
        />
      </div>
    </main>
  );
}
