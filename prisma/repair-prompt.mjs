// Prompt perbaikan data soal. Dipisah seperti explanation-prompt.mjs supaya isi
// instruksinya bisa ditinjau tanpa membaca logika antrian dan validasi.
//
// Prinsipnya: data asli dipertahankan sebanyak mungkin. Soal-soal ini berasal
// dari naskah ujian sungguhan, dan yang rusak biasanya hanya satu bagian —
// stem hilang, satu pilihan tertimpa duplikat, atau penanda garis bawah tidak
// tertutup. Menulis ulang seluruh soal padahal hanya satu bagian yang cacat
// justru membuang data yang masih sahih.

export const REPAIR_PROMPT_VERSION = "repair-v1";

export const REPAIR_SYSTEM_PROMPT = `Anda editor bank soal JLPT. Tugas Anda memperbaiki satu butir soal yang datanya cacat akibat kesalahan ekstraksi dari naskah ujian.

PRINSIP UTAMA — pertahankan data asli:
- Ubah HANYA bagian yang disebut cacat. Bagian lain disalin persis apa adanya, termasuk spasi dan tanda baca.
- Kunci jawaban resmi diperlakukan sebagai benar. Susun perbaikan sedemikian rupa sehingga kunci itu tetap menjadi satu-satunya jawaban benar.
- Kunci hanya boleh diubah bila secara objektif mustahil dipertahankan (misalnya teks pilihan yang ditunjuk kunci jelas salah tulis). Jelaskan di ALASAN bila Anda mengubahnya.
- Bila stem soal hilang sama sekali tetapi pilihan dan kunci masih ada, tulis stem baru yang membuat kunci itu benar dan ketiga pilihan lain salah. Tiru gaya soal JLPT asli untuk tipe mondai tersebut: kalimat pendek, kosakata sesuai level, konteks sehari-hari.
- PENGECUALIAN: bila cacat menyebutkan bahwa verifikasi independen menjawab berbeda dari kunci resmi, periksa sendiri teks soalnya. Bila teks soal sudah lengkap dan konsisten serta hanya satu susunan yang wajar, berarti kunci resminyalah yang keliru — perbaiki KUNCI agar sesuai jawaban yang benar-benar didukung teks, dan jangan mengubah stem maupun pilihan hanya demi mempertahankan kunci lama. Sebaliknya bila teks soal yang tampak terpotong, perbaiki teksnya dan pertahankan kunci.
- PENGECUALIAN PENTING: bila cacat yang disebutkan adalah "pilihan identik dengan soal lain", berarti blok pilihan milik soal lain tergeser ke soal ini dan pilihan aslinya hilang. Dalam kasus itu kunci resmi TIDAK berlaku — ia milik soal pemiliknya. Tulis empat pilihan baru yang sesuai dengan stem soal ini, lalu tentukan sendiri kuncinya. Jangan menyalin satu pun pilihan yang tergeser itu.
- Bila stem soal memuat slot [_] atau [★] padahal tipe mondainya bukan 文の組み立て, stem itu pun ikut tergeser dari soal lain. Tulis stem baru yang wajar untuk tipe mondai ini, beserta empat pilihannya.
- Bila soal hanya dapat dijawab lewat gambar yang tidak tersedia, ubah soal menjadi dapat dijawab dari teks: tulis stem (dan bila perlu bacaan pendek) yang memuat informasi yang tadinya ada di gambar, tanpa mengubah pilihan dan kunci.

ATURAN PENULISAN:
- Markup yang diizinkan hanya: {漢字|かんじ} untuk furigana, __teks__ untuk garis bawah, serta [_] dan [★] sebagai slot soal 文の組み立て. Dilarang HTML, markdown, dan tanda lain.
- Ikuti gaya penulisan data aslinya. Jangan menambahkan furigana di tempat yang aslinya tidak memakainya, kecuali memang dibutuhkan agar soal terbaca.
- Untuk 漢字読み, kanji yang ditanyakan ditulis lengkap dengan furigana di dalam garis bawah, misalnya __{雨|あめ}__ — frontend yang menyembunyikannya saat ujian.
- Untuk 文の組み立て, stem wajib memuat tepat tiga [_] dan satu [★] berurutan pada posisi slot, dan kunci jawaban adalah pilihan yang jatuh di posisi [★] pada urutan kalimat yang benar. Pastikan keempat pilihan dapat disusun menjadi satu kalimat yang gramatikal bersama teks tetap di sekitarnya.
- Keempat pilihan harus berbeda satu sama lain. Pengecoh harus masuk akal: mirip bentuk, bunyi, atau makna, bukan asal beda.

FORMAT KELUARAN (wajib persis, satu label per baris, tanpa pembuka atau penutup lain):
TINDAKAN: <perbaiki | tulis-ulang | tidak-bisa>
ALASAN: <satu-dua kalimat: apa yang rusak dan bagaimana Anda menanganinya>
STEM: <teks soal hasil perbaikan; boleh beberapa baris>
BACAAN: <bacaan pendek bila soal memerlukannya, atau - bila tidak>
PILIHAN 1: <teks pilihan 1>
PILIHAN 2: <teks pilihan 2>
PILIHAN 3: <teks pilihan 3>
PILIHAN 4: <teks pilihan 4>
KUNCI: <1-4>
PERUBAHAN: <daftar singkat bagian yang Anda ubah, dipisah titik koma>

Pakai TINDAKAN: tidak-bisa hanya bila data yang tersisa tidak cukup untuk membuat soal yang sahih sekalipun dengan menulis stem baru.`;

const MONDAI_LABELS = {
  MOJI_GOI_READ_KANJI: "漢字読み — cara baca kanji yang digarisbawahi",
  MOJI_GOI_WRITE_KANJI: "表記 — penulisan kanji dari kata hiragana yang digarisbawahi",
  MOJI_GOI_WORD_FORMATION: "語形成 — pembentukan kata dengan imbuhan atau kata majemuk",
  MOJI_GOI_CONTEXT: "文脈規定 — memilih kata yang cocok dengan konteks kalimat",
  MOJI_GOI_SYNONYM: "言い換え類義 — sinonim/parafrase bagian yang digarisbawahi",
  MOJI_GOI_WORD_USAGE: "用法 — kalimat mana yang memakai kata itu dengan benar",
  BUNPOU_GRAMMAR: "文法形式の判断 — memilih bentuk gramatikal yang tepat",
  BUNPOU_SENTENCE_COMPOSITION: "文の組み立て — menyusun kalimat, jawaban = pilihan di posisi [★]",
  BUNPOU_TEXT_GRAMMAR: "文章の文法 — tata bahasa dalam wacana utuh",
  DOKKAI_SHORT_TEXT: "内容理解（短文）",
  DOKKAI_MEDIUM_TEXT: "内容理解（中文）",
  DOKKAI_LONG_TEXT: "内容理解（長文）",
  DOKKAI_INTEGRATED: "統合理解 — membandingkan dua bacaan",
  DOKKAI_MAIN_IDEA: "主張理解 — menangkap klaim penulis",
  DOKKAI_INFORMATION_RETRIEVAL: "情報検索 — mencari informasi di pengumuman/brosur",
};

export function buildRepairPrompt({ pkg, item, question, context, defects }) {
  const lines = [
    `Level: JLPT ${pkg.jlptLevel}`,
    `Mondai: ${MONDAI_LABELS[item.mondaiType] ?? item.mondaiType}`,
  ];

  if (item.instruction) lines.push(`Instruksi mondai: ${item.instruction}`);
  if (context?.storyText) lines.push("", "Bacaan yang terpasang pada soal ini:", context.storyText);
  if (question.questionImage) lines.push("", `Soal ini merujuk gambar: ${question.questionImage}`);

  lines.push(
    "",
    "Data soal saat ini:",
    `STEM: ${question.questionText || "(kosong — hilang saat ekstraksi)"}`,
  );

  for (const choice of [...question.questionChoices].sort((a, b) => a.codeAnswer - b.codeAnswer)) {
    lines.push(`PILIHAN ${choice.codeAnswer}: ${choice.answerText || "(kosong)"}`);
  }
  lines.push(`KUNCI RESMI: ${question.questionAnswer}`);

  lines.push("", "Cacat yang terdeteksi:");
  for (const defect of defects) lines.push(`- ${defect}`);

  return lines.join("\n");
}

// Verifikasi independen: model mengerjakan soal hasil perbaikan tanpa diberi
// kunci. Kalau jawabannya tidak cocok, perbaikan itu tidak dipakai. Ini pagar
// yang paling penting, karena di sinilah soal yang "terlihat rapi tetapi
// jawabannya tidak tunggal" tersaring.
export const SOLVER_SYSTEM_PROMPT = `Anda peserta ujian JLPT yang teliti. Kerjakan satu butir soal dan pilih satu jawaban yang paling tepat.

Markup yang mungkin muncul: {漢字|かんじ} adalah kanji beserta cara bacanya, __teks__ adalah bagian yang digarisbawahi, [_] dan [★] adalah slot kosong pada soal menyusun kalimat (jawaban untuk soal semacam itu adalah pilihan yang jatuh tepat di posisi [★] pada urutan kalimat yang benar).

Jawab HANYA dengan dua baris berikut, tanpa penjelasan lain:
ALASAN: <satu kalimat singkat>
JAWABAN: <1, 2, 3, atau 4>`;

export function buildSolverPrompt({ pkg, item, question, context }) {
  const lines = [`Level: JLPT ${pkg.jlptLevel}`, `Mondai: ${MONDAI_LABELS[item.mondaiType] ?? item.mondaiType}`];
  if (item.instruction) lines.push(`Instruksi: ${item.instruction}`);
  if (context?.storyText) lines.push("", "Bacaan:", context.storyText);
  lines.push("", `Soal: ${question.questionText}`, "", "Pilihan:");
  for (const choice of [...question.questionChoices].sort((a, b) => a.codeAnswer - b.codeAnswer)) {
    lines.push(`${choice.codeAnswer}. ${choice.answerText}`);
  }
  return lines.join("\n");
}
