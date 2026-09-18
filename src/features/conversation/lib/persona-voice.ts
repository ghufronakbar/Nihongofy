"use client";

import type { ConversationPersona } from "../types";

// TTS browser dengan pemilihan suara per persona.
//
// Perangkat biasanya menyediakan beberapa suara ja-JP dengan gender berbeda.
// Mengambil yang pertama ditemukan menghasilkan pilihan acak — pada macOS
// yang terambil adalah "Eddy", suara laki-laki, untuk semua persona.
// Karena itu tiap persona menyebutkan urutan preferensinya sendiri.
//
// Terpisah dari `features/study/lib/tts.ts` yang dipakai kana dan flashcard,
// karena di sana rate sengaja tetap dan tidak boleh ikut berubah.

export type SpeakResult = { ok: true } | { ok: false; message: string };

// Nama suara Jepang yang gendernya diketahui, dipakai sebagai cadangan bila
// tidak ada satu pun nama preferensi persona yang tersedia. Mencakup macOS,
// Windows, dan Chrome.
const KNOWN_FEMALE_VOICES = [
  "kyoko",
  "o-ren",
  "flo",
  "shelley",
  "sandy",
  "grandma",
  "nanami",
  "ayumi",
  "haruka",
  "mizuki",
];

const KNOWN_MALE_VOICES = [
  "hattori",
  "eddy",
  "reed",
  "rocko",
  "grandpa",
  "ichiro",
  "keita",
  "daichi",
  "takumi",
];

// `speechSynthesis.getVoices()` terisi secara asinkron. Pada pemanggilan
// pertama setelah halaman dimuat, daftarnya kerap masih kosong — dan ketika
// kosong, tidak ada suara yang dapat dipilih sehingga browser memakai suara
// bawaannya, yang pada banyak perangkat adalah suara laki-laki. Itulah sebabnya
// ucapan pertama terdengar berbeda dari ucapan berikutnya.
//
// Daftar disimpan di cache modul dan diperbarui saat browser mengumumkannya.
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesSubscribed = false;

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
}

function ensureVoicesSubscription() {
  if (voicesSubscribed || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  voicesSubscribed = true;
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

/** Dipanggil sedini mungkin supaya daftar suara sudah siap saat dibutuhkan. */
export function primeVoices() {
  ensureVoicesSubscription();
}

export function canSpeak() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/** Seluruh suara berbahasa Jepang yang tersedia di perangkat ini. */
export function japaneseVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  ensureVoicesSubscription();
  refreshVoices();
  return cachedVoices.filter((voice) => voice.lang.toLowerCase().startsWith("ja"));
}

function matchByName(voices: SpeechSynthesisVoice[], names: readonly string[]) {
  for (const wanted of names) {
    const found = voices.find((voice) => voice.name.toLowerCase().includes(wanted.toLowerCase()));
    if (found) return found;
  }
  return null;
}

export function pickVoiceForPersona(persona: ConversationPersona): SpeechSynthesisVoice | null {
  const voices = japaneseVoices();
  if (voices.length === 0) return null;

  // 1. Nama yang disebut persona, menurut urutannya.
  const preferred = matchByName(voices, persona.voice.preferred);
  if (preferred) return preferred;

  // 2. Suara mana pun yang gendernya cocok.
  const byGender = matchByName(
    voices,
    persona.gender === "female" ? KNOWN_FEMALE_VOICES : KNOWN_MALE_VOICES,
  );
  if (byGender) return byGender;

  // 3. Menyerah pada apa pun yang ada — lebih baik bersuara daripada bisu.
  return voices[0] ?? null;
}

type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
};

export function speakAsPersona(
  text: string,
  persona: ConversationPersona,
  handlers: SpeakHandlers = {},
): SpeakResult {
  if (!canSpeak()) {
    return {
      ok: false,
      message: "Suara tidak tersedia di browser ini. Latihan tetap bisa dilanjutkan tanpa audio.",
    };
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = persona.voice.rate;
    utterance.pitch = persona.voice.pitch;

    const voice = pickVoiceForPersona(persona);
    if (voice) utterance.voice = voice;

    // Animasi karakter digerakkan oleh awal dan akhir ucapan yang sebenarnya,
    // bukan timer tebakan. Web Speech Synthesis tidak mengekspos aliran
    // audionya, jadi sinkronisasi per suku kata belum mungkin di sini.
    if (handlers.onStart) utterance.onstart = handlers.onStart;
    if (handlers.onEnd) {
      utterance.onend = handlers.onEnd;
      utterance.onerror = handlers.onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Audio gagal diputar. Latihan tetap bisa dilanjutkan tanpa audio.",
    };
  }
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
