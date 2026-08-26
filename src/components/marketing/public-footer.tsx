import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/marketing/brand-mark";
import { PageContainer } from "@/components/marketing/page-container";

const FOOTER_LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Artikel", href: "/article" },
  { label: "Mock JLPT", href: "/test-package" },
  { label: "Masuk", href: "/login" },
  { label: "Daftar", href: "/register" },
];

export function PublicFooter() {
  return (
    <footer className="border-t-[3px] border-neo-ink bg-white">
      <PageContainer className="grid gap-10 py-12 md:grid-cols-[1.3fr_0.7fr] md:py-16">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-md text-base leading-7 text-foreground/70">
            Latihan JLPT yang tegas, terukur, dan mudah ditinjau kembali. Fokus pada
            soal, pola kesalahan, dan progres yang benar-benar milikmu.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-8 gap-y-3 md:justify-self-end" aria-label="Navigasi footer">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 font-bold underline decoration-2 underline-offset-4 hover:decoration-neo-blue"
            >
              {item.label}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </PageContainer>
      <div className="border-t-[3px] border-neo-ink bg-neo-ink py-4 text-white">
        <PageContainer className="flex flex-col gap-1 font-mono text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>JLPT EXAM / 日本語試験室</span>
          <span>© {new Date().getFullYear()} Belajar dengan ritme sendiri.</span>
        </PageContainer>
      </div>
    </footer>
  );
}
