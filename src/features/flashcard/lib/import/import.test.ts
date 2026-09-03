import { describe, expect, it } from "vitest";
import { detectSeparator, parseAnkiText } from "./parse-text";
import { buildAnkiTextExport } from "./export-text";
import {
  fieldChecksum,
  mapRows,
  resolveImportGuid,
  suggestMapping,
  validateMapping,
  type ColumnRole,
  type ImportMapping,
} from "./mapping";

const field = (key: string): ColumnRole => ({ kind: "field", fieldKey: key });

describe("header format Anki", () => {
  it("membaca seluruh header #key:value", () => {
    const parsed = parseAnkiText(
      [
        "#separator:Tab",
        "#html:true",
        "#notetype:Basic",
        "#deck:Core::N3",
        "#tags:jlpt n3",
        "depan\tbelakang",
      ].join("\n"),
    );

    expect(parsed.headers.separator).toBe("\t");
    expect(parsed.headers.html).toBe(true);
    expect(parsed.headers.notetype).toBe("Basic");
    expect(parsed.headers.deck).toBe("Core::N3");
    expect(parsed.headers.tags).toEqual(["jlpt", "n3"]);
    expect(parsed.rows).toEqual([["depan", "belakang"]]);
  });

  it("mengubah nomor kolom 1-based menjadi index 0-based", () => {
    const parsed = parseAnkiText(
      ["#separator:Tab", "#guid column:1", "#deck column:2", "#tags column:5", "a\tb\tc\td\te"].join("\n"),
    );

    expect(parsed.headers.guidColumn).toBe(0);
    expect(parsed.headers.deckColumn).toBe(1);
    expect(parsed.headers.tagsColumn).toBe(4);
  });

  it("memecah #columns memakai separator yang berlaku", () => {
    const parsed = parseAnkiText(
      ["#separator:Comma", "#columns:Front,Back,Extra", "a,b,c"].join("\n"),
    );
    expect(parsed.headers.columns).toEqual(["Front", "Back", "Extra"]);
    expect(parsed.columnCount).toBe(3);
  });

  it("menerima separator sebagai karakter literal", () => {
    const parsed = parseAnkiText(["#separator:|", "a|b"].join("\n"));
    expect(parsed.headers.separator).toBe("|");
    expect(parsed.rows).toEqual([["a", "b"]]);
  });

  it("baris berawalan # setelah data dianggap data, bukan header", () => {
    // Sebuah kartu boleh dimulai dengan tanda pagar; hanya blok paling atas
    // yang merupakan header.
    const parsed = parseAnkiText(["#separator:Tab", "a\tb", "#hashtag\tc"].join("\n"));
    expect(parsed.rows).toEqual([
      ["a", "b"],
      ["#hashtag", "c"],
    ]);
  });

  it("melaporkan header yang tidak dikenal alih-alih gagal", () => {
    const parsed = parseAnkiText(["#separator:Tab", "#entahapa:1", "a\tb"].join("\n"));
    expect(parsed.warnings.some((warning) => warning.includes("entahapa"))).toBe(true);
    expect(parsed.rows).toHaveLength(1);
  });
});

describe("deteksi separator", () => {
  it("memilih tab saat jumlah kolomnya konsisten", () => {
    expect(detectSeparator(["a\tb\tc", "d\te\tf"])).toBe("\t");
  });

  it("memilih koma untuk file CSV", () => {
    expect(detectSeparator(["a,b,c", "d,e,f"])).toBe(",");
  });

  it("tidak tertipu koma yang muncul di dalam teks", () => {
    // Tab konsisten 3 kolom; koma tidak konsisten.
    expect(detectSeparator(["a\tb, c\td", "e\tf\tg"])).toBe("\t");
  });
});

describe("quoting dan baris multi-baris", () => {
  it("membiarkan separator di dalam tanda kutip", () => {
    const parsed = parseAnkiText(['#separator:Comma', '"a,b",c'].join("\n"));
    expect(parsed.rows).toEqual([["a,b", "c"]]);
  });

  it("menggandakan kutip sebagai escape", () => {
    const parsed = parseAnkiText(['#separator:Comma', '"dia bilang ""halo""",b'].join("\n"));
    expect(parsed.rows).toEqual([['dia bilang "halo"', "b"]]);
  });

  it("menggabungkan field yang memuat newline", () => {
    const parsed = parseAnkiText(
      ['#separator:Comma', '"baris satu', 'baris dua",b'].join("\n"),
    );
    expect(parsed.rows).toEqual([["baris satu\nbaris dua", "b"]]);
  });

  it("membuang BOM dan menormalkan CRLF", () => {
    const parsed = parseAnkiText("﻿#separator:Tab\r\na\tb\r\n");
    expect(parsed.headers.separator).toBe("\t");
    expect(parsed.rows).toEqual([["a", "b"]]);
  });
});

describe("baris dengan jumlah kolom tidak seragam", () => {
  it("mengisi kolom yang kurang dan membuang yang lebih", () => {
    const parsed = parseAnkiText(["#separator:Tab", "a\tb\tc", "d\te", "f\tg\th\ti"].join("\n"));

    expect(parsed.columnCount).toBe(3);
    expect(parsed.rows).toEqual([
      ["a", "b", "c"],
      ["d", "e", ""],
      ["f", "g", "h"],
    ]);
    expect(parsed.warnings.some((warning) => warning.includes("berbeda"))).toBe(true);
  });
});

describe("saran pemetaan kolom", () => {
  it("mencocokkan nama kolom dengan label field", () => {
    const parsed = parseAnkiText(
      ["#separator:Tab", "#columns:Kata\tArti\tBacaan", "食べる\tmakan\tたべる"].join("\n"),
    );
    const roles = suggestMapping(parsed, "VOCAB_JP");

    expect(roles[0]).toEqual(field("word"));
    expect(roles[1]).toEqual(field("meaning"));
    expect(roles[2]).toEqual(field("reading"));
  });

  it("memasangkan berurutan bila tidak ada nama kolom", () => {
    const parsed = parseAnkiText(["#separator:Tab", "a\tb\tc"].join("\n"));
    const roles = suggestMapping(parsed, "VOCAB_JP");

    expect(roles[0]).toEqual(field("word"));
    expect(roles[1]).toEqual(field("reading"));
    expect(roles[2]).toEqual(field("meaning"));
  });

  it("kolom khusus dari header menang atas pencocokan nama", () => {
    const parsed = parseAnkiText(
      ["#separator:Tab", "#guid column:1", "#columns:Kata\tArti", "x\ty"].join("\n"),
    );
    const roles = suggestMapping(parsed, "VOCAB_JP");

    expect(roles[0]).toEqual({ kind: "guid" });
    expect(roles[1]).toEqual(field("meaning"));
  });
});

describe("validasi pemetaan", () => {
  const base: ImportMapping = {
    noteType: "VOCAB_JP",
    columns: [field("word"), field("meaning")],
    deckName: "Impor",
    extraTags: [],
  };

  it("pemetaan lengkap lolos", () => {
    expect(validateMapping(base)).toEqual([]);
  });

  it("menolak field wajib yang belum dipetakan", () => {
    const errors = validateMapping({ ...base, columns: [field("word")] });
    expect(errors[0]).toContain("Arti");
  });

  it("menolak field yang dipetakan dua kali", () => {
    const errors = validateMapping({
      ...base,
      columns: [field("word"), field("meaning"), field("word")],
    });
    expect(errors.some((error) => error.includes("lebih dari sekali"))).toBe(true);
  });

  it("menolak deck tujuan kosong tanpa kolom deck", () => {
    const errors = validateMapping({ ...base, deckName: "  " });
    expect(errors.some((error) => error.includes("deck"))).toBe(true);
  });

  it("deck tujuan boleh kosong bila ada kolom deck", () => {
    const errors = validateMapping({
      ...base,
      deckName: "",
      columns: [field("word"), field("meaning"), { kind: "deck" }],
    });
    expect(errors).toEqual([]);
  });
});

describe("pemetaan baris", () => {
  const mapping: ImportMapping = {
    noteType: "VOCAB_JP",
    columns: [field("word"), field("reading"), field("meaning"), { kind: "tags" }],
    deckName: "Impor",
    extraTags: ["impor"],
  };

  const parsed = parseAnkiText(
    [
      "#separator:Tab",
      "食べる\tたべる\tmakan\tn5 kata-kerja",
      "\tのむ\tminum",
      "読む\tよむ\tmembaca",
    ].join("\n"),
  );

  it("mengisi field sesuai peran kolom", () => {
    const { rows } = mapRows(parsed, mapping);
    expect(rows[0]!.fields).toEqual(["食べる", "たべる", "makan", "", "", ""]);
  });

  it("menggabungkan tag dari kolom dan tag tambahan tanpa duplikat", () => {
    const { rows } = mapRows(parsed, mapping);
    expect(rows[0]!.tags.sort()).toEqual(["impor", "kata-kerja", "n5"]);
  });

  it("melewati baris yang field wajibnya kosong dan melaporkannya", () => {
    const { rows, problems } = mapRows(parsed, mapping);
    expect(rows).toHaveLength(2);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toContain("Kata");
  });

  it("menghitung jumlah kartu per note", () => {
    const { rows } = mapRows(parsed, mapping);
    expect(rows[0]!.cardCount).toBe(2);
  });

  it("melewati note cloze tanpa penanda", () => {
    const cloze = parseAnkiText(["#separator:Tab", "teks biasa\t", "{{c1::a}} b\t"].join("\n"));
    const { rows, problems } = mapRows(cloze, {
      noteType: "CLOZE",
      columns: [field("text"), field("note")],
      deckName: "Impor",
      extraTags: [],
    });

    expect(rows).toHaveLength(1);
    expect(problems[0]!.message).toContain("{{c1::");
  });

  it("kolom deck menimpa deck tujuan", () => {
    const withDeck = parseAnkiText(["#separator:Tab", "a\tb\tKhusus::Deck"].join("\n"));
    const { rows } = mapRows(withDeck, {
      noteType: "BASIC",
      columns: [field("front"), field("back"), { kind: "deck" }],
      deckName: "Impor",
      extraTags: [],
    });

    expect(rows[0]!.deckName).toBe("Khusus::Deck");
  });

  it("kolom guid terbaca untuk dedup", () => {
    const withGuid = parseAnkiText(["#separator:Tab", "abc123\ta\tb"].join("\n"));
    const { rows } = mapRows(withGuid, {
      noteType: "BASIC",
      columns: [{ kind: "guid" }, field("front"), field("back")],
      deckName: "Impor",
      extraTags: [],
    });

    expect(rows[0]!.guid).toBe("abc123");
  });

  it("kolom ignore benar-benar dibuang", () => {
    const extra = parseAnkiText(["#separator:Tab", "a\tSAMPAH\tb"].join("\n"));
    const { rows } = mapRows(extra, {
      noteType: "BASIC",
      columns: [field("front"), { kind: "ignore" }, field("back")],
      deckName: "Impor",
      extraTags: [],
    });

    expect(rows[0]!.fields).toEqual(["a", "b"]);
  });
});

describe("checksum field", () => {
  it("mengabaikan markup sehingga duplikat tetap terdeteksi", () => {
    expect(fieldChecksum("<b>食べる</b>")).toBe(fieldChecksum("食べる"));
  });

  it("berbeda untuk isi yang berbeda", () => {
    expect(fieldChecksum("食べる")).not.toBe(fieldChecksum("飲む"));
  });
});

describe("file bergaya ekspor Anki sungguhan", () => {
  // Header lengkap, kolom GUID/Tags, field ber-quote yang memuat newline, dan
  // satu baris rusak — campuran yang selalu muncul di file dari luar.
  const FILE = [
    "#separator:Tab",
    "#html:false",
    "#columns:GUID\tKata\tBacaan\tArti\tContoh\tTags",
    "#deck:Impor::N4",
    "#tags:diimpor",
    "n4-001\t続ける\tつづける\tmelanjutkan\t勉強を続ける。\tn4 kata-kerja",
    "n4-002\t決める\tきめる\tmemutuskan\t予定を決める。\tn4",
    'n4-003\t比べる\tくらべる\tmembandingkan\t"二つを比べる、',
    'そして選ぶ。"\tn4',
    "n4-004\t\tくうき\tudara\t空気がきれいだ。\tn4",
    "n4-005\t運ぶ\tはこぶ\tmembawa\t荷物を運ぶ。\tn4",
  ].join("\n");

  const parsed = parseAnkiText(FILE);

  it("membaca seluruh header", () => {
    expect(parsed.headers.separator).toBe("\t");
    expect(parsed.headers.deck).toBe("Impor::N4");
    expect(parsed.headers.tags).toEqual(["diimpor"]);
    expect(parsed.headers.columns).toEqual([
      "GUID",
      "Kata",
      "Bacaan",
      "Arti",
      "Contoh",
      "Tags",
    ]);
  });

  it("menggabungkan field multi-baris menjadi satu record", () => {
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[2]![4]).toBe("二つを比べる、\nそして選ぶ。");
  });

  it("mengenali kolom GUID dan Tags dari namanya", () => {
    // Tanpa ini keduanya akan dijejalkan ke field konten yang kebetulan masih
    // kosong, dan user tidak akan sadar datanya salah tempat.
    expect(suggestMapping(parsed, "VOCAB_JP").map((role) =>
      role.kind === "field" ? role.fieldKey : role.kind,
    )).toEqual(["guid", "word", "reading", "meaning", "example", "tags"]);
  });

  it("tidak menebak kolom yang namanya tidak cocok apa pun", () => {
    const aneh = parseAnkiText(
      ["#separator:Tab", "#columns:Kata\tEntahapa\tArti", "a\tb\tc"].join("\n"),
    );
    const roles = suggestMapping(aneh, "VOCAB_JP");
    expect(roles[1]).toEqual({ kind: "ignore" });
  });

  it("memetakan baris dan melewati yang field wajibnya kosong", () => {
    const columns = suggestMapping(parsed, "VOCAB_JP");
    const mapping = {
      noteType: "VOCAB_JP" as const,
      columns,
      deckName: "Impor::N4",
      extraTags: [],
    };

    expect(validateMapping(mapping)).toEqual([]);
    const { rows, problems } = mapRows(parsed, mapping);

    expect(rows).toHaveLength(4);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toContain("Kata");
    expect(rows[0]!.guid).toBe("n4-001");
    expect(rows[0]!.tags.sort()).toEqual(["diimpor", "kata-kerja", "n4"]);
    expect(rows.reduce((total, row) => total + row.cardCount, 0)).toBe(8);
  });
});

describe("guid saat impor", () => {
  const JOB = "job-1";

  it("memakai guid dari file pada mode update", () => {
    expect(resolveImportGuid("update", "n4-001", JOB, 0)).toBe("n4-001");
  });

  it("membuat guid sendiri bila file tidak punya kolom guid", () => {
    expect(resolveImportGuid("update", null, JOB, 7)).toBe("imp:job-1:7");
  });

  it("MENGABAIKAN guid dari file pada mode importAsNew", () => {
    // Kalau guid file dipakai di sini, mengimpor ulang file ber-kolom GUID akan
    // bentrok dengan note yang sudah ada: note-nya gagal dibuat sementara
    // kartunya tetap dibuat, dan transaksinya jatuh karena foreign key.
    expect(resolveImportGuid("importAsNew", "n4-001", JOB, 3)).toBe("imp:job-1:3");
  });

  it("menghasilkan guid berbeda untuk tiap baris pada importAsNew", () => {
    const guids = [0, 1, 2].map((index) =>
      resolveImportGuid("importAsNew", "sama", JOB, index),
    );
    expect(new Set(guids).size).toBe(3);
  });
});

describe("export lalu impor ulang", () => {
  const notes = [
    {
      guid: "n5-001",
      fields: ["食べる", "たべる", "makan", "ご飯を食べる。", "Makan nasi.", ""],
      tags: ["n5", "kata-kerja"],
      deckName: "JLPT N5::Kosakata",
    },
    {
      // Sengaja memuat tab, newline, dan kutip — tiga hal yang merusak file
      // kalau escaping-nya salah.
      guid: "n5-002",
      fields: ["読む", "よむ", 'dia bilang "baca"', "本を\t読む。\nそして寝る。", "", ""],
      tags: [],
      deckName: "JLPT N5::Kosakata",
    },
  ];

  const text = buildAnkiTextExport("VOCAB_JP", notes);

  it("menghasilkan header yang bisa dibaca kembali", () => {
    const parsed = parseAnkiText(text);
    expect(parsed.headers.separator).toBe("\t");
    expect(parsed.headers.guidColumn).toBe(0);
    expect(parsed.headers.columns?.[0]).toBe("GUID");
  });

  it("mempertahankan isi field yang memuat tab, newline, dan kutip", () => {
    const parsed = parseAnkiText(text);
    const columns = suggestMapping(parsed, "VOCAB_JP");
    const { rows } = mapRows(parsed, {
      noteType: "VOCAB_JP",
      columns,
      deckName: "sementara",
      extraTags: [],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.guid).toBe("n5-001");
    expect(rows[0]!.fields).toEqual(notes[0]!.fields);
    expect(rows[1]!.fields[2]).toBe('dia bilang "baca"');
    expect(rows[1]!.fields[3]).toBe("本を\t読む。\nそして寝る。");
  });

  it("membawa kembali tag dan deck asalnya", () => {
    const parsed = parseAnkiText(text);
    const columns = suggestMapping(parsed, "VOCAB_JP");
    const { rows } = mapRows(parsed, {
      noteType: "VOCAB_JP",
      columns,
      deckName: "sementara",
      extraTags: [],
    });

    expect(rows[0]!.tags.sort()).toEqual(["kata-kerja", "n5"]);
    expect(rows[0]!.deckName).toBe("JLPT N5::Kosakata");
  });
});
