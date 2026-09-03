import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { env, GOOGLE_OAUTH_ENABLED, SITE_URL } from "@/constants";
import { EmailSchema } from "../schemas";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const GoogleTokenResponseSchema = z.object({
  id_token: z.string().min(1),
});

const GoogleIdTokenClaimsSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().min(3).max(254),
  email_verified: z.literal(true),
  nonce: z.string().min(1),
  name: z.string().optional(),
  picture: z.string().max(2048).optional(),
});

export type GoogleIdentity = {
  providerAccountId: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
};

function getGoogleOAuthConfig() {
  if (!GOOGLE_OAUTH_ENABLED || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL("/api/auth/google/callback", SITE_URL).toString(),
  };
}

function normalizeDisplayName(name: string | undefined, email: string) {
  const normalized = name
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 50);
  if (normalized && normalized.length >= 2) return normalized;

  const emailName = email.split("@")[0]?.slice(0, 50);
  return emailName && emailName.length >= 2 ? emailName : "Pengguna Google";
}

function normalizePictureUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const googleHosted =
      url.hostname === "googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com");
    return url.protocol === "https:" && googleHosted ? url.toString() : null;
  } catch {
    return null;
  }
}

export function createGoogleAuthorizationUrl({
  state,
  nonce,
  codeChallenge,
}: {
  state: string;
  nonce: string;
  codeChallenge: string;
}) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleAuthorizationCode({
  code,
  codeVerifier,
  expectedNonce,
}: {
  code: string;
  codeVerifier: string;
  expectedNonce: string;
}): Promise<GoogleIdentity> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google OAuth code exchange failed.");

  const rawTokenResponse: unknown = await response.json();
  const tokenResponse = GoogleTokenResponseSchema.parse(rawTokenResponse);
  const { payload } = await jwtVerify(tokenResponse.id_token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
    algorithms: ["RS256"],
  });
  const claims = GoogleIdTokenClaimsSchema.parse(payload);
  if (claims.nonce !== expectedNonce) throw new Error("Google OAuth nonce mismatch.");

  const email = EmailSchema.parse(claims.email);
  return {
    providerAccountId: claims.sub,
    email,
    displayName: normalizeDisplayName(claims.name, email),
    pictureUrl: normalizePictureUrl(claims.picture),
  };
}
