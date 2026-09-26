import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata(
  "Metode masuk",
  "Kelola metode masuk dan akun terhubung.",
);

export default function LegacyAuthSettingsPage() {
  redirect("/profile/security");
}
