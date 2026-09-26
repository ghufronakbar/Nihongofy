# Modul Result

## Status Aktual

**Selesai untuk attempt user login, dengan skor aproksimasi.** Summary dan review per soal memakai data database, ownership check, serta hanya menerima attempt `COMPLETED`. Guest mendapat summary sementara tanpa review per soal.

## Feature Flag

Tidak punya flag sendiri; ikut `FEATURES_TEST_PACKAGE` (lihat [Paket tes](test-package.md#feature-flag)). Saat `false`, `/result/*` mengembalikan 404 lewat guard `src/app/(public)/result/layout.tsx`. Catatan pribadi di result detail diatur terpisah oleh `FEATURES_QUESTION_COMMENT`.

## Route

- `/result/[attemptId]`
- `/result/[attemptId]/detail`
- `/result/guest`

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

## Result Guest

- Guest tidak punya row `Attempt`, sehingga lembar jawaban dikirim client dari `sessionStorage` (seluruh key berprefix `exam-state-0-`, jadi satu mock penuh terjumlah lintas session).
- `getGuestAttemptSummary` menilai di server: `questionAnswer` tidak pernah ikut ke client selama exam.
- Penyebut diambil dari seluruh soal pada scope paket/section, bukan dari payload client, sehingga session yang dilewati tetap terhitung kosong.
- Menampilkan akurasi, benar/salah/kosong/ragu, dan proyeksi 180 poin memakai `ResultSummaryView` yang sama dengan attempt user login. Yang tidak diberikan: durasi, review per soal, riwayat, dan analitik.
- Cookie guest habis atau `sessionStorage` kosong menghasilkan empty state ber-CTA daftar, bukan skor 0%.
- Payload jawaban tidak diverifikasi keasliannya. Ini tidak menambah kebocoran kunci karena guest memang sudah bisa membuka `/test-package/[id]/questions` yang menampilkan kunci.

### Klaim Hasil ke Akun

- CTA "Daftar & Simpan Hasil" / "Sudah Punya Akun? Masuk" memanggil `stashGuestAttemptAction` **sebelum** berpindah ke auth, lalu mengarah ke `/login|/register?next=/result/guest?import=1`.
- Alasannya jalur register: `registerAction` tidak membuat session, melainkan mengirim email verifikasi, dan tautannya hampir selalu dibuka di tab baru. `sessionStorage` terikat satu tab, jadi jawaban harus sudah pindah ke server sebelum auth dimulai.
- Titipan memakai pola `google-oauth-state.ts`: token acak di cookie httpOnly `guest_attempt_stash` + payload di Redis ber-TTL 24 jam (`GUEST_ATTEMPT_STASH_DURATION_SECONDS`, disamakan dengan jendela verifikasi email), dikonsumsi sekali pakai lewat `getdel`.
- `getSafeRedirectPath` mempertahankan query string, sehingga `?import=1` selamat melewati login maupun `confirmEmailAction`.
- `importGuestAttemptAction` membuat satu `Attempt` berstatus `COMPLETED` dengan satu row `AttemptAnswer` per soal pada scope. `isCorrect` dihitung ulang dari kunci, jadi skor tidak bisa dikarang client — yang bisa hanya pilihan jawabannya, dan itu hanya mengotori statistik akun miliknya sendiri.
- `startedAt` diambil dari cookie guest (dicatat saat exam dimulai) supaya durasi attempt nyata; cookie lama tanpa field itu jatuh ke `finishedAt` sehingga durasinya 0 menit.
- Setelah sukses: cookie `jlpt_guest_exam` dan titipan dihapus server-side, `sessionStorage` dibersihkan client-side, cache dashboard/analytics/profile diinvalidasi, lalu user diarahkan ke `/result/[attemptId]` yang sebenarnya.
- `?import=1` hanya dipakai sebagai penanda kembalian auth; membuka `/result/guest` sambil login tanpa parameter itu menampilkan tombol "Simpan ke Akun", tidak mengimpor diam-diam.
- Titipan kedaluwarsa (lewat 24 jam atau sudah dipakai) menghasilkan pesan gagal, bukan attempt kosong.

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
- Tidak ada compare-attempt, share report, atau export dari halaman result.

## File Utama

- `src/features/result/actions.ts`
- `src/features/result/lib/guest-attempt-stash.ts`
- `src/features/result/components/result-summary-view.tsx`
- `src/features/result/components/guest-result.tsx`
- `src/app/(public)/result/[attemptId]/page.tsx`
- `src/app/(public)/result/[attemptId]/detail/page.tsx`
- `src/app/(public)/result/guest/page.tsx`
- `src/lib/jlpt-score.ts`

