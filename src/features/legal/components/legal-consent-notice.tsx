import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRIVACY_PATH, TERMS_PATH } from "../constants";

const LINK_CLASS = "font-bold text-foreground underline decoration-2 decoration-neo-blue underline-offset-4";

/**
 * Kalimat persetujuan di dekat tombol yang dapat membuat akun.
 *
 * Tautan dibuka di tab baru supaya isian form dan challenge Turnstile tidak
 * hilang saat dokumennya dibaca.
 */
export function LegalConsentNotice({
  lead = "Dengan mendaftar",
  className,
}: {
  lead?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs leading-5 text-foreground/70", className)}>
      {lead}, Anda menyetujui{" "}
      <Link href={TERMS_PATH} target="_blank" rel="noopener" className={LINK_CLASS}>
        Syarat & Ketentuan
      </Link>{" "}
      dan{" "}
      <Link href={PRIVACY_PATH} target="_blank" rel="noopener" className={LINK_CLASS}>
        Kebijakan Privasi
      </Link>
      .
    </p>
  );
}
