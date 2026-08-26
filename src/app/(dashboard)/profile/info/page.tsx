import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { getProfileAccountAction } from "@/features/profile/actions";
import { ProfileForm } from "@/features/profile/components/profile-form";

export const metadata: Metadata = {
  title: "Informasi Akun",
  description: "Kelola nama, email, dan avatar akun JLPT.",
};

export default async function ProfileInfoPage() {
  const account = await getProfileAccountAction();

  return (
    <main className="grid max-w-4xl gap-6">
      <header>
        <p className="font-mono text-xs font-black tracking-widest uppercase">PROFILE / INFO</p>
        <h1 className="mt-2 text-4xl sm:text-6xl">Informasi akun</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Kelola identitas yang dipakai untuk login dan tampil di area belajar.</p>
      </header>

      <section className="neo-surface overflow-hidden bg-white" aria-labelledby="edit-profile-heading">
        <div className="flex items-center gap-4 border-b-[3px] border-black bg-neo-blue p-5 sm:p-6">
          <span className="grid size-12 place-items-center border-[3px] border-black bg-white shadow-neo-sm">
            <UserRound className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 id="edit-profile-heading" className="text-2xl">Edit profil</h2>
            <p className="text-sm font-semibold text-black/65">Semua perubahan tersimpan di database.</p>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          <ProfileForm account={account} />
        </div>
      </section>
    </main>
  );
}
