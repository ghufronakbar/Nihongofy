import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAvailableUsername, toUsernameCandidate } from "@/lib/username";

// Dipisahkan dari `src/lib/username.ts` karena butuh prisma; file itu juga
// dipakai komponen client untuk validasi form.
export async function generateUniqueUsername(
  { displayName, email }: { displayName: string; email: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const candidate =
    toUsernameCandidate(displayName) ||
    toUsernameCandidate(email?.split("@")[0] ?? "") ||
    "";

  return resolveAvailableUsername(candidate, async (value) => {
    const existing = await client.user.findUnique({
      where: { username: value },
      select: { id: true },
    });
    return existing !== null;
  });
}
