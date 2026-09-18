import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function ExercisesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!FEATURES.practice) notFound();

  return children;
}
