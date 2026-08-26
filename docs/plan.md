# Development Plan — JLPT Exam Platform

Rujukan: `project-overview.md` (routes & flow), `project-rules.md` (arsitektur/konvensi), `database.md` (schema & aturan data).

Checklist ini dikerjakan berurutan per fase (fase belakang bergantung pada fase depan). Centang `[x]` saat selesai & terverifikasi (bukan sekadar ditulis).

> Catatan 26 Agustus 2026: bagian auth awal di bawah adalah catatan implementasi historis. Model one-time setup telah dihentikan. Status dan rencana aktif ada di `plan/redesign-and-feature.md` serta `plan/phase-1-foundation.md`.

## Fase 0 — Setup & Konfigurasi Dasar

- [x] Init Next.js (App Router) — `create-next-app`
- [x] Setup Tailwind v4 + shadcn/ui (`components.json`, komponen dasar sudah ter-generate di `src/components/ui`)
- [x] Prisma schema awal lengkap (`User`, `TestPackage`, `TestPackageItem`, `QuestionContext`, `Question`, `QuestionChoice`, `QuestionComment`, `Attempt`, `AttemptAnswer`)
- [x] Migration awal dijalankan (`prisma/migrations/20260714151325`, `20260714154804`)
- [x] Install dependency inti: `bcryptjs`, `@types/bcryptjs`, `jose`, `zod`, `react-hook-form`, `@hookform/resolvers`
- [x] Tambah `SESSION_SECRET` ke `.env` (dan `.env.example`)
- [x] Kredensial Cloudinary sudah ada di `.env` (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- [x] `src/constants/index.ts` — validasi env vars pakai `zod` (fail fast jika ada yang hilang), export constants
- [x] `src/constants/cache-key.ts` — daftar cache key/tag terpusat untuk `unstable_cache`/`revalidateTag`
- [x] `src/lib/prisma.ts` — Prisma Client singleton (guard hot-reload dev)

## Fase 1 - Autentikasi & Session (historis, telah digantikan)

- [x] `src/lib/auth.ts` — `createSession()`, `getSession()` (cached per request), `destroySession()` (JWT `jose` HS256, cookie `session` httpOnly+secure+sameSite=lax, expiry 7 hari)
- [x] `src/proxy.ts` — guard semua route kecuali `/`, `/first-time-setup`, `/login`; redirect ke `/login` jika tidak ada session. **Catatan breaking change:** di versi Next.js ini `middleware.ts` dideprecate → jadi `proxy.ts` (fungsi `proxy`), lihat `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- [x] `src/features/auth/schemas.ts` — zod schema `RegisterSchema` (+ confirm password) & `LoginSchema`
- [x] Server action `registerAction` (first-time-setup): guard `count(User) === 0`, hash bcrypt cost 12, buat session
- [x] Server action `loginAction`: `bcrypt.compare`, pesan error generik ("Username atau password salah."), buat session
- [x] Server action `logoutAction`: `destroySession()`
- [x] `npm run build` sukses, `src/proxy.ts` terdeteksi sebagai "ƒ Proxy (Middleware)"

## Fase 2 - Route Group `(auth)` (historis, telah digantikan)

- [x] Layout `(auth)` — `src/app/(auth)/layout.tsx`, container center tanpa sidebar
- [x] `/` — redirect logic: `count(User) === 0` → `/first-time-setup`; ada user tanpa session → `/login`; ada session → `/dashboard`
- [x] `/first-time-setup` — form registrasi (`RegisterForm`, react-hook-form + zodResolver), guard tertutup jika `count(User) > 0`
- [x] `/login` — form login (`LoginForm`), redirect ke `/dashboard` jika sudah ada session
- [x] **Bug ditemukan & diperbaiki**: Next.js men-static-kan `/` dan `/first-time-setup` karena tidak ada Request-time API yang terdeteksi di jalur eksekusi build — guard `count(User)` jadi ter-cache basi (celah keamanan: form registrasi tetap tampil ke publik setelah user pertama ada). Fix: `export const dynamic = "force-dynamic"` di kedua halaman. Diverifikasi via `npm run build` (kolom route berubah dari `○` ke `ƒ`).
- [x] shadcn versi ini tidak punya `Form` wrapper klasik (registry `form.json` kosong) — dipakai komponen `Field`/`FieldLabel`/`FieldError`/`FieldGroup` (`src/components/ui/field.tsx`) dikombinasikan manual dengan `react-hook-form`'s `register()` + `zodResolver`, bukan `useActionState`
- [x] Verifikasi: `npm run build` sukses, halaman ter-render dengan field form yang benar (dicek via curl), tidak ada error di log dev server. Testing interaktif submit form diserahkan ke user (manual di browser)

## Fase 3 — Route Group `(dashboard)` — Shell

- [x] Layout `(dashboard)` — `src/app/(dashboard)/layout.tsx`, pakai `SidebarProvider`/`SidebarInset`/`AppSidebar` (`components/ui/sidebar.tsx`), nav: Dashboard/Test Package/Analytics + tombol Keluar (`logoutAction`)
- [x] Guard session di layout (selain proxy): `getSession()` + cek user masih ada di DB, redirect `/login` jika tidak valid
- [x] `/dashboard` — `src/features/dashboard/actions.ts` (`getDashboardSummary`, di-cache per user via `unstable_cache` + `CACHE_TAGS.dashboardSummary`), tampilkan total attempt selesai + attempt terakhir + CTA ke `/test-package`
- [x] Verifikasi: `npm run build` sukses (`/dashboard` = `ƒ` dynamic), guard tanpa cookie redirect ke `/login` (dicek via curl), user konfirmasi `/dashboard` render `200` tanpa error di log dev server

## Fase 4 — Test Package

- [x] Server action `get`: `getTestPackages` (list, grouped di layer page pakai `JLPT_LEVEL_ORDER`), `getTestPackageDetail` (paket + testPackageItems + riwayat attempt user), `getTestPackageQuestions` (dump lengkap untuk mode baca) — `src/features/test-package/actions.ts`
- [x] `/test-package` — daftar paket dikelompokkan per level (N1 → N5, urutan eksplisit karena Postgres enum order beda dari yang diinginkan)
- [x] Komponen shared render markup teks Jepang: `src/lib/japanese-markup.ts` (parser rekursif, dukung nesting furigana-dalam-underline) + `src/components/japanese-text.tsx` (`<JapaneseText>`, prop `hideFuriganaInUnderline` untuk kasus `MOJI_GOI_READ_KANJI`)
- [x] `/test-package/[id]` — overview paket, waktu resmi JLPT per sesi (`src/constants/jlpt.ts`, sumber [jlpt.jp](https://www.jlpt.jp/e/guideline/testsections.html)), riwayat attempt + link hasil, tombol mulai mock test / latihan per seksi (`StartAttemptActions`)
- [x] Server action `mutate`: `createAttemptAction` (mock test `sectionScope=null` atau per-section) → redirect ke `/exam/[attemptId]/1`
- [x] `/test-package/[id]/questions` — mode baca: furigana, kunci jawaban (choice benar di-highlight), explanation, dan comment semua tampil (bukan mode pengerjaan jadi tidak kena guard data-leak `/exam`); grouping `QuestionContext` supaya bacaan bersama tidak diulang render per soal
- [x] Verifikasi: `npm run build` sukses (semua route baru `ƒ` dynamic), `npm run lint` bersih untuk kode baru (2 error lint yang ada murni di file boilerplate shadcn, tidak terkait Fase 4)

## Fase 5 — Exam Flow

- [x] `src/features/exam/schemas.ts` — `ExamAnswerSchema` + `SubmitExamSessionSchema` (per soal: `questionId`, `selectedAnswer` 1–4|null, `flagged`)
- [x] Exam context (`src/features/exam/components/exam-provider.tsx`) — state jawaban+flag per soal (keyed by `questionId`), persist ke `sessionStorage` (key `exam-state-{attemptId}-{session}`), hidrasi via `useLayoutEffect` sebelum paint
- [x] Server action `get` (`getExamQuestions`): exclude `questionAnswer` & `explanation` total (tidak di-select sama sekali, bukan cuma disembunyikan di UI), exclude `questionComments`, filter by `sectionScope` (latihan per seksi = gabungkan semua `TestPackageItem` section itu lintas `session` asli, jadi virtual "sesi 1" tunggal — sesuai `project-overview.md`), urutan `session → order → Question.order`
- [x] `/exam/[attemptId]/[session]` — halaman pengerjaan; navigasi via `?questionNumber=` + fallback (soal pertama yang belum dijawab, atau soal 1) kalau query param invalid/di luar range; furigana disembunyikan penuh (mode kerja) + aturan khusus `MOJI_GOI_READ_KANJI` (furigana dalam underline selalu disembunyikan)
- [x] Guard: attempt `COMPLETED` → redirect ke `/result/[attemptId]`; kepemilikan attempt divalidasi (`attempt.userId === session.userId`) di get & submit action
- [x] Server action submit sesi (`submitExamSessionAction`) — upsert `AttemptAnswer`, `isCorrect` dihitung ulang server-side dari kunci jawaban asli (tidak percaya client), `Attempt.status = COMPLETED` + `finishedAt` kalau sesi terakhir (section-scoped selalu langsung final di sesi 1), redirect ke sesi berikutnya atau `/result/[attemptId]`
- [x] **Breaking change lain ketemu**: `revalidateTag(tag)` 1-argumen sudah deprecated di versi ini — sekarang butuh `revalidateTag(tag, profile)`, atau pakai `updateTag(tag)` (khusus Server Action, cocok untuk read-your-own-writes) — dipakai untuk invalidasi cache dashboard setelah attempt selesai. Lihat `node_modules/next/dist/docs/.../updateTag.md`
- [x] Verifikasi: `npm run build` sukses (`/exam/[attemptId]/[session]` = `ƒ`), `npm run lint` bersih (1 error `react-hooks/set-state-in-effect` di-suppress sengaja untuk hidrasi `sessionStorage` — pola yang secara struktural butuh effect, bukan bug), guard tanpa cookie redirect ke `/login`

## Fase 5.1 — Demo Seed Script (untuk bantu testing Fase 5–7)

Bukan bagian dari bank soal produksi (itu tetap di Fase 8) — ini cuma jalan pintas dev-only supaya ada data `Attempt`-able saat testing Exam Flow, Result, dan Analytics, tanpa nunggu tooling import asli selesai.

- [x] `prisma/seed-demo-test-package.mjs` — script CLI melalui `npm run seed:demo-test-package`
- [x] Idempotent: cek `TestPackage` dengan `name` unik penanda `"DEMO - Seed Testing"` via `findFirst` — kalau sudah ada, skip seeding; kalau belum, baru seed
- [x] Seed: 1 `TestPackage` (N5), 4 `TestPackageItem` lintas section (`MOJI_GOI_READ_KANJI`, `MOJI_GOI_CONTEXT` di sesi 1; `BUNPOU_GRAMMAR`, `DOKKAI_SHORT_TEXT` di sesi 2 — CHOUKAI di-skip, butuh asset audio), tiap item 2 `Question` + 4 `QuestionChoice`, `questionAnswer` terisi benar
- [x] 2 soal pertama pakai markup furigana `{漢字|かんじ}` dalam underline `__teks__` (menguji aturan sembunyi-furigana `MOJI_GOI_READ_KANJI`)
- [x] 1 `QuestionContext` (bacaan) dipakai bersama oleh 2 soal `DOKKAI_SHORT_TEXT`
- [x] Log terminal ringkas menampilkan status `seeded` atau `skipped` beserta `testPackageId`
- [x] Seed tidak lagi diekspos sebagai endpoint aplikasi dan tidak perlu pengecualian auth di `src/proxy.ts`
- [x] Verifikasi: script bersifat idempotent; isi data sesuai rencana (8 soal, 4 mondai, furigana/underline & context bacaan bersama)

## Fase 6 — Hasil & Review

- [x] Server action `get` summary (`getAttemptSummary`, di-cache per attempt via `CACHE_TAGS.attemptSummary`): skor %, total benar/salah/tidak dijawab/flag, durasi. Guard: attempt bukan milik user → `notFound()`; belum `COMPLETED` → redirect balik ke `/test-package/[id]`
- [x] `/result/[attemptId]` — tampilkan summary + link ke review lengkap
- [x] Server action `get` detail (`getAttemptDetail`, tidak di-cache karena termasuk comment yang harus read-your-own-writes): kunci jawaban, explanation, comment, plus jawaban user & `isCorrect` per soal (join `attemptAnswers` di-filter by `attemptId`)
- [x] `/result/[attemptId]/detail` — soal + jawaban user (badge benar/salah/tidak dijawab, pilihan user & kunci di-highlight beda warna) + explanation + comment, furigana tampil (termasuk aturan `MOJI_GOI_READ_KANJI`)
- [x] Server action `mutate`: `addQuestionCommentAction` — tambah `QuestionComment`, invalidasi cache `testPackageQuestions` (mode baca) via `updateTag` supaya comment baru ikut muncul di sana juga; halaman detail sendiri langsung fresh (`router.refresh()`) karena tidak di-cache
- [x] Verifikasi: `npm run build` sukses (`/result/[attemptId]`, `/result/[attemptId]/detail` = `ƒ`), `npm run lint` bersih (1 warning unused import dibersihkan)

## Fase 7 — Analytics

- [x] Server action `getAnalytics` (di-cache per user via `CACHE_TAGS.analytics`): tren skor per attempt, kelemahan per `mondaiType` & per `section` — agregasi manual di JS (bukan Prisma `groupBy`, karena `mondaiType`/`section` dua relasi jauh dari `AttemptAnswer`), filter `Attempt.status = COMPLETED` (otomatis exclude `ABANDONED` & `IN_PROGRESS`)
- [x] Cache analytics diinvalidasi (`updateTag`) bareng dashboard summary saat attempt selesai di `submitExamSessionAction`
- [x] `/analytics` — chart pakai `recharts` (dibungkus `components/ui/chart.tsx`): line chart tren skor, bar chart horizontal kelemahan per mondai & per section. **Cek dulu skill dataviz** sebelum nulis chart — ternyata tema project ini monokrom murni (`--chart-1..5` semua abu-abu, cuma `--destructive` berwarna), jadi dipakai satu hue netral untuk magnitude (bukan palet kategorikal baru → validator palet tidak perlu dijalankan), dan `--destructive` dipakai spesifik sebagai status-flag bar di bawah 60% akurasi (bukan identitas seri)
- [x] Verifikasi: `npm run build` sukses (`/analytics` = `ƒ`), `npm run lint` bersih, guard tanpa cookie redirect ke `/login`

## Fase 7.1 — Sidebar untuk Exam/Result + Halaman History

Perubahan dari feedback user setelah testing: `/exam` dan `/result` awalnya sengaja tanpa sidebar (mode fokus), tapi user ingin tetap ada sidebar di situ. Juga belum ada entry point untuk lihat attempt lama selain lewat halaman per-paket — perlu halaman `/history` lintas paket.

- [x] Pindahkan `/exam/[attemptId]/[session]` ke dalam route group `(dashboard)` supaya dapat sidebar & guard dari layout situ — hapus `src/app/exam/layout.tsx` (guard terpisah jadi redundan)
- [x] Pindahkan `/result/[attemptId]` & `/result/[attemptId]/detail` ke dalam route group `(dashboard)` — ganti `src/app/result/layout.tsx` jadi nested layout ringan (cuma wrapper max-width, sidebar & guard sudah dari parent)
- [x] Hilangkan padding dobel di `ExamRunner` (parent layout `(dashboard)` sekarang sudah kasih `p-4`)
- [x] `src/features/history/actions.ts` — `getAttemptHistory()`: semua attempt milik user lintas paket, terbaru dulu
- [x] `/history` — daftar semua attempt (nama paket, level, mode mock/seksi, status, tanggal), tombol "Lihat Hasil"/"Review" ke `/result/[attemptId]` & `/result/[attemptId]/detail` untuk yang `COMPLETED`
- [x] Tambah menu "History" di `AppSidebar`
- [x] Update `docs/project-overview.md` — route table: `/exam` & `/result` dicatat sebagai bagian dari group `(dashboard)`, tambah baris `/history`
- [x] Verifikasi: `npm run build` sukses (semua route lama tetap resolve ke URL yang sama, `/history` baru muncul), `npm run lint` bersih

## Fase 8 — Bank Soal (Data)

Bank soal asli/produksi (bukan data dummy testing — itu di [Fase 5.1](#fase-51--demo-seed-api-untuk-bantu-testing-fase-57)).

- [x] `prisma/seed-test-package.mjs` — script import melalui `npm run seed:test-package`; tidak diekspos sebagai endpoint aplikasi
- [x] **Satu file JSON = satu paket tes**, bukan satu `data.json` raksasa: setiap file di `src/test-package-data/*.json` (root langsung object `SeedTestPackage`, tanpa pembungkus array) di-scan otomatis pakai `fs.readdir` tiap eksekusi (bukan static import) — diubah dari desain awal (`data.json` tunggal) karena satu paket JLPT isinya bisa sangat panjang
- [x] Idempotent per `TestPackage.name` (field di dalam JSON, bukan nama file) — package lengkap di-skip, package parsial diblokir, dan replacement existing harus eksplisit serta ditolak jika sudah memiliki attempt
- [x] Resilient berlapis: seluruh fixture divalidasi sebelum write; setiap package diimpor atomik dalam satu transaksi; kegagalan context/item/question/choice me-rollback seluruh package; package existing yang parsial diblokir alih-alih di-skip; replacement eksplisit ditolak jika sudah memiliki attempt
- [x] `src/test-package-data/types.ts` — kontrak TypeScript (`SeedTestPackage`/`SeedTestPackageItem`/`SeedQuestion`/`SeedQuestionChoice`/`SeedQuestionContext`)
- [x] `docs/seed.md` — dokumentasi lengkap kontrak JSON untuk konteks tool/AI scraping eksternal: konvensi satu-file-satu-paket & penamaan file, field-by-field, daftar nilai enum (`jlptLevel`/`section`/`mondaiType`), **aturan penomoran `session` per level** (N1/N2 = 2 sesi, N3-N5 = 3 sesi — beda pembagian section per sesi), rekap markup teks, validasi umum, contoh JSON lengkap
- [x] Logging aktif (`[seed:test-package] CREATE/REPLACE/SKIP/ERROR/DONE ...`) — tampil di terminal bersama ringkasan terstruktur (`packagesSeeded`/`packagesReplaced`/`packagesSkipped`/`packagesBlocked`/`questionsSeeded`/`errors`)
- [x] Verifikasi: dites 2x — (1) payload single-file lama (1 paket, 2 mondai, 1 context, 1 soal `questionContextRef` sengaja rusak): seed 2/3 soal + 1 error tercatat rapi, run kedua skip; (2) setelah pindah ke struktur folder: file kosong (`n2-2019-12.json` milik user) ke-skip aman, file baru ke-seed, run kedua idempoten. Data test dibersihkan lagi dari DB & file temp dihapus tiap kali. `npm run build` & `npm run lint` bersih

## Fase 8.1 — Text Parser untuk Bacaan Panjang (Dokkai)

Ditemukan saat input data real (`n2-2017-07.json` dkk): bacaan dokkai panjang (memo, 注,
multi-paragraf, 2-teks 【A】/【B】, tabel info) tampil sebagai satu blok teks membingungkan karena
`JapaneseText` (Fase 4) belum pernah menangani line break / struktur dokumen. Desain lengkap &
analisis di [`docs/text-parser.md`](./text-parser.md).

- [x] `src/lib/japanese-document.ts` — `parseJapaneseDocument`: pecah `storyText` jadi
  `paragraph`/`table`/`section` block, di atas `parseJapaneseMarkup` yang sudah ada (tidak diubah)
- [x] `src/components/japanese-passage.tsx` — `JapanesePassage`, reuse inline renderer yang
  diekspor dari `japanese-text.tsx` (`renderInlineJapanese`) supaya tidak duplikasi logic
- [x] Ganti pemakaian `storyText` di exam runner, mode baca, result detail dari `JapaneseText` ke
  `JapanesePassage`. `JapaneseText` sendiri tidak berubah, tetap dipakai untuk teks 1-baris
- [x] `docs/seed.md` ditambah checklist QA underline + catatan typo key `questionContexts`
- [x] Bug ketemu & diperbaiki saat verifikasi: deteksi marker `【A】`/`【B】` awalnya gagal karena
  markernya nempel di chunk yang sama dengan paragraf pertama (dipisah 1 `\n`, bukan `\n\n`) —
  diganti ke deteksi prefix, divalidasi ulang dry-run ke data asli
- [x] Verifikasi: `npm run build` & `npm run lint` bersih; parser dites dry-run terhadap 6 context
  asli dari `n2-2017-07.json` (memo, 注, paragraf panjang, 2-section, tabel)
- [ ] **Belum dicek visual di browser** oleh model — tunggu user cek langsung setelah seed data

## Fase 8.2 — Bugfix Hydration + Comment CRUD, Upload Gambar, Navigasi Detail, Resume Attempt, Analytics per Attempt

Feedback dari testing manual user. Beberapa item independen, dikerjakan sekaligus:

### Bugfix: hydration error di `/result/[attemptId]`

- [x] **Root cause ketemu** (bukan soal tanggal/locale seperti dugaan awal): base-ui `Button` punya
  prop `nativeButton` yang default `true` — konflik kalau `render` diarahkan ke `<Link>` (jadi
  `<a>`, bukan `<button>` asli), bikin atribut yang di-generate server vs client beda pas hidrasi.
  Pola `<Button render={<Link .../>}>` dipakai di HAMPIR SEMUA halaman, jadi ini bug tersebar,
  bukan cuma di `/result`.
- [x] Ditambahkan `nativeButton={false}` di semua 10 titik: `dashboard/page.tsx` (2x),
  `result/[attemptId]/page.tsx` (3x), `history/page.tsx` (2x), `test-package/[id]/page.tsx` (2x).
  `app-sidebar.tsx`'s `SidebarMenuButton` dicek terpisah — itu pakai `useRender` generik (bukan
  `useButton`), jadi tidak kena masalah yang sama, tidak diubah.
- [x] Diverifikasi lewat log dev server user langsung (bukan dugaan) — pesan error persis
  menyebut `at Button (... ResultSummaryPage ...)` dan warning terpisah "Base UI: A component
  that acts as a button expected a native `<button>`..." yang mengonfirmasi akar masalahnya.
- [ ] **Catatan buat ke depan**: pemakaian `Button` + `render={<Link .../>}` BARU wajib selalu
  sertakan `nativeButton={false}`.

### Comment: edit, hapus, tampilan mirip sosmed

- [x] Schema: `EditQuestionCommentSchema`, `DeleteQuestionCommentSchema` di
  `src/features/result/schemas.ts` (plus `AddQuestionCommentSchema` diupdate: `commentImages`
  max 4 URL)
- [x] Action: `updateQuestionCommentAction`, `deleteQuestionCommentAction` — verifikasi
  kepemilikan (`comment.userId === session.userId`) sebelum edit/hapus, invalidasi cache
  `testPackageQuestions` yang sama seperti `addQuestionCommentAction`
- [x] `getAttemptDetail` — sertakan `user.username` + `updatedAt` di `questionComments`
- [x] UI baru `src/features/result/components/comment-item.tsx` — avatar (inisial username,
  `components/ui/avatar.tsx`), nama, waktu relatif (`date-fns` `formatDistanceToNow` + locale
  `id`), label "· diedit" kalau `updatedAt !== createdAt`, tombol Edit/Hapus dengan konfirmasi
  `AlertDialog` sebelum hapus
- [x] Edit inline: klik Edit → form (textarea + image uploader) muncul menggantikan tampilan
  comment, prefill data lama, tombol simpan/batal

### Upload gambar comment (Cloudinary, direct upload dari client)

- [x] Install package `cloudinary` (buat generate signature saja, bukan upload lewat server)
- [x] `src/lib/cloudinary.ts` — util `createSignedUploadParams()` (server-only), pakai
  `CLOUDINARY_*` dari `src/constants/index.ts` (sudah divalidasi di sana dari Fase 0)
- [x] Server action `getCommentImageUploadSignatureAction` — return `{ signature, timestamp,
  apiKey, cloudName, folder }`, TIDAK pernah expose `CLOUDINARY_API_SECRET` ke client
- [x] `src/features/result/components/comment-image-uploader.tsx` — picker gambar (maks 4),
  validasi tipe (image only) + ukuran (max 5MB) di client, `fetch()` langsung ke
  `https://api.cloudinary.com/v1_1/{cloud}/image/upload` (bukan lewat server kita)
- [x] `commentImages` ikut dikirim pas create/update comment
- [x] **Diverifikasi end-to-end nyata** (bukan cuma baca kode): generate signature pakai
  credential asli dari `.env`, upload gambar 1x1 px langsung ke Cloudinary via curl pakai
  signature itu — berhasil dapat `secure_url`. File test dihapus lagi dari Cloudinary setelahnya.

### Navigasi section & mondai di halaman detail

- [x] Tiap Card mondai dikasih `id={`mondai-${item.id}`}` + `scroll-mt-16` (biar tidak ketutup
  header sticky pas di-scroll via anchor) sebagai anchor
- [x] `src/features/result/components/detail-nav.tsx` — Server Component murni (cuma
  `<a href="#mondai-x">`, tidak perlu JS), dikelompokkan per section

### `/history` — tombol lanjutkan attempt yang masih berjalan

- [x] `getAttemptHistory` — untuk attempt `IN_PROGRESS`, hitung `resumeSession` (sesi pertama
  yang belum ada `AttemptAnswer`-nya sama sekali; kalau `sectionScope` terisi, selalu sesi 1
  virtual) — logikanya cermin dari `submitExamSessionAction` di `features/exam/actions.ts`
- [x] Tombol "Lanjutkan" ke `/exam/[attemptId]/[resumeSession]` untuk attempt `IN_PROGRESS`

### `/result/[attemptId]` — breakdown benar/salah per section & per mondai

- [x] `src/lib/category-stats.ts` — `toSortedCategoryStats` diekstrak dari
  `features/analytics/actions.ts` jadi util bersama (dipakai analytics & result, hindari
  duplikasi)
- [x] `getAttemptSummary` — sekarang juga return `sectionStats`/`mondaiTypeStats` khusus attempt
  ini (bukan seluruh riwayat seperti `/analytics`), bentuk data sama biar reuse
  `CategoryAccuracyChart` langsung
- [x] Render 2 chart tambahan di halaman summary: breakdown per section, breakdown per mondai

## Fase 8.3 — Rework UX Halaman Detail (per-mondai, bukan semua di-scroll)

Feedback lanjutan: halaman detail masih susah dipakai karena semua mondai ditumpuk & harus
di-scroll panjang. Diubah total jadi tampilan per-mondai + fitur tambahan.

- [x] `src/app/(dashboard)/result/[attemptId]/detail/page.tsx` — sekarang cuma render **satu**
  mondai sekaligus, dipilih lewat query param `?mondai=<id>` (bukan client state — cukup
  `searchParams`, konsisten dengan pola `?questionNumber=` di exam runner). Fallback ke mondai
  pertama kalau param kosong/tidak valid.
- [x] Layout 2 kolom: sidebar navigasi sticky di kiri (desktop, `lg:block`, grouped per section,
  tiap mondai tampilkan skor `benar/total`) + konten di kanan. Mobile: sidebar disembunyikan,
  diganti tombol "Pilih Mondai" yang buka `Sheet` (drawer) isinya sama
  (`src/features/result/components/detail-nav.tsx` untuk list+sidebar,
  `detail-mobile-nav.tsx` untuk versi Sheet — list-nya di-share, bukan duplikasi)
- [x] Tombol "Mondai Sebelumnya"/"Selanjutnya" di bawah konten buat navigasi cepat berurutan
- [x] Tombol copy per soal (`copy-question-button.tsx`) — salin bacaan+soal+pilihan jadi plain
  text (markdown-ish: furigana → `漢字(かんじ)`, underline → `**teks**`) buat ditanyakan ke AI.
  Util baru `src/lib/japanese-plain-text.ts` (`markupToPlainText`/`documentToPlainText`, reuse
  parser yang sudah ada dari Fase 8.1, bukan implementasi baru)
- [x] `src/components/image-with-lightbox.tsx` — klik gambar → overlay fullscreen (via
  `createPortal` ke `document.body`, hindari masalah stacking context), klik backdrop/tombol
  close/Escape buat nutup, klik gambar sendiri tidak menutup (`stopPropagation`). Dipakai di
  semua gambar halaman detail (context/soal/pilihan) + gambar comment
- [x] **Bug lint ketemu & diperbaiki**: setelah hapus loop luar per-`testPackageItem`,
  `let lastContextId` yang tadinya scoped di dalam `.map()` sekarang mutasi variable di scope
  komponen — kena `react-hooks/immutability` (baru muncul karena perubahan struktur, bukan lint
  rule baru). Diganti jadi `reduce` murni fungsional (precompute `showContext` per soal sebelum
  render, tanpa mutasi)
- [x] Verifikasi: `npm run build` sukses, `npm run lint` balik ke baseline (2 error lama saja,
  tidak ada error baru)

### Perbaikan lanjutan: lebar penuh, sticky nav, breakdown teks (bukan chart)

- [x] `src/app/(dashboard)/result/layout.tsx` **dihapus** — satu-satunya isinya cuma wrapper
  `max-w-3xl mx-auto`, jadi setelah constraint-nya dicabut, filenya tidak perlu ada lagi
  (parent `(dashboard)/layout.tsx` sudah cukup)
- [x] **Bug sticky nav diperbaiki**: `sticky` sebelumnya ditaruh di `<div>` yang bersarang di
  dalam `<aside>` (flex item-nya sendiri tidak sticky, cuma wrapper di dalamnya) — makanya ikut
  scroll. Dipindah jadi `sticky` langsung di elemen `<aside>` (flex item-nya sendiri), plus
  `self-start` eksplisit
- [x] `/result/[attemptId]` — breakdown per section/mondai diganti dari `CategoryAccuracyChart`
  (chart) ke `src/components/category-stat-list.tsx` (list teks: label + `benar/total · persen%`,
  merah kalau di bawah 60%) — reuse tipe `CategoryStat` yang sama, cuma beda presentasi
- [x] Verifikasi: `npm run build` & `npm run lint` balik ke baseline (2 error lama saja)

### Verifikasi

- [x] `npm run build` & `npm run lint` bersih (2 error lama tidak berubah; 2 warning baru soal
  React Compiler tidak bisa memoize `useForm().watch()` — bukan bug, memang batasan API RHF)

## Fase 8.4 — Tabel Analisis per Mondai + Proyeksi Skor ala JLPT

Permintaan user: ganti visual analisis jadi tabel per mondai dengan proyeksi skor meniru skala
JLPT asli. Keputusan user (via AskUserQuestion): pemetaan **3 scoring section** seperti JLPT
asli — 言語知識 (moji-goi + bunpou digabung) / 読解 / 聴解, masing-masing 60, total 180, seragam
untuk semua level (aturan khusus N4/N5 yang 120+60 diabaikan demi konsistensi); ditaruh di
**dua-duanya** (`/analytics` per level + `/result/[attemptId]` per attempt).

- [x] `src/lib/jlpt-score.ts` — `MONDAI_WEIGHTS` (bobot kesulitan per mondai, mis. 漢字読み 1.0 …
  文の組み立て★ 1.5 … 統合理解 1.6-1.7; aproksimasi karena algoritma resmi JLPT/IRT tidak
  dipublikasikan), `scoringSectionOf()` (map 4 section app → 3 scoring section JLPT), dan
  `computeJlptScoreProjection()` dengan rumus ternormalisasi
  `skorSection = Σ(bobot×benar) / Σ(bobot×totalSoal) × 60` — dijamin mentok 60/180 secara
  matematis (kolom "Skor" polos = rumus yang sama dengan semua bobot 1). Skor section dibulatkan
  dulu baru dijumlah jadi total (meniru rapor JLPT asli yang per section-nya integer).
  `maxScore` menyesuaikan jumlah section yang ada datanya (latihan per seksi → maks 60, bukan 180)
- [x] `src/components/jlpt-score-table.tsx` — tabel bersama: baris per mondai (bobot, benar/total,
  akurasi — merah <60%), baris subtotal per scoring section (+ kolom Skor /60 & Skor Berbobot /60),
  baris total (skala /180). Kolom skor sengaja hanya terisi di subtotal/total — skor skala-60
  memang milik scoring section, bukan milik satu mondai
- [x] `/analytics` — dua chart kelemahan lama diganti tabel per level (dikelompokkan N1→N5, hanya
  level yang ada datanya; agregasi answers per level via join `attempt.testPackage.jlptLevel` —
  campur data N2+N5 dalam satu agregat memang tidak bermakna). Tren skor (line chart) tetap
- [x] `/result/[attemptId]` — dua card list teks (per section & per mondai dari Fase 8.3) diganti
  satu card tabel yang sama, per attempt
- [x] Bersih-bersih: `CategoryStatList`, `CategoryAccuracyChart`, `lib/category-stats.ts` dihapus
  (tidak ada pemakainya lagi setelah diganti tabel)
- [x] Verifikasi: rumus di-dry-run (semua benar → tepat 60/180; benar hanya di mondai gampang →
  skor berbobot < polos (24 vs 30); benar hanya di mondai susah → sebaliknya (36 vs 30));
  `npm run build` & `npm run lint` di baseline
- [x] **Fix dokumen**: heading `## Fase 9` sempat hilang tertelan edit sebelumnya (item-itemnya
  jadi yatim) — dikembalikan

## Fase 8.5 — Halaman Progress (Tracking Skor per Attempt)

Permintaan user: tabel analytics per attempt (bukan agregat), dengan tab per level. Keputusan
via AskUserQuestion: **tiap tipe mondai jadi kolom sendiri** (tabel lebar, scroll horizontal —
kelemahan antar attempt kelihatan sejajar), ditaruh di **halaman baru `/progress`** dengan menu
sidebar "Progress" (ikon TrendingUp) supaya `/analytics` tidak makin padat.

- [x] `src/features/progress/actions.ts` — `getProgress()`: attempt `COMPLETED` per user, urut
  `finishedAt` asc (baca seperti log perkembangan), grouped per level, tiap attempt bawa
  `mondaiStats` sendiri. Cache pakai key baru `CACHE_KEYS.progress` tapi **share tag
  `CACHE_TAGS.analytics`** — sumber datanya sama (completed attempts), jadi satu `updateTag` di
  submit exam otomatis invalidasi dua-duanya tanpa menyentuh exam action
- [x] `src/features/progress/components/progress-tabs.tsx` — client component: `Tabs` per level
  (N1→N5, hanya yang ada datanya), tabel dengan header 2 baris (grup kolom: Akurasi per Mondai /
  Skor per Section / Skor Berbobot / Total). Kolom: nama paket (link ke `/result/[attemptId]`),
  tanggal, % benar per mondai (merah <60%, "–" kalau mondai tidak ada di attempt itu, mis.
  latihan per seksi), skor per scoring section `48/60 (80%)`, skor berbobot per section,
  total `142/180 (79%)` + total berbobot. Semua reuse `computeJlptScoreProjection` dari Fase 8.4
- [x] Proyeksi & format dihitung server-side di `page.tsx` (tanggal diformat di server lalu
  dikirim sebagai string — aman dari hydration mismatch locale), client component murni urusan
  tab & render
- [x] Menu sidebar "Progress" ditambahkan antara History dan Analytics
- [x] Verifikasi: `npm run build` sukses (route `/progress` = `ƒ`), `npm run lint` di baseline

## Fase 8.6 — Perbaikan `/progress`, Label Bilingual, Export, dan Filter `/analytics`

Batch permintaan user lanjutan dari Fase 8.5.

- [x] Fix double horizontal scroll di `/progress` saat pindah tab N5 → N2 (tabel jadi lebih
  lebar): root cause `TabsContent`/`CardContent` tidak punya `min-w-0`, jadi flex item tidak mau
  menyusut di bawah lebar konten intrinsiknya (default CSS flexbox) dan mendorong container ikut
  melebar → scrollbar ganda. Fix: tambah `min-w-0` di `src/components/ui/tabs.tsx` (`TabsContent`)
  dan `src/components/ui/card.tsx` (`CardContent`)
- [x] Label tipe mondai bilingual: `MONDAI_TYPE_TRANSLATIONS` + helper `mondaiTypeFullLabel()` di
  `src/constants/jlpt.ts`, format `漢字読み (Cara Baca Kanji)`. Dipakai penuh di tempat yang ada
  ruang (judul soal exam, judul section detail hasil, judul card). Di tempat sempit (kolom tabel
  Progress, nav sidebar detail hasil) tetap label Jepang pendek + `title` attribute (tooltip)
  supaya tabel tidak makin lebar
- [x] Export `/progress` ke Excel & PDF sesuai level yang aktif — `xlsx` (SheetJS) +
  `jspdf`/`jspdf-autotable`, tombol di `progress-export-buttons.tsx`, logic build baris di
  `features/progress/lib/export.ts` (header & data row sama persis dengan yang tampil di tabel).
  **Catatan keamanan**: `npm audit` melaporkan `xlsx` punya kerentanan HIGH (prototype pollution +
  ReDoS) tanpa fix resmi di versi npm — sudah dikonfirmasi eksplisit ke user (3 opsi: CSV-only,
  tetap xlsx, ganti `exceljs`) dan user **memilih tetap pakai `xlsx`**. Dipertahankan by design.
- [x] Filter `/analytics` — scope (`Semua`/`Mock Test`/per-`JlptSection`, berdasar
  `Attempt.sectionScope`, `null` = mock test) + rentang tanggal (preset `thisWeek`/`thisMonth`/
  `last30Days`/`custom` via `Calendar` shadcn `mode="range"`, atau `all`). State di URL
  searchParams (`?scope=&range=&from=&to=`), bukan `useState`, biar shareable & konsisten dengan
  pola exam/result yang sudah ada. `getAnalytics(filters)` menerima `filters` sebagai **argumen
  fungsi asli** (bukan closure) supaya `unstable_cache` bisa derive cache key otomatis dari
  argumen — pakai ISO date string (bukan `Date`) biar key-nya stabil. Helper
  `resolveDateRangePreset()` di `src/lib/date-range-preset.ts`
- [x] `/analytics` diubah dari Card bertumpuk per level jadi `Tabs` per level (N1→N5, pola sama
  seperti `/progress`) — `features/analytics/components/analytics-tabs.tsx`
- [x] Verifikasi: `npm run build` sukses (`/analytics` tetap `ƒ`), `tsc --noEmit` bersih,
  `npm run lint` bersih untuk file yang diubah (4 warning/error pre-existing di file lain, di luar
  scope perubahan ini). **Tidak sempat diuji visual di browser** — tidak ada tool automasi browser
  tersedia di environment ini dan tidak ada kredensial login untuk sesi ini; disarankan user cek
  manual sebelum dianggap kelar
- [x] Tombol show/hide furigana di `/test-package/[id]/questions` (mode baca) dan
  `/result/[attemptId]/detail` (review jawaban) — `src/components/furigana-scope.tsx`, client
  component pembungkus yang toggle visibilitas `<rt>` (bacaan furigana dari `JapaneseText`/
  `JapanesePassage`, lihat `src/lib/japanese-markup.ts`) lewat selector CSS `[&_rt]:hidden`,
  tanpa perlu mengubah Server Component yang merender soal
- [x] Follow-up bugfix furigana (laporan user "toggle tidak berpengaruh, furigana tidak tampil"),
  tiga akar masalah sekaligus:
  1. Dev server tercemar — `npm run build` sempat dijalankan saat `next dev` masih hidup (share
     folder `.next`), jadi chunk CSS dev yang tersaji basi (tanpa rule toggle & styling `rt`).
     Fix: matikan dev server, `rm -rf .next`, start ulang. **Pelajaran: jangan `next build`
     selagi `next dev` jalan.**
  2. Styling `<rt>` default browser terlalu kecil (~50% → 7px) — ditambah `rt { font-size:
     .65em; line-height: 1.4 }` + `ruby { ruby-position: over }` di `globals.css` @layer base
  3. Paket yang diuji user (n2-2018-12) memang tidak punya furigana tampil sama sekali — semua
     furigananya jawaban kanji-yomi yang di-force-hide `hideFuriganaInUnderline`. Keputusan:
     di mode belajar & review (kunci jawaban toh sudah tampil) force-hide DIHAPUS — semua
     furigana dikontrol toggle; force-hide tetap dipakai HANYA saat exam (`exam-runner.tsx`)
  - Verifikasi headless Chrome (dump-dom + computed style) pada DOM halaman asli + CSS hasil
    kompilasi: furigana tampil 9.1px di atas 離れて, dan class toggle mengubah `rt` jadi
    `display: none`. Catatan environment: origin-protection dev server Next memblokir asset
    `/_next/*` dari origin lain, jadi pengujian CSS harus pakai salinan lokal file CSS
- [x] Copy-to-clipboard soal tidak lagi menyertakan bacaan furigana (hanya kanji polos) — perbaikan
  di `src/lib/japanese-plain-text.ts` (`segmentsToPlainText`), berlaku untuk seluruh fitur copy.
  Efek samping yang disengaja: ini juga menutup kebocoran jawaban `MOJI_GOI_READ_KANJI` — sebelum
  ini, tombol copy menyalin `漢字(かんじ)` ke clipboard walau bacaannya secara visual disembunyikan
- [x] `/test-package/[id]/questions` (mode baca) dibuat UI-nya sama dengan
  `/result/[attemptId]/detail`: navigasi sidebar/mobile per mondai (satu mondai per halaman via
  `?mondai=`, bukan semua soal ditumpuk), tombol copy per soal, dan form tambah catatan belajar.
  Refactor pendukung — komponen yang sekarang dipakai 2 fitur sekaligus dipindah ke lokasi
  bersama, bukan reuse cross-feature yang janggal:
  - `features/result/components/{detail-nav,detail-mobile-nav}.tsx` → `src/components/
    {question-nav,question-nav-mobile}.tsx`, prop `attemptId` digeneralisasi jadi
    `buildHref(itemId) => string`; `correctCount` di `NavMondaiItem` jadi optional (mode baca
    tidak punya benar/salah untuk ditampilkan)
  - `features/result/components/copy-question-button.tsx` → `src/components/copy-question-button.tsx`
  - Fitur comment (actions, schemas, 3 komponen) dipindah dari `features/result/` ke modul baru
    `features/question-comment/` — `QuestionComment` di skema memang hanya terikat ke `Question`,
    bukan `Attempt`, jadi sudah selayaknya bukan milik fitur result
  - `getTestPackageQuestions` (`features/test-package/actions.ts`) ditambah `updatedAt` +
    `user.username` di select `questionComments` biar cocok dengan tipe `CommentItem`
  - Verifikasi: `npm run build` sukses, `tsc --noEmit` bersih, `npm run lint` bersih (4 warning/
    error baseline pre-existing, ikut pindah lokasi bareng file yang dipindah, bukan baru).
    Dicek juga via curl+JWT manual (session cookie di-mint pakai `SESSION_SECRET` dari `.env`) ke
    kedua halaman: nav, tombol copy, form catatan, tombol prev/next, dan furigana semua tampil
- [x] Bugfix parser table markdown di `storyText` (laporan user: tabel harga di soal 情報検索
  "JLPT N2 - 2018年12月" tampil sebagai teks mentah `| ご旅行期間 | ... |`, bukan tabel).
  Root cause di `src/lib/japanese-document.ts`: heading (mis. "頑丈で安全性の高いフレームタイプ")
  dan baris header tabel cuma dipisah `\n` tunggal (bukan baris kosong), jadi masuk **chunk**
  yang sama; `isTableChunk` lama cuma cek baris PERTAMA chunk, jadi gagal deteksi & seluruh chunk
  (heading + tabel) jatuh ke paragraf mentah. Fix: `parseChunk` sekarang scan PER BARIS di dalam
  chunk (bukan per chunk), jadi heading & tabel yang cuma dipisah 1 newline tetap displit jadi
  dua block terpisah (`paragraph` lalu `table`). `parseChunk` sekarang balikin `DocumentBlock[]`
  (bisa >1 block per chunk), makanya semua caller-nya ganti `.map()` jadi `.flatMap()`. Pattern
  ini ada di ≥2 file bank soal (`n2-2018-12.json` ctx-dokkai-14, dan paket baru `n2-2016-12.json`
  yang sedang diimpor user), jadi bukan kasus sekali pakai. Verifikasi: `tsc --noEmit` bersih,
  `npm run lint` bersih, dicek langsung lewat curl+JWT ke `/test-package/23/questions` — 2 tag
  `<table>` muncul (sebelumnya 0), tidak ada lagi teks `|` mentah bocor ke halaman
- [x] Export PDF `/progress` mojibake (laporan user: kolom tertulis karakter aneh, mis.
  `æ¼¢å­èª­ã¿` — itu UTF-8 bytes dari "漢字読み" ke-decode salah sebagai Latin-1). Root cause:
  font bawaan jsPDF (Helvetica/Times/Courier) cuma cover WinAnsi/Latin-1, kanji apa pun pasti
  mojibake, bukan cuma hilang. Daripada embed font CJK (perlu bundle file font beberapa MB),
  dipilih fix yang diminta user: **label export Indonesia-only**, dipakai konsisten di Excel
  maupun PDF (bukan cuma PDF) biar dua format tetap selaras:
  - `MONDAI_TYPE_TRANSLATIONS` (sudah ada) dipakai buat header kolom mondai
  - `SCORING_SECTION_TRANSLATIONS` (baru, `src/lib/jlpt-score.ts`) buat header kolom section:
    GENGO_CHISHIKI → "Kosakata & Tata Bahasa", DOKKAI → "Membaca", CHOUKAI → "Mendengar"
  - Nama paket (mis. "JLPT N2 - 2018年12月") juga mengandung kanji ("年"/"月") — masih akan
    mojibake di PDF walau header sudah dibenerin, jadi ditambah `toPdfSafeText()` yang strip
    semua karakter di luar Latin-1 (\x00-\xFF) khusus buat body PDF (Excel dibiarkan Unicode
    penuh, tidak ada masalah font). Judul PDF juga diganti em dash "—" (U+2014, di luar Latin-1)
    jadi hyphen biasa "-"
- [x] Bugfix scroll horizontal ganda di `/progress` masih muncul lagi untuk N2 (laporan user: fix
  sebelumnya di Fase 8.6 belum menyelesaikan masalahnya). Root cause: fix sebelumnya cuma nutup
  1 dari banyak titik "flex item `min-width:auto` default" — begitu tombol export ditambahkan,
  `TabsContent` di `progress-tabs.tsx` jadi container flex baru (`flex flex-col gap-3`), dan child
  barunya (`<LevelTable/>` yang bungkus `<Table/>`) butuh `min-w-0` juga, tapi belum dikasih —
  regresi ini murni gara-gara task export buttons, bukan bug lama yang muncul lagi. Ditelusuri
  pakai Chrome headless (`--headless=new --dump-dom`) jalan-in `getComputedStyle().minWidth` di
  sepanjang rantai ancestor dari `table-container` sampai `<html>` — ternyata ada 5 titik lain
  yang juga `min-width:auto` (bukan cuma di halaman Progress, tapi di **shell dashboard**):
  `Card` root (`ui/card.tsx`, sebelumnya cuma `CardContent` yang dibenerin), `SidebarInset`/`main`
  dan `sidebar-wrapper` (`ui/sidebar.tsx`), dan wrapper `{children}` di `(dashboard)/layout.tsx`.
  Semua ditambah `min-w-0` (untuk `layout.tsx` dipakai `[&>*]:min-w-0` di wrapper-nya biar
  otomatis kena ke root div halaman apa pun, tanpa perlu edit tiap page.tsx satu-satu). Juga
  ditambah `min-w-0` di `ui/table.tsx` (`table-container`) sebagai default aman untuk semua
  pemakaian `<Table>` ke depannya. Verifikasi: `document.documentElement.scrollWidth` sekarang
  persis sama dengan `window.innerWidth` (sebelumnya lebih besar ~256px), diukur di viewport
  1280px lewat Chrome headless dengan CSS asli hasil kompilasi (bukan estimasi)

## Fase 9 — Verifikasi & Polish

- [ ] `npm run build` setelah tiap perubahan struktural/server action/caching
- [ ] Audit data-leak guard: pastikan `questionAnswer`/`explanation` tidak pernah terkirim ke client sebelum attempt disubmit
- [ ] Cek tema light/dark (CSS variables shadcn) konsisten di semua halaman
- [ ] Uji manual end-to-end: register → login → pilih paket → kerjakan (mock test & latihan per seksi) → submit → lihat hasil → tambah comment → cek analytics
