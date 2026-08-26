import { redirect } from "next/navigation";

export default function LegacyAuthSettingsPage() {
  redirect("/profile/security");
}
