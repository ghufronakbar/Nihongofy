import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { FEATURES } from "@/constants";
import { getProfileOverview } from "@/features/profile/overview";
import { canViewProfileContent } from "@/features/public-profile/access";
import {
  PublicProfileView,
  type PublicProfileContent,
  type PublicProfileFollow,
} from "@/features/public-profile/components/public-profile-view";
import {
  countPendingFollowRequests,
  getFollowCounts,
  getViewerFollowStatus,
} from "@/features/public-profile/follow-queries";
import {
  COMMUNITY_STATS_ENABLED,
  HEATMAP_ENABLED,
  getProfileActivity,
  getProfileCommunityStats,
  resolveProfileParam,
  type PublicProfileOwner,
} from "@/features/public-profile/queries";
import { getSession } from "@/lib/auth";
import { profilePageJsonLd } from "@/lib/json-ld";
import { pageMetadata, privateMetadata } from "@/lib/seo";

type Props = { params: Promise<{ username: string }> };

async function resolve(params: Props["params"]) {
  return resolveProfileParam((await params).username);
}

// Didedup antara generateMetadata dan page dalam satu request. Isinya hanya
// diambil SETELAH aturan akses lolos — metadata akun private tidak pernah
// membaca statistiknya.
const loadContent = cache(async (ownerId: number, timeZone: string): Promise<PublicProfileContent> => {
  const [overview, activity, community] = await Promise.all([
    getProfileOverview(ownerId),
    HEATMAP_ENABLED ? getProfileActivity({ id: ownerId, timeZone }) : null,
    COMMUNITY_STATS_ENABLED ? getProfileCommunityStats(ownerId) : null,
  ]);
  return { overview, activity, community };
});

function isThin(owner: PublicProfileOwner, content: PublicProfileContent) {
  const { overview, activity, community } = content;
  const hasStats =
    overview.kanaLearned +
      overview.flashcardStudied +
      overview.quickPracticeCompleted +
      overview.sectionPracticeCompleted +
      overview.mockCompleted >
    0;
  return !owner.bio && !hasStats && !activity?.summary.activeDays && !community?.entries;
}

function describeProfile(owner: PublicProfileOwner, content: PublicProfileContent) {
  const { overview } = content;
  const facts = [
    FEATURES.kana && overview.kanaLearned > 0 ? `${overview.kanaLearned} kana` : null,
    FEATURES.flashcard && overview.flashcardStudied > 0 ? `${overview.flashcardStudied} kata flashcard` : null,
    FEATURES.testPackage && overview.mockCompleted > 0 ? `${overview.mockCompleted} mock JLPT selesai` : null,
  ].filter(Boolean);
  const lead = owner.bio ? `${owner.bio.replace(/[.。]?$/, ".")} ` : "";
  const target = owner.jlptTarget ? ` menuju JLPT ${owner.jlptTarget}` : "";
  const summary = facts.length > 0 ? `: ${facts.join(", ")}` : "";
  return `${lead}Profil belajar bahasa Jepang @${owner.username}${target} di Nihongofy${summary}.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await resolve(params);
  if (resolved.kind !== "found") {
    return privateMetadata("Profil tidak ditemukan", "Profil yang kamu cari tidak tersedia.");
  }

  const { owner } = resolved;
  const title = `${owner.displayName} (@${owner.username})`;
  const path = `/u/${owner.username}`;

  // Metadata tidak bergantung viewer: pemilik akun private pun mendapat
  // noindex, karena halaman yang dilihat crawler adalah kartu private.
  if (!canViewProfileContent(owner, null)) {
    return pageMetadata({
      title,
      description: `Profil @${owner.username} di Nihongofy. Akun ini private.`,
      path,
      noindex: true,
    });
  }

  const content = await loadContent(owner.id, owner.timeZone);
  return pageMetadata({
    title,
    description: describeProfile(owner, content),
    path,
    // Profil tanpa isi tidak punya nilai pencarian, sama seperti halaman diskusi
    // tanpa entri; tautan keluarnya tetap ditelusuri.
    ...(isThin(owner, content) ? { noindex: "follow" as const } : {}),
  });
}

export default async function PublicProfilePage({ params }: Props) {
  const resolved = await resolve(params);
  if (resolved.kind === "redirect") permanentRedirect(`/u/${resolved.username}`);
  if (resolved.kind === "missing") notFound();

  const { owner } = resolved;
  const session = await getSession();
  const viewerId = session?.userId ?? null;
  const isOwner = viewerId === owner.id;
  const viewerStatus = await getViewerFollowStatus(viewerId, owner.id);
  const [content, follow] = await Promise.all([
    canViewProfileContent(owner, viewerId, viewerStatus) ? loadContent(owner.id, owner.timeZone) : null,
    FEATURES.follow
      ? Promise.all([getFollowCounts(owner.id), isOwner ? countPendingFollowRequests(owner.id) : 0]).then(
          ([counts, pendingRequests]): PublicProfileFollow => ({
            counts,
            viewerStatus,
            isAuthenticated: viewerId !== null,
            pendingRequests,
          }),
        )
      : null,
  ]);
  // Hanya halaman yang dilihat crawler (guest) yang dinilai: isi yang terbuka
  // karena viewer adalah follower tidak pernah ikut JSON-LD.
  const indexable = canViewProfileContent(owner, null) && content !== null && !isThin(owner, content);

  return (
    <>
      {indexable ? (
        <JsonLd
          data={profilePageJsonLd({
            path: `/u/${owner.username}`,
            displayName: owner.displayName,
            username: owner.username,
            description: owner.bio,
            avatarUrl: owner.avatarUrl,
            createdAt: owner.createdAt,
          })}
        />
      ) : null}
      <PublicProfileView owner={owner} isOwner={isOwner} content={content} follow={follow} features={FEATURES} />
    </>
  );
}
