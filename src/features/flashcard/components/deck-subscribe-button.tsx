"use client";

import { useTransition } from "react";
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
 * Menambah atau melepas deck dari daftar belajar. Melepas tidak menghapus
 * progres: kartunya tetap tersimpan dan kembali saat deck ditambahkan lagi.
 */
export function DeckSubscribeButton({ slug, subscribed, className }: Props) {
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
      toast.success(subscribed ? "Deck dilepas. Progresnya tetap tersimpan." : "Deck ditambahkan.");
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
