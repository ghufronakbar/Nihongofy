# Rencana Redesign dan Ekspansi Fitur JLPT Exam

Tanggal audit: 26 Agustus 2026

## 1. Tujuan

Mengubah aplikasi dari dashboard fungsional yang masih sangat generik menjadi platform belajar JLPT yang memiliki:

- home page publik yang kuat;
- login dan registrasi user yang terbuka;
- bahasa visual dan komposisi halaman yang mengikuti `reference_ui_web` secara faithful;
- fitur kana, vocabulary, latihan cepat, artikel, profile, conversation, dan speaking;
- flow mock exam, result, review, history, progress, dan analytics lama yang tetap aman dan tidak mengalami regresi.

Dokumen ini adalah rencana implementasi. `reference_ui_web` menjadi source of truth untuk arah visual, komposisi halaman, dan baseline perilaku fitur yang belum tersedia di aplikasi utama. Aplikasi existing hanya menjadi source of truth untuk business logic, data, keamanan, dan flow yang sudah tersedia. Fitur reference yang masih mock/demo tetap diimplementasikan sebagai versi awal yang diberi label jelas, sedangkan fitur existing tidak diganti dengan mock reference.

## 2. Ringkasan audit repo saat ini

### Stack dan aturan yang harus dipertahankan

- Next.js `16.2.10`, App Router, React `19.2.4`.
- Tailwind CSS v4 dengan konfigurasi CSS-first.
- shadcn/ui versi project saat ini di `src/components/ui`.
- Prisma + PostgreSQL Supabase.
- Auth credential custom dengan `bcryptjs`, `jose`, dan cookie JWT `session`.
- Server Actions + zod untuk validasi dan mutation.
- React Context hanya untuk state client lintas komponen yang memang memerlukannya.
- Cloudinary untuk media yang perlu disimpan.
- Struktur feature-driven di `src/features`.

Tidak boleh mengganti auth menjadi Supabase Auth/Auth.js, mengganti Prisma, atau membawa state library baru tanpa persetujuan terpisah. Aturan project yang masih menyebut aplikasi sebagai single-user harus diperbarui karena keputusan produk berubah menjadi registrasi multi-user.

### Fitur existing yang sudah kuat

- Login, logout, session, dan route protection.
- Daftar paket JLPT dan detail paket.
- Mock test penuh dan latihan per seksi.
- Exam state yang tahan refresh dengan `sessionStorage`.
- Proteksi kebocoran kunci jawaban saat exam.
- Result summary, review jawaban, furigana, catatan per soal, dan upload gambar.
- History, resume attempt, analytics, progress per attempt, filter, dan export.
- Parser konten Jepang, dokkai, tabel, audio, gambar, dan scoring projection.

Bagian tersebut harus menjadi source of truth. Flow exam sederhana dari referensi tidak boleh menggantikan implementasi existing.

### Masalah utama UI existing

- `/` hanya menjadi redirect; belum ada landing/home page.
- Login masih berupa card kecil di tengah layar dan halaman register belum tersedia.
- Root memakai Geist dan token shadcn neutral default; belum ada visual identity yang khas.
- Dashboard didominasi card putih, border abu-abu, heading kecil, dan grid simetris.
- Sidebar sangat utilitarian dan belum mengelompokkan area belajar, ujian, insight, dan akun.
- Belum ada marketing header/footer, mobile navigation, custom 404, route error UI, dan loading skeleton per area.
- Metadata baru global; halaman publik belum memiliki metadata/OG yang spesifik.
- Empty state tersedia secara sporadis, tetapi belum menjadi pola visual yang konsisten.

## 3. Audit `reference_ui_web`

### Bahasa visual yang akan diikuti

- Neo-brutalist: outline gelap, offset shadow, permukaan flat, dan bentuk geometris.
- Display type berukuran besar, kontras tinggi, dan hirarki yang lebih berani.
- Kombinasi nuansa belajar Jepang dengan karakter yang playful.
- Section landing yang jelas: hero, filosofi, feature overview, spotlight fitur, artikel, dan CTA.
- Feedback interaksi yang terasa fisik melalui translate dan perubahan shadow.
- Flashcard flip, progress indicator, character state, dan komposisi editorial yang tidak terasa seperti dashboard SaaS generik.

### Fitur yang terdapat di referensi

| Area referensi | Status di aplikasi utama | Keputusan |
|---|---|---|
| Home/landing | Belum ada | Implementasi baru |
| Login/register | Login ada, register belum ada | Implementasi register publik dan redesign mengikuti referensi |
| Kana hiragana/katakana | Belum ada | Implementasi baru |
| Vocabulary packs + flashcard | Belum ada | Implementasi baru |
| Practice exercises + feedback langsung | Existing hanya section practice gaya exam | Implementasi mode latihan cepat terpisah, reuse bank soal |
| Mock exam | Sudah ada dan lebih lengkap | Redesign existing, jangan duplikasi engine referensi |
| Articles, detail, search | Belum ada | Implementasi baru |
| Conversation partner | Belum ada; referensi masih simulasi | Implementasi mock reference lebih dahulu, lalu siapkan provider boundary |
| Speaking partner | Belum ada; referensi masih simulasi | Implementasi mock reference lebih dahulu dengan capability-aware fallback |
| Profile overview | Sebagian ada di dashboard | Tambah profile/account, dashboard tetap pusat aktivitas |
| Profile analytics | Sudah ada dan lebih valid | Redesign existing; jangan gunakan random data referensi |
| Password settings | Belum ada | Implementasi baru |
| Flashcard/SRS settings | Belum ada | Implementasi baru setelah SRS foundation |

### Bagian referensi yang tidak boleh disalin mentah

- Auth referensi memakai context/localStorage dan bukan auth produksi.
- Exam referensi memakai mock data/localStorage serta lebih lemah dari engine existing.
- Conversation dan speaking hanya memakai `setTimeout`, response acak, dan simulasi recording.
- Analytics profile menghasilkan angka dengan `Math.random()`.
- Settings profile hanya disimpan di localStorage.
- Mobile menu masih placeholder.
- Footer memiliki link `#` yang mati.
- Banyak media memakai `<img>` remote tanpa optimasi dan tanpa ownership asset.
- Artikel merender HTML mentah dengan `dangerouslySetInnerHTML` tanpa boundary sanitasi yang jelas.
- Source referensi memiliki beberapa duplikasi JSX/prop dan tidak layak dipindah file-per-file.
- Copywriting bercampur Inggris serta klaim "AI-powered", "community", dan "free" yang belum didukung fitur/data production.

## 4. Keputusan produk dan arsitektur

### Prinsip implementasi

1. Pertahankan engine existing, lalu bangun UI dan fitur baru di sekelilingnya.
2. Kerjakan foundation dan fitur yang belum ada sebelum melakukan polish mendalam pada seluruh halaman lama.
3. Jangan copy `reference_ui_web/src/components/ui`; gunakan komponen shadcn yang sudah ada di project utama.
4. Jangan mengganti auth atau exam engine existing dengan `AuthContext`, `ExamContext`, atau mock reference.
5. Gunakan Server Component sebagai default; Client Component hanya untuk flip card, input interaktif, media/speech, optimistic state, atau chart.
6. Semua mutation tetap melalui Server Action, divalidasi zod, dan memverifikasi session di action.
7. Semua query Prisma memakai explicit `select`, caching yang sesuai, dan cache key/tag terpusat.
8. UI utama memakai Bahasa Indonesia dengan label Jepang bila membantu belajar; jangan mencampur copy Inggris tanpa alasan.
9. Ikuti API Next.js 16 dari dokumentasi lokal, termasuk `proxy.ts`, async `params`/`searchParams`, Metadata API, dan boundary Server/Client Component.
10. Audit ulang seluruh asumsi single-user. Setiap data pribadi wajib difilter berdasarkan `session.userId`, termasuk comment, progress, history, settings, conversation, dan interaction.
11. Untuk fitur yang benar-benar belum ada, mock/data/interaction dari reference boleh menjadi implementasi awal agar route dan pengalaman pengguna segera tersedia. Pisahkan fixture mock dari data production, beri label `Demo`/`Preview`, dan jangan membuat klaim bahwa simulasi tersebut sudah memakai AI, persistence, atau analytics nyata.
12. Untuk fitur yang sudah tersedia, termasuk mock test JLPT, history, result, review, progress, dan analytics, reference hanya memandu UI/UX. Kemampuan existing dipetakan ke komposisi reference tanpa menurunkan fungsi, keamanan, atau kualitas data.

### Identitas produk

Nama kerja tetap `JLPT Exam`. Nama `Tanoshii Japanese` dari referensi tidak diadopsi otomatis karena itu merupakan perubahan brand, bukan sekadar redesign.

Brand dapat memakai lockup sementara:

- `JLPT Exam` sebagai nama utama;
- `日本語試験室` sebagai aksen sekunder;
- bentuk stempel/label level sebagai motif visual.

Perubahan nama final harus menjadi keputusan terpisah sebelum implementasi aset logo dan metadata final.

### Akses route

Public:

- `/` home page;
- `/login`;
- `/register`;
- `/article`;
- `/article/[slug]`;
- `/article/search`.

Protected:

- seluruh route dashboard dan exam existing;
- `/kana/hiragana` dan `/kana/katakana`;
- `/vocab` dan `/vocab/[deckSlug]`;
- `/exercises` dan `/exercises/[sessionId]`;
- `/conversation`, `/conversation/setup`, dan session turunannya;
- `/speaking`, `/speaking/setup`, dan session turunannya;
- `/profile`, `/profile/security`, dan `/profile/flashcards`.

Jika user membuka route protected saat belum login, `src/proxy.ts` mengarahkan ke `/login?next=<path>`. Nilai `next` wajib divalidasi sebagai internal relative path untuk mencegah open redirect.

### Route group Next.js 16

Target struktur:

```text
src/app/
  (marketing)/
    layout.tsx
    page.tsx
    article/
  (auth)/
    layout.tsx
    login/
    register/
  (dashboard)/
    layout.tsx
    dashboard/
    kana/
    vocab/
    exercises/
    conversation/
    speaking/
    profile/
    ...route existing
```

`src/app/(auth)/page.tsx` yang saat ini memegang redirect `/` dan route `/first-time-setup` dihapus setelah `src/app/(marketing)/page.tsx` menjadi canonical home. `registerAction` tidak lagi memakai `count(User) === 0`; database unique constraint menjadi proteksi terakhir terhadap duplicate normalized email.

Root layout tidak memuat navbar/footer global agar mode dashboard/exam tidak ikut terbungkus marketing shell. Header dan footer publik berada di `(marketing)/layout.tsx`.

### Di luar scope awal

- Role/admin system dan permission bertingkat.
- OAuth/Google connect.
- CMS artikel lengkap.
- Klaim kompatibilitas penuh dengan algoritma Anki.
- Penyimpanan rekaman suara mentah.
- Community feed, komentar publik, follower, atau social metrics palsu.
- Penggantian engine exam, scoring, atau parser soal existing.

## 5. Arah design system

### Visual direction

Implementasi harus terlihat sebagai kelanjutan langsung dari `reference_ui_web`, bukan restyle dari dashboard existing. Elemen utama referensi dipertahankan secara faithful:

- background biru sangat muda dan surface putih;
- outline hitam tebal;
- hard offset shadow hitam;
- primary cobalt `#5294FF`;
- feature accent coral `#FF4D50`, yellow `#FACC00`, dan green `#05E17A`;
- card bersudut kecil, button tactile, label level berbentuk block;
- heading besar, berat, dan kontras;
- section landing berupa color block dengan ilustrasi/character preview;
- layout neo-brutalist yang playful dan sengaja tidak terasa seperti dashboard SaaS netral.

Perubahan terhadap referensi hanya dilakukan untuk responsiveness, accessibility, konsistensi token, kualitas copy, real data, dan state production. Karakter visualnya tidak dinetralkan kembali mengikuti UI existing.

### Typography

- Geist/Geist Mono dari referensi dapat dipertahankan untuk Latin/UI, tetapi scale, weight, dan tracking mengikuti reference secara lebih berani.
- Tambahkan fallback/font Jepang yang jelas seperti Noto Sans JP bila hasil uji glyph Geist fallback tidak konsisten.
- Angka skor memakai tabular figures.
- Heading besar memakai tracking negatif dan `text-wrap: balance`.
- Body text dibatasi sekitar 60-70 karakter per baris.
- Font dimuat melalui `next/font`, bukan runtime CDN.

Konfigurasi font final harus diuji pada teks Indonesia, romaji, kana, kanji, ruby/furigana, tabel, dan angka analytics sebelum diterapkan global.

### Motion dan states

- Button/card hover: translate maksimum 2px dan shadow shift.
- Active/pressed: kembali mendekati permukaan, bukan scale berlebihan.
- Page/section reveal digunakan terbatas pada marketing page.
- Flashcard memakai 3D flip dengan keyboard equivalent.
- Hormati `prefers-reduced-motion`.
- Semua control memiliki focus ring yang terlihat.
- Loading memakai skeleton yang meniru bentuk content.
- Empty/error/success state memakai copy langsung, tanpa `alert()` browser.

### Komponen shared yang direncanakan

- `BrandMark`
- `PublicHeader`
- `PublicMobileNav`
- `PublicFooter`
- `PageHero`
- `SectionHeading`
- `BrutalistCard`/variant pada `Card`
- `StatBlock`
- `LevelBadge`
- `FeatureLink`
- `EmptyStatePanel`
- `InlineNotice`
- `ShareButton`
- `AudioButton`
- `StudyProgressBar`

Komponen primitive tetap berasal dari `src/components/ui`. Feature-specific component tetap colocated di `src/features/<feature>/components`.

## 6. Rancangan data

Semua perubahan berikut harus ditinjau lagi terhadap query aktual sebelum migration dibuat. Project memakai Prisma migrations; jangan menulis migration SQL terpisah dari perubahan `prisma/schema.prisma`.

### Profile dan preference

Target auth mengikuti pola referensi: register dengan nama, email, password, dan konfirmasi password; login dengan email dan password.

Perluasan `User`:

- `displayName String`
- `email String @unique`
- `avatarUrl String?`
- `username` dipertahankan sementara untuk kompatibilitas data/komentar existing, lalu diputuskan apakah menjadi public handle atau dihapus pada migration lanjutan.

Email dinormalisasi ke lowercase sebelum disimpan/dicari. Password tetap disimpan sebagai bcrypt hash dengan cost factor existing.

Migration user existing harus dua tahap agar data attempt/comment tidak hilang:

1. Tambah `displayName` dan `email` sebagai nullable.
2. Isi email akun existing melalui migration/backfill yang eksplisit.
3. Ubah login menjadi email setelah seluruh user existing memiliki email.
4. Baru jadikan field required pada migration berikutnya.

Jangan menebak email untuk akun existing dan jangan menghapus row `User` karena seluruh attempt/comment bergantung padanya.

Model `UserPreference` satu-ke-satu:

- `userId` unique dan indexed;
- preferred JLPT level;
- default romaji visibility;
- TTS/autoplay preference;
- daily study target;
- timezone/locale bila dibutuhkan untuk streak dan due card;
- timestamps.

### Flashcard, vocabulary, dan SRS

Model utama:

- `FlashcardDeck`: slug, title, description, kind, JLPT level, publish state, order.
- `Flashcard`: deck, stable key, front text, reading, romaji, meaning, audio text/url, detail/examples, order.
- `FlashcardTag` dan explicit join table untuk filter deck/tag.
- `FlashcardProgress`: owner, card, due date, interval, ease, repetitions, lapses, state, last review.
- `FlashcardReviewLog`: history rating untuk analytics dan debugging scheduler.
- `FlashcardSetting`: limits dan parameter SRS yang benar-benar dipakai oleh scheduler.

Constraint/index minimum:

- unique `FlashcardDeck.slug`;
- unique `(deckId, key)`;
- unique `(userId, flashcardId)` pada progress;
- index `(userId, dueAt)` untuk review queue;
- index semua foreign key;
- composite index mengikuti filter list/deck yang benar-benar digunakan.

Jangan menyimpan progress utama hanya di localStorage. localStorage hanya boleh menjadi cache UI sementara; database adalah source of truth.

### Latihan cepat

Mode latihan cepat tidak digabung secara paksa dengan semantics `Attempt` existing karena:

- exam tidak boleh menerima answer/explanation sebelum submit;
- latihan cepat harus memberi feedback segera;
- aturan completion dan analytics berbeda.

Tambahkan:

- `PracticeSession`: owner, filter level/section/mondai, status, started/finished timestamp.
- `PracticeAnswer`: session, question, selected answer, correctness, answered timestamp.

Soal tetap memakai model `Question` existing. Tidak ada duplikasi bank soal.

Constraint/index minimum:

- unique `(practiceSessionId, questionId)`;
- index `PracticeSession(userId, startedAt)`;
- index `PracticeAnswer(questionId)` dan seluruh foreign key.

### Artikel

Model:

- `Article`: slug, title, excerpt, body, cover image, author snapshot, category, status, publish time, dan read time.
- `ArticleTag` + explicit join table.
- `ArticleInteraction`: per-user saved/favorited/last viewed state.

Body artikel tidak boleh dirender sebagai HTML bebas tanpa sanitasi. Pilih salah satu strategi sebelum implementasi:

1. Markdown dengan renderer server-side dan allowlist; atau
2. HTML yang disanitasi saat write/import dan dianggap immutable saat read.

Untuk MVP, artikel di-seed dari content yang sudah direview. CMS/editor tidak termasuk fase awal.

### Conversation dan speaking

Model:

- `ConversationPersona`: metadata karakter, voice/personality, media URL, publish state.
- `ConversationSession`: owner, mode `TEXT`/`VOICE`, persona, difficulty, topic settings, timestamps.
- `ConversationMessage`: session, role, Japanese content, optional romaji/translation, timestamps.

Text dan voice memakai session/message model yang sama. Speaking bukan sistem data terpisah.

### Supabase security note

Project menggunakan custom JWT app dengan numeric `User.id`, bukan Supabase Auth UUID. Karena itu:

- jangan membuat policy `auth.uid() = userId` yang tidak cocok dengan model identitas saat ini;
- semua akses aplikasi tetap melalui Prisma server-side dan Server Actions;
- audit apakah schema `public` terekspos ke Data API;
- jika terekspos, revoke akses `anon`/`authenticated` untuk tabel aplikasi atau tetapkan strategi RLS yang benar sebelum menambah tabel;
- jangan mengandalkan RLS sebagai pengganti ownership check di action;
- migration harus menambahkan index foreign key yang tidak dibuat otomatis oleh PostgreSQL.

### Multi-user data isolation audit

Public register tidak boleh diaktifkan sebelum audit ini selesai:

- semua `Attempt`, `AttemptAnswer`, analytics, progress, history, settings, interaction, dan conversation wajib berawal dari `session.userId`;
- `QuestionComment` bersifat private per user kecuali nanti ada keputusan membuat community comment;
- `getTestPackageQuestions` saat ini tidak boleh membawa comment semua user dalam cache global;
- pisahkan question bank yang aman di-cache global dari comment user yang harus diambil per-session dan tidak boleh masuk cache lintas user;
- cache user-specific wajib memakai user id pada key/tag atau menerima user id sebagai argumen cache yang benar;
- mutation edit/delete selalu memverifikasi row owner, bukan hanya keberadaan session;
- tambahkan test dua user: user B tidak dapat membaca/mengubah attempt, comment, settings, practice, bookmark, atau conversation user A.

## 7. Fase implementasi

### Fase 0 - Baseline dan guardrail

Tujuan: mendapatkan baseline yang dapat dipercaya sebelum perubahan besar.

Status eksekusi: baseline source selesai pada 26 Agustus 2026. Detail hasil, perbaikan guardrail,
dan release blocker Supabase tersedia di `plan/phase-0-baseline.md`.

Pekerjaan:

- Catat `git status` dan jangan menyentuh perubahan user yang tidak terkait.
- Jalankan `npm run lint`, `npx tsc --noEmit`, dan `npm run build`.
- Catat baseline warning/error existing secara eksplisit.
- Verifikasi flow auth, package, exam, result, history, progress, dan analytics minimal dengan smoke test.
- Audit `src/proxy.ts`, env validation, cache key, dan seluruh query yang mengirim data exam.
- Selesaikan multi-user data isolation audit, terutama comment yang saat ini ikut global question cache.
- Tambah skenario uji dengan dua user sebelum public register diaktifkan.
- Audit endpoint seed yang saat ini public; batasi ke development atau proteksi dengan secret sebelum public launch.
- Sebelum migration Supabase/Postgres, cek changelog dan dokumentasi Supabase terbaru yang relevan.
- Buat screenshot baseline desktop/mobile untuk halaman utama existing jika browser automation tersedia.

Acceptance criteria:

- Baseline failure diketahui dan tidak salah dianggap regresi redesign.
- Tidak ada mutation atau migration pada fase ini.
- Tidak ditemukan payload/cache yang dapat memperlihatkan data private user A kepada user B.

### Fase 1 - Route architecture dan design foundation

Tujuan: menyediakan shell yang bisa dipakai fitur baru tanpa langsung merombak engine existing.

Status eksekusi: selesai pada 26 Agustus 2026. Implementasi dan hasil verifikasi tersedia di
`plan/phase-1-foundation.md`. Public registration mutation tetap ditahan sampai Fase 2 karena
membutuhkan migrasi akun existing dan penutupan exposure Supabase Data API.

Pekerjaan:

- Tambah route group `(marketing)` dan ubah `/` menjadi home publik.
- Hapus redirect-only root page lama setelah semua guard dipindah dengan aman.
- Update public route rules di `src/proxy.ts`.
- Hapus route `/first-time-setup` dan seluruh logic registration lock.
- Tambah route `/register` sebagai public route.
- Tambah safe `next` redirect pada login.
- Definisikan token warna, border, shadow, radius, typography, dan motion di `src/app/globals.css`.
- Update root font via `next/font` setelah uji glyph Jepang.
- Tambah marketing header, mobile Sheet navigation, footer, skip link, dan active state.
- Tambah shared page container dan section primitives.
- Set document language ke Indonesia dan beri `lang="ja"` pada content Jepang yang memerlukannya.
- Pertahankan shadcn CSS variables agar component existing tidak pecah.

Acceptance criteria:

- `/` dapat dibuka tanpa session.
- Dashboard/exam tidak mendapat header/footer marketing.
- Protected route tetap tidak dapat dibuka tanpa session.
- Keyboard focus, mobile menu, dan reduced-motion bekerja.

### Fase 2 - Home, login, dan register

Status: selesai pada 26 Agustus 2026. Detail implementasi dan verifikasi ada di
`plan/phase-2-home-auth.md`.

Tujuan: memberi entry point dan identitas produk yang jelas.

Home mengikuti narasi referensi, tetapi copy dan claim disesuaikan dengan fitur nyata:

1. Hero dengan CTA kontekstual: register, login, lanjut ke dashboard, atau mulai belajar.
2. Penjelasan pendek tentang mock test berbasis soal JLPT.
3. Feature overview: kana, vocab, latihan cepat, mock exam.
4. Spotlight conversation dan speaking dengan status jujur jika masih preview.
5. Slot featured article yang empty-safe dan baru diaktifkan setelah article seed tersedia pada Fase 5.
6. CTA akhir menuju learning dashboard.

Login/register:

- Ikuti komposisi auth pada referensi: panel branding, tombol kembali ke home, card/form neo-brutalist, link silang login-register, dan feedback inline.
- Refactor `LoginForm`, `RegisterForm`, RHF, zod, dan Server Actions existing untuk model multi-user.
- Register meminta display name, email, password, dan konfirmasi password.
- Login memakai email dan password.
- Tambah show/hide password, loading state, inline error, dan link kembali ke home.
- `registerAction` tidak melakukan `count(User)` dan selalu mengizinkan user baru selama email belum terdaftar.
- Normalisasi email, gunakan unique constraint, dan tangani race duplicate registration tanpa membocorkan detail sensitif.
- Tambah rate limit untuk register/login; siapkan email verification sebagai fase lanjutan jika layanan email belum dipilih.
- Session dibuat setelah register sukses, lalu redirect ke `next` yang valid atau `/dashboard`; tidak ada first-time setup atau onboarding wajib.
- Update `docs/project-rules.md`, `docs/project-overview.md`, dan dokumentasi auth agar tidak lagi menyebut single-user/one-time setup.

Acceptance criteria:

- Home tidak mengklaim fitur production yang belum aktif.
- CTA menyesuaikan session state.
- Login sukses kembali ke `next` yang valid atau `/dashboard`.
- Pesan invalid credential tetap generik.
- Dua atau lebih user dapat register dan seluruh datanya terisolasi.

### Fase 3 - Kana dan vocabulary foundation

Tujuan: mengimplementasikan fitur baru yang paling mandiri lebih dahulu.

Kana:

- Route hiragana dan katakana.
- Grid responsive, search/filter group, keyboard-operable flip, romaji, variation, dan TTS.
- TTS memakai Web Speech API dengan capability check dan fallback pesan yang jelas.
- Track card yang sudah dilihat/dinilai jika user memilih review mode.

Vocabulary:

- Deck/tag list dengan JLPT level dan due/new count.
- Study screen dengan front/back, reading, romaji, meaning, usage example, dan audio.
- Navigation previous/next untuk browse mode.
- SRS review mode dengan rating `Again`, `Hard`, `Good`, `Easy`.
- Progress dan review log disimpan ke database.

Content dan staging:

- Implementasi parity awal boleh memakai fixture kana/vocabulary dari reference yang dipindahkan ke boundary feature secara eksplisit.
- Tandai progress/SRS sebagai demo selama masih memakai state lokal atau fixture; jangan menampilkannya sebagai progress akun yang persisten.
- Setelah schema dan scheduler siap, seed data yang sudah dinormalisasi dan direview lalu pindahkan progress ke database tanpa mengubah flow UI.
- Semua seed idempotent dan memiliki stable key/slug.

Acceptance criteria:

- Refresh tidak menghilangkan progress database.
- Review queue berdasarkan due date stabil.
- TTS failure tidak memblokir belajar.
- Empty deck dan completed queue memiliki state yang dirancang.

### Fase 4 - Latihan cepat dengan feedback langsung

Tujuan: menambah pengalaman exercise referensi tanpa merusak exam security model.

Pekerjaan:

- `/exercises` menampilkan pilihan level, section, mondai type, dan jumlah soal.
- Start action membuat `PracticeSession` dan memilih soal dari bank existing.
- `/exercises/[sessionId]` menampilkan satu soal per langkah.
- Setelah submit satu jawaban, server mengembalikan correctness dan explanation hanya untuk soal itu.
- Tampilkan progress, skor sementara, previous/next, restart, dan completion summary.
- Listening memakai player existing, bukan hanya browser TTS jika question audio tersedia.
- Practice answer ikut ke analytics belajar, tetapi tidak bercampur dengan skor mock JLPT.

Security rule:

- Action feedback memverifikasi owner/session/question.
- Jangan mengirim answer key seluruh session ke client.

Acceptance criteria:

- Feedback langsung bekerja tanpa membocorkan soal lain.
- Session dapat dilanjutkan setelah refresh.
- Result practice terpisah jelas dari official/mock score projection.

### Fase 5 - Artikel publik

Tujuan: mengimplementasikan content area dari referensi dan mengisi home dengan content nyata.

Pekerjaan:

- Article index: featured story, category, tag, search CTA, dan list terbaru.
- Search page: query, category, tags, sort, empty state, dan URL search params.
- Detail page: cover, metadata, body, related article, save/favorite, dan native share/copy fallback.
- Gunakan `next/image`; pindahkan media ke Cloudinary/public asset yang dimiliki project.
- Jika Cloudinary tetap dipakai secara remote, batasi domain/path melalui `images.remotePatterns`.
- Tambah metadata per slug, canonical URL, OG image strategy, sitemap, dan robots.
- Search/filter dilakukan server-side; gunakan pagination/cursor jika jumlah content membesar.
- Cache public article list/detail dengan centralized tags dan invalidation.

Acceptance criteria:

- Tidak ada unsanitized HTML injection.
- Tidak ada dead link dan `window.alert()`.
- Share fallback menggunakan toast/inline notice.
- Page tetap berguna saat tidak ada artikel featured.

### Fase 6 - Profile, security, dan flashcard settings

Tujuan: mengganti profile mock referensi menjadi akun dan preferensi nyata.

Profile:

- Display name, email, avatar, serta username read-only atau rename dengan validasi khusus.
- Overview singkat aktivitas nyata, bukan angka hardcoded.

Security:

- Change password meminta current password.
- New password memakai zod policy dan bcrypt cost existing.
- Setelah password diganti, rotasi/recreate session.
- Tidak menambahkan Google connect dari referensi karena auth OAuth tidak ada dalam arsitektur.

Flashcard settings:

- Simpan parameter yang benar-benar dipakai scheduler.
- Validasi range numerik dan format learning/lapse steps.
- Reset default melalui Server Action.
- Hindari UI 15 field sekaligus pada mobile; gunakan group progressive disclosure.

Acceptance criteria:

- Semua data tersimpan di database, bukan localStorage-only.
- Password lama yang salah tidak membocorkan detail akun.
- Settings invalid tidak dapat masuk ke scheduler.

### Fase 7 - Conversation partner

Tujuan: mengimplementasikan feature UI dan data flow tanpa berpura-pura bahwa response acak adalah AI production.

Pekerjaan:

- Persona browser dan setup: character, difficulty, topic, romaji, dan voice setting.
- Persona memakai asset lokal/Cloudinary yang dimiliki project; jangan hotlink avatar DiceBear/Unsplash dari referensi.
- Start action membuat `ConversationSession`.
- Chat UI memiliki message history, loading state, reset/new session, keyboard submit, dan TTS.
- Buat server-side `ConversationProvider` interface.
- Implementasi awal mengikuti interaction mock reference dan wajib diberi label `Demo`, bukan `AI`.
- Provider AI production baru ditambahkan setelah provider, model, biaya, rate limit, moderation, dan secret env disetujui.
- Simpan transcript untuk user yang login; beri action untuk menghapus session.

Acceptance criteria:

- Tidak ada API key di client.
- Response provider hanya dipanggil dari server.
- Demo mode jelas; response simulasi tidak ditampilkan sebagai respons AI atau data production.
- UI tetap berfungsi jika TTS tidak tersedia.

### Fase 8 - Speaking practice

Tujuan: reuse conversation foundation untuk mode suara yang benar-benar capability-aware.

Pekerjaan:

- Setup persona, difficulty, mic permission, voice output, dan transcript visibility.
- Capability check untuk `SpeechRecognition`/vendor-prefixed implementation.
- Jika browser tidak mendukung speech recognition, sediakan typed transcript fallback.
- Gunakan `speechSynthesis` untuk response voice jika tersedia.
- Character state: idle, listening, processing, talking, success/error.
- Jangan upload audio mentah secara default; simpan transcript saja untuk privasi.
- Jika nanti memakai speech API eksternal, tambahkan consent, retention policy, size/type limit, dan server-side upload flow.

Acceptance criteria:

- Permission denied dan unsupported browser memiliki recovery path.
- Simulasi recording/transcript dari reference hanya boleh hadir dalam mode `Demo` dan tidak boleh dianggap rekaman atau transkripsi nyata.
- Session voice dan text memakai ownership/security yang sama.

### Fase 9 - Redesign dashboard dan seluruh core exam flow

Tujuan: membawa halaman existing ke design system baru setelah fitur baru memiliki foundation stabil.

Dashboard:

- Welcome header, current level context, continue attempt, latest score, review due, quick actions, dan recent activity.
- Hindari grid stat card yang semuanya sama besar.

Sidebar:

- Group `Belajar`: Kana, Vocabulary, Exercises.
- Group `Ujian`: Paket Tes, History.
- Group `Insight`: Progress, Analytics.
- Group `Eksperimen`: Conversation, Speaking.
- Footer account: Profile, Security, Logout.
- Mobile menggunakan existing sidebar behavior yang sudah responsif, lalu di-restyle.

Test package/exam/result:

- Redesign list package, detail, question browser, exam runner, result, dan review.
- Pertahankan seluruh select/query/action existing.
- Exam UI lebih fokus: progress strip, question surface, answer state, flag, nav, dan submit confirmation.
- Jangan menambahkan timer otomatis karena keputusan produk existing adalah timer manual.
- Result memakai score hierarchy yang lebih kuat tanpa mengubah formula.
- Progress/analytics memperbaiki scanability tabel/chart, bukan mengganti data dengan chart mock referensi.

Acceptance criteria:

- Full mock dan section practice tetap menghasilkan data yang sama sebelum/sesudah redesign.
- Tidak ada answer/explanation leak pada exam payload.
- Long Japanese text, audio, image, table, furigana, dan mobile navigation tetap bekerja.

### Fase 10 - Reliability, accessibility, dan release QA

Pekerjaan:

- Tambah `loading.tsx`, `error.tsx`, `not-found.tsx`, dan `global-error.tsx` yang relevan.
- Tambah skeleton, empty state, offline/network error copy, dan retry action.
- Audit semantic HTML, label, heading order, alt text, color contrast, focus order, dan screen reader status.
- Audit mobile pada 360px/390px, laptop kecil, desktop, dan tabel lebar.
- Audit `prefers-reduced-motion`.
- Audit image dimensions, `next/image`, font loading, bundle/client boundaries, dan Core Web Vitals.
- Tambah privacy notice dan terms yang sesuai sebelum transcript atau audio dikirim ke provider eksternal.
- Jalankan Prisma migration verification dan cek index foreign key.
- Audit Supabase Data API exposure/grants untuk tabel baru.
- Jalankan lint, typecheck, build, dan manual end-to-end.

End-to-end minimum:

1. Fresh database -> register user A -> logout -> login.
2. Register user B -> verifikasi attempt/comment/progress/settings user A tidak terlihat.
3. Kana browse/TTS -> vocabulary review -> due progress persist.
4. Start practice -> answer -> feedback -> finish -> analytics update.
5. Start full mock -> session submit -> result -> review/comment.
6. Article search -> detail -> bookmark/share.
7. Update profile -> change password -> login ulang.
8. Conversation demo/provider -> history persist/delete.
9. Speaking unsupported/permission denied/success paths.

## 8. Urutan delivery yang direkomendasikan

| Milestone | Isi | Prioritas |
|---|---|---|
| M1 | Fase 0-2: baseline, foundation, home, auth redesign | P0 |
| M2 | Fase 3-4: kana, vocab, SRS, latihan cepat | P0 |
| M3 | Fase 5-6: article, profile, security, settings | P1 |
| M4 | Fase 7-8: conversation dan speaking | P1/P2, bergantung provider/capability |
| M5 | Fase 9: redesign seluruh core dashboard/exam | P0 setelah feature foundation stabil |
| M6 | Fase 10: QA, accessibility, performance, release | P0 |

Alasan core exam redesign ditempatkan setelah beberapa fitur baru: foundation visual harus stabil lebih dulu, sedangkan engine exam existing adalah bagian paling berisiko mengalami regresi. Shell, home, dan feature baru dapat memvalidasi design system sebelum diterapkan ke flow ujian.

## 9. Dependency gate

Sebelum menambah package baru:

- cek apakah kebutuhan sudah dapat dipenuhi oleh dependency existing;
- cek kompatibilitas React 19/Next 16;
- pin version dan commit lockfile;
- dokumentasikan alasan dan bundle impact.

Kemungkinan dependency yang memerlukan persetujuan/review:

- sanitizer/Markdown renderer untuk artikel;
- test runner/e2e browser jika belum tersedia;
- AI SDK/provider untuk conversation;
- speech-to-text SDK eksternal jika Web Speech API tidak cukup.

Tidak diperlukan library baru untuk motion dasar, flip card, navbar, form, chart existing, atau TTS browser.

## 10. Definition of done

Satu fase baru dianggap selesai hanya jika:

- UI desktop dan mobile sudah diverifikasi secara visual;
- loading, empty, error, success, disabled, hover, active, dan focus state tersedia;
- Server Action memverifikasi session, ownership, dan input zod;
- query tidak mengambil field sensitif yang tidak diperlukan;
- cache key/tag dan invalidation benar;
- data tidak bergantung pada mock/random/localStorage kecuali explicitly labeled demo/cache;
- migration dapat dijalankan pada database baru dan database existing;
- index foreign key/filter utama tersedia;
- `npm run lint`, `npx tsc --noEmit`, dan `npm run build` lolos atau kembali ke baseline yang sudah dicatat;
- flow existing yang bersinggungan sudah diuji ulang;
- isolation test dengan minimal dua user lolos;
- dokumentasi route, schema, env, dan keputusan produk diperbarui.

## 11. Keputusan yang masih perlu dikunci sebelum fase terkait

Keputusan ini tidak menghalangi M1-M3, tetapi harus diputuskan sebelum M4 atau release final:

1. Nama brand final: tetap `JLPT Exam` atau rename.
2. Conversation production memakai provider/model apa, budget berapa, dan apakah transcript boleh dikirim ke provider eksternal.
3. Speaking cukup memakai Web Speech API atau memerlukan STT eksternal lintas browser.
4. Artikel dikelola lewat seed/import saja atau perlu CMS/admin editor pada fase berikutnya.
5. Tool belajar selain article tetap protected, atau sebagian akan dijadikan public preview.
6. Email verification/password reset memakai provider email apa dan kapan diaktifkan.

Default aman sampai ada keputusan baru:

- brand tetap `JLPT Exam`;
- conversation memakai provider demo yang jelas;
- speaking memakai browser capability + typed fallback;
- artikel memakai reviewed seed content;
- seluruh tool belajar tetap protected;
- public register aktif, sedangkan email verification/password reset ditambahkan setelah provider email dipilih.
