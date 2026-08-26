import Link from "next/link";
import { ArrowLeft, BarChart3, BookOpenCheck, Target } from "lucide-react";
import { BrandMark } from "@/components/marketing/brand-mark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="neo-grid-paper min-h-[100dvh] flex-1 p-4 sm:p-6">
      <a href="#auth-content" className="skip-link">
        Lewati ke formulir
      </a>
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-7xl overflow-hidden border-[3px] border-neo-ink bg-white shadow-neo-lg sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden overflow-hidden border-r-[3px] border-neo-ink bg-neo-blue p-10 lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute -top-10 -right-10 size-40 rotate-12 border-[3px] border-neo-ink bg-neo-coral shadow-neo-lg"
            aria-hidden="true"
          />
          <div
            className="absolute right-14 bottom-32 size-24 -rotate-6 border-[3px] border-neo-ink bg-neo-yellow shadow-neo"
            aria-hidden="true"
          />
          <BrandMark className="relative z-10" />
          <div className="relative z-10 max-w-lg">
            <p className="font-mono text-sm font-bold tracking-[0.14em] uppercase">Fokus. Tinjau. Ulangi.</p>
            <h2 className="mt-5 text-5xl leading-[0.9] font-black xl:text-6xl">
              LATIHAN YANG MENUNJUKKAN BAGIAN LEMAHMU.
            </h2>
            <div className="mt-10 grid gap-3">
              {[
                [Target, "Mock test per paket atau per seksi"],
                [BookOpenCheck, "Review jawaban dengan konteks lengkap"],
                [BarChart3, "Tren skor dari attempt milikmu"],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof Target;
                return (
                  <div key={label as string} className="flex items-center gap-3 border-[3px] border-neo-ink bg-white px-4 py-3 font-bold shadow-neo-sm">
                    <ItemIcon className="size-5 shrink-0" aria-hidden="true" />
                    <span>{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p lang="ja" className="font-japanese relative z-10 text-sm font-bold">
            一歩ずつ、確実に。
          </p>
        </aside>

        <main id="auth-content" className="flex items-center justify-center bg-background p-5 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <BrandMark />
            </div>
            <Link href="/" className="neo-button mb-6 min-h-10 bg-white px-4 py-2">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Kembali ke beranda
            </Link>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
