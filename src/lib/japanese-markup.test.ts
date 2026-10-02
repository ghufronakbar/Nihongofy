import { describe, expect, it } from "vitest";
import { toPlainJapanese } from "./japanese-markup";

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
