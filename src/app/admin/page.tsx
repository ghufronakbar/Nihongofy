import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Layers,
  MessagesSquare,
  ScrollText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminOverview } from "@/features/admin/queries";

function percent(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="neo-surface flex flex-col gap-3 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
      <div className="flex items-center gap-2.5">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-md border-2 border-neo-ink shadow-neo-sm ${accent}`}
        >
          <Icon className="size-4.5 stroke-[2.5] text-black" />
        </div>
        <span className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/60">
          {label}
        </span>
      </div>
      <p className="text-3xl font-black leading-none text-neo-ink">{value}</p>
      <p className="text-xs font-semibold text-foreground/70">{hint}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Layout sudah memanggil requireAdmin(), tetapi page bisa saja dirender di
  // luar layout ini pada refactor berikutnya. Biayanya satu cache hit.
  await requireAdmin();

  const overview = await getAdminOverview();
  const { content, explanation, discussion, people, activity, editorial } = overview;

  // Hanya hal yang benar-benar butuh tindakan operator yang muncul di sini.
  const attention: { label: string; detail: string }[] = [];
  if (explanation.missing > 0) {
    attention.push({
      label: `${explanation.missing.toLocaleString("id-ID")} soal tanpa pembahasan`,
      detail: `Baru ${percent(explanation.total, content.totalQuestions)} dari bank soal yang punya pembahasan.`,
    });
  }
  if (explanation.answerKeyDoubt > 0) {
    attention.push({
      label: `${explanation.answerKeyDoubt} kunci jawaban ditandai meragukan`,
      detail: "Generator menandainya saat pembahasan tidak masuk akal untuk kunci yang ada.",
    });
  }
  if (explanation.unreviewedAi > 0) {
    attention.push({
      label: `${explanation.unreviewedAi.toLocaleString("id-ID")} pembahasan AI belum direview`,
      detail: "Belum ada kurasi manusia; reviewedAt masih kosong.",
    });
  }
  const emptyLevels = content.levels.filter((level) => level.packageCount === 0);
  if (emptyLevels.length > 0) {
    attention.push({
      label: `Level ${emptyLevels.map((level) => level.level).join(", ")} belum punya paket`,
      detail: "Fixture bisa saja sudah ada di repository tetapi belum diimpor ke database.",
    });
  }
  if (people.pendingDeletion > 0) {
    attention.push({
      label: `${people.pendingDeletion} akun menunggu penghapusan`,
      detail: "Masih dalam grace period dan dapat dibatalkan user maupun admin.",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black uppercase text-neo-ink sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Kondisi database saat ini. Angka dibaca langsung tanpa cache.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Bank Soal"
          value={content.totalPackages.toLocaleString("id-ID")}
          hint={`${content.totalQuestions.toLocaleString("id-ID")} soal di seluruh paket`}
          accent="bg-neo-yellow"
        />
        <StatCard
          icon={ScrollText}
          label="Pembahasan"
          value={percent(explanation.total, content.totalQuestions)}
          hint={`${explanation.total.toLocaleString("id-ID")} dari ${content.totalQuestions.toLocaleString("id-ID")} soal terisi`}
          accent="bg-neo-blue"
        />
        <StatCard
          icon={MessagesSquare}
          label="Diskusi Publik"
          value={(discussion.publicRoots + discussion.replies).toLocaleString("id-ID")}
          hint={`${discussion.publicRoots} catatan dibagikan, ${discussion.replies} balasan, ${discussion.lastSevenDays} entri 7 hari terakhir`}
          accent="bg-neo-coral"
        />
        <StatCard
          icon={Users}
          label="User"
          value={people.totalUsers.toLocaleString("id-ID")}
          hint={`${people.admins} admin, ${people.unverified} belum verifikasi email`}
          accent="bg-neo-paper"
        />
        <StatCard
          icon={TrendingUp}
          label="Attempt"
          value={activity.completedAttempts.toLocaleString("id-ID")}
          hint={`selesai; ${activity.attemptsLastSevenDays} attempt dimulai 7 hari terakhir`}
          accent="bg-neo-yellow"
        />
        <StatCard
          icon={FileText}
          label="Editorial"
          value={editorial.articlesPublished.toLocaleString("id-ID")}
          hint={`artikel terbit; ${editorial.articlesDraft} draft, ${editorial.articlesArchived} arsip`}
          accent="bg-neo-blue"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Cakupan per Level
        </h2>
        <div className="neo-surface min-w-0 overflow-x-auto border-[3px] border-neo-ink bg-white shadow-neo">
          <table className="w-full min-w-md border-collapse text-sm">
            <thead>
              <tr className="border-b-[3px] border-neo-ink bg-neo-paper text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Level</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Paket</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Soal</th>
                <th className="px-4 py-3 font-mono text-[10px] font-black uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {content.levels.map((level) => (
                <tr key={level.level} className="border-b-2 border-neo-ink/15 last:border-b-0">
                  <td className="px-4 py-3 font-black">{level.level}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {level.packageCount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {level.questionCount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center border-2 border-neo-ink px-2 py-0.5 font-mono text-[10px] font-black uppercase shadow-neo-sm ${
                        level.packageCount === 0 ? "bg-neo-coral text-white" : "bg-neo-paper"
                      }`}
                    >
                      {level.packageCount === 0 ? "Kosong" : "Terisi"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Perlu Perhatian
        </h2>
        {attention.length === 0 ? (
          <div className="neo-surface border-[3px] border-neo-ink bg-white p-5 text-sm font-semibold text-foreground/70 shadow-neo">
            Tidak ada yang menunggu tindakan.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {attention.map((item) => (
              <li
                key={item.label}
                className="neo-surface flex items-start gap-3 border-[3px] border-neo-ink bg-white p-4 shadow-neo"
              >
                <AlertTriangle className="mt-0.5 size-4.5 shrink-0 stroke-[2.5] text-neo-coral" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-neo-ink">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground/70">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs font-black uppercase tracking-wider text-foreground/60">
          Katalog Deck Bawaan
        </h2>
        <div className="neo-surface flex flex-wrap items-center gap-4 border-[3px] border-neo-ink bg-white p-5 shadow-neo">
          <Layers className="size-5 shrink-0 stroke-[2.5] text-neo-ink" />
          <p className="text-sm font-semibold text-foreground/80">
            {editorial.systemDecksPublished} deck tampil untuk user,{" "}
            {editorial.systemDecksHidden} disembunyikan.
          </p>
          <Link
            href="/admin/flashcard-deck"
            className="neo-button ml-auto bg-white text-xs font-extrabold text-black"
          >
            Kelola
          </Link>
        </div>
      </section>
    </div>
  );
}
