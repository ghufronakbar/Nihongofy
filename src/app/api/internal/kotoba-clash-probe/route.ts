import { randomUUID } from "node:crypto";
import { upgradeWebSocket } from "@vercel/functions";
import { env } from "@/constants";
import { authorizeProbe } from "@/features/mini-games/kotoba-clash/probe/guard";
import { probeClientId } from "@/features/mini-games/kotoba-clash/probe/protocol";
import { createProbeRuntime } from "@/features/mini-games/kotoba-clash/probe/server";
import { reportServerError } from "@/lib/server-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

let probe: ReturnType<typeof createProbeRuntime> | undefined;
function getProbe() {
  return probe ??= createProbeRuntime(env.KOTOBA_PROBE_RUN_ID!, Date.parse(env.KOTOBA_PROBE_EXPIRES_AT!));
}

function denied(request: Request) {
  const status = authorizeProbe(request, env);
  return status === 200 ? undefined : new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const denial = denied(request);
  if (denial) return denial;
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response(null, { status: 426 });
  const clientId = probeClientId.safeParse(new URL(request.url).searchParams.get("client"));
  if (!clientId.success) return new Response(null, { status: 400 });
  const current = getProbe();
  const lease = randomUUID();
  try {
    if (!await current.store.admit(lease)) return new Response(null, { status: 429 });
    return await upgradeWebSocket((ws) => current.attach(ws, clientId.data, lease), { maxPayload: 2048 });
  } catch (error) {
    await current.store.release(lease).catch(() => undefined);
    reportServerError("kotoba.probe.upgrade_failed", error);
    return new Response(null, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denial = denied(request);
  if (denial) return denial;
  try {
    await getProbe().cleanup();
    return new Response(null, { status: 204 });
  } catch (error) {
    reportServerError("kotoba.probe.cleanup_failed", error);
    return new Response(null, { status: 503 });
  }
}
