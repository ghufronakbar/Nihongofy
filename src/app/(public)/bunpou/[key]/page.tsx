import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURES } from "@/constants";
import { BunpouPointView } from "@/features/bunpou/components/bunpou-point-view";
import { getBunpouPointDetail } from "@/features/bunpou/queries";
import type { BunpouCommunity } from "@/features/bunpou/components/bunpou-point-community";
import {
  countDiscussionEntries,
  getDiscussion,
  getOwnBunpouNotes,
  isPostingSuspended,
  withViewerVotes,
} from "@/features/question-comment/queries";
import { getSession } from "@/lib/auth";
import { BunpouKeySchema } from "@/features/bunpou/schemas";
import { breadcrumbJsonLd, learningResourceJsonLd } from "@/lib/json-ld";
import { pageMetadata, privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ key: string }> };

async function detailFromParams(params: Props["params"]) {
  const parsed = BunpouKeySchema.safeParse((await params).key);
  return parsed.success ? getBunpouPointDetail(parsed.data) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await detailFromParams(params);
  if (!detail) {
    return privateMetadata("Pola tidak ditemukan", "Pola yang kamu cari belum atau tidak lagi tersedia.");
  }

  const { point, content } = detail;
  const sense = content.senseLabel ? ` (${content.senseLabel})` : "";
  return pageMetadata({
    title: `${point.titlePlain}${sense} – Bunpou JLPT ${point.level}`,
    description: `${content.meaningId.trim().replace(/[.。]?$/, ".")} Arti, sambungan, penjelasan, dan contoh kalimat pola ${point.titlePlain} untuk JLPT ${point.level}.`,
    path: `/bunpou/${point.key}`,
    keywords: [point.titlePlain, point.titleReading, point.titleRomaji, `JLPT ${point.level}`, "bunpou", "文法"],
  });
}

/**
 * Catatan pribadi dan diskusi publik. Tidak di-cache, sama seperti diskusi di
 * tempat lain: isinya berubah setiap ada balasan. Thread ikut dirender server
 * supaya terindeks bersama isi polanya.
 */
async function loadCommunity(pointId: number, pointKey: string): Promise<BunpouCommunity | null> {
  if (!FEATURES.bunpouDiscussion) return null;
  const target = { type: "bunpou" as const, bunpouPointId: pointId };
  const [session, threadRoots] = await Promise.all([getSession(), getDiscussion(target)]);
  const viewerId = session?.userId ?? null;
  const [notes, postingSuspended, roots] = await Promise.all([
    viewerId === null ? [] : getOwnBunpouNotes(viewerId, pointId),
    isPostingSuspended(viewerId),
    withViewerVotes(threadRoots, viewerId),
  ]);
  return {
    pointId,
    pointKey,
    viewerId,
    postingSuspended,
    notes,
    roots,
    entryCount: countDiscussionEntries(roots),
    reportEnabled: FEATURES.report,
  };
}

export default async function BunpouPointPage({ params }: Props) {
  const detail = await detailFromParams(params);
  if (!detail) notFound();

  const { point, content } = detail;
  const community = await loadCommunity(detail.id, point.key);
  const path = `/bunpou/${point.key}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <JsonLd
        data={[
          learningResourceJsonLd({
            path,
            name: `${point.titlePlain}${content.senseLabel ? ` (${content.senseLabel})` : ""}`,
            description: content.meaningId,
            resourceType: "Reference",
            educationalLevel: `JLPT ${point.level}`,
          }),
          breadcrumbJsonLd([
            { name: "Beranda", path: "/" },
            { name: "Bunpou", path: "/bunpou" },
            { name: point.titlePlain, path },
          ]),
        ]}
      />
      <BunpouPointView detail={detail} reportEnabled={FEATURES.report} community={community} />
    </main>
  );
}
