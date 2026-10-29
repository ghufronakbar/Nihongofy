import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import "@/features/onigiri-kitchen/kitchen.css";

export default function OnigiriKitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!FEATURES.onigiriKitchen) notFound();
  return children;
}
