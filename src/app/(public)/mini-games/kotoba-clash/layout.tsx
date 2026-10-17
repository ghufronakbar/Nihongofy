import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import "@/features/kotoba-clash/components/clash.css";

export default function KotobaClashLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.kotobaClash) notFound();
  return <div className="clash-ui">{children}</div>;
}
