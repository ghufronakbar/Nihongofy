import "server-only";

import { ZodError } from "zod";
import { reportServerError } from "@/lib/server-logger";
import { ClashError } from "../domain/ports";

const messages: Record<ClashError["code"], string> = {
  UNAUTHORIZED: "Sesi tidak berlaku. Masuk atau bergabung kembali ke room.",
  NOT_FOUND: "Room tidak ditemukan atau fitur belum tersedia.",
  EXPIRED: "Room atau sesi ini sudah kedaluwarsa.",
  CLOSED: "Room sudah ditutup.",
  HOST_REQUIRED: "Hanya host yang dapat melakukan ini. Masuk untuk membuat room.",
  STALE_CONFIG: "Konfigurasi berubah. Periksa pengaturan terbaru lalu ready kembali.",
  NOT_READY: "Butuh 2-20 pemain terhubung, termasuk host, dan semuanya harus ready.",
  CAPACITY: "Room ini sudah penuh. Coba bergabung ke room lain.",
  ACTIVE_MATCH: "Pertandingan sedang berjalan. Tunggu sampai selesai.",
  INVALID_QUESTIONS: "Stok soal untuk konfigurasi ini tidak cukup. Pilih tipe lain atau kurangi jumlah soal.",
  INVALID_CHOICE: "Pilihan tidak tersedia untuk soal ini.",
  NOT_PLAYING: "Anda sedang menonton pertandingan ini.",
  OUTSIDE_WINDOW: "Waktu menjawab soal ini sudah berakhir atau belum dimulai.",
  ALREADY_ANSWERED: "Jawaban pertama sudah tersimpan dan tidak dapat diubah.",
  NICKNAME_TAKEN: "Nickname sudah dipakai di room ini. Pilih nama lain.",
  KICKED: "Kamu telah dikeluarkan dari room oleh host.",
  INVALID_TARGET: "Peserta tidak ditemukan atau tidak dapat dikeluarkan.",
  RATE_LIMITED: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
  UNAVAILABLE: "Permainan sementara tidak tersedia. Coba sambungkan kembali nanti.",
  SOLO_PRIVATE: "Sesi solo hanya dapat diakses pemiliknya.",
  MODE_MISMATCH: "Mode sesi tidak dapat diubah. Buat sesi baru untuk mengganti mode.",
};

export function clashFailure(error: unknown) {
  if (error instanceof ClashError) return { ok: false as const, code: error.code, message: messages[error.code] };
  if (error instanceof ZodError) return { ok: false as const, code: "INVALID_INPUT", message: "Isian tidak valid. Periksa nickname, kode, atau konfigurasi soal." };
  reportServerError("kotoba_clash.request.failed", error);
  return { ok: false as const, code: "UNAVAILABLE", message: messages.UNAVAILABLE };
}

export async function clashBoundary<T>(work: () => Promise<T>) {
  try { return { ok: true as const, data: await work() }; }
  catch (error: unknown) { return clashFailure(error); }
}
