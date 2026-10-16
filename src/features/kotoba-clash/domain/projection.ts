import { withoutFurigana } from "@/lib/japanese-markup";
import type { ClashQuestionSnapshot } from "../schemas";
import type { RoundSchedule } from "./engine";

export function projectRound(round: RoundSchedule, question: ClashQuestionSnapshot, now: number) {
  if (now < round.startsAt) return null;
  const revealed = now >= round.endsAt;
  const text = (value: string | null) => value === null ? null : revealed ? value : withoutFurigana(value);
  const content = question.content;
  return {
    id: round.id,
    position: round.position,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    revealEndsAt: round.revealEndsAt,
    mondaiType: question.mondaiType,
    content: {
      instruction: text(content.instruction),
      text: text(content.text)!,
      image: content.image,
      context: content.context && { text: text(content.context.text), image: content.context.image },
      choices: content.choices.map((choice) => ({ code: choice.code, text: text(choice.text)!, image: choice.image })),
    },
    ...(revealed ? { correctChoice: question.correctChoice, explanation: question.explanation } : {}),
  };
}
