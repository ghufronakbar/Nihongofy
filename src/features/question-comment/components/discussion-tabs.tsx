import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Penghubung dua indeks diskusi: soal (/discussion) dan kata flashcard
 * (/flashcard/discussion). Keduanya punya flag sendiri, jadi tab hanya tampil
 * bila keduanya hidup — tautan ke modul yang mati tidak boleh dirender.
 */
export function DiscussionTabs({
  active,
  questionEnabled,
  vocabEnabled,
}: {
  active: "question" | "vocab";
  questionEnabled: boolean;
  vocabEnabled: boolean;
}) {
  if (!questionEnabled || !vocabEnabled) return null;

  const tabs = [
    { key: "question" as const, label: "Soal", href: "/discussion" },
    { key: "vocab" as const, label: "Kosakata", href: "/flashcard/discussion" },
  ];

  return (
    <nav className="flex gap-2" aria-label="Jenis diskusi">
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
