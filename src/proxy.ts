import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

// Route group (auth): "/" handles its own redirect logic (checks count(User)),
// "/first-time-setup" and "/login" guard themselves against an existing session.
// Optimistic check only — every Server Action still verifies the session itself.
const PUBLIC_ROUTES = ["/", "/first-time-setup", "/login"];

// Route handlers enforce a separate bearer secret and return 404 in production.
const PUBLIC_PREFIXES = ["/api/seed/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
