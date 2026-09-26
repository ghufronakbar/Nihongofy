// Titipan lembar jawaban guest selama perjalanan auth.
//
// Jawaban guest hidup di `sessionStorage`, yang terikat pada satu tab. Itu cukup
// untuk jalur login (server action membuat session lalu redirect di tab yang
// sama), tetapi putus di jalur register: `registerAction` tidak membuat session,
// melainkan mengirim email verifikasi, dan tautannya hampir selalu dibuka di tab
// baru. Karena itu jawaban dipindahkan ke server begitu user menyatakan ingin
// menyimpan — sebelum auth dimulai — dengan pola yang sama seperti transaksi
// Google OAuth: token acak di cookie httpOnly, payload di Redis ber-TTL. Cookie
// dibagi lintas tab, jadi tab dari tautan email tetap bisa menyelesaikan impor.

import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { JlptSection } from "@prisma/client";
import { redis, redisKey } from "@/lib/redis";
import {
  GUEST_ATTEMPT_STASH_COOKIE_NAME,
  GUEST_ATTEMPT_STASH_DURATION_SECONDS,
} from "@/constants";
import { ExamAnswerSchema, type ExamAnswerInput } from "@/features/exam/schemas";

const GuestAttemptStashSchema = z.object({
  testPackageId: z.number().int().positive(),
  sectionScope: z.nativeEnum(JlptSection).nullable(),
  startedAt: z.iso.datetime().nullable(),
  answers: z.array(ExamAnswerSchema),
  createdAt: z.iso.datetime(),
});

export type GuestAttemptStash = z.infer<typeof GuestAttemptStashSchema>;

function stashKey(token: string) {
  return redisKey("result", "guest-attempt", token);
}

export async function createGuestAttemptStash({
  testPackageId,
  sectionScope,
  startedAt,
  answers,
}: {
  testPackageId: number;
  sectionScope: JlptSection | null;
  startedAt: string | null;
  answers: ExamAnswerInput[];
}) {
  const token = randomBytes(32).toString("base64url");

  await redis.set(
    stashKey(token),
    {
      testPackageId,
      sectionScope,
      startedAt,
      answers,
      createdAt: new Date().toISOString(),
    } satisfies GuestAttemptStash,
    { ex: GUEST_ATTEMPT_STASH_DURATION_SECONDS },
  );

  const cookieStore = await cookies();
  cookieStore.set(GUEST_ATTEMPT_STASH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: GUEST_ATTEMPT_STASH_DURATION_SECONDS,
    path: "/",
  });
}

/** Sekali pakai: token dihapus dari Redis dan cookie dibuang bersamaan. */
export async function consumeGuestAttemptStash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_ATTEMPT_STASH_COOKIE_NAME)?.value;
  if (!token) return null;

  cookieStore.delete(GUEST_ATTEMPT_STASH_COOKIE_NAME);

  const raw = await redis.getdel<unknown>(stashKey(token));
  const parsed = GuestAttemptStashSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
