// Web Speech API belum ada di lib DOM TypeScript, jadi bentuk yang dipakai
// dideklarasikan di sini secara eksplisit. Ini juga menjaga aturan project:
// data dari platform API masuk sebagai bentuk yang dinarrow, bukan `any`.

export type SpeechRecognitionAlternativeLike = {
  readonly transcript: string;
  readonly confidence: number;
};

export type SpeechRecognitionResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
};

export type SpeechRecognitionResultListLike = {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
};

export type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = {
  readonly error: string;
  readonly message?: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export type SpeechSupport = {
  /** Pengenalan suara tersedia (praktisnya baru Chromium). */
  recognition: boolean;
  /** Akses mikrofon tersedia; dibutuhkan indikator level suara. */
  media: boolean;
};

export function detectSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined") return { recognition: false, media: false };

  return {
    recognition: getSpeechRecognitionConstructor() !== null,
    media:
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
  };
}

// Pesan diarahkan ke tindakan yang bisa diambil user, bukan menyalin kode
// error mentah dari browser.
export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Izin mikrofon ditolak. Aktifkan izin di pengaturan situs, atau ketik jawabanmu.";
    case "no-speech":
      return "Tidak ada suara yang terdengar. Coba rekam lagi atau ketik jawabanmu.";
    case "audio-capture":
      return "Mikrofon tidak terbaca. Periksa perangkat, atau ketik jawabanmu.";
    case "network":
      return "Pengenalan suara butuh koneksi internet. Coba lagi atau ketik jawabanmu.";
    case "aborted":
      return "Perekaman dihentikan sebelum selesai.";
    default:
      return "Pengenalan suara gagal. Ketik jawabanmu sebagai gantinya.";
  }
}
