// Catatan yang ditulis selama exam berjalan. Dipakai bersama oleh runner
// (client) dan action (server), jadi file ini tidak boleh mengimpor apa pun
// yang hanya ada di server.

/** Sama dengan batas isi Catatan Belajar, karena catatan ini dipindahkan ke sana saat submit. */
export const EXAM_NOTE_MAX_LENGTH = 2000;

/** Isi catatan yang layak disimpan; `null` bila hanya spasi atau kosong. */
export function examNoteText(note: string | null | undefined) {
  const text = note?.trim() ?? "";
  return text === "" ? null : text;
}
