import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

// Optimistic check only. Every protected layout and Server Action still verifies
// the session because Proxy must not be the only authorization boundary.
//
// `/flashcard` dan `/flashcard/try/*` sengaja publik: guest boleh mencoba deck
// bawaan tanpa akun (progres tidak disimpan). Yang dilindungi hanya koleksi
// milik user: /flashcard/deck/*, /flashcard/add, /flashcard/import.
const PROTECTED_ROUTES = [
  "/analytics",
  "/dashboard",
  "/flashcard/add",
  "/flashcard/import",
  "/history",
  "/profile",
  "/progress",
];

const PROTECTED_PREFIXES = [
  "/analytics/",
  "/api/",
  "/dashboard/",
  "/flashcard/add/",
  "/flashcard/deck/",
  "/flashcard/import/",
  "/history/",
  "/profile/",
  "/progress/",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/google/")
  ) {
    return NextResponse.next();
  }

  const isProtectedRoute =
    PROTECTED_ROUTES.includes(pathname) ||
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtectedRoute) {
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
