"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileVisibilitySchema, type ProfileVisibilityInput } from "./schemas";

export type PublicProfileActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

// Halaman /u/[username] dirender dinamis (membaca session) dan visibility dibaca
// per request, jadi tidak ada cache profil yang perlu diinvalidasi di sini.
// Yang di-revalidate hanya layout dashboard, tempat banner pemberitahuan tampil.

export async function updateProfileVisibilityAction(
  input: ProfileVisibilityInput,
): Promise<PublicProfileActionResult> {
  if (!FEATURES.publicProfile) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = ProfileVisibilitySchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Pilihan visibility tidak valid." };

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      profileVisibility: validated.data.profileVisibility,
      // Memilih visibility sendiri berarti pemberitahuan default PUBLIC sudah
      // tidak relevan.
      publicProfileNoticeDismissedAt: new Date(),
    },
    select: { id: true },
  });

  revalidatePath("/(dashboard)", "layout");
  return {
    ok: true,
    message:
      validated.data.profileVisibility === "PUBLIC"
        ? "Profil sekarang publik."
        : "Profil sekarang private. Isinya hanya terlihat olehmu.",
  };
}

export async function dismissPublicProfileNoticeAction(): Promise<PublicProfileActionResult> {
  if (!FEATURES.publicProfile) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  await prisma.user.updateMany({
    where: { id: session.userId, publicProfileNoticeDismissedAt: null },
    data: { publicProfileNoticeDismissedAt: new Date() },
  });

  revalidatePath("/(dashboard)", "layout");
  return { ok: true, message: "Pemberitahuan ditutup." };
}
