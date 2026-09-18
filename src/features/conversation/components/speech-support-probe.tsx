"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectSpeechSupport, type SpeechSupport } from "../lib/speech";

// SPK-1: hasil probe ditampilkan sebelum user mencoba merekam, supaya tidak
// ada yang menekan tombol rekam lalu menemui kegagalan tanpa penjelasan.
export function SpeechSupportProbe() {
  const [support, setSupport] = useState<SpeechSupport | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(detectSpeechSupport());
  }, []);

  if (support === null) return null;

  const ready = support.recognition && support.media;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 border-[3px] border-neo-ink p-4",
        ready ? "bg-neo-green" : "bg-neo-yellow",
      )}
    >
      {ready ? (
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      ) : (
        <CircleSlash className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      )}
      <div>
        <p className="font-black">
          {ready ? "Browser ini mendukung latihan bicara" : "Browser ini belum mendukung mikrofon"}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {ready
            ? "Pengenalan suara dan mikrofon tersedia. Izin baru diminta saat kamu menekan tombol rekam."
            : "Pengenalan suara praktisnya baru tersedia di browser berbasis Chromium. Latihan tetap bisa dijalankan penuh dengan mengetik jawabanmu."}
        </p>
      </div>
    </div>
  );
}
