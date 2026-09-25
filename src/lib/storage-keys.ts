// Pola object key R2 dan pembacaan header WebP. Sengaja bebas dari `env` dan
// `server-only` supaya bisa diuji langsung; `@/lib/r2` yang menyusunnya menjadi
// URL publik dan memanggil S3.

import {
  AVATAR_EXTENSION,
  COMMENT_IMAGE_CONTENT_TYPES,
} from "@/constants/storage";

const UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const USER_ID = "[1-9][0-9]{0,9}";

export const AVATAR_KEY_PREFIX = "jlpt-exam/avatars/";
export const COMMENT_IMAGE_KEY_PREFIX = "jlpt-exam/comments/";

const AVATAR_KEY_PATTERN = new RegExp(
  `^${AVATAR_KEY_PREFIX}(${USER_ID})/${UUID_V4}\\.${AVATAR_EXTENSION}$`,
  "i",
);
const COMMENT_IMAGE_KEY_PATTERN = new RegExp(
  `^${COMMENT_IMAGE_KEY_PREFIX}(${USER_ID})/${UUID_V4}\\.(?:${Object.values(
    COMMENT_IMAGE_CONTENT_TYPES,
  ).join("|")})$`,
  "i",
);

// Aset lama yang masih di Cloudinary tetap dibaca; tidak ada tulis baru ke sana.
const LEGACY_CLOUDINARY_URL_PATTERN =
  /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/(?:image|video)\/upload\/[A-Za-z0-9/_,.:-]+$/;

export function isLegacyCloudinaryUrl(url: string) {
  return LEGACY_CLOUDINARY_URL_PATTERN.test(url);
}

/**
 * Object key hanya diakui bila cocok pola penuh
 * `jlpt-exam/avatars/<userId>/<uuid v4>.webp`. Tanpa `userId`, pemeriksaan tetap
 * berlaku untuk segmen user mana pun — inilah yang membuat cleanup cron dan
 * penghapusan avatar lama bekerja tanpa perlu tahu pemiliknya.
 */
export function isManagedAvatarKey(key: string, userId?: number) {
  const match = AVATAR_KEY_PATTERN.exec(key);
  if (!match) return false;
  return userId === undefined || match[1] === String(userId);
}

export function isManagedCommentImageKey(key: string, userId: number) {
  return COMMENT_IMAGE_KEY_PATTERN.exec(key)?.[1] === String(userId);
}

/** `avatarPublicId` warisan Cloudinary tidak berekstensi dan bukan object R2. */
export function isLegacyCloudinaryAvatarPublicId(publicId: string) {
  return publicId.startsWith(AVATAR_KEY_PREFIX) && !isManagedAvatarKey(publicId);
}

/**
 * Membaca dimensi kanvas dari header WebP (VP8 lossy, VP8L lossless, VP8X
 * extended). Hanya butuh 30 byte pertama, jadi object tidak perlu diunduh utuh
 * untuk memastikan avatar benar-benar 512x512.
 */
export function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;

  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  switch (ascii(12, 4)) {
    // Lossy: 3 byte frame tag, 3 byte start code, lalu width & height 14 bit.
    case "VP8 ": {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    // Lossless: signature 0x2f, lalu (width - 1) dan (height - 1) 14 bit.
    case "VP8L": {
      if (bytes[20] !== 0x2f) return null;
      const packed = view.getUint32(21, true);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }
    // Extended: 4 byte flag, lalu canvas (width - 1) dan (height - 1) 24 bit.
    case "VP8X": {
      return {
        width: (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1,
        height: (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1,
      };
    }
    default:
      return null;
  }
}
