// Prompt generator pembahasan soal. Dipisah dari script-nya supaya isi prompt
// bisa dibaca dan diubah tanpa menyentuh logika antrian, retry, dan penulisan
// file — dan supaya `promptVersion` di database benar-benar merujuk ke satu
// berkas yang jelas.
//
// Bentuk keluaran diminta lewat label, bukan `response_format: json_schema`.
// Gateway yang dipakai project ini pernah mengabaikan json_schema diam-diam
// (status 200 tetapi isinya teks biasa); label tetap bisa di-parse apa pun yang
// terjadi. Catatan yang sama ada di src/features/conversation/lib/provider/openai.ts.

export const PROMPT_VERSION = "explanation-v1";

const MONDAI_LABELS = {
  MOJI_GOI_READ_KANJI: "漢字読み — cara baca kanji yang digarisbawahi",
  MOJI_GOI_WRITE_KANJI: "表記 — penulisan kanji dari kata hiragana yang digarisbawahi",
  MOJI_GOI_WORD_FORMATION: "語形成 — pembentukan kata dengan imbuhan atau kata majemuk",
  MOJI_GOI_CONTEXT: "文脈規定 — memilih kata yang cocok dengan konteks kalimat",
  MOJI_GOI_SYNONYM: "言い換え類義 — sinonim/parafrase kata yang digarisbawahi",
  MOJI_GOI_WORD_USAGE: "用法 — kalimat mana yang memakai kata itu dengan benar",
  BUNPOU_GRAMMAR: "文法形式の判断 — memilih bentuk gramatikal yang tepat",
  BUNPOU_SENTENCE_COMPOSITION:
    "文の組み立て — menyusun kalimat; jawaban adalah pilihan yang jatuh di posisi [★]",
  BUNPOU_TEXT_GRAMMAR: "文章の文法 — tata bahasa dalam wacana utuh",
  DOKKAI_SHORT_TEXT: "内容理解（短文） — pemahaman bacaan pendek",
  DOKKAI_MEDIUM_TEXT: "内容理解（中文） — pemahaman bacaan menengah",
  DOKKAI_LONG_TEXT: "内容理解（長文） — pemahaman bacaan panjang",
  DOKKAI_INTEGRATED: "統合理解 — membandingkan dua bacaan",
  DOKKAI_MAIN_IDEA: "主張理解 — menangkap klaim/pendapat penulis",
  DOKKAI_INFORMATION_RETRIEVAL: "情報検索 — mencari informasi di pengumuman/brosur",
  CHOUKAI_TASK_BASED: "課題理解 — apa yang harus dilakukan selanjutnya",
  CHOUKAI_MAIN_POINT: "ポイント理解 — poin penting percakapan",
  CHOUKAI_OUTLINE: "概要理解 — gambaran umum isi audio",
  CHOUKAI_EXPRESSION: "発話表現 — ungkapan yang tepat untuk situasi bergambar",
  CHOUKAI_QUICK_RESPONSE: "即時応答 — respons cepat atas satu ucapan",
  CHOUKAI_INTEGRATED: "統合理解 — integrasi informasi dari audio panjang",
};

export const SYSTEM_PROMPT = `Anda pengajar JLPT berpengalaman yang menulis pembahasan soal untuk pelajar Indonesia.

Tulis pembahasan dalam BAHASA INDONESIA. Setiap kali mengutip kata atau kalimat Jepang, tulis teks Jepangnya lalu terjemahannya dalam kurung.

ATURAN PENULISAN TEKS JEPANG (wajib, tidak boleh dilanggar):
- Semua kanji yang Anda tulis harus memakai furigana dengan format {漢字|かんじ}. Contoh: {勉強|べんきょう}する, {会社|かいしゃ}. Ini berlaku juga untuk istilah teknis: tulis {訓読み|くんよみ}, {音読み|おんよみ}, {促音|そくおん}, {連濁|れんだく} — bukan 訓読み atau 音読み tanpa furigana. Tidak boleh ada satu pun kanji di luar format {漢字|かんじ}.
- Untuk menandai bagian yang sedang dibahas, bungkus dengan garis bawah: __teks__. Boleh berisi furigana: __{勉強|べんきょう}する__.
- [_] dan [★] adalah slot soal 文の組み立て. Tulis apa adanya bila perlu dirujuk, jangan diisi.
- DILARANG memakai HTML, markdown (**tebal**, # judul, - daftar), emoji, tabel, atau kutipan berblok. Karakter __ dan { | } hanya boleh dipakai untuk markup di atas.

ATURAN ISI:
- Jelaskan lebih dulu apa yang sebenarnya ditanyakan soal, baru alasan kunci jawabannya benar.
- Beri terjemahan dalam kurung hanya pada kemunculan pertama sebuah kata atau frasa; jangan mengulang terjemahan yang sama berkali-kali dalam satu pembahasan.
- Isi TERJEMAHAN hanya dengan kalimat bahasa Indonesia, tanpa menyalin ulang teks Jepangnya.
- Isi POIN hanya dengan nama kosakata atau pola gramatikalnya, tanpa penanda __garis bawah__.
- Alasan tiap pilihan ditulis langsung setelah BENAR/SALAH, tanpa diawali tanda hubung atau penomoran.
- Bahas keempat pilihan satu per satu. Untuk pilihan yang salah, sebutkan kenapa ia menggoda dan apa yang membuatnya tidak tepat.
- Jangan mengarang isi audio, gambar, atau bagian bacaan yang tidak diberikan kepada Anda. Kalau datanya memang tidak cukup, katakan terus terang di RINGKASAN.
- Kunci jawaban resmi diberikan kepada Anda. Bila menurut Anda kunci itu keliru, jangan memaksakan pembenaran: tulis KUNCI_MERAGUKAN: ya beserta alasannya.

FORMAT KELUARAN (wajib persis seperti ini, satu label per baris, tanpa pembuka atau penutup lain):
RINGKASAN: <1-2 kalimat, kenapa kunci jawaban benar>
PEMBAHASAN: <penjelasan menyeluruh, boleh beberapa baris>
TERJEMAHAN: <terjemahan kalimat kunci soal ke bahasa Indonesia, atau - bila tidak relevan>
POIN: <kosakata/pola grammar yang diuji, dipisah tanda titik koma>
PILIHAN 1: <BENAR atau SALAH> - <alasan>
PILIHAN 2: <BENAR atau SALAH> - <alasan>
PILIHAN 3: <BENAR atau SALAH> - <alasan>
PILIHAN 4: <BENAR atau SALAH> - <alasan>
KUNCI_MERAGUKAN: <ya atau tidak>
CATATAN_KUNCI: <alasan bila ya, atau - bila tidak>`;

export function buildUserPrompt({ pkg, item, question, context }) {
  const lines = [
    `Level: JLPT ${pkg.jlptLevel}`,
    `Paket: ${pkg.name}`,
    `Mondai: ${MONDAI_LABELS[item.mondaiType] ?? item.mondaiType}`,
  ];

  if (item.instruction) lines.push(`Instruksi mondai: ${item.instruction}`);

  if (context?.storyText) {
    lines.push("", "Bacaan/wacana yang dipakai soal ini:", context.storyText);
  }

  lines.push("", `Soal nomor ${question.order}:`, question.questionText || "(tidak ada teks soal)");

  lines.push("", "Pilihan jawaban:");
  for (const choice of [...question.questionChoices].sort((a, b) => a.codeAnswer - b.codeAnswer)) {
    lines.push(`${choice.codeAnswer}. ${choice.answerText || "(pilihan tanpa teks)"}`);
  }

  lines.push("", `Kunci jawaban resmi: ${question.questionAnswer}`);

  if (item.mondaiType === "MOJI_GOI_READ_KANJI") {
    lines.push(
      "",
      "Catatan tipe soal: furigana pada teks soal hanya ada di data dan disembunyikan dari peserta saat soal ditampilkan. JANGAN menjadikan furigana itu sebagai alasan jawaban. Jelaskan bacaannya sendiri: on'yomi/kun'yomi kanji tersebut, kata lain yang memakai bacaan yang sama, dan jebakan bunyi pada pilihan lain (sokuon, vokal panjang, rendaku).",
    );
  }

  if (item.mondaiType === "BUNPOU_SENTENCE_COMPOSITION") {
    lines.push(
      "",
      "Catatan tipe soal: jawaban yang benar adalah pilihan yang menempati posisi [★] pada urutan kalimat yang betul. Tunjukkan urutan lengkap keempat pilihan dalam pembahasan.",
    );
  }

  return lines.join("\n");
}
