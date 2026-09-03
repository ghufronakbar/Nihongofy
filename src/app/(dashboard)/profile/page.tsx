import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarDays,
  ChartNoAxesCombined,
  Languages,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getProfileAccountAction,
  getProfileOverviewAction,
} from "@/features/profile/actions";
import { formatInTimeZone } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Profil Belajar",
  description: "Ringkasan akun dan aktivitas belajar JLPT.",
};

const QUICK_ACTIONS = [
  { href: "/kana/hiragana", label: "Latih kana", note: "Hiragana dan Katakana", icon: Languages, color: "bg-neo-blue" },
  { href: "/vocab", label: "Buka vocabulary", note: "Lanjutkan antrean SRS", icon: Brain, color: "bg-neo-coral" },
  { href: "/exercises", label: "Latihan cepat", note: "Feedback per soal", icon: Sparkles, color: "bg-neo-yellow" },
  { href: "/analytics", label: "Lihat analytics", note: "Pola hasil mock test", icon: ChartNoAxesCombined, color: "bg-neo-green" },
];

export default async function ProfilePage() {
  const [account, overview] = await Promise.all([
    getProfileAccountAction(),
    getProfileOverviewAction(),
  ]);
  const firstName = account.displayName.split(/\s+/)[0] ?? account.displayName;
  const initials = account.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const memberSince = formatInTimeZone(account.createdAt, account.timeZone, {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="grid gap-8">
      <section className="neo-surface relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 h-full w-24 border-l-[3px] border-black bg-neo-yellow sm:w-40" aria-hidden="true" />
        <div className="relative grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
          <Avatar className="size-24 rounded-lg border-[3px] border-black bg-neo-blue shadow-neo sm:size-28">
            {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={`Avatar ${account.displayName}`} className="rounded-md" /> : null}
            <AvatarFallback className="rounded-md bg-neo-blue text-3xl font-black text-black">{initials}</AvatarFallback>
          </Avatar>
          <div className="max-w-2xl pr-16 sm:pr-32">
            <p className="font-mono text-xs font-black tracking-[0.16em] uppercase">Member sejak {memberSince}</p>
            <h1 className="mt-2 text-4xl leading-none sm:text-6xl">Halo, {firstName}.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Ini ringkasan nyata dari aktivitas akunmu—tanpa angka random dari reference UI.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-black tracking-widest uppercase">REAL DATA</p>
            <h2 id="activity-heading" className="mt-1 text-3xl sm:text-4xl">Aktivitas belajar</h2>
          </div>
          <Link href="/profile/info" className="font-bold underline decoration-2 underline-offset-4">Edit akun</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-12">
          <article className="neo-surface bg-neo-blue p-6 md:col-span-5 md:row-span-2">
            <Languages className="size-10" aria-hidden="true" />
            <p className="mt-10 font-mono text-xs font-black tracking-widest uppercase">Kana pernah benar</p>
            <p className="mt-2 text-6xl font-black tabular-nums">{overview.kanaLearned}</p>
            <p className="mt-3 max-w-xs text-sm font-semibold text-black/65">Karakter unik yang sudah mendapat minimal satu rating benar.</p>
          </article>
          <article className="neo-surface bg-white p-5 md:col-span-4">
            <Brain className="size-8 text-neo-coral" aria-hidden="true" />
            <p className="mt-5 text-4xl font-black tabular-nums">{overview.vocabularyStarted}</p>
            <p className="font-bold text-muted-foreground">Vocabulary dimulai</p>
          </article>
          <article className="neo-surface bg-neo-yellow p-5 md:col-span-3">
            <Sparkles className="size-8" aria-hidden="true" />
            <p className="mt-5 text-4xl font-black tabular-nums">{overview.quickPracticeCompleted}</p>
            <p className="font-bold text-black/65">Latihan cepat selesai</p>
          </article>
          <article className="neo-surface bg-white p-5 md:col-span-3">
            <BookOpenCheck className="size-8 text-neo-blue" aria-hidden="true" />
            <p className="mt-5 text-4xl font-black tabular-nums">{overview.sectionPracticeCompleted}</p>
            <p className="font-bold text-muted-foreground">Latihan seksi selesai</p>
          </article>
          <article className="neo-surface bg-neo-green p-5 md:col-span-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-black tracking-widest uppercase">Mock JLPT</p>
                <p className="mt-2 text-5xl font-black tabular-nums">{overview.mockCompleted}</p>
                <p className="font-bold text-black/65">Ujian selesai</p>
              </div>
              <Trophy className="size-14" aria-hidden="true" />
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="quick-heading">
        <div className="mb-4 flex items-center gap-3">
          <CalendarDays className="size-6" aria-hidden="true" />
          <h2 id="quick-heading" className="text-3xl">Lanjut belajar</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_ACTIONS.map((item) => (
            <Link key={item.href} href={item.href} className="neo-surface neo-interactive flex items-center gap-4 bg-white p-5">
              <span className={`grid size-12 shrink-0 place-items-center border-[3px] border-black ${item.color}`}>
                <item.icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black">{item.label}</span>
                <span className="block text-sm text-muted-foreground">{item.note}</span>
              </span>
              <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
