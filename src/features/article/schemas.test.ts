import { describe, expect, it } from "vitest";
import { CreateArticleSchema } from "@/features/admin/article/schemas";
import seed from "./data/article-seed.json";
import {
  ArticleBodySchema,
  ArticleSlugSchema,
  type ArticleBodyBlock,
} from "./schemas";
import { articleBodyToPlainText } from "./lib/body-text";

const fixture = seed[0];
const complete = CreateArticleSchema.parse({
  ...fixture,
  bodyJson: JSON.stringify(fixture.body),
});
const indonesia = {
  ...complete,
  titleJa: "",
  excerptJa: "",
  readingLevel: "" as const,
  bodyJson: JSON.stringify([
    { type: "paragraph", text: "Cerita pendek tentang Jepang." },
  ]),
};

describe("publikasi artikel", () => {
  it("seed lengkap lolos pemeriksaan yang sama dengan editor", () => {
    expect(CreateArticleSchema.safeParse(complete).success).toBe(true);
    expect(ArticleBodySchema.parse(fixture.body)).toHaveLength(18);
    expect(complete.glossary).toHaveLength(12);
  });

  it("artikel Indonesia tanpa level boleh terbit", () => {
    expect(CreateArticleSchema.safeParse(indonesia).success).toBe(true);
  });

  it("contoh kalimat Jepang tidak mewajibkan terjemahan seluruh artikel Indonesia", () => {
    const body: ArticleBodyBlock[] = [
      { type: "paragraph", text: "Coba gunakan sapaan berikut." },
      { type: "example", japanese: "こんにちは。", translation: "Halo." },
    ];
    expect(
      CreateArticleSchema.safeParse({
        ...indonesia,
        bodyJson: JSON.stringify(body),
      }).success,
    ).toBe(true);
  });

  it("terjemahan parsial bisa disimpan sebagai draf, tetapi tidak bisa terbit", () => {
    const input = {
      ...complete,
      bodyJson: JSON.stringify([
        { type: "paragraph", text: "Belum diterjemahkan." },
      ]),
    };
    expect(
      CreateArticleSchema.safeParse({ ...input, status: "DRAFT" }).success,
    ).toBe(true);
    expect(CreateArticleSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { type: "list", items: ["Satu", "Dua"], japaneseItems: ["一つ", ""] },
    {
      type: "callout",
      title: "Catatan",
      text: "Keterangan.",
      japaneseTitle: "メモ",
    },
    {
      type: "image",
      src: "/articles/konbini-evening.jpg",
      alt: "Konbini",
      caption: "Malam hari",
      japaneseCaption: "夜",
    },
  ])("mendeteksi terjemahan yang mulai diisi pada blok $type", (block) => {
    expect(
      CreateArticleSchema.safeParse({
        ...indonesia,
        bodyJson: JSON.stringify([block]),
      }).success,
    ).toBe(false);
  });

  it("setiap butir daftar membutuhkan pasangan Jepang", () => {
    const body = [
      { type: "list", items: ["Satu", "Dua"], japaneseItems: ["一つ"] },
    ];
    expect(
      CreateArticleSchema.safeParse({
        ...complete,
        bodyJson: JSON.stringify(body),
      }).success,
    ).toBe(false);
  });

  it("level bahasa tidak boleh diberikan ke artikel tanpa versi Jepang", () => {
    expect(
      CreateArticleSchema.safeParse({ ...indonesia, readingLevel: "N4" })
        .success,
    ).toBe(false);
  });

  it("menolak key blok duplikat dan nama route yang dicadangkan", () => {
    expect(
      ArticleBodySchema.safeParse([
        { type: "paragraph", key: "intro", text: "Satu" },
        { type: "paragraph", key: "intro", text: "Dua" },
      ]).success,
    ).toBe(false);
    for (const slug of ["read", "search", "saved"])
      expect(ArticleSlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("teks pencarian", () => {
  it("memuat kedua bahasa tanpa membocorkan sintaks furigana", () => {
    const plain = articleBodyToPlainText([
      {
        type: "paragraph",
        text: "Membeli makanan.",
        japanese: "{食|た}べ{物|もの}を{買|か}います。",
      },
      { type: "list", items: ["Kantong"], japaneseItems: ["{袋|ふくろ}"] },
    ]);
    expect(plain).toContain("Membeli makanan.");
    expect(plain).toContain("食べ物を買います。");
    expect(plain).toContain("袋");
    expect(plain).not.toMatch(/[{}|]/);
  });
});
