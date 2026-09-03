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
  vocabularyDeckList: "vocabulary-deck-list",
  vocabularyDeck: (slug: string) => `vocabulary-deck-${slug}`,
  flashcardSettings: (userId: number) => `flashcard-settings-${userId}`,
  practiceCatalog: "practice-catalog",
  articleList: "article-list",
  articleFacets: "article-facets",
  articleDetail: (slug: string) => `article-${slug}`,
} as const;

export const CACHE_KEYS = {
  testPackageList: ["test-package-list"] as string[],
  testPackageDetail: (testPackageId: number) => ["test-package-detail", String(testPackageId)],
  testPackageQuestions: (testPackageId: number) => [
    "test-package-questions",
    String(testPackageId),
  ],
  attemptSummary: (attemptId: number) => ["attempt-summary", String(attemptId)],
  dashboardSummary: (userId: number) => ["dashboard-summary", String(userId)],
  profileAccount: (userId: number) => ["profile-account-v2", String(userId)],
  userTimeZone: (userId: number) => ["user-time-zone", String(userId)],
  profileOverview: (userId: number) => ["profile-overview-v2", String(userId)],
  analytics: (userId: number) => ["analytics", String(userId)],
  vocabularyDeckList: ["vocabulary-deck-list"] as string[],
  vocabularyDeck: (slug: string) => ["vocabulary-deck", slug],
  flashcardSettings: (userId: number) => ["flashcard-settings", String(userId)],
  practiceCatalog: ["practice-catalog"] as string[],
  articleList: ["article-list"] as string[],
  articleFacets: ["article-facets"] as string[],
  articleSearch: ["article-search"] as string[],
  articleDetail: (slug: string) => ["article-detail", slug],
  articleCover: (slug: string) => ["article-cover", slug],
  articleSitemap: ["article-sitemap"] as string[],
  // Shares CACHE_TAGS.analytics for invalidation — both derive from the same
  // source (completed attempts), so one updateTag on submit refreshes both.
  progress: (userId: number) => ["progress", String(userId)],
};
