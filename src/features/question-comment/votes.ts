/**
 * Aturan upvote "membantu" dan urutan thread. Murni dan aman untuk client —
 * dipakai action (eligibility) dan komponen thread (urutan).
 */

export type DiscussionSort = "newest" | "helpful";

export const DISCUSSION_SORT_LABELS: Record<DiscussionSort, string> = {
  newest: "Terbaru",
  helpful: "Paling membantu",
};

/** Keadaan entri yang hendak diberi suara, beserta root thread-nya. */
export type VoteTarget = {
  authorId: number;
  deletedAt: Date | null;
  /** Root thread; untuk root sendiri isinya sama dengan entri itu. */
  root: { visibility: "PRIVATE" | "PUBLIC"; sharedAt: Date | null; deletedAt: Date | null };
};

/**
 * Alasan suara ditolak, atau null bila boleh.
 *
 * - `own`: catatan sendiri.
 * - `unavailable`: entri dihapus, catatan privat, atau thread yang root-nya
 *   sudah menjadi tombstone (dihapus/disembunyikan). Thread mati adalah arsip
 *   read-only — sama seperti balasan baru, suara baru juga ditolak di sana.
 */
export function voteRejection(target: VoteTarget, viewerId: number): "own" | "unavailable" | null {
  const rootVisible =
    target.root.visibility === "PUBLIC" &&
    target.root.sharedAt !== null &&
    target.root.deletedAt === null;
  if (target.deletedAt !== null || !rootVisible) return "unavailable";
  if (target.authorId === viewerId) return "own";
  return null;
}

type SortableRoot = { voteCount: number; createdAt: Date };

/**
 * "Terbaru" mempertahankan urutan query (root terbaru dulu). "Paling membantu"
 * mengurutkan root menurut jumlah suara, seri dipecah dengan yang terbaru.
 * Balasan tidak diurutkan ulang: urutan waktunya adalah konteks percakapan dan
 * mention.
 */
export function sortDiscussionRoots<T extends SortableRoot>(roots: T[], sort: DiscussionSort): T[] {
  if (sort === "newest") return roots;
  return [...roots].sort(
    (a, b) => b.voteCount - a.voteCount || b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
