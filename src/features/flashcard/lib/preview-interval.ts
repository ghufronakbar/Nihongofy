/**
 * Label interval bergaya Anki: m = menit, j = jam, h = hari, bln = bulan,
 * thn = tahun. Dipakai reviewer untuk menampilkan hasil tiap tombol.
 */
export function formatIntervalLabel(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;

  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}j`;

  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}h`;

  const months = days / 30.4;
  if (months < 12) return `${months.toFixed(1).replace(".", ",")}bln`;

  return `${(days / 365).toFixed(1).replace(".", ",")}thn`;
}
