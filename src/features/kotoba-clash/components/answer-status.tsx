import { Check, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClashRoomSnapshot } from "../contracts";

export function ClashAnswerStatus({ match, memberId }: {
  match: ClashRoomSnapshot["match"]; memberId: string;
}) {
  if (!match || (match.phase.type !== "QUESTION" && match.phase.type !== "REVEAL")
    || match.round?.id !== match.phase.roundId) return null;
  const player = match.leaderboard.find((candidate) => candidate.memberId === memberId);
  if (!player || player.answerOrder === undefined) return null;
  const answered = player.answerOrder !== null;
  const tied = answered && match.leaderboard.some((candidate) => candidate.playerId !== player.playerId && candidate.answerOrder === player.answerOrder);
  const label = answered
    ? `Sudah menjawab · #${player.answerOrder}${tied ? " (seri)" : ""}`
    : match.phase.type === "QUESTION" ? "Belum menjawab" : "Tidak menjawab";
  return <span className={cn("mt-1 inline-flex items-center gap-1 text-[10px] font-bold", answered ? "text-emerald-800" : "text-neo-ink/60")}
    data-answer-state={answered ? "answered" : "waiting"}
    title={answered ? "Urutan jawaban diterima. Nomor yang sama berarti seri." : undefined}>
    {answered ? <Check className="size-3 shrink-0" aria-hidden="true" /> : <Clock3 className="size-3 shrink-0" aria-hidden="true" />}
    {label}
  </span>;
}
