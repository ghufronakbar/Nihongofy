import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { BunpouCatalog } from "@/features/bunpou/components/bunpou-catalog";
import { comparisonLevels } from "@/features/bunpou/lib/comparison";
import { getBunpouCatalog, getBunpouComparisonLinks } from "@/features/bunpou/queries";
import { BUNPOU_LEVELS, BUNPOU_LICENSE } from "@/features/bunpou/taxonomy";
import type { BunpouLevel } from "@/features/bunpou/types";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "Katalog pola kalimat (文法) JLPT N5 sampai N1 dengan arti, sambungan, penjelasan, dan contoh kalimat berfurigana.";

export const metadata: Metadata = pageMetadata({
  title: "Bunpou: Pola Kalimat Bahasa Jepang JLPT",
  description: DESCRIPTION,
  path: "/bunpou",
  ogDescription:
    "Pola kalimat JLPT per level lengkap dengan sambungan, penjelasan bahasa Indonesia, dan contoh kalimat.",
});

type Props = { searchParams: Promise<{ level?: string | string[] }> };

function isLevel(value: unknown): value is BunpouLevel {
  return typeof value === "string" && (BUNPOU_LEVELS as string[]).includes(value);
}

export default async function BunpouPage({ searchParams }: Props) {
  const [points, comparisons, { level }] = await Promise.all([
    getBunpouCatalog(),
    getBunpouComparisonLinks(),
    searchParams,
  ]);

  const levelsWithPoints = BUNPOU_LEVELS.filter((item) =>
    points.some((point) => point.level === item),
  );
  const requested = level?.toString().toUpperCase();
  const initialLevel =
    isLevel(requested) && levelsWithPoints.includes(requested)
      ? requested
      : (levelsWithPoints[0] ?? "N5");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <JsonLd
        data={[
          learningResourceJsonLd({
            path: "/bunpou",
            name: "Bunpou: pola kalimat bahasa Jepang JLPT",
            description: DESCRIPTION,
            resourceType: "Reference",
            educationalLevel: "JLPT N5–N1",
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Bunpou", path: "/bunpou" },
          ]),
        ]}
      />

      <h1 className="text-3xl font-black">
        Bunpou <span lang="ja" className="font-japanese">文法</span>
      </h1>
      <p className="mt-3 max-w-2xl font-bold text-muted-foreground">
        Pola kalimat JLPT dari N5 sampai N1, diurutkan seperti urutan belajar. Tiap pola punya arti,
        cara menyambung, penjelasan, dan contoh kalimat yang bisa didengarkan.
      </p>

      <div className="mt-8">
        <BunpouCatalog points={points} initialLevel={initialLevel} />
      </div>

      {comparisons.length > 0 ? (
        <section className="mt-12" aria-labelledby="bunpou-comparisons">
          <h2 id="bunpou-comparisons" className="text-xl font-black">
            Perbandingan pola mirip
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Bentuk berbeda dengan makna mirip, lengkap dengan kalimat kontras. Diurutkan dari
            level termudah.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {comparisons.map((comparison) => (
              <li key={comparison.key}>
                <Link
                  href={`/bunpou/compare/${comparison.key}`}
                  className="neo-surface neo-interactive flex h-full items-start gap-3 p-4"
                >
                  <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap gap-1 text-xs font-black">
                      {comparisonLevels(comparison.points).map((item) => (
                        <span
                          key={item}
                          className="rounded border-2 border-neo-ink bg-neo-yellow px-1.5 text-black"
                        >
                          {item}
                        </span>
                      ))}
                    </span>
                    <span className="mt-1.5 block font-black">{comparison.title}</span>
                    <span lang="ja" className="font-japanese mt-1 block text-sm font-bold text-muted-foreground">
                      {comparison.points.map((point) => point.titlePlain).join("・")}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-xs font-semibold text-muted-foreground">Konten: {BUNPOU_LICENSE}</p>
    </div>
  );
}
