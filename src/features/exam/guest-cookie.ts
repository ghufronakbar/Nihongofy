// Pembaca cookie exam guest. Sengaja dipisah dari `actions.ts` karena file
// "use server" hanya boleh mengekspor async function, sedangkan modul ini juga
// dipakai fitur result.

import { cookies } from "next/headers";
import { GuestExamCookieSchema } from "./schemas";

export const GUEST_EXAM_COOKIE = "jlpt_guest_exam";

export async function readGuestExamCookie() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_EXAM_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = GuestExamCookieSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
