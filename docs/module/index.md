# Dokumentasi Modul

Folder ini mendokumentasikan kondisi aplikasi berdasarkan kode, fixture, dan database development yang diperiksa mulai **2 September 2026 (WIB)** dan diperbarui sesuai hasil verifikasi berikutnya. Status di sini menjelaskan implementasi aktual, bukan hanya rencana di `docs/plan.md`.

## Ringkasan Status

| Modul | Status aktual | Catatan singkat |
|---|---|---|
| [Public shell dan home](public-shell.md) | Selesai | Landing page, header/footer, dan CTA aktif; menu, kartu, dan section mengikuti feature flag modul. |
| [Authentication](auth.md) | Selesai | Login, register, verifikasi email, reset password, Redis session registry, revoke perangkat, rate limit, dan Turnstile aktif. |
| [Dashboard](dashboard.md) | Selesai sederhana | Menampilkan attempt selesai dan attempt terakhir; kartu modul lain masih berupa shortcut statis. |
| [Kana](kana.md) | Selesai dengan scope terbatas | Fixture kana terkurasi dan progress akun aktif; audio memakai Web Speech API, bukan rekaman. |
| [Flashcard](flashcard.md) | Kode selesai, katalog belum terisi | Dirombak 1 Oktober 2026: katalog kosakata JLPT bawaan (6.697 kata N5-N1) dengan deck per level/topik/kategori, FSRS-6 dan antrean v3 Anki, pengaturan per user, dan mode coba guest. Menunggu migration, generate isi kartu AI, dan seed. |
| [Bunpou](bunpou.md) | Fase A selesai di kode, belum live | Katalog pola kalimat bawaan di `/bunpou` (90 pola N5, 138 pola N4) dengan halaman detail dan perbandingan pola mirip. Migration dan seed sudah jalan; menunggu uji manual. Tautan ke soal JLPT asli (Fase B) dan SRS (Fase C) belum dikerjakan. Kontrak data di [seed-bunpou.md](../seed-bunpou.md). |
| [Latihan cepat](practice.md) | Fungsional dengan gap guest | Session akun persisten dan feedback langsung aktif; guest hanya state sementara. |
| [Paket tes](test-package.md) | Fungsional, kini dikelola dari admin | 48 fixture dan 48 paket di database mencakup kelima level; import, editor soal, dan penghapusan tersedia di `/admin/test-package`. |
| [Exam runner](exam.md) | Fungsional dengan hardening tersisa | State sesi dan submit aktif; belum ada timer, marker submit per sesi, dan validasi kelengkapan payload. |
| [Result](result.md) | Selesai dengan skor aproksimasi | Summary dan review aktif, guest dapat summary sementara; skor 180 bukan scaled score resmi JLPT. |
| [History](history.md) | Selesai | Riwayat dan resume attempt akun aktif; belum mencakup latihan cepat. |
| [Analytics](analytics.md) | Selesai untuk exam/practice | Filter, tren, breakdown mondai, dan practice summary aktif; data development saat audit masih empty state. |
| [Progress dan export](progress.md) | Selesai | Tabel per attempt serta export XLSX/PDF aktif; belum ada grafik dan data development masih empty state. |
| [Profile](profile.md) | Selesai dengan gap account lifecycle | Edit akun, avatar, password, overview, dan SRS settings aktif. |
| [Article](article.md) | Selesai, kini punya CMS admin | Listing, search, detail, SEO, save/favorite, dan view aktif; CRUD serta workflow draft/published/archived ada di `/admin/article`. Belum ada halaman koleksi tersimpan. |
| [Question comments](question-comment.md) | Selesai, kini termasuk diskusi publik | Catatan pribadi, berbagi ke diskusi, balasan satu tingkat, permalink `/discussion/[commentId]`, dan moderasi admin aktif; laporan dari user kini ada lewat [modul report](report.md), sedangkan notifikasi dan rate limit posting belum ada. |
| [Japanese content rendering](japanese-content-rendering.md) | Fungsional dengan gap format | Furigana, underline, slot, tabel, dan multi-passage aktif; newline dan Markdown fixture belum selalu dirender dengan benar. |
| [Shared study utilities](study.md) | Selesai sederhana | Saat ini hanya menyediakan TTS browser bersama untuk kana dan flashcard. |
| [Conversation dan speaking](conversation-speaking.md) | Versi awal fungsional | Teks dan suara berjalan end-to-end dengan session tersimpan dan provider mock/OpenAI; quota belum ditegakkan, moderation dan retention belum ada. Rancangan: [conversation-speaking-design.md](conversation-speaking-design.md); aset karakter: [conversation-persona-assets.md](conversation-persona-assets.md). |
| [Content data dan seeding](content-data.md) | Infrastruktur aktif, sebagian punya UI | Import tervalidasi tersedia lewat CLI maupun `/admin`; bank soal dan artikel berbagi jalur kode antara keduanya. Pembahasan dan katalog flashcard masih CLI saja. |
| [Komunitas](community.md) | Tahap 1–3 selesai di kode, menunggu uji manual | Profil publik `/u/[username]` dengan statistik, heatmap, streak, reputasi "Membantu", toggle public/private, follow dengan persetujuan untuk akun private, serta postingan dengan like/komentar dan feed `/community` aktif (migration diterapkan 3 Oktober 2026). Notifikasi dan blokir (tahap 4) belum. Rancangan lengkap dikunci 3 Oktober 2026: profil publik `/u/[username]` dengan akun public/private, follow dengan persetujuan untuk akun private, postingan dengan like/komentar/balasan dan feed `/community`, reputasi "Membantu" pengganti like profile, notifikasi di tahap terakhir. Checklist di `docs/plan.md` Fase 8.15. |
| [Report](report.md) | Selesai untuk scope v1, kini termasuk kartu flashcard | Form publik (guest boleh, dengan Turnstile), tombol Laporkan pada soal/pembahasan/artikel/diskusi/kartu flashcard, antrean admin, dan balasan email opsional. Target kartu flashcard menunggu `migrate deploy`. |
| [Admin dashboard](admin.md) | Selesai | Role statis `USER`/`ADMIN`, guard, overview, bank soal, pembahasan, CMS artikel, moderasi diskusi, pengelolaan user, observability conversation, feature flag read-only, invalidasi cache, dan audit log aktif. Editor deck flashcard dihapus bersama perombakan modulnya. |

## Feature Flag

Setiap modul dapat dimatikan lewat env `FEATURES_<NAMA>` bernilai `"true"`/`"false"`. Kosong atau
tidak diisi berarti `true`. Nilai dibaca sekali saat server start melalui objek `FEATURES` di
`src/constants/index.ts`; ubah env lalu restart atau redeploy. `robots.txt` dan `sitemap.xml`
di-prerender saat build, jadi keduanya baru berubah setelah redeploy.

| Key | Modul | Route yang menjadi 404 |
|---|---|---|
| `FEATURES_KANA` | [Kana](kana.md#feature-flag) | `/kana/*` |
| `FEATURES_FLASHCARD` | [Flashcard](flashcard.md#feature-flag) | `/flashcard/*`; laporan kartu baru ditolak, laporan lama tetap di `/admin/report` |
| `FEATURES_BUNPOU` | [Bunpou](bunpou.md#feature-flag) | `/bunpou/*` |
| `FEATURES_BUNPOU_DISCUSSION` | [Question comments](question-comment.md#feature-flag) | `/bunpou/discussion/*`; Catatanku dan Diskusi di halaman pola tidak dirender. Ikut mati bila `FEATURES_BUNPOU` mati |
| `FEATURES_PRACTICE` | [Latihan cepat](practice.md#feature-flag) | `/exercises/*` |
| `FEATURES_TEST_PACKAGE` | [Paket tes](test-package.md#feature-flag), [Exam](exam.md#feature-flag), [Result](result.md#feature-flag) | `/test-package/*`, `/exam/*`, `/result/*` |
| `FEATURES_HISTORY` | [History](history.md#feature-flag) | `/history` |
| `FEATURES_PROGRESS` | [Progress](progress.md#feature-flag) | `/progress` |
| `FEATURES_ANALYTICS` | [Analytics](analytics.md#feature-flag) | `/analytics` |
| `FEATURES_ARTICLE` | [Article](article.md#feature-flag) | `/article/*` |
| `FEATURES_QUESTION_COMMENT` | [Question comments](question-comment.md#feature-flag) | Tidak ada route; section catatan dan action-nya dinonaktifkan |
| `FEATURES_QUESTION_DISCUSSION` | [Question comments](question-comment.md#feature-flag) | `/discussion/*`; tombol diskusi, bagikan, dan balas tidak dirender |
| `FEATURES_REPORT` | [Report](report.md#feature-flag) | `/report`; seluruh tombol "Laporkan" tidak dirender. `/admin/report` tetap hidup |
| `FEATURES_CONVERSATION` | [Conversation](conversation-speaking.md#feature-flag) | `/conversation/*`, `/api/conversation/*` |
| `FEATURES_SPEAKING` | [Speaking](conversation-speaking.md#feature-flag) | `/speaking/*` |
| `FEATURES_PUBLIC_PROFILE` | [Komunitas](community.md#feature-flag) | `/u/*`; section "Profil publik" di `/profile/privacy`, field bio/target level, banner dashboard, dan tautan nama di diskusi tidak dirender |
| `FEATURES_COMMUNITY` | [Komunitas](community.md#feature-flag) | `/community/*`, `/post/*`, `/u/*/posts`; menu Komunitas, bagian Postingan di profil, dan action postingan/like/komentar postingan tidak dirender atau ditolak. Ikut mati bila `FEATURES_PUBLIC_PROFILE` mati |
| `FEATURES_FOLLOW` | [Komunitas](community.md#feature-flag) | `/u/*/followers`, `/u/*/following`, `/profile/follow-requests`; tombol follow dan badge permintaan tidak dirender. Ikut mati bila `FEATURES_PUBLIC_PROFILE` mati |

Aturan umum:

- Route dijaga oleh `layout.tsx` di segmen modul yang memanggil `notFound()`; conversation dan
  speaking memakai guard di tiap page. `src/proxy.ts` tidak memeriksa flag.
- Menu, CTA, kartu shortcut, statistik, section analytics, sitemap, dan robots tidak dirender
  untuk modul yang mati — bukan sekadar disembunyikan dengan CSS. Rincian per halaman ada di
  [Public shell](public-shell.md#feature-flag), [Dashboard](dashboard.md#feature-flag), dan
  [Profile](profile.md#feature-flag).
- Flag tidak saling mewajibkan; halaman yang menautkan modul lain menyembunyikan link tersebut.
  Dua ketergantungan: `FEATURES_SPEAKING` ikut mati bila conversation mati, dan
  `FEATURES_QUESTION_DISCUSSION` ikut mati bila question comment mati. `FEATURES_REPORT` berdiri
  sendiri, dan mematikannya tidak ikut mematikan antrean admin-nya — lihat
  [Report](report.md#feature-flag).
- Data milik modul yang mati tidak dihapus.
- Hanya conversation, question comment, dan report yang memeriksa flag di sisi server action/API;
  action laporan juga memeriksa `FEATURES_FLASHCARD` untuk laporan kartu. Server Action modul lain
  belum dijaga, sehingga tab lama yang masih terbuka tetap dapat memanggilnya.
- Auth, dashboard, profile, dan shared utilities tidak punya flag. Admin juga tidak: aksesnya
  ditentukan role, dan mematikannya lewat env akan mengunci operator dari alat pemulihannya.

## Snapshot Data Development

Snapshot ini bersifat lokal dan dapat berubah setelah seed/import berikutnya.

| Data | Kondisi saat audit |
|---|---|
| Fixture paket tes | 50 file valid, 5.028 soal: N1 13, N2 14, N3 10, N4 8, N5 5. |
| Database paket tes | 31 paket, 3.159 soal: N2 13, N3 10, N4 8. N1 dan N5 belum diimpor. |
| Pembahasan soal | 20 dari 3.159 soal database memiliki `explanation`. |
| Media bank soal | 147 context audio, 83 question image, 1 context image, dan 0 question audio pada database aktif. |
| Flashcard | Dirombak 1 Oktober 2026. Fixture daftar kata berisi 6.697 kata, isi kartunya belum digenerate; database masih memakai tabel lama sampai migration `20261001120000_flashcard_vocab_catalog` diterapkan. |
| Artikel | 6 artikel published, 16 tag, 1 featured, dan 2 interaction row. |
| Aktivitas user | 1 user; belum ada attempt, practice session, flashcard review, atau question comment. Hanya ada 2 kana progress dan 2 article interaction, sehingga banyak halaman masih berada pada empty state saat audit. |

## Definisi Status

- **Selesai**: alur utama tersedia dan memakai data nyata/tersimpan sesuai scope sekarang.
- **Fungsional dengan gap**: alur utama bisa dipakai, tetapi masih ada keterbatasan produk, data, atau hardening yang perlu ditutup.
- **Preview saja**: hanya representasi UI/marketing; belum ada implementasi fitur end-to-end.
- **Fixture**: data statis yang disengaja sebagai content source, bukan state palsu untuk mensimulasikan hasil user.

## Catatan Verifikasi

- Test suite: 197 unit test pada 11 file (`npm run test`, vitest, 1 Oktober 2026), mayoritas flashcard — scheduler, antrean, pipeline seed (normalisasi Anki, validator isi kartu AI), pengaturan, dan statistik. Exam dan result belum punya test.
- `npm run build` lulus.
- `npm run lint` lulus dengan `--max-warnings=0` (diverifikasi ulang 26 September 2026; error `no-explicit-any` pada guest exam yang tercatat saat audit awal sudah tidak ada).
- `npm run seed:test-package:check` lulus untuk seluruh 50 fixture.
- Audit mengandalkan pembacaan kode, validasi fixture, lint, build, dan query read-only ke database development.
- Checklist manual end-to-end dan audit kebocoran answer key masih tercatat belum selesai di `docs/plan.md`.
