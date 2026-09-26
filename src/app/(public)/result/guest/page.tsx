import { getSession } from "@/lib/auth";
import { GuestResult } from "@/features/result/components/guest-result";

// Hasil guest tidak punya row `Attempt`: lembar jawabannya dibaca dari
// sessionStorage di client, lalu dinilai server lewat getGuestAttemptSummary.
// `?import=1` adalah penanda kembalian dari login/register, dibaca di sini agar
// client tidak perlu hook pembaca URL beserta Suspense boundary-nya.
export default async function GuestResultPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const [authSession, params] = await Promise.all([getSession(), searchParams]);

  return (
    <GuestResult
      isAuthenticated={Boolean(authSession)}
      shouldImport={params.import === "1"}
    />
  );
}
