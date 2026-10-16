import { createHash, timingSafeEqual } from "node:crypto";

type ProbeConfig = {
  KOTOBA_PROBE_ENABLED: boolean;
  KOTOBA_PROBE_SECRET?: string;
  KOTOBA_PROBE_ORIGIN?: string;
  KOTOBA_PROBE_RUN_ID?: string;
  KOTOBA_PROBE_EXPIRES_AT?: string;
  VERCEL_ENV?: string;
};

export function authorizeProbe(request: Request, config: ProbeConfig, now = Date.now()) {
  const expiry = Date.parse(config.KOTOBA_PROBE_EXPIRES_AT ?? "");
  const secret = config.KOTOBA_PROBE_SECRET;
  if (
    !config.KOTOBA_PROBE_ENABLED || config.VERCEL_ENV === "production" ||
    !secret || secret.length < 32 || !config.KOTOBA_PROBE_ORIGIN ||
    !/^[a-zA-Z0-9-]{8,64}$/.test(config.KOTOBA_PROBE_RUN_ID ?? "") ||
    !Number.isFinite(expiry) || expiry <= now || expiry - now > 2 * 60 * 60 * 1000
  ) return 404;

  if (request.headers.get("origin") !== config.KOTOBA_PROBE_ORIGIN) return 403;
  const supplied = request.headers.get("authorization") ?? "";
  if (supplied.length > 256) return 401;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(supplied), hash(`Bearer ${secret}`)) ? 200 : 401;
}
