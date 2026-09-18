import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CONVERSATION_PROVIDER, FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationSetup } from "@/features/conversation/components/conversation-setup";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { SimulationNotice } from "@/features/conversation/components/simulation-notice";
import { SpeechSupportProbe } from "@/features/conversation/components/speech-support-probe";

export default async function SpeakingSetupPage() {
  if (!FEATURES.speaking) notFound();

  const session = await getSession();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm font-bold text-foreground/60"
      >
        <Link href="/speaking" className="hover:text-foreground">
          Latihan bicara
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="text-foreground">Persiapan</span>
      </nav>

      <header>
        <h1 className="text-3xl font-black">Siapkan latihan bicara</h1>
        <p className="mt-2 max-w-[65ch] font-semibold text-foreground/70">
          Izin mikrofon baru diminta saat kamu menekan tombol rekam, bukan sekarang. Suara diproses
          langsung di perangkatmu dan tidak diunggah ke mana pun.
        </p>
      </header>

      {CONVERSATION_PROVIDER === "mock" && <SimulationNotice />}

      <SpeechSupportProbe />

      {session ? (
        <ConversationSetup mode="VOICE" />
      ) : (
        <ConversationSignInGate next="/speaking/setup" />
      )}
    </div>
  );
}
