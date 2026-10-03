import Link from "next/link";
import { PostingSuspendedNotice } from "@/features/question-comment/components/posting-suspended-notice";
import { PostComposer } from "./post-composer";

export type CommunityViewer = {
  viewerId: number | null;
  postingSuspended: boolean;
  isPrivateAccount: boolean;
};

/** Kotak tulis postingan di atas feed, sesuai keadaan viewer. */
export function ComposerSection({ viewer, nextPath }: { viewer: CommunityViewer; nextPath: string }) {
  if (viewer.viewerId === null) {
    return (
      <section className="neo-surface flex flex-wrap items-center justify-between gap-3 bg-neo-paper p-5">
        <p className="font-semibold">Masuk untuk membuat postingan, menyukai, dan berkomentar.</p>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="neo-button bg-neo-blue text-sm">
          Masuk
        </Link>
      </section>
    );
  }

  if (viewer.postingSuspended) {
    return (
      <section className="neo-surface bg-white p-5">
        <PostingSuspendedNotice className="text-sm" />
      </section>
    );
  }

  return (
    <section className="neo-surface bg-white p-5" aria-label="Buat postingan">
      <PostComposer isPrivateAccount={viewer.isPrivateAccount} />
    </section>
  );
}
