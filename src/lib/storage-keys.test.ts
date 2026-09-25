import { describe, expect, it } from "vitest";
import {
  isLegacyCloudinaryAvatarPublicId,
  isLegacyCloudinaryUrl,
  isManagedAvatarKey,
  isManagedCommentImageKey,
  readWebpDimensions,
} from "./storage-keys";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function riffHeader(fourcc: string, payload: number[]) {
  const bytes = new Uint8Array(Math.max(30, 12 + 8 + payload.length));
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };
  write(0, "RIFF");
  write(8, "WEBP");
  write(12, fourcc);
  bytes.set(payload, 20);
  return bytes;
}

/** Header WebP lossy: 3 byte frame tag, start code, lalu width/height 14 bit. */
function vp8Header(width: number, height: number) {
  return riffHeader("VP8 ", [
    0x00,
    0x00,
    0x00,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    (width >> 8) & 0x3f,
    height & 0xff,
    (height >> 8) & 0x3f,
  ]);
}

/** Header WebP lossless: signature 0x2f, lalu (w-1) dan (h-1) 14 bit. */
function vp8lHeader(width: number, height: number) {
  const packed = (width - 1) | ((height - 1) << 14);
  return riffHeader("VP8L", [
    0x2f,
    packed & 0xff,
    (packed >>> 8) & 0xff,
    (packed >>> 16) & 0xff,
    (packed >>> 24) & 0xff,
  ]);
}

/** Header WebP extended: 4 byte flag, lalu canvas (w-1) dan (h-1) 24 bit. */
function vp8xHeader(width: number, height: number) {
  const w = width - 1;
  const h = height - 1;
  return riffHeader("VP8X", [
    0x00,
    0x00,
    0x00,
    0x00,
    w & 0xff,
    (w >> 8) & 0xff,
    (w >> 16) & 0xff,
    h & 0xff,
    (h >> 8) & 0xff,
    (h >> 16) & 0xff,
  ]);
}

describe("readWebpDimensions", () => {
  it("membaca dimensi dari ketiga varian header WebP", () => {
    expect(readWebpDimensions(vp8Header(512, 512))).toEqual({ width: 512, height: 512 });
    expect(readWebpDimensions(vp8lHeader(512, 512))).toEqual({ width: 512, height: 512 });
    expect(readWebpDimensions(vp8xHeader(512, 512))).toEqual({ width: 512, height: 512 });
  });

  it("membedakan dimensi non-persegi sehingga avatar salah ukuran tertolak", () => {
    expect(readWebpDimensions(vp8Header(1024, 512))).toEqual({ width: 1024, height: 512 });
    expect(readWebpDimensions(vp8lHeader(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readWebpDimensions(vp8xHeader(4000, 3000))).toEqual({ width: 4000, height: 3000 });
  });

  it("menolak byte yang bukan WebP", () => {
    // PNG: file image sungguhan, tapi bukan format yang kita tandatangani.
    const png = new Uint8Array(30);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(readWebpDimensions(png)).toBeNull();

    // RIFF yang benar tapi codec tidak dikenal.
    expect(readWebpDimensions(riffHeader("XXXX", [0x00]))).toBeNull();

    // Start code VP8 rusak.
    const brokenVp8 = vp8Header(512, 512);
    brokenVp8[23] = 0x00;
    expect(readWebpDimensions(brokenVp8)).toBeNull();

    // Terlalu pendek untuk memuat dimensi.
    expect(readWebpDimensions(new Uint8Array(12))).toBeNull();
  });
});

describe("isManagedAvatarKey", () => {
  const key = `jlpt-exam/avatars/42/${UUID}.webp`;

  it("menerima key milik user yang bersangkutan", () => {
    expect(isManagedAvatarKey(key, 42)).toBe(true);
  });

  // Tanpa userId dipakai cron cleanup dan penghapusan avatar lama; dulu cek ini
  // selalu false sehingga penghapusan tidak pernah jalan.
  it("menerima key user mana pun saat userId tidak diberikan", () => {
    expect(isManagedAvatarKey(key)).toBe(true);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/7/${UUID}.webp`)).toBe(true);
  });

  it("menolak key milik user lain", () => {
    expect(isManagedAvatarKey(key, 43)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/420/${UUID}.webp`, 42)).toBe(false);
  });

  it("menolak key di luar pola", () => {
    expect(isManagedAvatarKey(`jlpt-exam/avatars/42/${UUID}`, 42)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/42/${UUID}.png`, 42)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/42/../../${UUID}.webp`, 42)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/comments/42/${UUID}.webp`, 42)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/42/sub/${UUID}.webp`, 42)).toBe(false);
    expect(isManagedAvatarKey(`jlpt-exam/avatars/042/${UUID}.webp`)).toBe(false);
  });
});

describe("isManagedCommentImageKey", () => {
  it("menerima ekstensi gambar yang didukung untuk pemiliknya", () => {
    for (const extension of ["jpg", "png", "webp", "gif"]) {
      expect(isManagedCommentImageKey(`jlpt-exam/comments/9/${UUID}.${extension}`, 9)).toBe(true);
    }
  });

  it("menolak milik user lain atau ekstensi asing", () => {
    expect(isManagedCommentImageKey(`jlpt-exam/comments/9/${UUID}.jpg`, 10)).toBe(false);
    expect(isManagedCommentImageKey(`jlpt-exam/comments/9/${UUID}.svg`, 9)).toBe(false);
    expect(isManagedCommentImageKey(`jlpt-exam/avatars/9/${UUID}.webp`, 9)).toBe(false);
  });
});

describe("aset Cloudinary lama", () => {
  it("tetap dikenali supaya konten sebelum migrasi bisa disunting", () => {
    expect(isLegacyCloudinaryUrl("https://res.cloudinary.com/dankuh3tf/image/upload/v1/a.png")).toBe(
      true,
    );
    expect(
      isLegacyCloudinaryUrl("https://res.cloudinary.com/dankuh3tf/video/upload/v1788114709/x.mp3"),
    ).toBe(true);
  });

  it("tidak menerima host lain yang menyerupai", () => {
    expect(isLegacyCloudinaryUrl("https://res.cloudinary.com.evil.test/x/image/upload/a.png")).toBe(
      false,
    );
    expect(isLegacyCloudinaryUrl("http://res.cloudinary.com/x/image/upload/a.png")).toBe(false);
    expect(isLegacyCloudinaryUrl("https://evil.test/a.png")).toBe(false);
  });

  it("mengenali avatarPublicId warisan yang tidak bisa dihapus dari R2", () => {
    expect(isLegacyCloudinaryAvatarPublicId(`jlpt-exam/avatars/42/${UUID}`)).toBe(true);
    expect(isLegacyCloudinaryAvatarPublicId(`jlpt-exam/avatars/42/${UUID}.webp`)).toBe(false);
  });
});
