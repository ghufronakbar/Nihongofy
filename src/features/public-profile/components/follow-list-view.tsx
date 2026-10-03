import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { canViewProfileContent } from "../access";
import { getViewerFollowStatus, listFollows } from "../follow-queries";
import { resolveProfileParam } from "../queries";
import { FollowCursorSchema } from "../schemas";
import { RemoveFollowerButton } from "./follow-manage-buttons";
import { FollowUserList } from "./follow-user-list";

type Direction = "followers" | "following";

const TABS: { direction: Direction; label: string }[] = [
  { direction: "followers", label: "Follower" },
  { direction: "following", label: "Mengikuti" },
];

/**
 * `/u/[username]/followers` dan `/following`. Aturan aksesnya sama dengan isi
 * profil: daftar akun private hanya untuk pemilik dan follower yang disetujui.
 * Hanya baris ACCEPTED yang tampil; permintaan PENDING ada di
 * /profile/follow-requests milik pemiliknya.
 */
export async function FollowListView({
  username,
  after,
  direction,
}: {
  username: string;
  after: string | string[] | undefined;
  direction: Direction;
}) {
  if (!FEATURES.follow) notFound();

  const resolved = await resolveProfileParam(username);
  if (resolved.kind === "redirect") permanentRedirect(`/u/${resolved.username}/${direction}`);
  if (resolved.kind === "missing") notFound();

  const { owner } = resolved;
  const session = await getSession();
  const viewerId = session?.userId ?? null;
  const viewerStatus = await getViewerFollowStatus(viewerId, owner.id);
  const canView = canViewProfileContent(owner, viewerId, viewerStatus);
  const isOwner = viewerId === owner.id;

  const cursor = FollowCursorSchema.parse(typeof after === "string" ? after : undefined);
  const page = canView
    ? await listFollows({ userId: owner.id, direction, status: "ACCEPTED", after: cursor || null })
    : null;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 px-4 py-10">
      <Link
        href={`/u/${owner.username}`}
        className="inline-flex w-fit items-center gap-2 font-bold underline decoration-2 underline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {owner.displayName}
      </Link>
      <header>
        <h1 className="text-4xl break-words sm:text-5xl">
          {direction === "followers" ? "Follower" : "Diikuti"} @{owner.username}
        </h1>
      </header>

      <nav aria-label="Daftar follow" className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.direction}
            href={`/u/${owner.username}/${tab.direction}`}
            aria-current={tab.direction === direction ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center border-[3px] border-black px-4 py-2 text-sm font-black shadow-neo-sm",
              tab.direction === direction ? "bg-neo-yellow" : "bg-white",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {page ? (
        <>
          <FollowUserList
            users={page.users}
            emptyText={
              direction === "followers"
                ? `Belum ada yang mengikuti @${owner.username}.`
                : `@${owner.username} belum mengikuti siapa pun.`
            }
            action={
              isOwner && direction === "followers"
                ? (user) => <RemoveFollowerButton followerId={user.id} username={user.username} />
                : undefined
            }
          />
          {page.nextCursor !== null ? (
            <Link
              href={`/u/${owner.username}/${direction}?after=${page.nextCursor}`}
              className="neo-button w-fit bg-white text-sm"
            >
              Muat berikutnya
            </Link>
          ) : null}
        </>
      ) : (
        <section className="neo-surface grid justify-items-center gap-3 bg-white p-8 text-center">
          <LockKeyhole className="size-8" aria-hidden="true" />
          <h2 className="text-2xl">Akun ini private</h2>
          <p className="max-w-md font-semibold text-black/65">
            Daftar follow @{owner.username} hanya terlihat oleh pemiliknya dan follower yang disetujui.
          </p>
        </section>
      )}
    </div>
  );
}
