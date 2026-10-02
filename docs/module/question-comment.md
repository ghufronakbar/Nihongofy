# Modul Question Comment

## Status Aktual

**Catatan belajar pribadi selesai; berbagi catatan ke diskusi publik dan balasan satu tingkat sudah aktif.** User login dapat menambah, mengedit, menghapus, dan melampirkan gambar pada soal di mode baca dan result detail, lalu membagikan catatan itu ke diskusi yang dapat dibaca semua orang termasuk guest.

**Sejak 2 Oktober 2026 modul ini melayani tiga target: soal JLPT, kata flashcard, dan pola bunpou.** Tabel, action, query, komponen, moderasi, dan laporannya sama; permukaan flashcard-nya dijelaskan di [flashcard.md](flashcard.md#catatan-dan-diskusi-kata) dan permukaan bunpou di [bunpou.md](bunpou.md#catatan-dan-diskusi-pola). Semua tulisan dibatasi rate limit Redis.

**Diskusi diindeks mesin pencari sejak 2 Oktober 2026** — lihat [Indexing](#indexing).

## Feature Flag

Dua flag terpisah.

`FEATURES_QUESTION_COMMENT` (default `true`). Saat `false`:

- Daftar "Catatan Belajar" dan form tambah catatan tidak dirender di `/test-package/[id]/questions` maupun `/result/[attemptId]/detail`.
- Server Action `add`, `update`, `delete`, dan signature upload gambar memanggil `notFound()` sebelum memeriksa session.
- Catatan yang sudah tersimpan tidak dihapus.

`FEATURES_QUESTION_DISCUSSION` (default `true`, otomatis mati bila `FEATURES_QUESTION_COMMENT` mati). Ini kill switch konten publik: mematikannya menyembunyikan seluruh permukaan diskusi tanpa mengganggu catatan pribadi. Saat `false`:

- Tombol "Diskusi (n)", tombol bagikan, dan tautan permalink tidak dirender.
- `/discussion/[commentId]` mengembalikan 404 lewat guard di layout segmennya.
- `setQuestionCommentVisibilityAction`, `replyToQuestionCommentAction`, dan `getQuestionDiscussionAction` memanggil `notFound()`.
- `addQuestionCommentAction` menolak `visibility: "PUBLIC"`, tetapi catatan privat tetap bisa ditulis.
- Catatan yang sudah publik tidak diubah menjadi privat; hanya tidak ada permukaan yang menampilkannya.

`FEATURES_BUNPOU_DISCUSSION` (default `true`, otomatis mati bila `FEATURES_BUNPOU` mati) berperan sama
untuk pola bunpou: Catatanku dan section Diskusi di `/bunpou/[key]`, tombol Diskusi (n), serta
`/bunpou/discussion/*` hilang (404), dan seluruh action dengan target pola memanggil `notFound()`.

`FEATURES_FLASHCARD_DISCUSSION` (default `true`, otomatis mati bila `FEATURES_FLASHCARD` mati) menjadi
satu-satunya flag untuk catatan **dan** diskusi kata flashcard. Kedua flag soal di atas tidak
memengaruhi target kata, dan sebaliknya. Saat flag ini mati: blok Catatanku, tombol Diskusi di
reviewer, ikon di daftar kata deck, dan `/flashcard/discussion/*` hilang (404), dan seluruh action
dengan target kata memanggil `notFound()`. Flag ditentukan per target: action berbasis `commentId`
membaca target catatannya dulu. Upload gambar hidup bila salah satu dari `FEATURES_QUESTION_COMMENT`
atau `FEATURES_FLASHCARD_DISCUSSION` hidup.

## Scope

- Catatan default privat. Publik hanya terjadi karena tindakan eksplisit pemiliknya.
- `Question.explanation` adalah pembahasan resmi/terkurasi; `QuestionComment` adalah catatan user, dan keduanya tetap dipisahkan.
- Diskusi dapat dibaca guest; menulis dan membalas butuh login.
- Moderasi admin tersedia di `/admin/moderation`. Upvote "membantu" dan urutan "Paling membantu" aktif sejak 2 Oktober 2026 (lihat [Upvote](#upvote)). Yang belum ada: notifikasi balasan.

## Model Data

Satu tabel `QuestionComment` untuk catatan pribadi dan thread publik — yang dibagikan adalah record yang sama, bukan salinannya, sehingga edit tidak perlu disinkronkan antar tabel.

- **Target:** tepat satu dari `questionId` (soal), `vocabId` (kata flashcard di katalog, bukan
  kartu milik user), atau `bunpouPointId` (pola bunpou, per entri katalog) terisi. CHECK
  `QuestionComment_target_check` (`num_nonnulls(...) = 1`) hanya ada di SQL migration dan dijaga
  `target.test.ts`. Balasan selalu mewarisi target root-nya, jadi satu thread tidak pernah bercampur.
  Di kode, target diwakili `CommentTarget` (`target.ts`), yang juga membentuk tautan:
  thread soal → `/discussion/<rootId>`, thread kata → `/flashcard/discussion/<vocabId>#comment-<id>`,
  thread pola → `/bunpou/discussion/<pointId>?comment=<id>`, pengalih yang menerjemahkan id ke
  `/bunpou/<key>#comment-<id>` (baris catatan tidak membawa key pola).

- `visibility` (`PRIVATE` | `PUBLIC`) — status saat ini.
- `sharedAt` — terisi saat pertama kali dibagikan, **tidak pernah dikosongkan lagi**. Ini penentu keanggotaan thread publik, bukan `visibility`.
- `deletedAt` — soft delete.
- `deletedById` — siapa yang menghapus. Hapusan pemilik terisi `userId` miliknya sendiri, takedown admin terisi id admin. Pembeda ini yang menentukan apakah entri dapat dipulihkan.
- `parentId` — self-relation. `null` berarti root; balasan hanya satu tingkat.

### Aturan tampil root

| visibility | deletedAt | ada balasan hidup | dirender |
|---|---|---|---|
| PUBLIC | – | – | konten penuh |
| PUBLIC | terisi | ya | tombstone "telah dihapus" + balasan |
| PRIVATE | – | ya | tombstone "disembunyikan" + balasan |
| apa pun | terisi / PRIVATE | tidak | tidak dirender |

Balasan yang dihapus langsung hilang dari tampilan tanpa tombstone, karena tidak punya anak yang perlu diberi konteks.

## Aturan yang Ditegakkan di Server

- **Tidak pernah hard delete.** `deleteQuestionCommentAction` hanya mengisi `deletedAt`. Balasan user lain menempel pada root; menghapus barisnya akan ikut memusnahkan percakapan mereka. `onDelete: Cascade` pada self-relation hanya jaring pengaman untuk penghapusan user/soal.
- **Tombstone dibersihkan di layer query, bukan komponen.** `toDiscussionRoot()` di `queries.ts` tidak menyalin `commentText`, `commentImages`, dan identitas penulis untuk root non-`VISIBLE`. Kalau penyembunyian hanya dilakukan di JSX, isi yang sudah dihapus tetap ikut terkirim di payload halaman.
- **Balasan maksimal satu tingkat.** Membalas sebuah balasan menambah balasan baru pada root yang sama. Kedalaman tak terbatas akan memaksa recursive CTE atau materialized path, dan membuat setiap aturan tombstone punya kasus kembar di tiap tingkat.
- **Mention adalah relasi, bukan teks.** Tujuan balasan disimpan di `repliedToId` dan username-nya di-resolve saat baca. Menyimpan `@nama` sebagai teks di dalam `commentText` akan basi begitu penulisnya ganti username, bisa dipalsukan siapa saja, dan ambigu karena `displayName` tidak unik. Mention hanya diterima bila menunjuk comment hidup di thread yang sama, dan tidak dirender bila comment tujuannya sudah dihapus.
- **Thread mati bersifat read-only.** Balasan baru ditolak bila root sudah dihapus atau dikembalikan ke privat.
- **Balasan mewarisi visibility root** dan tidak punya toggle sendiri; `setQuestionCommentVisibilityAction` menolak comment yang punya `parentId`.
- Comment yang sudah di-soft delete tidak bisa diedit, dibagikan, atau dibalas (`requireOwnLiveComment()`).
- **Rate limit tulis** (`COMMENT_WRITE_RATE_LIMITS`, Redis fixed window per user, gabungan soal dan
  flashcard): 8 per menit, 60 per jam, 300 per hari, untuk membuat catatan, membalas, menyunting,
  dan membagikan ke diskusi. Menghapus dan menarik kembali ke privat tidak dibatasi. Upload gambar
  punya kuota sendiri (`COMMENT_IMAGE_UPLOAD_RATE_LIMITS`: 40 per jam, 150 per hari). Percobaan yang
  ditolak tetap dihitung. Gagal tertutup: tanpa Redis, session pun tidak tervalidasi.
- **Suspend posting per user** (`User.postingSuspendedAt`, diatur admin di `/admin/user/[id]#posting`).
  `checkPublicPostingAllowed()` menolak setiap tulisan ke diskusi publik di target mana pun:
  catatan baru `PUBLIC` (termasuk composer di halaman kata/pola dan sheet), membagikan, membalas,
  dan menyunting entri yang sedang publik (root `PUBLIC` atau balasan). Catatan privat, menghapus,
  dan menarik kembali ke privat tetap bisa; konten publik lama tidak diubah. Status dibaca per
  request (`isPostingSuspended`, tidak di-cache) supaya berlaku seketika. Di UI, form diskusi dan
  tombol balas diganti keterangan "Akun dibatasi"; `CommentItem` menyembunyikan tombol bagikan dan
  edit-entri-publik (juga di "Catatanku" reviewer flashcard).
- **Penolakan dikembalikan, bukan dilempar.** Action tulis mengembalikan
  `{ ok: true } | { ok: false, message }` supaya pesan rate limit dan suspend sampai ke user (pesan
  error Server Action disamarkan di produksi). Input tidak valid dan akses terlarang tetap
  `notFound()`/throw.
- Kata yang sudah pensiun (`retiredAt`) tidak menerima catatan baru; catatan lamanya tetap terbaca.
- **Komponen menerima callback, bukan selalu `router.refresh()`.** `CommentItem` (`onChanged`),
  `QuestionCommentForm` (`onSaved`), dan `DiscussionSheet` (`onPosted`) dipakai di reviewer
  flashcard, tempat refresh halaman membangun ulang antrean dan mereset sesi belajar.

## Performa

Halaman mode baca dan result detail **hanya mengambil jumlah** entri diskusi per soal (`getQuestionDiscussionCounts`, satu `groupBy` untuk seluruh soal pada mondai tersebut) untuk label tombol. Isi thread baru diambil lewat `getQuestionDiscussionAction` saat sheet dibuka, supaya satu mondai berisi belasan soal tidak menyeret seluruh percakapan yang belum tentu dibaca.

Thread dan hitungannya sengaja **tidak** di-`unstable_cache`. Isinya berubah setiap ada balasan, jadi biaya invalidasi per mutasi lebih besar daripada biaya query groupBy yang sudah ditopang index. Bank soalnya sendiri tetap di-cache seperti sebelumnya.

## Halaman

- `/discussion` — indeks seluruh diskusi, satu baris per soal, diurutkan dari aktivitas terbaru
  (`getDiscussionIndex`, `groupBy` + `_max.createdAt`). Paginasi mengambil satu baris lebih banyak
  dari ukuran halaman supaya `hasMore` tidak butuh `COUNT DISTINCT` terpisah.
- `/discussion/question/[questionId]` — seluruh thread pada satu soal dalam halaman penuh,
  pengganti sheet yang sempit.
- `/discussion/[commentId]` — permalink satu thread.

Ketiganya memakai `DiscussionQuestionCard` yang sama untuk merender soal, kunci, dan pembahasan.

## Halaman Permalink

`/discussion/[commentId]` menampilkan satu thread lengkap dengan soal, pilihan, kunci, dan pembahasan resminya. Tidak ada kebocoran kunci jawaban karena mode baca memang sudah publik.

- `commentId` berupa balasan akan di-redirect ke permalink root dengan anchor `#comment-<id>`.
- Catatan privat yang belum pernah dibagikan tidak punya permalink (404).
- Canonical permalink menunjuk `/discussion/question/<questionId>`, karena thread ini bagian dari
  halaman diskusi soalnya.

## Indexing

Diskusi dibuka untuk mesin pencari (2 Oktober 2026) supaya catatan pengguna ikut membantu orang
yang mencari soal, kata, atau pola tertentu. Moderasi `/admin/moderation`, laporan `COMMENT`, dan
rate limit tulis sudah aktif sebagai penahannya.

- `robots.ts` meng-`allow` `/discussion` dan `/flashcard/discussion` selama flag-nya hidup; `/bunpou/`
  sudah terbuka. `robots.txt` di-prerender saat build, jadi perubahan flag butuh redeploy.
- Metadata per halaman disusun `src/features/question-comment/seo.ts`: judul dan deskripsi dari soal
  atau kata, canonical ke halaman diskusi target.
- Halaman diskusi soal atau kata **tanpa entri tampil** diberi `noindex, follow`, karena isinya hanya
  duplikat soal/kartu yang sudah terindeks di tempat lain. Halaman indeks lanjutan (`?page=2`, dst.)
  juga `noindex, follow`.
- Sitemap memuat ketiga halaman indeks dan halaman diskusi soal/kata yang punya entri
  (`getDiscussionSitemapTargets`, di-cache 1 jam). Diskusi pola tidak didaftarkan terpisah karena
  dirender di halaman pola, yang sudah ada di sitemap.
- Isi komentar adalah teks polos tanpa tautan, jadi tidak ada `rel="ugc"` yang perlu dipasang.

## Data dan Security

- Comment tersimpan di PostgreSQL dengan relasi user dan question.
- Page query catatan pribadi selalu memfilter `userId` session, `parentId: null`, dan `deletedAt: null`.
- Presigned PUT URL R2 dibuat server-side; `R2_SECRET_ACCESS_KEY` tidak dikirim ke browser.
- Object key upload dibatasi per user (`jlpt-exam/comments/{userId}/<uuid>.<ext>`).
- Content-type dan content-length ikut ditandatangani, jadi R2 sendiri menolak tipe atau ukuran di luar batas.
- Server menolak `commentImages` yang bukan object milik user ini; URL Cloudinary lama tetap diterima agar komentar sebelum migrasi masih bisa disunting.
- Membagikan catatan memublikasikan nama tampilan, username, dan avatar pemiliknya.
- Username yang tampil di komentar bukan kredensial login — login memakai email saja. Lihat
  `docs/module/auth.md`.
- Penghapusan akun menganonimkan penulisnya dan men-soft-delete comment-nya; balasan pengguna lain
  pada thread tersebut tetap utuh. `QuestionComment.userId` memakai `Restrict` supaya tidak ada
  jalur hard delete yang bisa menghancurkan thread.

## Keterbatasan dan Bug Aktual

- **Belum ada laporan dari user.** Moderasi admin sudah ada (`/admin/moderation`: antrean, sembunyikan root, takedown, pulihkan takedown admin, filter per user), tetapi penyalahgunaan hanya ketahuan bila admin memeriksa antrean secara aktif. Rem darurat `FEATURES_QUESTION_DISCUSSION=false` tetap tersedia.
- **Tidak ada notifikasi** saat catatan dibalas — aplikasi belum punya sistem notifikasi sama sekali.
- **Lampiran di object storage tidak pernah terhapus**, termasuk saat takedown admin. Ini keputusan eksplisit: takedown bekerja di level record database saja, dan pembersihan asset fisik berada di luar scope modul admin.
- Rate limit per user saja, tidak per IP; satu orang dengan banyak akun tetap bisa menulis lebih banyak.
  Batas isi tetap 2.000 karakter dan 4 gambar.
- Tidak ada pencarian, tag, pin, export, atau halaman agregat semua catatan.
- Guest melihat form catatan pribadi, tetapi submit diarahkan ke login.

## Upvote

Aktif sejak 2 Oktober 2026 (migration `20261002150000_question_comment_vote`), untuk diskusi soal,
kata flashcard, dan pola bunpou sekaligus karena ketiganya satu tabel.

- **Tujuan:** menaikkan pembahasan dan jembatan keledai yang paling membantu, alih-alih hanya
  urutan terbaru.
- **Data:** tabel `QuestionCommentVote` (`commentId`, `userId`, `createdAt`, PK
  `commentId + userId`) — satu suara per user per entri, bisa ditarik. Tidak ada downvote: tanpa
  moderasi aktif, downvote mudah dipakai untuk merundung. Jumlah dihitung lewat satu `groupBy` per
  thread (`countVotes`), tidak disimpan sebagai kolom; thread tetap tidak di-cache.
- **Action:** `voteQuestionCommentAction({ commentId, voted })` — `voted` adalah keadaan yang
  diinginkan, bukan toggle, jadi klik ganda atau retry idempoten (`createMany` + `skipDuplicates`
  / `deleteMany`). Mengembalikan `{ ok: true, voted, voteCount }` atau `{ ok: false, message }`.
- **Aturan** (`voteRejection` di `votes.ts`, diuji `votes.test.ts`): tidak bisa memberi suara pada
  catatan sendiri, catatan privat, entri yang dihapus, atau di thread yang root-nya sudah tombstone
  (dihapus/disembunyikan) — thread mati adalah arsip read-only, sama seperti balasan baru.
  Balasan di thread hidup boleh diberi suara. Menarik suara selalu boleh. User yang di-suspend dari
  posting tetap boleh memberi suara.
- **Privasi:** thread dirender server dan diindeks, jadi yang dikirim ke client hanya `voteCount`
  dan `viewerVoted` milik viewer login. `getDiscussion` sendiri tidak bergantung viewer (dipakai
  ulang metadata lewat `cache`); status viewer ditempel `withViewerVotes()` yang hanya membaca
  suara milik viewer dan hanya memilih `commentId`. Tombstone tidak membawa jumlah suara.
- **Tampilan:** tombol "Membantu" beserta jumlah di setiap entri (`VoteButton`). Guest melihat
  jumlah, klik mengarah ke login; catatan sendiri dan thread arsip hanya menampilkan angka.
  Pilihan urutan "Terbaru" / "Paling membantu" ada di `DiscussionThread`, jadi tampil di
  `/discussion/question/[questionId]`, `/flashcard/discussion/[vocabId]`, section Diskusi
  `/bunpou/[key]`, dan sheet diskusi (bila thread punya lebih dari satu root). Urutan dipilih di
  client karena thread selalu dimuat utuh dan sudah membawa jumlah; HTML server tetap "Terbaru".
  Hanya root yang diurutkan ulang — balasan tetap kronologis karena itu konteks percakapan.
  Label "Diskusi (n)" tetap menghitung entri, bukan suara.
- **Rate limit:** `COMMENT_VOTE_RATE_LIMITS` (60 per jam per user, Redis), terpisah dari kuota
  tulis. Memberi dan menarik suara sama-sama dihitung.
- **Moderasi:** antrean `/admin/moderation` menampilkan jumlah suara tiap entri; takedown tidak
  menghapus suara, hanya menyembunyikan entrinya (pemulihan takedown membawa suaranya kembali).
- **Akun:** suara yang diberikan ikut dihapus `anonymizeAccount` dan ikut di export data akun.

## File Utama

- `src/features/question-comment/target.ts` — `CommentTarget` dan pembentuk tautan
- `src/features/question-comment/actions.ts`
- `src/features/question-comment/queries.ts`
- `src/features/question-comment/schemas.ts`
- `src/features/question-comment/components/question-comment-form.tsx`
- `src/features/question-comment/components/comment-item.tsx`
- `src/features/question-comment/components/comment-body.tsx`
- `src/features/question-comment/components/comment-image-uploader.tsx`
- `src/features/question-comment/components/discussion-sheet.tsx`
- `src/features/question-comment/components/discussion-thread.tsx`
- `src/features/question-comment/components/discussion-permalink-thread.tsx`
- `src/features/question-comment/components/reply-form.tsx`
- `src/app/(public)/discussion/layout.tsx`
- `src/app/(public)/discussion/[commentId]/page.tsx`
- `src/features/question-comment/components/discussion-tabs.tsx` — tab Soal | Kosakata | Bunpou
- `src/features/question-comment/components/discussion-composer.tsx` — form tulis langsung ke diskusi di halaman target
- `src/features/question-comment/seo.ts` — metadata halaman diskusi
- `src/lib/rate-limit.ts`, `src/lib/redis-rate-limit.ts` — rate limit fixed window
- `src/features/question-comment/components/posting-suspended-notice.tsx` — pengganti form untuk akun yang di-suspend
- `src/features/question-comment/posting-suspension.test.ts` — penjaga cek suspend di action tulis publik
- `src/features/question-comment/votes.ts` — aturan suara dan urutan thread (aman untuk client)
- `src/features/question-comment/components/vote-button.tsx` — tombol "Membantu"
- `src/features/admin/moderation/` — antrean dan action takedown milik admin (menampilkan konteks soal atau kata), terpisah dari action user di atas yang tetap menolak non-pemilik
