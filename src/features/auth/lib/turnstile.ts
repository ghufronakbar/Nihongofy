import "server-only";

import { z } from "zod";
import { env, SITE_URL } from "@/constants";
import { logServerEvent, reportServerError } from "@/lib/server-logger";
import type { TurnstileAction } from "./turnstile-config";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 10_000;

const TurnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export async function verifyTurnstileToken({
  token,
  expectedAction,
  remoteIp,
}: {
  token: string;
  expectedAction: TurnstileAction;
  remoteIp: string | null;
}) {
  const body = new URLSearchParams({
    secret: env.CLOUDFLARE_TURNSTILE_SECRETKEY,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    const payload: unknown = await response.json();
    const parsed = TurnstileResponseSchema.safeParse(payload);

    if (!response.ok || !parsed.success) {
      logServerEvent("warn", "auth.turnstile.invalid-response", {
        status: response.status,
        action: expectedAction,
      });
      return false;
    }

    const result = parsed.data;
    const valid =
      result.success &&
      result.action === expectedAction &&
      result.hostname?.toLowerCase() === SITE_URL.hostname.toLowerCase();

    if (!valid) {
      logServerEvent("warn", "auth.turnstile.rejected", {
        action: expectedAction,
        returnedAction: result.action,
        returnedHostname: result.hostname,
        errorCodes: result["error-codes"],
      });
    }

    return valid;
  } catch (error) {
    reportServerError("auth.turnstile.request-failed", error, {
      action: expectedAction,
    });
    return false;
  }
}
