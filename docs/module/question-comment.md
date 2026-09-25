# Modul Question Comment

## Status Aktual

**Catatan belajar pribadi selesai; berbagi catatan ke diskusi publik dan balasan satu tingkat sudah aktif.** User login dapat menambah, mengedit, menghapus, dan melampirkan gambar pada soal di mode baca dan result detail, lalu membagikan catatan itu ke diskusi yang dapat dibaca semua orang termasuk guest.

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

## Scope

- Catatan default privat. Publik hanya terjadi karena tindakan eksplisit pemiliknya.
- `Question.explanation` adalah pembahasan resmi/terkurasi; `QuestionComment` adalah catatan user, dan keduanya tetap dipisahkan.
- Diskusi dapat dibaca guest; menulis dan membalas butuh login.
- Moderasi admin tersedia di `/admin/moderation`. Yang belum ada: laporan penyalahgunaan dari user, notifikasi balasan, like, dan sorting selain terbaru.

## Model Data

Satu tabel `QuestionComment` untuk catatan pribadi dan thread publik — yang dibagikan adalah record yang sama, bukan salinannya, sehingga edit tidak perlu disinkronkan antar tabel.

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
- Route ini `noindex` lewat metadata layout dan masuk `disallow` di `robots.ts`. Alasan semula "menunggu dashboard admin"; moderasinya kini ada, jadi membuka indexing tinggal keputusan produk — lihat Tahap 5 di `docs/plan.md`. Ingat `robots.txt` di-prerender saat build.

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
- Tidak ada rate limit khusus pada pembuatan comment/balasan; yang ada hanya batas 2.000 karakter dan 4 gambar.
- Tidak ada pencarian, tag, pin, export, atau halaman agregat semua catatan.
- Guest melihat form catatan pribadi, tetapi submit diarahkan ke login.

## File Utama

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
- `src/features/admin/moderation/` — antrean dan action takedown milik admin, terpisah dari action user di atas yang tetap menolak non-pemilik
