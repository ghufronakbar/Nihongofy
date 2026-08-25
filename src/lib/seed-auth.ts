import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/constants";

export function getSeedAccessError(request: Request) {
  if (env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  if (!env.SEED_SECRET) {
    return NextResponse.json({ error: "Seed endpoint is not configured" }, { status: 503 });
  }

  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.SEED_SECRET}`);
  const isAuthorized = actual.length === expected.length && timingSafeEqual(actual, expected);

  return isAuthorized ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
