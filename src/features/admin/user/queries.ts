import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listUserSessions } from "@/lib/auth";
import type { UserFilter } from "./schemas";

// ATURAN KERAS UNTUK SELURUH FILE INI: `password` tidak pernah masuk `select`,
// bahkan hash-nya, dan `AuthToken` hanya pernah dihitung — tidak pernah dibaca
// isinya. Tabel itu menyimpan hash token verifikasi dan reset password; admin
// tidak punya alasan melihatnya, dan membacanya akan menjadikan layar ini jalur
// pengambilalihan akun.

function whereForFilter(filter: UserFilter): Prisma.UserWhereInput {
  switch (filter) {
    case "all":
      return {};
    case "admin":
      return { role: "ADMIN" };
    case "unverified":
      return { emailVerifiedAt: null };
    case "oauth":
      return { oauthAccounts: { some: {} } };
    case "pendingDeletion":
      return { deletionScheduledFor: { not: null } };
    case "postingSuspended":
      return { postingSuspendedAt: { not: null } };
  }
}

const LIST_PAGE_SIZE = 100;

export async function listAdminUsers(filter: UserFilter, query: string) {
  const where: Prisma.UserWhereInput = { ...whereForFilter(filter) };
  if (query) {
    where.OR = [
      { displayName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { username: { contains: query, mode: "insensitive" } },
    ];
  }

  const [rows, matching, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIST_PAGE_SIZE,
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        role: true,
        emailVerifiedAt: true,
        deletionScheduledFor: true,
        postingSuspendedAt: true,
        createdAt: true,
        avatarUrl: true,
        _count: { select: { oauthAccounts: true, attempts: true, questionComments: true } },
      },
    }),
    prisma.user.count({ where }),
    Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { emailVerifiedAt: null } }),
      prisma.user.count({ where: { oauthAccounts: { some: {} } } }),
      prisma.user.count({ where: { deletionScheduledFor: { not: null } } }),
      prisma.user.count({ where: { postingSuspendedAt: { not: null } } }),
    ]),
  ]);

  const [all, admin, unverified, oauth, pendingDeletion, postingSuspended] = counts;

  return {
    rows,
    matching,
    truncated: matching > rows.length,
    pageSize: LIST_PAGE_SIZE,
    counts: { all, admin, unverified, oauth, pendingDeletion, postingSuspended },
  };
}

export async function getAdminUserDetail(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      username: true,
      role: true,
      emailVerifiedAt: true,
      avatarUrl: true,
      timeZone: true,
      allowAudioStorage: true,
      allowConversationStorage: true,
      deletionRequestedAt: true,
      deletionScheduledFor: true,
      anonymizedAt: true,
      postingSuspendedAt: true,
      postingSuspendedReason: true,
      postingSuspendedBy: { select: { id: true, displayName: true } },
      createdAt: true,
      updatedAt: true,
      // Hanya keberadaannya. Akun OAuth-only punya password null, dan itu
      // informasi operasional yang sah — isinya tetap tidak pernah dibaca.
      oauthAccounts: {
        select: { provider: true, providerEmail: true, createdAt: true },
      },
      _count: {
        select: {
          attempts: true,
          questionComments: true,
          practiceSessions: true,
          conversationSessions: true,
          flashcardCards: true,
          authTokens: true,
        },
      },
    },
  });

  if (!user) return null;

  // Password tidak pernah ikut di-select. Yang dibutuhkan hanya "punya password
  // atau tidak", dan itu dijawab dengan count, bukan dengan membaca hash-nya.
  const hasPassword = (await prisma.user.count({
    where: { id: userId, password: { not: null } },
  })) > 0;

  const [lastAttempt, sessions] = await Promise.all([
    prisma.attempt.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, status: true },
    }),
    // Satu-satunya sumber kebenaran daftar perangkat. Jangan membaca key Redis
    // secara manual dari sini.
    listUserSessions(userId),
  ]);

  return { user, hasPassword, lastAttempt, sessions };
}
