import type { ReactNode } from "react";
import type { ReportCategoryValue } from "@/features/report/constants";
import {
  BUNPOU_COMPARISON_FIXTURE_FILE,
  BUNPOU_SEED_COMMANDS,
  bunpouComparisonRegenerateCommand,
  bunpouPointCategoryNote,
  bunpouPointFixtureFile,
  bunpouPointRegenerateCommand,
} from "@/features/report/lib/bunpou-target";
import type { ReportBunpouTarget } from "../queries";

function Command({ children }: { children: ReactNode }) {
  // `select-all`: satu klik memilih seluruh perintah untuk disalin.
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
 * Langkah perbaikan laporan pola atau perbandingan bunpou. Isinya dibaca lewat
 * tautan "Buka target" ke halaman publik; katalog diisi `seed:bunpou` dari
 * fixture, jadi tidak ada editor di admin.
 */
export function BunpouReportPanel({
  category,
  bunpou,
}: {
  category: ReportCategoryValue;
  bunpou: ReportBunpouTarget;
}) {
  const isPoint = bunpou.kind === "point";
  const note = isPoint ? bunpouPointCategoryNote(category) : null;

  return (
    <div className="flex flex-col gap-3 border-2 border-neo-ink/15 bg-neo-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isPoint ? (
          <span className="border-2 border-neo-ink bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-black text-black uppercase">
            {bunpou.level}
          </span>
        ) : null}
        <span className="font-mono text-[10px] font-black text-foreground/60 uppercase">key</span>
        <code className="font-mono text-xs font-bold select-all">{bunpou.key}</code>
        {bunpou.retiredAt ? (
          <span className="font-mono text-[11px] font-bold text-neo-coral">
            dipensiunkan {bunpou.retiredAt.toISOString().slice(0, 10)} · tidak tampil di /bunpou
          </span>
        ) : null}
      </div>

      <div>
        <p className="font-mono text-[10px] font-black text-foreground/60 uppercase">
          Cara memperbaiki — isi bunpou tidak diedit dari admin
        </p>
        <ol className="mt-1 list-decimal space-y-2 pl-5 text-xs font-semibold text-foreground/85">
          <li>
            Sunting <Inline>content</Inline> di{" "}
            <Inline>{isPoint ? bunpouPointFixtureFile(bunpou.level) : BUNPOU_COMPARISON_FIXTURE_FILE}</Inline>{" "}
            (cari <Inline>&quot;key&quot;: {JSON.stringify(bunpou.key)}</Inline>), atau generate ulang:
            <Command>
              {isPoint
                ? bunpouPointRegenerateCommand(bunpou.key)
                : bunpouComparisonRegenerateCommand(bunpou.key)}
            </Command>
          </li>
          {note ? <li>{note}</li> : null}
          {isPoint ? null : (
            <li>
              Generate ulang mengosongkan <Inline>reviewedAt</Inline>. Perbandingan baru terbit lagi
              setelah ditinjau dan <Inline>reviewedAt</Inline> diisi.
            </li>
          )}
          <li>
            Validasi lalu terbitkan, kemudian invalidasi tag <Inline>bunpouCatalog</Inline> di
            /admin/ops supaya halaman publik langsung berubah.
            {BUNPOU_SEED_COMMANDS.map((command) => (
              <Command key={command}>{command}</Command>
            ))}
          </li>
          <li>
            Jangan ubah <Inline>key</Inline>: URL dan tautan lain merujuknya. Tandai laporan ini{" "}
            <strong>Selesai</strong> setelah isi di halaman publik sudah benar.
          </li>
        </ol>
      </div>
    </div>
  );
}
