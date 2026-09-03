import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  GOOGLE_OAUTH_REAUTH_COOKIE_NAME,
  GOOGLE_OAUTH_REAUTH_DURATION_SECONDS,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_TRANSACTION_DURATION_SECONDS,
} from "@/constants";
import { redis, redisKey } from "@/lib/redis";

export const GoogleOAuthIntentSchema = z.enum([
  "login",
  "register",
  "link",
  "set-password",
  "request-deletion",
  "cancel-deletion",
]);

export const GoogleOAuthReauthPurposeSchema = z.enum([
  "set-password",
  "request-deletion",
  "cancel-deletion",
]);

export type GoogleOAuthIntent = z.infer<typeof GoogleOAuthIntentSchema>;
export type GoogleOAuthReauthPurpose = z.infer<
  typeof GoogleOAuthReauthPurposeSchema
>;

const GoogleOAuthTransactionSchema = z.object({
  intent: GoogleOAuthIntentSchema,
  codeVerifier: z.string().min(43).max(128),
  nonce: z.string().min(32).max(128),
  nextPath: z.string().startsWith("/").max(2048),
  userId: z.number().int().positive().optional(),
  createdAt: z.iso.datetime(),
});

const GoogleOAuthReauthProofSchema = z.object({
  userId: z.number().int().positive(),
  purpose: GoogleOAuthReauthPurposeSchema,
  providerAccountId: z.string().min(1).max(255),
  createdAt: z.iso.datetime(),
});

function transactionKey(state: string) {
  return redisKey("auth", "google-oauth", "transaction", state);
}

function reauthKey(token: string) {
  return redisKey("auth", "google-oauth", "reauth", token);
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function createPkceCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export async function createGoogleOAuthTransaction({
  intent,
  nextPath,
  userId,
}: {
  intent: GoogleOAuthIntent;
  nextPath: string;
  userId?: number;
}) {
  const state = randomToken();
  const transaction = {
    intent,
    codeVerifier: randomToken(),
    nonce: randomToken(),
    nextPath,
    userId,
    createdAt: new Date().toISOString(),
  };

  const stored = await redis.set(transactionKey(state), transaction, {
    ex: GOOGLE_OAUTH_TRANSACTION_DURATION_SECONDS,
    nx: true,
  });
  if (stored !== "OK") throw new Error("Google OAuth transaction could not be created.");

  return { state, transaction };
}

export async function consumeGoogleOAuthTransaction(state: string) {
  const rawTransaction = await redis.getdel<unknown>(transactionKey(state));
  const transaction = GoogleOAuthTransactionSchema.safeParse(rawTransaction);
  return transaction.success ? transaction.data : null;
}

export async function createGoogleOAuthReauthProof({
  userId,
  purpose,
  providerAccountId,
}: {
  userId: number;
  purpose: GoogleOAuthReauthPurpose;
  providerAccountId: string;
}) {
  const token = randomToken();
  const proof = {
    userId,
    purpose,
    providerAccountId,
    createdAt: new Date().toISOString(),
  };

  await redis.set(reauthKey(token), proof, {
    ex: GOOGLE_OAUTH_REAUTH_DURATION_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_REAUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: GOOGLE_OAUTH_REAUTH_DURATION_SECONDS,
    path: "/",
  });
}

export async function consumeGoogleOAuthReauthProof({
  userId,
  purpose,
}: {
  userId: number;
  purpose: GoogleOAuthReauthPurpose;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(GOOGLE_OAUTH_REAUTH_COOKIE_NAME)?.value;
  cookieStore.delete(GOOGLE_OAUTH_REAUTH_COOKIE_NAME);
  if (!token) return false;

  const rawProof = await redis.getdel<unknown>(reauthKey(token));
  const proof = GoogleOAuthReauthProofSchema.safeParse(rawProof);
  return Boolean(
    proof.success &&
      proof.data.userId === userId &&
      proof.data.purpose === purpose,
  );
}

export async function clearGoogleOAuthStateCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME);
}
