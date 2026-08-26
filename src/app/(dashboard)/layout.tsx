import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

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
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 [&>*]:min-w-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
