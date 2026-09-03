import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import {
  AVATAR_CLEANUP_CRON_BATCH_SIZE,
  AVATAR_MAX_FILE_SIZE_BYTES,
  AVATAR_ORPHAN_GRACE_PERIOD_SECONDS,
  env,
} from "@/constants";
import { redis, redisKey } from "@/lib/redis";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export type AvatarSignedUploadParams = {
  timestamp: number;
  publicId: string;
  allowedFormats: string;
  transformation: string;
  overwrite: boolean;
  signature: string;
  apiKey: string;
  cloudName: string;
};

const ALLOWED_AVATAR_FORMATS = ["jpg", "png", "webp"] as const;
const ALLOWED_AVATAR_FORMATS_PARAM = ALLOWED_AVATAR_FORMATS.join(",");
const AVATAR_TRANSFORMATION = "c_fill,g_auto,h_512,w_512";
const pendingAvatarKey = redisKey("cloudinary", "pending-avatars");

const CloudinaryAvatarResourceSchema = z.object({
  public_id: z.string(),
  format: z.enum(ALLOWED_AVATAR_FORMATS),
  resource_type: z.literal("image"),
  type: z.literal("upload"),
  bytes: z.number().int().positive().max(AVATAR_MAX_FILE_SIZE_BYTES),
  width: z.literal(512),
  height: z.literal(512),
  secure_url: z.url(),
});

const CloudinaryDestroyResponseSchema = z.object({
  result: z.enum(["ok", "not found"]),
});

function avatarPrefix(userId: number) {
  return `jlpt-exam/avatars/${userId}/`;
}

export function isManagedAvatarPublicId(publicId: string, userId?: number) {
  const prefix = userId === undefined ? "jlpt-exam/avatars/" : avatarPrefix(userId);
  const resourceName = publicId.slice(prefix.length);
  return (
    publicId.startsWith(prefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      resourceName,
    )
  );
}

// Client uploads directly to Cloudinary (never through our server) using these
// signed params — api_secret itself never leaves the server.
export async function createSignedAvatarUploadParams(
  userId: number,
): Promise<AvatarSignedUploadParams> {
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${avatarPrefix(userId)}${crypto.randomUUID()}`;
  const overwrite = false;
  const signature = cloudinary.utils.api_sign_request(
    {
      allowed_formats: ALLOWED_AVATAR_FORMATS_PARAM,
      overwrite,
      public_id: publicId,
      timestamp,
      transformation: AVATAR_TRANSFORMATION,
    },
    env.CLOUDINARY_API_SECRET,
  );

  await redis.zadd(pendingAvatarKey, {
    score: Date.now() + AVATAR_ORPHAN_GRACE_PERIOD_SECONDS * 1000,
    member: publicId,
  });

  return {
    timestamp,
    publicId,
    allowedFormats: ALLOWED_AVATAR_FORMATS_PARAM,
    transformation: AVATAR_TRANSFORMATION,
    overwrite,
    signature,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  };
}

export function createSignedUploadParams(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET,
  );

  return {
    timestamp,
    folder,
    signature,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  };
}

export async function verifyManagedAvatar({
  userId,
  publicId,
  secureUrl,
}: {
  userId: number;
  publicId: string;
  secureUrl: string;
}) {
  if (!isManagedAvatarPublicId(publicId, userId)) return null;

  const pendingScore = await redis.zscore(pendingAvatarKey, publicId);
  if (pendingScore === null) return null;

  const rawResource: unknown = await cloudinary.api.resource(publicId, {
    resource_type: "image",
    type: "upload",
  });
  const resource = CloudinaryAvatarResourceSchema.safeParse(rawResource);
  if (
    !resource.success ||
    resource.data.public_id !== publicId ||
    resource.data.secure_url !== secureUrl
  ) {
    return null;
  }

  const url = new URL(resource.data.secure_url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`)
  ) {
    return null;
  }

  return {
    url: resource.data.secure_url,
    publicId: resource.data.public_id,
    format: resource.data.format,
    bytes: resource.data.bytes,
  };
}

export async function unscheduleAvatarCleanup(publicId: string) {
  await redis.zrem(pendingAvatarKey, publicId);
}

export async function scheduleAvatarCleanup(publicId: string, delaySeconds = 0) {
  if (!isManagedAvatarPublicId(publicId)) return;
  await redis.zadd(pendingAvatarKey, {
    score: Date.now() + delaySeconds * 1000,
    member: publicId,
  });
}

export async function getDueAvatarCleanupPublicIds() {
  return redis.zrange<string[]>(pendingAvatarKey, "-inf", Date.now(), {
    byScore: true,
    offset: 0,
    count: AVATAR_CLEANUP_CRON_BATCH_SIZE,
  });
}

export async function destroyManagedAvatar(publicId: string) {
  if (!isManagedAvatarPublicId(publicId)) {
    throw new Error("Refusing to destroy an unmanaged Cloudinary resource.");
  }

  const rawResult: unknown = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  });
  const result = CloudinaryDestroyResponseSchema.safeParse(rawResult);
  if (!result.success) throw new Error("Cloudinary returned an invalid destroy response.");

  return result.data.result;
}
