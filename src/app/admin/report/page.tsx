import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownUp, ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { FEATURES } from "@/constants";
import { listReportQueue } from "@/features/admin/report/queries";
import {
  ReportQuerySchema,
  ReportSortSchema,
  ReportStateFilterSchema,
} from "@/features/admin/report/schemas";
import { BunpouReportPanel } from "@/features/admin/report/components/bunpou-report-panel";
import { FlashcardReportPanel } from "@/features/admin/report/components/flashcard-report-panel";
import { ReportActions } from "@/features/admin/report/components/report-actions";
import { ReportReplyForm } from "@/features/admin/report/components/report-reply-form";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPES,
  REPORT_TARGET_TYPE_LABELS,
  isReportCategoryAllowed,
  reportCategoriesFor,
  type ReportCategoryValue,
  type ReportStatusValue,
  type ReportTargetTypeValue,
} from "@/features/report/constants";

export const metadata: Metadata = { title: "Laporan - Admin" };

const STATE_TABS = [
  { value: "open", label: "Belum selesai" },
  { value: "done", label: "Sudah ditutup" },
  { value: "all", label: "Semua" },
] as const;

const STATUS_BADGE: Record<ReportStatusValue, string> = {
  OPEN: "bg-neo-yellow text-black",
  IN_REVIEW: "bg-neo-blue text-black",
  RESOLVED: "bg-neo-green text-black",
  REJECTED: "bg-neo-coral text-white",
  DUPLICATE: "bg-white text-black",
};

function isTargetType(value: string | undefined): value is ReportTargetTypeValue {
  return value !== undefined && (REPORT_TARGET_TYPES as readonly string[]).includes(value);
}

function isCategory(value: string | undefined): value is ReportCategoryValue {
  return value !== undefined && (REPORT_CATEGORIES as readonly string[]).includes(value);
}

function formatTimestamp(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    target?: string;
    category?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const parsedState = ReportStateFilterSchema.safeParse(params.state);
  const parsedSort = ReportSortSchema.safeParse(params.sort);
  const parsedPage = Number(params.page);
  const targetType = isTargetType(params.target) ? params.target : undefined;
  const filter = ReportQuerySchema.parse({
    state: parsedState.success ? parsedState.data : "open",
    targetType,
    // Kombinasi yang mustahil (mis. kategori bacaan pada target soal) dibuang,
    // bukan dibiarkan menghasilkan daftar kosong yang tampak seperti tidak ada
    // laporan.
    category:
      isCategory(params.category) &&
      (!targetType || isReportCategoryAllowed(targetType, params.category))
        ? params.category
        : undefined,
    query: (params.q ?? "").trim(),
    sort: parsedSort.success ? parsedSort.data : "newest",
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  });

  const { entries, counts, pagination } = await listReportQueue(filter);

  function hrefFor(
    next: Partial<{
      state: string;
      target: ReportTargetTypeValue | null;
      category: ReportCategoryValue | null;
      sort: typeof filter.sort;
      page: number;
    }>,
  ) {
    const search = new URLSearchParams();
    search.set("state", next.state ?? filter.state);
    const target = next.target === null ? undefined : (next.target ?? filter.targetType);
    let category = next.category === null ? undefined : (next.category ?? filter.category);
    // Berpindah target membuang kategori yang tidak berlaku untuk target barunya.
    if (target && category && !isReportCategoryAllowed(target, category)) category = undefined;
    if (target) search.set("target", target);
    if (category) search.set("category", category);
    if (filter.query) search.set("q", filter.query);
    const sort = next.sort ?? filter.sort;
    if (sort !== "newest") search.set("sort", sort);
    const page = next.page ?? 1;
    if (page > 1) search.set("page", String(page));
    return `/admin/report?${search.toString()}`;
  }

  // Dengan target terpilih, hanya kategori yang berlaku untuk target itu yang
  // ditawarkan: peta yang sama dengan form laporan dan `SubmitReportSchema`.
  const categoryOptions = filter.targetType
    ? reportCategoriesFor(filter.targetType)
    : REPORT_CATEGORIES;

  // Laporan kartu lama tetap ditindak dari sini walau modul flashcard dimatikan;
  // yang berhenti hanya laporan baru, karena seluruh /flashcard menjadi 404.
  const flashcardOff =
    !FEATURES.flashcard &&
    (filter.targetType === "FLASHCARD_VOCAB" ||
      entries.some((entry) => entry.targetType === "FLASHCARD_VOCAB"));

  const isBunpouTarget = (targetType: string | undefined) =>
    targetType === "BUNPOU_POINT" || targetType === "BUNPOU_COMPARISON";
  const bunpouOff =
    !FEATURES.bunpou &&
    (isBunpouTarget(filter.targetType) || entries.some((entry) => isBunpouTarget(entry.targetType)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Laporan</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {counts.all} laporan masuk · {counts.open} belum selesai · {counts.done} ditutup
        </p>
      </div>

      {!FEATURES.report && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Form laporan sedang nonaktif (FEATURES_REPORT=false). Tidak ada laporan baru yang dapat
          masuk, tetapi yang sudah ada tetap dapat ditindak dari sini.
        </p>
      )}

      {flashcardOff && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul flashcard sedang nonaktif (FEATURES_FLASHCARD=false). Tidak ada laporan kartu baru
          yang dapat masuk, tetapi laporan kartu yang sudah ada tetap dapat ditindak dari sini.
        </p>
      )}

      {bunpouOff && (
        <p className="border-[3px] border-neo-ink bg-neo-yellow px-4 py-2.5 text-sm font-bold text-black shadow-neo-sm">
          Modul bunpou sedang nonaktif (FEATURES_BUNPOU=false). Tidak ada laporan pola baru yang
          dapat masuk, tetapi laporan yang sudah ada tetap dapat ditindak dari sini.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefFor({ state: tab.value })}
              className={`inline-flex items-center border-2 border-neo-ink px-3 py-1 font-mono text-xs font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] ${
                filter.state === tab.value ? "bg-neo-ink text-white" : "bg-white text-black"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form action="/admin/report" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="state" value={filter.state} />
          {filter.targetType && <input type="hidden" name="target" value={filter.targetType} />}
          {filter.category && <input type="hidden" name="category" value={filter.category} />}
          {filter.sort !== "newest" && <input type="hidden" name="sort" value={filter.sort} />}
          <input
            type="search"
            name="q"
            defaultValue={filter.query}
            placeholder="Cari isi laporan atau target"
            className="h-9 w-60 border-2 border-neo-ink bg-white px-3 text-sm font-semibold shadow-neo-sm outline-none focus:bg-neo-paper"
          />
          <button
            type="submit"
            aria-label="Cari laporan"
            className="neo-button bg-white text-xs font-extrabold text-black"
          >
            <Search className="size-4" />
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-bold text-foreground/60">
          {pagination.totalItems === 0
            ? "0 laporan"
            : `${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                pagination.page * pagination.pageSize,
                pagination.totalItems,
              )} dari ${pagination.totalItems} laporan`}
        </p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Urutkan laporan">
          <ArrowDownUp className="mr-1 size-3.5 text-foreground/60" aria-hidden="true" />
          {(
            [
              { value: "newest", label: "Terbaru" },
              { value: "oldest", label: "Terlama" },
            ] as const
          ).map((option) => (
            <Link
              key={option.value}
              href={hrefFor({ sort: option.value })}
              aria-current={filter.sort === option.value ? "page" : undefined}
              className={`border-2 border-neo-ink px-2.5 py-1 font-mono text-[10px] font-black uppercase shadow-neo-sm transition-transform active:translate-x-px active:translate-y-px ${
                filter.sort === option.value ? "bg-neo-ink text-white" : "bg-white text-black"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-[3px] border-neo-ink bg-neo-paper p-3 shadow-neo-sm">
        <span className="font-mono text-[10px] font-black uppercase text-foreground/60">
          Target
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={hrefFor({ target: null })}
            className={`border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
              filter.targetType ? "bg-white" : "bg-neo-ink text-white"
            }`}
          >
            Semua
          </Link>
          {REPORT_TARGET_TYPES.map((targetType) => (
            <Link
              key={targetType}
              href={hrefFor({ target: targetType })}
              className={`border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
                filter.targetType === targetType ? "bg-neo-ink text-white" : "bg-white"
              }`}
            >
              {REPORT_TARGET_TYPE_LABELS[targetType]}
            </Link>
          ))}
        </div>

        <span className="font-mono text-[10px] font-black uppercase text-foreground/60">
          Kategori
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={hrefFor({ category: null })}
            className={`border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
              filter.category ? "bg-white" : "bg-neo-ink text-white"
            }`}
          >
            Semua
          </Link>
          {categoryOptions.map((category) => (
            <Link
              key={category}
              href={hrefFor({ category })}
              className={`border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
                filter.category === category ? "bg-neo-ink text-white" : "bg-white"
              }`}
            >
              {REPORT_CATEGORY_LABELS[category]}
            </Link>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="neo-surface border-[3px] border-neo-ink bg-white p-6 text-sm font-semibold text-foreground/70 shadow-neo">
          Tidak ada laporan yang cocok.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm ${STATUS_BADGE[entry.status]}`}
                >
                  {REPORT_STATUS_LABELS[entry.status]}
                </span>
                <span className="inline-flex items-center border-2 border-neo-ink bg-white px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm">
                  {REPORT_TARGET_TYPE_LABELS[entry.targetType]}
                </span>
                <span className="inline-flex items-center border-2 border-neo-ink bg-neo-paper px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm">
                  {REPORT_CATEGORY_LABELS[entry.category]}
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground/60">
                  #{entry.id}
                </span>
                {entry.reporter ? (
                  <Link
                    href={`/admin/user/${entry.reporter.id}`}
                    className="text-xs font-black text-neo-ink underline-offset-4 hover:underline"
                  >
                    {entry.reporter.displayName}
                  </Link>
                ) : (
                  <span className="text-xs font-bold text-foreground/60">
                    Tanpa akun (guest)
                  </span>
                )}
                <span className="ml-auto font-mono text-[11px] font-bold text-foreground/50">
                  {formatTimestamp(entry.createdAt)}
                </span>
              </div>

              <p className="text-sm font-semibold whitespace-pre-wrap text-foreground/85">
                {entry.message}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t-2 border-neo-ink/15 pt-3">
                <span className="font-mono text-[11px] font-bold text-foreground/60">
                  {entry.targetLabel ?? "Tanpa target"}
                </span>
                {entry.targetHref && (
                  <Link
                    href={entry.targetHref}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-foreground/60 hover:text-neo-blue"
                  >
                    <ExternalLink className="size-3" />
                    Buka target
                  </Link>
                )}
                {entry.targetMissing && (
                  <span className="font-mono text-[11px] font-bold text-neo-coral">
                    target sudah dihapus
                  </span>
                )}
                {entry.otherOpenOnTarget > 0 && (
                  <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                    +{entry.otherOpenOnTarget} laporan lain di target ini
                  </span>
                )}
                {entry.pagePath && (
                  <span className="font-mono text-[11px] font-bold text-foreground/50">
                    dari {entry.pagePath}
                  </span>
                )}
              </div>

              {entry.flashcard && (
                <FlashcardReportPanel category={entry.category} flashcard={entry.flashcard} />
              )}

              {entry.bunpou && <BunpouReportPanel category={entry.category} bunpou={entry.bunpou} />}

              {(entry.adminNote || entry.handledBy || entry.repliedAt) && (
                <div className="flex flex-col gap-1 border-2 border-neo-ink/15 bg-neo-paper p-2.5">
                  {entry.handledBy && (
                    <p className="font-mono text-[11px] font-bold text-foreground/60">
                      ditangani {entry.handledBy.displayName}
                      {entry.handledAt ? ` · ${formatTimestamp(entry.handledAt)}` : ""}
                    </p>
                  )}
                  {entry.adminNote && (
                    <p className="text-xs font-semibold whitespace-pre-wrap text-foreground/80">
                      {entry.adminNote}
                    </p>
                  )}
                  {entry.repliedAt && (
                    <p className="font-mono text-[11px] font-bold text-foreground/60">
                      dibalas {entry.repliedBy?.displayName ?? "admin"} ·{" "}
                      {formatTimestamp(entry.repliedAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t-2 border-neo-ink/15 pt-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  {entry.canReply ? (
                    <ReportReplyForm reportId={entry.id} />
                  ) : entry.repliedAt ? (
                    <span className="font-mono text-[11px] font-bold text-foreground/50">
                      sudah dibalas sekali — tidak ada balasan kedua
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] font-bold text-foreground/50">
                      pelapor tidak meninggalkan email
                    </span>
                  )}
                </div>
                <div className="sm:w-80">
                  <ReportActions
                    reportId={entry.id}
                    status={entry.status}
                    adminNote={entry.adminNote}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 && (
        <nav
          aria-label="Pagination laporan"
          className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-neo-ink bg-neo-paper p-3 shadow-neo-sm"
        >
          <Link
            href={hrefFor({ page: Math.max(1, pagination.page - 1) })}
            aria-disabled={pagination.page === 1}
            tabIndex={pagination.page === 1 ? -1 : undefined}
            className={`inline-flex items-center gap-1 border-2 border-neo-ink px-3 py-1.5 font-mono text-xs font-black uppercase shadow-neo-sm ${
              pagination.page === 1
                ? "pointer-events-none bg-neo-paper text-foreground/35 shadow-none"
                : "bg-white text-black active:translate-x-px active:translate-y-px"
            }`}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Sebelumnya
          </Link>
          <span className="font-mono text-xs font-black uppercase text-neo-ink">
            Halaman {pagination.page} / {pagination.totalPages}
          </span>
          <Link
            href={hrefFor({ page: Math.min(pagination.totalPages, pagination.page + 1) })}
            aria-disabled={pagination.page === pagination.totalPages}
            tabIndex={pagination.page === pagination.totalPages ? -1 : undefined}
            className={`inline-flex items-center gap-1 border-2 border-neo-ink px-3 py-1.5 font-mono text-xs font-black uppercase shadow-neo-sm ${
              pagination.page === pagination.totalPages
                ? "pointer-events-none bg-neo-paper text-foreground/35 shadow-none"
                : "bg-white text-black active:translate-x-px active:translate-y-px"
            }`}
          >
            Berikutnya
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </nav>
      )}
    </div>
  );
}
