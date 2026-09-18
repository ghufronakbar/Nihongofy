// Tipe domain modul conversation. File ini tidak mengimpor apa pun dari feature
// lain supaya fixture, schema, dan provider dapat memakainya tanpa siklus impor.

// Scope rilis pertama (P-1): percakapan sehari-hari untuk level bawah.
// Menambah N2/N1 cukup memperluas daftar ini beserta fixture persona.
export const CONVERSATION_LEVELS = ["N5", "N4", "N3"] as const;
export type ConversationLevel = (typeof CONVERSATION_LEVELS)[number];

// Kosakata disamakan dengan prototype referensi supaya persona terbaca sama
// oleh user, meski implementasi dan asetnya berbeda.
export type ConversationPersonality =
  | "friendly"
  | "strict"
  | "playful"
  | "professional"
  | "shy"
  | "tsundere";
export type ConversationVoiceType = "cute" | "cool" | "calm" | "energetic" | "formal";
export type ConversationGender = "female" | "male";
export type ConversationAccent = "blue" | "coral" | "yellow" | "green";

/** State tampilan karakter. Murni presentasi, tidak disimpan. */
export type CharacterState =
  | "idle"
  | "talking"
  | "listening"
  | "happy"
  | "thinking"
  | "tsun";

export const CHARACTER_STATES: readonly CharacterState[] = [
  "idle",
  "talking",
  "listening",
  "happy",
  "thinking",
  "tsun",
];

/**
 * Aset ilustrasi berlapis. Bila terisi, karakter dirender dari gambar; bila
 * tidak, komponen jatuh ke ilustrasi SVG parametrik. Karena itu persona tanpa
 * aset tetap tampil dan aset dapat dipasang satu per satu.
 *
 * Kontrak berkasnya ada di `docs/module/conversation-persona-assets.md`.
 */
export type PersonaArt = {
  /** Direktori di bawah `public/`, tanpa garis miring penutup. */
  basePath: string;
  width: number;
  height: number;
  /**
   * Kotak potong persegi dalam piksel sumber. Diukur dari aset, bukan ditebak
   * lewat transform CSS, supaya framing tiap karakter tetap benar meski
   * proporsi gambarnya berbeda.
   */
  crops: {
    head: PersonaCrop;
    bust: PersonaCrop;
  };
};

export type PersonaCrop = { x: number; y: number; size: number };

export type PersonaHairStyle = "long" | "twintail" | "bob" | "spiky" | "straight" | "messy";
export type PersonaAccessory = "none" | "ribbon" | "glasses" | "headphones";

/**
 * Parameter karakter untuk ilustrasi SVG yang digambar sendiri. Digambar
 * parametrik, bukan aset per-karakter, supaya menambah persona tidak berarti
 * menambah berkas gambar — dan tidak ada generator avatar pihak ketiga yang
 * dipanggil saat runtime (X-5).
 */
export type PersonaAppearance = {
  hair: PersonaHairStyle;
  hairColor: string;
  hairShadeColor: string;
  eyeColor: string;
  skinColor: string;
  outfitColor: string;
  accessory: PersonaAccessory;
};

export type ConversationPersona = {
  key: string;
  name: string;
  nameJapanese: string;
  /** Karakter kanji tunggal; dipakai sebagai lencana kecil dan fallback teks. */
  initial: string;
  appearance: PersonaAppearance;
  gender: ConversationGender;
  personality: ConversationPersonality;
  voiceType: ConversationVoiceType;
  accent: ConversationAccent;
  /** Deskripsi untuk user, bahasa Indonesia. */
  description: string;
  descriptionJapanese: string;
  tags: readonly string[];
  /** Instruksi gaya bicara untuk system prompt provider nyata (Tahap E). */
  speechStyle: string;
  greeting: string;
  greetingTranslation: string;
  greetingRomaji: string;
  /**
   * Pembeda suara pada TTS browser. Satu perangkat sering hanya punya satu
   * suara ja-JP, jadi karakter dibedakan lewat rate dan pitch — jujur terhadap
   * kemampuan yang ada, bukan menjanjikan aktor suara berbeda.
   */
  /**
   * `preferred` adalah nama suara ja-JP menurut urutan prioritas. Perangkat
   * menyediakan beberapa suara dengan gender berbeda, jadi tanpa daftar ini
   * pilihannya jatuh ke suara pertama yang ditemukan — kerap salah gender.
   */
  voice: { rate: number; pitch: number; preferred: readonly string[] };
  art?: PersonaArt;
  supportedLevels: readonly ConversationLevel[];
};

export type ConversationTopic = {
  key: string;
  label: string;
  labelJapanese: string;
  icon: string;
};

export type ConversationRole = "USER" | "ASSISTANT";

export type ConversationTurn = {
  id: string;
  role: ConversationRole;
  contentJa: string;
  contentTranslation: string | null;
  contentRomaji: string | null;
  createdAt: string;
};
