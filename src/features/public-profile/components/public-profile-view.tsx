import Link from "next/link";
import {
  BookOpenCheck,
  Brain,
  Flame,
  HandHeart,
  Languages,
  LockKeyhole,
  MessagesSquare,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeatureFlags } from "@/constants";
import type { ProfileOverview } from "@/features/profile/overview";
import { formatInTimeZone } from "@/lib/time-zone";
import type { ProfileActivity, ProfileCommunityStats, PublicProfileOwner } from "../queries";
import { ActivityHeatmap } from "./activity-heatmap";

export type PublicProfileContent = {
  overview: ProfileOverview;
  activity: ProfileActivity | null;
  community: ProfileCommunityStats | null;
};

function initialsOf(displayName: string) {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PublicProfileView({
  owner,
  isOwner,
  content,
  features,
}: {
  owner: PublicProfileOwner;
  isOwner: boolean;
  /** null = viewer tidak boleh melihat isi profil (akun private). */
  content: PublicProfileContent | null;
  features: FeatureFlags;
}) {
  const isPrivate = owner.profileVisibility === "PRIVATE";
  const memberSince = formatInTimeZone(owner.createdAt, owner.timeZone, { month: "long", year: "numeric" });

  return (
    // grid-cols-1 = minmax(0, 1fr): tanpa ini lebar minimum heatmap (~770px)
    // melebarkan seluruh kolom dan halaman meluap di layar sempit.
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-4 py-10">
      <section className="neo-surface relative overflow-hidden bg-white" aria-labelledby="profile-name">
        <div
          className="absolute top-0 right-0 h-full w-16 border-l-[3px] border-black bg-neo-green sm:w-32"
          aria-hidden="true"
        />
        <div className="relative grid gap-6 p-6 pr-20 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8 sm:pr-40">
          <Avatar className="size-24 rounded-lg border-[3px] border-black bg-neo-blue shadow-neo sm:size-28">
            {owner.avatarUrl ? (
              <AvatarImage src={owner.avatarUrl} alt={`Avatar ${owner.displayName}`} className="rounded-md" />
            ) : null}
            <AvatarFallback className="rounded-md bg-neo-blue text-3xl font-black text-black">
              {initialsOf(owner.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-mono text-xs font-black tracking-[0.16em] uppercase">Member sejak {memberSince}</p>
            <h1 id="profile-name" className="mt-2 text-4xl leading-none break-words sm:text-5xl">
              {owner.displayName}
            </h1>
            <p className="mt-2 font-mono text-sm font-bold break-all text-black/60">@{owner.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {owner.jlptTarget ? (
                <span className="inline-flex items-center gap-1.5 border-2 border-black bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                  <Target className="size-3.5" aria-hidden="true" />
                  Target {owner.jlptTarget}
                </span>
              ) : null}
              {isPrivate ? (
                <span className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
                  <LockKeyhole className="size-3.5" aria-hidden="true" />
                  Private
                </span>
              ) : null}
            </div>
            {owner.bio ? <p className="mt-4 max-w-xl text-base leading-7 text-black/75">{owner.bio}</p> : null}
          </div>
        </div>
      </section>

      {isOwner ? <OwnerNotice isPrivate={isPrivate} /> : null}

      {content ? (
        <ProfileContent content={content} features={features} />
      ) : (
        <section className="neo-surface grid justify-items-center gap-3 bg-white p-8 text-center sm:p-12">
          <span className="grid size-14 place-items-center border-[3px] border-black bg-neo-yellow shadow-neo-sm">
            <LockKeyhole className="size-7" aria-hidden="true" />
          </span>
          <h2 className="text-3xl">Akun ini private</h2>
          <p className="max-w-md text-base font-semibold text-black/65">
            Statistik dan aktivitas belajar @{owner.username} hanya terlihat oleh pemiliknya.
          </p>
        </section>
      )}
    </div>
  );
}

function OwnerNotice({ isPrivate }: { isPrivate: boolean }) {
  return (
    <section className="neo-surface flex flex-col gap-4 bg-neo-paper p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold">
        {isPrivate
          ? "Ini profilmu. Akunmu private: orang lain hanya melihat kartu identitas di atas."
          : "Ini profilmu, persis seperti yang dilihat orang lain."}
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href="/profile/info" className="neo-button bg-white text-sm">
          Edit profil
        </Link>
        <Link href="/profile/privacy" className="neo-button bg-neo-yellow text-sm">
          <Settings2 className="size-4" aria-hidden="true" />
          Atur privasi
        </Link>
      </div>
    </section>
  );
}

type StatTile = { label: string; value: number; icon: LucideIcon; color: string };

function ProfileContent({ content, features }: { content: PublicProfileContent; features: FeatureFlags }) {
  const { overview, activity, community } = content;
  const stats: StatTile[] = [
    ...(features.kana
      ? [{ label: "Kana pernah benar", value: overview.kanaLearned, icon: Languages, color: "bg-neo-blue" }]
      : []),
    ...(features.flashcard
      ? [{ label: "Kartu dipelajari", value: overview.flashcardStudied, icon: Brain, color: "bg-white" }]
      : []),
    ...(features.practice
      ? [{ label: "Latihan cepat selesai", value: overview.quickPracticeCompleted, icon: Sparkles, color: "bg-neo-yellow" }]
      : []),
    ...(features.testPackage
      ? [
          { label: "Latihan seksi selesai", value: overview.sectionPracticeCompleted, icon: BookOpenCheck, color: "bg-white" },
          { label: "Mock JLPT selesai", value: overview.mockCompleted, icon: Trophy, color: "bg-neo-green" },
        ]
      : []),
  ];

  return (
    <>
      {stats.length > 0 ? (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="mb-4 text-3xl">
            Aktivitas belajar
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
            {stats.map((stat) => (
              <article key={stat.label} className={`neo-surface p-5 ${stat.color}`}>
                <stat.icon className="size-7" aria-hidden="true" />
                <p className="mt-4 text-4xl font-black tabular-nums">{stat.value}</p>
                <p className="text-sm font-bold text-black/65">{stat.label}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activity ? (
        <section aria-labelledby="heatmap-heading" className="neo-surface bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="heatmap-heading" className="text-2xl sm:text-3xl">
                Jejak belajar
              </h2>
              <p className="text-sm font-semibold text-black/60">12 bulan terakhir, per hari.</p>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              <HeadlineStat label="Hari aktif" value={activity.summary.activeDays} />
              <HeadlineStat label="Streak sekarang" value={activity.summary.currentStreak} unit="hari" icon />
              <HeadlineStat label="Streak terpanjang" value={activity.summary.longestStreak} unit="hari" />
            </dl>
          </div>
          {activity.summary.activeDays === 0 ? (
            <p className="mb-4 text-sm font-semibold text-black/60">Belum ada aktivitas belajar dalam 12 bulan terakhir.</p>
          ) : null}
          <ActivityHeatmap
            rows={activity.rows}
            today={activity.today}
            sources={{ flashcard: features.flashcard, practice: features.practice, exam: features.testPackage }}
          />
        </section>
      ) : null}

      {community ? (
        <section aria-labelledby="community-heading">
          <h2 id="community-heading" className="mb-4 text-3xl">
            Kontribusi diskusi
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="neo-surface flex items-center gap-4 bg-neo-coral p-5">
              <HandHeart className="size-10 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-4xl font-black tabular-nums">{community.helpful}</p>
                <p className="text-sm font-bold text-black/70">Suara &quot;Membantu&quot; diterima</p>
              </div>
            </article>
            <article className="neo-surface flex items-center gap-4 bg-white p-5">
              <MessagesSquare className="size-10 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-4xl font-black tabular-nums">{community.entries}</p>
                <p className="text-sm font-bold text-black/65">Entri diskusi publik</p>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </>
  );
}

function HeadlineStat({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number;
  unit?: string;
  icon?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] font-black tracking-widest text-black/60 uppercase">{label}</dt>
      <dd className="flex items-center gap-1 text-2xl font-black tabular-nums">
        {icon && value > 0 ? <Flame className="size-5 text-neo-coral" aria-hidden="true" /> : null}
        {value}
        {unit ? <span className="text-sm font-bold text-black/60">{unit}</span> : null}
      </dd>
    </div>
  );
}
