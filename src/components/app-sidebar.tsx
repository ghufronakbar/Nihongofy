"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  History,
  LayoutDashboard,
  LogOut,
  Languages,
  Sparkles,
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

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Kana", href: "/kana/hiragana", icon: Languages },
  { title: "Vocabulary", href: "/vocab", icon: Brain },
  { title: "Latihan Cepat", href: "/exercises", icon: Sparkles },
  { title: "Test Package", href: "/test-package", icon: BookOpen },
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">JLPT Exam</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/profile" || pathname.startsWith("/profile/info") || pathname.startsWith("/profile/flashcard-settings")}
              tooltip="Profil"
              render={<Link href="/profile" />}
            >
              <Avatar className="size-5 rounded-sm border border-black">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="rounded-sm" /> : null}
                <AvatarFallback className="rounded-sm bg-neo-blue text-[9px] font-black text-black">{initials || <UserRound className="size-3" />}</AvatarFallback>
              </Avatar>
              <span className="truncate">{displayName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/profile/security")}
              tooltip="Security"
              render={<Link href="/profile/security" />}
            >
              <ShieldCheck />
              <span>Security</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Keluar"
              disabled={isPending}
              onClick={() => startTransition(() => logoutAction())}
            >
              <LogOut />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
