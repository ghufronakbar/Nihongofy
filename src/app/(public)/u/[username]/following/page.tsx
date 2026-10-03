import type { Metadata } from "next";
import { FollowListView } from "@/features/public-profile/components/follow-list-view";
import { UsernameParamSchema } from "@/features/public-profile/schemas";
import { privateMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ after?: string | string[] }>;
};

// Daftar follow tidak diindeks: isinya identitas orang lain, dan halaman
// profil masing-masing sudah menjadi halaman yang layak dicari.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = UsernameParamSchema.safeParse((await params).username);
  if (!parsed.success) return privateMetadata("Daftar follow", "Daftar follow di Nihongofy.");
  const username = parsed.data.toLowerCase();
  return privateMetadata(`Diikuti @${username}`, `Akun yang diikuti @${username} di Nihongofy.`);
}

export default async function Page({ params, searchParams }: Props) {
  const [{ username }, { after }] = await Promise.all([params, searchParams]);
  return <FollowListView username={username} after={after} direction="following" />;
}
