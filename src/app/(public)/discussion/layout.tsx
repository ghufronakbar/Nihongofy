import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

// Konten buatan pengguna, diindeks mesin pencari sejak 2 Oktober 2026 (moderasi
// ada di /admin/moderation). Tiap halaman menentukan metadata dan `noindex`-nya
// sendiri lewat src/features/question-comment/seo.ts.

export default function DiscussionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.questionDiscussion) notFound();

  return children;
}
