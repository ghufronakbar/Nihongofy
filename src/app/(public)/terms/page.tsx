import type { Metadata } from "next";
import { LegalDocumentView } from "@/features/legal/components/legal-document";
import { TERMS } from "@/features/legal/content/terms";
import { pageMetadata } from "@/lib/seo";

// Lihat catatan `force-static` di src/app/(public)/privacy/page.tsx.
export const dynamic = "force-static";

export const metadata: Metadata = pageMetadata({
  title: TERMS.title,
  description: TERMS.description,
  path: TERMS.path,
});

export default function TermsPage() {
  return <LegalDocumentView document={TERMS} />;
}
