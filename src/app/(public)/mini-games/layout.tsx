import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";

export default function MiniGamesLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.miniGames) notFound();
  return children;
}
