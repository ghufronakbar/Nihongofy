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
| `/` | Home publik neo-brutalist dengan CTA kontekstual, kana/vocab/latihan cepat/mock JLPT aktif, conversation/speaking preview, dan featured article nyata. |
| `/article` | Index artikel publik dengan featured story, pencarian, tag, kategori, dan terbit terbaru. |
| `/article/search` | Pencarian server-side berdasarkan query, kategori, multi-tag, sort, dan cursor pagination. |
| `/article/[slug]` | Detail artikel dengan body terstruktur, related article, save/favorite, dan share/copy fallback. |

### Route group `(auth)` - layout auth

| Route | Deskripsi |
|---|---|
| `/login` | Login utama memakai email. Username tetap diterima untuk akun legacy. Mendukung query `next` yang divalidasi sebagai path internal. |
| `/register` | Registrasi publik dengan display name, email, password, dan konfirmasi password. Session langsung dibuat setelah registrasi sukses. |

`/first-time-setup` sudah dihapus. URL lama diarahkan permanen ke `/register` agar bookmark lama tidak menjadi dead end.

### Auth multi-user

- Email user baru dinormalisasi ke lowercase dan dijaga unique oleh database.
- `username` nullable dan hanya menjadi compatibility bridge untuk akun legacy.
- Password di-hash dengan bcrypt cost 12.
- Login/register memiliki rate limit identifier dan IP dengan bucket hash.
- Nilai `next` hanya menerima internal relative path untuk mencegah open redirect.
- Tabel aplikasi tidak dapat diakses langsung oleh role Supabase Data API; RLS aktif sebagai defense in depth.

### Route group `(dashboard)` — layout dashboard dengan sidebar

Mencakup juga `/exam` dan `/result` (awalnya direncanakan tanpa sidebar untuk mode fokus, tapi diubah supaya user tetap bisa navigasi lewat sidebar saat mengerjakan/review).

| Route | Deskripsi |
|---|---|
| `/dashboard` | Ringkasan singkat (attempt terakhir, statistik ringkas) dan CTA ke test package. |
| `/kana/hiragana` | Grid hiragana interaktif dengan pencarian, filter grup, romaji, variasi dakuten/handakuten, TTS fallback, dan review per akun. |
| `/kana/katakana` | Grid katakana dengan flow dan persistence review yang sama seperti hiragana. |
| `/vocab` | Daftar deck vocabulary terbit beserta jumlah kartu baru dan jatuh tempo milik user. |
| `/vocab/[deckSlug]` | Browse previous/next atau review SRS `Again`, `Hard`, `Good`, `Easy`; progress dan review log disimpan ke database. |
| `/exercises` | Configurator latihan cepat berdasarkan level, section, mondai type, dan jumlah soal yang tersedia pada bank existing. |
| `/exercises/[sessionId]` | Runner satu soal per langkah dengan feedback langsung, persistence database, previous/next, restart, dan ringkasan. |
| `/analytics` | Rapor hasil belajar: tren dan kelemahan attempt `COMPLETED`, ditambah akurasi `PracticeSession.COMPLETED` pada panel terpisah tanpa proyeksi skor mock. |
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
- Konten kana memakai fixture terkurasi dengan stable key. Hanya aktivitas per-user yang disimpan di `KanaProgress`.
- Konten vocabulary disimpan dalam deck, kartu global, tag, dan join table. Satu kartu dapat muncul di beberapa deck tanpa menduplikasi `FlashcardProgress`.
- Review vocabulary memakai antrean deterministik: kartu due diurutkan berdasarkan `dueAt`, kemudian kartu baru berdasarkan urutan deck.
- Latihan cepat membuat assignment `PracticeAnswer` di awal session. Refresh melanjutkan soal pertama yang belum dijawab.
- Feedback practice hanya membuka kunci dan explanation soal yang sudah disubmit. Seluruh soal lain tetap tidak membawa answer key ke client.
- Analytics latihan cepat tampil sebagai akurasi terpisah dan tidak memakai proyeksi skor resmi/mock JLPT.
- Artikel published dicache global, sedangkan save/favorite/last-view tetap query per-session tanpa
  cache lintas user.
- Body artikel memakai JSON tervalidasi dan tidak pernah dirender sebagai HTML mentah.
- Metadata artikel mencakup canonical, Open Graph, Twitter card, generated cover, sitemap, dan robots.
- `NEXT_PUBLIC_SITE_URL` menentukan origin canonical, sitemap, dan robots dengan fallback localhost
  untuk development.
