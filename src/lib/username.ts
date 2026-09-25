import { z } from "zod";

// Username adalah nama publik, bukan kredensial. Login memakai email saja —
// lihat `loginAction`. Konsekuensinya username boleh tampil di komentar dan
// boleh diganti tanpa memengaruhi cara user masuk.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// Akhiran ini milik akun yang sudah dianonimkan. Tanpa dilindungi, user hidup
// bisa mengklaim `lans_1761400000_deleted` dan menyamar sebagai akun tombstone.
export const ANONYMIZED_USERNAME_SUFFIX = "_deleted";

// Segmen route yang sudah dipakai, plus kata yang lazim disalahgunakan untuk
// menyamar sebagai akun resmi. Wajib dijaga karena username muncul sebagai
// identitas publik dan dapat menjadi bagian URL.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "analytics",
  "api",
  "article",
  "conversation",
  "dashboard",
  "deleted",
  "discussion",
  "exam",
  "exercises",
  "flashcard",
  "forget-password",
  "help",
  "history",
  "kana",
  "login",
  "logout",
  "me",
  "moderator",
  "nihongofy",
  "null",
  "official",
  "profile",
  "progress",
  "register",
  "result",
  "root",
  "settings",
  "speaking",
  "staff",
  "support",
  "system",
  "u",
  "undefined",
  "user",
  "verify-email",
]);

// Aturan ala Instagram: huruf kecil, angka, titik, dan underscore. Titik tidak
// boleh di ujung maupun berurutan supaya `a..b` dan `a.` tidak lolos.
const USERNAME_PATTERN = /^[a-z0-9_](?:[a-z0-9_]|\.(?!\.))*[a-z0-9_]$/;

export function isReservedUsername(value: string) {
  return RESERVED_USERNAMES.has(value) || value.endsWith(ANONYMIZED_USERNAME_SUFFIX);
}

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH, `Username minimal ${USERNAME_MIN_LENGTH} karakter.`)
  .max(USERNAME_MAX_LENGTH, `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`)
  .regex(
    USERNAME_PATTERN,
    "Username hanya boleh huruf kecil, angka, titik, dan underscore. Titik tidak boleh di awal, di akhir, atau berurutan.",
  )
  .refine((value) => !isReservedUsername(value), "Username ini tidak tersedia.");

// Kandidat awal saat akun dibuat. Hasilnya belum tentu unik — pemanggil wajib
// melewatkannya ke `resolveAvailableUsername`.
export function toUsernameCandidate(source: string) {
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[._]+$/, "");

  if (slug.length < USERNAME_MIN_LENGTH || isReservedUsername(slug)) return "";
  return slug;
}

// Menambahkan suffix acak sampai menemukan yang belum terpakai. Suffix acak,
// bukan nomor urut, supaya jumlah user tidak bocor lewat username.
export async function resolveAvailableUsername(
  candidate: string,
  isTaken: (value: string) => Promise<boolean>,
): Promise<string> {
  const base = candidate || "nihongo";

  if (candidate && !(await isTaken(candidate))) return candidate;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const trimmed = base.slice(0, USERNAME_MAX_LENGTH - suffix.length - 1).replace(/[._]+$/, "");
    const next = `${trimmed || "nihongo"}_${suffix}`;
    if (!(await isTaken(next))) return next;
  }

  throw new Error("Tidak dapat membuat username unik.");
}

// Username akun yang dianonimkan: `<username_lama>_<unix>_deleted`.
//
// Handle lama ikut dipertahankan atas permintaan produk, jadi jejak identitas
// pemiliknya tidak sepenuhnya hilang dari baris ini — pertimbangkan itu bila
// suatu saat ada kewajiban penghapusan yang lebih ketat.
//
// Dipotong agar tetap muat dalam batas 30 karakter. `salt` dipakai pemanggil
// saat hasilnya bentrok: dua handle dengan awalan sama yang dianonimkan pada
// detik yang sama akan menghasilkan string yang identik.
export function buildAnonymizedUsername(previousUsername: string, now = new Date(), salt = "") {
  const tail = `_${Math.floor(now.getTime() / 1000)}${ANONYMIZED_USERNAME_SUFFIX}`;
  const room = USERNAME_MAX_LENGTH - tail.length - salt.length;
  const base =
    room > 0 ? previousUsername.slice(0, room).replace(/[._]+$/, "") : "";

  return `${base || "user"}${salt}${tail}`;
}

export function isAnonymizedUsername(value: string) {
  return value.endsWith(ANONYMIZED_USERNAME_SUFFIX);
}
