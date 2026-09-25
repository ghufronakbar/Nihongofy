import "server-only";

import { prisma } from "@/lib/prisma";

export async function listAdminAuditLog(limit = 100) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      actorId: true,
      actorName: true,
      action: true,
      targetType: true,
      targetId: true,
      summary: true,
      createdAt: true,
    },
  });
}

export async function getAuditLogTotal() {
  return prisma.adminAuditLog.count();
}
