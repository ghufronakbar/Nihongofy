import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  GOOGLE_OAUTH_ENABLED,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  SITE_URL,
} from "@/constants";
import { CACHE_TAGS } from "@/constants/cache-key";
import { createSession, getSession } from "@/lib/auth";
import { reportServerError } from "@/lib/server-logger";
import {
  connectGoogleAccount,
  googleIdentityBelongsToUser,
  loginWithGoogle,
} from "@/features/auth/lib/google-account";
import {
  exchangeGoogleAuthorizationCode,
  type GoogleIdentity,
} from "@/features/auth/lib/google-oauth";
import {
  consumeGoogleOAuthTransaction,
  createGoogleOAuthReauthProof,
  type GoogleOAuthIntent,
  type GoogleOAuthReauthPurpose,
} from "@/features/auth/lib/google-oauth-state";
import { clearPendingVerification } from "@/features/auth/lib/pending-verification";

export const runtime = "nodejs";

function statusPath(intent: GoogleOAuthIntent | null, status: string, nextPath?: string) {
  const path =
    intent === "login" || intent === "register" || !intent
      ? intent === "register" ? "/register" : "/login"
      : intent === "request-deletion" || intent === "cancel-deletion"
        ? "/profile/privacy"
        : "/profile/security";
  const url = new URL(path, SITE_URL);
  url.searchParams.set("google", status);
  if ((path === "/login" || path === "/register") && nextPath && nextPath !== "/dashboard") {
    url.searchParams.set("next", nextPath);
  }
  return `${url.pathname}${url.search}`;
}

function reauthDestination(intent: GoogleOAuthReauthPurpose) {
  const path = intent === "set-password" ? "/profile/security" : "/profile/privacy";
  const url = new URL(path, SITE_URL);
  url.searchParams.set("googleReauth", intent);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const returnedState = requestUrl.searchParams.get("state");
  const cookieState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME);

  if (
    !GOOGLE_OAUTH_ENABLED ||
    !returnedState ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(returnedState) ||
    returnedState !== cookieState
  ) {
    redirect(statusPath(null, "invalid-state"));
  }

  const transaction = await consumeGoogleOAuthTransaction(returnedState);
  if (!transaction) redirect(statusPath(null, "expired-state"));

  if (requestUrl.searchParams.has("error")) {
    redirect(statusPath(transaction.intent, "cancelled", transaction.nextPath));
  }

  const code = requestUrl.searchParams.get("code");
  if (!code || code.length > 4096) {
    redirect(statusPath(transaction.intent, "invalid-callback", transaction.nextPath));
  }

  let identity: GoogleIdentity;
  try {
    identity = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier: transaction.codeVerifier,
      expectedNonce: transaction.nonce,
    });
  } catch (error) {
    reportServerError("auth.google_oauth_callback_failed", error);
    redirect(statusPath(transaction.intent, "verification-failed", transaction.nextPath));
  }

  if (transaction.intent === "login" || transaction.intent === "register") {
    const result = await loginWithGoogle(identity);
    if (!result.ok) {
      redirect(statusPath(transaction.intent, result.reason, transaction.nextPath));
    }
    if (
      result.user.deletionScheduledFor &&
      result.user.deletionScheduledFor.getTime() <= Date.now()
    ) {
      redirect(statusPath(transaction.intent, "account-unavailable", transaction.nextPath));
    }

    await clearPendingVerification();
    await createSession(result.user.id);
    if (result.user.deletionScheduledFor) {
      redirect("/profile/privacy?deletion=pending");
    }
    redirect(transaction.nextPath);
  }

  const activeSession = await getSession();
  if (!activeSession || activeSession.userId !== transaction.userId) {
    redirect(statusPath(transaction.intent, "session-changed"));
  }

  if (transaction.intent === "link") {
    const result = await connectGoogleAccount(activeSession.userId, identity);
    if (!result.ok) redirect(statusPath(transaction.intent, result.reason));

    revalidateTag(CACHE_TAGS.profileAccount(activeSession.userId), { expire: 0 });
    redirect(statusPath(transaction.intent, result.created ? "connected" : "already-connected"));
  }

  const identityMatches = await googleIdentityBelongsToUser(
    activeSession.userId,
    identity.providerAccountId,
  );
  if (!identityMatches) redirect(statusPath(transaction.intent, "reauth-mismatch"));

  await createGoogleOAuthReauthProof({
    userId: activeSession.userId,
    purpose: transaction.intent,
    providerAccountId: identity.providerAccountId,
  });
  redirect(reauthDestination(transaction.intent));
}
