// Pemeriksaan mutu isi fixture bank soal, dipakai bersama oleh `fixture:lint`
// (melaporkan) dan `fixture:repair` (memperbaiki). Keduanya wajib memakai
// definisi cacat yang sama, kalau tidak perbaikan bisa "lolos" di satu script
// tetapi tetap dilaporkan di script lain.
//
// Seluruh pemeriksaan di sini deterministik: tidak ada pemanggilan model.

export function markupProblems(label, text) {
  const problems = [];
  if (!text) return problems;

  if ((text.match(/__/g) ?? []).length % 2 !== 0) {
    problems.push({ level: "error", message: `${label}: penanda __ tidak berpasangan` });
  }

  const openBraces = (text.match(/\{/g) ?? []).length;
  const closeBraces = (text.match(/\}/g) ?? []).length;
  const validFurigana = (text.match(/\{[^{}|]+\|[^{}|]+\}/g) ?? []).length;
  if (openBraces !== closeBraces || openBraces !== validFurigana) {
    problems.push({ level: "error", message: `${label}: format furigana {漢字|かんじ} rusak` });
  }

  if (/<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(text)) {
    problems.push({ level: "error", message: `${label}: mengandung tag HTML` });
  }

  if (stripOcrArtifacts(text).changed) {
    problems.push({ level: "error", message: `${label}: memuat sisa OCR (pemisah halaman/header naskah)` });
  }

  return problems;
}

export function checkQuestion({ item, question, context }) {
  const problems = [];
  const isChoukai = item.section === "CHOUKAI";
  const stem = (question.questionText ?? "").trim();
  const storyText = (context?.storyText ?? "").trim();

  // Soal tanpa teks apa pun hanya wajar untuk choukai (soalnya terdengar di
  // audio). Di seksi lain artinya ekstraksi kehilangan stem soal.
  if (!isChoukai && !stem && !storyText) {
    problems.push({ level: "error", message: "tidak punya stem maupun bacaan" });
  } else if (!isChoukai && !stem && storyText && !question.questionImage) {
    problems.push({ level: "warning", message: "stem kosong, hanya mengandalkan bacaan" });
  }

  // Pilihan kembar membuat soal tidak punya satu jawaban benar.
  const seen = new Map();
  for (const choice of question.questionChoices) {
    const text = (choice.answerText ?? "").trim();
    if (!text) {
      // Soal pilihan-bergambar JLPT memuat keempat opsinya di dalam satu gambar
      // soal, dan tombol pilihannya memang tanpa teks. Selama questionImage ada,
      // pilihan kosong itu format asli, bukan data yang hilang.
      if (!isChoukai && !choice.answerImage && !question.questionImage) {
        problems.push({
          level: "warning",
          message: `pilihan ${choice.codeAnswer} tidak punya teks maupun gambar`,
        });
      }
      continue;
    }
    const previous = seen.get(text);
    if (previous) {
      problems.push({
        level: "error",
        message: `pilihan ${previous} dan ${choice.codeAnswer} isinya sama persis: ${text}`,
      });
    } else {
      seen.set(text, choice.codeAnswer);
    }
  }

  // 文の組み立て: stem harus memuat tepat satu [★] dan tiga [_], berurutan di
  // posisi slot. Stem yang memuat ★ nyasar di tengah kalimat plus deretan slot
  // menempel di ujung adalah cacat salin yang membuat posisi ★ tidak dapat
  // ditentukan — dan karenanya kunci jawaban tidak dapat diperiksa.
  if (item.mondaiType === "BUNPOU_SENTENCE_COMPOSITION") {
    const starSlots = (stem.match(/\[★\]/g) ?? []).length;
    const blankSlots = (stem.match(/\[_\]/g) ?? []).length;
    if (starSlots !== 1 || blankSlots !== 3) {
      problems.push({
        level: "error",
        message: `slot 文の組み立て tidak utuh: ${blankSlots}x [_] dan ${starSlots}x [★], seharusnya 3 dan 1`,
      });
    }
    if (/★/.test(stem.replace(/\[★\]/g, ""))) {
      problems.push({ level: "error", message: "ada karakter ★ di luar slot [★]" });
    }
  }

  // Aset yang masih placeholder sesuai kontrak docs/seed.md.
  for (const [label, value] of [
    ["questionImage", question.questionImage],
    ["questionAudio", question.questionAudio],
  ]) {
    if (typeof value === "string" && value.startsWith("TODO")) {
      problems.push({ level: "warning", message: `${label} masih placeholder: ${value}` });
    }
  }

  problems.push(...markupProblems("questionText", question.questionText));
  for (const choice of question.questionChoices) {
    problems.push(...markupProblems(`pilihan ${choice.codeAnswer}`, choice.answerText));
  }

  return problems;
}

// Furigana hanya bermakna di atas kanji. Generator kerap memasangnya juga pada
// kana, katakana, angka, bahkan kata Indonesia ({が|が}, {エサ|えさ},
// {Kualifikasi|しかく}) karena diminta memberi furigana pada "semua kanji".
// Hasilnya dirender sebagai ruby di atas teks yang tidak membutuhkannya.
//
// Dua bentuk yang diperbaiki: basis tanpa kanji sementara kanjinya justru
// ditaruh sebagai bacaan (tertukar, tinggal ditukar balik), dan basis tanpa
// kanji dengan bacaan yang juga tanpa kanji (furigananya dibuang).
export function stripRedundantFurigana(text) {
  if (!text) return { text, changed: false };

  const cleaned = text.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (full, base, reading) => {
    if (/[\u4E00-\u9FFF]/.test(base)) return full;
    // Tertukar: kanji ditaruh sebagai bacaan dan kana sebagai basis ({あきら|諦}).
    if (/[\u4E00-\u9FFF]/.test(reading)) return `{${reading}|${base}}`;
    // Tidak ada kanji di kedua sisi, jadi furigana tidak bermakna apa pun.
    return base;
  });

  return { text: cleaned, changed: cleaned !== text };
}

// Sisa mentah proses OCR: baris pemisah halaman dan header naskah ujian yang
// ikut tersalin ke dalam teks soal. Dua format ditemui di korpus ini,
// `--- PAGE 9 ---` dan `===== PAGE 10 =====`, biasanya diikuti satu baris
// header "2017 年 07 月新日本語能力試験Ｎ3".
//
// Potongan ini kerap jatuh di tengah kalimat (…必要な量 [sampah] を集める), jadi
// penggantinya ditentukan dari karakter sebelum blok: bila kalimatnya belum
// selesai, kedua sisi disambung langsung; bila sudah, jeda paragraf
// dipertahankan.
const OCR_ARTIFACT =
  /\n*[ \t]*[-=]{3,}[ \t]*PAGE[ \t]*\d+[ \t]*[-=]{3,}[ \t]*\n?(?:[ \t]*\d{4}[ \t]*年[ \t]*\d+[ \t]*月新日本語能力試験[^\n]*\n?)?/gi;

export function stripOcrArtifacts(text) {
  if (!text || !OCR_ARTIFACT.test(text)) {
    OCR_ARTIFACT.lastIndex = 0;
    return { text, changed: false };
  }
  OCR_ARTIFACT.lastIndex = 0;

  const cleaned = text
    .replace(OCR_ARTIFACT, (match, offset, whole) => {
      const before = whole.slice(0, offset).replace(/\s+$/, "");
      const endsSentence = /[。！？」）\]]$/.test(before);
      return before.length === 0 ? "" : endsSentence ? "\n\n" : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: cleaned, changed: cleaned !== text };
}

// Beberapa file memakai konvensi slot 文の組み立て yang berbeda dari kontrak.
// Tiga bentuk yang ditemui, semuanya dapat direkonstruksi tanpa menebak:
//
//   a. deretan ＿ sebagai slot kosong dan ★ telanjang sebagai slot bintang;
//   b. ★ menempel pada salah satu deretan (＿＿＿ ★＿＿＿) — itu satu slot
//      bintang, bukan slot kosong ditambah bintang;
//   c. ★ telanjang di posisi slot, sementara deretan [_]/[★] yang utuh justru
//      terlempar ke ujung kalimat sebagai artefak. Artefak itu merekam posisi
//      bintangnya, jadi tinggal dikembalikan ke tempatnya.
//
// Hasil hanya diterima bila membentuk tepat tiga [_] dan satu [★]. Selain itu
// stem-nya rusak dengan cara lain dan diserahkan ke penanganan kasus per kasus.
export function normalizeSlotMarkers(stem) {
  if (!stem) return { text: stem, changed: false };

  let text = stem;

  const trailing = text.match(/\s*((?:\[_\]|\[★\])(?:\s*(?:\[_\]|\[★\])){3})\s*$/);
  if (trailing) {
    const rest = text.slice(0, trailing.index);
    const bareStars = (rest.match(/★/g) ?? []).length;
    // Deretan spasi panjang di sisa kalimat berarti slot lain ikut hilang jadi
    // spasi; posisinya tidak dapat dipastikan, jadi jangan disentuh.
    if (bareStars === 1 && !/[ 　]{3,}/.test(rest)) {
      text = rest.replace("★", trailing[1].replace(/\s+/g, " ").trim());
    }
  }

  // Lewati bila stem memakai markup garis bawah __teks__, supaya penanda itu
  // tidak ikut tertukar menjadi slot.
  if (!/__[^_]+__/.test(text)) {
    text = text.replace(/★[＿_]{2,}/g, "[★]");
    text = text.replace(/[＿_]{2,}★/g, "[★]");
    text = text.replace(/[＿_]{2,}/g, "[_]");
  }
  text = text.replace(/(?<!\[)★(?!\])/g, "[★]");

  const blanks = (text.match(/\[_\]/g) ?? []).length;
  const stars = (text.match(/\[★\]/g) ?? []).length;
  if (blanks !== 3 || stars !== 1) return { text: stem, changed: false };

  return { text, changed: text !== stem };
}

// Nomor rumpang 文章の文法. Soal tipe ini tidak punya kalimat pertanyaan: yang
// menjadi "soal" adalah rumpang bernomor di dalam wacana. Nomor yang dipakai
// diambil dari stem bila ada (mis. "(51)"), kalau tidak dari `order`.
// Nomor diambil dari penanda berpembatas lebih dulu ([23], (19), ＿51＿). Angka
// telanjang hanya dipakai bila tidak ada penanda sama sekali — kalau tidak,
// angka yang memang bagian isi kalimat (「大学1年生」) akan terbaca sebagai nomor
// rumpang.
export function clozeNumber(question) {
  const stem = question.questionText ?? "";
  const delimited = stem.match(/[＿_（(\[]\s*(\d+)\s*[＿_）)\]]/);
  if (delimited) return Number(delimited[1]);
  const bare = stem.match(/(\d+)/);
  return bare ? Number(bare[1]) : question.order;
}

export function hasClozeMarker(storyText, number) {
  return new RegExp(`[＿_（(\\[]\\s*${number}\\s*[＿_）)\\]]`).test(storyText ?? "");
}

// Sebagian hasil ekstraksi kehilangan pembatas rumpangnya sehingga nomornya
// menempel telanjang pada kalimat (「と呼ばれる50。」). Hanya dianggap dapat
// diperbaiki bila nomor itu muncul TEPAT SEKALI di luar rangkaian angka lain —
// selain itu bisa saja angka yang memang bagian dari isi bacaan.
export function findBareClozeNumber(storyText, number) {
  const matches = [...(storyText ?? "").matchAll(new RegExp(`(?<![0-9])${number}(?![0-9])`, "g"))];
  return matches.length === 1 ? matches[0].index : null;
}

// Cacat yang hanya terlihat bila soal dibandingkan satu sama lain: dua soal
// dengan daftar pilihan yang sama persis. Penyebab yang ditemui di data ini
// adalah blok pilihan satu mondai tergeser ke mondai lain saat ekstraksi,
// sehingga soal penerimanya kehilangan pilihan aslinya sama sekali.
//
// Pengecualian: pada 統合理解 (CHOUKAI_INTEGRATED), 質問1 dan 質問2 memang
// berbagi satu daftar pilihan — itu format naskah JLPT asli, bukan cacat.
function isWellFormedComposition({ item, question }) {
  if (item.mondaiType !== "BUNPOU_SENTENCE_COMPOSITION") return false;
  const stem = question.questionText ?? "";
  return (stem.match(/\[_\]/g) ?? []).length === 3 && (stem.match(/\[★\]/g) ?? []).length === 1;
}

export function crossQuestionDefects(pkg) {
  const byChoices = new Map();
  const defects = new Map();

  for (const item of pkg.testPackageItems) {
    for (const question of item.questions) {
      const texts = question.questionChoices
        .map((choice) => (choice.answerText ?? "").trim())
        .filter(Boolean);
      if (texts.length < 4) continue;

      const fingerprint = texts.join("\u001f");
      const previous = byChoices.get(fingerprint);
      if (!previous) {
        byChoices.set(fingerprint, { item, question });
        continue;
      }

      const bothIntegrated =
        previous.item.mondaiType === "CHOUKAI_INTEGRATED" &&
        item.mondaiType === "CHOUKAI_INTEGRATED";
      const looksLikePairedQuestion =
        /質問/.test(previous.question.questionText ?? "") ||
        /質問/.test(question.questionText ?? "") ||
        Math.abs(question.order - previous.question.order) === 1;
      if (bothIntegrated && looksLikePairedQuestion) continue;

      // Yang ditandai harus soal penerima pilihan, bukan pemilik aslinya. Soal
      // 文の組み立て yang slot-nya utuh hampir pasti pemilik sah daftar pilihan
      // itu, jadi pasangannya yang dicurigai.
      const current = { item, question };
      const suspect = isWellFormedComposition(previous)
        ? current
        : isWellFormedComposition(current)
          ? previous
          : current;
      const owner = suspect === current ? previous : current;

      const key = `${suspect.item.mondaiType}#${suspect.question.order}`;
      const message =
        `pilihan identik dengan soal lain: ${owner.item.mondaiType}#${owner.question.order}` +
        ` (kunci ${suspect.question.questionAnswer} vs ${owner.question.questionAnswer})`;
      defects.set(key, [...(defects.get(key) ?? []), message]);
    }
  }

  return defects;
}

// Seluruh cacat dalam satu paket, lengkap dengan penunjuk lokasinya.
export function checkPackage(pkg) {
  const contexts = new Map((pkg.questionContexts ?? []).map((context) => [context.id, context]));
  const defects = [];

  for (const context of pkg.questionContexts ?? []) {
    if (!context.storyText && !context.storyImage && !context.storyAudio) {
      defects.push({
        level: "warning",
        scope: "context",
        contextId: context.id,
        message: "tidak punya teks, gambar, maupun audio",
      });
      continue;
    }
    for (const problem of markupProblems(`context ${context.id} storyText`, context.storyText)) {
      defects.push({ ...problem, scope: "context", contextId: context.id });
    }
  }

  const crossDefects = crossQuestionDefects(pkg);

  for (const item of pkg.testPackageItems) {
    for (const question of item.questions) {
      const context = question.questionContextRef
        ? contexts.get(question.questionContextRef)
        : null;

      // 文章の文法 memakai beberapa konvensi di korpus ini: rumpang bernomor di
      // bacaan (＿51＿, (19), [23]) atau rumpang 【　】 di dalam stem soal itu
      // sendiri. Yang ditandai hanya dua keadaan yang pasti salah: soal tidak
      // terhubung ke bacaan, atau stem menyebut nomor yang penandanya tidak ada
      // di bacaan padahal bacaan itu memakai penanda bernomor.
      if (item.mondaiType === "BUNPOU_TEXT_GRAMMAR") {
        const locate = { scope: "question", mondaiType: item.mondaiType, section: item.section, order: question.order };

        if (!context) {
          defects.push({ level: "error", message: "tidak terhubung ke bacaan mana pun", ...locate });
        } else {
          const stem = question.questionText ?? "";
          const delimited = stem.match(/[＿_（(\[]\s*(\d+)\s*[＿_）)\]]/);
          const storyHasMarkers = /[＿_（(\[]\s*\d+\s*[＿_）)\]]/.test(context.storyText ?? "");
          // Hanya diperiksa bila stem memang menyebut nomor rumpang secara
          // eksplisit; stem yang berisi kalimat biasa tidak dituntut punya nomor.
          if (delimited && storyHasMarkers && !hasClozeMarker(context.storyText, delimited[1])) {
            defects.push({
              level: "error",
              message: `rumpang bernomor ${delimited[1]} tidak ada di bacaan`,
              ...locate,
            });
          }
        }
      }

      for (const message of crossDefects.get(`${item.mondaiType}#${question.order}`) ?? []) {
        defects.push({
          level: "error",
          message,
          scope: "question",
          mondaiType: item.mondaiType,
          section: item.section,
          order: question.order,
        });
      }

      for (const problem of checkQuestion({ item, question, context })) {
        defects.push({
          ...problem,
          scope: "question",
          mondaiType: item.mondaiType,
          section: item.section,
          order: question.order,
        });
      }
    }
  }

  return defects;
}
