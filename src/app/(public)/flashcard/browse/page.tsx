import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CardBrowser } from "@/features/flashcard/components/card-browser";
import {
  BROWSE_PAGE_SIZE,
  getBrowseCards,
  getBrowseFacets,
  type BrowseFilters,
} from "@/features/flashcard/browse-data";

export const metadata: Metadata = { title: "Cari kartu" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATES: { value: BrowseFilters["state"]; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "new", label: "Baru" },
  { value: "learning", label: "Belajar" },
  { value: "review", label: "Ulang" },
  { value: "suspended", label: "Suspend" },
  { value: "buried", label: "Ditunda" },
];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BrowsePage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/flashcard/browse");

  const params = await searchParams;
  const stateParam = single(params.state);
  const filters: BrowseFilters = {
    deckId: Number(single(params.deck)) || null,
    state: STATES.some((item) => item.value === stateParam)
      ? (stateParam as BrowseFilters["state"])
      : "all",
    tag: single(params.tag) || null,
    query: single(params.q) ?? "",
    page: Math.max(1, Number(single(params.page)) || 1),
  };

  const [{ cards, total }, facets] = await Promise.all([
    getBrowseCards(session.userId, filters),
    getBrowseFacets(session.userId),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const pageLink = (page: number) => {
    const next = new URLSearchParams();
    if (filters.deckId) next.set("deck", String(filters.deckId));
    if (filters.state !== "all") next.set("state", filters.state);
    if (filters.tag) next.set("tag", filters.tag);
    if (filters.query) next.set("q", filters.query);
    if (page > 1) next.set("page", String(page));
    const search = next.toString();
    return search ? `/flashcard/browse?${search}` : "/flashcard/browse";
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/flashcard" className="text-sm font-black underline">
        ← Semua deck
      </Link>

      <h1 className="mt-4 text-3xl font-black">Cari kartu</h1>
      <p className="mt-2 font-bold text-muted-foreground">
        {total} kartu cocok. Menampilkan halaman {filters.page} dari {pageCount}.
      </p>

      <form method="get" className="neo-surface mt-6 grid gap-3 p-4 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.query}
          placeholder="Cari isi kartu…"
          className="h-11 rounded-lg border-[3px] border-neo-ink bg-white px-3 font-bold text-black shadow-neo-sm outline-none sm:col-span-2"
        />
        <select
          name="deck"
          defaultValue={filters.deckId ? String(filters.deckId) : ""}
          className="h-11 rounded-lg border-[3px] border-neo-ink bg-white px-2 font-bold text-black shadow-neo-sm"
        >
          <option value="">Semua deck</option>
          {facets.decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
        <select
          name="state"
          defaultValue={filters.state}
          className="h-11 rounded-lg border-[3px] border-neo-ink bg-white px-2 font-bold text-black shadow-neo-sm"
        >
          {STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
        <select
          name="tag"
          defaultValue={filters.tag ?? ""}
          className="h-11 rounded-lg border-[3px] border-neo-ink bg-white px-2 font-bold text-black shadow-neo-sm"
        >
          <option value="">Semua tag</option>
          {facets.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <button type="submit" className="neo-button bg-neo-yellow">
          Terapkan
        </button>
      </form>

      <div className="mt-6">
        <CardBrowser cards={cards} decks={facets.decks} />
      </div>

      {pageCount > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center gap-2">
          {filters.page > 1 ? (
            <Link href={pageLink(filters.page - 1)} className="neo-button bg-white text-xs">
              ← Sebelumnya
            </Link>
          ) : null}
          {filters.page < pageCount ? (
            <Link href={pageLink(filters.page + 1)} className="neo-button bg-white text-xs">
              Berikutnya →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
