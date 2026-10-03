import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { FEATURES } from "@/constants";
import { FollowRequestActions } from "@/features/public-profile/components/follow-manage-buttons";
import { FollowUserList } from "@/features/public-profile/components/follow-user-list";
import { listFollows } from "@/features/public-profile/follow-queries";
import { FollowCursorSchema } from "@/features/public-profile/schemas";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Permintaan Follow",
  description: "Setujui atau tolak permintaan mengikuti akunmu.",
};

export default async function FollowRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  if (!FEATURES.follow) notFound();

  const session = await getSession();
  if (!session) redirect("/login?next=/profile/follow-requests");

  const { after } = await searchParams;
  const cursor = FollowCursorSchema.parse(typeof after === "string" ? after : undefined);
  const page = await listFollows({
    userId: session.userId,
    direction: "followers",
    status: "PENDING",
    after: cursor || null,
  });

  return (
    <main className="grid max-w-4xl grid-cols-1 gap-6">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">PROFILE / FOLLOW</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Permintaan follow</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Akun yang ingin mengikutimu. Setelah disetujui, mereka dapat melihat isi profilmu walaupun
          akunmu private.
        </p>
      </header>

      <FollowUserList
        users={page.users}
        emptyText="Tidak ada permintaan follow yang menunggu."
        action={(user) => <FollowRequestActions followerId={user.id} username={user.username} />}
      />

      {page.nextCursor !== null ? (
        <Link href={`/profile/follow-requests?after=${page.nextCursor}`} className="neo-button w-fit bg-white text-sm">
          Muat berikutnya
        </Link>
      ) : null}

      <p className="flex items-start gap-2 text-sm font-semibold text-foreground/65">
        <UserPlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Permintaan hanya datang ke akun private. Menjadikan akunmu public di Privasi &amp; Data akan
        menyetujui semua permintaan yang masih menunggu.
      </p>
    </main>
  );
}
