import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function KanaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.kana) notFound();

  return children;
}
