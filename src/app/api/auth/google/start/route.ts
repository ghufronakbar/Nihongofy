import { OAuthProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_ENABLED,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_TRANSACTION_DURATION_SECONDS,
  SITE_URL,
} from "@/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "@/features/auth/lib/rate-limit";
import { getSafeRedirectPath } from "@/features/auth/lib/safe-redirect";
import {
  createGoogleAuthorizationUrl,
} from "@/features/auth/lib/google-oauth";
import {
  createGoogleOAuthTransaction,
  createPkceCodeChallenge,
  GoogleOAuthIntentSchema,
  type GoogleOAuthIntent,
} from "@/features/auth/lib/google-oauth-state";

export const runtime = "nodejs";

function statusRedirect(intent: GoogleOAuthIntent, status: string) {
  const path =
    intent === "login" || intent === "register"
      ? `/${intent}`
      : intent === "request-deletion" || intent === "cancel-deletion"
        ? "/profile/privacy"
        : "/profile/security";
  const url = new URL(path, SITE_URL);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsedIntent = GoogleOAuthIntentSchema.safeParse(
    requestUrl.searchParams.get("intent") ?? "login",
  );
  const intent = parsedIntent.success ? parsedIntent.data : "login";
  if (!GOOGLE_OAUTH_ENABLED) return statusRedirect(intent, "not-configured");

  const nextPath = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const session = await getSession();
  let userId: number | undefined;

  if (intent === "login" || intent === "register") {
    if (session) return NextResponse.redirect(new URL(nextPath, SITE_URL));
  } else {
    if (!session) {
      const loginUrl = new URL("/login", SITE_URL);
      const destination =
        intent === "request-deletion" || intent === "cancel-deletion"
          ? "/profile/privacy"
          : "/profile/security";
      loginUrl.searchParams.set("next", destination);
      return NextResponse.redirect(loginUrl);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        password: true,
        deletionScheduledFor: true,
        oauthAccounts: {
          where: { provider: OAuthProvider.GOOGLE },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!user?.email) return statusRedirect(intent, "account-unavailable");

    const googleConnected = Boolean(user.oauthAccounts[0]);
    if (intent === "link" && googleConnected) {
      return statusRedirect(intent, "already-connected");
    }
    if (intent !== "link" && !googleConnected) {
      return statusRedirect(intent, "not-connected");
    }
    if (intent === "set-password" && user.password) {
      return statusRedirect(intent, "password-exists");
    }
    if (
      (intent === "request-deletion" || intent === "cancel-deletion") &&
      user.password
    ) {
      return statusRedirect(intent, "password-required");
    }
    if (intent === "cancel-deletion" && !user.deletionScheduledFor) {
      return statusRedirect(intent, "deletion-not-pending");
    }

    userId = session.userId;
  }

  const ipAddress = await getRequestIpAddress();
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: "google-oauth-start:ip",
      subject: ipAddress ?? "unknown",
      maxAttempts: ipAddress ? 30 : 10,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    },
  ];
  if (userId) {
    buckets.push({
      scope: "google-oauth-start:user",
      subject: String(userId),
      maxAttempts: 20,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    });
  }

  const rateLimit = await consumeAuthRateLimits(buckets);
  if (!rateLimit.allowed) return statusRedirect(intent, "rate-limited");

  const { state, transaction } = await createGoogleOAuthTransaction({
    intent,
    nextPath,
    userId,
  });
  const authorizationUrl = createGoogleAuthorizationUrl({
    state,
    nonce: transaction.nonce,
    codeChallenge: createPkceCodeChallenge(transaction.codeVerifier),
  });
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: GOOGLE_OAUTH_TRANSACTION_DURATION_SECONDS,
    path: "/api/auth/google",
  });
  return response;
}
