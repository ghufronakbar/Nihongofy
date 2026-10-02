import Link from "next/link";
import { cn } from "@/lib/utils";

type DiscussionKind = "question" | "vocab" | "bunpou";

const TABS: { key: DiscussionKind; label: string; href: string }[] = [
  { key: "question", label: "Soal", href: "/discussion" },
  { key: "vocab", label: "Kosakata", href: "/flashcard/discussion" },
  { key: "bunpou", label: "Bunpou", href: "/bunpou/discussion" },
];

/**
 * Penghubung indeks diskusi: soal (/discussion), kata flashcard
 * (/flashcard/discussion), dan pola bunpou (/bunpou/discussion). Masing-masing
 * punya flag sendiri; tab yang modulnya mati tidak dirender, dan navigasi
 * hilang sama sekali bila tinggal satu jenis.
 */
export function DiscussionTabs({
  active,
  enabled,
}: {
  active: DiscussionKind;
  enabled: Record<DiscussionKind, boolean>;
}) {
  const tabs = TABS.filter((tab) => enabled[tab.key]);
  if (tabs.length < 2) return null;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Jenis diskusi">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "border-[3px] border-neo-ink px-3 py-1.5 font-mono text-xs font-black uppercase shadow-neo-sm",
            tab.key === active ? "bg-neo-ink text-white" : "bg-white text-black",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
