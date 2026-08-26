import { ProfileNav } from "@/features/profile/components/profile-nav";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-reveal mx-auto grid w-full max-w-6xl gap-7 pb-10">
      <div className="grid gap-4">
        <span className="neo-kicker">ACCOUNT CONTROL ROOM</span>
        <ProfileNav />
      </div>
      {children}
    </div>
  );
}
