"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  MessageSquareWarning,
  MessagesSquare,
  ScrollText,
  Settings2,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = { title: string; href: string; icon: LucideIcon };

// Dikelompokkan mengikuti tahap di docs/plan.md supaya urutannya sama dengan
// urutan pengerjaan, bukan diurutkan alfabetis.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Ringkasan",
    items: [{ title: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Bank Soal",
    items: [
      { title: "Paket Tes", href: "/admin/test-package", icon: BookOpen },
      { title: "Pembahasan", href: "/admin/explanation", icon: ScrollText },
    ],
  },
  {
    label: "Konten",
    items: [
      { title: "Artikel", href: "/admin/article", icon: FileText },
      { title: "Deck Bawaan", href: "/admin/flashcard-deck", icon: Layers },
    ],
  },
  {
    label: "Komunitas",
    items: [
      { title: "Moderasi", href: "/admin/moderation", icon: MessageSquareWarning },
      { title: "User", href: "/admin/user", icon: Users },
      { title: "Conversation", href: "/admin/conversation", icon: MessagesSquare },
    ],
  },
  {
    label: "Operasional",
    items: [{ title: "Ops", href: "/admin/ops", icon: Settings2 }],
  },
];

export function AdminSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r-[3px] border-neo-ink bg-white">
      <SidebarHeader className="border-b-[3px] border-neo-ink p-3">
        <Link href="/admin" className="flex items-center gap-2.5 px-1 py-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border-2 border-neo-ink bg-neo-coral text-base font-black text-white shadow-neo-sm">
            管
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="font-mono text-sm leading-none font-black tracking-wider uppercase text-black">
              ADMIN
            </p>
            <p className="mt-1 truncate font-mono text-[10px] font-bold text-foreground/60 uppercase">
              {displayName}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="font-mono text-[10px] font-black uppercase tracking-wider text-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
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
                            ? "border-neo-ink bg-neo-coral text-white shadow-neo-sm hover:bg-neo-coral hover:text-white"
                            : "border-transparent text-foreground hover:border-neo-ink hover:bg-neo-paper hover:translate-x-1",
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t-[3px] border-neo-ink p-2.5">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Kembali ke aplikasi"
              render={<Link href="/dashboard" />}
              className="h-9 rounded-md border-2 border-neo-ink bg-neo-paper px-3 text-xs font-bold transition-all hover:bg-white hover:translate-x-0.5"
            >
              <Undo2 className="size-4 stroke-[2.5]" />
              <span className="truncate">Kembali ke Aplikasi</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Profil"
              render={<Link href="/profile" />}
              className="h-9 rounded-md border-2 border-transparent px-3 text-xs font-bold transition-all hover:border-neo-ink hover:bg-neo-paper"
            >
              <LogOut className="size-4 stroke-[2.5]" />
              <span className="truncate">Akun Saya</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
