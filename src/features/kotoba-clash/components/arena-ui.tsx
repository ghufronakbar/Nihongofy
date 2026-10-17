"use client";

import { Crown, Flame, Swords, Trophy, UserMinus, Users, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClashRoomSnapshot } from "../contracts";

export function ClashButton({ className, tone = "white", ...props }: React.ComponentProps<typeof Button> & {
  tone?: "white" | "yellow" | "blue" | "green" | "coral";
}) {
  return <Button {...props} data-tone={tone} className={cn("clash-button", className)} />;
}

export function ClashAvatar({ nickname, avatarUrl, large = false }: {
  nickname: string; avatarUrl?: string | null; large?: boolean;
}) {
  const initial = Array.from(nickname.trim())[0]?.toLocaleUpperCase("id-ID") ?? "?";
  const color = Array.from(nickname).reduce((hash, char) => (hash * 31 + char.codePointAt(0)!) % 997, 0) % 5;
  return <Avatar className={cn("clash-avatar", large && "clash-avatar-large")} data-color={color} role="img" aria-label={`Avatar ${nickname}`}>
    {avatarUrl && <AvatarImage src={avatarUrl} alt={`Foto profil ${nickname}`} referrerPolicy="no-referrer" />}
    <AvatarFallback aria-hidden="true">{initial}</AvatarFallback>
  </Avatar>;
}

export function ClashStreak({ value }: { value: number }) {
  const tier = value >= 10 ? "gold" : value >= 8 ? "pink" : value >= 5 ? "blue" : value >= 3 ? "orange" : "none";
  const label = { gold: "Solar", pink: "Supernova", blue: "Blue fire", orange: "On fire", none: "Rekor streak" }[tier];
  return <span className="clash-streak" data-tier={tier} title={`${label}: rekor ${value} jawaban benar beruntun`} aria-label={`Rekor streak ${value}${tier === "none" ? "" : `, ${label}`}`}>
    <Flame className="size-4" aria-hidden="true" /><span>Rekor {value}</span><span className="sr-only"> beruntun</span>
  </span>;
}

export function ClashShowcase() {
  return <div className="clash-showcase clash-panel" aria-label="Ilustrasi arena Kotoba Clash">
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="clash-label">Pratinjau arena</span><span className="clash-tag"><Swords className="size-3.5" />JLPT battle</span></div>
    <div className="clash-versus">
      <div className="flex flex-col items-center gap-3"><ClashAvatar nickname="Kamu" large /><span className="font-black">Kamu</span></div>
      <span className="clash-vs">VS</span>
      <div className="flex flex-col items-center gap-3"><ClashAvatar nickname="Temanmu" large /><span className="font-black">Temanmu</span></div>
    </div>
    <div className="grid grid-cols-3 border-t-2 border-neo-ink bg-white text-center text-xs font-semibold">
      <p className="py-3"><Zap className="mx-auto mb-1 size-5" />Adu cepat</p>
      <p className="border-x-2 border-neo-ink py-3"><Flame className="mx-auto mb-1 size-5 text-orange-600" />Bangun streak</p>
      <p className="py-3"><Crown className="mx-auto mb-1 size-5" />Rebut podium</p>
    </div>
  </div>;
}

export function ClashLeaderboard({ match, members, viewerId, compact = false }: {
  match: NonNullable<ClashRoomSnapshot["match"]>; members: ClashRoomSnapshot["members"]; viewerId: string; compact?: boolean;
}) {
  const finished = match.phase.type === "FINISHED";
  const self = match.leaderboard.find((player) => player.memberId === viewerId);
  const leader = match.leaderboard[0];
  return <section className="clash-panel overflow-hidden" aria-label={finished ? "Hasil pertandingan" : "Peringkat sementara"}>
    <div className="border-b-[3px] border-neo-ink bg-neo-green p-4">
      <div className="flex items-center justify-between gap-3"><span className="clash-label">{finished ? "Final standings" : "Live standings"}</span><Trophy className="size-5" aria-hidden="true" /></div>
      <h2 className="mt-2 text-xl font-black">{finished ? "Papan juara" : "Perebutan podium"}</h2>
      <p className="mt-1 text-xs leading-5">{finished ? "Poin akhir seluruh ronde." : "Poin diperbarui saat pembahasan ronde."}</p>
    </div>
    <ol className={cn(compact && "max-h-[30rem] overflow-y-auto")}>
      {match.leaderboard.map((player) => {
        const member = members.find((candidate) => candidate.id === player.memberId);
        const isLeader = player.rank === 1 && (player.score > 0 || finished);
        return <li key={player.playerId} className="clash-standings-row" data-self={player.memberId === viewerId} data-leader={isLeader}>
          <span className="text-center font-mono text-sm font-black" aria-label={`Peringkat ${player.rank}`}>
            {isLeader ? <Crown className="mx-auto size-6 fill-neo-yellow" aria-hidden="true" /> : `#${player.rank}`}
          </span>
          <ClashAvatar nickname={player.nickname} avatarUrl={member?.avatarUrl} />
          <div className="min-w-0"><p className="truncate text-sm font-extrabold" title={player.nickname}>{player.nickname}{player.memberId === viewerId && <span className="ml-1 text-xs font-medium">(Anda)</span>}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-xs text-neo-ink/65">{player.correctCount} benar</span><ClashStreak value={player.bestStreak} /></div>
          </div>
          <div className="text-right"><p key={player.score} className="clash-score">{player.score.toLocaleString("id-ID")}</p><p className="text-[10px] font-bold text-neo-ink/60">POIN</p></div>
        </li>;
      })}
    </ol>
    {self && !finished && <div className="border-t-2 border-neo-ink bg-neo-paper p-4 text-xs font-semibold leading-5">
      {self.rank === 1 && self.score > 0 ? "Kamu di puncak. Pertahankan ritmemu." : leader && leader.score > self.score ? `${(leader.score - self.score).toLocaleString("id-ID")} poin menuju posisi teratas. Masih bisa dikejar.` : "Semua mulai dari nol. Siapa yang melesat duluan?"}
    </div>}
  </section>;
}

export function ClashFinish({ match, members }: { match: NonNullable<ClashRoomSnapshot["match"]>; members: ClashRoomSnapshot["members"] }) {
  const winners = match.leaderboard.filter((player) => player.rank === 1);
  return <section className="clash-panel clash-finish clash-round-enter" aria-label="Pemenang pertandingan">
    <div className="clash-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 5) * 0.12}s` }} />)}</div>
    <span className="clash-tag relative"><Trophy className="size-4" />Pertandingan selesai</span>
    <h2 className="relative mt-4 text-3xl font-black tracking-tight sm:text-4xl">{winners.length > 1 ? "Berbagi takhta." : "Arena punya juara."}</h2>
    <div className="relative mt-6 flex flex-wrap justify-center gap-6">{winners.map((winner) => <div key={winner.playerId} className="flex flex-col items-center">
      <Crown className="mb-2 size-8 fill-white" aria-label="Juara" /><ClashAvatar nickname={winner.nickname} avatarUrl={members.find((member) => member.id === winner.memberId)?.avatarUrl} large />
      <p className="mt-3 max-w-64 text-xl font-black break-words">{winner.nickname}</p><p className="mt-1 font-mono text-sm font-bold">{winner.score.toLocaleString("id-ID")} poin</p>
    </div>)}</div>
    <p className="relative mt-6 text-sm font-medium">{match.questionCount} ronde tuntas. Siap untuk tanding ulang?</p>
  </section>;
}

export function ClashMemberList({ state, online, active = false, kick, disabled }: {
  state: ClashRoomSnapshot; online: string[]; active?: boolean; disabled?: boolean;
  kick?: (member: ClashRoomSnapshot["members"][number]) => void;
}) {
  const players = state.members.filter((member) => !member.spectating);
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black"><Users className="size-5" />{active ? "Di arena" : "Line-up pemain"}</h2><span className="clash-tag">{players.length}/20</span></div>
    <ul className={cn("mt-5 space-y-4", active ? "grid gap-5 sm:grid-cols-2 sm:space-y-0 lg:grid-cols-3" : "max-h-64 overflow-y-auto pr-1")}>
      {state.members.map((member) => <li key={member.id} className="flex items-center gap-3">
        <ClashAvatar nickname={member.nickname} avatarUrl={member.avatarUrl} />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-extrabold" title={member.nickname}>{member.nickname}{member.id === state.viewer.memberId ? " (Anda)" : ""}</p>{member.isHost && <span className="text-[10px] font-black">HOST</span>}</div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neo-ink/65"><span className="clash-status-dot" data-online={online.includes(member.id)} aria-hidden="true" />{online.includes(member.id) ? "Terhubung" : "Offline"}{member.spectating ? " / Penonton" : !active ? member.ready ? " / Ready" : " / Belum ready" : ""}</p>
        </div>
        {!active && !member.spectating && member.ready && <span className="border-2 border-neo-ink bg-neo-green px-1.5 py-1 text-[10px] font-black">READY</span>}
        {!active && state.viewer.isHost && !member.isHost && kick && <ClashButton tone="coral" className="shrink-0 px-2" disabled={disabled} aria-label={`Keluarkan ${member.nickname}`} title={`Keluarkan ${member.nickname}`} onClick={() => kick(member)}><UserMinus className="size-4" /></ClashButton>}
      </li>)}
    </ul>
  </div>;
}
