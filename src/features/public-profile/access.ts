import type { ProfileVisibility } from "@prisma/client";
import { isAnonymizedUsername } from "@/lib/username";

// Aturan akses profil publik, aman untuk client dan unit test (tanpa Prisma
// runtime). Satu-satunya tempat yang memutuskan siapa boleh melihat isi profil;
// halaman, metadata, dan Server Action wajib lewat sini, bukan menulis ulang
// pengecekannya. Rancangan: docs/module/community.md#aturan-akses.

export type ProfileOwner = {
  id: number;
  profileVisibility: ProfileVisibility;
  anonymizedAt: Date | null;
  deletionRequestedAt: Date | null;
};

/**
 * Akun yang tidak punya halaman profil sama sekali (404): sudah dianonimkan,
 * atau sedang menunggu penghapusan. Yang kedua ikut disembunyikan karena
 * pemiliknya sudah meminta akunnya hilang — membiarkan profilnya tetap terbuka
 * selama masa tunggu 7 hari berarti mengabaikan permintaan itu.
 */
export function isProfileUnavailable(owner: Pick<ProfileOwner, "anonymizedAt" | "deletionRequestedAt">) {
  return owner.anonymizedAt !== null || owner.deletionRequestedAt !== null;
}

/**
 * Boleh melihat isi profil (statistik, heatmap, reputasi): akun PUBLIC, atau
 * viewer adalah pemiliknya. Follower yang disetujui menyusul di tahap 2.
 *
 * Kartu identitas (avatar, nama, username, bio, target level) bukan bagian dari
 * keputusan ini — kartu itu selalu tampil untuk akun yang tersedia.
 */
export function canViewProfileContent(
  owner: Pick<ProfileOwner, "id" | "profileVisibility">,
  viewerId: number | null,
) {
  return owner.profileVisibility === "PUBLIC" || viewerId === owner.id;
}

/** Path profil, atau null bila akun anonim (handle-nya bukan identitas lagi). */
export function profilePath(username: string, enabled: boolean) {
  if (!enabled || isAnonymizedUsername(username)) return null;
  return `/u/${encodeURIComponent(username)}`;
}
