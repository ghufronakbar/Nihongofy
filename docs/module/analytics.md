# Modul Analytics

## Status Aktual

**Selesai untuk analisis attempt dan latihan cepat.** Modul memakai data completed milik user, mendukung filter scope/tanggal, menampilkan tren, ringkasan practice, breakdown mondai, dan proyeksi per level.

## Route

- `/analytics`

## Filter

- Scope: semua, mock penuh, latihan cepat, atau satu `JlptSection`.
- Rentang: semua, minggu ini, bulan ini, 30 hari terakhir, atau custom.
- Filter diteruskan sebagai argumen serializable ke cache per user.

## Data yang Dianalisis

- `Attempt` completed untuk tren dan breakdown exam.
- `AttemptAnswer.isCorrect` yang di-join ke mondai dan JLPT level.
- `PracticeSession` completed untuk jumlah session, soal, benar, dan akurasi per level.
- Attempt `ABANDONED` dan practice `ABANDONED` tidak dihitung.

## Output

- Line chart akurasi per attempt.
- Summary latihan cepat global dan per level.
- Tabel proyeksi per JLPT level dan per mondai.
- Empty state saat filter tidak menghasilkan data.

## Kondisi Skor

- Practice selalu dipisah dari proyeksi mock.
- Proyeksi exam memakai `computeJlptScoreProjection()` dengan bobot mondai statis buatan aplikasi.
- Angka bukan scaled score resmi JLPT dan tidak menggunakan IRT.

## Keterbatasan Aktual

- Database development saat audit belum memiliki `Attempt` atau `PracticeSession`, sehingga halaman aktual masih menampilkan empty state walaupun implementasinya tersedia.
- Belum menganalisis kana atau vocabulary/SRS.
- Belum ada statistik waktu karena `timeSpentSec` tidak diisi.
- Trend memakai akurasi mentah, bukan skor proyeksi berbobot.
- Breakdown exam menggabungkan seluruh completed attempt yang cocok dalam satu level; tidak ada minimum sample atau confidence indicator.
- Filter section memilih `Attempt.sectionScope`; full mock tidak ikut ketika memilih satu section meskipun full mock memiliki jawaban dari section itu.
- Custom date dibuat dari local midnight di client lalu dipotong dengan `toISOString()`. Pada zona positif seperti WIB, tanggal yang dipilih dapat terkirim sebagai hari sebelumnya; preset server juga mengikuti timezone runtime, bukan `Asia/Jakarta` secara eksplisit.
- Agregasi dilakukan di JavaScript setelah memuat seluruh hasil user tanpa pagination, sehingga biaya query dan memori bertambah seiring riwayat.
- Cache dibedakan per user dan filter serta tidak memiliki TTL eksplisit; invalidasi bergantung pada submit exam/practice yang selesai.
- Tidak ada export langsung dari Analytics; export tersedia di Progress.

## File Utama

- `src/features/analytics/actions.ts`
- `src/features/analytics/components/analytics-filter-bar.tsx`
- `src/features/analytics/components/score-trend-chart.tsx`
- `src/features/analytics/components/analytics-tabs.tsx`
- `src/app/(dashboard)/analytics/page.tsx`
- `src/lib/date-range-preset.ts`
- `src/lib/jlpt-score.ts`
