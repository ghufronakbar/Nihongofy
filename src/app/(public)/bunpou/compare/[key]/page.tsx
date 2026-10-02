import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURES } from "@/constants";
import { BunpouComparisonView } from "@/features/bunpou/components/bunpou-comparison-view";
import { getBunpouComparisonDetail } from "@/features/bunpou/queries";
import { BunpouKeySchema } from "@/features/bunpou/schemas";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { toPlainJapanese } from "@/lib/japanese-markup";
import { pageMetadata, privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ key: string }> };

async function detailFromParams(params: Props["params"]) {
  const parsed = BunpouKeySchema.safeParse((await params).key);
  return parsed.success ? getBunpouComparisonDetail(parsed.data) : null;
}

/** Ringkasan untuk meta description: tanpa markup, dipotong di batas kata. */
function describe(summary: string) {
  const plain = toPlainJapanese(summary).replace(/\s+/g, " ").trim();
  if (plain.length <= 160) return plain;
  return `${plain.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await detailFromParams(params);
  if (!detail) {
    return privateMetadata(
      "Perbandingan tidak ditemukan",
      "Perbandingan pola yang kamu cari belum atau tidak lagi tersedia.",
    );
  }

  return pageMetadata({
    title: `${detail.title} – Perbandingan Bunpou`,
    description: describe(detail.content.summary),
    path: `/bunpou/compare/${detail.key}`,
    keywords: [...detail.points.map((point) => point.titlePlain), "bunpou", "文法"],
  });
}

export default async function BunpouComparisonPage({ params }: Props) {
  const detail = await detailFromParams(params);
  if (!detail) notFound();

  const path = `/bunpou/compare/${detail.key}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <JsonLd
        data={[
          learningResourceJsonLd({
            path,
            name: detail.title,
            description: describe(detail.content.summary),
            resourceType: "Reference",
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Bunpou", path: "/bunpou" },
            { name: detail.title, path },
          ]),
        ]}
      />
      <BunpouComparisonView detail={detail} reportEnabled={FEATURES.report} />
    </main>
  );
}
