// Konstanta modul conversation yang tidak berasal dari environment.
// Dipisahkan dari `src/constants/index.ts` karena file ini diimpor juga oleh
// komponen client, sedangkan index memvalidasi env server saat modul dimuat.

// Dinaikkan setiap kali blok system prompt berubah, supaya hasil lama tetap
// dapat dijelaskan setelah prompt diperbarui.
export const CONVERSATION_PROMPT_VERSION = "2026-09-04.1";

// Batas biaya, bukan batas teknis: konteks model jauh lebih besar dari ini.
export const CONVERSATION_MAX_TURNS_PER_SESSION = 40;
export const CONVERSATION_MAX_USER_CHARS = 500;

// Dinaikkan setiap kali rubrik koreksi berubah, supaya feedback lama tetap
// dapat dijelaskan setelah rubriknya diperbarui.
export const CONVERSATION_RUBRIC_VERSION = "2026-09-05.1";
