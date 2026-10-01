"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeDeckAction, unsubscribeDeckAction } from "../actions";

type Props = {
  slug: string;
  subscribed: boolean;
  className?: string;
};

/**
 * Menambah atau melepas deck dari daftar belajar. Menambah langsung membuka
 * pengaturan deck itu (deck sudah aktif dengan pengaturan bawaan). Melepas
 * tidak menghapus progres: kartu dan pengaturannya kembali saat deck
 * ditambahkan lagi.
 */
export function DeckSubscribeButton({ slug, subscribed, className }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = subscribed
        ? await unsubscribeDeckAction({ slug })
        : await subscribeDeckAction({ slug });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (subscribed) {
        toast.success("Deck dilepas. Progres dan pengaturannya tetap tersimpan.");
        return;
      }
      router.push(`/flashcard/deck/${slug}/settings?new=1`);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={subscribed}
      className={cn("neo-button shrink-0", subscribed ? "bg-neo-green" : "bg-neo-yellow", className)}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : subscribed ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Plus className="size-4" aria-hidden />
      )}
      {subscribed ? "Sudah ditambahkan" : "Tambahkan"}
    </button>
  );
}
