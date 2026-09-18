import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CONVERSATION_PROVIDER, FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationSetup } from "@/features/conversation/components/conversation-setup";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { SimulationNotice } from "@/features/conversation/components/simulation-notice";

export default async function ConversationSetupPage() {
  if (!FEATURES.conversation) notFound();

  const session = await getSession();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm font-bold text-foreground/60"
      >
        <Link href="/conversation" className="hover:text-foreground">
          Percakapan
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="text-foreground">Persiapan</span>
      </nav>

      <header>
        <h1 className="text-3xl font-black">Siapkan percakapan</h1>
        <p className="mt-2 max-w-[65ch] font-semibold text-foreground/70">
          Pilih level, partner bicara, dan topik. Semuanya dapat diganti dengan memulai percakapan
          baru.
        </p>
      </header>

      {CONVERSATION_PROVIDER === "mock" && <SimulationNotice />}

      {session ? <ConversationSetup /> : <ConversationSignInGate next="/conversation/setup" />}
    </div>
  );
}
