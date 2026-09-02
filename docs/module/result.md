# Modul Result

## Status Aktual

**Selesai untuk attempt user login, dengan skor aproksimasi.** Summary dan review per soal memakai data database, ownership check, serta hanya menerima attempt `COMPLETED`.

## Route

- `/result/[attemptId]`
- `/result/[attemptId]/detail`

## Result Summary

- Menampilkan benar, salah, kosong, flag, akurasi, dan durasi attempt.
- Mengelompokkan jawaban per mondai untuk proyeksi section dan skor berbobot.
- Summary dicache per attempt; `userId` owner tetap menjadi argumen dan diverifikasi.

## Result Detail

- Menampilkan jawaban user, kunci, explanation, stimulus, media, dan flag.
- Furigana dapat ditampilkan/disembunyikan.
- Navigasi per mondai tersedia pada desktop dan mobile.
- User dapat copy soal ke clipboard serta mengelola catatan pribadi.
- Detail tidak dicache karena comment harus langsung terlihat setelah mutation.

## Kondisi Skor

- Akurasi dihitung langsung dari `AttemptAnswer.isCorrect`.
- Proyeksi 60 poin per scoring section dan maksimum 180 memakai bobot mondai buatan aplikasi.
- Algoritma scaled scoring/IRT resmi JLPT tidak dipublikasikan dan **tidak** digunakan.
- Belum ada keputusan lulus/gagal atau minimum score per section/level.
- Untuk latihan satu section, `maxScore` hanya sebesar section yang memiliki data, bukan selalu 180.

## Keterbatasan dan Risiko

- Total soal summary berasal dari jumlah row `AttemptAnswer`, bukan jumlah soal seharusnya pada scope. Ini mengikuti gap validasi kelengkapan submit di modul Exam.
- Durasi adalah selisih `startedAt`-`finishedAt`; waktu idle dan jeda antar-session ikut dihitung.
- Mayoritas soal database belum memiliki explanation, sehingga review sering hanya menampilkan kunci.
- Guest tidak memiliki result karena tidak membuat attempt database.
- Tidak ada compare-attempt, share report, atau export dari halaman result.

## File Utama

- `src/features/result/actions.ts`
- `src/app/(public)/result/[attemptId]/page.tsx`
- `src/app/(public)/result/[attemptId]/detail/page.tsx`
- `src/lib/jlpt-score.ts`

