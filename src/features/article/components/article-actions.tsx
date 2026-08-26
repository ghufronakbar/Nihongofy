"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, Heart, Share2 } from "lucide-react";
import {
  recordArticleViewAction,
  toggleArticleInteractionAction,
} from "../actions";
import { formatArticleCount } from "../lib/format";

async function copyUrl(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("copy-failed");
}

export function ArticleActions({
  slug,
  title,
  excerpt,
  initialSaved,
  initialFavorited,
  initialFavoriteCount,
  isAuthenticated,
}: {
  slug: string;
  title: string;
  excerpt: string;
  initialSaved: boolean;
  initialFavorited: boolean;
  initialFavoriteCount: number;
  isAuthenticated: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [notice, setNotice] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [isPending, startTransition] = useTransition();
  const loginHref = `/login?next=${encodeURIComponent(`/article/${slug}`)}`;

  useEffect(() => {
    if (!isAuthenticated) return;
    void recordArticleViewAction({ slug });
  }, [isAuthenticated, slug]);

  function toggle(kind: "saved" | "favorited") {
    setNotice("");
    setRequiresAuth(false);

    startTransition(async () => {
      const result = await toggleArticleInteractionAction({ slug, kind });
      if (!result.ok) {
        setNotice(result.message);
        setRequiresAuth("requiresAuth" in result && result.requiresAuth === true);
        return;
      }

      if (kind === "saved") {
        setSaved(result.value);
        setNotice(result.value ? "Artikel disimpan ke akunmu." : "Artikel dihapus dari simpanan.");
      } else {
        setFavorited(result.value);
        setFavoriteCount(result.favoriteCount);
        setNotice(result.value ? "Artikel ditambahkan ke favorit." : "Artikel dihapus dari favorit.");
      }
    });
  }

  async function shareArticle() {
    const url = window.location.href;
    setNotice("");
    setRequiresAuth(false);

    if (navigator.share) {
      try {
        await navigator.share({ title, text: excerpt, url });
        setNotice("Menu berbagi sudah dibuka.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await copyUrl(url);
      setNotice("Tautan artikel sudah disalin.");
    } catch {
      setNotice("Tautan belum dapat disalin. Salin alamat halaman dari browser.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => toggle("favorited")}
          disabled={isPending}
          aria-pressed={favorited}
          className={`neo-button ${favorited ? "bg-neo-coral" : "bg-white"}`}
        >
          <Heart className={`size-5 ${favorited ? "fill-current" : ""}`} aria-hidden="true" />
          Favorit {formatArticleCount(favoriteCount)}
        </button>
        <button
          type="button"
          onClick={() => toggle("saved")}
          disabled={isPending}
          aria-pressed={saved}
          className={`neo-button ${saved ? "bg-neo-yellow" : "bg-white"}`}
        >
          <Bookmark className={`size-5 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
          {saved ? "Tersimpan" : "Simpan"}
        </button>
        <button type="button" onClick={shareArticle} className="neo-button bg-neo-blue">
          <Share2 className="size-5" aria-hidden="true" />
          Bagikan
        </button>
      </div>

      <div className="mt-3 min-h-7 text-sm font-bold" aria-live="polite">
        {notice}
        {requiresAuth ? (
          <>
            {" "}
            <Link href={loginHref} className="underline decoration-2 underline-offset-4">
              Masuk sekarang
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
