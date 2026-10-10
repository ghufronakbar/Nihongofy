import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  createUpload: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: { testPackage: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/r2", () => ({ createTestPackageMediaUpload: mocks.createUpload }));

import { createTestPackageMediaUploadAction } from "./media-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: 1 });
  mocks.findUnique.mockResolvedValue({ name: "JLPT N5 - 2018年07月", jlptLevel: "N5" });
  mocks.createUpload.mockResolvedValue({
    uploadUrl: "https://upload.example.test/signed",
    key: "jlpt-exam/test-packages/n5-2018-07/images/abc-soal.png",
    url: "https://cdn.example.test/jlpt-exam/test-packages/n5-2018-07/images/abc-soal.png",
    contentType: "image/png",
  });
});

describe("createTestPackageMediaUploadAction", () => {
  it("memeriksa admin sebelum membaca paket", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(
      createTestPackageMediaUploadAction({
        testPackageId: 5,
        mediaType: "images",
        contentType: "image/png",
        byteLength: 100,
        originalFileName: "soal.png",
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("menentukan folder dari paket database, bukan input browser", async () => {
    const result = await createTestPackageMediaUploadAction({
      testPackageId: 5,
      mediaType: "images",
      contentType: "image/png",
      byteLength: 100,
      originalFileName: "soal.png",
    });

    expect(result).toMatchObject({ ok: true, contentType: "image/png" });
    expect(mocks.createUpload).toHaveBeenCalledWith({
      packageSlug: "n5-2018-07",
      mediaType: "images",
      contentType: "image/png",
      byteLength: 100,
      originalFileName: "soal.png",
    });
  });

  it("menolak tipe, ukuran, dan paket yang tidak valid", async () => {
    const invalidType = await createTestPackageMediaUploadAction({
      testPackageId: 5,
      mediaType: "audio",
      contentType: "image/png",
      byteLength: 100,
      originalFileName: "audio.png",
    });
    expect(invalidType).toMatchObject({ ok: false });

    const tooLarge = await createTestPackageMediaUploadAction({
      testPackageId: 5,
      mediaType: "images",
      contentType: "image/png",
      byteLength: 11 * 1024 * 1024,
      originalFileName: "soal.png",
    });
    expect(tooLarge).toMatchObject({ ok: false });

    mocks.findUnique.mockResolvedValueOnce(null);
    const missing = await createTestPackageMediaUploadAction({
      testPackageId: 999,
      mediaType: "images",
      contentType: "image/png",
      byteLength: 100,
      originalFileName: "soal.png",
    });
    expect(missing).toEqual({ ok: false, message: "Paket tes tidak ditemukan." });
  });
});
