# Verifikasi UI/UX Kotoba Clash

Tanggal: **17 Oktober 2026 (Asia/Jakarta)**. Status: implementasi, pemeriksaan visual lokal,
dan gate engineering **PASS**. Acceptance tampilan baru di production **NOT RUN**.

## Perubahan dan cakupan

Permintaan user mencakup undangan yang masih tampil saat room expired, kontrol yang belum
konsisten dengan neobrutalism Nihongofy, avatar peserta, dan pengalaman pertandingan yang lebih
hidup. Landing, join, lobby, runner, hasil dan review kini memakai kontrol game, line-up,
leaderboard, crown, rekor streak berwarna, timer progress, transisi fase dan visual juara.

Route terdampak: `/mini-games/kotoba-clash`, `/room/[code]`, dan
`/room/[code]/results/[matchId]` di bawah route game tersebut. Command server dan rumus skor tidak
berubah. Query snapshot menambah URL avatar akun; wire field opsional untuk kompatibilitas.
Room closed/expired mendapat terminal screen yang menyembunyikan undangan dan menghentikan retry.

Streak visual memakai **bestStreak dari ronde selesai**, dengan tier 3 orange, 5 biru, 8 merah
muda, dan 10 emas. Rekor ini tidak berkurang setelah salah; streak aktif dan bonus engine tetap
mengikuti aturan v1. Rank 1 mendapat crown setelah mencetak poin, termasuk rank bersama saat tie.

## Metode dan bukti lokal

- Next dev pada localhost, In-app Browser, desktop **1280x900** dan mobile **390x844**.
- Landing diperiksa melalui route aktual. Join/lobby/runner/hasil memakai komponen aktual dengan
  fixture nickname/soal/standing dan transport lokal; tidak mengirim create/join/answer ke production.
- Route visual sementara dihapus sebelum gate build. Tab uji ditutup dan viewport dikembalikan.
- Avatar fixture memakai ikon brand lokal sebagai pengganti foto pribadi. Query relasi avatar
  production dibaca dalam transaksi `READ ONLY`: 2 member, 1 akun, 1 avatar; query berhasil.
  Tidak menyalin nickname, ID, kode room atau URL foto production ke bukti.

| Pemeriksaan | Hasil dan batas bukti |
|---|---|
| Kontrol neobrutalism | PASS lokal; border tombol/input 3 px, shadow tombol 4 px, font Geist weight 800/700; kontrol config diperiksa visual |
| Terminal sejak awal | PASS lokal; closed snapshot membuka 0 socket, tanpa kode/undangan/join/reconnect atau error koneksi lama |
| Terminal saat tersambung | PASS fixture; closed snapshot dan command error EXPIRED menutup socket, undangan hilang, jumlah constructor socket tidak bertambah sesudahnya |
| Checkbox bertingkat | PASS lokal; parent memilih seluruh anak yang tersedia, uncheck anak mengembalikan parent indeterminate |
| Nickname dan avatar | PASS lokal; preview berubah mengikuti input, akun memakai image, guest memakai initial berwarna |
| Countdown dan HUD | PASS visual; angka countdown, posisi/poin sendiri, crown dan api pada standing terlihat |
| Jawaban terkunci | PASS fixture; ownAnswer menyorot pilihan sendiri dan seluruh pilihan disabled tanpa tanda benar/salah |
| Spectator | PASS fixture; status penonton terlihat dan seluruh pilihan disabled |
| Reveal | PASS fixture; jawaban benar, feedback pribadi, pembahasan dan countdown lanjutan muncul pada fase REVEAL |
| Transisi mobile | PASS fixture; snapshot soal 6 ke 7 mengembalikan header soal ke posisi sekitar 112 px, tanpa reload |
| Hasil akhir | PASS visual fixture; juara/crown, confetti singkat dan papan hasil ditampilkan |
| Responsiveness | PASS lokal; landing, join, lobby, dan arena mobile tidak overflow horizontal (scrollWidth = innerWidth = 390) |
| Keyboard/reduced motion | Focus-visible, label form, aria timer/status dan reduced-motion tersedia di kode; perjalanan keyboard penuh, screen reader dan emulasi OS reduced motion NOT RUN |

Pemeriksaan visual menggunakan data ilustrasi lokal, **bukan hasil pertandingan production**.
Screenshot pemeriksaan lokal tidak disimpan dalam repository.

## Gate engineering

Lima tes regresi renderer menutup terminal closed/expired, pilihan terkunci pada deadline,
feedback/kunci/pembahasan tersembunyi sebelum REVEAL, dan timer live yang tidak tampil pada review.
Tes renderer tidak membuktikan privasi payload WebSocket/RSC secara menyeluruh; proyeksi server
tetap diuji oleh tes domain existing, dan leak audit production masih ada di checklist UAT.

Hasil `npm run verify`: **PASS**, exit 0; lint tanpa error/warning, TypeScript strict,
**643 tes /48 file**, dan production build. Run pertama berhenti pada cache type Next dev yang masih
merujuk route visual sementara setelah dihapus. Cache generated terkait dibersihkan dan route
types digenerate ulang dengan `next typegen`; gate dijalankan ulang pada source final.
Build lokal juga mengeluarkan pemberitahuan AWS SDK tentang kebutuhan Node >=22 untuk versi SDK
yang diterbitkan mulai Januari 2027 (runtime lokal 20.19.6); build saat ini tetap lulus.

## Migration dan deploy

- Status migration: **not required**, tidak ada SQL/schema/data yang berubah.
- Tidak ada seed, backfill, reset cache, environment baru, dependency baru, atau write production.
- Redeploy aplikasi dengan konfigurasi fitur existing, lalu refresh tab untuk memuat UI baru.
- Ledger: [UI/UX kompetisi](../operations/migrations.md). Snapshot hanya membawa `avatarUrl`
  peserta, tanpa menambah ID/email akun ke kontrak client.

## Checklist setelah redeploy

1. Buka link room lama yang sudah ditutup/expired: undangan dan reconnect tidak muncul.
2. Buat room baru dari akun berfoto, lalu join sebagai guest dari browser lain. Periksa foto
   akun, initial guest, copy kode/link, parent/child checkbox, simpan konfigurasi dan ready.
3. Mainkan satu match: timer menyusut, pilihan terkunci setelah submit, rank/crown dan rekor
   streak tampil setelah reveal; pembahasan dan soal berikutnya berpindah otomatis.
4. Pada mobile, gulir ke bawah saat reveal dan pastikan soal baru kembali terlihat. Periksa
   Dokkai yang panjang, keyboard/fokus, serta pengaturan reduced motion pada perangkat.
5. Join sebagai spectator saat match berjalan, lalu periksa podium akhir, review dan rematch.

## Known issue dan keputusan

| Item | Severity / owner | Keputusan |
|---|---|---|
| Acceptance UI baru pada production belum dijalankan | P2 verification gap / user dan Engineering Owner | Ulangi checklist setelah redeploy; bukti lokal tidak ditandai sebagai cloud PASS |
| Keyboard/assistive technology/reduced motion belum diuji end-to-end | P2 verification gap / Engineering Owner | Dukungan ada; perlu verifikasi perangkat nyata |
| Kuota free tier, recovery >5 menit, dan UAT 20 pemain | P2 existing verification gap / Engineering Owner | Tetap mengikuti UAT existing; redesign ini tidak meluluskan budget atau beban |

Keputusan engineering: **siap untuk redeploy dan acceptance UI sesuai cakupan lokal**. Aktivasi
production sebelumnya tetap mengikuti persetujuan user; pekerjaan UI ini tidak mengubah flag/deployment. Lihat
[UAT utama](mini-games-kotoba-clash-uat.md) untuk hasil production sebelumnya dan pengujian tersisa.
