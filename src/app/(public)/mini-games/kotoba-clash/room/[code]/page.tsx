import { notFound } from "next/navigation";
import { PageContainer } from "@/components/marketing/page-container";
import { ClashRoom } from "@/features/kotoba-clash/components/room";
import { ClashRoomCodeSchema } from "@/features/kotoba-clash/schemas";
import { getClashRoomAction } from "@/features/kotoba-clash/actions";
import { getClashCatalog } from "@/features/kotoba-clash/server/catalog";
import { privateMetadata } from "@/lib/seo";
import { FEATURES } from "@/constants";
import { getSessionUser } from "@/lib/auth";

export const metadata = privateMetadata("Room Kotoba Clash", "Lobby dan pertandingan kuis JLPT bersama teman.");

export default async function ClashRoomPage({ params }: { params: Promise<{ code: string }> }) {
  if (!FEATURES.kotobaClash) notFound();
  const parsed = ClashRoomCodeSchema.safeParse((await params).code);
  if (!parsed.success) notFound();
  const [result, catalog, session] = await Promise.all([getClashRoomAction(parsed.data), getClashCatalog(), getSessionUser()]);
  return <PageContainer className="py-8 md:py-12"><ClashRoom code={parsed.data} initial={result.ok ? result.data : null} unavailable={!result.ok && ["CLOSED", "EXPIRED"].includes(result.code)} kicked={!result.ok && result.code === "KICKED"} privateSession={!result.ok && result.code === "SOLO_PRIVATE"} displayName={session?.user.displayName} initialError={!result.ok && !["UNAUTHORIZED", "NOT_FOUND"].includes(result.code) ? result.message : null} catalog={catalog} /></PageContainer>;
}
