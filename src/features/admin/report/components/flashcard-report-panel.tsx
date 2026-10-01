import type { ReactNode } from "react";
import { VocabCardView } from "@/features/flashcard/components/vocab-card-view";
import type { ReportCategoryValue } from "@/features/report/constants";
import {
  FLASHCARD_SEED_COMMANDS,
  flashcardCategoryNote,
  flashcardFixtureFile,
  flashcardRegenerateCommand,
} from "@/features/report/lib/flashcard-target";
import type { ReportFlashcardTarget } from "../queries";

function Command({ children }: { children: ReactNode }) {
  // `select-all`: satu klik memilih seluruh perintah untuk disalin, tanpa
  // tombol salin yang membutuhkan komponen client.
  return (
    <code className="mt-1 block w-fit max-w-full overflow-x-auto border-2 border-neo-ink bg-white px-2 py-1 font-mono text-[11px] font-bold whitespace-pre select-all">
      {children}
    </code>
  );
}

function Inline({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[11px] font-bold">{children}</code>;
}

/**
 * Detail laporan kartu flashcard di antrean admin. Kartu tidak diedit dari sini:
 * katalog diisi `seed:flashcard` dari fixture, jadi panel ini menampilkan isi
 * kartu sekarang beserta langkah perbaikan di fixture-nya.
 */
export function FlashcardReportPanel({
  category,
  flashcard,
}: {
  category: ReportCategoryValue;
  flashcard: ReportFlashcardTarget;
}) {
  const note = flashcardCategoryNote(category, flashcard.key);

  return (
    <div className="flex flex-col gap-3 border-2 border-neo-ink/15 bg-neo-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-black text-black uppercase">
          {flashcard.level}
        </span>
        <span className="font-mono text-[10px] font-black text-foreground/60 uppercase">key</span>
        <code lang="ja" className="font-mono text-xs font-bold select-all">
          {flashcard.key}
        </code>
        {flashcard.retiredAt ? (
          <span className="font-mono text-[11px] font-bold text-neo-coral">
            dipensiunkan {flashcard.retiredAt.toISOString().slice(0, 10)} · tidak tampil di deck mana
            pun
          </span>
        ) : null}
      </div>

      <details>
        <summary className="cursor-pointer font-mono text-[11px] font-black uppercase">
          Lihat isi kartu sekarang
        </summary>
        <p className="mt-1 text-[11px] font-semibold text-foreground/60">
          Dibaca langsung dari katalog, bukan salinan saat dilaporkan. Setelah fixture diperbaiki
          dan di-seed, yang tampil di sini sudah versi barunya.
        </p>
        <div className="mt-2 max-w-xl">
          <VocabCardView
            content={flashcard.content}
            revealed
            isNew={false}
            textScale={80}
            furiganaVisible
          />
        </div>
      </details>

      <div>
        <p className="font-mono text-[10px] font-black text-foreground/60 uppercase">
          Cara memperbaiki — isi kartu tidak diedit dari admin
        </p>
        <ol className="mt-1 list-decimal space-y-2 pl-5 text-xs font-semibold text-foreground/85">
          <li>
            Sunting <Inline>content</Inline> kata ini di{" "}
            <Inline>{flashcardFixtureFile(flashcard.level)}</Inline> (cari{" "}
            <Inline>&quot;key&quot;: {JSON.stringify(flashcard.key)}</Inline>), atau generate ulang:
            <Command>{flashcardRegenerateCommand(flashcard.key)}</Command>
          </li>
          {note ? (
            <li>
              {note.text}
              {note.commands.map((command) => (
                <Command key={command}>{command}</Command>
              ))}
            </li>
          ) : null}
          <li>
            Validasi lalu terbitkan. Kartu semua user ikut berubah karena kartu merujuk katalog,
            bukan salinannya.
            {FLASHCARD_SEED_COMMANDS.map((command) => (
              <Command key={command}>{command}</Command>
            ))}
          </li>
          <li>
            Jangan ubah <Inline>key</Inline>: progres belajar user merujuknya. Tandai laporan ini{" "}
            <strong>Selesai</strong> setelah isi kartu di atas sudah benar.
          </li>
        </ol>
      </div>
    </div>
  );
}
