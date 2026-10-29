import Link from "next/link";
import { ArrowLeft, ChefHat } from "lucide-react";
import { OnigiriKitchen } from "@/features/onigiri-kitchen/game";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Onigiri Kitchen — Kedai Kecilmu",
  description:
    "Jalankan kedai Jepang kecil tanpa batas waktu. Masak, selesaikan quest, rekrut pelayan, dan perluas teras dalam game kafe isometrik. Main gratis tanpa login.",
  path: "/mini-games/onigiri-kitchen",
});

export default function OnigiriKitchenPage() {
  return (
    <div className="bg-[#f3f4eb] px-3 py-6 text-[#444b3c] sm:px-6 md:py-8 dark:bg-[#1d251c] dark:text-[#efefdc]">
      <div className="mx-auto max-w-[1320px]">
        <Link
          href="/mini-games"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#697559] underline-offset-4 hover:underline dark:text-[#b4c69b]"
        >
          <ArrowLeft size={14} />
          Semua Mini Games
        </Link>
        <div className="mt-5 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[29px] leading-tight font-extrabold tracking-[-1.2px] sm:text-4xl">
              Onigiri Kitchen<span className="text-[#91a274]">.</span>
            </h1>
            <p className="mt-2 text-xs leading-6 text-[#6c735d] sm:text-sm dark:text-[#b7bba4]">
              Satu kedai kecil. Banyak pelanggan bahagia.
            </p>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-[#d3d9c3] bg-[#e9eedc] px-3 py-2 text-[10px] font-semibold text-[#526846] sm:inline-flex dark:border-[#46583b] dark:bg-[#2e3b27] dark:text-[#c4d6a8]">
            <ChefHat size={14} />
            Solo · Tanpa batas waktu · Tanpa login
          </span>
        </div>
        <OnigiriKitchen />
        <p className="mt-4 px-1 text-[10px] leading-5 text-[#70775f] dark:text-[#a8b897]">
          Selingan kecil setelah belajar. Kosakata Jepang hadir lewat menu,
          gambar, dan pesanan sehari-hari.
        </p>
      </div>
    </div>
  );
}
