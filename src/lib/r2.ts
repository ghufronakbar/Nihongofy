import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AVATAR_CLEANUP_CRON_BATCH_SIZE,
  AVATAR_ORPHAN_GRACE_PERIOD_SECONDS,
  env,
} from "@/constants";
import {
  AVATAR_CONTENT_TYPE,
  AVATAR_DIMENSION,
  AVATAR_EXTENSION,
  AVATAR_MAX_FILE_SIZE_BYTES,
  COMMENT_IMAGE_CONTENT_TYPES,
  COMMENT_IMAGE_MAX_FILE_SIZE_BYTES,
  isCommentImageContentType,
  isTestPackageAudioContentType,
  isTestPackageImageContentType,
  TEST_PACKAGE_AUDIO_CONTENT_TYPES,
  TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES,
  TEST_PACKAGE_IMAGE_CONTENT_TYPES,
  TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES,
  type CommentImageContentType,
  type TestPackageMediaContentType,
} from "@/constants/storage";
import { redis, redisKey } from "@/lib/redis";
import {
  AVATAR_KEY_PREFIX,
  COMMENT_IMAGE_KEY_PREFIX,
  TEST_PACKAGE_MEDIA_KEY_PREFIX,
  isLegacyCloudinaryUrl,
  isManagedAvatarKey,
  isManagedCommentImageKey,
  readWebpDimensions,
} from "@/lib/storage-keys";

export { isLegacyCloudinaryAvatarPublicId, isManagedAvatarKey } from "@/lib/storage-keys";

// Cloudflare R2 lewat protokol S3. Region selalu "auto"; path-style dipakai agar
// nama bucket tidak perlu jadi subdomain.
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// Presigned URL berumur pendek: cukup untuk satu PUT, tidak cukup untuk dibagikan.
const UPLOAD_URL_TTL_SECONDS = 120;
// Presigner S3 secara default menandai content-type sebagai unsignable. Dengan
// memaksanya (bersama content-length) masuk signature, R2 sendiri yang menolak
// PUT bertipe atau berukuran lain — batas ukuran tidak bergantung pada client.
const SIGNED_UPLOAD_HEADERS = new Set(["content-type", "content-length"]);

const pendingAvatarKey = redisKey("r2", "pending-avatars");

export type SignedUpload = {
  uploadUrl: string;
  key: string;
  url: string;
  contentType: string;
};

export function publicUrl(key: string) {
  return `${env.R2_PUBLIC_BASE_URL}/${key}`;
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
  );
}

async function createPresignedPut({
  key,
  contentType,
  contentLength,
}: {
  key: string;
  contentType: string;
  contentLength: number;
}) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: SIGNED_UPLOAD_HEADERS },
  );
}

function avatarPrefix(userId: number) {
  return `${AVATAR_KEY_PREFIX}${userId}/`;
}

// Client meng-PUT langsung ke R2 dengan URL ini; file tidak pernah melewati
// server kita dan R2_SECRET_ACCESS_KEY tidak pernah meninggalkan server.
export async function createAvatarUpload({
  userId,
  byteLength,
}: {
  userId: number;
  byteLength: number;
}): Promise<SignedUpload> {
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > AVATAR_MAX_FILE_SIZE_BYTES) {
    throw new Error("Ukuran avatar di luar batas yang diizinkan.");
  }

  const key = `${avatarPrefix(userId)}${crypto.randomUUID()}.${AVATAR_EXTENSION}`;
  const uploadUrl = await createPresignedPut({
    key,
    contentType: AVATAR_CONTENT_TYPE,
    contentLength: byteLength,
  });

  // Daftarkan sebagai pending supaya cron menghapusnya bila user tidak jadi
  // menyimpan profil.
  await redis.zadd(pendingAvatarKey, {
    score: Date.now() + AVATAR_ORPHAN_GRACE_PERIOD_SECONDS * 1000,
    member: key,
  });

  return { uploadUrl, key, url: publicUrl(key), contentType: AVATAR_CONTENT_TYPE };
}

/**
 * Memastikan object yang diklaim client memang hasil upload akun ini: key
 * miliknya, masih terdaftar pending, dan isinya WebP 512x512 dalam batas ukuran.
 * R2 tidak melakukan transformasi, jadi dimensi diperiksa dari header file.
 */
export async function verifyManagedAvatar({
  userId,
  key,
  url,
}: {
  userId: number;
  key: string;
  url: string;
}) {
  if (!isManagedAvatarKey(key, userId) || url !== publicUrl(key)) return null;

  const pendingScore = await redis.zscore(pendingAvatarKey, key);
  if (pendingScore === null) return null;

  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    );
    const bytes = head.ContentLength ?? 0;
    if (
      head.ContentType !== AVATAR_CONTENT_TYPE ||
      bytes <= 0 ||
      bytes > AVATAR_MAX_FILE_SIZE_BYTES
    ) {
      return null;
    }

    const header = await s3.send(
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Range: "bytes=0-63" }),
    );
    const headerBytes = await header.Body?.transformToByteArray();
    const dimensions = headerBytes ? readWebpDimensions(headerBytes) : null;
    if (
      !dimensions ||
      dimensions.width !== AVATAR_DIMENSION ||
      dimensions.height !== AVATAR_DIMENSION
    ) {
      return null;
    }

    return { url, key, format: AVATAR_EXTENSION, bytes };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function unscheduleAvatarCleanup(key: string) {
  await redis.zrem(pendingAvatarKey, key);
}

export async function scheduleAvatarCleanup(key: string, delaySeconds = 0) {
  if (!isManagedAvatarKey(key)) return;
  await redis.zadd(pendingAvatarKey, {
    score: Date.now() + delaySeconds * 1000,
    member: key,
  });
}

export async function getDueAvatarCleanupKeys() {
  return redis.zrange<string[]>(pendingAvatarKey, "-inf", Date.now(), {
    byScore: true,
    offset: 0,
    count: AVATAR_CLEANUP_CRON_BATCH_SIZE,
  });
}

/**
 * Menghapus avatar dari R2. Mengembalikan "skipped" untuk key di luar namespace
 * kita — termasuk `avatarPublicId` warisan Cloudinary, yang objeknya tidak ada
 * di R2 dan memang tidak bisa dihapus dari sini.
 */
export async function destroyManagedAvatar(key: string): Promise<"ok" | "skipped"> {
  if (!isManagedAvatarKey(key)) return "skipped";

  // DeleteObject bersifat idempotent: object yang sudah hilang tetap 204.
  await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  return "ok";
}

function commentImagePrefix(userId: number) {
  return `${COMMENT_IMAGE_KEY_PREFIX}${userId}/`;
}

export async function createCommentImageUpload({
  userId,
  contentType,
  byteLength,
}: {
  userId: number;
  contentType: CommentImageContentType;
  byteLength: number;
}): Promise<SignedUpload> {
  if (!isCommentImageContentType(contentType)) {
    throw new Error("Tipe gambar tidak didukung.");
  }
  if (
    !Number.isInteger(byteLength) ||
    byteLength <= 0 ||
    byteLength > COMMENT_IMAGE_MAX_FILE_SIZE_BYTES
  ) {
    throw new Error("Ukuran gambar di luar batas yang diizinkan.");
  }

  const key = `${commentImagePrefix(userId)}${crypto.randomUUID()}.${
    COMMENT_IMAGE_CONTENT_TYPES[contentType]
  }`;
  const uploadUrl = await createPresignedPut({ key, contentType, contentLength: byteLength });

  return { uploadUrl, key, url: publicUrl(key), contentType };
}

/**
 * Gambar komentar disimpan sebagai URL, jadi server wajib menolak URL yang tidak
 * berasal dari upload user ini. URL Cloudinary lama tetap diterima supaya
 * komentar sebelum migrasi masih bisa disunting.
 */
export function isAllowedCommentImageUrl(url: string, userId: number) {
  if (isLegacyCloudinaryUrl(url)) return true;

  const base = `${env.R2_PUBLIC_BASE_URL}/`;
  if (!url.startsWith(base)) return false;

  return isManagedCommentImageKey(url.slice(base.length), userId);
}

function safeMediaBasename(originalFileName: string) {
  const withoutExtension = originalFileName.replace(/\.[^.]+$/, "");
  return (
    withoutExtension
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "media"
  );
}

export async function createTestPackageMediaUpload({
  packageSlug,
  mediaType,
  contentType,
  byteLength,
  originalFileName,
}: {
  packageSlug: string;
  mediaType: "images" | "audio";
  contentType: TestPackageMediaContentType;
  byteLength: number;
  originalFileName: string;
}): Promise<SignedUpload> {
  if (!/^n[1-5]-\d{4}-(?:0[1-9]|1[0-2])$/.test(packageSlug)) {
    throw new Error("Folder paket tidak valid.");
  }

  const contentTypes =
    mediaType === "images" ? TEST_PACKAGE_IMAGE_CONTENT_TYPES : TEST_PACKAGE_AUDIO_CONTENT_TYPES;
  const validContentType =
    mediaType === "images"
      ? isTestPackageImageContentType(contentType)
      : isTestPackageAudioContentType(contentType);
  const maxBytes =
    mediaType === "images"
      ? TEST_PACKAGE_IMAGE_MAX_FILE_SIZE_BYTES
      : TEST_PACKAGE_AUDIO_MAX_FILE_SIZE_BYTES;

  if (!validContentType || !Number.isInteger(byteLength) || byteLength <= 0 || byteLength > maxBytes) {
    throw new Error("Tipe atau ukuran media di luar batas yang diizinkan.");
  }

  const extension = contentTypes[contentType as keyof typeof contentTypes];
  const uniquePrefix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const key = `${TEST_PACKAGE_MEDIA_KEY_PREFIX}${packageSlug}/${mediaType}/${uniquePrefix}-${safeMediaBasename(originalFileName)}.${extension}`;
  const uploadUrl = await createPresignedPut({ key, contentType, contentLength: byteLength });

  return { uploadUrl, key, url: publicUrl(key), contentType };
}
