import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

// Optimistic check only. Every protected layout and Server Action still verifies
// the session because Proxy must not be the only authorization boundary.
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/article",
  "/kana",
  "/kana/hiragana",
  "/kana/katakana",
  "/vocab",
  "/exercises",
  "/test-package",
];

const PUBLIC_PREFIXES = [
  "/article/",
  "/kana/",
  "/vocab/",
  "/exercises/",
  "/test-package/",
  "/exam/",
  "/result/",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const session = await getSession();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
