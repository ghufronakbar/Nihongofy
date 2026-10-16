import { describe, expect, it } from "vitest";
import { authorizeProbe } from "./guard";
import { parseSubscriptionLine, probeClientId, probeCommand, probeRevision } from "./protocol";

const now = Date.parse("2026-10-16T01:00:00Z");
const config = {
  KOTOBA_PROBE_ENABLED: true,
  KOTOBA_PROBE_SECRET: "a".repeat(48),
  KOTOBA_PROBE_ORIGIN: "https://probe.invalid",
  KOTOBA_PROBE_RUN_ID: "probe-20261016",
  KOTOBA_PROBE_EXPIRES_AT: "2026-10-16T02:00:00Z",
  VERCEL_ENV: "preview",
};
const request = (headers: Record<string, string> = {}) => new Request("https://app.invalid/api/internal/kotoba-clash-probe", {
  headers: { origin: config.KOTOBA_PROBE_ORIGIN, authorization: `Bearer ${config.KOTOBA_PROBE_SECRET}`, ...headers },
});

describe("operator probe guard", () => {
  it("permits a valid short-lived preview probe", () => {
    expect(authorizeProbe(request(), config, now)).toBe(200);
  });
  it.each([
    { KOTOBA_PROBE_ENABLED: false }, { VERCEL_ENV: "production" },
    { KOTOBA_PROBE_SECRET: "short" }, { KOTOBA_PROBE_SECRET: undefined },
    { KOTOBA_PROBE_RUN_ID: "../auth" }, { KOTOBA_PROBE_ORIGIN: undefined },
    { KOTOBA_PROBE_EXPIRES_AT: undefined }, { KOTOBA_PROBE_EXPIRES_AT: "bad-date" },
    { KOTOBA_PROBE_EXPIRES_AT: "2026-10-16T01:00:00Z" },
    { KOTOBA_PROBE_EXPIRES_AT: "2026-10-16T04:00:00Z" },
  ])("fails closed for invalid or disabled configuration %j", (override) => {
    expect(authorizeProbe(request(), { ...config, ...override }, now)).toBe(404);
  });
  it.each(["", "https://foreign.invalid", "null", "https://probe.invalid.evil"])("rejects Origin %s", (origin) => {
    expect(authorizeProbe(request({ origin }), config, now)).toBe(403);
  });
  it.each(["", "Bearer bad", "Basic bad", "a".repeat(300)])("rejects invalid credentials", (authorization) => {
    expect(authorizeProbe(request({ authorization }), config, now)).toBe(401);
  });
});

describe("bounded probe protocol", () => {
  it("only accepts the 20 synthetic clients", () => {
    for (let i = 0; i < 20; i++) expect(probeClientId.safeParse(`p${String(i).padStart(2, "0")}`).success).toBe(true);
    for (const value of ["p20", "../session", "p1", "real-user"]) expect(probeClientId.safeParse(value).success).toBe(false);
  });
  it("rejects malformed or extended commands", () => {
    for (const value of [{ type: "advance", sequence: -1 }, { type: "advance", sequence: 1.5 }, { type: "sync", room: "other" }, { type: "advance", sequence: 1, fault: "arbitrary" }]) {
      expect(probeCommand.safeParse(value).success).toBe(false);
    }
  });
  it("retains JSON commas in Upstash SSE messages and ignores other channels", () => {
    const event = { revision: 12, sourceInstance: "c908f2d6-aefe-42d1-a2f4-61741dadcd80" };
    expect(probeRevision.parse(parseSubscriptionLine(`data: message,isolated,${JSON.stringify(event)}`, "isolated"))).toEqual(event);
    expect(parseSubscriptionLine(`data: message,other,${JSON.stringify(event)}`, "isolated")).toBeUndefined();
    expect(parseSubscriptionLine("data: subscribe,isolated,1", "isolated")).toBeUndefined();
  });
});
