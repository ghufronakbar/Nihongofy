// Centralized cache keys/tags for `unstable_cache` + `revalidateTag`.
// Never hardcode cache key/tag strings inside server actions — import from here.

export const CACHE_TAGS = {
  testPackageList: "test-package-list",
  testPackageDetail: (testPackageId: number) => `test-package-${testPackageId}`,
  testPackageQuestions: (testPackageId: number) => `test-package-questions-${testPackageId}`,
  attemptSummary: (attemptId: number) => `attempt-${attemptId}`,
  dashboardSummary: (userId: number) => `dashboard-${userId}`,
  profileAccount: (userId: number) => `profile-account-${userId}`,
  profileOverview: (userId: number) => `profile-overview-${userId}`,
  analytics: (userId: number) => `analytics-${userId}`,
  practiceCatalog: "practice-catalog",
  articleList: "article-list",
  articleFacets: "article-facets",
  articleDetail: (slug: string) => `article-${slug}`,
  // Satu tag untuk seluruh katalog bunpou: `seed:bunpou` berjalan di luar app,
  // jadi invalidasinya lewat /admin/ops atau habisnya `revalidate`.
  bunpouCatalog: "bunpou-catalog",
} as const;

export const CACHE_KEYS = {
  testPackageList: ["test-package-list"] as string[],
  testPackageDetail: (testPackageId: number) => ["test-package-detail", String(testPackageId)],
  testPackageQuestions: (testPackageId: number) => [
    "test-package-questions",
    String(testPackageId),
  ],
  testPackageMetadata: (testPackageId: number) => [
    "test-package-metadata",
    String(testPackageId),
  ],
  testPackageSitemap: ["test-package-sitemap"] as string[],
  attemptSummary: (attemptId: number) => ["attempt-summary", String(attemptId)],
  dashboardSummary: (userId: number) => ["dashboard-summary", String(userId)],
  profileAccount: (userId: number) => ["profile-account-v3", String(userId)],
  userTimeZone: (userId: number) => ["user-time-zone", String(userId)],
  profileOverview: (userId: number) => ["profile-overview-v2", String(userId)],
  analytics: (userId: number) => ["analytics", String(userId)],
  practiceCatalog: ["practice-catalog"] as string[],
  articleList: ["article-list"] as string[],
  articleFacets: ["article-facets"] as string[],
  articleSearch: ["article-search"] as string[],
  articleDetail: (slug: string) => ["article-detail", slug],
  articleCover: (slug: string) => ["article-cover", slug],
  articleSitemap: ["article-sitemap"] as string[],
  bunpouCatalog: ["bunpou-catalog"] as string[],
  bunpouPoint: (key: string) => ["bunpou-point", key],
  bunpouComparison: (key: string) => ["bunpou-comparison", key],
  bunpouComparisonList: ["bunpou-comparison-list"] as string[],
  bunpouSitemap: ["bunpou-sitemap"] as string[],
  // Tanpa tag: diskusi tidak punya invalidasi per mutasi (docs/module/question-comment.md),
  // jadi sitemap-nya cukup diperbarui oleh `revalidate`.
  discussionSitemap: ["discussion-sitemap"] as string[],
  // Shares CACHE_TAGS.analytics for invalidation — both derive from the same
  // source (completed attempts), so one updateTag on submit refreshes both.
  progress: (userId: number) => ["progress", String(userId)],
  // Heatmap dan streak profil publik. Memakai tag `profileOverview` — sumber
  // datanya aktivitas yang sama — ditambah `revalidate`, karena review flashcard
  // tidak menginvalidasi tag apa pun dan "hari ini" berganti tanpa mutasi.
  publicProfileActivity: (userId: number) => ["public-profile-activity", String(userId)],
  // Reputasi "Membantu" dan jumlah entri diskusi. Tanpa tag, sama seperti
  // `discussionSitemap`: suara dan entri diskusi tidak punya invalidasi per
  // mutasi, jadi cukup diperbarui oleh `revalidate`.
  publicProfileCommunity: (userId: number) => ["public-profile-community", String(userId)],
};
