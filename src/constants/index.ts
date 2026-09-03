import { z } from "zod";

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(1),
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    REDIS_PREFIX: z.string().trim().min(1).max(64),
    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
    SMTP_USER: z.string().trim().min(1),
    SMTP_APP_PASSWORD: z.string().min(1),
    SMTP_FROM_NAME: z.string().trim().min(1),
    SMTP_FROM_EMAIL: z.email(),
    CLOUDFLARE_TURNSTILE_SITEKEY: z.string().trim().min(1),
    CLOUDFLARE_TURNSTILE_SECRETKEY: z.string().trim().min(1),
    GOOGLE_CLIENT_ID: optionalEnvString,
    GOOGLE_CLIENT_SECRET: optionalEnvString,
    CRON_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(16).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (Boolean(value.GOOGLE_CLIENT_ID) === Boolean(value.GOOGLE_CLIENT_SECRET)) return;

    context.addIssue({
      code: "custom",
      path: [value.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
      message: "Google OAuth client ID dan secret harus diisi bersama.",
    });
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables: ${parsedEnv.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ")}`,
  );
}

export const env = parsedEnv.data;

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const MAX_ACTIVE_SESSIONS = 20;
export const SESSION_ACTIVITY_UPDATE_SECONDS = 15 * 60;

export const PENDING_VERIFICATION_COOKIE_NAME = "pending_email_verification";
export const PENDING_VERIFICATION_DURATION_SECONDS = 60 * 60 * 24;
export const EMAIL_VERIFICATION_DURATION_SECONDS = 30 * 60;
export const PASSWORD_RESET_DURATION_SECONDS = 15 * 60;
export const EMAIL_SEND_COOLDOWN_SECONDS = 60;
export const ACCOUNT_DELETION_GRACE_PERIOD_SECONDS = 7 * 24 * 60 * 60;
export const ACCOUNT_DELETION_CRON_BATCH_SIZE = 10;
export const AVATAR_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const AVATAR_ORPHAN_GRACE_PERIOD_SECONDS = 2 * 60 * 60;
export const AVATAR_CLEANUP_CRON_BATCH_SIZE = 10;
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google_oauth_state";
export const GOOGLE_OAUTH_REAUTH_COOKIE_NAME = "google_oauth_reauth";
export const GOOGLE_OAUTH_TRANSACTION_DURATION_SECONDS = 10 * 60;
export const GOOGLE_OAUTH_REAUTH_DURATION_SECONDS = 5 * 60;

export const BCRYPT_COST_FACTOR = 12;

export const SITE_URL = new URL(env.APP_URL);
export const GOOGLE_OAUTH_ENABLED = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);
