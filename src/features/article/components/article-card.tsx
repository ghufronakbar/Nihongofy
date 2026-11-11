import Image from "next/image";
import Link from "next/link";
import { Clock3, Heart, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleCardData } from "../queries";
import { formatArticleCount, formatArticleDate } from "../lib/format";

export function ArticleCard({
  article,
  variant = "row",
  preload = false,
}: {
  article: ArticleCardData;
  variant?: "featured" | "row" | "compact";
  preload?: boolean;
}) {
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-400",
        isFeatured && "grid lg:grid-cols-[1.08fr_0.92fr]",
        variant === "row" && "grid sm:grid-cols-[14rem_1fr]",
      )}
    >
      <Link
        href={`/article/${article.slug}`}
        className={cn(
          "relative block overflow-hidden border-slate-200 bg-neo-blue",
          isFeatured && "min-h-72 border-b lg:min-h-[22rem] lg:border-r lg:border-b-0",
          variant === "row" && "min-h-48 border-b sm:border-r sm:border-b-0",
          isCompact && "aspect-[16/10] border-b",
        )}
        aria-label={`Baca ${article.title}`}
      >
        <Image
          src={article.coverImage}
          unoptimized={article.coverImage.startsWith("https://")}
          alt={article.coverAlt}
          fill
          sizes={
            isFeatured
              ? "(max-width: 1024px) 100vw, 56vw"
              : variant === "row"
                ? "(max-width: 640px) 100vw, 224px"
                : "(max-width: 768px) 100vw, 33vw"
          }
          preload={preload}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
        />
      </Link>

      <div className={cn("flex flex-col p-5 sm:p-6", isFeatured && "justify-center sm:p-8")}>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
          <span className="rounded border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-800">
            {article.category}
          </span>
          {article.readingLevel && (
            <span className="rounded border border-slate-200 px-2 py-1 text-slate-700">
              {article.readingLevel}
            </span>
          )}
          <span className="text-foreground/60">
            {formatArticleDate(article.publishedAt ?? article.updatedAt)}
          </span>
        </div>

        <h3
          className={cn(
            "mt-4 leading-[1.02] group-hover:text-neo-blue",
            isFeatured ? "text-3xl sm:text-4xl" : isCompact ? "text-xl" : "text-2xl",
          )}
        >
          <Link href={`/article/${article.slug}`}>{article.title}</Link>
        </h3>
        <p
          className={cn(
            "mt-3 leading-7 text-foreground/70",
            isCompact && "line-clamp-2 text-sm leading-6",
          )}
        >
          {article.excerpt}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-foreground/65">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4" aria-hidden="true" />
            {article.readTime} menit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Languages className="size-4" aria-hidden="true" />
            {article.hasJapanese ? "Bilingual" : "Indonesia"}
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`${article.favoriteCount} suka`}
          >
            <Heart className="size-4" aria-hidden="true" />
            {formatArticleCount(article.favoriteCount)}
          </span>
        </div>

        {!isCompact ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.slug}
                className="border border-slate-200/25 bg-background px-2 py-1 text-xs font-bold"
              >
                #{tag.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
