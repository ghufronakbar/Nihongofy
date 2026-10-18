import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const fixtures = vi.hoisted(() => ({ enabled: true, authenticate: vi.fn(), runtime: vi.fn(), upgrade: vi.fn(), run: vi.fn(), change: vi.fn(), limit: vi.fn() }));
vi.mock("@/constants", () => ({ FEATURES: { get kanaWordRace() { return fixtures.enabled; } }, env: { SESSION_SECRET: "fixture-only" } }));
vi.mock("./auth", () => ({ readRacePrincipal: fixtures.authenticate, verifyRacePrincipal: async (identity: unknown) => identity }));
vi.mock("./presence", () => ({ limitRace: fixtures.limit, racePresence: { change: fixtures.change }, requireRaceRuntime: fixtures.runtime }));
vi.mock("./runtime", () => ({ raceRepository: { run: fixtures.run }, raceFailure: () => ({ message: "Unavailable", terminal: false }) }));
vi.mock("./socket", () => ({ attachRaceSocket: vi.fn() }));
vi.mock("@vercel/functions", () => ({ upgradeWebSocket: fixtures.upgrade }));
import { GET } from "@/app/api/mini-games/kana-word-race/ws/route";

const url = `https://game.example/api/mini-games/kana-word-race/ws?room=${randomUUID()}`;
const request = (headers: Record<string, string> = {}) => new Request(url, { headers: { origin: "https://game.example", upgrade: "websocket", ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); fixtures.enabled = true; fixtures.authenticate.mockResolvedValue(null);
  fixtures.run.mockResolvedValue({ closed: false, viewer: { memberId: randomUUID() } }); fixtures.change.mockResolvedValue(true);
});
describe("socket admission", () => {
  it("rejects flag-off, foreign Origin, non-upgrade and unauthenticated requests before upgrading", async () => {
    fixtures.enabled = false; expect((await GET(request())).status).toBe(404); expect(fixtures.runtime).not.toHaveBeenCalled();
    fixtures.enabled = true; expect((await GET(request({ origin: "https://foreign.example" }))).status).toBe(403); expect(fixtures.runtime).not.toHaveBeenCalled();
    expect((await GET(request({ upgrade: "http" }))).status).toBe(426);
    expect((await GET(request())).status).toBe(401); expect(fixtures.upgrade).not.toHaveBeenCalled();
  });
  it("does not upgrade non-members or closed rooms; releases a lease when the adapter fails", async () => {
    fixtures.authenticate.mockResolvedValue({ kind: "guest", hash: "a".repeat(64) });
    fixtures.run.mockRejectedValueOnce(new Error("Not a member")); expect((await GET(request())).status).toBe(503); expect(fixtures.change).not.toHaveBeenCalled();
    fixtures.run.mockResolvedValueOnce({ closed: true }); expect((await GET(request())).status).toBe(410);
    fixtures.upgrade.mockRejectedValueOnce(new Error("Adapter unavailable")); expect((await GET(request())).status).toBe(503);
    expect(fixtures.change.mock.calls.map((call: unknown[]) => call[1])).toEqual(["acquire", "release"]);
  });
});
