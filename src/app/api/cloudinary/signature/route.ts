import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSignedUploadParams } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

const MAX_FOLDER_LENGTH = 160;
const FOLDER_PATTERN = /^jlpt-exam\/[a-z0-9][a-z0-9/_-]*$/;

/**
 * Returns short-lived Cloudinary upload parameters.
 * The file is uploaded directly from the client to Cloudinary; the API
 * never receives the file and never exposes CLOUDINARY_API_SECRET.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedFolder = `jlpt-exam/comments/${session.userId}`;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const folder = typeof body === "object" && body !== null && "folder" in body
    ? (body as { folder?: unknown }).folder
    : undefined;

  if (
    typeof folder !== "string" ||
    folder.length === 0 ||
    folder.length > MAX_FOLDER_LENGTH ||
    !FOLDER_PATTERN.test(folder) ||
    folder !== allowedFolder
  ) {
    return NextResponse.json({ error: "Invalid Cloudinary folder" }, { status: 400 });
  }

  return NextResponse.json(createSignedUploadParams(folder));
}
