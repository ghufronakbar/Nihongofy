# Kotoba Clash - Fondasi Fase B

Tanggal: **17 Oktober 2026 (Asia/Jakarta)**. Owner: Engineering Owner.
Status: **fondasi domain dan persistence terverifikasi lokal; fase B belum seluruhnya selesai**.
Release decision: **belum aktif**, kedua feature flag default mati.

User meminta "lanjut saja dulu" setelah laporan budget parsial. Pengembangan dilanjutkan;
pengukuran budget menjadi blocker aktivasi publik, bukan blocker penulisan fondasi.
Rujukan: [plan](../plan/mini-games-kotoba-clash.md), [modul](../module/kotoba-clash.md),
[UAT](mini-games-kotoba-clash-uat.md), dan [fase A](kotoba-clash-phase-a.md).

Pembaruan setelah laporan ini: user menyatakan migration sudah diterapkan. Lobby, endpoint produk,
runner dan lifecycle kini tersedia; lihat [integrasi C-E](kotoba-clash-phase-c-e.md). Pernyataan
"belum" di bagian berikut adalah status saat pengujian fondasi B, dipertahankan sebagai histori.

## Yang Sudah Dibuat

- Engine murni untuk schedule, fase, deadline, scoring `v1`, rekonstruksi ledger, dan shared rank.
  Tidak mengimpor Next.js, Vercel, cookie, Redis, atau Prisma.
- Kontrak Zod untuk konfigurasi teks, nickname, invite code, private question snapshot,
  Start/answer, client envelope, dan invalidation event.
- Proyeksi satu ronde menutup konten sebelum waktunya, membuang seluruh furigana saat pengerjaan,
  dan hanya membuka kunci/pembahasan setelah deadline. Ini fungsi fondasi, belum endpoint snapshot.
- Enam model Prisma dan migration: room, membership, match, player, round, answer. FK komposit
  menjaga kesamaan room/pertandingan; partial unique index menjaga satu match RUNNING per room.
- Repository Start/answer/reconcile memakai transaksi pendek dan waktu PostgreSQL setelah lock.
  Urutan lock: akun (bila ada), room, match. Anonimisasi mengunci akun lebih dulu juga.
- Start menyimpan roster/assignment/schedule bersama dan reset ready. Answer pertama final;
  retry identik mengembalikan waktu penerimaan asli meskipun deadline sudah lewat.
- Finalisasi mengganti agregat dari ledger yang sudah reveal. Retry tidak menambah poin lagi.
- Credential guest acak 256 bit, hash SHA-256, registry Redis dan cookie HTTPS/httpOnly/Lax
  terpisah, expiry absolut tujuh hari. Tidak membuat User palsu atau menyimpan token plaintext.
- Service memverifikasi principal sebelum setiap command, termasuk registry session akun yang
  dibaca tanpa cache request. Publish hanya membawa room ID/revision setelah commit; kegagalan
  publish dilaporkan dan tidak mengubah ACK committed.
- Export akun menyertakan hasil/jawaban milik sendiri yang sudah selesai dan belum expired;
  tidak memilih snapshot soal, identitas lawan, atau kunci. Anonimisasi memutus host/user linkage
  dan mengganti nickname sambil mempertahankan ledger anonim untuk hasil lawan.
- Flag Mini Games dan Kotoba Clash default **false**, termasuk env kosong; flag efektif game
  mewajibkan flag hub. Tidak ada route/action/socket publik baru pada tahap ini.

## Validasi

| Pemeriksaan | Hasil |
|---|---|
| Prisma validate/generate | PASS |
| Replay seluruh migration ke PostgreSQL lokal | PASS; 42 migration pada database uji kosong |
| Start bersamaan dengan request sama | PASS; satu match, satu roster, satu duplicate result |
| Answer bersamaan/retry dengan pilihan berbeda | PASS; satu answer per pemain/ronde, pilihan pertama final |
| Jawaban pemain lain dan spectator | PASS; pemain lain tetap dapat menjawab; spectator ditolak |
| Guest expired | PASS; command ditolak walau token/hash benar |
| Menunggu lock sampai lewat deadline | PASS; clock DB dibaca setelah lock, answer terlambat ditolak |
| Finalisasi bersamaan/berulang | PASS; satu perubahan, agregat berikutnya sama |
| Constraint SQL | PASS; match aktif kedua, cross-match answer, dan identitas kosong ditolak |
| RLS/grant Data API | PASS; enam tabel RLS, SELECT ditolak untuk anon/authenticated/service_role |
| Anonimisasi akun nyata | PASS lokal; linkage/nickname dihapus, jawaban lawan dan ledger anonim tetap |
| Cleanup fixture | PASS; 0 room, match, dan user pada database uji setelah checker |
| Gate engineering | PASS; `npm run verify`, 633 tes / 46 file, lint/typecheck/build lulus |

Unit test menguji batas waktu tepat, rumus bonus/streak, tie, pertandingan dokkai >80 menit,
konten sebelum reveal, input spoofing, credential, fail-closed revocation, dan commit-then-publish.
Uji ini bukan UAT browser atau pembuktian permainan lengkap pada Vercel.
Output checker database: [bukti fondasi B](evidence/2026-10-17-kotoba-clash-foundation.json).

### Mengulang Pemeriksaan Database

Gunakan PostgreSQL lokal disposable dengan nama database berawalan `kotoba_`. Buat role
`anon`, `authenticated`, dan `service_role` pada cluster uji sebelum replay migration existing.
Pakai URL lokal secara eksplisit untuk kedua env Prisma; jangan memakai URL production:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55439/kotoba_dev \
DIRECT_URL=postgresql://postgres@127.0.0.1:55439/kotoba_dev \
npx prisma migrate deploy

npm run check:kotoba-clash:foundation -- postgresql://postgres@127.0.0.1:55439/kotoba_dev
npm run verify
```

Checker menolak URL non-loopback dan nama database lain. Ia membuat fixture sintetis sendiri,
mempercepat jadwal fixture untuk uji finalisasi, lalu menghapus hanya room/user yang dibuatnya
di blok `finally`. Ia tidak menjalankan migration/reset. Pengujian ini menggunakan PostgreSQL
17.11 lokal, bukan SQLite atau mock database. PostgreSQL dipasang untuk verifikasi; tidak
didaftarkan sebagai service saat login. Cluster sementara dihentikan setelah pengujian.

### Catatan Generator Migration

`prisma migrate dev --create-only` dengan sejarah lengkap mengalami P3006: migration existing
`20260825210118_phase_2_multi_user_auth` mengaktifkan RLS pada `_prisma_migrations`, sedangkan
tabel tersebut belum ada pada shadow replay. Migration lama tidak diubah.

Migration baru dihasilkan dengan `prisma migrate dev --create-only` pada project generator
lokal terisolasi: baseline schema HEAD, kemudian schema tambahan B. Hanya migration tambahan
yang disalin ke repo. SQL ditinjau: dua enum, enam tabel, FK/index, lalu CHECK/partial index dan
RLS/revoke ditambahkan manual. Seluruh sejarah asli + migration baru berhasil direplay ke DB uji.

`prisma migrate diff` terhadap DB hasil replay melaporkan perbedaan existing pada default
`Report.updatedAt` (SQL migration inbox memakai CURRENT_TIMESTAMP, schema memakai `@updatedAt`).
Tidak ada perbedaan model Kotoba Clash yang dilaporkan. Diff global belum bersih dan tidak
diklaim PASS. CHECK/partial index/RLS diuji terpisah karena tidak direpresentasikan oleh Prisma.

## Migration dan Urutan Deploy

Status **required, belum diterapkan pada Supabase**.
File: `prisma/migrations/20261016174702_kotoba_clash_foundation/migration.sql`.
Timestamp nama migration dari generator UTC; tanggal pekerjaan lokal 17 Oktober WIB.

1. Terapkan migration melalui workflow Prisma sebelum kode baru dideploy.
2. Verifikasi keenam tabel, RLS, revoke grant, CHECK, FK komposit dan partial unique index.
3. Deploy kode dengan kedua flag tetap false. Export akun dan anonimisasi membaca tabel baru
   walaupun game mati, sehingga migration tetap wajib sebelum kode ini dijalankan.
4. Tidak ada seed, backfill data existing, atau invalidasi cache yang diperlukan.

## Sisa Pekerjaan dan Release Blocker

- P1, Engineering Owner: endpoint snapshot/action/socket, lobby dan sampling bank soal belum
  dibuat. Assignment repository hanya boleh berasal dari sampling server yang akan dibuat;
  jangan menerima snapshot/kunci/sourceQuestionId dari client. Selector wajib memfilter level,
  audio dan stok eligible. Liveness roster saat Start masih harus dihubungkan ke lease/presence.
- P1, Engineering Owner: resume/takeover lease per membership, batas handshake/global,
  revalidasi periodik dan drain lintas deployment belum diimplementasikan atau dibuktikan.
  Helper auth per-command tidak membuktikan socket idle sudah tercabut.
- P1, Engineering Owner: cleanup/expiry lobby dan retensi detail belum dihubungkan ke cron;
  repository telah memeriksa expiry match/guest pada command yang tersedia.
- P1, Engineering Owner: budget free tier parsial sebagaimana fase A; belum ada kapasitas
  room harian/bulanan yang terukur atau aktivasi publik.
- P2, Engineering Owner: P3006 shadow replay dan drift `Report.updatedAt` adalah kendala
  tooling existing; bukan alasan mengubah sejarah migration yang sudah diterapkan.

UAT user berikutnya setelah UI tersedia: create/invite/join guest, ready/config, Start, reconnect,
deadline/reveal, spectator, hasil/rematch, flag off, export/anonimisasi, desktop dan mobile.
Saat ini seluruh UAT game publik tetap **NOT RUN**.
