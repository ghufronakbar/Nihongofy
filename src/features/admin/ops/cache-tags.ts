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
  testPackageQuestionBank: CACHE_TAGS.testPackageQuestionBank,
  practiceCatalog: CACHE_TAGS.practiceCatalog,
  articleList: CACHE_TAGS.articleList,
  articleFacets: CACHE_TAGS.articleFacets,
  bunpouCatalog: CACHE_TAGS.bunpouCatalog,
} as const;

// Katalog flashcard sengaja tidak punya tag di sini: halamannya membaca
// `FlashcardDeck`/`FlashcardVocab` langsung tanpa `unstable_cache`, jadi hasil
// `npm run seed:flashcard` langsung terlihat tanpa invalidasi.
//
// Katalog bunpou sebaliknya di-cache karena halamannya publik dan diindeks;
// setelah `npm run seed:bunpou`, invalidasi `bunpouCatalog` di sini.

export type InvalidatableTag = keyof typeof INVALIDATABLE_TAGS;
