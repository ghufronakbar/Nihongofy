import { FEATURES } from "@/constants";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

export type JsonLdObject = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    description:
      "Platform belajar bahasa Jepang dan simulasi JLPT (N5 - N1) berbahasa Indonesia.",
    inLanguage: "id-ID",
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "id-ID",
    publisher: { "@id": ORGANIZATION_ID },
    // SearchAction hanya jujur bila modul artikel hidup — itu satu-satunya
    // pencarian publik yang ada. Mengiklankan endpoint yang 404 justru merugikan.
    ...(FEATURES.article
      ? {
          potentialAction: {
            "@type": "SearchAction",
            // Dirakit manual, bukan lewat `new URL`, supaya placeholder kurung
            // kurawal milik Google tidak ikut ter-percent-encode.
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${absoluteUrl("/article/search")}?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

type Breadcrumb = { name: string; path: string };

export function breadcrumbJsonLd(items: Breadcrumb[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

type ArticleJsonLdInput = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  authorName: string;
  publishedAt: Date | null;
  updatedAt: Date;
  category: string;
  tags: string[];
  readTime: number;
};

export function articleJsonLd(article: ArticleJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/article/${article.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: article.title,
    description: article.excerpt,
    image: absoluteUrl(article.coverImage),
    inLanguage: "id-ID",
    articleSection: article.category,
    keywords: article.tags,
    timeRequired: `PT${article.readTime}M`,
    author: { "@type": "Person", name: article.authorName },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(article.publishedAt
      ? { datePublished: article.publishedAt.toISOString() }
      : {}),
    dateModified: article.updatedAt.toISOString(),
  };
}

type TestPackageJsonLdInput = {
  id: number;
  name: string;
  jlptLevel: string;
  sessionCount: number;
  totalMinutes: number;
};

export function testPackageJsonLd(testPackage: TestPackageJsonLdInput): JsonLdObject {
  const url = absoluteUrl(`/test-package/${testPackage.id}`);

  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "@id": `${url}#quiz`,
    url,
    name: `${testPackage.name} — Mock Test JLPT ${testPackage.jlptLevel}`,
    description: `Simulasi ujian JLPT ${testPackage.jlptLevel} berstandar resmi: ${testPackage.sessionCount} sesi, total ${testPackage.totalMinutes} menit, lengkap dengan pembahasan per soal.`,
    inLanguage: "ja",
    educationalLevel: `JLPT ${testPackage.jlptLevel}`,
    learningResourceType: "Mock exam",
    timeRequired: `PT${testPackage.totalMinutes}M`,
    about: { "@type": "Thing", name: "Japanese-Language Proficiency Test" },
    provider: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

type LearningResourceJsonLdInput = {
  path: string;
  name: string;
  description: string;
  resourceType: string;
  educationalLevel?: string;
  /** Bahasa materi yang dipelajari, bukan bahasa antarmuka. */
  contentLanguage?: string;
};

export function learningResourceJsonLd({
  path,
  name,
  description,
  resourceType,
  educationalLevel,
  contentLanguage = "ja",
}: LearningResourceJsonLdInput): JsonLdObject {
  const url = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#resource`,
    url,
    name,
    description,
    learningResourceType: resourceType,
    inLanguage: contentLanguage,
    ...(educationalLevel ? { educationalLevel } : {}),
    provider: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

type ProfilePageJsonLdInput = {
  path: string;
  displayName: string;
  username: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: Date;
};

/** Halaman profil publik pengguna. Hanya untuk profil yang memang diindeks. */
export function profilePageJsonLd(profile: ProfilePageJsonLdInput): JsonLdObject {
  const url = absoluteUrl(profile.path);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profile`,
    url,
    dateCreated: profile.createdAt.toISOString(),
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      alternateName: `@${profile.username}`,
      identifier: profile.username,
      url,
      ...(profile.description ? { description: profile.description } : {}),
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    },
  };
}

type SocialMediaPostingJsonLdInput = {
  path: string;
  text: string;
  authorName: string;
  authorPath: string | null;
  createdAt: Date;
  editedAt: Date | null;
  images: string[];
  likeCount: number;
  commentCount: number;
};

/** Postingan komunitas. Hanya untuk postingan yang memang diindeks (penulis public). */
export function socialMediaPostingJsonLd(post: SocialMediaPostingJsonLdInput): JsonLdObject {
  const url = absoluteUrl(post.path);

  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `${url}#post`,
    url,
    headline: post.text.slice(0, 110),
    articleBody: post.text,
    datePublished: post.createdAt.toISOString(),
    ...(post.editedAt ? { dateModified: post.editedAt.toISOString() } : {}),
    author: {
      "@type": "Person",
      name: post.authorName,
      ...(post.authorPath ? { url: absoluteUrl(post.authorPath) } : {}),
    },
    ...(post.images.length > 0 ? { image: post.images } : {}),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.commentCount,
      },
    ],
    isPartOf: { "@id": WEBSITE_ID },
  };
}
