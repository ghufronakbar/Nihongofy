import { CACHE_TAGS } from "@/constants/cache-key";

// Terpisah dari actions.ts karena file "use server" hanya boleh mengekspor
// fungsi async — konstanta apa pun di sana akan menggagalkan build.
//
// Hanya tag global yang ditawarkan. Tag per-entitas (`test-package-12`,
// `article-slug`, `profile-account-3`) butuh id dan sudah diinvalidasi otomatis
// oleh action yang mengubah entitasnya masing-masing; menyediakan tombolnya di
// sini hanya akan mengundang tebakan id.
export const INVALIDATABLE_TAGS = {
  testPackageList: CACHE_TAGS.testPackageList,
  practiceCatalog: CACHE_TAGS.practiceCatalog,
  articleList: CACHE_TAGS.articleList,
  articleFacets: CACHE_TAGS.articleFacets,
  flashcardSystemCatalog: CACHE_TAGS.flashcardSystemCatalog,
} as const;

export type InvalidatableTag = keyof typeof INVALIDATABLE_TAGS;
