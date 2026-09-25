import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Area operator, bukan halaman produk. Tidak pernah diindeks, dan namanya tidak
// memakai template judul publik.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Satu-satunya batas otorisasi untuk render. `requireAdmin()` memberi 404 yang
  // identik untuk guest maupun user biasa, jadi keberadaan area ini tidak bocor.
  // Server Action admin TIDAK terlindungi oleh layout ini dan wajib memanggil
  // `requireAdmin()` sendiri.
  const { user } = await requireAdmin();

  return (
    <SidebarProvider>
      <AdminSidebar displayName={user.displayName} />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b-[3px] border-neo-ink bg-white px-4 shadow-neo-sm md:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-md border-2 border-neo-ink bg-white p-0 text-black shadow-neo-sm transition-all hover:bg-neo-yellow hover:translate-x-[-1px] hover:translate-y-[-1px]" />
            <Link
              href="/admin"
              className="font-mono text-sm font-black tracking-wider uppercase text-black hover:text-neo-coral"
            >
              NIHONGOFY
            </Link>
          </div>
          <span className="inline-flex items-center border-2 border-neo-ink bg-neo-coral px-2.5 py-0.5 font-mono text-xs font-black text-white shadow-neo-sm">
            ADMIN
          </span>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 [&>*]:min-w-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
