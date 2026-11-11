"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, Heart, Share2 } from "lucide-react";
import { recordArticleViewAction, toggleArticleInteractionAction } from "../actions";
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
    void recordArticleViewAction({ slug }).catch(() => undefined);
  }, [isAuthenticated, slug]);

  function toggle(kind: "saved" | "favorited") {
    setNotice("");
    setRequiresAuth(false);

    startTransition(async () => {
      try {
        const result = await toggleArticleInteractionAction({
          slug,
          kind,
          value: kind === "saved" ? !saved : !favorited,
        });
        if (!result.ok) {
          setNotice(result.message);
          setRequiresAuth("requiresAuth" in result && result.requiresAuth === true);
          return;
        }

        if (kind === "saved") {
          setSaved(result.value);
          setNotice(
            result.value ? "Artikel disimpan ke akunmu." : "Artikel dihapus dari simpanan.",
          );
        } else {
          setFavorited(result.value);
          setFavoriteCount(result.favoriteCount);
          setNotice(result.value ? "Artikel disukai." : "Artikel tidak lagi disukai.");
        }
      } catch {
        setNotice("Perubahan belum tersimpan. Periksa koneksi dan coba lagi.");
      }
    });
  }

  async function shareArticle() {
    const url = new URL(`/article/${slug}`, window.location.origin).href;
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
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => toggle("favorited")}
          disabled={isPending}
          aria-pressed={favorited}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold transition-colors disabled:opacity-50 ${favorited ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          <Heart className={`size-5 ${favorited ? "fill-current" : ""}`} aria-hidden="true" />
          {favorited ? "Disukai" : "Sukai"} {formatArticleCount(favoriteCount)}
        </button>
        <button
          type="button"
          onClick={() => toggle("saved")}
          disabled={isPending}
          aria-pressed={saved}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold transition-colors disabled:opacity-50 ${saved ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          <Bookmark className={`size-5 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
          {saved ? "Tersimpan" : "Simpan"}
        </button>
        <button
          type="button"
          onClick={shareArticle}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Share2 className="size-5" aria-hidden="true" />
          Bagikan
        </button>
      </div>

      <div className="mt-2 min-h-5 text-xs text-slate-600" aria-live="polite">
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
