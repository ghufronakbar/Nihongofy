# Modul Mini Games

Tanggal rancangan: **16 Oktober 2026 (Asia/Jakarta)**.

## Status Aktual

**Direncanakan, belum diimplementasikan.** Dokumen ini menetapkan katalog publik untuk beberapa
mini game. Route, menu, feature flag, dan registry di bawah adalah rencana, bukan fitur yang sudah
tersedia. Perubahan saat dokumentasi ini dibuat tidak mengubah kode, database, atau deployment.

Rujukan:

- [Kotoba Clash](kotoba-clash.md): aturan dan rancangan game pertama.
- [Rencana pengerjaan](../plan/mini-games-kotoba-clash.md): tahap, dependensi, dan exit criteria.
- [Checklist UAT](../verification/mini-games-kotoba-clash-uat.md): skenario dan bukti penerimaan.
- [Public shell](public-shell.md), [aturan project](../project-rules.md), dan
  [project overview](../project-overview.md): integrasi dengan aplikasi existing.

## 1. Tujuan dan Penamaan

**Mini Games** adalah nama halaman publik yang menampung permainan belajar bahasa Jepang.
Game pertama bernama **Kotoba Clash**, dengan deskripsi **Battle kuis JLPT bersama teman**.
"Kotoba" berarti kata/bahasa; game mencakup kosakata, tata bahasa, dan pemahaman bacaan.

Katalog bukan halaman battle yang diganti judulnya. Setiap game memiliki landing, aturan,
kemampuan guest, dan lifecycle sendiri. Game berikutnya tidak harus memakai room, WebSocket,
bank soal JLPT, atau sistem poin Kotoba Clash.

| Elemen | Identitas |
|---|---|
| Nama wadah publik | Mini Games |
| Route katalog | `/mini-games` |
| Game pertama | Kotoba Clash |
| Stable key / slug | `kotoba-clash` |
| Route game | `/mini-games/kotoba-clash` |
| Feature katalog | `src/features/mini-games` |
| Feature game pertama | `src/features/kotoba-clash` |

Nama Kotoba Clash adalah pilihan penamaan untuk rancangan ini. Slug dan nama tampilan dipisahkan
agar perubahan nama tampilan tidak mengharuskan perubahan identitas data.

## 2. Keputusan Produk

- Halaman katalog dan landing game bisa dibaca tanpa login.
- Menu utama publik bernama **Mini Games**, menuju katalog; setiap game muncul sebagai kartu.
- Tidak perlu menambahkan satu menu header baru untuk setiap game.
- User bisa memahami tujuan, jumlah pemain, dan kebutuhan login sebelum menekan CTA.
- Kotoba Clash mendukung 2-20 pemain. Host login; peserta boleh memakai akun atau guest.
- Link undangan tetap langsung menuju room. Penerima tidak dipaksa melewati katalog.
- Game yang belum ada tidak dipresentasikan sebagai fitur aktif. Peluncuran pertama cukup satu
  kartu nyata; tidak mengarang nama, pemain online, hasil, atau daftar game tambahan.
- Tidak ada daftar room publik pada v1. Penemuan room melalui kode atau link undangan.

## 3. Route dan Navigasi yang Direncanakan

Semua halaman berada di route group `(public)` dan mengikuti header/footer existing.

| Route | Isi | Akses | SEO |
|---|---|---|---|
| `/mini-games` | Katalog game dan penjelasan singkat | Publik | Indexable setelah rilis |
| `/mini-games/kotoba-clash` | Aturan, Buat Room, dan Masukkan Kode | Publik; Buat Room memerlukan login | Indexable setelah rilis |
| `/mini-games/kotoba-clash/room/[code]` | Join, lobby, pertandingan, spectator, dan rematch | Identitas akun/guest yang divalidasi server | `noindex` |
| `/mini-games/kotoba-clash/room/[code]/results/[matchId]` | Hasil satu pertandingan | Membership room yang sah | `noindex` |

Tidak menambahkan redirect `/battle` pada implementasi awal karena route tersebut belum pernah
dirilis. Canonical katalog dan landing memakai `pageMetadata()` existing; room dan hasil memakai
`privateMetadata()`. Room tidak dimasukkan ke sitemap dan dilarang diindeks, tanpa menganggap
`robots.txt` sebagai proteksi akses.

Integrasi navigasi: header desktop/mobile, shortcut dashboard yang relevan, dan entry home bila
ditambahkan. Semua entry mengikuti flag; katalog yang mati tidak meninggalkan link menuju 404.
Link undangan memakai `APP_URL` environment aktif agar preview tidak membagikan URL production.

## 4. Registry dan Batas Tanggung Jawab

Registry awal adalah data statis bertipe di `src/features/mini-games/data/games.ts`, bukan tabel
database atau CMS baru. Setiap entry membawa stable key, slug, nama, deskripsi, route, jenis
permainan, rentang pemain, kemampuan guest, dan status rilis yang benar.

- Registry hanya untuk penemuan dan presentasi game, bukan penyimpanan sesi permainan.
- Ketersediaan efektif dihitung dari feature flag server; registry bukan sumber otorisasi.
- UI katalog memakai komponen shared existing, dengan daftar kartu yang tetap rapi saat hanya
  satu game tersedia. Pertahankan bahasa visual neo-brutalist project dan dukungan mobile.
- Game baru menambahkan feature, route, entry registry, dokumentasi, dan flag sendiri bila perlu.
- Jangan membuat engine universal untuk game yang belum dirancang. Domain Kotoba Clash tidak
  menjadi dependensi wajib bagi game berikutnya.

## 5. Feature Flag yang Direncanakan

| Env | Arti | Perilaku |
|---|---|---|
| `FEATURES_MINI_GAMES` | Wadah Mini Games | Mati: katalog dan seluruh turunannya 404; menu/CTA hilang |
| `FEATURES_KOTOBA_CLASH` | Game Kotoba Clash | Mati: game, room, hasil, action, dan socket tidak tersedia |

Ketersediaan efektif Kotoba Clash = kedua flag aktif. Hub tetap dapat hidup saat satu game
dimatikan, sehingga game berikutnya tidak ikut mati. Jika tidak ada game tersedia, tampilkan
empty state jujur tanpa CTA bermain yang tidak berfungsi.

Flag belum ditambahkan ke `src/constants/index.ts`. Saat diimplementasikan, ikuti parser flag
existing; set kedua env secara eksplisit `false` pada deployment sampai release gate selesai.
Guard wajib ada pada layout, Server Action, dan handshake/command WebSocket. Mematikan flag juga
menolak command baru dari koneksi lama dan menutupnya dengan alasan yang bisa ditampilkan UI.
Env dibaca saat startup, sehingga perubahan env memerlukan redeploy. Socket deployment lama tidak
otomatis membaca env baru: fase B wajib menetapkan dan menguji invalidasi/drain lintas deployment
untuk memenuhi kontrak penonaktifan tersebut, bukan hanya memeriksa flag pada handshake.

## 6. Keadaan UI dan Aksesibilitas

- Katalog: tersedia, kosong, flag mati, serta CTA yang sesuai status login.
- Landing: aturan singkat, 2-20 pemain, guest diperbolehkan, jumlah soal, dan cara bergabung.
- Guest yang ingin membuat room mendapat CTA login dengan `next` internal yang aman.
- Form kode mendukung paste/keyboard, normalisasi kode, loading, dan pesan room tidak ditemukan,
  ditutup, penuh, atau sedang bermain. Room bermain menawarkan spectate bila kapasitas tersedia.
- Kartu game menampilkan kebutuhan akun dengan jelas; detail Redis/Vercel tidak menjadi copy
  produk. Error teknis memberi pesan singkat dan tindakan yang berguna.
- Fokus keyboard, label form, target sentuh, kontras, dan reduced motion mengikuti komponen
  existing. Status tidak dibedakan dengan warna saja.

## 7. Kondisi Rilis

Katalog baru dianggap aktif setelah route, navigasi, flag, metadata, dan minimal satu game
melewati gate rilisnya. Status modul di [index](index.md) harus tetap "Direncanakan" sampai kode
dan hasil verifikasinya benar-benar tersedia.

Perubahan database saat ini: **tidak ada**. Katalog sendiri tidak membutuhkan migration.
