import "server-only";

import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/time-zone";

export function getUserTimeZone(userId: number) {
  return unstable_cache(
    async (id: number) => {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { timeZone: true },
      });

      return user && isValidTimeZone(user.timeZone) ? user.timeZone : DEFAULT_TIME_ZONE;
    },
    CACHE_KEYS.userTimeZone(userId),
    { tags: [CACHE_TAGS.profileAccount(userId)] },
  )(userId);
}

export async function getCurrentUserTimeZone() {
  const session = await getSession();
  if (!session) redirect("/login");

  return getUserTimeZone(session.userId);
}
