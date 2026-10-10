"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTestPackageMediaUpload } from "@/lib/r2";
import { testPackageStorageSlug } from "@/lib/storage-keys";
import {
  TEST_PACKAGE_AUDIO_CONTENT_TYPE_LIST,
  TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES,
  TEST_PACKAGE_IMAGE_CONTENT_TYPE_LIST,
  TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES,
} from "@/constants/storage";

const TestPackageMediaUploadSchema = z
  .object({
    testPackageId: z.number().int().positive(),
    mediaType: z.enum(["images", "audio"]),
    contentType: z.string().trim(),
    byteLength: z.number().int().positive(),
    originalFileName: z.string().trim().min(1).max(255),
  })
  .superRefine((value, context) => {
    const allowed =
      value.mediaType === "images"
        ? TEST_PACKAGE_IMAGE_CONTENT_TYPE_LIST
        : TEST_PACKAGE_AUDIO_CONTENT_TYPE_LIST;
    const maxBytes =
      value.mediaType === "images"
        ? TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES
        : TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES;

    if (!(allowed as readonly string[]).includes(value.contentType)) {
      context.addIssue({ code: "custom", path: ["contentType"], message: "Tipe media tidak didukung." });
    }
    if (value.byteLength > maxBytes) {
      context.addIssue({ code: "custom", path: ["byteLength"], message: "Ukuran media terlalu besar." });
    }
  });

export type TestPackageMediaUploadResult =
  | { ok: true; uploadUrl: string; url: string; contentType: string }
  | { ok: false; message: string };

export async function createTestPackageMediaUploadAction(
  input: z.input<typeof TestPackageMediaUploadSchema>,
): Promise<TestPackageMediaUploadResult> {
  await requireAdmin();

  const validated = TestPackageMediaUploadSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Permintaan upload tidak valid.",
    };
  }

  const testPackage = await prisma.testPackage.findUnique({
    where: { id: validated.data.testPackageId },
    select: { name: true, jlptLevel: true },
  });
  if (!testPackage) return { ok: false, message: "Paket tes tidak ditemukan." };

  const packageSlug = testPackageStorageSlug(testPackage.name, testPackage.jlptLevel);
  if (!packageSlug) {
    return { ok: false, message: "Nama paket tidak dapat dipetakan ke folder R2." };
  }

  const upload = await createTestPackageMediaUpload({
    packageSlug,
    mediaType: validated.data.mediaType,
    contentType: validated.data.contentType as Parameters<
      typeof createTestPackageMediaUpload
    >[0]["contentType"],
    byteLength: validated.data.byteLength,
    originalFileName: validated.data.originalFileName,
  });

  return { ok: true, uploadUrl: upload.uploadUrl, url: upload.url, contentType: upload.contentType };
}
