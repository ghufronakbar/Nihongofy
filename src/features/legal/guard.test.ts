import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEGAL_FACTS, LEGAL_PLACEHOLDER_PREFIX } from "./constants";
import { assertLegalDocumentPublishable, collectLegalPlaceholders } from "./guard";

const READY = {
  path: "/privacy",
  version: "1.0",
  lastUpdated: "2026-10-02",
  effectiveDate: "2026-10-02",
};
const FILLED_FACTS = { operatorName: "Pengelola", contactEmail: "a@example.com" };
const PLACEHOLDER = `${LEGAL_PLACEHOLDER_PREFIX} nama pengelola]]`;

describe("assertLegalDocumentPublishable", () => {
  it("menolak build produksi bila fakta masih placeholder", () => {
    expect(() =>
      assertLegalDocumentPublishable(READY, "production", { ...FILLED_FACTS, operatorName: PLACEHOLDER }),
    ).toThrow(PLACEHOLDER);
  });

  it("menolak build produksi bila tanggal berlaku masih placeholder", () => {
    const document = { ...READY, effectiveDate: `${LEGAL_PLACEHOLDER_PREFIX} tanggal]]` };
    expect(() => assertLegalDocumentPublishable(document, "production", FILLED_FACTS)).toThrow(
      "/privacy",
    );
  });

  it("membiarkan build lokal dan preview walau masih ada placeholder", () => {
    const facts = { ...FILLED_FACTS, operatorName: PLACEHOLDER };
    expect(() => assertLegalDocumentPublishable(READY, undefined, facts)).not.toThrow();
    expect(() => assertLegalDocumentPublishable(READY, "preview", facts)).not.toThrow();
  });

  it("lolos di produksi bila semua isian lengkap", () => {
    expect(() => assertLegalDocumentPublishable(READY, "production", FILLED_FACTS)).not.toThrow();
  });

  it("menyebut tiap placeholder sekali", () => {
    const facts = { a: PLACEHOLDER, b: PLACEHOLDER };
    expect(collectLegalPlaceholders(READY, facts)).toEqual([PLACEHOLDER]);
  });
});

describe("isi dokumen hukum", () => {
  // Guard hanya memeriksa LEGAL_FACTS dan metadata dokumen. Placeholder literal
  // yang ditulis langsung di isi TSX akan lolos dari guard, jadi dilarang di sini:
  // tulis isian yang belum diketahui sebagai entri LEGAL_FACTS.
  it("tidak memuat placeholder literal di luar EFFECTIVE_DATE", () => {
    const contentDir = fileURLToPath(new URL("./content/", import.meta.url));
    const offenders = readdirSync(contentDir)
      .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
      .flatMap((file) =>
        readFileSync(`${contentDir}${file}`, "utf8")
          .split("\n")
          .map((line, index) => ({ file, line: index + 1, text: line }))
          .filter(
            ({ text }) =>
              text.includes(LEGAL_PLACEHOLDER_PREFIX) && !text.startsWith("export const EFFECTIVE_DATE"),
          ),
      );
    expect(offenders).toEqual([]);
  });

  it("LEGAL_FACTS saat ini sudah lengkap", () => {
    expect(collectLegalPlaceholders(READY, LEGAL_FACTS)).toEqual([]);
  });
});
