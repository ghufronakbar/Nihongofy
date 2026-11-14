import { notFound } from "next/navigation";
import { SITE_URL } from "@/constants";
import { requireAdmin } from "@/lib/auth";
import { SITE_NAME } from "@/lib/seo";
import {
  getAnswerKeyTestPackage,
  getPrintableTestPackage,
} from "@/features/admin/test-package/queries";
import { PrintTestPackageQuerySchema } from "@/features/admin/test-package/schemas";
import {
  renderAnswerKey,
  renderPrintableTestPackage,
} from "@/features/admin/test-package/print/render";

// Lembar soal + lembar jawab (default) atau kunci jawaban (`document=answer-key`)
// siap cetak. Browser admin yang mengubahnya jadi PDF (dialog cetak terbuka
// otomatis), karena furigana dan teks Jepang hanya ter-layout dengan benar oleh
// mesin browser — lihat print/render.ts.
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route handler tidak dibungkus src/app/admin/layout.tsx, jadi otorisasi
  // diulang di sini. 404 yang sama untuk guest dan non-admin.
  await requireAdmin();

  const { id } = await params;
  const packageId = Number(id);
  if (!Number.isInteger(packageId) || packageId <= 0) notFound();

  const query = PrintTestPackageQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) {
    return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
  }

  const branding = query.data.branding ? { name: SITE_NAME, host: SITE_URL.host } : null;
  let html: string;
  if (query.data.document === "answer-key") {
    const answerKey = await getAnswerKeyTestPackage(packageId);
    if (!answerKey) notFound();
    html = renderAnswerKey(answerKey, { branding });
  } else {
    const testPackage = await getPrintableTestPackage(packageId);
    if (!testPackage) notFound();
    html = renderPrintableTestPackage(testPackage, { branding });
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      // Gambar soal dimuat dari CDN; jangan kirim URL area admin sebagai Referer.
      "Referrer-Policy": "no-referrer",
    },
  });
}
