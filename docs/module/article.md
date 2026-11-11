# Modul Article

## Status

Modul editorial dengan bacaan Indonesia/Jepang, reader bilingual, interaksi akun,
diskusi publik, serta editor visual khusus admin. Migration dan seed diuji pada
PostgreSQL lokal terpisah; deployment production belum dilakukan pada sesi ini.

## Pengalaman pembaca

- Katalog menampilkan pilihan redaksi, bacaan terbaru, kategori, dan pintasan level.
- Search mencari judul/ringkasan kedua bahasa, isi, serta penulis. Filter kategori,
  bahasa, level N5–N1, dan beberapa tag topik; semua tag terpilih harus cocok.
- Satu identitas artikel untuk mode Indonesia, Jepang, dan bilingual. Dalam mode
  bilingual, bahasa Jepang menjadi teks utama dan arti Indonesia dapat dibuka per
  blok atau sekaligus. Tampilan sejajar tersedia pada layar lebar.
- Furigana menggunakan markup `{漢字|かんじ}` yang dirender menjadi ruby semantik.
  Bukan HTML mentah dan bukan hasil tebak otomatis saat membaca.
- Kontrol ukuran teks 17–25 px, latar terang/kertas/gelap, daftar isi, dan kosakata
  pilihan. Pada mobile, furigana ada di menu Pengaturan.
- Preferensi reader disimpan di localStorage perangkat, tidak masuk akun atau cache
  server. Pilihan yang rusak diabaikan; browser tanpa storage tetap dapat membaca.
- Like, simpan untuk nanti, dan share URL kanonis. Masuk diperlukan untuk like,
  bookmark, komentar, balasan, dan suara membantu; membaca tetap terbuka bagi tamu.
- Halaman `/article/saved` adalah koleksi privat masing-masing akun.
- Font Jepang di-host lokal. Sampul seed berupa foto berlisensi dengan atribusi.

## Editorial dan publikasi

Semua action admin memanggil `requireAdmin()`; role dibaca dari database.
Hanya admin dapat membuat, mengubah, menerbitkan, memilih featured, atau mengarsipkan.

Editor memakai react-hook-form dan Zod yang sama dengan Server Action. Isi dibuat
lewat blok visual: heading, paragraf, daftar, kutipan, contoh dialog, catatan, dan
gambar. Blok dapat ditambah, dipindahkan, dan dihapus; pasangan bahasa tetap di blok
yang sama. Kosakata, catatan kosakata, sampul/alt/kredit, kategori, tag, dan level
juga dapat disunting. Tab Pratinjau memakai komponen reader publik.

Indonesia wajib. Artikel Indonesia dapat berisi contoh kalimat Jepang tanpa harus
memiliki versi Jepang lengkap. Begitu terjemahan Jepang mulai diisi pada judul,
ringkasan, atau blok narasi, publikasi mewajibkan seluruh pasangan, judul/ringkasan
Jepang, dan perkiraan level bacaan. Draf boleh menyimpan terjemahan parsial.

- **Draf baru:** belum tampil publik.
- **Terbit:** status PUBLISHED dan publishedAt tidak di masa depan.
- **Revisi privat:** tombol Simpan draf pada artikel terbit hanya menyimpan snapshot
  `Article.draft`; judul, isi, kategori, tag, dan pengaturan publik tetap versi lama.
  Terbitkan mengganti versi publik dan mengosongkan snapshot.
- **Arsip:** tidak tampil di katalog, pencarian, koleksi tersimpan, atau detail publik.
  Diskusi dan interaksi tetap tersimpan.
- Slug yang pernah terbit tidak dapat diubah. Nama `saved`, `search`, dan `read`
  dicadangkan untuk route.
- Hapus permanen hanya untuk draf yang belum pernah terbit dan tanpa komentar.
  Artikel terbit harus diarsipkan. Keputusan ini diverifikasi di dalam transaksi.
- Seluruh mutasi editorial dan sematan komentar dicatat pada audit admin.

Belum ada autosave, riwayat banyak revisi, jadwal terbit, atau generator terjemahan/
furigana otomatis. Penyimpanan draf tetap membutuhkan identitas, sampul, dan isi
Indonesia yang valid.

## Diskusi dan moderasi

Komentar menggunakan `QuestionComment.articleId`, target kelima pada sistem
diskusi bersama. Komentar artikel selalu publik dan harus memiliki sharedAt;
balasan mewarisi target root. Aturan ownership, kuota Redis, suspend akun, gambar,
laporan COMMENT, suara Membantu, serta takedown/pemulihan memakai alur yang sama
dengan diskusi soal/kata/pola.

Pembaca dapat menyunting dan menghapus tulisan sendiri. Penghapusan adalah soft
delete: root dengan balasan menjadi tombstone tanpa isi/identitas dan balasan orang
lain tetap terbaca. Admin dapat menyematkan root atau menutup diskusi per artikel.
Penutupan melarang menulis/membalas/menyunting serta menambah suara, tetapi diskusi
lama tetap dapat dibaca dan pemilik tetap bisa menghapus tulisannya.

Diskusi mengambil 20 root per halaman, sematan lebih dahulu lalu terbaru. Urutan
Paling membantu hanya berlaku pada halaman yang sedang dibaca. Balasan tetap
kronologis. Permalink menghitung halaman root agar laporan dan moderasi dapat
membuka komentar yang tepat. Belum ada notifikasi balasan.

## Data, privasi, dan cache

- Body JSON tervalidasi; bodyText diturunkan dari kedua bahasa tanpa sintaks ruby.
- Level menunjukkan kesulitan bacaan Jepang, terpisah dari kategori dan tag topik.
- Query publik memakai explicit select tanpa snapshot draf.
- Like/bookmark mengirim keadaan tujuan. Transaksi mengunci user lalu artikel agar
  retry tidak menggandakan angka dan tidak beradu dengan anonimisasi akun.
- View dihitung sekali per akun login; bukan jumlah seluruh visitor.
- Anonimisasi menghapus bookmark/like dan mengurangi agregat suka. Komentar sendiri
  ditarik tanpa menghapus balasan pembaca lain.
- Cache global untuk katalog/detail/facet/sitemap sekitar satu jam; search 30 menit.
  Mutasi editorial/like/first-view menginvalidasi tag terkait.
- State viewer, koleksi tersimpan, dan diskusi dibaca per request, tanpa cache bersama.
- RLS dan penolakan grant Supabase Data API tetap berlaku; seluruh akses via Prisma.
- Search masih memakai contains, belum full-text ranking. Balasan pada root yang
  tampil dimuat bersama; pagination balasan belum disediakan.

## Route dan feature flag

`FEATURES_ARTICLE` default true, berlaku pada seluruh route di bawah /article
dan action interaksi/diskusinya. Admin tetap dapat menyiapkan konten ketika flag
publik mati. Flag diskusi soal tidak mematikan diskusi artikel.

| Route | Fungsi |
|---|---|
| /article | Katalog |
| /article/search | Search/filter dengan cursor delapan bacaan per halaman |
| /article/[slug] | Reader dan diskusi |
| /article/saved | Koleksi akun, login wajib, noindex |
| /article/read/[id]?comment=[id] | Pengalih ke slug serta halaman/anchor komentar |
| /article/[slug]/cover | Fallback cover metadata |
| /admin/article | Daftar dan aksi editorial |
| /admin/article/new | Buat artikel |
| /admin/article/[id] | Editor dan pratinjau |

Link header/footer/home/sitemap mengikuti flag. Konfigurasi lokal workspace masih
mematikan artikel; server QA port 3047 memakai override FEATURES_ARTICLE=true.

## Seed dan deployment

`src/features/article/data/article-seed.json` memuat tepat satu fixture:
**Singgah di konbini, pulang dengan kata baru**, slug `singgah-di-konbini`,
perkiraan N4, 18 blok berpasangan dan 12 kosakata. Sampul serta lisensinya ada di
`public/articles/README.md`. Tidak ada akun/like/komentar palsu dalam seed.

```sh
npm run seed:articles:check
npx prisma migrate deploy
npm run seed:articles
```

Pastikan kedua URL database menunjuk target yang dimaksud. Migration baru
`20261108124838_article_bilingual_reader` wajib diterapkan sebelum kode ini.
Seed idempoten berdasarkan slug, hanya memperbarui fixture tersebut, mempertahankan
interaksi/snapshot draf dan artikel lain. Seed bukan pengganti audit editorial.
Jalankan sebelum server pertama kali dibuka, atau invalidasi cache artikel setelah
reseed melalui admin ops/redeploy. Aktifkan FEATURES_ARTICLE=true saat siap dibuka.

## Verifikasi

Lihat [verifikasi artikel](../verification/article-bilingual-reader.md).
