import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pengganti form diskusi untuk akun yang di-suspend admin. Server tetap menolak
 * sendiri (`checkPublicPostingAllowed`); ini hanya supaya user tidak mengetik
 * panjang lalu ditolak.
 */
export function PostingSuspendedNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Akun dibatasi: Anda tidak dapat menulis, membagikan, atau membalas di diskusi publik.
        Catatan pribadi tetap bisa ditulis.
      </span>
    </p>
  );
}
