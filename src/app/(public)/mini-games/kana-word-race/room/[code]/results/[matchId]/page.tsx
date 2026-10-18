import { notFound } from "next/navigation";
import { z } from "zod";
import { PageContainer } from "@/components/marketing/page-container";
import { CodeSchema } from "@/features/kana-word-race/contracts";
import { getRaceRoomAction } from "@/features/kana-word-race/actions";
import { RaceRoom } from "@/features/kana-word-race/components/room";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Hasil Kana Word Race", "Peringkat dan review tebakan pribadimu pada pertandingan yang sudah selesai.");
export default async function KanaRaceResultsPage({ params }: { params: Promise<{ code: string; matchId: string }> }) {
  const parsed = z.object({ code: CodeSchema, matchId: z.uuid() }).safeParse(await params);
  if (!parsed.success) notFound();
  const result = await getRaceRoomAction(parsed.data);
  return <PageContainer className="py-8 md:py-12"><RaceRoom code={parsed.data.code} initial={result.ok ? result.data : null} initialError={result.ok ? null : result.message} results /></PageContainer>;
}
