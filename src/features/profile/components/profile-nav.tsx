"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/profile", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/profile/info", label: "Akun", icon: UserRound },
  { href: "/profile/security", label: "Security", icon: ShieldCheck },
  { href: "/profile/flashcard-settings", label: "Flashcards", icon: Brain },
];

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi pengaturan akun" className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 border-[3px] border-black px-4 py-2 text-sm font-black shadow-neo-sm transition-[transform,box-shadow,background-color]",
                active ? "bg-neo-yellow" : "bg-white hover:-translate-y-0.5 hover:shadow-neo",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
