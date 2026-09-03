import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import {
  env,
  PENDING_VERIFICATION_COOKIE_NAME,
  PENDING_VERIFICATION_DURATION_SECONDS,
} from "@/constants";

const encodedSecret = new TextEncoder().encode(env.SESSION_SECRET);

const PendingVerificationSchema = z.object({
  userId: z.number().int().positive(),
  email: z.email(),
  next: z.string().max(2048),
});

export type PendingVerification = z.infer<typeof PendingVerificationSchema>;

export async function setPendingVerification(value: PendingVerification) {
  const token = await new SignJWT(value)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_VERIFICATION_DURATION_SECONDS}s`)
    .setAudience("email-verification")
    .sign(encodedSecret);
  const cookieStore = await cookies();
  cookieStore.set(PENDING_VERIFICATION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: PENDING_VERIFICATION_DURATION_SECONDS,
    path: "/",
  });
}

export async function getPendingVerification(): Promise<PendingVerification | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_VERIFICATION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ["HS256"],
      audience: "email-verification",
    });
    const parsed = PendingVerificationSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearPendingVerification() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_VERIFICATION_COOKIE_NAME);
}
