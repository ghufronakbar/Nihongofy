import type { Metadata } from "next";
import { KanaPage } from "@/features/kana/components/kana-page";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Belajar Katakana",
  description:
    "Flashcard katakana interaktif dengan romaji, variasi bunyi, audio, dan review di Nihongofy.",
  path: "/kana/katakana",
});

export default function KatakanaPage() {
  return (
    <>
      <JsonLd
        data={[
          learningResourceJsonLd({
            path: "/kana/katakana",
            name: "Belajar Katakana",
            description:
              "Flashcard katakana lengkap dengan romaji, variasi bunyi, audio, dan sesi review.",
            resourceType: "Flashcard",
            educationalLevel: "Pemula / JLPT N5",
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Katakana", path: "/kana/katakana" },
          ]),
        ]}
      />
      <KanaPage script="katakana" />
    </>
  );
}
