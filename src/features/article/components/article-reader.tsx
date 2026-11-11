"use client";

import { useState, type CSSProperties } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Languages,
  List,
  Minus,
  Plus,
  Settings2,
} from "lucide-react";
import { JapaneseText } from "@/components/japanese-text";
import {
  DictionaryScope,
  useDismissDictionary,
} from "@/features/dictionary/components/dictionary-scope";
import { markupToPlainText } from "@/lib/japanese-plain-text";
import { cn } from "@/lib/utils";
import type { ArticleBodyBlock, ArticleGlossary } from "../schemas";
import { useReaderPreferences } from "../lib/reader-preferences";
import {
  ArticleBody,
  articleBlockId,
  type ArticleReadingMode,
} from "./article-body";

const MODES: Array<{ value: ArticleReadingMode; label: string }> = [
  { value: "id", label: "Indonesia" },
  { value: "ja", label: "日本語" },
  { value: "bilingual", label: "Bilingual" },
];
export function ArticleReader({
  blocks,
  hasJapanese,
  glossary = [],
  contextKey,
  preview = false,
}: {
  blocks: ArticleBodyBlock[];
  hasJapanese: boolean;
  glossary?: ArticleGlossary;
  contextKey: string;
  preview?: boolean;
}) {
  const [preferences, update] = useReaderPreferences();
  const [showTranslations, setShowTranslations] = useState(false);
  const dismissDictionary = useDismissDictionary();
  const mode = hasJapanese ? preferences.mode : "id";
  const headings = blocks.flatMap((block, i) =>
    block.type === "heading" && block.level === 2
      ? [
          {
            id: articleBlockId(block, i),
            text:
              mode !== "id" && block.japanese
                ? markupToPlainText(block.japanese)
                : block.text,
          },
        ]
      : [],
  );
  function change(patch: Parameters<typeof update>[0]) {
    dismissDictionary?.();
    update(patch);
  }
  return (
    <div
      className="article-reader"
      data-theme={preferences.theme}
      style={
        { "--article-font-size": `${preferences.fontSize}px` } as CSSProperties
      }
    >
      <div className={cn("article-reader-toolbar", preview && "!static")}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Bahasa bacaan"
            className="article-language-tabs"
          >
            {MODES.filter((item) => hasJapanese || item.value === "id").map(
              (item) => (
                <button
                  key={item.value}
                  type="button"
                  lang={item.value === "ja" ? "ja" : "id"}
                  aria-pressed={mode === item.value}
                  onClick={() => change({ mode: item.value })}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
          {hasJapanese && (
            <label className="article-reader-switch">
              <input
                type="checkbox"
                checked={preferences.furigana}
                onChange={(e) => change({ furigana: e.target.checked })}
              />
              <span>Furigana</span>
            </label>
          )}
        </div>
        <details className="article-reader-settings">
          <summary aria-label="Pengaturan membaca">
            <Settings2 className="size-4" aria-hidden="true" />
            <span>Pengaturan</span>
            <ChevronDown className="size-3" aria-hidden="true" />
          </summary>
          <div className="article-settings-panel">
            <p className="text-sm font-bold">Nyaman dengan caramu</p>
            {hasJapanese && (
              <label className="mt-4 flex items-center gap-2 text-sm sm:hidden">
                <input
                  type="checkbox"
                  checked={preferences.furigana}
                  onChange={(e) => change({ furigana: e.target.checked })}
                />
                Tampilkan furigana
              </label>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm">Ukuran teks</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Perkecil teks"
                  disabled={preferences.fontSize <= 17}
                  onClick={() =>
                    change({ fontSize: Math.max(17, preferences.fontSize - 1) })
                  }
                >
                  <Minus className="size-4" />
                </button>
                <span className="min-w-7 text-center text-sm">
                  {preferences.fontSize}
                </span>
                <button
                  type="button"
                  aria-label="Perbesar teks"
                  disabled={preferences.fontSize >= 25}
                  onClick={() =>
                    change({ fontSize: Math.min(25, preferences.fontSize + 1) })
                  }
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm">Latar bacaan</legend>
              <div className="flex gap-2">
                {(
                  [
                    { value: "light", label: "Terang" },
                    { value: "paper", label: "Kertas" },
                    { value: "dark", label: "Gelap" },
                  ] as const
                ).map((theme) => (
                  <button
                    key={theme.value}
                    type="button"
                    aria-pressed={preferences.theme === theme.value}
                    onClick={() => change({ theme: theme.value })}
                    className="article-theme-choice"
                  >
                    {preferences.theme === theme.value && (
                      <Check className="size-3" />
                    )}
                    {theme.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {hasJapanese && (
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={preferences.parallel}
                  onChange={(e) => change({ parallel: e.target.checked })}
                />
                Sejajar pada layar lebar
              </label>
            )}
            <p className="mt-4 text-xs opacity-70">
              Pilihanmu tersimpan di perangkat ini.
            </p>
          </div>
        </details>
      </div>
      <div className="article-reader-inner">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-current/10 pb-5 text-sm">
          <span className="inline-flex items-center gap-2 opacity-70">
            <BookOpen className="size-4" />
            {mode === "bilingual"
              ? "Coba baca Jepang, buka arti saat perlu."
              : mode === "ja"
                ? "Nikmati bacaan dalam bahasa Jepang."
                : "Selamat membaca. Ambil waktu yang kamu perlukan."}
          </span>
          {mode === "bilingual" && !preferences.parallel && (
            <button
              type="button"
              aria-pressed={showTranslations}
              onClick={() => {
                dismissDictionary?.();
                setShowTranslations((v) => !v);
              }}
              className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
            >
              <Languages className="size-4" />
              {showTranslations ? "Tutup semua arti" : "Buka semua arti"}
            </button>
          )}
        </div>
        {headings.length > 2 && (
          <details className="article-toc">
            <summary>
              <List className="size-4" />
              Di dalam bacaan ini
              <ChevronDown className="ml-auto size-4" />
            </summary>
            <nav aria-label="Daftar isi artikel" className="mt-4 grid gap-3">
              {headings.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </details>
        )}
        <DictionaryScope
          contextKey={`${contextKey}:${mode}:${preferences.furigana}`}
        >
          <div className={cn(!preferences.furigana && "[&_rt]:hidden")}>
            <ArticleBody
              blocks={blocks}
              mode={mode}
              showTranslations={showTranslations}
              parallel={preferences.parallel}
            />
            {glossary.length > 0 && (
              <section
                className="article-glossary"
                aria-labelledby={`glossary-${contextKey}`}
              >
                <div className="mb-6 flex items-center gap-3">
                  <span className="article-section-icon">
                    <Languages className="size-5" />
                  </span>
                  <div>
                    <h2
                      id={`glossary-${contextKey}`}
                      className="text-xl font-bold"
                    >
                      Bawa pulang kata baru
                    </h2>
                    <p className="mt-1 text-sm opacity-70">
                      Kosakata pilihan dari bacaan ini.
                    </p>
                  </div>
                </div>
                <dl className="grid gap-0 sm:grid-cols-2 sm:gap-x-8">
                  {glossary.map((entry) => (
                    <div
                      key={entry.word}
                      className="border-b border-current/10 py-4"
                    >
                      <dt
                        lang="ja"
                        className="font-japanese text-xl leading-10"
                      >
                        <JapaneseText text={entry.word} />
                      </dt>
                      <dd className="mt-1 text-sm leading-6">
                        {entry.meaning}
                        {entry.note && (
                          <span className="mt-1 block text-xs opacity-70">
                            {entry.note}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </DictionaryScope>
        <div className="mt-12 flex items-center justify-center gap-2 text-xs font-medium opacity-60">
          <Check className="size-4" />
          Kamu sudah sampai di akhir bacaan.
        </div>
      </div>
    </div>
  );
}
