import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Opt-in only. Never fall back to DATABASE_URL, which may point to production.
const databaseUrl = process.env.ARTICLE_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.startsWith("/nihongofy_article_")
  ) {
    throw new Error(
      "Artikel integration test hanya menerima database QA lokal nihongofy_article_*.",
    );
  }
}

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireAdmin: vi.fn(),
  limitByRedis: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    prisma: new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.ARTICLE_TEST_DATABASE_URL ??
            "postgresql://invalid:invalid@localhost:1/never_connect",
        },
      },
    }),
  };
});
vi.mock("@/constants", () => ({
  FEATURES: {
    article: true,
    community: true,
    publicProfile: true,
    questionComment: true,
    questionDiscussion: true,
  },
  COMMENT_WRITE_RATE_LIMITS: [],
  COMMENT_VOTE_RATE_LIMITS: [],
  COMMENT_IMAGE_UPLOAD_RATE_LIMITS: [],
}));
vi.mock("@/lib/redis-rate-limit", () => ({ limitByRedis: mocks.limitByRedis }));
vi.mock("@/lib/r2", () => ({
  isAllowedCommentImageUrl: () => true,
  createCommentImageUpload: vi.fn(),
}));
vi.mock("@/features/community/queries", () => ({ getPostAccess: vi.fn() }));
vi.mock("@/features/kana-word-race/server/lifecycle", () => ({
  redactRaceGuesses: vi.fn(),
}));
vi.mock("@/lib/server-logger", () => ({ reportServerError: vi.fn() }));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

import { prisma } from "@/lib/prisma";
import {
  createArticleAction,
  updateArticleAction,
  setArticleStatusAction,
  deleteArticleAction,
} from "@/features/admin/article/actions";
import { CreateArticleSchema } from "@/features/admin/article/schemas";
import { anonymizeAccount } from "@/features/auth/lib/anonymize-account";
import {
  addQuestionCommentAction,
  replyToQuestionCommentAction,
  updateQuestionCommentAction,
  deleteQuestionCommentAction,
  getDiscussionAction,
} from "@/features/question-comment/actions";
import { getDiscussion } from "@/features/question-comment/queries";
import {
  pinArticleCommentAction,
  recordArticleViewAction,
  toggleArticleInteractionAction,
} from "./actions";
import {
  getArticleCommentLocation,
  getArticleDetail,
  getSavedArticles,
  searchArticles,
} from "./queries";
import seed from "./data/article-seed.json";

const runKey = randomUUID().replaceAll("-", "").slice(0, 10);
const input = CreateArticleSchema.parse({
  ...seed[0],
  slug: `qa-article-${runKey}`,
  tags: [`qa-${runKey}`],
  bodyJson: JSON.stringify(seed[0].body),
});
let articleId: number;
let adminId: number;
let readerId: number;
let otherId: number;
const userIds: number[] = [];

function asReader(userId = readerId) {
  mocks.getSession.mockResolvedValue({ userId, sessionId: "qa-session" });
}
function asAdmin() {
  asReader(adminId);
  mocks.requireAdmin.mockResolvedValue({
    userId: adminId,
    sessionId: "qa-session",
    user: {
      id: adminId,
      displayName: "Admin QA",
      role: "ADMIN",
      avatarUrl: null,
    },
  });
}
function addComment(text = "Pertanyaan pembaca") {
  return addQuestionCommentAction({
    target: { type: "article", articleId },
    commentText: text,
    commentImages: [],
    visibility: "PUBLIC",
  });
}
async function rootId() {
  return (
    await prisma.questionComment.findFirstOrThrow({
      where: { articleId, parentId: null },
      orderBy: { id: "desc" },
      select: { id: true },
    })
  ).id;
}

describe.skipIf(!databaseUrl)("artikel dengan PostgreSQL lokal", () => {
  beforeAll(async () => {
    for (const kind of ["admin", "reader", "other"]) {
      const user = await prisma.user.create({
        data: {
          username: `qa-${kind}-${runKey}`,
          displayName: `QA ${kind}`,
          email: `${kind}-${runKey}@article-qa.invalid`,
          emailVerifiedAt: new Date(),
          role: kind === "admin" ? "ADMIN" : "USER",
        },
        select: { id: true },
      });
      userIds.push(user.id);
    }
    [adminId, readerId, otherId] = userIds;
    asAdmin();
    const created = await createArticleAction(input);
    if (!created.ok) throw new Error(created.message);
    articleId = created.id;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.limitByRedis.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await prisma.questionComment.deleteMany({ where: { articleId } });
    await prisma.articleInteraction.deleteMany({ where: { articleId } });
    await prisma.article.update({
      where: { id: articleId },
      data: { favoriteCount: 0, viewCount: 0, draft: Prisma.DbNull },
    });
    await prisma.user.update({
      where: { id: readerId },
      data: {
        anonymizedAt: null,
        username: `qa-reader-${runKey}`,
        displayName: "QA reader",
        postingSuspendedAt: null,
        postingSuspendedReason: null,
        postingSuspendedById: null,
      },
    });
    asAdmin();
    expect((await updateArticleAction({ ...input, id: articleId })).ok).toBe(
      true,
    );
  });

  afterAll(async () => {
    if (articleId) {
      await prisma.questionComment.deleteMany({ where: { articleId } });
      await prisma.article.delete({ where: { id: articleId } });
    }
    await prisma.adminAuditLog.deleteMany({
      where: { actorId: { in: userIds } },
    });
    await prisma.articleTag.deleteMany({ where: { slug: `qa-${runKey}` } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("non-admin tidak bisa membuat atau menerbitkan artikel", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(createArticleAction(input)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      updateArticleAction({ ...input, id: articleId }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      setArticleStatusAction({ id: articleId, status: "PUBLISHED" }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("draf revisi tetap privat, tidak masuk search, lalu bisa diterbitkan", async () => {
    const privateTitle = `Revisi privat ${runKey}`;
    expect(
      await updateArticleAction({
        ...input,
        id: articleId,
        title: privateTitle,
        status: "DRAFT",
      }),
    ).toEqual({ ok: true, id: articleId });
    const publicArticle = await getArticleDetail(input.slug);
    expect(publicArticle?.title).toBe(input.title);
    expect(publicArticle).not.toHaveProperty("draft");
    expect(
      (
        await searchArticles({
          query: privateTitle,
          category: "",
          tags: [],
          level: "",
          language: "",
          sort: "newest",
        })
      ).total,
    ).toBe(0);
    expect(
      await updateArticleAction({
        ...input,
        id: articleId,
        title: privateTitle,
      }),
    ).toEqual({ ok: true, id: articleId });
    expect((await getArticleDetail(input.slug))?.title).toBe(privateTitle);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: articleId } }))
        .draft,
    ).toBeNull();
    expect(
      (await setArticleStatusAction({ id: articleId, status: "PUBLISHED" })).ok,
    ).toBe(false);
    expect(
      (
        await updateArticleAction({
          ...input,
          id: articleId,
          slug: `changed-${runKey}`,
        })
      ).ok,
    ).toBe(false);
    expect((await deleteArticleAction({ id: articleId })).ok).toBe(false);
  });

  it("retry dan like bersamaan tidak menggandakan counter", async () => {
    asReader();
    const liked = await Promise.all(
      Array.from({ length: 8 }, () =>
        toggleArticleInteractionAction({
          slug: input.slug,
          kind: "favorited",
          value: true,
        }),
      ),
    );
    expect(liked.every((result) => result.ok)).toBe(true);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: articleId } }))
        .favoriteCount,
    ).toBe(1);
    await Promise.all(
      Array.from({ length: 8 }, () =>
        toggleArticleInteractionAction({
          slug: input.slug,
          kind: "favorited",
          value: false,
        }),
      ),
    );
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: articleId } }))
        .favoriteCount,
    ).toBe(0);
    expect(
      await prisma.articleInteraction.count({ where: { articleId } }),
    ).toBe(1);
  });

  it("bookmark hanya terlihat oleh pemiliknya dan first-view dihitung sekali", async () => {
    asReader();
    await toggleArticleInteractionAction({
      slug: input.slug,
      kind: "saved",
      value: true,
    });
    expect(
      (await getSavedArticles(readerId)).articles.map((article) => article.id),
    ).toContain(articleId);
    expect(
      (await getSavedArticles(otherId)).articles.map((article) => article.id),
    ).not.toContain(articleId);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        recordArticleViewAction({ slug: input.slug }),
      ),
    );
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: articleId } }))
        .viewCount,
    ).toBe(1);
    mocks.getSession.mockResolvedValue(null);
    expect(
      await toggleArticleInteractionAction({
        slug: input.slug,
        kind: "favorited",
        value: true,
      }),
    ).toMatchObject({ ok: false, requiresAuth: true });
  });

  it("komentar dan balasan mewarisi artikel, guest bisa membaca, pemilik saja bisa mengubah", async () => {
    asReader();
    expect(await addComment()).toEqual({ ok: true });
    const parentId = await rootId();
    asReader(otherId);
    expect(
      await replyToQuestionCommentAction({
        parentId,
        repliedToId: parentId,
        commentText: "Balasan pembaca lain",
        commentImages: [],
      }),
    ).toEqual({ ok: true });
    const reply = await prisma.questionComment.findFirstOrThrow({
      where: { parentId },
      select: { articleId: true },
    });
    expect(reply.articleId).toBe(articleId);
    await expect(
      updateQuestionCommentAction({
        commentId: parentId,
        commentText: "Milik orang lain",
        commentImages: [],
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      deleteQuestionCommentAction({ commentId: parentId }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSession.mockResolvedValue(null);
    expect(
      (await getDiscussionAction({ target: { type: "article", articleId } }))
        .roots,
    ).toHaveLength(1);
    asReader();
    expect(await deleteQuestionCommentAction({ commentId: parentId })).toEqual({
      ok: true,
    });
    const [tombstone] = await getDiscussion({ type: "article", articleId });
    expect(tombstone.state).toBe("DELETED");
    expect(tombstone.commentText).toBeNull();
    expect(tombstone.author).toBeNull();
    expect(tombstone.replies[0].commentText).toBe("Balasan pembaca lain");
  });

  it("suspend, rate limit, tutup diskusi, dan arsip ditegakkan di server", async () => {
    asReader();
    await prisma.user.update({
      where: { id: readerId },
      data: { postingSuspendedAt: new Date() },
    });
    expect((await addComment()).ok).toBe(false);
    await prisma.user.update({
      where: { id: readerId },
      data: { postingSuspendedAt: null },
    });
    mocks.limitByRedis.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect((await addComment()).ok).toBe(false);
    await prisma.article.update({
      where: { id: articleId },
      data: { discussionEnabled: false },
    });
    await expect(addComment()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(
      (await getDiscussionAction({ target: { type: "article", articleId } }))
        .roots,
    ).toEqual([]);
    await prisma.article.update({
      where: { id: articleId },
      data: { status: "ARCHIVED" },
    });
    await expect(
      getDiscussionAction({ target: { type: "article", articleId } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(
      (
        await toggleArticleInteractionAction({
          slug: input.slug,
          kind: "favorited",
          value: true,
        })
      ).ok,
    ).toBe(false);
    expect(await getArticleDetail(input.slug)).toBeNull();
  });

  it("sematan admin dan permalink tetap benar setelah komentar berpaginasi", async () => {
    await prisma.questionComment.createMany({
      data: Array.from({ length: 23 }, (_, i) => ({
        articleId,
        userId: readerId,
        commentText: `Komentar ${i}`,
        commentImages: [],
        visibility: "PUBLIC" as const,
        sharedAt: new Date(),
      })),
    });
    const oldest = await prisma.questionComment.findFirstOrThrow({
      where: { articleId },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    expect((await getArticleCommentLocation(articleId, oldest.id))?.page).toBe(
      2,
    );
    asAdmin();
    expect(
      await pinArticleCommentAction({ commentId: oldest.id, pinned: true }),
    ).toEqual({ ok: true });
    expect((await getArticleCommentLocation(articleId, oldest.id))?.page).toBe(
      1,
    );
    expect(
      (
        await getDiscussion(
          { type: "article", articleId },
          { take: 20, skip: 0 },
        )
      )[0].id,
    ).toBe(oldest.id);
  });

  it("anonimisasi yang bersamaan dengan like tidak menyisakan data personal atau counter", async () => {
    asReader();
    await toggleArticleInteractionAction({
      slug: input.slug,
      kind: "favorited",
      value: true,
    });
    await Promise.all([
      anonymizeAccount(readerId, prisma),
      ...Array.from({ length: 5 }, () =>
        toggleArticleInteractionAction({
          slug: input.slug,
          kind: "favorited",
          value: true,
        }),
      ),
    ]);
    expect(
      await prisma.articleInteraction.count({ where: { userId: readerId } }),
    ).toBe(0);
    expect(
      (await prisma.article.findUniqueOrThrow({ where: { id: articleId } }))
        .favoriteCount,
    ).toBe(0);
    expect(
      (
        await toggleArticleInteractionAction({
          slug: input.slug,
          kind: "favorited",
          value: true,
        })
      ).ok,
    ).toBe(false);
  });

  it("CHECK dan RLS database menolak data invalid serta tetap menutup Data API", async () => {
    await expect(
      prisma.questionComment.create({
        data: {
          articleId,
          userId: readerId,
          commentText: "Belum dibagikan",
          commentImages: [],
          visibility: "PUBLIC",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.article.update({
        where: { id: articleId },
        data: { favoriteCount: -1 },
      }),
    ).rejects.toThrow();
    const security = await prisma.$queryRaw<
      Array<{ name: string; rls: boolean; granted: boolean }>
    >`
      SELECT c.relname AS name, c.relrowsecurity AS rls,
        has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT') OR has_table_privilege('service_role', c.oid, 'SELECT') AS granted
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('Article', 'ArticleInteraction', 'QuestionComment')
    `;
    expect(security).toHaveLength(3);
    for (const table of security)
      expect(table).toMatchObject({ rls: true, granted: false });
  });
});
