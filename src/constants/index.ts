import { z } from "zod";

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

// String kosong diperlakukan sama dengan tidak diisi, supaya baris `KEY=` di
// .env tetap memakai default.
const featureFlag = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
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
    // Feature flags. Default aktif; set "false" untuk menyembunyikan modul.
    FEATURES_KANA: featureFlag,
    FEATURES_FLASHCARD: featureFlag,
    FEATURES_PRACTICE: featureFlag,
    FEATURES_TEST_PACKAGE: featureFlag,
    FEATURES_HISTORY: featureFlag,
    FEATURES_PROGRESS: featureFlag,
    FEATURES_ANALYTICS: featureFlag,
    FEATURES_ARTICLE: featureFlag,
    FEATURES_QUESTION_COMMENT: featureFlag,
    FEATURES_CONVERSATION: featureFlag,
    FEATURES_SPEAKING: featureFlag,
    CONVERSATION_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    CONVERSATION_CHAT_MODEL: optionalEnvString,
    OPENAI_API_KEY: optionalEnvString,
    OPENAI_BASE_URL: optionalEnvString,
    VERCEL_ENV: optionalEnvString,
  })
  .superRefine((value, context) => {
    // O-6: provider mock tidak boleh melayani deployment produksi. Dicek lewat
    // VERCEL_ENV, bukan NODE_ENV, supaya `next build` lokal tetap bisa jalan.
    if (
      value.FEATURES_CONVERSATION &&
      value.CONVERSATION_PROVIDER === "mock" &&
      value.VERCEL_ENV === "production"
    ) {
      context.addIssue({
        code: "custom",
        path: ["CONVERSATION_PROVIDER"],
        message: "Provider mock tidak boleh aktif pada deployment produksi.",
      });
    }

    if (value.FEATURES_CONVERSATION && value.CONVERSATION_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY wajib diisi saat CONVERSATION_PROVIDER=openai.",
      });
    }

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

// ============================================================
// FEATURE FLAGS
// ============================================================

// Satu-satunya sumber status modul. Komponen client menerima objek ini lewat
// props (tipe `FeatureFlags`), bukan mengimpor nilainya langsung.
export const FEATURES = {
  kana: env.FEATURES_KANA,
  flashcard: env.FEATURES_FLASHCARD,
  practice: env.FEATURES_PRACTICE,
  testPackage: env.FEATURES_TEST_PACKAGE,
  history: env.FEATURES_HISTORY,
  progress: env.FEATURES_PROGRESS,
  analytics: env.FEATURES_ANALYTICS,
  article: env.FEATURES_ARTICLE,
  questionComment: env.FEATURES_QUESTION_COMMENT,
  conversation: env.FEATURES_CONVERSATION,
  // Speaking menumpang seluruh jalur turn milik conversation, jadi ikut mati
  // bila conversation mati.
  speaking: env.FEATURES_SPEAKING && env.FEATURES_CONVERSATION,
};

export type FeatureFlags = typeof FEATURES;
export type FeatureName = keyof FeatureFlags;

// ============================================================
// CONVERSATION & SPEAKING
// ============================================================

export const CONVERSATION_PROVIDER = env.CONVERSATION_PROVIDER;
export const CONVERSATION_CHAT_MODEL = env.CONVERSATION_CHAT_MODEL ?? "gpt-5.6-luna";

// Konstanta conversation yang tidak berasal dari env ada di
// `src/constants/conversation.ts` supaya dapat diimpor komponen client tanpa
// ikut menarik validasi env server ke bundle browser.
