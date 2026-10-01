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

## Pembahasan Soal (QuestionExplanation)

- [x] Schema: tabel `QuestionExplanation` (1:1 ke `Question`) + `QuestionExplanationChoice`
  (alasan per pilihan, tanpa JSONB), enum `QuestionExplanationSource`, dan kolom lama
  `Question.explanation` dihapus — migration `20260923100000_question_explanation`
- [x] Kontrak fixture: `explanation` boleh objek terstruktur, bentuk string lama tetap diterima
  dan dipetakan ke `summary` (`src/test-package-data/types.ts`, `docs/seed.md`)
- [x] `prisma/test-package-fixture.mjs` — kontrak fixture dipakai bersama oleh seluruh script
- [x] `npm run seed:question-explanation` — import pembahasan saja, idempotent, aman untuk paket
  yang sudah punya attempt (21 pembahasan lama hasil ekstraksi sudah masuk)
- [x] `npm run gen:explanation` — generator pembahasan via gateway OpenAI-compatible, menulis ke
  fixture JSON, melewati CHOUKAI, memvalidasi markup, dan menandai kunci jawaban yang meragukan
- [x] UI: `QuestionExplanationBody` dipakai di hasil ujian, mode baca paket, dan latihan cepat
- [ ] Review kualitas pembahasan hasil pilot sebelum generate massal (user)
- [ ] Tentukan model produksi di `EXPLANATION_MODEL` — model reasoning lambat (1 soal = 2-4 menit)
- [ ] Generate pembahasan seluruh level non-CHOUKAI (3.534 soal), lalu
  `npm run seed:question-explanation`
- [ ] Transkrip audio CHOUKAI (1.494 soal) — prasyarat sebelum pembahasan choukai bisa dibuat

## Fase 8.7 — Berbagi Catatan & Diskusi Publik per Soal

Dokumen modul: `docs/module/question-comment.md`. Satu tabel `QuestionComment` dipakai untuk
catatan pribadi sekaligus thread publik — yang dibagikan adalah record yang sama, bukan salinan,
supaya edit tidak perlu disinkronkan antar tabel.

- [x] Schema: `enum CommentVisibility`, kolom `visibility` (default `PRIVATE`), `sharedAt`,
  `deletedAt`, dan self-relation `parentId` + index pendukung
- [x] Migration SQL tulis tangan `20260925120000_question_comment_public_discussion` +
  `prisma migrate deploy` (bukan `migrate dev` — shadow DB Supabase)
- [x] `sharedAt` sebagai penentu keanggotaan thread publik, bukan `visibility`: root yang
  di-unshare tetap tampil sebagai tombstone selama masih punya balasan
- [x] Tidak pernah hard delete — `deleteQuestionCommentAction` hanya mengisi `deletedAt`, supaya
  balasan user lain tidak ikut musnah
- [x] Tombstone dibersihkan di layer query (`toDiscussionRoot`), bukan di JSX: teks, gambar, dan
  identitas penulis root yang dihapus/disembunyikan tidak pernah ikut terkirim ke browser
- [x] Balasan maksimal satu tingkat; membalas balasan menambah balasan pada root yang sama dengan
  mention `@nama`. Thread yang root-nya mati menjadi arsip read-only
- [x] Flag terpisah `FEATURES_QUESTION_DISCUSSION` (otomatis mati bila `FEATURES_QUESTION_COMMENT`
  mati) sebagai kill switch konten publik tanpa mematikan catatan pribadi
- [x] Halaman hanya memuat jumlah entri (`getQuestionDiscussionCounts`); thread diambil lazy saat
  sheet dibuka. Sengaja tidak di-`unstable_cache` — isinya berubah tiap balasan
- [x] `/discussion/[commentId]` — permalink ala forum, guest bisa baca. `commentId` berupa balasan
  di-redirect ke root dengan anchor `#comment-<id>`
- [x] `/discussion` `noindex` via metadata layout + `disallow` di `robots.ts` selama belum ada
  moderasi
- [x] Diterapkan di mode baca dan `/result/[attemptId]/detail`
- [ ] Verifikasi manual dua akun (user): bagikan catatan dari akun A, baca dan balas dari akun B,
  lalu uji unshare dan hapus — pastikan balasan tetap ada dan isi root tidak bocor
- [x] Moderasi — selesai di Admin Dashboard tahap 5
- [ ] Notifikasi balasan dan rate limit posting — masih terbuka, lihat Admin Dashboard tahap 5
- [x] Pembersihan asset Cloudinary — diputuskan **di luar scope**: takedown hanya mengubah record
  database, file asli tidak dihapus

## Admin Dashboard (`/admin`)

Rancangan lengkap: `docs/module/admin.md`. Role statis `USER`/`ADMIN` saja — tanpa permission
granular, tanpa tabel role/permission. Urutannya mengikat: tahap 1 adalah prasyarat semua
tahap lain, dan tahap 2–3 menutup gap konten yang paling menyakitkan bila scope perlu dipotong.

### Tahap 1 — Role & Fondasi (prasyarat)

- [x] Schema: `enum UserRole { USER ADMIN }` + `User.role` default `USER` + `@@index([role])`
- [x] Migration SQL tulis tangan `20260925150000_user_role` + `prisma migrate deploy` (jangan
  `migrate dev` — shadow DB Supabase). Ledger di `docs/operations/migrations.md`
- [x] `npm run user:role -- --email <email> --role ADMIN` (`prisma/set-user-role.mjs`) —
  **bukan** lewat UI, dan bukan model "user pertama jadi admin". Menolak demote admin terakhir;
  `--list` menampilkan admin saat ini
- [x] `src/lib/auth.ts`: `getSessionUser()` dan `requireAdmin()`. Role dibaca dari database per
  request (dibungkus `cache()`), **tidak** dimasukkan ke payload JWT (JWT berlaku 7 hari → demote
  tidak akan langsung berlaku)
- [x] `requireAdmin()` melempar `notFound()`, bukan redirect ke login, supaya keberadaan area
  admin tidak bocor — guest dan user biasa mendapat 404 yang identik
- [x] `/admin` sengaja **tidak** didaftarkan di `src/proxy.ts` — proxy hanya tahu "ada session"
  sehingga guest di-redirect ke `/login?next=/admin` (membocorkan bahwa route itu ada) sementara
  user biasa dapat 404. Guard di layout memberi 404 identik untuk keduanya
- [x] `src/app/admin/layout.tsx` memanggil `requireAdmin()` + `AdminSidebar` terpisah dari route
  group `(dashboard)`, `robots: noindex`
- [x] Placeholder jujur untuk 8 area yang belum dikerjakan, supaya sidebar tidak 404 dan statusnya
  terbaca (`AdminPlaceholder`). Hapus tiap placeholder saat tahapnya selesai
- [x] Perbarui `docs/project-rules.md` §4 — catatan "role hierarchy memerlukan persetujuan
  terpisah" sudah tidak berlaku
- [x] `/admin` overview: paket & soal per level, cakupan pembahasan, antrean `answerKeyDoubt`,
  pembahasan AI belum direview, user, attempt 7 hari, entri diskusi baru, dan status katalog deck.
  Sengaja tidak di-cache — halaman ini justru dibuka untuk melihat kondisi terkini
- [ ] Perbandingan "fixture di repo vs paket di database" belum ada: membaca
  `src/test-package-data/` saat runtime tidak aman di Vercel (hanya file yang ter-trace ikut
  ter-bundle). Selesaikan bersama layar import di Tahap 2, mis. lewat manifest yang di-generate

### Tahap 2 — Bank Soal

- [x] `/admin/test-package` — daftar per level dengan pencarian nama, plus cakupan pembahasan per
  paket. Kolom mondai dan sesi dipisah, karena label "SESI UJIAN" di halaman publik sebenarnya
  menghitung blok mondai
- [x] `/admin/test-package/[id]` — detail per mondai: daftar soal, kunci, status pembahasan,
  penanda context/gambar/audio, dan peringatan bila ada `answerKeyDoubt`
- [x] `/admin/test-package/import` — upload atau tempel JSON, divalidasi kontrak yang **sama
  persis** dengan CLI, dengan daftar issue per path bila gagal
- [x] Kontrak dan logika import diekstrak jadi modul bersama supaya CLI dan admin tidak punya
  salinan masing-masing: `prisma/test-package-contract.mjs` (kontrak zod murni, bebas `node:*`
  supaya dapat ikut ter-bundle) dan `prisma/import-test-package.mjs` (transaksi tulis, menerima
  client Prisma sebagai argumen). `test-package-fixture.mjs` kini hanya helper filesystem CLI
- [x] Guard import tetap berlaku karena memang jalur kode yang sama: advisory lock per nama paket,
  satu paket satu transaksi, paket parsial diblokir, replacement ditolak bila sudah punya attempt
- [x] `/admin/question/[id]` — editor soal: `questionText`, teks/gambar tiap pilihan,
  `questionAnswer` lewat radio, dan `instruction` mondai. Markup diingatkan di UI. Pilihan
  di-update lewat id yang sudah ada, tidak dihapus-lalu-dibuat-ulang
- [ ] Upload/ganti media soal ke Cloudinary. Saat ini editor hanya menerima URL yang ditempel;
  belum ada uploader (per 25 September 2026: 227 context audio, 144 question image, 0
  `questionAudio`)
- [x] `/admin/context/[id]` — editor wacana bersama: teks, URL gambar, dan URL audio, dengan
  pratinjau media dan daftar soal yang memakainya. Memperingatkan bahwa perubahan terasa di
  semua soal itu sekaligus, dan menolak context yang tidak punya teks, gambar, maupun audio —
  aturan yang sama dengan kontrak fixture
- [x] Halaman paket menampilkan daftar wacana bersama (sebelumnya diambil query tetapi tidak
  pernah dirender) dan kolom pembahasan menjadi tautan, termasuk saat pembahasannya belum ada
- [x] Mengubah kunci jawaban ikut menurunkan ulang `QuestionExplanationChoice.isCorrect`.
  Sebelumnya tidak, sehingga pembahasan akan menyorot pilihan yang salah sebagai jawaban benar
- [x] Hapus paket — konfirmasi dengan mengetik ulang nama paket, dan ditolak bila paket sudah
  punya attempt (aturan yang sama dengan `npm run test-package:delete`)
- [x] Setiap mutasi memanggil `testPackageList`, `practiceCatalog`, `testPackageDetail(id)`, dan
  `testPackageQuestions(id)`

### Tahap 3 — Pembahasan Soal

- [x] `/admin/explanation` — empat antrean: `missing`, `unreviewed` (`source = AI` dan
  `reviewedAt` null), `doubt` (`answerKeyDoubt`), dan `reviewed`. Ada ringkasan cakupan per paket
  supaya operator tahu file fixture mana yang perlu digarap
- [x] **Dibatalkan — tidak bisa dibangun seperti yang direncanakan.** `gen:explanation` membaca
  dan menulis file fixture di `src/test-package-data/` dan tidak menyentuh database sama sekali,
  jadi hasilnya harus ikut masuk repository. Menjalankannya dari aplikasi ter-deploy mustahil:
  filesystem Vercel read-only dan ephemeral. Layar antrean menampilkan perintah CLI yang perlu
  dijalankan, bukan tombol yang tidak mungkin bekerja
- [x] `/admin/explanation/[questionId]` — editor `summary`, `detail`, `translation`, `keyPoints`,
  dan alasan per pilihan, dengan soal + pilihan + kunci ditampilkan sebagai konteks dan tombol
  "Berikutnya" untuk bergerak di dalam antrean yang sama
- [x] Alasan per pilihan wajib empat atau nol, mengikuti aturan fixture. `isCorrect`
  didenormalisasi dari kunci jawaban saat menulis, sama seperti seed
- [x] Approval mengisi `reviewedAt` dan menaikkan `source` `AI` → `HUMAN`. `IMPORTED` dibiarkan
  karena itu provenance. Menyimpan tidak sama dengan menyetujui, dan UI menyatakannya
- [x] Approval ditolak selama `answerKeyDoubt` masih aktif — menyetujui pembahasan atas kunci yang
  belum diperiksa berarti mengesahkan yang belum ditinjau
- [x] "Batalkan persetujuan" mengosongkan `reviewedAt` tetapi tidak mengembalikan `source` ke AI:
  teksnya sudah pernah dilihat dan mungkin disunting manusia
- [x] Layar `answerKeyDoubt` menampilkan `answerKeyDoubtNote` dan menautkan ke editor soal. Aksi
  "kunci sudah diperiksa" menutup penandanya; mengubah kunci jawabannya sendiri tetap di editor
  soal, supaya perubahan data soal tidak tersembunyi di layar pembahasan
- [x] Antrean `missing` memberi tahu berapa banyak sisanya CHOUKAI. Per 25 September 2026
  **seluruh 1.417 soal tanpa pembahasan adalah CHOUKAI** — tertahan transkripsi audio, bukan
  kapasitas review, jadi mengejarnya lewat layar ini tidak akan menggerakkan angkanya

### Tahap 4 — Konten Lain

- [x] `/admin/article`, `/admin/article/new`, `/admin/article/[id]` — CRUD artikel, editor body JSON
  tervalidasi `ArticleBodySchema` (schema yang sama dengan halaman publik), ringkasan jumlah blok
  per tipe, filter status, dan pencarian judul/slug/kategori
- [x] `bodyText` di-regenerate otomatis dari body lewat `articleBodyToPlainText()`
  (`src/features/article/lib/body-text.ts`). Salinan fungsi ini ada di `prisma/seed-articles.mjs`
  karena script .mjs tidak dapat mengimpor TypeScript — keduanya harus diubah bersamaan
- [x] Kelola `ArticleTag`/`ArticleTagLink` (tag baru dibuat otomatis, slug diturunkan supaya ejaan
  berbeda tidak jadi dua baris), toggle `isFeatured`, dan `publishedAt` otomatis
- [x] Invalidasi `articleList` + `articleFacets` + `articleDetail` tiap mutasi; slug lama ikut
  diinvalidasi saat slug berubah
- [x] Transisi `ArticleStatus` DRAFT → PUBLISHED → ARCHIVED dari form maupun langsung di baris
  daftar. Tanggal terbit pertama dipertahankan saat artikel diterbitkan ulang
- [x] Hapus artikel tersedia tetapi konfirmasinya mengarahkan ke Archived, karena hard delete ikut
  menghapus interaction user lewat cascade
- Butir `/admin/flashcard-deck` di bawah **dihapus 1 Oktober 2026** bersama perombakan flashcard
  (Fase 8.12) dan dipertahankan sebagai riwayat.
- [x] `/admin/flashcard-deck`, `/new`, `/[id]` — CRUD deck dan note, toggle `isPublished`, atur
  `order`, dan `license` wajib terisi dengan penjelasan kenapa (CC BY-SA mengikat atribusi)
- [x] Field note dirender dari definisi kanonik `FLASHCARD_NOTE_TYPES`, bukan daftar yang ditulis
  ulang; validasi field wajib dan cloze `{{c1::}}` memakai helper yang sama
- [x] `noteType` terkunci selama deck masih berisi note — jumlah dan arti field-nya berbeda per
  tipe, jadi menggantinya akan membuat field lama salah tafsir
- [x] `guid` hanya dapat diisi saat membuat note, tidak saat menyunting: guid adalah kunci
  deduplikasi salinan user (`sys:<slug>:<guid>`), dan mengubahnya menghasilkan kartu duplikat
  dengan progres kosong
- [x] UI menyatakan bahwa deck bawaan **disalin** saat user menambahkannya, jadi edit maupun
  penghapusan tidak menyentuh koleksi user yang sudah ada
- [x] Peringatan bahwa `npm run seed:flashcard-deck` memperlakukan file sebagai sumber kebenaran
  dan **menghapus** note yang tidak ada di dalamnya, sehingga penyuntingan lewat UI hilang pada
  seed berikutnya
- [x] Tombol **Fixture** mengunduh isi deck dalam bentuk `src/flashcard-deck-data/<slug>.json`
  untuk ditimpakan ke repository — ini yang menutup lingkaran antara UI dan seed. Diverifikasi:
  hasil export lolos `npm run seed:flashcard-deck:check`

### Tahap 5 — Moderasi Diskusi Publik

Naik prioritas karena fitur berbagi catatan + balasan membuat `QuestionComment` menjadi
satu-satunya konten buatan user yang terlihat publik, termasuk oleh guest.

- [x] `/admin/moderation` — antrean seluruh entri yang pernah dibagikan (`sharedAt != null`), root
  maupun balasan, terbaru dulu, dengan filter status dan pencarian isi/nama penulis. Dibatasi 100
  entri; pagination belum ada
- [x] Action takedown admin **terpisah** di `src/features/admin/moderation/actions.ts`;
  `requireOwnLiveComment()` milik user tidak disentuh
- [x] Sembunyikan root (`visibility = PRIVATE`) dan takedown (`deletedAt`) oleh admin — tidak
  pernah hard delete. Sengaja tidak ada kebalikan dari "sembunyikan": menerbitkan ulang catatan
  orang lain bukan keputusan admin
- [x] Pulihkan takedown, **hanya** untuk entri yang dihapus admin. Entri yang dihapus pemiliknya
  ditolak dengan pesan eksplisit
- [x] Takedown menyembunyikan lampiran lewat record database saja — file asli di Cloudinary
  **tidak** dihapus (di luar scope admin). Jumlah lampiran ditampilkan di antrean beserta
  keterangan ini
- [x] Riwayat kontribusi publik per user: klik nama penulis memfilter antrean dan menampilkan
  ringkasan (jumlah catatan, balasan, dan berapa kali kena takedown)
- [ ] Rate limit pembuatan catatan/balasan — sekarang tidak ada sama sekali (hanya batas 2.000
  karakter dan 4 gambar); pakai ulang pola bucket atomik `AuthRateLimit`
- [ ] Buka `/discussion` untuk mesin pencari setelah moderasi aktif: hapus `disallow` di
  `src/app/robots.ts` **dan** balik `robots: { index: false }` di
  `src/app/(public)/discussion/layout.tsx`. `robots.txt` di-prerender saat build → butuh redeploy
- [ ] Notifikasi balasan (diserahkan dari Fase 8.7, tetapi bukan fitur admin — aplikasi belum
  punya sistem notifikasi sama sekali; putuskan apakah masuk scope atau jadi fase tersendiri)
- [x] `QuestionComment.deletedById` — migration `20260925180000_comment_deleted_by`. Bukan opsional
  pada akhirnya: tanpa itu pemulihan tidak dapat membedakan takedown admin dari hapusan pemilik.
  Baris lama dibackfill sebagai hapusan pemilik
- [ ] Opsional: penanda suspend posting publik di `User` — sekarang satu-satunya cara
  menghentikan penyalahgunaan berulang adalah menghapus akunnya
- [x] Peringatan saat `FEATURES_QUESTION_DISCUSSION` mati ditampilkan di halaman moderasi (dan
  `FEATURES_ARTICLE` di halaman artikel): layar admin tetap dapat dipakai saat modul publiknya mati
- [x] Thread dan hitungannya sengaja tidak di-cache dan tidak punya tag di `CACHE_TAGS` — aksi
  moderasi tidak memanggil invalidasi apa pun

### Tahap 6 — User & Akun

- [x] `/admin/user` — daftar dengan pencarian nama/email/username dan filter: semua, admin, belum
  verifikasi, punya Google, menunggu dihapus
- [x] Filter "terakhir aktif" **tidak dibuat**: tidak ada kolom `lastActiveAt`, dan aktivitas
  session hidup di Redis sehingga tidak dapat di-query massal. Sebagai gantinya detail user
  menampilkan attempt terakhir, yang memang tersimpan di database
- [x] `password` (termasuk hash) dan isi `AuthToken` tidak pernah masuk `select` mana pun.
  "Punya password atau tidak" dijawab dengan `count`, token hanya dihitung. Diverifikasi dengan
  memindai HTML halaman detail: tidak ada pola hash bcrypt maupun tokenHash
- [x] `/admin/user/[id]` — promote/demote role, dengan dua penjagaan: admin tidak dapat
  menurunkan dirinya sendiri (role dibaca per request, jadi ia langsung kehilangan akses tanpa
  jalan kembali dari UI), dan admin terakhir tidak dapat diturunkan — aturan yang sama dengan
  `npm run user:role`
- [x] Revoke session lewat `listUserSessions`/`revokeUserSession`/`revokeAllUserSessions` di
  `src/lib/auth.ts`; tidak ada key Redis yang disentuh langsung. Mencabut session yang sedang
  dipakai admin itu sendiri ditolak, dan "cabut semua" atas akun sendiri menyisakan session ini
- [x] Reset bucket `AuthRateLimit` lewat `clearAuthRateLimits()`, yang menurunkan HMAC dengan
  fungsi yang sama seperti saat bucket dikonsumsi
- [x] Bucket beridentitas IP sengaja tidak ikut: alamat IP mentah memang tidak pernah disimpan,
  jadi bucket itu tidak dapat ditemukan dari sisi user dan hilang sendiri setelah jendelanya lewat.
  UI menyatakan batasan ini
- [x] Lihat dan batalkan `deletionRequestedAt` / `deletionScheduledFor`, lalu invalidasi
  `profileAccount`. Admin hanya dapat membatalkan, tidak pernah menjadwalkan: meminta penghapusan
  akun adalah keputusan pemiliknya

### Tahap 7 — Conversation & Operasional

- [x] `/admin/conversation` — agregat 30 hari, ringkasan session per status, dan tabel
  `ConversationQuota` per user per hari: turn, detik audio, token
- [x] Turn dengan `moderationFlagged = true`, 50 terbaru
- [x] Hitungan session dengan `retentionExpiresAt` lewat tetapi transcript-nya masih tersimpan
- [ ] Aksi membersihkan retensi yang lewat — baru dilaporkan, belum ada tombolnya
- [x] Transcript hanya ditampilkan bila `transcriptRetained = true`. Penyaringannya di layer
  query, bukan di JSX: kalau hanya disembunyikan di komponen, isinya tetap ikut terkirim dalam
  payload halaman
- [x] `/admin/ops` — status seluruh `FEATURES_*` read-only, dengan alasan kenapa read-only
- [x] Tombol invalidasi manual untuk tag global (`testPackageList`, `practiceCatalog`,
  `articleList`, `articleFacets`, `flashcardSystemCatalog`). Tag per-entitas sengaja tidak
  ditawarkan: butuh id dan sudah diinvalidasi otomatis oleh action yang mengubah entitasnya
- [x] Tabel `AdminAuditLog` (aktor, nama aktor sebagai snapshot, aksi, target, ringkasan,
  timestamp) — migration `20260925210000_admin_audit_log`. `actorId` SET NULL supaya menghapus
  akun admin tidak ikut menghapus jejaknya
- [x] Seluruh 18 action admin yang bermutasi mencatat ke audit log. Untuk aksi yang menulis ke
  database, lognya ada di transaksi yang sama sehingga tidak pernah ada mutasi tanpa catatannya;
  untuk aksi berefek di Redis (cabut session, reset rate limit) lognya ditulis setelahnya dan
  kegagalannya tidak membatalkan aksi yang sudah terjadi
- [x] Layar riwayat di `/admin/ops`

### Verifikasi

- [x] Guard diuji lewat HTTP pada dev server: guest → `/admin`, `/admin/user`, `/admin/ops` semua
  404 (tanpa redirect ke login); user login berrole `USER` → 404 di `/admin` tetapi 200 di
  `/dashboard`; setelah promote ke `ADMIN` **dengan cookie session yang sama** → 200
- [x] Promote berlaku seketika tanpa login ulang, membuktikan role tidak diambil dari JWT
- [ ] Demote diuji dengan cara yang sama (kebalikannya) setelah ada admin kedua
- [x] Setiap Server Action admin (artikel dan moderasi) memanggil `requireAdmin()` sendiri, tidak
  bergantung pada layout
- [x] Antrean moderasi diuji lewat HTTP dengan data uji: root tampil dengan tombol sembunyikan +
  takedown, balasan hanya takedown (tidak punya toggle visibility sendiri), entri yang dihapus
  pemilik tanpa tombol pulihkan, dan entri hasil takedown admin dengan tombol pulihkan beserta nama
  admin yang menghapusnya. Data uji sudah dibersihkan
- [ ] Uji manual dua akun untuk alur artikel: buat draft, terbitkan, ubah slug, arsipkan (user)
- [ ] Data-leak: query/komponen admin terpisah dari jalur exam; `QUESTION_EXPLANATION_SELECT`
  tidak dilonggarkan demi admin
- [ ] Unit test minimal untuk aksi destruktif: import paket, hapus paket, takedown komentar
- [ ] `npm run verify` lulus

## Migrasi Storage — Cloudinary → Cloudflare R2 (S3-compatible)

Ruang lingkup: **uploader user saja** (avatar profil dan lampiran gambar komentar). Media bank soal
di `src/test-package-data/` tetap memakai URL Cloudinary read-only; migrasi aset tersebut belum
dikerjakan. Detail operasional ada di `docs/operations/storage.md`.

- [x] Install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, copot package `cloudinary`
- [x] Env `CLOUDINARY_*` diganti `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET`, `R2_PUBLIC_BASE_URL` di `src/constants/index.ts`, `.env.example`, dan
  `.github/workflows/quality.yml`
- [x] `src/constants/storage.ts` — batas ukuran, dimensi, dan content-type yang dipakai bersama
  client dan server (tidak boleh dari `@/constants` yang mem-parse `process.env`)
- [x] `src/lib/r2.ts` menggantikan `src/lib/cloudinary.ts`: presign PUT, HeadObject, DeleteObject
- [x] `src/lib/storage-keys.ts` — pola object key dan parser header WebP, bebas env agar bisa diuji
- [x] Presigned PUT mengikat `content-type` **dan** `content-length` lewat `signableHeaders`
  (presigner S3 menandai content-type unsignable secara default), sehingga R2 sendiri yang menolak
  tipe/ukuran di luar batas — batas tidak lagi bergantung pada validasi client
- [x] Avatar di-crop tengah dan di-resize ke 512x512 WebP di browser via Canvas, pengganti
  `c_fill,g_auto,h_512,w_512` milik Cloudinary yang tidak ada padanannya di R2
- [x] Verifikasi avatar server-side tanpa Admin API: HeadObject untuk tipe dan ukuran, lalu 64 byte
  pertama dibaca untuk memastikan dimensi benar-benar 512x512
- [x] Action `getAvatarUploadSignatureAction` → `createAvatarUploadAction`, dan
  `getCommentImageUploadSignatureAction` → `createCommentImageUploadAction`, keduanya divalidasi zod
- [x] `src/app/api/cloudinary/signature/route.ts` dihapus — duplikat server action dan tidak punya
  pemanggil
- [x] Redis sorted set pending avatar pindah key ke `{REDIS_PREFIX}:r2:pending-avatars`
- [x] Aset lama tetap dibaca: URL Cloudinary diterima saat komentar disunting, dan `avatarPublicId`
  warisan dilewati saat penghapusan (`destroyManagedAvatar` → `"skipped"`)

### Bug yang ikut diperbaiki

- [x] `isManagedAvatarPublicId(publicId)` tanpa `userId` selalu `false` karena sisa string masih
  memuat segmen `{userId}/`. Akibatnya `destroyManagedAvatar` selalu melempar dan
  `scheduleAvatarCleanup` selalu keluar lebih awal — penghapusan avatar lama dan cleanup orphan
  tidak pernah benar-benar jalan. Diganti pola regex penuh yang mencocokkan segmen user
- [x] Server menolak `commentImages` yang bukan hasil upload user tersebut; sebelumnya schema hanya
  memeriksa bentuk URL sehingga host mana pun bisa disimpan ke komentar
- [x] Uploader multi-file memakai snapshot `value` lama di dalam loop sehingga upload berurutan
  saling menimpa; hasil kini diakumulasi ke daftar lokal

### Verifikasi

- [x] `npm run lint`, `npm run typecheck`, `npm run test` (236 test, termasuk 12 test baru untuk
  parser header WebP dan pola object key)
- [ ] `npm run build` — butuh kredensial R2 asli di `.env`
- [ ] Uji manual di browser: upload avatar, ganti avatar (file lama terhapus dari bucket), upload
  beberapa lampiran komentar sekaligus, dan sunting komentar lama yang gambarnya masih di Cloudinary
- [ ] CORS bucket R2 dipasang untuk origin produksi dan `http://localhost:3000`
- [ ] Env R2 diisi di Vercel (production/preview/development)

## Fase 8.8 — Username Publik, Mention Relasional, Anonimisasi Akun, Halaman Diskusi

Lanjutan Fase 8.7. Dipicu satu temuan: `QuestionComment.userId` memakai `onDelete: Cascade`
sementara cron penghapusan akun melakukan hard delete `User`, sehingga satu penghapusan akun ikut
memusnahkan balasan pengguna lain pada thread miliknya.

- [x] `User.username` jadi `NOT NULL @unique @db.VarChar(30)` dan berubah peran menjadi **nama
  publik**, bukan kredensial. Jalur login-by-username dihapus — login email saja, supaya handle
  yang tampil di setiap komentar tidak menjadi identifier login semua orang
- [x] Aturan handle ala Instagram di `src/lib/username.ts` (huruf kecil, angka, titik, underscore,
  3–30, titik tidak di ujung/berurutan) + daftar kata terlarang berisi segmen route dan akhiran
  `_deleted`, supaya user hidup tidak bisa menyamar sebagai akun tombstone
- [x] Generate otomatis saat register credential dan Google (`generateUniqueUsername`, suffix acak
  agar jumlah user tidak bocor); editable dari `/profile`
- [x] Migrasi `20260926090000_public_username_and_account_anonymization` — backfill slug dari
  `displayName`, fallback, dedupe, lalu `SET NOT NULL`
- [x] `QuestionComment.userId` diubah dari `Cascade` ke `Restrict`
- [x] Penghapusan akun jadi **anonimisasi** (`anonymizeAccount`): baris `User` bertahan, comment
  di-soft delete jadi tombstone, dan data pribadi yang dulu ikut terhapus cascade (flashcard,
  attempt, practice, kana, article interaction, conversation, token, OAuth) dihapus eksplisit.
  `OAuthAccount` wajib dihapus atau login Google menghidupkan akun kembali
- [x] Username akun terhapus memakai format `<username_lama>_<unix>_deleted` sesuai permintaan
  produk. Handle lama ikut tersimpan, jadi anonimisasinya tidak penuh — dicatat di
  `docs/module/auth.md`. Dipotong agar muat 30 karakter, bentrok diselesaikan dengan salt acak
- [x] `loginAction` menolak akun ber-`anonymizedAt`
- [x] Mention jadi relasi `repliedToId` (SetNull), bukan teks `@nama` di `commentText`. Divalidasi
  harus menunjuk comment hidup di thread yang sama; tidak dirender bila tujuannya dihapus
- [x] `/discussion` (indeks semua diskusi per soal, aktivitas terbaru dulu) dan
  `/discussion/question/[questionId]` (seluruh thread satu soal). `DiscussionQuestionCard` dipakai
  bersama ketiga halaman diskusi
- [x] Nav publik dapat entri "Diskusi" di balik `FEATURES_QUESTION_DISCUSSION`
- [ ] Verifikasi manual (user): ganti username lalu pastikan mention lama ikut berubah; uji
  request deletion sampai cron berjalan dan cek thread tetap utuh
- [ ] Setiap relasi personal baru pada `User` wajib ditambahkan ke `anonymizeAccount` — belum ada
  test otomatis yang menjaga ini

## Fase 8.9 — Bugfix Hitungan Lembar Jawaban + Hasil untuk Guest

Dua temuan dari testing manual user pada `/exam/[attemptId]/[session]`.

- [x] Bug: soal terakhir yang baru dijawab belum terhitung saat submit ("1 soal belum dijawab"
  padahal sudah penuh), dan baru benar setelah pindah soal. Penyebabnya `answeredMap` di
  `exam-runner.tsx` di-memo dengan dep `[questions, hydrated]` — keduanya tidak berubah saat
  menjawab, jadi seluruh hitungan (badge `n/total`, dialog submit, legend) baru menyegar ketika
  navigasi memicu RSC refetch dan mengganti identitas `questions`. Grid lembar jawaban tidak
  terkena karena memanggil `getAnswer` langsung
- [x] Dep diganti `[questions, getAnswer]`; identitas `getAnswer` berubah setiap jawaban diedit
  karena context value di `exam-provider.tsx` di-memo atas `[answers, hydrated]`
- [x] Fallback "lompat ke soal pertama yang belum dijawab" dipisah jadi `restoredEntryIndex` yang
  sengaja tetap snapshot hydration — kalau ikut reaktif, menjawab soal yang sedang dibuka akan
  menggeser fallback dan melempar user ke soal lain selama URL belum ber-`questionNumber`
- [x] Guest kini melihat hasil: submit session terakhir diarahkan ke `/result/guest`, bukan
  langsung ke mode baca paket
- [x] `getGuestAttemptSummary` di `src/features/result/actions.ts` — menilai di server (kunci
  jawaban tidak pernah ke client), penyebut dari seluruh soal pada scope sehingga session yang
  dilewati terhitung kosong
- [x] `src/features/result/components/guest-result.tsx` mengumpulkan lembar jawaban seluruh
  session dari `sessionStorage` lewat prefix `exam-state-0-`; tidak ada key sama sekali → empty
  state ber-CTA daftar, bukan skor 0%
- [x] UI ringkasan diekstrak ke `ResultSummaryView` dan dipakai bersama `/result/[attemptId]`
  supaya tidak ada dua salinan yang melenceng. Guest tidak mendapat durasi, review per soal,
  riwayat, maupun analitik, dan hasilnya hilang saat tab ditutup
- [x] Helper bersama: `src/features/exam/storage.ts` (key sessionStorage) dan
  `src/features/exam/guest-cookie.ts` (`readGuestExamCookie`, `GUEST_EXAM_COOKIE`)
- [x] Verifikasi: `npm run lint`, `npm run typecheck`, `npm run test` (258 test), dan
  `npm run build` lulus; `/result/guest` terdaftar sebagai route `ƒ`
- [ ] Verifikasi manual (user): jawab soal terakhir lalu submit tanpa pindah soal (Belum = 0);
  buka sesi setengah jadi tanpa `?questionNumber` dan pastikan tidak melompat saat menjawab;
  selesaikan mock penuh sebagai guest dan cek hasil lintas session

### Klaim hasil guest ke akun

Lanjutan permintaan user: CTA login/register pada halaman hasil guest yang langsung mengimpor
pekerjaan lalu membersihkan penyimpanan sementara.

- [x] Temuan yang mengubah rancangan: membawa jawaban di `sessionStorage` melewati auth hanya
  bekerja untuk login. `registerAction` tidak membuat session — user dibuat `emailVerifiedAt: null`
  lalu diarahkan ke `/verify-email`, dan session baru lahir di `confirmEmailAction` yang dipicu dari
  tautan email, hampir selalu di tab baru. `sessionStorage` per-tab, jadi jalur register (justru
  jalur yang paling mungkin dipakai guest) akan selalu kehilangan jawabannya
- [x] Solusi: jawaban dipindahkan ke server saat CTA diklik, sebelum auth, memakai pola
  `google-oauth-state.ts` — token acak di cookie httpOnly + payload Redis ber-TTL 24 jam,
  `getdel` sekali pakai. Cookie dibagi lintas tab sehingga tab dari tautan email tetap bisa
  menyelesaikan impor
- [x] `src/features/result/lib/guest-attempt-stash.ts`, `stashGuestAttemptAction`, dan
  `importGuestAttemptAction`
- [x] `Attempt` hasil impor `COMPLETED` dengan satu row per soal pada scope; `isCorrect` dihitung
  ulang dari kunci, dan cache dashboard/analytics/profile diinvalidasi seperti submit biasa
- [x] Cookie guest kini mencatat `startedAt` saat exam dimulai supaya durasi attempt nyata
- [x] Setelah impor: cookie `jlpt_guest_exam` + titipan dihapus server-side, `sessionStorage`
  dibersihkan client-side, lalu redirect ke `/result/[attemptId]`
- [x] `?import=1` sebagai penanda kembalian auth supaya membuka `/result/guest` sambil login tidak
  mengimpor diam-diam; layar "Menyimpan ke Akunmu" menggantikan empty state selama klaim berjalan
- [x] Verifikasi: guest mengerjakan Choukai N1 lalu menekan CTA — berpindah ke
  `/register?next=%2Fresult%2Fguest%3Fimport%3D1` dan titipan terbukti mendarat di Redis (TTL 24 jam,
  `startedAt` terisi, jawaban utuh). `npm run lint`, `typecheck`, `test`, `build` lulus
- [ ] Verifikasi manual (user): belum diuji dengan akun sungguhan karena butuh kredensial. Perlu
  dicek dua jalur — login (tab sama) dan register (tautan verifikasi email di tab baru) — sampai
  attempt muncul di `/history` dengan durasi wajar dan review per soal terbuka

## Fase 8.10 — SEO Metadata, Preview Share, dan Structured Data

Permintaan user: melengkapi metadata supaya SEO bagus dan tautan yang dishare punya preview.

### Dua bug yang ditemukan saat audit

- [x] **Canonical bocor ke seluruh situs.** Root layout menyetel `alternates.canonical: "/"`.
  Field metadata diwarisi bila segmen di bawahnya tidak menyetelnya, jadi setiap halaman selain
  lima yang punya canonical sendiri memancarkan `<link rel="canonical" href="https://…/">` —
  menyatakan dirinya duplikat homepage dan berhenti diindeks. Canonical dicabut dari root dan
  sekarang selalu per halaman
- [x] **`openGraph` di-merge shallow.** Begitu sebuah halaman menulis `openGraph`, seluruh objek
  dari root dibuang: `siteName`, `locale`, dan **gambarnya** ikut hilang. Homepage dan index
  artikel sudah kehilangan `og:image` sebelum perubahan ini. `opengraph-image` root hanya mengisi
  segmen root, jadi gambar default kini disebut eksplisit lewat `pageMetadata()`

### Fondasi

- [x] `src/lib/seo.ts` — `pageMetadata()` merakit title/description/canonical/OG/Twitter sekaligus
  supaya tidak ada halaman yang menulis `openGraph` mentah lagi; `privateMetadata()` untuk halaman
  yang tidak layak diindeks; flag `ownSegmentImage` bagi segmen yang punya `opengraph-image` sendiri
- [x] `src/lib/json-ld.ts` + `src/components/seo/json-ld.tsx` — builder schema.org dan penyuntiknya
  (`<` di-escape karena judul dari database bisa menutup tag `</script>`)

### Cakupan halaman

- [x] 24 halaman yang sebelumnya tanpa metadata kini punya judul sendiri; yang privat
  (`/exam`, `/result`, dashboard, flashcard deck, sesi latihan, conversation, speaking) `noindex`
- [x] `noindex` dipasang di layout `(auth)`, `(dashboard)`, `/exam`, `/result` supaya route baru di
  bawahnya ikut terlindungi. `robots.txt` saja tidak cukup: URL yang dilink dari luar tetap bisa
  masuk indeks tanpa dirayapi
- [x] `/test-package/[id]` dan `/test-package/[id]/questions` — `generateMetadata` dengan jumlah
  soal, sesi, dan durasi resmi dari `src/features/test-package/queries.ts` (query terpisah dari
  `actions.ts` karena yang di sana memanggil `getSession()` dan akan membatalkan prerender)

### Gambar preview

- [x] `alt` pada `opengraph-image` root (`og:image:alt` sebelumnya kosong) dan `twitter-image.tsx`
  baru supaya `twitter:image` tidak bergantung pada fallback ke `og:image`
- [x] Kartu OG per paket ujian (level, nama, sesi, durasi, jumlah soal) mengikuti pola cover
  artikel. Dua file `opengraph-image.tsx` — segmen anak yang menulis `openGraph` sendiri tidak
  mewarisi gambar dari induknya

### Structured data, manifest, sitemap

- [x] `EducationalOrganization` + `WebSite` (dengan `SearchAction` saat modul artikel hidup) di root;
  `BlogPosting`, `Quiz`, `LearningResource`, dan `BreadcrumbList` di halaman terkait
- [x] Manifest: ikon PNG 192/512 + varian `maskable` lewat `/app-icon/[variant]`. Android
  mengabaikan ikon SVG saat menilai kelayakan install
- [x] Sitemap memuat detail paket dan mode bacanya (6 → 102 URL); `robots.ts` menutup sesi latihan
  dan koleksi flashcard pribadi
- [x] Verifikasi: `lint`, `typecheck`, `test`, `build` lulus; `next start` dicek per halaman —
  canonical benar per URL, `og:image` + `og:image:alt` + `twitter:image` terisi di seluruh halaman,
  JSON-LD terparse, manifest dan sitemap sesuai
- [ ] Verifikasi manual (user): tempel URL produksi ke WhatsApp/X/Facebook debugger dan daftarkan
  sitemap di Google Search Console

## Fase 8.11 — Laporan Pengguna (Report)

Permintaan user: fitur report untuk bug dan hal umum lain, tampil di halaman publik, dengan relasi
non-mandatory ke soal, pembahasan, atau modul lain, supaya tombol "Laporkan" di UI ikut membawa id
yang bersangkutan. Ditampilkan di halaman admin.

Keputusan yang diambil sebelum implementasi: form publik saja (daftar laporan tidak publik), guest
boleh melapor dengan Turnstile, relasi memakai enum `targetType` + FK nullable, kategori dibatasi
oleh target, dan balasan hanya lewat email serta opsional. Rancangan lengkap:
[docs/module/report.md](module/report.md).

### Schema dan data

- [x] Tiga enum + model `Report`, migration `20260926230000_report_inbox` (SQL tulis tangan +
  `migrate deploy`; `migrate dev` tidak dipakai karena shadow database Supabase)
- [x] FK target `questionId`/`articleId`/`commentId` seluruhnya `ON DELETE SET NULL` + snapshot
  `targetLabel` supaya laporan tetap terbaca setelah targetnya dihapus
- [x] `Report_target_columns_check` menolak kombinasi kolom yang salah kabel. Sisi "harus ada"
  sengaja tidak di database: dengan `SET NULL`, CHECK itu akan menggagalkan penghapusan soal
- [x] `Report_reply_shape_check` — `repliedAt` dan `replyMessage` harus terisi bersama
- [x] Tiga partial unique index: satu pelapor yang dikenal hanya boleh punya satu laporan `OPEN` per
  target; pelanggaran `P2002` diterjemahkan menjadi pesan yang jelas
- [x] `anonymizeAccount` mengosongkan `reporterId` + `replyEmail` tanpa menghapus laporannya
- [x] Retensi `replyEmail` 90 hari untuk laporan yang sudah ditutup, dijalankan cron `auth-cleanup`

### Jalur kirim

- [x] Peta kategori per target sebagai satu konstanta yang dipakai form, zod, dan layar admin
- [x] `submitReportAction`: Turnstile (action `report` baru) untuk pengirim tanpa session, rate limit
  per IP/akun lewat bucket `AuthRateLimit` yang sudah ada, target diverifikasi ulang di server, dan
  `targetLabel` dibangun dari baris database — bukan dari client
- [x] Halaman publik `/report` (`noindex, follow`) + tautan footer yang mengikuti flag
- [x] `ReportButton` + dialog di tempat, tanpa navigasi; tidak ada `revalidatePath` pada route exam
  supaya state jawaban dan timer tidak terganggu
- [x] Dipasang di exam runner, latihan cepat, mode baca paket, review hasil, kartu pembahasan,
  halaman artikel, dan thread diskusi (root + balasan, guest juga boleh melapor)
- [x] Transport SMTP diangkat ke `src/lib/mailer.ts` supaya balasan laporan tidak membuat transport
  kedua; template email auth tetap di modul auth

### Sisi admin

- [x] `/admin/report`: tab status, filter target dan kategori, pencarian, 100 baris terbaru
- [x] Aksi `Tinjau`/`Selesai`/`Tolak`/`Duplikat` + catatan internal, masing-masing menulis
  `AdminAuditLog` di transaksi yang sama
- [x] Balasan email opsional: satu kali per laporan, email dikirim sebelum barisnya ditulis, dan isi
  laporan asli tidak pernah dikutip ke dalam email
- [x] Kolom "+N laporan lain di target ini", tautan ke layar perbaikan, dan laporan komentar
  diarahkan ke `/admin/moderation` alih-alih membuat jalur takedown kedua
- [x] Entri sidebar, kartu overview, dan baris "perlu perhatian" di `/admin`

### Verifikasi

- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` lulus
- [ ] Verifikasi manual (user): kirim laporan sebagai guest (Turnstile) dan sebagai user login, cek
  laporan muncul di `/admin/report`, coba ubah status, lalu kirim satu balasan email dan pastikan
  isi laporan tidak ikut terkutip di email yang diterima

### Yang sengaja ditunda

- [ ] Kartu flashcard sebagai target laporan. Hambatan backfill-nya hilang sejak Fase 8.12: kartu
  user kini merujuk kata di katalog, jadi memperbaiki fixture langsung memperbaiki semua kartu
- [ ] Notifikasi admin saat laporan masuk
- [ ] Halaman status laporan untuk pelapor
- [ ] Lampiran gambar pada laporan
- [ ] `DUPLICATE` yang menunjuk laporan induknya

## Fase 8.12 — Perombakan Flashcard: Katalog Kosakata Bawaan

Flashcard tidak lagi meniru Anki sebagai koleksi pribadi. Isinya kini satu katalog kosakata JLPT
yang digenerate AI dari daftar kata deck Anki, dengan deck per level, topik, dan kategori.
Keputusan desain dan alasannya ada di `docs/module/flashcard.md`; kontrak datanya di
`docs/seed-flashcard.md`.

### Keputusan yang dikunci (1 Oktober 2026)

- [x] Lisensi konten: Nihongofy. `.apkg` sumber dipakai hanya sebagai daftar kata; arti, contoh
  kalimat, catatan, dan tag ditulis ulang AI; audio tidak dibawa.
- [x] Konten buatan user dihapus (deck sendiri, impor/ekspor, card browser yang mengedit, preset
  per deck, editor deck bawaan di admin).
- [x] Kartu user merujuk katalog, tidak menyalin. Satu kata = satu kartu per user.
- [x] Kata yang sama digabung (beberapa makna dalam satu kartu); kata lintas level masuk level
  termudah; homograf tetap terpisah dan bacaan lainnya disebut di catatan.
- [x] Satu kata boleh ada di beberapa deck (tag), progresnya satu.
- [x] Pengaturan per user: ukuran teks, furigana sisi belakang, dan penjadwalan Anki dengan nilai
  bawaan dari deck options pemilik project; batas harian 20 kartu baru / 9999 review untuk semua
  deck.

### Pekerjaan

- [x] Taxonomy tag `src/flashcard-data/taxonomy.json`: 5 dimensi (level, kelas kata, ragam,
  kategori, topik), 84 tag, 52 deck.
- [x] `npm run flashcard:extract`: daftar kata dari `.apkg` (zip + zstd + SQLite), normalisasi
  furigana Anki, penggabungan, key stabil. Hasil: 6.697 kata.
- [x] `npm run gen:flashcard`: generator isi kartu per batch, validasi per kata dengan retry,
  tanpa menimpa kata yang sudah terisi. Validator markup dipindah ke
  `prisma/japanese-markup-check.mjs` dan dipakai bersama `gen:explanation`.
- [x] `npm run seed:flashcard` (+ `:check`) dan `npm run flashcard:doubts`.
- [x] Skema baru dan migration `20261001120000_flashcard_vocab_catalog` (drop + create, RLS dan
  revoke grant Data API). Diuji di transaksi yang di-rollback dan di schema Postgres sementara.
- [x] Antrean disederhanakan untuk deck datar, ditambah learn ahead 20 menit dan kartu learning
  yang kembali dalam sesi yang sama; opsi review sort `descendingRetrievability` dan `random`.
- [x] Tunda/suspend sebagai kolom (memperbaiki bug lama: kartu tertunda tidak pernah muncul lagi
  dan jadwal aslinya tertimpa); undo memakai snapshot kartu.
- [x] Halaman katalog, deck dengan daftar kata read-only, sesi belajar, pengaturan, statistik,
  dan mode coba guest.
- [x] `.apkg` di-ignore (`*.apkg`, 136 MB).
- [x] Verifikasi: lint, typecheck, 197 unit test, `npm run build`; alur data dan server action
  diuji terhadap Postgres di schema sementara.
- [x] Percepatan generator (1 Okt 2026): satu pool lintas level, bawaan batch 20 dan paralel 6
  (maks 16), progres dan perkiraan sisa waktu, log alasan percobaan ulang. Prompt v3 menurunkan
  kata yang perlu percobaan ulang dari 10-14% ke ±2% (lihat tabel di `docs/seed-flashcard.md`).
  Bug ekstraksi bacaan ganda (お茶 → おおちゃ, 9 kata) diperbaiki dan key-nya dikoreksi sebelum
  seed pertama. Peringatan homograf tidak lagi salah lapor bila bacaan lain ditulis bermarkup.

### Langkah tersisa (dijalankan pemilik project)

- [x] `npx prisma migrate deploy` (1 Okt 2026). Sampai kode baru ter-deploy, kode production lama
  masih membaca tabel flashcard lama: overview admin, ekspor akun, dan penghapusan akun error.
- [ ] Commit dan deploy kode flashcard baru (flag tetap mati).
- [ ] `npm run gen:flashcard` sampai semua kata terisi (908 dari 6.697 per 1 Okt 2026).
- [ ] Tinjau `npm run flashcard:doubts`.
- [ ] `npm run seed:flashcard`.
- [ ] Uji manual di browser, lalu nyalakan `FEATURES_FLASHCARD`.

## Fase 9 — Verifikasi & Polish

- [ ] `npm run build` setelah tiap perubahan struktural/server action/caching
- [ ] Audit data-leak guard: pastikan `questionAnswer`/`explanation` tidak pernah terkirim ke client sebelum attempt disubmit
- [ ] Cek tema light/dark (CSS variables shadcn) konsisten di semua halaman
- [ ] Uji manual end-to-end: register → login → pilih paket → kerjakan (mock test & latihan per seksi) → submit → lihat hasil → tambah comment → cek analytics
