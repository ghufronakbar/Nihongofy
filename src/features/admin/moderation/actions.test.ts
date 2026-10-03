import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Aksi moderasi diuji dengan Prisma tiruan; tidak ada koneksi database. Klien
// global dan klien transaksi dibuat terpisah, sehingga test dapat membedakan
// mutasi yang tercatat bersama audit-nya dari mutasi di luar transaksi.

const mocks = vi.hoisted(() => {
  const commentDelegate = () => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    requireAdmin: vi.fn(),
    revalidateTag: vi.fn(),
    updateTag: vi.fn(),
    db: { questionComment: commentDelegate(), adminAuditLog: { create: vi.fn() } },
    tx: { questionComment: commentDelegate(), adminAuditLog: { create: vi.fn() } },
    transaction: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server-logger", () => ({ reportServerError: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...mocks.db, $transaction: mocks.transaction } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, updateTag: mocks.updateTag }));

import {
  hideDiscussionRootAction,
  restoreCommentAction,
  takedownCommentAction,
} from "./actions";

const ADMIN_ID = 1;
const AUTHOR_ID = 7;
const ADMIN = {
  userId: ADMIN_ID,
  sessionId: "sesi",
  user: { id: ADMIN_ID, displayName: "Admin Satu", avatarUrl: null, role: "ADMIN" },
};

const findComment = mocks.db.questionComment.findUnique;

/** Seluruh mutasi `QuestionComment`, di dalam maupun di luar transaksi. */
function commentWrites() {
  return [mocks.db.questionComment, mocks.tx.questionComment].flatMap((delegate) =>
    (["update", "updateMany", "delete", "deleteMany"] as const).flatMap((method) =>
      delegate[method].mock.calls.map(([args]) => ({ method, args })),
    ),
  );
}

function expectNoWrites() {
  expect(commentWrites()).toEqual([]);
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.db.adminAuditLog.create).not.toHaveBeenCalled();
  expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
}

/** Satu baris audit yang ditulis di dalam transaksi, bukan lewat klien global. */
function expectAuditInTransaction(action: string, commentId: number) {
  expect(mocks.db.adminAuditLog.create).not.toHaveBeenCalled();
  expect(mocks.tx.adminAuditLog.create).toHaveBeenCalledOnce();
  expect(mocks.tx.adminAuditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      actorId: ADMIN_ID,
      actorName: "Admin Satu",
      action,
      targetType: "comment",
      targetId: String(commentId),
    }),
  });
}

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue(ADMIN);
  mocks.transaction.mockImplementation(async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx));
});

afterEach(() => {
  // Thread diskusi tidak di-cache (docs/module/admin.md "Pengecualian diskusi"),
  // jadi tidak ada aksi moderasi yang perlu menginvalidasi tag apa pun.
  expect(mocks.revalidateTag).not.toHaveBeenCalled();
  expect(mocks.updateTag).not.toHaveBeenCalled();
  vi.clearAllMocks();
});

describe.each([
  ["takedownCommentAction", takedownCommentAction],
  ["hideDiscussionRootAction", hideDiscussionRootAction],
  ["restoreCommentAction", restoreCommentAction],
] as const)("%s: guard", (_name, action) => {
  it("non-admin ditolak 404 sebelum menyentuh database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(action({ commentId: 42 })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findComment).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("commentId yang tidak valid ditolak zod", async () => {
    for (const commentId of [0, -3, 1.5]) {
      await expect(action({ commentId })).rejects.toThrow("Data tidak valid.");
    }
    await expect(action({ commentId: "42" } as unknown as { commentId: number })).rejects.toThrow(
      "Data tidak valid.",
    );
    expect(findComment).not.toHaveBeenCalled();
    expectNoWrites();
  });
});

describe("takedownCommentAction", () => {
  it("mengisi deletedAt dan deletedById admin di transaksi yang sama dengan audit, tanpa hard delete", async () => {
    findComment.mockResolvedValue({ id: 42, deletedAt: null, sharedAt: new Date("2026-10-01") });

    await takedownCommentAction({ commentId: 42 });

    expect(commentWrites()).toEqual([
      {
        method: "update",
        args: { where: { id: 42 }, data: { deletedAt: expect.any(Date), deletedById: ADMIN_ID } },
      },
    ]);
    expect(mocks.tx.questionComment.update).toHaveBeenCalledOnce();
    expectAuditInTransaction("comment.takedown", 42);
  });

  it("catatan privat yang tidak pernah dibagikan bukan objek moderasi", async () => {
    findComment.mockResolvedValue({ id: 42, deletedAt: null, sharedAt: null });

    await expect(takedownCommentAction({ commentId: 42 })).rejects.toThrow("NEXT_NOT_FOUND");
    expectNoWrites();
  });

  it("entri yang tidak ada berakhir 404", async () => {
    findComment.mockResolvedValue(null);

    await expect(takedownCommentAction({ commentId: 42 })).rejects.toThrow("NEXT_NOT_FOUND");
    expectNoWrites();
  });

  it("entri yang sudah terhapus tidak ditulis ulang, sehingga penghapus aslinya tetap tercatat", async () => {
    findComment.mockResolvedValue({ id: 42, deletedAt: new Date(), sharedAt: new Date() });

    await takedownCommentAction({ commentId: 42 });

    expectNoWrites();
  });
});

describe("hideDiscussionRootAction", () => {
  it("menarik root publik menjadi privat tanpa menghapusnya", async () => {
    findComment.mockResolvedValue({ id: 42, parentId: null, deletedAt: null });

    await hideDiscussionRootAction({ commentId: 42 });

    expect(commentWrites()).toEqual([
      { method: "update", args: { where: { id: 42 }, data: { visibility: "PRIVATE" } } },
    ]);
    expectAuditInTransaction("comment.hide", 42);
  });

  it("balasan tidak punya visibility sendiri dan ditolak", async () => {
    findComment.mockResolvedValue({ id: 43, parentId: 42, deletedAt: null });

    await expect(hideDiscussionRootAction({ commentId: 43 })).rejects.toThrow(/takedown/);
    expectNoWrites();
  });

  it("entri yang sudah terhapus berakhir 404", async () => {
    findComment.mockResolvedValue({ id: 42, parentId: null, deletedAt: new Date() });

    await expect(hideDiscussionRootAction({ commentId: 42 })).rejects.toThrow("NEXT_NOT_FOUND");
    expectNoWrites();
  });
});

describe("restoreCommentAction", () => {
  it("memulihkan takedown admin dan mencatatnya", async () => {
    findComment.mockResolvedValue({
      id: 42,
      userId: AUTHOR_ID,
      deletedAt: new Date(),
      deletedById: ADMIN_ID,
    });

    await restoreCommentAction({ commentId: 42 });

    expect(commentWrites()).toEqual([
      { method: "update", args: { where: { id: 42 }, data: { deletedAt: null, deletedById: null } } },
    ]);
    expectAuditInTransaction("comment.restore", 42);
  });

  it("hapusan pemilik sendiri tidak dapat dipulihkan admin", async () => {
    findComment.mockResolvedValue({
      id: 42,
      userId: AUTHOR_ID,
      deletedAt: new Date(),
      deletedById: AUTHOR_ID,
    });

    await expect(restoreCommentAction({ commentId: 42 })).rejects.toThrow(/pemiliknya sendiri/);
    expectNoWrites();
  });

  it("hapusan lama tanpa catatan penghapus diperlakukan sebagai hapusan pemilik", async () => {
    findComment.mockResolvedValue({ id: 42, userId: AUTHOR_ID, deletedAt: new Date(), deletedById: null });

    await expect(restoreCommentAction({ commentId: 42 })).rejects.toThrow(/pemiliknya sendiri/);
    expectNoWrites();
  });

  it("entri yang tidak terhapus berakhir 404", async () => {
    findComment.mockResolvedValue({ id: 42, userId: AUTHOR_ID, deletedAt: null, deletedById: null });

    await expect(restoreCommentAction({ commentId: 42 })).rejects.toThrow("NEXT_NOT_FOUND");
    expectNoWrites();
  });
});
