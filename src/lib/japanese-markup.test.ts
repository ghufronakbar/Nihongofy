import { describe, expect, it } from "vitest";
import { toPlainJapanese, withoutUnderlineFurigana } from "./japanese-markup";

describe("withoutUnderlineFurigana", () => {
  it("membuang cara baca di dalam underline, kanjinya tetap", () => {
    expect(withoutUnderlineFurigana("社会活動で__{人脈|じんみゃく}__を広げた。")).toBe(
      "社会活動で__人脈__を広げた。",
    );
    expect(withoutUnderlineFurigana("__{勉強|べんきょう}する__")).toBe("__勉強する__");
  });

  it("furigana di luar underline dan penanda lain tidak berubah", () => {
    const source = "{私|わたし}は[_][★]__{読|よ}める__{本|ほん}";
    expect(withoutUnderlineFurigana(source)).toBe("{私|わたし}は[_][★]__読める__{本|ほん}");
  });

  it("teks tanpa furigana di underline kembali persis sama, termasuk penanda tak berpasangan", () => {
    for (const source of ["ガソリンの値段が__大幅__に上がった。", "a{b", "__x", "{a}b|c}", ""]) {
      expect(withoutUnderlineFurigana(source)).toBe(source);
    }
  });
});

describe("toPlainJapanese", () => {
  it("drops furigana readings and highlight markers", () => {
    expect(toPlainJapanese("{音楽|おんがく}を{聞|き}き__ながら__{勉強|べんきょう}する。")).toBe(
      "音楽を聞きながら勉強する。",
    );
  });

  it("keeps furigana nested inside highlights", () => {
    expect(toPlainJapanese("{私|わたし}は__{読|よ}める__")).toBe("私は読める");
  });

  it("removes answer slots", () => {
    expect(toPlainJapanese("{危|あぶ}ない[_]、{下|さ}がって")).toBe("危ない、下がって");
  });
});
