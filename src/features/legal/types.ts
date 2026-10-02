import type { ReactNode } from "react";

export type LegalSection = {
  /** Anchor `#id` di halaman; jangan diubah setelah terbit karena bisa sudah ditautkan. */
  id: string;
  title: string;
  content: ReactNode;
};

export type LegalDocument = {
  title: string;
  description: string;
  path: string;
  kicker: string;
  /** Versi dokumen, dinaikkan setiap kali isinya berubah secara berarti. */
  version: string;
  /** Tanggal ISO `YYYY-MM-DD`. */
  lastUpdated: string;
  /** Tanggal ISO `YYYY-MM-DD`, atau placeholder `[[ISI: ...]]` selama belum ditetapkan. */
  effectiveDate: string;
  summary: ReactNode;
  sections: LegalSection[];
};
