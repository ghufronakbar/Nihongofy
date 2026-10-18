import { notFound } from "next/navigation";
import { PageContainer } from "@/components/marketing/page-container";
import { CodeSchema } from "@/features/kana-word-race/contracts";
import { getRaceRoomAction } from "@/features/kana-word-race/actions";
import { RaceRoom } from "@/features/kana-word-race/components/room";
import { getSessionUser } from "@/lib/auth";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Room Kana Word Race", "Lobby dan balapan menebak kata Jepang bersama teman.");
export default async function KanaRaceRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = CodeSchema.safeParse((await params).code);
  if (!code.success) notFound();
  const [result, session] = await Promise.all([getRaceRoomAction({ code: code.data }), getSessionUser()]);
  return <PageContainer className="py-8 md:py-12"><RaceRoom code={code.data} initial={result.ok ? result.data : null} initialError={result.ok ? null : result.message} displayName={session?.user.displayName} /></PageContainer>;
}
