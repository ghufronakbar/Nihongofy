"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import {
  BUNPOU_CONNECTION_FORM_BY_SLUG,
  BUNPOU_DIMENSIONS,
  BUNPOU_KIND_LABEL,
  BUNPOU_KINDS,
  BUNPOU_LEVELS,
  BUNPOU_SECTIONS,
  BUNPOU_TAGS_BY_DIMENSION,
  sectionLabel,
} from "../taxonomy";
import {
  EMPTY_BUNPOU_FILTERS,
  matchesBunpouFilters,
  matchesBunpouQuery,
  searchTerms,
  type BunpouCatalogFilters,
} from "../lib/catalog-filter";
import type { BunpouLevel, BunpouPointSummary } from "../types";

function setLevelInUrl(level: BunpouLevel) {
  // replaceState terintegrasi dengan router Next, jadi tombol kembali dari
  // halaman detail mendarat di tab level yang sama tanpa menambah riwayat.
  const url = new URL(window.location.href);
  url.searchParams.set("level", level);
  window.history.replaceState(null, "", url);
}

type Props = {
  points: BunpouPointSummary[];
  initialLevel: BunpouLevel;
};

/**
 * Katalog pola per level. Seluruh daftar ringkas dikirim sekali, lalu pencarian
 * dan filter berjalan di client — katalog paling banyak sekitar seribu pola.
 * Saat mencari, batas level diabaikan supaya pola dari level lain tetap ketemu.
 */
export function BunpouCatalog({ points, initialLevel }: Props) {
  const [level, setLevel] = useState<BunpouLevel>(initialLevel);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BunpouCatalogFilters>(EMPTY_BUNPOU_FILTERS);
  const deferredQuery = useDeferredValue(query);

  const countByLevel = useMemo(() => {
    const counts = new Map<BunpouLevel, number>();
    for (const point of points) counts.set(point.level, (counts.get(point.level) ?? 0) + 1);
    return counts;
  }, [points]);

  const terms = searchTerms(deferredQuery);
  const searching = terms.length > 0;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const visible = points.filter(
    (point) =>
      (searching || point.level === level) &&
      matchesBunpouFilters(point, filters) &&
      (!searching || matchesBunpouQuery(point, terms)),
  );

  // Bentuk sambungan yang benar-benar dipakai, supaya dropdown tidak berisi
  // puluhan pilihan yang hasilnya selalu kosong.
  const usedConnections = useMemo(() => {
    const used = new Set(points.flatMap((point) => point.connectionForms));
    return [...BUNPOU_CONNECTION_FORM_BY_SLUG.values()].filter((form) => used.has(form.slug));
  }, [points]);

  const usedTags = useMemo(() => new Set(points.flatMap((point) => point.tags)), [points]);

  function chooseLevel(next: BunpouLevel) {
    setLevel(next);
    setLevelInUrl(next);
  }

  return (
    <div>
      <div role="group" aria-label="Level JLPT" className="flex flex-wrap gap-2">
        {BUNPOU_LEVELS.map((item) => {
          const count = countByLevel.get(item) ?? 0;
          const selected = !searching && item === level;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              disabled={count === 0}
              onClick={() => chooseLevel(item)}
              className={cn(
                "neo-button min-h-10 px-4 py-2",
                selected ? "bg-neo-yellow text-black" : "bg-white text-black",
              )}
            >
              {item}
              <span className="text-xs font-bold tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3">
        <label className="relative block">
          <span className="sr-only">Cari pola</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari pola, bacaan, romaji, atau arti… (mis. nagara, sambil)"
            className="neo-input pl-12"
          />
        </label>

        <details>
          <summary className="cursor-pointer text-sm font-black underline underline-offset-4">
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount} aktif)` : ""}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FilterSelect
              label="Jenis materi"
              value={filters.kind}
              onChange={(value) => setFilters({ ...filters, kind: BUNPOU_KINDS.find((kind) => kind === value) ?? "" })}
              options={BUNPOU_KINDS.map((kind) => ({ value: kind, label: BUNPOU_KIND_LABEL[kind] }))}
            />
            {BUNPOU_DIMENSIONS.map((dimension) => (
              <FilterSelect
                key={dimension.id}
                label={dimension.label}
                value={filters[dimension.id]}
                onChange={(value) => setFilters({ ...filters, [dimension.id]: value })}
                options={(BUNPOU_TAGS_BY_DIMENSION.get(dimension.id) ?? [])
                  .filter((tag) => usedTags.has(tag.slug))
                  .map((tag) => ({ value: tag.slug, label: tag.label }))}
              />
            ))}
            <FilterSelect
              label="Sambungan"
              value={filters.connection}
              onChange={(value) => setFilters({ ...filters, connection: value })}
              options={usedConnections.map((form) => ({
                value: form.slug,
                label: `${form.label} (${form.labelJa})`,
              }))}
            />
          </div>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_BUNPOU_FILTERS)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-black underline underline-offset-4"
            >
              <X className="size-4" aria-hidden /> Hapus filter
            </button>
          ) : null}
        </details>
      </div>

      <p className="mt-6 text-sm font-bold text-muted-foreground" aria-live="polite">
        {searching
          ? `${visible.length} pola cocok di semua level.`
          : `${visible.length} pola ${level}${activeFilterCount > 0 ? " sesuai filter" : ""}.`}
      </p>

      {visible.length === 0 ? (
        <p className="neo-surface mt-4 p-6 font-bold text-muted-foreground">
          {points.length === 0
            ? "Katalog pola belum tersedia."
            : "Tidak ada pola yang cocok. Coba kata kunci lain atau hapus filter."}
        </p>
      ) : searching ? (
        <PointList points={visible} showLevel />
      ) : (
        <div className="mt-4 space-y-10">
          {BUNPOU_SECTIONS.map((section) => {
            const items = visible.filter((point) => point.sectionKey === section.key);
            if (items.length === 0) return null;
            return (
              <section key={section.key} aria-labelledby={`bunpou-section-${section.key}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 id={`bunpou-section-${section.key}`} className="text-xl font-black">
                    {section.label}
                  </h2>
                  <span lang="ja" className="font-japanese text-sm font-bold text-muted-foreground">
                    {section.labelJa}
                  </span>
                </div>
                <PointList points={items} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm font-black">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="neo-input mt-1.5 h-11 appearance-auto text-sm"
      >
        <option value="">Semua</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PointList({ points, showLevel = false }: { points: BunpouPointSummary[]; showLevel?: boolean }) {
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {points.map((point) => (
        <li key={point.key}>
          <Link
            href={`/bunpou/${point.key}`}
            className="neo-surface neo-interactive flex h-full items-start gap-3 p-4"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5 text-xs font-black">
                {showLevel ? (
                  <span className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-black">
                    {point.level}
                  </span>
                ) : null}
                <span className="text-muted-foreground">{BUNPOU_KIND_LABEL[point.kind]}</span>
                {showLevel ? (
                  <span className="text-muted-foreground">· {sectionLabel(point.sectionKey)}</span>
                ) : null}
              </span>
              <span lang="ja" className="font-japanese mt-1 block text-xl leading-relaxed font-black">
                <JapaneseText text={point.title} />
              </span>
              {point.senseLabel ? (
                <span className="mt-0.5 block text-xs font-black tracking-wide text-neo-blue uppercase">
                  {point.senseLabel}
                </span>
              ) : null}
              <span className="mt-1 block text-sm font-semibold text-muted-foreground">
                {point.meaningId}
              </span>
            </span>
            <ChevronRight className="mt-1 size-5 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
