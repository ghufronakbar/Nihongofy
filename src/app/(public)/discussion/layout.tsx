import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FEATURES } from "@/constants";

// Konten buatan pengguna tanpa moderasi. Selama dashboard admin belum ada,
// halaman ini sengaja tidak diindeks mesin pencari (lihat juga `robots.ts`).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DiscussionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.questionDiscussion) notFound();

  return children;
}
