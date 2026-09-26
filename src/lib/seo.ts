import type { Metadata } from "next";
import { SITE_URL } from "@/constants";

export const SITE_NAME = "Nihongofy";

export const DEFAULT_OG_LOCALE = "id_ID";

export const OG_SIZE = {
  width: 1200,
  height: 630,
};

export const OG_CONTENT_TYPE = "image/png";

export const OG_ALT =
  "Nihongofy — platform belajar bahasa Jepang dan simulasi JLPT N5 sampai N1";

/**
 * Gambar share default, dilayani oleh `src/app/opengraph-image.tsx`.
 *
 * Harus disebut eksplisit, tidak bisa diandalkan diwarisi: file
 * `opengraph-image` root hanya mengisi `openGraph.images` di segmen root, dan
 * begitu sebuah halaman menulis objek `openGraph`-nya sendiri (yang dilakukan
 * setiap halaman di sini demi `siteName` dan `url`) seluruh objek itu —
 * termasuk gambarnya — tertimpa. Tanpa baris ini halaman yang punya metadata
 * paling rapi justru yang dishare tanpa gambar sama sekali.
 */
const ROOT_OG_IMAGE = {
  url: "/opengraph-image",
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  alt: OG_ALT,
};

/**
 * Metadata di Next di-merge secara *shallow*: begitu sebuah halaman menulis
 * `openGraph`, seluruh objek `openGraph` dari root layout dibuang — termasuk
 * `siteName` dan `locale`. Setiap halaman karena itu wajib membangun OG-nya
 * lewat `pageMetadata()` di file ini, bukan menulis objek `openGraph` sendiri.
 *
 * Alasan yang sama berlaku untuk `alternates.canonical`: sebaliknya, field itu
 * *diwarisi* bila halaman tidak menyetelnya. Root layout karena itu TIDAK BOLEH
 * punya canonical — kalau punya, seluruh halaman akan menyatakan dirinya
 * duplikat dari homepage dan berhenti diindeks.
 */
type OgImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

type ArticleOgFields = {
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
};

type PageMetadataInput = {
  title: string;
  description: string;
  /**
   * Path canonical sekaligus `og:url`, mis. `"/test-package"`. Dikosongkan
   * untuk halaman yang tidak layak diindeks (hasil ujian, sesi latihan, dsb.)
   * supaya tidak ada canonical yang salah arah.
   */
  path?: string;
  /** Lewati template `%s | Nihongofy` dari root layout. Hanya untuk homepage. */
  absoluteTitle?: boolean;
  /** Judul/deskripsi khusus preview share, bila perlu beda dari judul halaman. */
  ogTitle?: string;
  ogDescription?: string;
  images?: OgImage[];
  /**
   * Segmen ini punya `opengraph-image.tsx` sendiri, jadi biarkan file itu yang
   * mengisi gambarnya dan jangan pasang gambar default situs.
   */
  ownSegmentImage?: boolean;
  keywords?: string[];
  /** `true` → `noindex, nofollow`. `"follow"` → `noindex` tapi link tetap ditelusuri. */
  noindex?: boolean | "follow";
  /** Mengubah `og:type` menjadi `article` beserta field turunannya. */
  article?: ArticleOgFields;
};

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle,
  ogTitle,
  ogDescription,
  images,
  ownSegmentImage,
  keywords,
  noindex,
  article,
}: PageMetadataInput): Metadata {
  const resolvedImages = ownSegmentImage ? undefined : (images ?? [ROOT_OG_IMAGE]);
  const sharedOg = {
    title: ogTitle ?? `${title} | ${SITE_NAME}`,
    description: ogDescription ?? description,
    siteName: SITE_NAME,
    locale: DEFAULT_OG_LOCALE,
    ...(path ? { url: path } : {}),
    ...(resolvedImages ? { images: resolvedImages } : {}),
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords ? { keywords } : {}),
    ...(path ? { alternates: { canonical: path } } : {}),
    ...(noindex
      ? { robots: { index: false, follow: noindex === "follow" } }
      : {}),
    ...(article?.authors?.length
      ? { authors: article.authors.map((name) => ({ name })) }
      : {}),
    openGraph: article
      ? {
          ...sharedOg,
          type: "article",
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
          authors: article.authors,
          tags: article.tags,
        }
      : { ...sharedOg, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: ogTitle ?? `${title} | ${SITE_NAME}`,
      description: ogDescription ?? description,
      ...(resolvedImages
        ? { images: resolvedImages.map((image) => image.url) }
        : {}),
    },
  };
}

/**
 * Metadata untuk halaman privat/transaksional: judul jelas untuk tab dan riwayat
 * browser, tanpa canonical, dan tidak diindeks. Sengaja tanpa OG — halaman ini
 * tidak dimaksudkan untuk dishare, dan preview default dari root sudah cukup
 * kalau URL-nya tetap ditempel ke chat.
 */
export function privateMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
  };
}
