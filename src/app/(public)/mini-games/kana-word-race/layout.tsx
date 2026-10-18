import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import "@/features/kana-word-race/components/race.css";

export default function KanaRaceLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.kanaWordRace) notFound();
  return <div className="race-ui">{children}</div>;
}
