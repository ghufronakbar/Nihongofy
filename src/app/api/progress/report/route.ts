import type { JlptLevel } from "@prisma/client";
import { JLPT_LEVEL_ORDER } from "@/constants/jlpt";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "@/lib/time-zone";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { getProgress } from "@/features/progress/actions";
import { buildProgressReport } from "@/features/progress/lib/report-data";
import { renderProgressReport } from "@/features/progress/report/progress-report-document";

// Report PDF /progress untuk satu level. Dirender di server karena butuh font
// Jepang (assets/fonts, ikut bundle lewat outputFileTracingIncludes).
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = new URL(request.url).searchParams.get("level");
  if (!level || !(JLPT_LEVEL_ORDER as string[]).includes(level)) {
    return Response.json({ error: "Level tidak valid." }, { status: 400 });
  }

  const [levels, timeZone, user] = await Promise.all([
    getProgress(),
    getUserTimeZone(session.userId),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true, username: true },
    }),
  ]);

  const progress = levels.find((item) => item.level === (level as JlptLevel));
  if (!progress || !user) {
    return Response.json({ error: "Belum ada attempt untuk level ini." }, { status: 404 });
  }

  const now = new Date();
  const pdf = await renderProgressReport({
    report: buildProgressReport(progress, timeZone),
    userName: user.displayName || user.username,
    generatedLabel: formatInTimeZone(now, timeZone, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  // en-CA menghasilkan YYYY-MM-DD, enak diurutkan di folder unduhan.
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nihongofy-progress-${level}-${dateStamp}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
