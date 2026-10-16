import Link from "next/link";
import { PageContainer } from "@/components/marketing/page-container";
import { ClashRound } from "@/features/kotoba-clash/components/round";
import { getClashResultsAction } from "@/features/kotoba-clash/actions";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Hasil Kotoba Clash", "Peringkat dan review pertandingan Kotoba Clash yang sudah selesai.");

export default async function ClashResultsPage({ params }: { params: Promise<{ code: string; matchId: string }> }) {
  const { code, matchId } = await params;
  const result = await getClashResultsAction(code, matchId);
  if (!result.ok) return <PageContainer className="py-12"><h1 className="text-3xl font-black">Hasil belum dapat dibuka</h1><p className="mt-5">{result.message}</p><Link className="neo-button mt-6 bg-neo-yellow" href="/mini-games/kotoba-clash">Kembali ke Kotoba Clash</Link></PageContainer>;
  const { state, review } = result.data;
  const match = state.match!;
  return <PageContainer className="space-y-8 py-10">
    <Link className="text-sm font-bold underline" href={`/mini-games/kotoba-clash/room/${state.code}`}>Kembali ke room / Main lagi</Link>
    <h1 className="text-4xl font-black">HASIL KOTOBA CLASH.</h1>
    <ol className="neo-surface space-y-4 bg-neo-green p-6">{match.leaderboard.map((player) => <li key={player.playerId} className="flex flex-wrap items-baseline justify-between gap-3"><span className="text-lg font-bold">#{player.rank} {player.nickname}</span><span className="font-mono font-black">{player.score.toLocaleString("id-ID")} poin / {player.correctCount} benar / {player.wrongCount} salah / {player.skippedCount} kosong</span></li>)}</ol>
    <h2 className="text-2xl font-black">Review soal</h2>
    {review.map(({ round, ownChoice }) => <ClashRound key={round.id} match={{ ...match, round, phase: { type: "REVEAL", roundId: round.id, position: round.position, endsAt: round.revealEndsAt }, ownAnswer: ownChoice === null ? null : { choice: ownChoice, acceptedAt: 0 } }} now={state.serverNow} connected={false} pending={false} review />)}
  </PageContainer>;
}
