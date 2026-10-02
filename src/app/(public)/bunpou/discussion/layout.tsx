import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

// Segmen /bunpou sendiri sudah 404 saat modul bunpou mati; flag ini menutup
// permukaan diskusinya saja.
export default function BunpouDiscussionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.bunpouDiscussion) notFound();

  return children;
}
