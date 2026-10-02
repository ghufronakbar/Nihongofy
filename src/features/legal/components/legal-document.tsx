import Link from "next/link";
import { FileText } from "lucide-react";
import { PageContainer } from "@/components/marketing/page-container";
import { isLegalPlaceholder, PRIVACY_PATH, TERMS_PATH } from "../constants";
import type { LegalDocument } from "../types";
import { LegalValue } from "./legal-blocks";

const DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

function LegalDate({ value }: { value: string }) {
  if (isLegalPlaceholder(value)) return <LegalValue value={value} />;
  // Tanggal ISO tanpa jam dibaca sebagai tengah malam UTC; pukul 12 menjaga
  // tanggalnya tetap sama di zona waktu mana pun.
  return <time dateTime={value}>{DATE_FORMAT.format(new Date(`${value}T12:00:00Z`))}</time>;
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const otherDocument =
    document.path === PRIVACY_PATH
      ? { href: TERMS_PATH, label: "Syarat & Ketentuan" }
      : { href: PRIVACY_PATH, label: "Kebijakan Privasi" };

  return (
    <PageContainer className="py-10 sm:py-14">
      <header className="max-w-4xl">
        <span className="inline-flex items-center gap-2 border-2 border-neo-ink bg-neo-yellow px-2.5 py-1 font-mono text-[11px] font-black tracking-widest text-black uppercase shadow-neo-sm">
          <FileText className="size-3.5" aria-hidden="true" />
          {document.kicker}
        </span>
        <h1 className="mt-4 text-4xl leading-[0.95] font-black uppercase sm:text-6xl">
          {document.title}
        </h1>
        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs font-bold tracking-wide uppercase">
          <div className="flex gap-2">
            <dt className="text-foreground/60">Versi</dt>
            <dd>{document.version}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-foreground/60">Terakhir diperbarui</dt>
            <dd>
              <LegalDate value={document.lastUpdated} />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-foreground/60">Berlaku sejak</dt>
            <dd>
              <LegalDate value={document.effectiveDate} />
            </dd>
          </div>
        </dl>
        <div className="mt-6 max-w-[70ch] text-lg leading-8 text-foreground/75">{document.summary}</div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Daftar isi" className="lg:sticky lg:top-6 lg:self-start">
          <div className="border-[3px] border-neo-ink bg-white p-4 shadow-neo-sm">
            <p className="font-mono text-xs font-black tracking-widest uppercase">Daftar isi</p>
            <ol className="mt-3 grid gap-1.5 text-sm">
              {document.sections.map((section, index) => (
                <li key={section.id} className="flex gap-2">
                  <span className="w-6 shrink-0 font-mono text-xs font-black text-foreground/50">
                    {index + 1}.
                  </span>
                  <a
                    href={`#${section.id}`}
                    className="font-semibold underline-offset-4 hover:underline hover:decoration-neo-blue hover:decoration-2"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="grid max-w-[75ch] gap-12">
          {document.sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-6">
              <h2 id={`${section.id}-title`} className="text-2xl leading-tight font-black sm:text-3xl">
                <span className="mr-2 font-mono text-foreground/40">{index + 1}.</span>
                {section.title}
              </h2>
              <div className="mt-4 grid gap-4">{section.content}</div>
            </section>
          ))}

          <p className="border-t-[3px] border-neo-ink pt-6 text-sm font-semibold text-foreground/70">
            Baca juga{" "}
            <Link
              href={otherDocument.href}
              className="font-bold underline decoration-2 decoration-neo-blue underline-offset-4"
            >
              {otherDocument.label}
            </Link>
            .
          </p>
        </article>
      </div>
    </PageContainer>
  );
}
