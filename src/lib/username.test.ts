import { describe, expect, it } from "vitest";
import {
  UsernameSchema,
  buildAnonymizedUsername,
  isAnonymizedUsername,
  isReservedUsername,
  resolveAvailableUsername,
  toUsernameCandidate,
} from "./username";

function parse(value: string) {
  return UsernameSchema.safeParse(value);
}

describe("UsernameSchema", () => {
  it("menerima bentuk yang sah", () => {
    for (const value of ["lans", "ghufron_akbar", "a.b.c", "user_123", "n1hongo"]) {
      expect(parse(value).success, value).toBe(true);
    }
  });

  it("menormalkan ke huruf kecil", () => {
    const result = parse("  LansTheProdigy  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("lanstheprodigy");
  });

  it("menolak titik di ujung dan titik berurutan", () => {
    for (const value of [".lans", "lans.", "la..ns", "..", "a..b"]) {
      expect(parse(value).success, value).toBe(false);
    }
  });

  it("menolak panjang di luar batas dan karakter terlarang", () => {
    expect(parse("ab").success).toBe(false);
    expect(parse("a".repeat(31)).success).toBe(false);
    expect(parse("lans prodigy").success).toBe(false);
    expect(parse("lans-prodigy").success).toBe(false);
    expect(parse("ラン").success).toBe(false);
  });

  it("menolak segmen route dan kata yang bisa dipakai menyamar", () => {
    for (const value of ["admin", "discussion", "profile", "official", "support"]) {
      expect(parse(value).success, value).toBe(false);
    }
  });

  // Tanpa ini, user hidup bisa mengklaim handle berbentuk akun tombstone dan
  // menyamar sebagai pengguna yang sudah dihapus.
  it("menolak prefix akun yang dianonimkan", () => {
    expect(isReservedUsername("deleted_1761400000_9")).toBe(true);
    expect(parse("deleted_1761400000_9").success).toBe(false);
  });
});

describe("toUsernameCandidate", () => {
  it("membuat slug dari nama tampilan", () => {
    expect(toUsernameCandidate("Ghufron Akbar Maulana")).toBe("ghufron_akbar_maulana");
    expect(toUsernameCandidate("Lans")).toBe("lans");
  });

  it("mengembalikan string kosong bila hasilnya tidak layak", () => {
    expect(toUsernameCandidate("ラ")).toBe("");
    expect(toUsernameCandidate("..")).toBe("");
    expect(toUsernameCandidate("admin")).toBe("");
  });

  it("selalu menghasilkan kandidat yang lolos validasi", () => {
    for (const source of ["Ghufron Akbar Maulana", "Lans", "a.b", "Zoë Müller"]) {
      const candidate = toUsernameCandidate(source);
      if (candidate) expect(parse(candidate).success, `${source} -> ${candidate}`).toBe(true);
    }
  });
});

describe("resolveAvailableUsername", () => {
  it("memakai kandidat bila belum terpakai", async () => {
    expect(await resolveAvailableUsername("lans", async () => false)).toBe("lans");
  });

  it("menambahkan suffix bila kandidat sudah terpakai", async () => {
    const taken = new Set(["lans"]);
    const result = await resolveAvailableUsername("lans", async (value) => taken.has(value));
    expect(result).not.toBe("lans");
    expect(result.startsWith("lans_")).toBe(true);
    expect(parse(result).success).toBe(true);
  });

  it("tetap menghasilkan handle sah saat kandidat kosong", async () => {
    const result = await resolveAvailableUsername("", async () => false);
    expect(parse(result).success).toBe(true);
  });

  it("menjaga batas panjang saat kandidat sudah maksimal", async () => {
    const result = await resolveAvailableUsername("a".repeat(30), async (value) =>
      value === "a".repeat(30),
    );
    expect(result.length).toBeLessThanOrEqual(30);
    expect(parse(result).success).toBe(true);
  });
});

describe("buildAnonymizedUsername", () => {
  it("tidak mempertahankan handle lama", () => {
    const value = buildAnonymizedUsername(42, new Date("2026-09-26T00:00:00Z"));
    expect(value).toBe("deleted_1790380800_42");
    expect(isAnonymizedUsername(value)).toBe(true);
    expect(value.length).toBeLessThanOrEqual(30);
  });
});
