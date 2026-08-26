import Image from "next/image";
import Link from "next/link";
import { Clock3, Eye, Heart } from "lucide-react";
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
        "neo-surface neo-interactive group overflow-hidden bg-white",
        isFeatured && "grid lg:grid-cols-[1.08fr_0.92fr]",
        variant === "row" && "grid sm:grid-cols-[14rem_1fr]",
      )}
    >
      <Link
        href={`/article/${article.slug}`}
        className={cn(
          "relative block overflow-hidden border-neo-ink bg-neo-blue",
          isFeatured && "min-h-72 border-b-[3px] lg:min-h-[25rem] lg:border-r-[3px] lg:border-b-0",
          variant === "row" && "min-h-48 border-b-[3px] sm:border-r-[3px] sm:border-b-0",
          isCompact && "aspect-[16/10] border-b-[3px]",
        )}
        aria-label={`Baca ${article.title}`}
      >
        <Image
          src={article.coverImage}
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
          <span className="border-2 border-neo-ink bg-neo-yellow px-2.5 py-1 text-black">
            {article.category}
          </span>
          <span className="text-foreground/60">{formatArticleDate(article.publishedAt ?? article.updatedAt)}</span>
        </div>

        <h3
          className={cn(
            "mt-4 leading-[1.02] group-hover:text-neo-blue",
            isFeatured ? "text-3xl sm:text-4xl" : isCompact ? "text-xl" : "text-2xl",
          )}
        >
          <Link href={`/article/${article.slug}`}>{article.title}</Link>
        </h3>
        <p className={cn("mt-3 leading-7 text-foreground/70", isCompact && "line-clamp-2 text-sm leading-6")}>
          {article.excerpt}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-foreground/65">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4" aria-hidden="true" />
            {article.readTime} menit
          </span>
          <span className="inline-flex items-center gap-1.5" aria-label={`${article.viewCount} pembaca akun`}>
            <Eye className="size-4" aria-hidden="true" />
            {formatArticleCount(article.viewCount)}
          </span>
          <span className="inline-flex items-center gap-1.5" aria-label={`${article.favoriteCount} favorit`}>
            <Heart className="size-4" aria-hidden="true" />
            {formatArticleCount(article.favoriteCount)}
          </span>
        </div>

        {!isCompact ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {article.tags.slice(0, 3).map((tag) => (
              <span key={tag.slug} className="border border-neo-ink/25 bg-background px-2 py-1 text-xs font-bold">
                #{tag.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
