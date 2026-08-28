import Link from "next/link";
import type { JlptSection, MondaiType } from "@prisma/client";
import { JLPT_SECTION_LABELS, MONDAI_TYPE_LABELS, mondaiTypeFullLabel } from "@/constants/jlpt";
import { cn } from "@/lib/utils";

export type NavMondaiItem = {
  id: number;
  mondaiType: MondaiType;
  section: JlptSection;
  totalCount: number;
  // Omitted outside attempt review (e.g. mode-baca), where there's no
  // right/wrong to tally yet.
  correctCount?: number;
};

// Pure Server Component (just <Link>s) — reused by both the desktop sticky
// sidebar and the mobile Sheet content (question-nav-mobile.tsx), and by both
// /result/[attemptId]/detail (attempt review) and /test-package/[id]/questions
// (mode baca).
export function QuestionNavList({
  items,
  activeId,
  buildHref,
}: {
  items: NavMondaiItem[];
  activeId: number;
  buildHref: (itemId: number) => string;
}) {
  const grouped = new Map<JlptSection, NavMondaiItem[]>();
  for (const item of items) {
    const list = grouped.get(item.section) ?? [];
    list.push(item);
    grouped.set(item.section, list);
  }

  return (
    <nav className="flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([section, sectionItems]) => (
        <div key={section}>
          <p className="mb-2 px-1 font-mono text-[11px] font-black uppercase text-foreground/70">
            {JLPT_SECTION_LABELS[section]}
          </p>
          <div className="flex flex-col gap-1">
            {sectionItems.map((item) => {
              const isActive = item.id === activeId;
              return (
                <Link
                  key={item.id}
                  href={buildHref(item.id)}
                  title={mondaiTypeFullLabel(item.mondaiType)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border-2 px-2.5 py-1.5 text-xs font-bold transition-all",
                    isActive
                      ? "border-neo-ink bg-neo-blue text-white shadow-neo-sm"
                      : "border-transparent text-foreground hover:border-neo-ink hover:bg-neo-paper",
                  )}
                >
                  <span className="truncate">{MONDAI_TYPE_LABELS[item.mondaiType]}</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border",
                      isActive
                        ? "border-white/40 bg-white/20 text-white font-black"
                        : "border-neo-ink/20 bg-neo-paper text-foreground/70 font-semibold",
                    )}
                  >
                    {item.correctCount !== undefined
                      ? `${item.correctCount}/${item.totalCount}`
                      : `${item.totalCount} Q`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function QuestionNavSidebar(props: {
  items: NavMondaiItem[];
  activeId: number;
  buildHref: (itemId: number) => string;
}) {
  return (
    <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-60 shrink-0 self-start overflow-y-auto rounded-lg border-[3px] border-neo-ink bg-white p-3.5 shadow-neo lg:block">
      <div className="border-b-2 border-neo-ink pb-2 mb-3">
        <span className="font-mono text-xs font-black uppercase text-neo-ink">
          DAFTAR MONDAI
        </span>
      </div>
      <QuestionNavList {...props} />
    </aside>
  );
}
