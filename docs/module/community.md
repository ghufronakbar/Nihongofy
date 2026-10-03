# Modul Komunitas (Profil Publik, Follow, Postingan)

## Status Aktual

**Tahap 1 (profil publik), tahap 2 (follow), dan tahap 3 (postingan) selesai di kode, migration
ketiganya sudah diterapkan (3 Oktober 2026); menunggu uji manual.** Tahap 4 belum dikerjakan. Checklist pengerjaannya ada di `docs/plan.md`
(Fase 8.15). Fitur ini sebelumnya tercatat di luar scope awal
(`plan/redesign-and-feature.md`: "Community feed, komentar publik, follower"); komentar publik sudah
lebih dulu hadir lewat [Question comments](question-comment.md).

Dikerjakan dalam empat tahap berurutan:

1. Profil publik `/u/[username]` dan pengaturan public/private.
2. Follow, termasuk permintaan follow untuk akun private.
3. Postingan dengan like, komentar, dan balasan, beserta feed.
4. Notifikasi dan blokir user.

Follow sengaja dikerjakan sebelum postingan: aturan akses konten akun private baru lengkap setelah
follow ada, sehingga postingan dan tab "Mengikuti" dibangun di atas aturan yang sudah final.

## Keputusan

- **Route profil `/u/[username]`** di route group `(public)`, bukan `/profile/[username]`.
  `/profile/*` dijaga `src/proxy.ts` dan layout `(dashboard)` (wajib login, `noindex`), dan
  username seperti `info`/`security`/`privacy`/`auth` akan tertutup halaman settings. `u` sudah ada
  di daftar username terlarang. `/profile` tetap halaman milik sendiri.
- **Visibility default `PUBLIC`**, untuk user lama maupun baru.
- **Akun private tetap punya halaman**, berisi kartu identitas dengan label "Akun ini private";
  bukan 404. Username di diskusi dan postingan menaut ke halaman ini.
- **Follow memakai persetujuan untuk akun private.** Follow ke akun public langsung aktif; ke akun
  private menjadi permintaan sampai pemilik menyetujui. Tanpa persetujuan, siapa pun cukup menekan
  Follow untuk melihat isi akun private.
- **Postingan akun private tetap tersimpan, tetapi hanya terlihat oleh pemilik dan follower yang
  disetujui.** Feed global **menyaring keluar** postingannya (bukan menampilkan kartu "akun
  private"): kartu kosong adalah noise dan tetap membocorkan kapan serta seberapa sering user itu
  memposting. Pesan "Postingan ini dari akun private" muncul di tempat orang datang lewat tautan
  langsung: permalink dan tab Postingan di profil.
- **Feed dan halaman profil public dapat dibaca guest dan diindeks mesin pencari.**
- **Tidak ada like profile.** Diganti **reputasi "Membantu"**: total suara Membantu yang diterima di
  diskusi ditambah like pada postingan. Like profile tumpang-tindih dengan follow, menjadi metrik
  popularitas murni yang mudah digelembungkan dengan akun ganda, dan profil tanpa like terasa
  memalukan bagi pemula.
- **Notifikasi dikerjakan paling akhir** (tahap 4). Permintaan follow tetap punya halaman dan
  badge jumlah sejak tahap 2, karena pemilik akun private harus tahu ada permintaan.
- **Komentar postingan memakai ulang `QuestionComment`** sebagai target keempat (`postId`), bukan
  tabel baru. Balasan satu tingkat, mention relasional, suara, tombstone, moderasi, laporan
  `COMMENT`, rate limit, suspend posting, dan anonimisasi langsung berlaku tanpa disalin.

## Aturan Akses

Satu helper menjadi satu-satunya sumber kebenaran, dipakai di profil, permalink, komentar, like,
daftar follower, dan setiap Server Action yang menyentuh konten akun lain:

> Konten boleh dilihat bila akun pemilik `PUBLIC`, **atau** viewer adalah pemiliknya, **atau**
> viewer adalah follower dengan status `ACCEPTED`.

Helper ini punya dua bentuk: fungsi murni untuk satu akun (diuji unit test) dan fragmen `where`
Prisma untuk daftar (feed, tab Postingan). Penyaringan dilakukan di layer query, mengikuti prinsip
`toDiscussionRoot()`: isi yang tidak boleh dilihat tidak pernah masuk payload halaman, bukan hanya
disembunyikan di JSX.

Status visibility dan follow **dibaca per request, tidak di-cache**, seperti `isPostingSuspended`.
Bila ikut di-cache, user yang baru beralih ke private masih terlihat publik sampai cache basi.
Data yang di-cache (statistik, heatmap) hanya dibaca setelah lolos pengecekan akses.

| | Guest / bukan follower | Follower disetujui | Pemilik |
|---|---|---|---|
| Avatar, nama, @username, bio, target level, jumlah follower/following | ✓ | ✓ | ✓ |
| Statistik, heatmap, reputasi, tab Postingan | label "Akun ini private" | ✓ | ✓ |
| Postingan di feed global | tidak muncul | tidak muncul (ada di tab Mengikuti) | — |
| Permalink postingan | pesan "akun private" | ✓, boleh like dan komentar | ✓ |
| Daftar follower/following | ✗ | ✓ | ✓ |

Turunan aturan:

- Komentar orang lain di postingan akun private ikut tersembunyi, karena bagian dari postingannya.
- Komentar akun private di postingan public milik orang lain **tetap tampil**; nama penulisnya
  menaut ke kartu private.
- Diskusi soal, kata, dan pola bunpou **tidak terpengaruh** visibility profil. Entri di sana sudah
  dibagikan secara eksplisit lewat aturan `QuestionComment.visibility` sendiri.
- Like dan komentar pada postingan akun private ditolak di action untuk non-follower, bukan hanya
  disembunyikan tombolnya.
- Akun yang sudah dianonimkan (`anonymizedAt`) atau sedang menunggu penghapusan
  (`deletionRequestedAt`) menghasilkan 404 di `/u/[username]`, tidak dapat di-follow, dan
  postingannya tidak tampil di feed.

## Tahap 1 — Profil Publik

### Route

| Route | Isi |
|---|---|
| `/u/[username]` | Header profil, statistik, heatmap, dan reputasi. Tab Postingan menyusul di tahap 3. Param dinormalisasi ke lowercase; huruf besar di-redirect ke URL lowercase. |
| `/profile/info` | Tambahan field `bio` dan target level JLPT. |
| `/profile/privacy` | Section baru "Profil publik": toggle `PUBLIC`/`PRIVATE`. |
| `/profile` | Tautan "Lihat profil publik". |

### Isi profil

- **Header:** avatar, display name, @username, bio, target level, member sejak (bulan dan tahun),
  jumlah follower/following (tahap 2), dan tombol Follow atau "Edit profil" untuk pemilik.
- **Statistik:** memakai ulang `getCachedProfileOverview` (kana, kartu, latihan cepat, latihan
  seksi, mock), dengan aturan flag yang sama seperti `/profile`. Cache-nya sudah per `userId`,
  bukan per session, jadi aman dibaca untuk akun lain.
- **Heatmap aktivitas 365 hari dan streak** (saat ini dan terpanjang). Sumbernya
  `FlashcardRevlog.reviewedAt` (index `userId, reviewedAt` sudah ada), `Attempt.finishedAt`, dan
  `PracticeSession.finishedAt` yang berstatus selesai. Granularitas **per hari**, tidak pernah per
  jam: jam aktivitas membocorkan pola tidur. Batas hari memakai hari kalender di `User.timeZone`
  pemilik.
- **Reputasi "Membantu":** jumlah `QuestionCommentVote` pada entri publik hidup milik user, ditambah
  `PostLike` pada postingan hidupnya (tahap 3). Entri yang dihapus atau di-takedown tidak dihitung.
- **Jumlah entri diskusi publik.**

### Yang tidak ditampilkan

Skor dan kelemahan per mondai, analytics, history, conversation/speaking (data AI dengan opt-in
tersendiri), timezone, email, dan daftar event seperti "menyelesaikan Mock N3 Juli 2024". Yang
tampil hanya agregat.

### Implementasi tahap 1

- **Route:** `src/app/(public)/u/[username]/page.tsx`, dijaga `src/app/(public)/u/layout.tsx`
  (`FEATURES_PUBLIC_PROFILE`). Param divalidasi `UsernameParamSchema` (lebih longgar dari
  `UsernameSchema` supaya handle lama tetap terbuka), huruf besar di-redirect 308 ke lowercase.
- **Akses:** `src/features/public-profile/access.ts` (`canViewProfileContent`,
  `isProfileUnavailable`, `profilePath`), diuji `access.test.ts`. Statistik hanya diambil setelah
  aturan akses lolos, termasuk di `generateMetadata`; kartu private tidak membawa angka apa pun di
  payload.
- **Pemilik profil** dibaca `getPublicProfileOwner` per request (tanpa `unstable_cache`, hanya
  `cache` React untuk dedup metadata + page).
- **Statistik** memakai `getProfileOverview` (`src/features/profile/overview.ts`), dipindah dari
  file "use server" supaya tidak menjadi endpoint yang menerima `userId` sembarang. Cache-nya kini
  punya `revalidate: 600`, karena review flashcard tidak menginvalidasi tag apa pun dan sebelumnya
  "Kartu dipelajari" di `/profile` bisa basi tanpa batas waktu.
- **Heatmap:** satu query `UNION ALL` per sumber yang flag-nya hidup (`FlashcardRevlog` tanpa
  `MANUAL`/`RESCHEDULED`, `PracticeSession` dan `Attempt` yang `COMPLETED`), dikelompokkan per hari
  kalender di timezone pemilik. Cache 10 menit, kunci memuat hari pertama jendela dan tanda flag.
  Penyusunan grid, streak, dan label bulan ada di `activity.ts` (murni, diuji `activity.test.ts`).
  Client hanya menerima baris hari aktif dan menyusun grid sendiri; grid utuh menambah ~30 KB
  payload RSC. Intensitas warna memakai bobot (review 1, latihan cepat 10, ujian 25) dengan ramp
  hijau satu hue yang lolos validator ordinal skill dataviz; tooltip dan tabel per bulan
  ("Lihat sebagai tabel") memuat angka aslinya.
- **Reputasi:** satu CTE atas entri yang tampil publik (aturan `toDiscussionRoot`) dan suara
  `QuestionCommentVote`-nya, hanya untuk target yang flag diskusinya hidup. Cache 10 menit tanpa tag.
- **Pengaturan:** section "Profil publik" di `/profile/privacy` (`ProfileVisibilityForm`,
  `updateProfileVisibilityAction`); bio dan target level di form `/profile/info`
  (`UpdateProfileSchema`).
- **Banner** `PublicProfileNotice` di layout `(dashboard)`, tampil selama akun `PUBLIC` dan
  `publicProfileNoticeDismissedAt` NULL; ditutup lewat `dismissPublicProfileNoticeAction`, dan
  memilih visibility sendiri ikut mengisinya.
- **Tautan dari diskusi:** `DiscussionAuthor.profilePath` dihitung di
  `src/features/question-comment/queries.ts` (null bila flag mati atau akun anonim), dirender
  `CommentAuthorLine` sebagai tautan.

### SEO

- Profil `PUBLIC` diindeks, memakai `pageMetadata()` dan JSON-LD `ProfilePage` di
  `src/lib/json-ld.ts`.
- Profil `PRIVATE` diberi `noindex`. Saat user beralih ke private, halaman yang sudah terindeks
  hilang dari mesin pencari dengan sendirinya.
- Profil public **tanpa isi** (tanpa aktivitas, bio, maupun postingan) diberi `noindex, follow`,
  mengikuti aturan halaman diskusi tanpa entri: halaman tipis tidak punya nilai pencarian.
- Belum masuk sitemap. Profil ditemukan lewat tautan dari diskusi dan feed.

### Default PUBLIC untuk user lama

User yang mendaftar sebelum rilis tidak pernah menyetujui profil publik. Mitigasinya:

- Banner sekali tampil di dashboard dan `/profile` ("Profilmu kini publik di /u/xxx") dengan
  tautan ke `/profile/privacy`. Status "sudah ditutup" disimpan di kolom database, bukan
  `localStorage`, supaya tidak muncul lagi di perangkat lain.
- Form register menyebutkan bahwa profil publik secara default.
- Kebijakan Privasi dan Syarat & Ketentuan diperbarui (versi dan tanggal berlaku baru).

### Username

- `/u/[username]` membuat username menjadi bagian URL publik. Username tetap dapat diganti, dan URL
  lama menjadi 404; belum ada redirect dari username lama.
- Daftar username terlarang di `src/lib/username.ts` ditambah segmen route baru: `community`,
  `post`, `notifications`, `follow`, `followers`, `following`. Cek dulu apakah ada user yang sudah
  memakai salah satunya.

## Tahap 2 — Follow

### Perilaku

- Follow ke akun `PUBLIC` langsung `ACCEPTED`; ke akun `PRIVATE` menjadi `PENDING`.
- Follower dapat membatalkan permintaan atau berhenti mengikuti. Pemilik dapat menyetujui, menolak
  (baris dihapus), atau menghapus follower yang sudah ada.
- Beralih `PRIVATE` → `PUBLIC`: seluruh permintaan `PENDING` disetujui dalam transaksi yang sama
  dengan perubahan visibility. `PUBLIC` → `PRIVATE`: follower lama tetap.
- Tidak bisa mengikuti diri sendiri, akun anonim, atau akun yang sedang menunggu penghapusan.
- Action memakai keadaan yang diinginkan (`following: boolean`), bukan toggle, seperti
  `voteQuestionCommentAction`, supaya klik ganda dan retry idempoten.
- Rate limit `FOLLOW_RATE_LIMITS` (usulan 30 per jam, 200 per hari) per user, menghitung follow dan
  permintaan baru, supaya tidak dipakai menyepam permintaan.

### Route

| Route | Isi |
|---|---|
| `/u/[username]/followers`, `/u/[username]/following` | Daftar akun berstatus `ACCEPTED`, cursor pagination, `noindex`. Mengikuti aturan akses. |
| `/profile/follow-requests` | Daftar permintaan masuk dengan tombol setujui/tolak. Badge jumlah `PENDING` di navigasi profile dan sidebar (query count per request). |

Jumlah follower/following hanya menghitung `ACCEPTED`. Jumlah permintaan `PENDING` hanya terlihat
oleh pemilik. Status follow milik viewer ditempel terpisah dari data profil yang di-cache, mengikuti
pola `withViewerVotes()`.

### Implementasi tahap 2

- **Data:** tabel `Follow` (migration `20261003150000_follow`), PK `(followerId, followingId)`,
  CHECK `Follow_not_self_check`, RLS aktif tanpa grant Data API.
- **Akses:** `canViewProfileContent(owner, viewerId, viewerFollow)` — status follow viewer dibaca per
  request lewat `getViewerFollowStatus`, yang mengembalikan null saat `FEATURES_FOLLOW` mati,
  sehingga follower lama tidak lagi membuka akun private ketika fitur dimatikan.
- **Action** (`src/features/public-profile/follow-actions.ts`): `setFollowAction({ username,
  following })` dengan status awal dari `initialFollowStatus` dan `createMany` + `skipDuplicates`;
  `respondFollowRequestAction` dan `removeFollowerAction` selalu dibatasi ke baris yang
  `followingId`-nya milik session. Rate limit hanya untuk follow/permintaan baru.
- **Query** (`follow-queries.ts`): tanpa `unstable_cache`. Akun lawan yang anonim atau menunggu
  penghapusan tidak dihitung maupun ditampilkan. Daftar memakai kursor id akun lawan (`?after=`),
  30 per halaman.
- **UI:** `FollowButton` (Ikuti / Minta mengikuti / Diminta / Mengikuti, konfirmasi saat berhenti
  mengikuti akun private, guest diarahkan ke login), jumlah follower/following di header profil
  (menjadi tautan hanya bila daftar boleh dilihat), `FollowListView` untuk dua daftar, tombol
  "Hapus" follower untuk pemilik, `/profile/follow-requests` dengan setujui/tolak, badge di
  navigasi profile, keterangan di sidebar, dan tautan "N permintaan follow" di profil pemilik.
- **Tidak ada pemberitahuan** ke pihak lain saat ditolak atau dihapus dari follower; notifikasi
  baru datang di tahap 4.

## Tahap 3 — Postingan

### Isi postingan

- Teks polos maksimal 2.000 karakter, tanpa tautan yang dapat diklik (sama dengan komentar, sehingga
  tidak perlu `rel="ugc"` dan tidak menjadi magnet spam SEO).
- Maksimal 4 gambar. **Memakai ulang jalur upload komentar** — prefix
  `jlpt-exam/comments/{userId}/`, `createCommentImageUploadAction`, `CommentImageUploader`,
  `isAllowedCommentImageUrl`, dan kuota `COMMENT_IMAGE_UPLOAD_RATE_LIMITS` — alih-alih prefix
  `posts/` tersendiri seperti rancangan awal. Sifat objeknya sama (gambar publik milik user), jadi
  jalur kedua hanya menambah kode R2 tanpa perbedaan perlakuan.
- Dapat disunting (`editedAt` ditampilkan sebagai "disunting") dan dihapus.
- **Tidak pernah hard delete.** Postingan yang dihapus dan punya komentar menjadi tombstone; tanpa
  komentar, langsung hilang. `deletedById` membedakan hapusan pemilik dari takedown admin.

### Like

Satu like per user per postingan, dapat ditarik, tidak bisa me-like postingan sendiri. Jumlahnya
dihitung lewat `groupBy` untuk postingan di halaman yang sedang dibaca (pola `countVotes`), tidak
disimpan sebagai kolom. Siapa yang memberi like tidak dikirim ke client, konsisten dengan suara
diskusi. Suara pada komentar postingan memakai `QuestionCommentVote` dengan label "Membantu" yang
sama seperti diskusi lain (bukan "Suka" seperti rancangan awal), karena suara itu ikut dihitung
sebagai reputasi "Membantu".

### Komentar dan balasan

`QuestionComment.postId` menjadi target keempat. Komentar postingan selalu `PUBLIC` dengan
`sharedAt = createdAt` (tidak ada catatan privat pada postingan). Semua aturan modul
[Question comments](question-comment.md) berlaku: balasan satu tingkat, mention lewat
`repliedToId`, tombstone root, thread mati read-only, dan urutan "Paling membantu". `CommentTarget`
di `target.ts` mendapat jenis `post` dengan tautan `/post/<postId>#comment-<id>`.

### Route

| Route | Isi |
|---|---|
| `/community` | Feed global: postingan hidup dari akun `PUBLIC`, kronologis, cursor pagination. Guest boleh membaca. Halaman pertama diindeks; halaman lanjutan `noindex, follow`. |
| `/community/following` | Tab "Mengikuti": postingan akun yang diikuti, termasuk akun private yang sudah menyetujui. Per viewer, tidak di-cache, `noindex`. Guest melihat CTA login. |
| `/post/[id]` | Permalink: postingan, like, dan thread komentar. Akun private tanpa akses melihat "Postingan ini dari akun private" dengan `noindex`. Postingan terhapus tanpa komentar menjadi 404. JSON-LD `SocialMediaPosting`. |
| `/u/[username]` bagian Postingan | Halaman pertama postingan milik user di profilnya, mengikuti aturan akses. |
| `/u/[username]/posts` | Daftar lengkap dengan cursor pagination, `noindex` (setiap postingan sudah punya permalink). |

Permalink memakai id, bukan username, supaya tetap valid saat username diganti. Feed dan thread
tidak di-`unstable_cache`, dengan alasan yang sama seperti thread diskusi; status like milik viewer
ditempel terpisah.

### Pengaman

- **Laporan:** `ReportTargetType.POST` dan `Report.postId` (`SetNull`), kategori `ABUSE` dan
  `OTHER`. Tombol "Laporkan" di postingan; komentar postingan memakai target `COMMENT` yang sudah
  ada.
- **Moderasi:** tab Postingan di `/admin/moderation` untuk takedown dan memulihkan takedown admin,
  dengan jejak `AdminAuditLog`.
- **Suspend posting:** `isPostingSuspended()` juga menolak membuat dan menyunting postingan;
  komentar postingan sudah tertahan `checkPublicPostingAllowed()`. Menghapus postingan sendiri
  selalu bisa.
- **Rate limit:** `POST_WRITE_RATE_LIMITS` (5 per jam, 20 per hari) untuk membuat dan menyunting;
  komentar memakai `COMMENT_WRITE_RATE_LIMITS`; like `POST_LIKE_RATE_LIMITS` (120 per jam); upload
  gambar berbagi kuota dengan gambar komentar.

### Implementasi tahap 3

- **Modul** `src/features/community/`: `queries.ts` (feed global, tab Mengikuti, postingan per user,
  detail, `getPostAccess`), `actions.ts` (buat, sunting, hapus, like), `schemas.ts`, dan komponen
  `PostCard`, `PostComposer`, `LikeButton`, `PostFeed`/`FeedTabs`, `ComposerSection`.
- **Akses** satu pintu lewat `getPostAccess(postId, viewerId)`, yang memakai
  `canViewProfileContent` + status follow viewer. Dipakai permalink, like, laporan `POST`, dan
  setiap action komentar dengan target `post` (`requirePostAccess` di
  `src/features/question-comment/actions.ts`): tambah, sunting, balas, beri suara, dan
  `getDiscussionAction`. Postingan dari akun anonim atau yang menunggu penghapusan dianggap tidak
  ada.
- **Komentar postingan** selalu `PUBLIC`: `addQuestionCommentAction` menolak `PRIVATE` untuk target
  `post`, dan `setQuestionCommentVisibilityAction` menolak komentar postingan. Thread postingan yang
  dihapus dirender dengan prop `archived` di `DiscussionThread` (tanpa balas dan suara).
- **Tombstone** dibersihkan di `toPostCard`, bukan di JSX: postingan terhapus tidak membawa teks,
  gambar, identitas, maupun jumlah like ke client.
- **Feed global** urut `id desc` dengan kursor `?before=<id>` (20 per halaman), memakai PK — bukan
  index `deletedAt, createdAt` seperti rancangan awal. Index `userId, id` menopang profil dan tab
  Mengikuti.
- **Reputasi** "Membantu" kini menjumlahkan suara pada entri diskusi (termasuk komentar postingan)
  dan like pada postingan hidup milik user.
- **Moderasi:** `/admin/moderation?kind=posts` (`listPostModerationQueue`, `takedownPostAction`,
  `restorePostAction`, audit `post.takedown`/`post.restore`); komentar postingan tetap di antrean
  diskusi dengan konteks "Postingan #id · @username". Laporan `POST` menautkan ke antrean itu.
- **SEO:** `/community` diindeks dan masuk sitemap; postingan public diindeks dengan JSON-LD
  `SocialMediaPosting`; tombstone `noindex, follow`; postingan akun private `noindex`. Postingan
  satu per satu tidak didaftarkan di sitemap.
- **Navigasi:** menu "Komunitas" di header publik dan sidebar dashboard, mengikuti flag.

## Tahap 4 — Notifikasi dan Blokir

Belum dirancang rinci. Cakupan yang dicatat:

- Tabel `Notification` dengan jenis follow, permintaan follow, permintaan disetujui, like
  postingan, komentar, balasan, dan mention. Balasan di diskusi soal/kata/bunpou ikut masuk,
  sekaligus menutup item "Notifikasi balasan" yang sudah lama terbuka di `docs/plan.md`.
- Halaman `/notifications` dan badge belum dibaca. Halaman permintaan follow dari tahap 2 menjadi
  bagian darinya.
- Blokir user: akun yang diblokir tidak dapat mengikuti, melihat konten, berkomentar, atau
  me-like. Sampai tahap ini, menolak permintaan, menghapus follower, dan rate limit menjadi
  penahannya.
- Urutan "Populer" di feed (butuh counter like yang didenormalisasi).

## Model Data

Seluruh migration ditulis manual lalu diterapkan dengan `prisma migrate deploy`. Nilai enum baru
dipisah ke migration sendiri (`ALTER TYPE ... ADD VALUE`), mengikuti pola `report_bunpou_enum` →
`report_bunpou_target`.

| Perubahan | Tahap | Isi |
|---|---|---|
| `enum ProfileVisibility` | 1 | `PUBLIC`, `PRIVATE` |
| `User.profileVisibility` | 1 | Default `PUBLIC` |
| `User.bio` | 1 | Nullable, teks polos, maksimal 160 karakter |
| `User.jlptTarget` | 1 | `JlptLevel` nullable |
| `User.publicProfileNoticeDismissedAt` | 1 | Penanda banner default PUBLIC sudah ditutup |
| `enum FollowStatus` | 2 | `PENDING`, `ACCEPTED` |
| `Follow` | 2 | `followerId`, `followingId`, `status`, `createdAt`, `respondedAt`. PK `followerId + followingId`; CHECK `followerId <> followingId` (hanya di SQL); index `followingId, status, createdAt` dan `followerId, status, createdAt`; `onDelete: Cascade` di kedua sisi |
| `Post` | 3 | `userId` (`Restrict`, seperti `QuestionComment.userId`), `text`, `images[]`, `editedAt`, `deletedAt`, `deletedById` (`SetNull`), `createdAt`, `updatedAt`. Feed memakai PK; index `userId, id` untuk profil dan tab Mengikuti, `deletedById` untuk FK |
| `PostLike` | 3 | PK `postId + userId`, index `userId`; `Cascade` di kedua sisi |
| `QuestionComment.postId` | 3 | FK ke `Post` dengan `Restrict` (postingan tidak pernah hard delete). CHECK `QuestionComment_target_check` menjadi `num_nonnulls(questionId, vocabId, bunpouPointId, postId) = 1`. Index `postId, parentId, sharedAt` |
| `ReportTargetType.POST`, `Report.postId` | 3 | `SetNull`, index `postId` |

**Urutan deploy tahap 3:** seluruh query diskusi akan memilih kolom `postId`, jadi migration
`QuestionComment.postId` wajib diterapkan sebelum kode dideploy, seperti `bunpouPointId`.

## Akun dan Data Pribadi

Sesuai aturan `project-rules.md`, setiap relasi baru ke `User` wajib ikut ditangani:

- **`anonymizeAccount`:** soft delete seluruh postingan (`deletedById` = diri sendiri), hapus
  `PostLike` milik user, hapus `Follow` di kedua arah, kosongkan `bio` dan `jlptTarget`, kembalikan
  `profileVisibility` ke default. Akun anonim tidak punya halaman profil.
- **Export data akun:** postingan, like yang diberikan, daftar akun yang diikuti dan pengikut
  (username saja), status visibility, bio, dan target level.
- **Kebijakan Privasi:** profil publik dan indexing-nya, heatmap aktivitas, follow, postingan, dan
  aturan akun private.

## Feature Flag

| Key | Cakupan | Ketergantungan |
|---|---|---|
| `FEATURES_PUBLIC_PROFILE` | `/u/*`, section "Profil publik" di `/profile/privacy`, field bio dan target level di `/profile/info`, banner di dashboard, tombol "Lihat profil publik" di `/profile`, keterangan di halaman daftar, tautan username ke profil di diskusi | — (aktif sejak tahap 1) |
| `FEATURES_FOLLOW` | Tombol Follow, jumlah dan daftar follower/following, `/profile/follow-requests`, badge permintaan | Ikut mati bila `FEATURES_PUBLIC_PROFILE` mati (aktif sejak tahap 2) |
| `FEATURES_COMMUNITY` | `/community/*`, `/post/*`, `/u/*/posts`, bagian Postingan di profil, action postingan, like, dan komentar postingan, menu Komunitas, tab Postingan di moderasi | Ikut mati bila `FEATURES_PUBLIC_PROFILE` mati (aktif sejak tahap 3) |

Saat `FEATURES_FOLLOW` mati, konten akun private hanya terlihat oleh pemiliknya. Data tidak dihapus
saat flag dimatikan. Server Action yang dipanggil di luar segmen modul memeriksa flag sendiri.

## Keterbatasan yang Diterima

- Username yang diganti mematahkan URL profil lama (404, tanpa redirect).
- Reputasi dan jumlah like dapat digelembungkan dengan banyak akun; rate limit hanya per user.
- Sampai tahap 4 tidak ada notifikasi like, komentar, atau balasan, dan tidak ada fitur blokir.
- Kana tidak masuk heatmap karena `KanaProgress` hanya menyimpan waktu terakhir, bukan riwayat.
- Lampiran postingan di object storage tidak terhapus saat takedown, sama seperti lampiran komentar.

## Belum Diputuskan

- Markup furigana `{漢字|かんじ}` di dalam postingan. Cocok untuk app belajar bahasa Jepang, tetapi
  menambah validasi markup pada teks bebas.
- Postingan yang menautkan objek aplikasi (pola bunpou, artikel, kata) sebagai kartu bagikan.
- Angka rate limit postingan, like, dan follow saat ini masih nilai awal; tinjau setelah ada data
  pemakaian nyata.
