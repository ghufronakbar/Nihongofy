// Konstanta storage yang dipakai bersama client dan server.
//
// Sengaja dipisah dari `@/constants` karena file itu mem-parse `process.env`
// saat modul dimuat, sehingga tidak boleh ikut ke bundle client. Schema zod dan
// komponen uploader mengimpor dari sini.

export const AVATAR_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const AVATAR_DIMENSION = 512;
export const AVATAR_CONTENT_TYPE = "image/webp";
export const AVATAR_EXTENSION = "webp";
// Kualitas encoder WebP saat avatar di-resize di browser.
export const AVATAR_WEBP_QUALITY = 0.9;
export const AVATAR_SOURCE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const AVATAR_SOURCE_ACCEPT = AVATAR_SOURCE_CONTENT_TYPES.join(",");

export const COMMENT_IMAGE_MAX_COUNT = 4;
export const COMMENT_IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// Content-type yang diizinkan beserta ekstensi object key-nya di R2.
export const COMMENT_IMAGE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;
// Tuple eksplisit agar `z.enum` menghasilkan union literal, bukan `string`.
export const COMMENT_IMAGE_CONTENT_TYPE_LIST = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const satisfies ReadonlyArray<keyof typeof COMMENT_IMAGE_CONTENT_TYPES>;
export const COMMENT_IMAGE_ACCEPT = COMMENT_IMAGE_CONTENT_TYPE_LIST.join(",");

export type CommentImageContentType = keyof typeof COMMENT_IMAGE_CONTENT_TYPES;

export function isCommentImageContentType(value: string): value is CommentImageContentType {
  return Object.hasOwn(COMMENT_IMAGE_CONTENT_TYPES, value);
}

export const TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

export const TEST_PACKAGE_IMAGE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export const TEST_PACKAGE_AUDIO_CONTENT_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
} as const;

export const TEST_PACKAGE_IMAGE_CONTENT_TYPE_LIST = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const satisfies ReadonlyArray<keyof typeof TEST_PACKAGE_IMAGE_CONTENT_TYPES>;

export const TEST_PACKAGE_AUDIO_CONTENT_TYPE_LIST = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
] as const satisfies ReadonlyArray<keyof typeof TEST_PACKAGE_AUDIO_CONTENT_TYPES>;

export const TEST_PACKAGE_IMAGE_ACCEPT = TEST_PACKAGE_IMAGE_CONTENT_TYPE_LIST.join(",");
export const TEST_PACKAGE_AUDIO_ACCEPT = TEST_PACKAGE_AUDIO_CONTENT_TYPE_LIST.join(",");

export type TestPackageImageContentType = keyof typeof TEST_PACKAGE_IMAGE_CONTENT_TYPES;
export type TestPackageAudioContentType = keyof typeof TEST_PACKAGE_AUDIO_CONTENT_TYPES;
export type TestPackageMediaContentType =
  | TestPackageImageContentType
  | TestPackageAudioContentType;

export function isTestPackageImageContentType(
  value: string,
): value is TestPackageImageContentType {
  return Object.hasOwn(TEST_PACKAGE_IMAGE_CONTENT_TYPES, value);
}

export function isTestPackageAudioContentType(
  value: string,
): value is TestPackageAudioContentType {
  return Object.hasOwn(TEST_PACKAGE_AUDIO_CONTENT_TYPES, value);
}
