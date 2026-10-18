import { createHmac, randomUUID } from "node:crypto";
import { upgradeWebSocket } from "@vercel/functions";
import { z } from "zod";
import { env, FEATURES } from "@/constants";
import { readRacePrincipal, verifyRacePrincipal } from "@/features/kana-word-race/server/auth";
import { limitRace, racePresence, requireRaceRuntime, type RaceConnection } from "@/features/kana-word-race/server/presence";
import { raceRepository, raceFailure } from "@/features/kana-word-race/server/runtime";
import { attachRaceSocket } from "@/features/kana-word-race/server/socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!FEATURES.kanaWordRace) return new Response(null, { status: 404 });
  let connection: RaceConnection | undefined;
  try {
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin) return new Response(null, { status: 403 });
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response(null, { status: 426 });
    await requireRaceRuntime();
    const roomId = z.uuid().parse(url.searchParams.get("room"));
    const subject = createHmac("sha256", env.SESSION_SECRET).update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown").digest("hex");
    await limitRace("handshake", subject, 60);
    const principal = await readRacePrincipal();
    if (!principal) return new Response(null, { status: 401 });
    const state = await raceRepository.run(await verifyRacePrincipal(principal), { type: "sync", roomId, requestId: randomUUID() });
    if (state.closed) return new Response(null, { status: 410 });
    connection = { roomId, memberId: state.viewer.memberId, owner: randomUUID() };
    if (!await racePresence.change(connection, "acquire")) return new Response(null, { status: 429 });
    const admitted = connection;
    return await upgradeWebSocket((ws) => attachRaceSocket(ws, principal, admitted), { maxPayload: 2048 });
  } catch (error: unknown) {
    if (connection) await racePresence.change(connection, "release").catch(() => undefined);
    return Response.json(raceFailure(error), { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
