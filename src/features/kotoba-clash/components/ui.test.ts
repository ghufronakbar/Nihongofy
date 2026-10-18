import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClashRoomSnapshotSchema, type ClashRoomSnapshot } from "../contracts";
import { ClashRound } from "./round";
import { ClashLobby } from "./lobby";
import { hasClashConfigChanges } from "./configuration";
import { ClashFinish, ClashLeaderboard } from "./arena-ui";
import type { ClashConfig } from "../schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../actions", () => ({
  closeClashRoomAction: vi.fn(), configureClashRoomAction: vi.fn(), joinClashRoomAction: vi.fn(),
  readyClashRoomAction: vi.fn(), startClashMatchAction: vi.fn(), participateClashRoomAction: vi.fn(),
  renameClashMemberAction: vi.fn(), kickClashMemberAction: vi.fn(),
}));
import { ClashRoom } from "./room";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function snapshot(): ClashRoomSnapshot {
  return ClashRoomSnapshotSchema.parse({
    id: id(1), code: "ABCD2345", revision: 1, serverNow: 1000, closed: false, configRevision: 0, config: null,
    viewer: { memberId: id(2), isHost: false, spectating: false }, members: [],
    match: {
      id: id(3), questionCount: 5, phase: { type: "QUESTION", roundId: id(4), position: 1, endsAt: 31000 },
      playing: true, ownAnswer: null, leaderboard: [],
      round: {
        id: id(4), position: 1, startsAt: 1000, endsAt: 31000, revealEndsAt: 39000,
        mondaiType: "MOJI_GOI_CONTEXT", correctChoice: 2, explanation: "PRIVATE_EXPLANATION",
        explanationDetails: {
          summary: "PRIVATE_EXPLANATION", detail: "PRIVATE_DETAIL", translation: "PRIVATE_TRANSLATION",
          keyPoints: ["PRIVATE_KEY_POINT"], answerKeyDoubt: true,
          choices: [
            { codeAnswer: 1, isCorrect: false, reason: "PRIVATE_WRONG_REASON" },
            { codeAnswer: 2, isCorrect: true, reason: "PRIVATE_CORRECT_REASON" },
          ],
        },
        content: { instruction: null, text: "Fixture question", image: null, context: null, choices: [
          { code: 1, text: "First choice", image: null }, { code: 2, text: "Second choice", image: null },
        ] },
      },
    },
  });
}

describe("Kotoba Clash terminal and round UI", () => {
  it("does not offer invites, join or reconnect for an initially closed room", () => {
    const html = renderToStaticMarkup(createElement(ClashRoom, { code: "ABCD2345", initial: { ...snapshot(), closed: true }, initialError: "Old connection error", catalog: [] }));
    expect(html).toContain("Room sudah ditutup atau kedaluwarsa");
    expect(html).not.toMatch(/Link undangan|Sambungkan kembali|Gabung Room|Old connection error|ABCD2345/);
  });
  it("shows the terminal screen for an expired server lookup without a snapshot", () => {
    const html = renderToStaticMarkup(createElement(ClashRoom, { code: "ABCD2345", initial: null, unavailable: true, initialError: "Expired", catalog: [] }));
    expect(html).toContain("Kembali ke Kotoba Clash");
    expect(html).not.toMatch(/guest-nickname|Gabung Room|Link undangan/);
  });
  it("keeps choice feedback and explanations private before the server reveal", () => {
    const match = snapshot().match!;
    match.ownAnswer = { choice: 2, acceptedAt: 2000 };
    const html = renderToStaticMarkup(createElement(ClashRound, { match, now: 5000, connected: true, pending: false }));
    expect(html).toContain("Jawaban terkunci");
    expect(html).not.toMatch(/PRIVATE_|Jawaban benar|Tepat sasaran|data-correct="true"|kemungkinan kekeliruan/);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("shows a specific removal notice after reload without join or reconnect controls", () => {
    const html = renderToStaticMarkup(createElement(ClashRoom, { code: "ABCD2345", initial: null, kicked: true, initialError: "KICKED", catalog: [] }));
    expect(html).toContain("Kamu dikeluarkan");
    expect(html).toContain("Host telah mengeluarkanmu");
    expect(html).not.toMatch(/guest-nickname|Gabung Room|Link undangan|Sambungkan kembali/);
  });
  it("prefills the invitation nickname from the signed-in profile", () => {
    const html = renderToStaticMarkup(createElement(ClashRoom, { code: "ABCD2345", initial: null, initialError: null, displayName: "Profile name", catalog: [] }));
    expect(html).toContain('value="Profile name"');
  });
  it("distinguishes actual draft changes from checkbox reordering", () => {
    const saved: ClashConfig = { jlptLevel: "N5", questionCount: 5, mondaiTypes: ["MOJI_GOI_CONTEXT", "MOJI_GOI_SYNONYM"] };
    expect(hasClashConfigChanges(saved, { ...saved, mondaiTypes: [...saved.mondaiTypes].reverse() })).toBe(false);
    expect(hasClashConfigChanges(saved, { ...saved, questionCount: 10 })).toBe(true);
    expect(hasClashConfigChanges(saved, { ...saved, mondaiTypes: ["MOJI_GOI_CONTEXT"] })).toBe(true);
    expect(hasClashConfigChanges(null, saved)).toBe(true);
  });
  it("places save outside the configuration form and marks unsaved defaults before ready", () => {
    const state = snapshot();
    state.match = null;
    state.viewer.isHost = true;
    state.members = [{ id: state.viewer.memberId, nickname: "Host", isHost: true, spectating: false, ready: false }];
    const html = renderToStaticMarkup(createElement(ClashLobby, { state, catalog: [{ jlptLevel: "N5", mondaiType: "MOJI_GOI_CONTEXT", count: 20 }], online: [state.viewer.memberId], connected: true, busy: false, run: async () => true, close: async () => undefined }));
    expect(html).toContain("Pengaturan belum disimpan");
    expect(html).toContain("Simpan perubahan sebelum ready atau mulai");
    expect(html.indexOf("Simpan pengaturan</button>")).toBeGreaterThan(html.indexOf("</form>"));
    expect(html).not.toContain("Keluarkan Host");
    expect(html).toContain("Nickname kamu");
  });
  it("closes answer controls at the deadline while waiting for an authoritative reveal", () => {
    const html = renderToStaticMarkup(createElement(ClashRound, { match: snapshot().match!, now: 31000, connected: true, pending: false }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-valuenow="0"');
    expect(html).not.toContain("PRIVATE_EXPLANATION");
  });
  it("starts a saved solo challenge with one connected owner without ready or invite controls", () => {
    const state = snapshot();
    state.mode = "solo";
    state.match = null;
    state.viewer.isHost = true;
    state.configRevision = 1;
    state.config = { mode: "solo", jlptLevel: "N5", questionCount: 5, mondaiTypes: ["MOJI_GOI_CONTEXT"] };
    state.members = [{ id: state.viewer.memberId, nickname: "Solo player", isHost: true, spectating: false, ready: false }];
    const props = { state, catalog: [{ jlptLevel: "N5" as const, mondaiType: "MOJI_GOI_CONTEXT" as const, count: 20 }], online: [state.viewer.memberId], connected: true, busy: false, run: async () => true, close: async () => undefined };
    const html = renderToStaticMarkup(createElement(ClashLobby, props));
    const start = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Mulai latihan solo<\/button>/)?.[0];
    expect(start).toBeDefined();
    expect(start).not.toContain('disabled=""');
    expect(html).not.toMatch(/Saya Ready|Belum ready|Kesiapan pemain|rival lagi/);
    state.config = null;
    state.configRevision = 0;
    const unsaved = renderToStaticMarkup(createElement(ClashLobby, props));
    expect(unsaved).toContain("Pengaturan belum disimpan");
    expect(unsaved).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Mulai latihan solo<\/button>/);
    const room = renderToStaticMarkup(createElement(ClashRoom, { code: state.code, initial: state, initialError: null, catalog: [] }));
    expect(room).toContain("Sesi pribadi");
    expect(room).not.toMatch(/Link undangan|>ABCD2345<|>Kode<|Saya Ready/);
  });
  it("shows personal solo results and a practice-again action without declaring a winner", () => {
    const state = snapshot();
    const match = state.match!;
    match.phase = { type: "FINISHED" };
    match.leaderboard = [{ playerId: id(5), memberId: state.viewer.memberId, nickname: "Solo player", rank: 1, score: 4000, correctCount: 3, wrongCount: 1, skippedCount: 1, bestStreak: 2, correctTimeMs: 1000 }];
    const results = renderToStaticMarkup(createElement(ClashLeaderboard, { match, members: [], viewerId: state.viewer.memberId, solo: true }));
    expect(results).toContain("Hasil latihanmu");
    expect(results).toContain("4.000");
    expect(results).toMatch(/Benar[\s\S]*Salah[\s\S]*Kosong/);
    expect(results).not.toMatch(/Papan juara|Peringkat|puncak|podium/);
    const finish = renderToStaticMarkup(createElement(ClashFinish, { match, members: [], solo: true }));
    expect(finish).toContain("Latihan selesai");
    expect(finish).not.toMatch(/Arena punya juara|aria-label="Juara"/);
    state.mode = "solo";
    state.viewer.isHost = true;
    const lobby = renderToStaticMarkup(createElement(ClashLobby, { state, catalog: [], online: [state.viewer.memberId], connected: true, busy: false, run: async () => true, close: async () => undefined }));
    expect(lobby).toContain("Latihan lagi");
    expect(lobby).not.toMatch(/Saya Ready|ready kembali/);
  });
  it("shows an access notice without invitations or a join form to a non-owner of a solo session", () => {
    const html = renderToStaticMarkup(createElement(ClashRoom, { code: "ABCD2345", initial: null, initialError: null, privateSession: true, catalog: [] }));
    expect(html).toContain("Sesi latihan pribadi");
    expect(html).not.toMatch(/guest-nickname|Gabung Room|Link undangan|ABCD2345/);
  });
  it("reveals feedback only in the reveal phase and omits live timers in review", () => {
    const match = snapshot().match!;
    match.phase = { type: "REVEAL", roundId: id(4), position: 1, endsAt: 39000 };
    match.ownAnswer = { choice: 2, acceptedAt: 2000 };
    const reveal = renderToStaticMarkup(createElement(ClashRound, { match, now: 32000, connected: true, pending: false }));
    expect(reveal).toContain("Tepat sasaran");
    expect(reveal).toContain("PRIVATE_EXPLANATION");
    const review = renderToStaticMarkup(createElement(ClashRound, { match, now: 50000, connected: false, pending: false, review: true }));
    expect(review).toContain("PRIVATE_EXPLANATION");
    expect(review).not.toMatch(/progressbar|SELANJUTNYA|Ronde berikutnya|Koneksi terputus/);
  });
  it.each([false, true])("opens every explanation section during reveal and results (review=%s)", (review) => {
    const match = snapshot().match!;
    match.phase = { type: "REVEAL", roundId: id(4), position: 1, endsAt: 39000 };
    const html = renderToStaticMarkup(createElement(ClashRound, { match, now: 32000, connected: !review, pending: false, review }));
    for (const text of ["PRIVATE_EXPLANATION", "PRIVATE_DETAIL", "PRIVATE_TRANSLATION", "PRIVATE_KEY_POINT", "PRIVATE_WRONG_REASON", "PRIVATE_CORRECT_REASON", "kemungkinan kekeliruan"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("<details");
  });
  it("preserves the legacy summary and the missing-explanation fallback", () => {
    const match = snapshot().match!;
    match.phase = { type: "REVEAL", roundId: id(4), position: 1, endsAt: 39000 };
    delete match.round!.explanationDetails;
    const props = { match, now: 32000, connected: true, pending: false };
    expect(renderToStaticMarkup(createElement(ClashRound, props))).toContain("PRIVATE_EXPLANATION");
    match.round!.explanation = null;
    expect(renderToStaticMarkup(createElement(ClashRound, props))).toContain("Pembahasan untuk soal ini belum tersedia.");
  });
});
