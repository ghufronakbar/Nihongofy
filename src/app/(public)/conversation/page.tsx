import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { CONVERSATION_PROVIDER, FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { ConversationSessionList } from "@/features/conversation/components/conversation-session-list";
import { listConversationSessions } from "@/features/conversation/queries";
import { ConversationSignInGate } from "@/features/conversation/components/sign-in-gate";
import { SimulationNotice } from "@/features/conversation/components/simulation-notice";

export default async function ConversationIndexPage() {
  if (!FEATURES.conversation) notFound();

  const session = await getSession();
  const sessions = session ? await listConversationSessions("TEXT") : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <MessageSquareText className="size-8" aria-hidden="true" />
          Percakapan
        </h1>
        <p className="mt-2 max-w-[65ch] font-semibold text-foreground/70">
          Latihan percakapan bahasa Jepang dengan partner yang gaya bicaranya dapat dipilih. Ini
          latihan, bukan penilaian resmi JLPT.
        </p>
      </header>

      {CONVERSATION_PROVIDER === "mock" && <SimulationNotice />}

      {session ? (
        <>
          <Link href="/conversation/setup" className="neo-button">
            Mulai percakapan baru
          </Link>

          <section className="space-y-4">
            <h2 className="text-lg font-black">Percakapan tersimpan</h2>
            <ConversationSessionList sessions={sessions} basePath="/conversation" />
          </section>
        </>
      ) : (
        <ConversationSignInGate next="/conversation" />
      )}
    </div>
  );
}
