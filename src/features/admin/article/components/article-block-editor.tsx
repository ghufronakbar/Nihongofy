"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ArticleEditorBodySchema,
  type ArticleBodyBlock,
} from "@/features/article/schemas";
const TYPES = {
  paragraph: "Paragraf",
  heading: "Subjudul",
  list: "Daftar",
  example: "Contoh percakapan",
  callout: "Catatan",
  quote: "Kutipan",
  image: "Gambar",
} as const;
type BlockType = keyof typeof TYPES;
function newBlock(type: BlockType): ArticleBodyBlock {
  const key = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { type, key, level: 2, text: "", japanese: "" };
    case "list":
      return { type, key, ordered: false, items: [""], japaneseItems: [] };
    case "example":
      return { type, key, japanese: "", translation: "", note: "" };
    case "callout":
      return {
        type,
        key,
        title: "",
        text: "",
        japaneseTitle: "",
        japanese: "",
        tone: "blue",
      };
    case "image":
      return { type, key, src: "", alt: "", caption: "", japaneseCaption: "" };
    case "quote":
      return { type, key, text: "", japanese: "", attribution: "" };
    case "paragraph":
      return { type, key, text: "", japanese: "" };
  }
}
// Editors allow incomplete blocks while typing. The shared schema validates on save.
export function ArticleBlockEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [nextType, setNextType] = useState<BlockType>("paragraph");
  let blocks: ArticleBodyBlock[];
  try {
    const raw: unknown = JSON.parse(value);
    blocks = ArticleEditorBodySchema.safeParse(raw).data ?? [];
  } catch {
    blocks = [];
  }
  function commit(next: ArticleBodyBlock[]) {
    onChange(JSON.stringify(next));
  }
  function patch(index: number, data: Partial<ArticleBodyBlock>) {
    commit(
      blocks.map((block, i) =>
        i === index ? ({ ...block, ...data } as ArticleBodyBlock) : block,
      ),
    );
  }
  function move(index: number, delta: number) {
    const next = [...blocks];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    commit(next);
  }
  function area(
    label: string,
    text: string | undefined,
    change: (text: string) => void,
    ja = false,
  ) {
    return (
      <label className="grid gap-2 text-xs font-semibold">
        {label}
        <Textarea
          value={text ?? ""}
          rows={ja ? 4 : 3}
          onChange={(e) => change(e.target.value)}
          lang={ja ? "ja" : "id"}
          className={ja ? "font-japanese leading-8" : "leading-7"}
        />
      </label>
    );
  }
  return (
    <div className="grid gap-4">
      {blocks.map((block, index) => (
        <section
          key={block.key ?? `legacy-${index}`}
          className="rounded-lg border border-neo-ink/20 bg-white p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <strong className="text-sm">
              {TYPES[block.type]}{" "}
              <span className="font-normal text-foreground/50">
                {index + 1}
              </span>
            </strong>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={`Naikkan blok ${index + 1}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded p-2 hover:bg-muted disabled:opacity-25"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Turunkan blok ${index + 1}`}
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                className="rounded p-2 hover:bg-muted disabled:opacity-25"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Hapus blok ${index + 1}`}
                disabled={blocks.length === 1}
                onClick={() => commit(blocks.filter((_, i) => i !== index))}
                className="rounded p-2 text-red-700 hover:bg-red-50 disabled:opacity-25"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          {block.type === "heading" && (
            <label className="mb-4 grid max-w-48 gap-2 text-xs font-semibold">
              Tingkat subjudul
              <NativeSelect
                value={block.level}
                onChange={(e) =>
                  patch(index, { level: e.target.value === "3" ? 3 : 2 })
                }
              >
                <option value={2}>Subjudul utama (H2)</option>
                <option value={3}>Subjudul bagian (H3)</option>
              </NativeSelect>
            </label>
          )}
          {block.type === "callout" && (
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              {area("Judul catatan · Indonesia", block.title, (text) =>
                patch(index, { title: text }),
              )}
              {area(
                "Judul catatan · Jepang",
                block.japaneseTitle,
                (text) => patch(index, { japaneseTitle: text }),
                true,
              )}
            </div>
          )}
          {"text" in block && (
            <div className="grid gap-4 lg:grid-cols-2">
              {area("Indonesia", block.text, (text) => patch(index, { text }))}
              {area(
                "Jepang · opsional untuk artikel Indonesia",
                block.japanese,
                (text) => patch(index, { japanese: text }),
                true,
              )}
            </div>
          )}
          {block.type === "quote" && (
            <label className="mt-4 grid gap-2 text-xs font-semibold">
              Sumber kutipan
              <Input
                value={block.attribution ?? ""}
                onChange={(e) => patch(index, { attribution: e.target.value })}
              />
            </label>
          )}
          {block.type === "list" && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {area(
                  "Indonesia · satu butir per baris",
                  block.items.join("\n"),
                  (text) => patch(index, { items: text.split("\n") }),
                )}
                {area(
                  "Jepang · urutan dan jumlah butir harus sama",
                  block.japaneseItems?.join("\n"),
                  (text) =>
                    patch(index, {
                      japaneseItems: text ? text.split("\n") : [],
                    }),
                  true,
                )}
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={block.ordered ?? false}
                  onChange={(e) => patch(index, { ordered: e.target.checked })}
                />
                Daftar bernomor
              </label>
            </>
          )}
          {block.type === "example" && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {area(
                  "Percakapan atau kalimat Jepang",
                  block.japanese,
                  (text) => patch(index, { japanese: text }),
                  true,
                )}
                {area("Terjemahan Indonesia", block.translation, (text) =>
                  patch(index, { translation: text }),
                )}
              </div>
              <div className="mt-4">
                {area("Catatan penggunaan · opsional", block.note, (text) =>
                  patch(index, { note: text }),
                )}
              </div>
            </>
          )}
          {block.type === "image" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-xs font-semibold">
                URL atau path gambar
                <Input
                  value={block.src}
                  onChange={(e) => patch(index, { src: e.target.value })}
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold">
                Deskripsi gambar untuk pembaca layar
                <Input
                  value={block.alt}
                  onChange={(e) => patch(index, { alt: e.target.value })}
                />
              </label>
              {area("Caption Indonesia", block.caption, (text) =>
                patch(index, { caption: text }),
              )}
              {area(
                "Caption Jepang",
                block.japaneseCaption,
                (text) => patch(index, { japaneseCaption: text }),
                true,
              )}
            </div>
          )}
        </section>
      ))}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neo-ink/30 p-4">
        <label className="grid min-w-48 flex-1 gap-2 text-xs font-semibold">
          Jenis blok baru
          <NativeSelect
            value={nextType}
            onChange={(e) => setNextType(e.target.value as BlockType)}
          >
            {Object.entries(TYPES).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button
          type="button"
          disabled={blocks.length >= 120}
          onClick={() => commit([...blocks, newBlock(nextType)])}
          className="neo-button min-h-10 bg-white text-xs"
        >
          <Plus className="size-4" />
          Tambah blok
        </button>
      </div>
    </div>
  );
}
