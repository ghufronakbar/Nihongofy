import Link from "next/link";
import { notFound } from "next/navigation";
import { Mic2 } from "lucide-react";
import { CONVERSATION_PROVIDER, FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { SimulationNotice } from "@/features/conversation/components/simulation-notice";
import { ConversationSessionList } from "@/features/conversation/components/conversation-session-list";
import { SpeechSupportProbe } from "@/features/conversation/components/speech-support-probe";
import { listConversationSessions } from "@/features/conversation/queries";

export default async function SpeakingIndexPage() {
  if (!FEATURES.speaking) notFound();

  const session = await getSession();
  const sessions = session ? await listConversationSessions("VOICE") : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <Mic2 className="size-8" aria-hidden="true" />
          Latihan bicara
        </h1>
        <p className="mt-2 max-w-[65ch] font-semibold text-foreground/70">
          Ucapkan jawabanmu, periksa transkripnya, lalu kirim. Kalau mikrofon tidak tersedia,
          latihan tetap bisa dijalankan penuh dengan mengetik.
        </p>
      </header>

      {CONVERSATION_PROVIDER === "mock" && <SimulationNotice />}

      <SpeechSupportProbe />

      {session ? (
        <>
          <Link href="/speaking/setup" className="neo-button">
            Mulai latihan baru
          </Link>

          <section className="space-y-4">
            <h2 className="text-lg font-black">Latihan tersimpan</h2>
            <ConversationSessionList sessions={sessions} basePath="/speaking" />
          </section>
        </>
      ) : (
        <ConversationSignInGate next="/speaking" />
      )}
    </div>
  );
}
