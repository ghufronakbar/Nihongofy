import { describe, expect, it, vi } from "vitest";

// Semua route /bunpou (katalog, pola, perbandingan, diskusi) berada di bawah
// satu layout segmen; flag yang mati harus membuat semuanya 404.

const features = vi.hoisted(() => ({ bunpou: true }));

vi.mock("@/constants", () => ({ FEATURES: features }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: BunpouLayout } = await import("@/app/(public)/bunpou/layout");

describe("FEATURES_BUNPOU", () => {
  it("404s the /bunpou segment when the flag is off", () => {
    features.bunpou = false;
    expect(() => BunpouLayout({ children: "isi" })).toThrow("NEXT_NOT_FOUND");
  });

  it("renders the segment when the flag is on", () => {
    features.bunpou = true;
    expect(BunpouLayout({ children: "isi" })).toBe("isi");
  });
});
