"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutDashboard, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/profile", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/profile/info", label: "Akun", icon: UserRound },
  { href: "/profile/security", label: "Security", icon: ShieldCheck },
  { href: "/profile/privacy", label: "Privasi & Data", icon: Database },
];

// `followRequests`: jumlah permintaan follow yang menunggu, atau null bila fitur
// follow mati (menu-nya tidak dirender).
export function ProfileNav({ followRequests }: { followRequests: number | null }) {
  const pathname = usePathname();
  const items =
    followRequests === null
      ? ITEMS
      : [...ITEMS, { href: "/profile/follow-requests", label: "Permintaan follow", icon: UserPlus, exact: false }];

  return (
    <nav aria-label="Navigasi pengaturan akun" className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2">
        {items.map((item) => {
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
              {item.href === "/profile/follow-requests" && followRequests ? (
                <span className="grid min-w-5 place-items-center border-2 border-black bg-neo-coral px-1 font-mono text-[11px] leading-4">
                  {followRequests}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
