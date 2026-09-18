import { FlaskConical } from "lucide-react";

// O-6: mode mock wajib membawa penanda yang jelas. Aturan dokumentasi project
// tetap berlaku — tidak ada hasil yang disajikan sebagai nyata padahal bukan.
export function SimulationNotice() {
  return (
    <div className="flex items-start gap-3 border-[3px] border-neo-ink bg-neo-yellow p-4">
      <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-black">Mode simulasi</p>
        <p className="mt-1 text-sm font-semibold">
          Balasan pada halaman ini berasal dari skrip tetap, bukan dari AI. Tahap ini dipakai untuk
          menilai alur dan tampilan. Percakapan hanya tersimpan di tab browser ini.
        </p>
      </div>
    </div>
  );
}
