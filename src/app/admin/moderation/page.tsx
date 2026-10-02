import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ImageIcon, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import {
  getModerationUserSummary,
  listModerationQueue,
} from "@/features/admin/moderation/queries";
import {
  ModerationQuerySchema,
  ModerationStateFilterSchema,
} from "@/features/admin/moderation/schemas";
import { ModerationActions } from "@/features/admin/moderation/components/moderation-actions";
import { mondaiTypeFullLabel } from "@/constants/jlpt";
import { discussionThreadHref } from "@/features/question-comment/target";

export const metadata: Metadata = { title: "Moderasi - Admin" };

const STATE_TABS = [
  { value: "live", label: "Aktif" },
  { value: "removed", label: "Sudah dihapus" },
  { value: "all", label: "Semua" },
] as const;

const STATE_BADGE: Record<string, { label: string; className: string }> = {
  VISIBLE: { label: "Tampil", className: "bg-neo-paper" },
  HIDDEN: { label: "Disembunyikan", className: "bg-white" },
  REMOVED_BY_OWNER: { label: "Dihapus pemilik", className: "bg-white" },
  TAKEN_DOWN: { label: "Takedown admin", className: "bg-neo-coral text-white" },
};

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string; user?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const parsedState = ModerationStateFilterSchema.safeParse(params.state);
  const userIdRaw = Number(params.user);
  const filter = ModerationQuerySchema.parse({
    state: parsedState.success ? parsedState.data : "live",
    query: (params.q ?? "").trim(),
    userId: Number.isInteger(userIdRaw) && userIdRaw > 0 ? userIdRaw : undefined,
  });

  const [{ entries, counts, truncated }, userSummary] = await Promise.all([
    listModerationQueue(filter),
    filter.userId ? getModerationUserSummary(filter.userId) : Promise.resolve(null),
  ]);

  function hrefFor(state: string) {
    const search = new URLSearchParams();
    search.set("state", state);
    if (filter.query) search.set("q", filter.query);
    if (filter.userId) search.set("user", String(filter.userId));
    return `/admin/moderation?${search.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Moderasi</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {counts.all} entri pernah dibagikan · {counts.live} aktif · {counts.removed} dihapus
        </p>
      </div>

      {[
        { off: !FEATURES.questionDiscussion, label: "Diskusi soal", env: "FEATURES_QUESTION_DISCUSSION" },
        {
          off: !FEATURES.flashcardDiscussion,
          label: "Diskusi kata flashcard",
          env: "FEATURES_FLASHCARD_DISCUSSION",
        },
      ]
        .filter((surface) => surface.off)
        .map((surface) => (
          <p
            key={surface.env}
            className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm"
          >
            {surface.label} sedang nonaktif ({surface.env}=false). Kontennya tidak terlihat
            pengunjung saat ini, tetapi datanya tetap ada dan dapat dimoderasi.
          </p>
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefFor(tab.value)}
              className={`inline-flex items-center border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                filter.state === tab.value ? "bg-neo-ink text-white" : "bg-white text-black"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form action="/admin/moderation" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="state" value={filter.state} />
          <input
            type="search"
            name="q"
            defaultValue={filter.query}
            placeholder="Cari isi atau nama penulis"
            className="h-9 w-60 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
          />
          <button
            type="submit"
            aria-label="Cari entri"
            className="neo-button bg-white text-xs font-extrabold text-black"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      {userSummary && (
        <div className="neo-surface flex flex-wrap items-center gap-x-6 gap-y-2 border-[3px] border-neo-ink bg-neo-paper p-4 shadow-neo">
          <div>
            <p className="text-sm font-black text-neo-ink">
              {userSummary.user.displayName}
              {userSummary.user.role === "ADMIN" && (
                <span className="ml-2 inline-flex items-center border-2 border-neo-ink bg-neo-coral px-1.5 py-0 font-mono text-[10px] font-black uppercase text-white">
                  admin
                </span>
              )}
            </p>
            <p className="font-mono text-[11px] text-foreground/60">
              #{userSummary.user.id} · {userSummary.user.email ?? "tanpa email"} · bergabung{" "}
              {userSummary.user.createdAt.toISOString().slice(0, 10)}
            </p>
          </div>
          <p className="text-xs font-bold text-foreground/70">
            {userSummary.roots} catatan dibagikan · {userSummary.replies} balasan ·{" "}
            {userSummary.takenDown} kena takedown
          </p>
          <Link
            href={hrefFor(filter.state)}
            className="ml-auto font-mono text-xs font-black underline underline-offset-4"
          >
            Hapus filter
          </Link>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada entri yang cocok.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => {
            const badge = STATE_BADGE[entry.state];
            return (
              <li
                key={entry.id}
                className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center border-2 border-neo-ink bg-white px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm">
                    {entry.kind === "root" ? "Catatan" : "Balasan"}
                  </span>
                  <span
                    className={`inline-flex items-center border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <Link
                    href={`/admin/moderation?state=${filter.state}&user=${entry.user.id}`}
                    className="text-xs font-black text-neo-ink underline-offset-4 hover:underline"
                  >
                    {entry.user.displayName}
                  </Link>
                  <span className="font-mono text-[11px] text-foreground/50">
                    #{entry.user.id}
                  </span>
                  <span className="ml-auto font-mono text-[11px] font-bold text-foreground/50">
                    {entry.sharedAt?.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>

                <p className="text-sm font-semibold whitespace-pre-wrap text-foreground/85">
                  {entry.commentText}
                </p>

                {entry.commentImages.length > 0 && (
                  <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-foreground/60">
                    <ImageIcon className="size-3.5" />
                    {entry.commentImages.length} lampiran gambar — file di storage tidak ikut
                    terhapus saat takedown
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t-2 border-neo-ink/15 pt-3">
                  <span className="font-mono text-[11px] font-bold text-foreground/60">
                    {entry.question ? (
                      <>
                        {entry.question.testPackageItem.testPackage.jlptLevel} ·{" "}
                        {entry.question.testPackageItem.testPackage.name} ·{" "}
                        {mondaiTypeFullLabel(entry.question.testPackageItem.mondaiType)} · soal{" "}
                        {entry.question.order}
                      </>
                    ) : entry.vocab ? (
                      <>
                        Flashcard · {entry.vocab.level} ·{" "}
                        <span lang="ja" className="font-japanese">
                          {entry.vocab.wordPlain}
                          {entry.vocab.reading !== entry.vocab.wordPlain
                            ? ` (${entry.vocab.reading})`
                            : ""}
                        </span>
                      </>
                    ) : entry.bunpouPoint ? (
                      <>
                        Bunpou · {entry.bunpouPoint.level} ·{" "}
                        <span lang="ja" className="font-japanese">
                          {entry.bunpouPoint.titlePlain}
                        </span>{" "}
                        · {entry.bunpouPoint.key}
                      </>
                    ) : null}
                  </span>
                  <Link
                    href={discussionThreadHref(
                      {
                        id: entry.parentId ?? entry.id,
                        questionId: entry.questionId,
                        vocabId: entry.vocabId,
                        bunpouPointId: entry.bunpouPointId,
                      },
                      entry.id,
                    )}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
                  >
                    <ExternalLink className="size-3" />
                    Lihat thread
                  </Link>
                  {entry.deletedBy && (
                    <span className="font-mono text-[11px] font-bold text-foreground/50">
                      dihapus oleh {entry.deletedBy.displayName}
                    </span>
                  )}
                  <div className="ml-auto">
                    <ModerationActions
                      commentId={entry.id}
                      kind={entry.kind}
                      state={entry.state}
                      canRestore={entry.canRestore}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {truncated && (
        <p className="text-xs font-semibold text-foreground/60">
          Menampilkan 100 entri terbaru. Persempit dengan pencarian atau filter user — pagination
          belum ada.
        </p>
      )}
    </div>
  );
}
