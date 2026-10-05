import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURES } from "@/constants";
import { BunpouComparisonView } from "@/features/bunpou/components/bunpou-comparison-view";
import { comparisonDescription, comparisonLevels } from "@/features/bunpou/lib/comparison";
import { getBunpouComparisonDetail } from "@/features/bunpou/queries";
import { BunpouKeySchema } from "@/features/bunpou/schemas";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { pageMetadata, privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ key: string }> };

async function detailFromParams(params: Props["params"]) {
  const parsed = BunpouKeySchema.safeParse((await params).key);
  return parsed.success ? getBunpouComparisonDetail(parsed.data) : null;
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
    description: comparisonDescription(detail.content.summary),
    path: `/bunpou/compare/${detail.key}`,
    keywords: [...detail.points.map((point) => point.titlePlain), "bunpou", "文法"],
  });
}

export default async function BunpouComparisonPage({ params }: Props) {
  const detail = await detailFromParams(params);
  if (!detail) notFound();

  const path = `/bunpou/compare/${detail.key}`;

  // Bukan <main>: layout (public) sudah menyediakan landmark utamanya.
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <JsonLd
        data={[
          learningResourceJsonLd({
            path,
            name: detail.title,
            description: comparisonDescription(detail.content.summary),
            resourceType: "Reference",
            educationalLevel: comparisonLevels(detail.points)
              .map((level) => `JLPT ${level}`)
              .join(", "),
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Bunpou", path: "/bunpou" },
            { name: detail.title, path },
          ]),
        ]}
      />
      <BunpouComparisonView detail={detail} reportEnabled={FEATURES.report} />
    </div>
  );
}
