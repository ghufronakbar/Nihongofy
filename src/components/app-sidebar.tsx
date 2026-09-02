"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  ChartNoAxesCombined,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { logoutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "History", href: "/history", icon: History },
  { title: "Progress", href: "/progress", icon: TrendingUp },
  { title: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];

export function AppSidebar({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Sidebar collapsible="icon" className="border-r-[3px] border-neo-ink bg-white">
      <SidebarHeader className="border-b-[3px] border-neo-ink p-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1 py-1">
          <div className="grid size-9 place-items-center rounded-md border-2 border-neo-ink bg-neo-yellow text-base font-black text-black shadow-neo-sm shrink-0">
            楽
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="font-mono text-sm leading-none font-black tracking-wider uppercase text-black">
              TANOSHII
            </p>
            <p className="mt-1 font-mono text-[10px] font-bold text-foreground/60 uppercase">
              Japanese Learning
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                      className={cn(
                        "h-10 rounded-md border-2 px-3 text-sm font-bold transition-all duration-150",
                        isActive
                          ? "border-neo-ink bg-neo-blue text-white shadow-neo-sm hover:bg-neo-blue hover:text-white"
                          : "border-transparent text-foreground hover:border-neo-ink hover:bg-neo-paper hover:translate-x-1"
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0 stroke-[2.5]" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t-[3px] border-neo-ink p-2.5">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/profile" || pathname.startsWith("/profile/info") || pathname.startsWith("/profile/flashcard-settings")}
              tooltip="Profil"
              render={<Link href="/profile" />}
              className={cn(
                "h-11 rounded-md border-2 p-2 transition-all duration-150",
                pathname === "/profile" || pathname.startsWith("/profile/info") || pathname.startsWith("/profile/flashcard-settings")
                  ? "border-neo-ink bg-neo-yellow text-black shadow-neo-sm font-black"
                  : "border-neo-ink bg-neo-paper hover:bg-white hover:translate-x-0.5"
              )}
            >
              <Avatar className="size-7 rounded-md border-2 border-neo-ink bg-neo-blue shadow-neo-sm shrink-0">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="rounded-md object-cover" /> : null}
                <AvatarFallback className="rounded-md bg-neo-blue text-xs font-black text-black">{initials || <UserRound className="size-3.5" />}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-black leading-tight">{displayName}</span>
                <span className="truncate font-mono text-[10px] text-foreground/60">Lihat profil</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/profile/security")}
              tooltip="Security"
              render={<Link href="/profile/security" />}
              className={cn(
                "h-9 rounded-md border-2 px-3 text-xs font-bold transition-all",
                pathname.startsWith("/profile/security")
                  ? "border-neo-ink bg-neo-blue text-white shadow-neo-sm"
                  : "border-transparent text-foreground hover:border-neo-ink hover:bg-neo-paper"
              )}
            >
              <ShieldCheck className="size-4 stroke-[2.5]" />
              <span className="truncate">Keamanan Akun</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Keluar"
              disabled={isPending}
              onClick={() => startTransition(() => logoutAction())}
              className="h-9 rounded-md border-2 border-neo-ink bg-neo-coral text-white font-extrabold shadow-neo-sm transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-neo active:translate-x-[2px] active:translate-y-[2px]"
            >
              <LogOut className="size-4 stroke-[2.5]" />
              <span className="truncate">Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
