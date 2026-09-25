"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { deleteTestPackageAction } from "../actions";

export function DeletePackageButton({
  id,
  name,
  attemptCount,
}: {
  id: number;
  name: string;
  attemptCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Paket yang sudah dikerjakan user tidak dapat dihapus sama sekali. Tombolnya
  // tetap dirender agar alasannya terbaca, bukan hilang tanpa penjelasan.
  if (attemptCount > 0) {
    return (
      <p className="text-xs font-semibold text-foreground/60">
        Tidak dapat dihapus: {attemptCount} attempt user menempel pada paket ini.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="neo-button bg-white text-xs font-extrabold text-neo-coral"
      >
        <Trash2 className="size-4" />
        Hapus Paket
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-[3px] border-neo-ink bg-neo-coral/10 p-4">
      <p className="text-xs font-bold text-foreground/80">
        Penghapusan permanen dan merambat ke seluruh mondai, soal, pilihan, bacaan, dan catatan
        belajar milik paket ini. Ketik nama paketnya untuk melanjutkan:
      </p>
      <p className="font-mono text-xs font-black">{name}</p>
      <Input
        value={confirmName}
        disabled={isPending}
        onChange={(event) => setConfirmName(event.target.value)}
        placeholder="Ketik nama paket"
        className="font-mono text-xs"
      />
      {error && <p className="text-xs font-bold text-neo-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || confirmName !== name}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteTestPackageAction({ id, confirmName });
              if (result.ok) router.push("/admin/test-package");
              else setError(result.message);
            })
          }
          className="neo-button bg-neo-coral text-xs font-extrabold text-white disabled:opacity-50"
        >
          {isPending ? "Menghapus..." : "Hapus Permanen"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setConfirmName("");
            setError(null);
          }}
          className="neo-button bg-white text-xs font-extrabold text-black"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
