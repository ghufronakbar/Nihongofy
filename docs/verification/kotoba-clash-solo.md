# Verifikasi Mode Solo Kotoba Clash

Tanggal: **18 Oktober 2026 (Asia/Jakarta)**.

Mode solo tersedia di kode. Pemeriksaan memakai PostgreSQL 17.11 disposable di loopback,
Next.js 16.3.5 dan Prisma 6.19.3. Tidak ada deployment atau perubahan database remote.
Mode disimpan pada JSON config existing sehingga tidak memerlukan migration baru.

## Hasil Otomatis

- `npm run verify`: PASS; lint, TypeScript, 54 file/694 tes, dan build produksi.
- `npm run check:kotoba-clash:solo -- <database-loopback-kotoba_...>`: PASS, 5 kelompok.
  Mencakup create/Start concurrent, owner resume, akun/guest ditolak, mode immutable,
  pengaturan awal belum tersimpan, satu pemilik online tanpa ready, kunci jawaban privat,
  retry jawaban, reveal langsung untuk jawaban benar/salah, lima ronde, rumus skor/streak,
  hasil/review historis, rematch tanpa ready, timeout, serta minimum multiplayer tetap dua.
- Checker fondasi existing: PASS, 8 kelompok; transaksi Start/jawaban/finalisasi,
  spectator, guest expiry, waktu penerimaan setelah lock, constraint SQL, RLS dan anonimisasi.
- Checker early reveal existing: PASS, 5 kelompok; quorum multiplayer termasuk pemain offline,
  perubahan jadwal satu kali, reveal 8 detik, scoring, hasil/export, dan kompatibilitas v1.

Seluruh checker menolak target non-loopback dan database tanpa prefix `kotoba_`.
Fixture identitas dan room dibersihkan setelah pemeriksaan.

## Pemeriksaan Browser

Komponen asli diuji melalui route fixture sementara, lalu route tersebut dihapus.

- Landing akun: pemilih "Bersama teman" / "Main sendiri" mengubah judul, penjelasan dan CTA.
- Lobby solo: satu pemain tanpa ready, tombol mulai aktif setelah konfigurasi tersimpan.
  Mengubah jumlah soal menjadi 10 mengaktifkan Simpan dan menonaktifkan Mulai.
- Arena dan hasil memakai skor/progres pribadi, benar/salah/kosong dan rekor streak.
  Tampilan hasil tidak menyatakan pemain tunggal sebagai juara multiplayer.
- Landing, lobby, arena dan hasil diperiksa pada 320x800; lebar dokumen 320px.
  Landing serta hasil diperiksa juga pada desktop 1280x900.
- Viewport browser dipulihkan dan fixture dibersihkan setelah pengujian.

## Batas Verifikasi

Pemeriksaan browser memakai state fixture; alur akun/WebSocket pada hosting target masih
memerlukan UAT setelah deployment. Runtime/feature flag existing tetap berlaku.

Checklist UAT hosting:

- [ ] Akun memilih Main sendiri, membuat sesi, menyimpan konfigurasi, lalu mulai tanpa ready.
- [ ] Sesi dapat dilanjutkan setelah reload/reconnect dengan jawaban pertama tetap tersimpan.
- [ ] Akun lain/guest yang membuka URL tidak bisa bergabung atau melihat soal/hasil pribadi.
- [ ] Jawaban memulai pembahasan segera; tanpa jawaban menunggu deadline, lalu lanjut otomatis.
- [ ] Hasil, review, latihan ulang dan multiplayer dua pemain bekerja pada perangkat target.
