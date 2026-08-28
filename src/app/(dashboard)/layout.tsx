import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { displayName: true, avatarUrl: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar displayName={user.displayName} avatarUrl={user.avatarUrl} />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b-[3px] border-neo-ink bg-white px-4 shadow-neo-sm md:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-md border-2 border-neo-ink bg-white p-0 text-black shadow-neo-sm transition-all hover:bg-neo-yellow hover:translate-x-[-1px] hover:translate-y-[-1px]" />
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="font-mono text-sm font-black tracking-wider uppercase text-black hover:text-neo-blue">
                JLPT EXAM
              </Link>
              <span className="hidden text-xs font-bold text-foreground/40 sm:inline">/</span>
              <span lang="ja" className="font-japanese hidden text-xs font-bold text-foreground/60 sm:inline">
                日本語能力試験
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center border-2 border-neo-ink bg-neo-yellow px-2.5 py-0.5 font-mono text-xs font-black shadow-neo-sm">
              DASHBOARD
            </span>
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 [&>*]:min-w-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
