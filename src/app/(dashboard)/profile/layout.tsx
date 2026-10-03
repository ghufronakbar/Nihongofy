import { FEATURES } from "@/constants";
import { ProfileNav } from "@/features/profile/components/profile-nav";
import { countPendingFollowRequests } from "@/features/public-profile/follow-queries";
import { getSession } from "@/lib/auth";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  // Layout (dashboard) sudah memvalidasi session; di sini hanya untuk badge.
  const session = await getSession();
  const followRequests =
    FEATURES.follow && session ? await countPendingFollowRequests(session.userId) : null;

  return (
    <div className="page-reveal mx-auto grid w-full max-w-6xl gap-7 pb-10">
      <div className="grid gap-4">
        <span className="neo-kicker">ACCOUNT CONTROL ROOM</span>
        <ProfileNav followRequests={followRequests} />
      </div>
      {children}
    </div>
  );
}
