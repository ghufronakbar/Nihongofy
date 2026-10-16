import { createHmac, randomUUID } from "node:crypto";
import { upgradeWebSocket } from "@vercel/functions";
import { env } from "@/constants";
import { ClashIdSchema } from "@/features/kotoba-clash/schemas";
import { readClashPrincipal, verifyClashPrincipal, requireClashEnabled } from "@/features/kotoba-clash/server/auth";
import { clashState } from "@/features/kotoba-clash/server/runtime";
import { clashPresence, limitClash, requireClashRuntime, type ClashConnection } from "@/features/kotoba-clash/server/presence";
import { attachClashSocket } from "@/features/kotoba-clash/server/socket";
import { clashFailure } from "@/features/kotoba-clash/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  let connection: ClashConnection | undefined;
  try {
    requireClashEnabled();
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin) return new Response(null, { status: 403 });
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response(null, { status: 426 });
    const roomId = ClashIdSchema.parse(url.searchParams.get("room"));
    await requireClashRuntime();
    const subject = createHmac("sha256", env.SESSION_SECRET).update(`kotoba:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`).digest("hex");
    await limitClash("handshake", subject, 60);
    const principal = await readClashPrincipal();
    if (!principal) return new Response(null, { status: 401 });
    const state = await clashState.read(await verifyClashPrincipal(principal), roomId);
    if (state.closed) return new Response(null, { status: 410 });
    connection = { roomId, memberId: state.viewer.memberId, owner: randomUUID() };
    if (!await clashPresence.change(connection, "acquire")) return new Response(null, { status: 429 });
    const admitted = connection;
    return await upgradeWebSocket((ws) => attachClashSocket(ws, principal, admitted), { maxPayload: 2048 });
  } catch (error) {
    if (connection) await clashPresence.change(connection, "release").catch(() => undefined);
    const failure = clashFailure(error);
    return Response.json(failure, { status: failure.code === "NOT_FOUND" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
