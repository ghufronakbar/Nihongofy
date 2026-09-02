# Roadmap Kematangan Modul

Dokumen ini adalah urutan implementasi yang direkomendasikan untuk membawa seluruh modul di
[`docs/module`](../module/index.md) dari kondisi sekarang menuju kondisi production-ready.
Urutan disusun berdasarkan dependensi, risiko terhadap kepercayaan user, dan biaya rework.

Audit dasar: **2 September 2026 (WIB)**. Dokumen ini bersifat living document; centang item hanya
setelah implementasi selesai dan perilakunya sudah diverifikasi user.

## Rekomendasi Utama

Jangan mulai dari Dashboard, Analytics, atau Conversation. Ketiga area tersebut adalah consumer
dari data yang dihasilkan modul lain. Jika kontrak data, kualitas konten, dan lifecycle attempt
masih berubah, pekerjaan reporting atau AI akan banyak diulang.

Urutan yang disarankan:

1. Engineering baseline dan checklist verifikasi manual.
2. Authentication, account lifecycle, dan keamanan media.
3. Content pipeline, renderer teks Jepang, dan katalog paket.
4. Exam, Result, dan History sebagai satu vertical slice.
5. Latihan Cepat.
6. Shared Study, Vocabulary, dan Kana.
7. Dashboard, Analytics, dan Progress.
8. Article dan Public Shell.
9. Conversation dan Speaking.
10. Audit production readiness seluruh sistem.

```text
Engineering baseline
├── Auth + Profile + media ownership
├── Content Data -> Japanese Rendering -> Test Package
│                                      -> Exam -> Result -> History
├── Content Data + Test Package -> Practice
└── Study foundation -> Vocabulary / Kana

Semua learning activity -> Dashboard -> Analytics -> Progress
Article + status modul   -> Public Shell
Auth + Study + privacy + observability -> Conversation -> Speaking
```

## Keputusan Scope Implementasi

- Tidak menambahkan test framework atau automated unit/integration/end-to-end test pada roadmap
  saat ini. Functional testing dan user acceptance testing dilakukan langsung oleh user.
- Setiap pekerjaan tetap wajib lulus lint, typecheck, dan build. Developer harus menyerahkan
  checklist skenario yang perlu diuji user setelah implementasi.
- Backup, restore, dan rollback operasional ditunda dan bukan pekerjaan tahap awal.
- Mekanisme fixture serta script seed yang ada dipertahankan. Perbaikan content dilakukan pada
  data/fixture dan memakai validation serta seed yang sudah tersedia, bukan membangun seed system
  baru.

## Definisi "Mature"

Sebuah modul belum dianggap mature hanya karena happy path dapat digunakan. Modul dianggap mature
jika memenuhi seluruh kondisi berikut sesuai scope produknya:

- Kontrak data dan lifecycle state jelas serta dijaga oleh server/database, bukan hanya UI.
- Semua input, ownership, dan authorization divalidasi ulang di server.
- Tidak ada known issue severity tinggi yang dapat merusak data, membocorkan jawaban, atau
  menyesatkan user.
- Happy path, error path, refresh/resume, concurrency, dan boundary penting sudah melewati
  checklist pengujian manual oleh user.
- Loading, empty, error, retry, dan guest/authenticated state memiliki perilaku yang jelas.
- Cache, invalidation, pagination, timezone, dan kebutuhan skala sudah ditentukan.
- Aktivitas penting dapat diobservasi tanpa mencatat password, token, jawaban rahasia, atau data
  sensitif lain.
- Dokumentasi kondisi aktual, keputusan produk, dan operasi ikut diperbarui.

## Prioritas

| Prioritas | Arti | Contoh pada kondisi sekarang |
|---|---|---|
| P0 | Release blocker: security, data corruption, answer leakage, atau hasil salah | Submit sesi exam dapat diulang; payload jawaban dapat tidak lengkap; upload asset belum memiliki lifecycle aman |
| P1 | Core trust dan reliability | Kualitas bank soal, renderer multiline, password recovery, resume attempt, scheduler concurrency |
| P2 | Retention dan insight | Dashboard personal, history terpadu, analytics lintas modul, vocabulary catalog |
| P3 | Expansion | Conversation AI, transcription, pronunciation feedback, dan fitur tambahan non-core |

## Fase 0 — Engineering Baseline dan Checklist Verifikasi

**Tujuan:** membuat perubahan fase berikutnya aman untuk dilakukan dan mudah diverifikasi.

### Pekerjaan

- [x] Selesaikan error lint yang ada dan jadikan lint, typecheck, serta build sebagai baseline
  wajib setelah perubahan.
- [x] Buat template checklist pengujian manual untuk register/login, start exam, submit, result,
  practice, vocabulary review, kana review, article detail, dan profile.
- [x] Tambahkan checklist audit answer-key leakage: payload exam dan soal practice yang belum
  dijawab tidak boleh membawa `questionAnswer` atau `explanation`.
- [x] Catat kebutuhan migration secara ringkas ketika schema berubah.
- [x] Tambahkan structured server logging dan error monitoring dengan redaction untuk cookie,
  token, password, answer key, serta data sensitif.
- [x] Tetapkan severity bug, release checklist, dan owner untuk content incident serta security
  incident.

Artefak implementasi Phase 0:

- [Engineering baseline](../operations/engineering-baseline.md) untuk gate `npm run verify`, format
  handoff, serta kontrak structured logging/error monitoring.
- [Checklist pengujian manual](../verification/manual-test-checklist.md) untuk seluruh critical flow
  dan audit answer-key leakage.
- [Catatan migration](../operations/migrations.md) untuk template serta ledger perubahan schema/data.
- [Release dan incident management](../operations/release-and-incidents.md) untuk severity, release
  gate, dan role owner content/security incident.

Implementasi kode dan dokumen diselesaikan pada 2 September 2026. Acceptance checklist dikonfirmasi
user pada 2 September 2026; Fase 0 dinyatakan selesai.

### Exit Criteria

- Lint, typecheck, dan build lulus.
- Tersedia checklist pengujian manual per critical flow beserta expected result.
- Setiap fase berikutnya menyerahkan daftar skenario perubahan untuk diuji user.

---

## Fase 1 — Identity, Account Lifecycle, dan Media Security

**Modul utama:** [Authentication](../module/auth.md), [Profile](../module/profile.md), dan
[Question Comment](../module/question-comment.md).

**Alasan didahulukan:** semua progress, attempt, comment, save/favorite, dan fitur AI kelak terikat
ke identitas user. Account recovery dan asset ownership harus stabil sebelum aktivitas user
bertambah banyak.

### 1.1 Authentication

- [ ] Implementasikan verifikasi email dan resend dengan token sekali pakai, expiry, rate limit,
  serta pesan yang tidak membocorkan keberadaan akun.
- [ ] Implementasikan forgot/reset password dengan revocation strategy untuk JWT lama.
- [ ] Tambahkan `sessionVersion` atau mekanisme ekuivalen agar change password, logout-all, dan
  security incident dapat mencabut session lama tanpa wajib mengganti arsitektur menjadi session
  table.
- [ ] Minta re-authentication untuk perubahan email dan operasi account berisiko tinggi.
- [ ] Tambahkan cleanup untuk `AuthRateLimit` dan token expired.
- [ ] Siapkan skenario pengujian manual untuk normalization email, akun legacy, duplicate race,
  brute-force limit, expired token, safe redirect, dan logout-all.
- [ ] Pertahankan scope credential auth minimal. OAuth dan MFA bukan blocker kecuali target produk
  berubah atau threat model mengharuskannya.

### 1.2 Profile dan Account Lifecycle

- [ ] Tambahkan timezone user; gunakan preference ini untuk SRS, filter tanggal, dan format waktu.
- [ ] Implementasikan export data akun dan delete account dengan grace period serta kebijakan
  penghapusan relasi yang terdokumentasi.
- [ ] Tambahkan privacy preference minimum untuk penyimpanan audio/conversation sebelum modul AI
  dibuka.
- [ ] Perbaiki lifecycle avatar: validasi resource milik aplikasi/user, batasi format/ukuran, dan
  hapus asset lama atau orphan secara aman.
- [ ] Pastikan statistik profile memakai definisi aktivitas yang sama dengan reporting di Fase 6.

### 1.3 Question Comment dan Upload

- [ ] Perbaiki stale closure pada multi-upload agar semua URL lampiran dipertahankan.
- [ ] Validasi public ID/folder Cloudinary di server, bukan hanya bentuk URL.
- [ ] Terapkan batas format, ukuran, jumlah file, dan transform pada jalur upload yang dipercaya.
- [ ] Simpan metadata asset yang cukup untuk melakukan destroy saat lampiran/comment dihapus.
- [ ] Tambahkan idempotency serta checklist upload parsial, retry, edit bersamaan, delete, dan
  orphan cleanup untuk diverifikasi user.
- [ ] Putuskan scope produk: tetap sebagai catatan pribadi. Fitur forum/moderasi publik tidak perlu
  ditambahkan kecuali ada keputusan produk baru.

### Exit Criteria

- User dapat memulihkan dan mengamankan akun tanpa intervensi manual database.
- JWT lama dapat dicabut pada operasi keamanan.
- Tidak ada upload yang dapat mengklaim asset user lain atau meninggalkan orphan tanpa mekanisme
  cleanup.
- Seluruh query user-owned sudah diaudit dan skenario ownership/isolation sudah diverifikasi user.

---

## Fase 2 — Content Truth, Japanese Rendering, dan Test Package

**Modul utama:** [Content Data](../module/content-data.md),
[Japanese Content Rendering](../module/japanese-content-rendering.md), dan
[Test Package](../module/test-package.md).

**Alasan:** Exam, Practice, Result, Analytics, dan sebagian besar kepercayaan produk berasal dari
bank soal yang sama. UI yang matang tidak dapat menutupi answer key salah, fixture kotor, atau teks
Jepang yang dirender keliru.

### 2.1 Content Data dan Quality Review

- [ ] Pertahankan format fixture dan script seed yang ada; tidak perlu membangun CMS, status
  publishing baru, atau seed pipeline pengganti.
- [ ] Lengkapi database menggunakan fixture yang tersedia melalui validation dan seed existing.
- [ ] Bersihkan provenance/checksum/review notes yang masuk ke `storyText`, dimulai dari fixture
  N3 2016-07.
- [ ] Gunakan checklist review content untuk jumlah session per level, urutan soal, referensi
  context, choice, answer, media, transcript/listening alignment, dan duplicate content.
- [ ] Tentukan SLA explanation. Setiap soal yang ditampilkan harus memiliki explanation atau status
  eksplisit bahwa explanation belum tersedia; marketing dan UI harus mengikuti coverage aktual.
- [ ] Tambahkan report coverage per paket: answer, explanation, context, image, audio, dan hasil
  human review.
- [ ] Gunakan Git/fixture review sebagai workflow content dan jalankan script validation existing
  sebelum seed.
- [ ] Dokumentasikan langkah refresh/redeploy yang diperlukan setelah seed agar cache content tidak
  menyajikan data lama; script seed tidak perlu diubah.

### 2.2 Japanese Content Rendering

- [ ] Ubah kontrak `JapaneseText` agar multiline dipertahankan atau larang newline melalui schema
  dan gunakan renderer document untuk field multiline.
- [ ] Tangani heading/list yang memang diizinkan, atau tolak marker Markdown di validation supaya
  tidak tampil literal.
- [ ] Tambahkan kumpulan fixture contoh untuk memverifikasi ruby, underline, nested markup,
  blank/star slot, paragraph, dialog multiline, table, multi-passage, malformed input, dan
  plain-text copy secara manual.
- [ ] Bundle font Jepang yang sesuai serta terapkan `lang="ja"` dan typography Jepang secara
  konsisten.
- [ ] Siapkan checklist visual mobile/desktop untuk diuji user pada exam, mode baca, practice, dan
  result.
- [ ] Pastikan copy-to-clipboard tidak membocorkan reading yang berfungsi sebagai jawaban.

### 2.3 Test Package Catalog dan Read Mode

- [ ] Perbaiki label "SESI UJIAN" agar menghitung session unik, bukan jumlah mondai.
- [ ] Gunakan resolver resume yang sama pada detail paket dan History.
- [ ] Tambahkan filter level/tahun/bulan, search, pagination bila katalog bertambah, dan indikator
  kelengkapan paket.
- [ ] Jangan menawarkan attempt pada paket yang belum selesai direview secara content.
- [ ] Dokumentasikan bahwa read mode memang membuka kunci, lalu verifikasi manual bahwa route exam
  tetap memakai projection data yang berbeda dan aman.

### Exit Criteria

- Seluruh paket yang tampil di aplikasi lolos validation existing dan checklist review content.
- Tidak ada metadata pipeline atau Markdown mentah yang bocor sebagai isi soal.
- Seluruh grammar renderer sudah melewati checklist visual user.
- Katalog hanya menawarkan paket yang aman dan lengkap sesuai checklist review content.

---

## Fase 3 — Exam, Result, dan History sebagai Satu Vertical Slice

**Modul utama:** [Exam](../module/exam.md), [Result](../module/result.md), dan
[History](../module/history.md).

**Alasan:** tiga modul ini berbagi satu lifecycle. Memperbaiki Result tanpa mengunci submit Exam,
atau memperbaiki History tanpa marker session final, hanya memindahkan bug ke layar lain.

### 3.1 Attempt dan Session Integrity

- [ ] Tambahkan model/marker submission per session dengan unique constraint
  `(attemptId, session)` atau invariant database ekuivalen.
- [ ] Submit harus idempotent: retry request yang sama memberi hasil yang sama, sedangkan submit
  ulang dengan payload berbeda setelah final ditolak.
- [ ] Server harus membangun expected question set dari attempt scope, lalu mewajibkan tepat satu
  jawaban/blank untuk setiap question; reject duplicate, missing, foreign, atau out-of-scope ID.
- [ ] Verifikasi `selectedAnswer` benar-benar merupakan choice yang tersedia pada question.
- [ ] Simpan jawaban, finalize session, update attempt, dan invalidasi cache dalam transaction
  yang konsisten.
- [ ] Implementasikan lifecycle `IN_PROGRESS`, `COMPLETED`, dan `ABANDONED` yang nyata, termasuk
  user action, expiry/cleanup, serta aturan apakah attempt dapat dipulihkan.
- [ ] Putuskan persistence draft lintas device. Rekomendasi: autosave draft server-side dengan
  debounce/versioning; `sessionStorage` tetap sebagai fallback responsif.
- [ ] Isi waktu aktif secara terdefinisi. Jika timer ujian tetap sengaja tidak tersedia, bedakan
  `elapsed wall time` dari `active time` dan jelaskan pada UI.

### 3.2 Exam Runner

- [ ] Sembunyikan seluruh furigana selama exam sesuai requirement, bukan hanya reading di dalam
  underline untuk tipe tertentu.
- [ ] Pastikan navigation fallback, refresh, tab ganda, koneksi putus, autosave conflict, dan
  browser back tidak merusak state.
- [ ] Tambahkan confirmation dan ringkasan unanswered/flagged sebelum finalize.
- [ ] Pertahankan keputusan tanpa countdown timer kecuali product requirement berubah; maturity
  tidak harus berarti menambah timer yang sengaja dikeluarkan dari scope.
- [ ] Serahkan checklist full mock multi-session dan latihan satu section pada seluruh level untuk
  diuji user.

### 3.3 Result dan Scoring Contract

- [ ] Hitung denominator dari expected question set, bukan jumlah row `AttemptAnswer`.
- [ ] Gunakan istilah konsisten "proyeksi skor aplikasi" dan jangan menyiratkan scaled score/IRT
  resmi JLPT.
- [ ] Putuskan apakah pass/fail ditampilkan. Jika ya, gunakan rule terdokumentasi dan tetap beri
  disclaimer bahwa hasil bukan sertifikat resmi.
- [ ] Bedakan wall time, active time, dan unanswered dengan akurat.
- [ ] Tambahkan comparison antar-attempt hanya setelah formula scoring dibekukan dan versioned.
- [ ] Tambahkan version pada algoritma skor agar perubahan bobot tidak diam-diam mengubah makna
  hasil historis.

### 3.4 History

- [ ] Resume berdasarkan session submission marker, bukan keberadaan sebagian answer row.
- [ ] Tambahkan filter, pagination, status treatment, dan action abandon/delete sesuai retention
  policy.
- [ ] Tampilkan score ringkas untuk completed attempt dan alasan/status yang jelas untuk abandoned.

### Exit Criteria

- Attempt yang sama tidak dapat menghasilkan dua final state berbeda akibat retry, tab ganda, atau
  submit ulang.
- Missing answer row tidak dapat memperkecil denominator.
- Answer key tidak pernah terkirim sebelum scope terkait selesai disubmit.
- User sudah memverifikasi bahwa full mock dapat dimulai, direfresh, dilanjutkan, disubmit,
  direview, dan ditemukan kembali lewat History.

---

## Fase 4 — Latihan Cepat

**Modul utama:** [Practice](../module/practice.md).

**Alasan:** Practice memakai bank soal yang sama tetapi memiliki lifecycle dan feedback langsung
yang berbeda. Kerjakan setelah contract Question dan renderer stabil, namun sebelum Analytics agar
event yang dilaporkan tidak berubah lagi.

### Pekerjaan

- [ ] Validasi bahwa setiap guest `questionId` adalah anggota assignment pada cookie/session dan
  jawaban adalah choice yang valid.
- [ ] Buat response guest mencerminkan answered count dan completion sebenarnya; jangan bergantung
  pada state client sebagai satu-satunya sumber ringkasan.
- [ ] Pilih policy guest. Rekomendasi: simpan state lokal dengan copy yang jujur, lalu tawarkan
  import ke akun setelah login; jangan mengatakan progress tersimpan bila tidak ada persistence.
- [ ] Tambahkan resume/discovery untuk session user, history practice, dan cleanup/abandon session
  yang lama.
- [ ] Putuskan apakah flag, bookmark, dan private note dibutuhkan pada practice; gunakan primitive
  shared yang sama bila ditambahkan.
- [ ] Catat active time dan event jawaban yang dibutuhkan Analytics tanpa mengirim answer key soal
  lain.
- [ ] Siapkan checklist random assignment, jumlah soal terbatas, restart, refresh,
  first-answer-final, concurrency, completion transaction, dan answer-key guard untuk diuji user.

### Exit Criteria

- Guest dan authenticated mode sama-sama aman serta tidak memberikan klaim persistence palsu.
- Session user selalu dapat dilanjutkan atau dinyatakan selesai/abandoned secara deterministik.
- Analytics menerima data practice yang final dan konsisten.

---

## Fase 5 — Learning System: Study, Vocabulary, dan Kana

**Modul utama:** [Shared Study](../module/study.md),
[Vocabulary](../module/vocabulary.md), dan [Kana](../module/kana.md).

**Alasan:** Vocabulary dan Kana perlu menghasilkan model mastery/review yang stabil sebelum
Dashboard dan Analytics menggunakannya. Shared audio dibuat lebih dahulu agar tidak ada implementasi
TTS berbeda-beda dan dapat dipakai kembali oleh Conversation/Speaking.

### 5.1 Shared Study dan Audio

- [ ] Buat interface playback bersama untuk recorded audio, browser TTS fallback, loading, cancel,
  retry, voice selection, dan unsupported state.
- [ ] Tetapkan recorded audio sebagai sumber utama untuk fixed curriculum bila kualitas pelafalan
  penting; browser TTS hanya fallback.
- [ ] Tambahkan preload/cache policy, accessibility control, dan telemetry kegagalan tanpa merekam
  isi sensitif.
- [ ] Pisahkan playback abstraction dari speech capture/transcription yang baru dibutuhkan di
  Fase 8.

### 5.2 Vocabulary dan SRS

- [ ] Bekukan dan dokumentasikan algoritma scheduler custom beserta invariant-nya; migrasi ke
  FSRS/algoritma lain hanya melalui keputusan dan migration plan terpisah.
- [ ] Dokumentasikan contoh perhitungan setiap rating, learning/relearning step, ease/interval
  boundary, lapse, daily reset, dan timezone agar dapat diverifikasi manual oleh user.
- [ ] Jadikan pengecekan daily limit dan write review atomic agar multi-tab tidak melewati limit.
- [ ] Masukkan kartu `Again` yang due kembali ke queue tanpa membutuhkan reload.
- [ ] Putuskan daily limit global atau per deck dan ubah model/log agar sesuai keputusan tersebut.
- [ ] Tambahkan review history, retention statistics, suspend/bury, dan reset progress yang aman.
- [ ] Perluas content ke N5-N1 dengan quality workflow yang sama seperti bank soal; tambahkan audio
  rekaman secara bertahap.
- [ ] Perbaiki seluruh copy guest dan sediakan jalur login/import bila progress lokal ingin
  dipertahankan.

### 5.3 Kana

- [ ] Tentukan learning outcome: recognition minimum, lalu writing/pronunciation sebagai scope
  terpisah agar counter klik tidak disebut mastery.
- [ ] Tambahkan yoon, contoh kata, dan progress mandiri untuk variasi yang benar-benar dinilai.
- [ ] Tambahkan quiz recognition yang dapat mengukur benar/salah tanpa self-report saja.
- [ ] Putuskan apakah Kana memakai SRS sederhana atau mastery model tersendiri; jangan memaksakan
  model Vocabulary jika behavior belajarnya berbeda.
- [ ] Tampilkan error persistence dan retry; jangan hanya melakukan optimistic update diam-diam.
- [ ] Tambahkan recorded audio atau fallback shared dari Study.

### Exit Criteria

- Scheduler Vocabulary deterministic, atomic, timezone-aware, dan sudah diverifikasi user dengan
  checklist boundary yang disepakati.
- Catalog Vocabulary memiliki target coverage level yang jujur di UI.
- Progress Kana merepresentasikan hasil latihan terukur, bukan hanya jumlah interaksi.
- Vocabulary dan Kana menghasilkan contract data stabil untuk reporting.

---

## Fase 6 — Unified Dashboard, History, Analytics, dan Progress

**Modul utama:** [Dashboard](../module/dashboard.md), [History](../module/history.md),
[Analytics](../module/analytics.md), dan [Progress](../module/progress.md).

**Alasan:** reporting dikerjakan setelah Exam, Practice, Vocabulary, dan Kana memiliki lifecycle
final. Dengan demikian definisi metrik tidak perlu terus ditambal per fitur.

### 6.1 Reporting Contract

- [ ] Buat glossary metrik: attempt, full mock, section practice, quick practice, reviewed card,
  mastered kana, accuracy, active time, projection score, streak, dan due count.
- [ ] Tetapkan satu timezone resolution berbasis preference user; perbaiki custom date agar tidak
  melewati konversi UTC yang menggeser tanggal WIB.
- [ ] Pindahkan agregasi berat ke query/database atau incremental read model bila volume data
  membutuhkannya; jangan selalu memuat seluruh history lalu mengagregasi di JavaScript.
- [ ] Tambahkan pagination/cursor, cache TTL atau freshness policy, dan invalidation matrix yang
  terdokumentasi.
- [ ] Version metrik yang bergantung pada formula scoring atau mastery.

### 6.2 Dashboard

- [ ] Ubah label KPI agar section practice tidak disebut full mock.
- [ ] Tampilkan next action nyata: vocabulary due, kana yang perlu dilatih, practice terakhir,
  attempt in-progress, dan rekomendasi berdasarkan data.
- [ ] Hapus copy hard-coded seperti "ribuan kosakata" atau buat copy berasal dari content stats
  aktual.
- [ ] Tambahkan recent activity dan empty-state onboarding yang dapat ditindaklanjuti.

### 6.3 History

- [ ] Tentukan apakah History tetap exam-only atau menjadi activity timeline terpadu. Rekomendasi:
  satu halaman dengan filter tipe, sementara detail domain tetap pada modul masing-masing.
- [ ] Masukkan PracticeSession dan link ke hasil/resume yang relevan bila memakai timeline terpadu.

### 6.4 Analytics

- [ ] Integrasikan exam, practice, vocabulary, dan kana tanpa mencampur metrik yang tidak sejenis.
- [ ] Tambahkan confidence/sample size, durasi aktif, drill recommendation, dan perbandingan periode.
- [ ] Perbaiki section filter agar keputusan apakah full mock ikut dihitung dinyatakan eksplisit di
  UI dan query.
- [ ] Uji filter timezone, inclusive date boundary, empty data, data besar, serta invalidation.

### 6.5 Progress dan Export

- [ ] Tambahkan grafik perkembangan yang benar-benar sesuai copy UI.
- [ ] Tambahkan filter tanggal dan pagination/virtualization bila tabel membesar.
- [ ] Ganti dependency `xlsx` yang memiliki kerentanan high tanpa fix sebelum status mature,
  misalnya dengan `exceljs` atau format export lain yang disetujui.
- [ ] Gunakan font Jepang pada PDF agar nama paket dan label tidak perlu dibuang menjadi Latin-only.
- [ ] Tambahkan metadata user, periode, timezone, serta versi formula ke export.
- [ ] Uji file hasil export dengan parser independen dan visual inspection PDF.

### Exit Criteria

- Angka yang sama memiliki definisi sama di Dashboard, Profile, Result, History, Analytics, dan
  Progress.
- Filter tanggal benar pada Asia/Jakarta dan timezone user lain.
- Reporting tetap responsif pada volume history representatif yang diuji user.
- Export aman, dapat dibuka, dan mempertahankan teks Jepang.

---

## Fase 7 — Article dan Public Shell

**Modul utama:** [Article](../module/article.md) dan
[Public Shell](../module/public-shell.md).

**Alasan:** kedua modul penting untuk acquisition dan discovery, tetapi tidak boleh mengalihkan
fokus dari correctness core learning. Kerjakan setelah status dan coverage modul dapat dibaca dari
data aktual.

### 7.1 Article

- [ ] Pertahankan article fixture dan script seed existing sebagai workflow content; tidak perlu
  membangun CMS atau publishing system baru pada scope ini.
- [ ] Tambahkan checklist review isi, structured body, metadata, cover, dan link sebelum seed.
- [ ] Tambahkan halaman saved/favorite milik user.
- [ ] Migrasikan search ke full-text search/ranking ketika jumlah artikel membuat `contains` tidak
  lagi memadai.
- [ ] Definisikan analytics view anonim dengan privacy-safe identifier bila visitor anonim memang
  perlu dihitung.
- [ ] Siapkan checklist SEO metadata, canonical, sitemap, cache invalidation, pencarian, dan related
  fallback untuk diuji user.

### 7.2 Public Shell dan Home

- [ ] Jadikan status "tersedia/segera" serta angka catalog berasal dari feature/content health,
  bukan copy hard-coded.
- [ ] Pastikan CTA guest/login konsisten dan tidak menjanjikan persistence pada flow guest.
- [ ] Tegaskan perbedaan public shell, protected data, dan ownership check; audit seluruh prefix
  route terhadap `proxy.ts`, layout, page, dan Server Action.
- [ ] Tambahkan accessibility audit, keyboard navigation, reduced motion, Core Web Vitals budget,
  image/font optimization, dan checklist visual mobile untuk diuji user.
- [ ] Sesuaikan sitemap/robots dengan keputusan indexing untuk learning pages.
- [ ] Tampilkan conversation/speaking sebagai coming soon sampai Fase 8 benar-benar melewati
  release gate.

### Exit Criteria

- Public copy selalu sesuai feature dan content availability aktual.
- Article fixture sudah direview sebelum seed dan cache invalidation terdokumentasi.
- Seluruh halaman publik memenuhi target accessibility, SEO, dan performance yang ditetapkan.

---

## Fase 8 — Conversation dan Speaking

**Modul utama:** [Conversation dan Speaking](../module/conversation-speaking.md).

**Alasan ditempatkan terakhir:** modul ini bukan sekadar UI baru. Ia membutuhkan account security,
audio abstraction, privacy/retention policy, quota, moderation, cost control, observability, dan
evaluation yang belum dibutuhkan modul lain.

### 8.1 Product dan Safety Contract

- [ ] Tentukan use case sempit pertama, level JLPT, persona partner, target feedback, dan batasan
  klaim pedagogis.
- [ ] Tentukan data retention untuk transcript/audio, consent microphone, download/delete data,
  provider processing, dan apakah audio dipakai untuk improvement.
- [ ] Tetapkan quota per user, rate limit, cost ceiling, timeout, retry, fallback, dan abuse policy.
- [ ] Pilih provider melalui abstraction agar prompt, model, STT, dan TTS tidak tersebar di UI.
- [ ] Buat rubric dan kumpulan skenario bahasa Jepang agar user dapat mengevaluasi relevance,
  level appropriateness, hallucination, unsafe response, latency, serta biaya.

### 8.2 Conversation Text MVP

- [ ] Implementasikan text conversation terlebih dahulu: scenario, turn history, streaming,
  retry/edit policy, translation toggle, dan session persistence.
- [ ] Tambahkan moderation input/output dan prompt-injection boundary.
- [ ] Simpan model/prompt version pada session agar hasil dapat diaudit.
- [ ] Beri feedback yang terstruktur dan tidak mengklaim penilaian resmi.

### 8.3 Speaking

- [ ] Implementasikan permission flow, recording state, upload/cancel, waveform nyata, dan
  accessible fallback.
- [ ] Tambahkan STT, transcript correction, playback, serta deletion sesuai retention policy.
- [ ] Jika menambah pronunciation score, minta user memvalidasi sampel terhadap rubric; tampilkan
  uncertainty serta jangan menyatakan skor sebagai penilaian resmi.
- [ ] Tambahkan typed transcript fallback yang benar-benar berfungsi ketika microphone/STT gagal.
- [ ] Siapkan checklist browser/device, koneksi lambat, audio corrupt, provider outage, quota
  exhausted, privacy deletion, dan concurrent session untuk diuji user.

### Exit Criteria

- Conversation text memenuhi eval threshold, cost budget, moderation, dan latency target.
- Speaking tidak dirilis sebelum consent, retention, delete flow, dan failure fallback teruji.
- Preview statis di home baru berubah menjadi status "tersedia" setelah release gate terpenuhi.

---

## Fase 9 — Production Readiness dan Final Maturity Audit

**Scope:** seluruh modul.

### Pekerjaan

- [ ] Jalankan threat modeling untuk auth, user isolation, answer-key leakage, Cloudinary upload,
  content seed, export, dan provider AI.
- [ ] Jalankan accessibility audit WCAG pada seluruh critical flow.
- [ ] Definisikan SLO/alert untuk error rate, latency, database saturation, failed upload, failed
  submit, cache inconsistency, dan provider outage.
- [ ] Serahkan checklist final guest dan authenticated flow pada mobile serta desktop untuk diuji
  user.
- [ ] Review seluruh empty/error copy agar tidak mengklaim fitur, data, persistence, atau skor yang
  tidak tersedia.
- [ ] Perbarui seluruh `docs/module/*.md` dari "kondisi aktual" terbaru dan tutup known issue yang
  sudah selesai.

### Final Exit Criteria

- Tidak ada P0/P1 issue terbuka.
- Seluruh critical user journey sudah melewati user acceptance testing dan memiliki monitoring.
- Account recovery, data deletion, dan incident response sudah diverifikasi sesuai scope aplikasi.
- Content yang tampil sudah melewati validation existing dan review manual.
- Metrik, scoring, persistence, serta keterbatasan AI dijelaskan secara jujur kepada user.

---

## Matriks Urutan Implementasi

Matriks ini memastikan seluruh modul yang sudah didokumentasikan memiliki tempat utama dalam
roadmap. Beberapa modul tetap disentuh kembali pada fase integrasi berikutnya.

| Urutan | Modul | Fase utama | Target kematangan |
|---:|---|---:|---|
| 1 | Engineering baseline lintas modul | 0 | Lint/typecheck/build, observability, dan checklist pengujian user |
| 2 | [Authentication](../module/auth.md) | 1 | Recovery, verification, revocation, rate-limit lifecycle, security review |
| 3 | [Profile](../module/profile.md) | 1 | Account lifecycle, timezone, privacy, export/delete, secure avatar lifecycle |
| 4 | [Question Comment](../module/question-comment.md) | 1 | Upload atomic, asset ownership, cleanup, dan private-note reliability |
| 5 | [Content Data](../module/content-data.md) | 2 | Fixture/seed existing, content cleanup, coverage, dan manual quality review |
| 6 | [Japanese Content Rendering](../module/japanese-content-rendering.md) | 2 | Multiline/Markdown policy, Japanese font/lang, parser dan visual verification |
| 7 | [Test Package](../module/test-package.md) | 2 | Reviewed catalog, accurate metadata, filters, consistent resume |
| 8 | [Exam](../module/exam.md) | 3 | Immutable/idempotent session submit, complete payload, safe draft/resume |
| 9 | [Result](../module/result.md) | 3 | Correct denominator, versioned projection, accurate duration/review |
| 10 | [History](../module/history.md) | 3 dan 6 | Reliable resume lebih dulu, lalu unified/filterable activity history |
| 11 | [Practice](../module/practice.md) | 4 | Secure guest assignment, persistent user lifecycle, truthful completion |
| 12 | [Shared Study](../module/study.md) | 5 | Reusable recorded-audio/TTS playback foundation |
| 13 | [Vocabulary](../module/vocabulary.md) | 5 | Atomic SRS yang terverifikasi, full-level content plan, history dan retention insight |
| 14 | [Kana](../module/kana.md) | 5 | Measurable learning outcome, expanded content, reliable persistence |
| 15 | [Dashboard](../module/dashboard.md) | 6 | Accurate cross-module summary dan actionable next step |
| 16 | [Analytics](../module/analytics.md) | 6 | Timezone-safe, scalable, cross-module analysis dengan definisi metrik jelas |
| 17 | [Progress](../module/progress.md) | 6 | Grafik nyata, safe export, Unicode PDF, formula/timezone metadata |
| 18 | [Article](../module/article.md) | 7 | Fixture review, reliable cache/search, dan user collection |
| 19 | [Public Shell](../module/public-shell.md) | 7 | Data-driven availability, honest CTA, accessibility/SEO/performance |
| 20 | [Conversation dan Speaking](../module/conversation-speaking.md) | 8 | Evaluated, privacy-safe, quota-controlled text dan voice experience |

## Keputusan Produk yang Perlu Dibekukan

Keputusan berikut sebaiknya dibuat sebelum fase terkait dimulai karena masing-masing dapat mengubah
schema dan UX secara besar:

1. **Guest persistence:** local-only dengan import setelah login, atau wajib login untuk menyimpan.
   Rekomendasi: local-only yang transparan dengan opsi import.
2. **Draft exam:** hanya browser atau autosave server lintas device. Rekomendasi untuk maturity:
   autosave server dengan versioning.
3. **Timer exam:** tetap tidak ada sesuai scope sekarang, atau countdown resmi. Rekomendasi: tetap
   tidak ada sampai ada requirement eksplisit; tetap ukur active time secara terpisah.
4. **Scoring:** proyeksi internal tetap dipertahankan, tetapi harus diberi version dan disclaimer;
   jangan mengejar klaim scaled score resmi.
5. **Editorial workflow:** pertahankan Git/fixture review dan script seed yang ada; CMS tidak masuk
   scope roadmap saat ini.
6. **Vocabulary scheduler:** pertahankan algoritma custom yang dibekukan dan diverifikasi, atau migrasi ke
   algoritma lain. Jangan mengganti tanpa migration serta compatibility plan untuk progress lama.
7. **History:** exam-only atau unified activity timeline. Rekomendasi: unified dengan filter tipe.
8. **Conversation data:** retention audio/transcript, consent, provider, quota, serta delete policy
   harus selesai sebelum implementasi UI production.

## Definition of Done untuk Setiap Item

Setiap checklist implementasi dianggap selesai hanya jika:

- Behavior dan acceptance criteria ditulis sebelum perubahan.
- Schema/migration aman untuk data existing dan perubahan datanya dijelaskan.
- Zod validation, session, ownership, serta authorization ditinjau pada server boundary dan masuk
  checklist pengujian user.
- Cache key, freshness, dan invalidation diperbarui bila data flow berubah.
- Lint, typecheck, dan build lulus; checklist perubahan sudah diuji langsung oleh user.
- Loading, empty, error, retry, refresh, mobile, keyboard, dan guest state diperiksa.
- Logging/metric cukup untuk mendiagnosis kegagalan tanpa mengekspos data sensitif.
- Dokumentasi modul dan roadmap diperbarui agar sesuai kondisi aktual.
