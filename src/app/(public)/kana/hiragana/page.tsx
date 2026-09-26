import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Belajar Hiragana",
  description:
    "Flashcard hiragana interaktif dengan romaji, variasi bunyi, audio, dan review di Nihongofy.",
  path: "/kana/hiragana",
});

export default function HiraganaPage() {
  return (
    <>
      <JsonLd
        data={[
          learningResourceJsonLd({
            path: "/kana/hiragana",
            name: "Belajar Hiragana",
            description:
              "Flashcard hiragana lengkap dengan romaji, variasi bunyi, audio, dan sesi review.",
            resourceType: "Flashcard",
            educationalLevel: "Pemula / JLPT N5",
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Hiragana", path: "/kana/hiragana" },
          ]),
        ]}
      />
      <KanaPage script="hiragana" />
    </>
  );
}
