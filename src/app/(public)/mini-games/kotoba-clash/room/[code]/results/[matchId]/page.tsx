import Link from "next/link";
import { PageContainer } from "@/components/marketing/page-container";
import { ClashRound } from "@/features/kotoba-clash/components/round";
import { ClashFinish, ClashLeaderboard } from "@/features/kotoba-clash/components/arena-ui";
import { getClashResultsAction } from "@/features/kotoba-clash/actions";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Hasil Kotoba Clash", "Peringkat dan review pertandingan Kotoba Clash yang sudah selesai.");

export default async function ClashResultsPage({ params }: { params: Promise<{ code: string; matchId: string }> }) {
  const { code, matchId } = await params;
  const result = await getClashResultsAction(code, matchId);
  if (!result.ok) return <PageContainer className="py-12"><h1 className="text-3xl font-black">Hasil belum dapat dibuka</h1><p className="mt-5">{result.message}</p><Link className="clash-button mt-6" data-tone="yellow" href="/mini-games/kotoba-clash">Kembali ke Kotoba Clash</Link></PageContainer>;
  const { state, review } = result.data;
  const match = state.match!;
  const solo = state.mode === "solo";
  return <PageContainer className="space-y-8 py-10">
    <Link className="text-sm font-bold underline" href={`/mini-games/kotoba-clash/room/${state.code}`}>{solo ? "Kembali ke sesi / Latihan lagi" : "Kembali ke room / Main lagi"}</Link>
    <h1 className="text-4xl font-black">HASIL KOTOBA CLASH.</h1>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]"><ClashFinish match={match} members={state.members} solo={solo} /><ClashLeaderboard match={match} members={state.members} viewerId={state.viewer.memberId} solo={solo} /></div>
    <section className="clash-panel p-5"><h2 className="font-black">Catatan pertandingan</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2">{match.leaderboard.map((player) => <li key={player.playerId} className="text-sm leading-6"><strong>{player.nickname}</strong><p>{player.correctCount} benar / {player.wrongCount} salah / {player.skippedCount} kosong</p></li>)}</ul></section>
    <h2 className="text-2xl font-black">Review soal</h2>
    {review.map(({ round, ownChoice }) => <ClashRound key={round.id} match={{ ...match, round, phase: { type: "REVEAL", roundId: round.id, position: round.position, endsAt: round.revealEndsAt }, ownAnswer: ownChoice === null ? null : { choice: ownChoice, acceptedAt: 0 } }} now={state.serverNow} connected={false} pending={false} review />)}
  </PageContainer>;
}
