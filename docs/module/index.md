# Dokumentasi Modul

Folder ini mendokumentasikan kondisi aplikasi berdasarkan kode, fixture, dan database development yang diperiksa pada **2 September 2026 (WIB)**. Status di sini menjelaskan implementasi aktual, bukan hanya rencana di `docs/plan.md`.

## Ringkasan Status

| Modul | Status aktual | Catatan singkat |
|---|---|---|
| [Public shell dan home](public-shell.md) | Selesai | Landing page, header/footer, dan CTA aktif; conversation/speaking masih preview statis. |
| [Authentication](auth.md) | Selesai dengan gap produk | Login, register, logout, JWT cookie, dan rate limit aktif; belum ada reset password atau verifikasi email. |
| [Dashboard](dashboard.md) | Selesai sederhana | Menampilkan attempt selesai dan attempt terakhir; kartu modul lain masih berupa shortcut statis. |
| [Kana](kana.md) | Selesai dengan scope terbatas | Fixture kana terkurasi dan progress akun aktif; audio memakai Web Speech API, bukan rekaman. |
| [Vocabulary](vocabulary.md) | Fungsional, konten terbatas | SRS dan settings aktif; database hanya memiliki 32 kartu, 6 deck, dan belum ada audio rekaman. |
| [Latihan cepat](practice.md) | Fungsional dengan gap guest | Session akun persisten dan feedback langsung aktif; guest hanya state sementara. |
| [Paket tes](test-package.md) | Fungsional, database belum selengkap fixture | Source memiliki 50 paket; database aktif baru memuat 31 paket N2-N4. |
| [Exam runner](exam.md) | Fungsional dengan hardening tersisa | State sesi dan submit aktif; belum ada timer, marker submit per sesi, dan validasi kelengkapan payload. |
| [Result](result.md) | Selesai dengan skor aproksimasi | Summary dan review aktif; skor 180 bukan scaled score resmi JLPT. |
| [History](history.md) | Selesai | Riwayat dan resume attempt akun aktif; belum mencakup latihan cepat. |
| [Analytics](analytics.md) | Selesai untuk exam/practice | Filter, tren, breakdown mondai, dan practice summary aktif; data development saat audit masih empty state. |
| [Progress dan export](progress.md) | Selesai | Tabel per attempt serta export XLSX/PDF aktif; belum ada grafik dan data development masih empty state. |
| [Profile](profile.md) | Selesai dengan gap account lifecycle | Edit akun, avatar, password, overview, dan SRS settings aktif. |
| [Article](article.md) | Selesai, dikelola lewat seed | Listing, search, detail, SEO, save/favorite, dan view aktif; belum ada CMS atau halaman koleksi tersimpan. |
| [Question comments](question-comment.md) | Selesai untuk catatan pribadi | CRUD dan lampiran Cloudinary aktif; bukan komentar publik/kolaboratif. |
| [Japanese content rendering](japanese-content-rendering.md) | Fungsional dengan gap format | Furigana, underline, slot, tabel, dan multi-passage aktif; newline dan Markdown fixture belum selalu dirender dengan benar. |
| [Shared study utilities](study.md) | Selesai sederhana | Saat ini hanya menyediakan TTS browser bersama untuk kana dan vocabulary. |
| [Conversation dan speaking](conversation-speaking.md) | Preview saja | Belum ada route, provider AI, persistence chat, microphone capture, transcription, atau feedback. |
| [Content data dan seeding](content-data.md) | Infrastruktur aktif | Import tervalidasi tersedia; source fixture dan isi database development belum sinkron penuh. |

## Snapshot Data Development

Snapshot ini bersifat lokal dan dapat berubah setelah seed/import berikutnya.

| Data | Kondisi saat audit |
|---|---|
| Fixture paket tes | 50 file valid, 5.028 soal: N1 13, N2 14, N3 10, N4 8, N5 5. |
| Database paket tes | 31 paket, 3.159 soal: N2 13, N3 10, N4 8. N1 dan N5 belum diimpor. |
| Pembahasan soal | 20 dari 3.159 soal database memiliki `explanation`. |
| Media bank soal | 147 context audio, 83 question image, 1 context image, dan 0 question audio pada database aktif. |
| Vocabulary | 32 kartu, 6 deck published, 7 tag, dan 0 `audioUrl`. |
| Artikel | 6 artikel published, 16 tag, 1 featured, dan 2 interaction row. |
| Aktivitas user | 1 user; belum ada attempt, practice session, flashcard review, atau question comment. Hanya ada 2 kana progress dan 2 article interaction, sehingga banyak halaman masih berada pada empty state saat audit. |

## Definisi Status

- **Selesai**: alur utama tersedia dan memakai data nyata/tersimpan sesuai scope sekarang.
- **Fungsional dengan gap**: alur utama bisa dipakai, tetapi masih ada keterbatasan produk, data, atau hardening yang perlu ditutup.
- **Preview saja**: hanya representasi UI/marketing; belum ada implementasi fitur end-to-end.
- **Fixture**: data statis yang disengaja sebagai content source, bukan state palsu untuk mensimulasikan hasil user.

## Catatan Verifikasi

- Tidak ada test suite aplikasi yang terdeteksi di repository.
- `npm run build` lulus pada Next.js 16.2.10.
- `npm run lint` gagal karena 2 error `no-explicit-any` pada guest exam dan menghasilkan 28 warning unused import.
- `npm run seed:test-package:check` lulus untuk seluruh 50 fixture.
- Audit mengandalkan pembacaan kode, validasi fixture, lint, build, dan query read-only ke database development.
- Checklist manual end-to-end dan audit kebocoran answer key masih tercatat belum selesai di `docs/plan.md`.
