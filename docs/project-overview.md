# Project Overview

Platform web multi-user untuk belajar dan latihan mock test JLPT menggunakan bank soal tahun-tahun sebelumnya.
Stack: Next.js (App Router) + Prisma + PostgreSQL (Supabase).

Rules terkait: `database.md` (schema, markup teks, aturan query).

## Konsep Utama

- **Mock test**: mengerjakan satu paket penuh, dibagi per sesi (1/2/3) mengikuti sesi ujian JLPT asli.
- **Latihan per seksi**: mengerjakan satu seksi saja (mis. hanya dokkai). Di database ini adalah `Attempt` dengan `sectionScope` terisi.
- **Timer tidak disediakan sistem** — user memasang timer sendiri. Halaman detail paket menampilkan informasi waktu resmi per sesi JLPT sebagai acuan.
- Saat **mengerjakan**: furigana dan comment TIDAK ditampilkan (fokus seperti ujian asli). Saat **review/hasil**: furigana, kunci jawaban, explanation, dan comment ditampilkan.

## Routes

### Route group `(marketing)` - shell publik

| Route | Deskripsi |
|---|---|
| `/` | Home publik dengan header/footer marketing dan CTA ke mock test, login, atau dashboard. |

### Route group `(auth)` - layout auth

| Route | Deskripsi |
|---|---|
| `/login` | Login akun existing. Mendukung query `next` yang divalidasi sebagai path internal. |
| `/register` | Route registrasi publik. Pada Fase 1 masih berupa preview non-mutating sampai migrasi email/display name dan keamanan database selesai. |

`/first-time-setup` sudah dihapus. URL lama diarahkan permanen ke `/register` agar bookmark lama tidak menjadi dead end.

### Route group `(dashboard)` — layout dashboard dengan sidebar

Mencakup juga `/exam` dan `/result` (awalnya direncanakan tanpa sidebar untuk mode fokus, tapi diubah supaya user tetap bisa navigasi lewat sidebar saat mengerjakan/review).

| Route | Deskripsi |
|---|---|
| `/dashboard` | Ringkasan singkat (attempt terakhir, statistik ringkas) dan CTA ke test package. |
| `/analytics` | Rapor hasil belajar: skor per attempt, tren, kelemahan per `mondaiType`/section. Hanya menghitung attempt `COMPLETED`. |
| `/test-package` | Daftar paket tes, dikelompokkan per level: N1 [paket-paket N1], N2 [paket-paket N2], dst. |
| `/test-package/[id]` | Overview satu paket: berapa kali dikerjakan + hasilnya, informasi waktu resmi per sesi JLPT (acuan timer manual), tombol mulai **mock test** (full) atau **latihan per seksi** (pilih section, mis. choukai/dokkai saja). Menekan tombol = membuat `Attempt` baru lalu redirect ke `/exam/...`. |
| `/test-package/[id]/questions` | Mode baca: melihat semua soal paket secara langsung, furigana tampil, comment tampil. Bukan mode pengerjaan. |
| `/history` | Daftar semua attempt milik user lintas paket (bukan cuma satu paket seperti di `/test-package/[id]`), dengan link ke `/result/[attemptId]` & `/result/[attemptId]/detail` untuk yang `COMPLETED`. Entry point utama untuk lihat attempt lama. |

### Pengerjaan

| Route | Deskripsi |
|---|---|
| `/exam/[attemptId]/[session]` | Halaman pengerjaan. Satu route untuk dua mode, dibedakan dari `Attempt.sectionScope`: **mock test** (`sectionScope = null`) → soal full paket, `[session]` mengikuti sesi paket (1/2/3); **latihan per seksi** (`sectionScope` terisi) → hanya soal section tersebut, `[session]` selalu `1`. |

Aturan halaman exam:

- Navigasi nomor soal memakai query param `?questionNumber=1` dikombinasikan dengan global state. Wajib ada fallback jika query param diubah manual/iseng (angka di luar range, bukan angka → fallback ke soal pertama yang belum dijawab atau soal 1).
- Jawaban dan flag disimpan di global state dahulu; commit ke DB (upsert `AttemptAnswer`) hanya saat submit per sesi.
- Furigana dan comment tidak dirender. Kunci jawaban dan explanation tidak boleh terkirim ke client (lihat `database.md`).
- Guard: attempt yang sudah `COMPLETED` tidak boleh dibuka di route ini → redirect ke `/result/[attemptId]`.

### Hasil

| Route | Deskripsi |
|---|---|
| `/result/[attemptId]` | Summary attempt: nilai, total benar, total salah, total tidak dijawab, total flag, dst. |
| `/result/[attemptId]/detail` | Review keseluruhan: soal + jawaban user + kunci jawaban + explanation, furigana tampil, comment tampil. Di halaman ini user bisa menambahkan comment baru per soal. |

## Catatan Teknis

- Semua route `(dashboard)` (termasuk `/exam` dan `/result`) memerlukan session; tanpa session redirect ke `/login?next=<path>`.
- Global state jawaban exam sebaiknya di-persist (mis. sessionStorage/localStorage) agar refresh halaman tidak menghilangkan jawaban yang belum disubmit.
- Submit sesi bersifat final untuk sesi tersebut — setelah submit, sesi tidak bisa dikerjakan ulang di attempt yang sama. Attempt menjadi `COMPLETED` setelah sesi terakhir disubmit.
