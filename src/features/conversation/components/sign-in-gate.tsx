import Link from "next/link";
import { ArrowRight, LogIn, MessageSquareText } from "lucide-react";
import { CONVERSATION_PERSONAS } from "../data/personas";
import { PersonaAvatar } from "./persona-avatar";

// Guest boleh membuka halaman percakapan dan melihat apa isinya, tetapi
// pemakaiannya butuh akun: setiap giliran memanggil provider berbayar dan
// terikat quota per user, jadi tidak bisa dilayani tanpa identitas.
export function ConversationSignInGate({ next }: { next: string }) {
  return (
    <div className="neo-surface p-6 sm:p-8">
      <MessageSquareText className="size-10" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-black">Masuk untuk mulai berlatih</h2>
      <p className="mt-3 max-w-[60ch] font-semibold text-foreground/70">
        Percakapan terikat ke akunmu supaya batas pemakaian harian dan preferensi tampilan dapat
        dijaga per orang. Membuat akun gratis dan hanya perlu email.
      </p>

      <ul className="mt-6 grid gap-2 text-sm font-semibold text-foreground/75">
        <li>
          {CONVERSATION_PERSONAS.length} partner bicara dengan gaya berbeda, level N5 sampai N3.
        </li>
        <li>Furigana, romaji, dan terjemahan yang bisa dimatikan satu per satu.</li>
        <li>Balasan dapat dibacakan dengan suara.</li>
      </ul>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="neo-button">
          <LogIn className="size-5" aria-hidden="true" />
          Masuk
        </Link>
        <Link href="/register" className="neo-button bg-white">
          Buat akun
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 border-t-[3px] border-neo-ink pt-6">
        <p className="text-xs font-black tracking-wider uppercase text-foreground/60">
          Partner yang tersedia
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {CONVERSATION_PERSONAS.map((persona) => (
            <li key={persona.key} className="grid place-items-center gap-2 text-center">
              <PersonaAvatar persona={persona} size="md" />
              <span className="text-xs font-bold">{persona.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
