"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { LoginSchema, type LoginInput } from "./schemas";
import { getSafeRedirectPath } from "./lib/safe-redirect";

export type AuthActionResult = { message: string } | undefined;

const INVALID_CREDENTIALS_MESSAGE = "Username atau password salah.";

export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const validatedFields = LoginSchema.safeParse(input);

  if (!validatedFields.success) {
    return { message: validatedFields.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { username, password, next } = validatedFields.data;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    return { message: INVALID_CREDENTIALS_MESSAGE };
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return { message: INVALID_CREDENTIALS_MESSAGE };
  }

  await createSession(user.id);
  redirect(getSafeRedirectPath(next));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
