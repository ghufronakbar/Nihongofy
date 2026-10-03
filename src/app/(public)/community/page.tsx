import type { Metadata } from "next";
import { Users } from "lucide-react";
import { FEATURES } from "@/constants";
import { ComposerSection } from "@/features/community/components/composer-section";
import { FeedTabs, PostFeed } from "@/features/community/components/post-feed";
import { getCommunityViewer, getGlobalFeed } from "@/features/community/queries";
import { PostCursorSchema } from "@/features/community/schemas";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<{ before?: string | string[] }> };

function cursorOf(value: string | string[] | undefined) {
  return PostCursorSchema.parse(typeof value === "string" ? value : undefined) || null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const before = cursorOf((await searchParams).before);
  return pageMetadata({
    title: "Komunitas",
    description:
      "Postingan, pertanyaan, dan tips belajar bahasa Jepang dari pengguna Nihongofy yang sedang menuju JLPT N5 sampai N1.",
    path: "/community",
    // Halaman lanjutan hanya potongan feed yang terus bergeser; tautannya
    // tetap ditelusuri supaya permalink postingan ditemukan.
    ...(before ? { noindex: "follow" as const } : {}),
  });
}

export default async function CommunityPage({ searchParams }: Props) {
  const before = cursorOf((await searchParams).before);
  const session = await getSession();
  const viewer = await getCommunityViewer(session?.userId ?? null);
  const page = await getGlobalFeed(before, viewer.viewerId);

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
      <header>
        <p className="neo-kicker">
          <Users className="mr-1.5 size-3.5" aria-hidden="true" />
          KOMUNITAS
        </p>
        <h1 className="mt-4 text-4xl sm:text-6xl">Komunitas</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/70">
          Bagikan progres, pertanyaan, dan tips belajar bahasa Jepang.
        </p>
      </header>

      <FeedTabs active="all" followEnabled={FEATURES.follow} />
      {!before ? <ComposerSection viewer={viewer} nextPath="/community" /> : null}
      {viewer.isPrivateAccount && !before ? (
        <p className="text-sm font-semibold text-black/60">
          Akunmu private, jadi postinganmu tidak tampil di feed ini.
          {FEATURES.follow ? " Kamu dan follower yang disetujui melihatnya di tab Mengikuti." : ""}
        </p>
      ) : null}

      <PostFeed
        page={page}
        basePath="/community"
        currentUserId={viewer.viewerId}
        reportEnabled={FEATURES.report}
        postingSuspended={viewer.postingSuspended}
        emptyText="Belum ada postingan. Jadilah yang pertama!"
      />
    </div>
  );
}
