import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { getSession } from "@/lib/auth";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <a href="#main-content" className="skip-link">
        Lewati ke konten
      </a>
      <PublicHeader isAuthenticated={Boolean(session)} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
