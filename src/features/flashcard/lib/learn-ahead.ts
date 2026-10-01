/**
 * Learn ahead limit Anki (default 20 menit): kartu learning boleh tampil
 * sedikit lebih awal, tetapi kartu dengan step 2 jam tidak boleh muncul
 * seketika hanya karena jatuh temponya masih hari ini.
 *
 * Modul terpisah supaya reviewer di client bisa memakainya tanpa ikut memuat
 * scheduler (ts-fsrs).
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;
