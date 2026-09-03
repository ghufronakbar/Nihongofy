"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogIn, Menu } from "lucide-react";
import { BrandMark } from "@/components/marketing/brand-mark";
import { PageContainer } from "@/components/marketing/page-container";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Beranda", href: "/" },
  { label: "Kana", href: "/kana/hiragana" },
  { label: "Flashcard", href: "/flashcard" },
  { label: "Latihan Cepat", href: "/exercises" },
  { label: "Mock JLPT", href: "/test-package" },
  { label: "Artikel", href: "/article" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return false;
  return pathname.startsWith(href.split("#")[0]);
}

export function PublicHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-neo-ink bg-background/95 backdrop-blur-sm">
      <PageContainer className="flex h-[76px] items-center justify-between gap-6">
        <BrandMark />

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              className={cn(
                "relative py-2 text-sm font-extrabold text-neo-ink transition-transform hover:-translate-y-0.5",
                "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-neo-blue after:transition-transform hover:after:scale-x-100",
                isActivePath(pathname, item.href) && "after:scale-x-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className={cn(
              "neo-button min-h-10 px-4 py-2",
              isAuthenticated ? "bg-neo-green" : "bg-white",
            )}
          >
            {isAuthenticated ? <LayoutDashboard /> : <LogIn />}
            {isAuthenticated ? "Dashboard" : "Masuk"}
          </Link>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                className="neo-button min-h-10 px-3 py-2 lg:hidden"
                aria-label="Buka navigasi"
              />
            }
          >
            <Menu className="size-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[min(88vw,22rem)] border-l-[3px] border-neo-ink bg-background p-0 shadow-[-7px_0_0_0_#111]"
          >
            <SheetHeader className="border-b-[3px] border-neo-ink p-5 pr-14 text-left">
              <SheetTitle className="text-xl font-extrabold">Menu belajar</SheetTitle>
              <SheetDescription className="text-foreground/70">
                Pilih jalur belajar atau lanjutkan latihanmu.
              </SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-3 p-5" aria-label="Navigasi mobile">
              {NAV_ITEMS.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "neo-surface neo-interactive flex items-center justify-between px-4 py-3 font-extrabold",
                    index === 1 && "bg-neo-yellow",
                    index === 2 && "bg-neo-coral",
                    index === 3 && "bg-neo-blue",
                    index === 4 && "bg-neo-green",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                onClick={() => setIsMobileMenuOpen(false)}
                className="neo-button mt-3 bg-neo-blue py-3"
              >
                {isAuthenticated ? <LayoutDashboard /> : <LogIn />}
                {isAuthenticated ? "Buka dashboard" : "Masuk ke akun"}
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </PageContainer>
    </header>
  );
}
