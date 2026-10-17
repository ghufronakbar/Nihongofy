"use client";

import { Crown, Eye, Swords } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ClashRoomSnapshot } from "../contracts";
import { ClashLeaderboard, ClashMemberList } from "./arena-ui";
import { ClashRound } from "./round";

export function ClashArena({ state, now, connected, pending, online, answer }: {
  state: ClashRoomSnapshot; now: number; connected: boolean; pending: boolean; online: string[]; answer: (choice: number) => void;
}) {
  const match = state.match;
  const roundElement = useRef<HTMLDivElement>(null);
  const phaseKey = match ? `${match.phase.type}:${match.round?.id ?? ""}` : null;
  const previousPhase = useRef(phaseKey);
  useEffect(() => {
    if (phaseKey === previousPhase.current) return;
    previousPhase.current = phaseKey;
    // Bring the new round back into view after reading a reveal on a small screen.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      roundElement.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [phaseKey]);
  if (!match) return null;
  const self = match.leaderboard.find((player) => player.memberId === state.viewer.memberId);
  const leader = match.leaderboard[0];
  return <div className="space-y-5 sm:space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3 border-y-2 border-neo-ink py-3">
      <p className="flex items-center gap-2 text-sm font-extrabold">{match.playing ? <Swords className="size-5" /> : <Eye className="size-5" />}<span className="sm:hidden">{match.playing ? "Di arena" : "Menonton"}</span><span className="hidden sm:inline">{match.playing ? "Kamu di arena" : "Kamu menonton"}</span><span className="ml-1 hidden border-l-2 border-neo-ink pl-3 font-mono text-xs sm:inline">{match.leaderboard.length} pemain</span></p>
      {self && <p className="text-xs font-semibold"><span className="hidden sm:inline">Posisimu </span><strong className="font-mono text-base sm:ml-1">#{self.rank}</strong><span className="mx-3 text-neo-ink/30">/</span><strong className="font-mono text-base">{self.score.toLocaleString("id-ID")}</strong> poin</p>}
    </div>
    {leader && leader.score > 0 && <p className="flex items-center gap-2 text-xs font-semibold lg:hidden"><Crown className="size-4 shrink-0 fill-neo-yellow" /><span className="truncate">{leader.nickname} memimpin dengan {leader.score.toLocaleString("id-ID")} poin.</span></p>}
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div ref={roundElement} className="min-w-0 scroll-mt-28"><ClashRound match={match} now={now} connected={connected} pending={pending} answer={answer} /></div>
      <aside className="min-w-0 lg:sticky lg:top-28"><ClashLeaderboard match={match} members={state.members} viewerId={state.viewer.memberId} compact />
        <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-neo-ink/65"><span className="inline-block size-2 bg-orange-600" />Api streak bisa berevolusi. Terus sambung jawaban benar.</p>
      </aside>
    </div>
    <section className="clash-panel p-5 sm:p-6" aria-label="Peserta pertandingan"><ClashMemberList state={state} online={online} active /></section>
  </div>;
}
