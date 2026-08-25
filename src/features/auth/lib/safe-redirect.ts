const DEFAULT_AUTH_REDIRECT = "/dashboard";

export function getSafeRedirectPath(
  value: string | string[] | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const baseUrl = new URL("https://jlpt-exam.local");
    const redirectUrl = new URL(candidate, baseUrl);

    if (redirectUrl.origin !== baseUrl.origin) {
      return fallback;
    }

    if (redirectUrl.pathname === "/login" || redirectUrl.pathname === "/register") {
      return fallback;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return fallback;
  }
}
