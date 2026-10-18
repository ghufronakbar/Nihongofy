# Kotoba Clash - Refinement Lobby

Tanggal: 17 Oktober 2026. Cakupan: draft konfigurasi, posisi save, kick peserta, rename,
dan default nickname profil. Semua pemeriksaan developer memakai fixture lokal disposable;
tidak ada migration, perubahan Redis, atau deployment production pada sesi ini.

## Perilaku

- Draft host memperlihatkan alert bahwa room masih memakai config tersimpan. Ready/Start host
  disabled sampai perubahan disimpan. Mengembalikan pilihan semula menghilangkan alert; urutan
  checkbox tidak mengubah arti config. Peserta lain hanya melihat config yang telah disimpan.
- Save berpindah ke panel pemain kanan sticky. Di mobile tombol yang sama fixed di bawah hanya
  selama draft ada. Tombol tetap terikat ke form asli dan validasi Zod/stok soal.
- Kick memerlukan host, anggota target pada room yang sama, dan tidak ada match aktif. Dialog
  konfirmasi menyebutkan akibatnya. Host sendiri tidak dapat dipilih. Retry kick idempotent.
- `kickedAt` mempertahankan identity dan hasil lama tetapi menolak join/read/command berikutnya.
  Target hilang dari line-up, hitungan slot, dan roster baru walaupun lease presence belum hilang.
  Nama tetap dicadangkan pada membership historis sampai retensi berakhir.
- Notifikasi privat WebSocket `KICKED` diikuti close 4005; target mendapat terminal khusus.
  Reload mendeteksi status yang sama. Kegagalan HTTP upgrade saat reconnect dibaca ulang melalui
  Server Action agar kick saat offline tidak menghasilkan loop reconnect tanpa penjelasan.
- Pemain/spectator/host dapat rename sendiri sebelum bermain dan setelah selesai. Collision
  dinormalisasi dan diserialisasi oleh lock room. Rename tidak mengubah profil; hasil lama memakai
  nama membership terbaru sesuai model existing. Selama countdown/question/reveal rename ditolak.
- Create/join akun diisi dari `displayName` profil, disesuaikan dengan aturan nickname dan batas
  24 unit UTF-16 tanpa memotong surrogate pair. Guest tetap memilih nickname sendiri.

## Migration Dan Rilis

Migration: `20261017164300_kotoba_clash_lobby_refinements`, satu ADD COLUMN nullable
`KotobaClashRoomMember.kickedAt TIMESTAMPTZ(3)`. Row lama tetap NULL. Tidak ada seed, backfill,
index, env, flush Redis, atau policy baru. Index prefix room existing mencukupi query lobby;
RLS/grant tertutup tidak berubah. Export akun menyertakan timestamp sendiri; anonimisasi
akun/guest mengosongkannya bersama linkage personal.

Prisma create-only memakai baseline generator disposable karena shadow replay migration lama
gagal pada tabel internal `_prisma_migrations`. SQL hasil generator ditinjau, lalu diterapkan
pada DB lokal yang sudah memiliki seluruh 43 migration existing; total 44 migration applied.

Urutan production:

1. Selesaikan match aktif dan gunakan prosedur drain runtime existing agar instance lama berhenti
   menerima command saat redeploy (lihat modul/runbook runtime).
2. Jalankan `npx prisma migrate deploy` dengan DIRECT_URL target yang benar.
3. Redeploy, refresh seluruh tab host/pemain, dan pastikan socket deployment lama sudah berakhir
   sebelum mengaktifkan kembali permainan. Server lama belum memeriksa status kick.
4. Jalankan acceptance dua browser: draft/save, kick online/offline/reload, rename setelah match.

## Bukti Lokal

- Room checker: 19 kelompok PASS pada PostgreSQL 17.11 dan Redis lokal. Meliputi rename bersamaan,
  kick guest/akun, otorisasi target, retry, larangan aktif, ledger lama, stale presence, dan race
  Start/kick serta export/anonimisasi timestamp kick. Foundation checker: 8 kelompok PASS termasuk
  RLS/grant dan anonimisasi akun.
- Unit/SSR/socket: input ketat, actor scope, invalidation hanya setelah commit, pesan privat
  sebelum socket ditutup, terminal reload, default profil dan perbandingan draft.
- Browser fixture lokal 1280x720 dan 390x844: draft menahan Start; save dari tombol eksternal
  memperbarui config/reset ready; dialog kick/fokus cancel; nickname awal terisi. Mobile tidak
  overflow horizontal dan tombol save tetap terlihat ketika form di-scroll. Tidak ada console error.
- Preview hanya memanggil komponen UI dengan state fixture; command save disimulasikan di parent,
  tanpa request server aplikasi. Pembuktian transaksi terpisah memakai checker database nyata.
  Route preview sementara dihapus setelah pemeriksaan; screenshot berisi nama/kode sintetis.
- `npm run verify`: PASS, 659 tes /50 file, lint 0 warning, TypeScript strict dan production build.
  `prisma validate`: PASS. Migration status lokal: up to date (44 applied). `git diff --check`: PASS.
  Notice AWS SDK tentang dukungan Node 20 setelah Januari 2027 adalah notice existing nonblocking.
- Evidence terstruktur: [JSON](evidence/2026-10-17-kotoba-clash-lobby-refinements.json).
  Seluruh fixture user/room/match/package kembali 0; PostgreSQL/Redis disposable dihentikan.

Screenshot pemeriksaan lokal tidak disimpan dalam repository.

## Acceptance Production Yang Masih Perlu Dijalankan

1. Host ubah checkbox/jumlah; periksa alert dan Start tertahan. Save; semua ready reset dan
   browser peserta menerima config terbaru. Simulasikan save gagal; draft tetap bisa disimpan ulang.
2. Kick guest/akun/spectator saat lobby dan setelah selesai. Target melihat alasan, tidak bisa
   join ulang dengan identitas yang sama, termasuk setelah reload dan putus koneksi saat kick.
3. Rename diri sendiri pada dua browser, coba nama sama dan ganti setelah selesai. Profil akun
   tetap sama, hasil room memakai nama baru; nickname awal create/join berasal dari profil.
4. Pastikan kick tidak tersedia selama match dan hasil/jawaban lama tetap terlihat oleh anggota
   lain. Dua host berbeda tetap dapat membuat room masing-masing.

Known issue: tidak ada blocker correctness lokal. UAT dua browser pada deployment/multi-instance
belum dilakukan (P2, user/Release Owner); migration wajib sebelum rilis (P1 release gate).
Kapasitas/kuota free tier tetap mengikuti pengukuran operasional existing, tidak diklaim dari tes ini.
