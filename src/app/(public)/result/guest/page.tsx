import { GuestResult } from "@/features/result/components/guest-result";

// Hasil guest tidak punya row `Attempt`: lembar jawabannya dibaca dari
// sessionStorage di client, lalu dinilai server lewat getGuestAttemptSummary.
export default function GuestResultPage() {
  return <GuestResult />;
}
