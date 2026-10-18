import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClashRoomSnapshotSchema } from "../contracts";
import { ClashAnswerStatus } from "./answer-status";
import { ClashLeaderboard, ClashMemberList } from "./arena-ui";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function snapshot() {
  return ClashRoomSnapshotSchema.parse({
    id: id(1), code: "ABCD2345", revision: 1, serverNow: 5000, closed: false, configRevision: 0, config: null,
    viewer: { memberId: id(2), isHost: false, spectating: false },
    members: [2, 3, 4].map((value) => ({ id: id(value), nickname: `Player ${value}`, ready: false, spectating: false, isHost: false })),
    match: {
      id: id(10), questionCount: 5, playing: true, ownAnswer: null,
      phase: { type: "QUESTION", roundId: id(20), position: 1, endsAt: 31000 },
      round: { id: id(20), position: 1, startsAt: 1000, endsAt: 31000, revealEndsAt: 39000, mondaiType: "MOJI_GOI_CONTEXT",
        content: { instruction: null, text: "Question", image: null, context: null, choices: [
          { code: 1, text: "First", image: null }, { code: 2, text: "Second", image: null },
        ] } },
      leaderboard: [2, 3, 4].map((value) => ({
        playerId: id(10 + value), memberId: id(value), nickname: `Player ${value}`, rank: 1, score: 0,
        correctCount: 0, wrongCount: 0, skippedCount: 0, bestStreak: 0, correctTimeMs: 0,
        answerOrder: value === 2 ? null : 1,
      })),
    },
  });
}

describe("Kotoba Clash answer status indicators", () => {
  it("shows waiting, accepted order and explicit ties on both live player lists", () => {
    const state = snapshot();
    const leaderboard = renderToStaticMarkup(createElement(ClashLeaderboard, { match: state.match!, members: state.members, viewerId: id(2) }));
    const members = renderToStaticMarkup(createElement(ClashMemberList, { state, online: [], active: true }));
    for (const html of [leaderboard, members]) {
      expect(html).toContain("Belum menjawab");
      expect(html).toContain("Sudah menjawab · #1 (seri)");
      expect(html.indexOf("Player 2")).toBeLessThan(html.indexOf("Player 3"));
      expect(html).not.toMatch(/Jawaban benar|isCorrect|acceptedAt/);
    }
  });

  it("shows an unanswered round at reveal and clears old orders on the next question", () => {
    const match = snapshot().match!;
    match.phase = { type: "REVEAL", roundId: id(20), position: 1, endsAt: 39000 };
    expect(renderToStaticMarkup(createElement(ClashAnswerStatus, { match, memberId: id(2) }))).toContain("Tidak menjawab");
    match.phase = { type: "QUESTION", roundId: id(21), position: 2, endsAt: 69000 };
    match.round = { ...match.round!, id: id(21), position: 2, startsAt: 39000, endsAt: 69000, revealEndsAt: 77000 };
    match.leaderboard.forEach((player) => { player.answerOrder = null; });
    const html = renderToStaticMarkup(createElement(ClashAnswerStatus, { match, memberId: id(3) }));
    expect(html).toContain("Belum menjawab");
    expect(html).not.toContain("#1");
  });

  it("does not mark spectators, legacy snapshots or mismatched rounds as waiting", () => {
    const match = snapshot().match!;
    const render = (memberId: string) => renderToStaticMarkup(createElement(ClashAnswerStatus, { match, memberId }));
    expect(render(id(99))).toBe("");
    delete match.leaderboard[0]!.answerOrder;
    expect(render(id(2))).toBe("");
    match.round!.id = id(99);
    expect(render(id(3))).toBe("");
  });

  it("omits live status in the lobby, solo mode, countdown and finished results", () => {
    const state = snapshot();
    expect(renderToStaticMarkup(createElement(ClashMemberList, { state, online: [] }))).not.toContain("menjawab");
    expect(renderToStaticMarkup(createElement(ClashLeaderboard, { match: state.match!, members: state.members, viewerId: id(2), solo: true }))).not.toContain("menjawab");
    state.match!.phase = { type: "COUNTDOWN", endsAt: 1000 };
    expect(renderToStaticMarkup(createElement(ClashAnswerStatus, { match: state.match, memberId: id(3) }))).toBe("");
    state.match!.phase = { type: "FINISHED" };
    expect(renderToStaticMarkup(createElement(ClashAnswerStatus, { match: state.match, memberId: id(3) }))).toBe("");
  });

  it.each([0, 21, 1.5])("rejects an invalid answer order (%s) at the wire boundary", (answerOrder) => {
    const state = snapshot();
    state.match!.leaderboard[0]!.answerOrder = answerOrder;
    expect(ClashRoomSnapshotSchema.safeParse(state).success).toBe(false);
  });
});
