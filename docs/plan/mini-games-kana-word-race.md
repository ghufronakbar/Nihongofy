# Rencana Implementasi Mini Games - Kana Word Race

Diperbarui: **18 Oktober 2026 (Asia/Jakarta)**.
Status: **v1 diimplementasikan; verifikasi lokal, belum deployment/aktivasi production**.

Sumber kebenaran: [modul](../module/kana-word-race.md),
[verifikasi/UAT](../verification/kana-word-race-uat.md),
[Mini Games](../module/mini-games.md), [migration](../operations/migrations.md).

## 1. Keputusan Implementasi

- Nama/slug: Kana Word Race / `kana-word-race`; room undangan 2-20 pemain.
- Enam tebakan, panjang 3-7 tetap/acak, 3/5/10 ronde, timer 90-150s atau santai +60s.
- Keyboard kana dan komposer romaji WanaKana 5.3.1, satu kotak per karakter normalisasi.
- Kamus turunan bacaan `content.word`, whitelist target terpisah, release immutable SHA-256.
- Persistence v1 memakai JSONB privat per match, diserialisasi lewat room row lock.
  Model terpisah round/player/guess tidak diperlukan pada v1; batas state dan risiko biaya
  harus tetap diukur pada deployment target.
- Target dan papan lawan tidak disiarkan. First solver menunggu lawan/deadline untuk reveal.
- Feature default-off; tidak menerapkan migration/seed atau mengaktifkan production otomatis.

## 2. Fase dan Hasil

| Fase | Hasil | Status |
|---|---|---|
| A | Aturan, alfabet, scoring dan identitas dibekukan | Selesai |
| B | Pipeline, curation 94 target, 5.623 tebakan, release dan seed | Implementasi/validasi lokal selesai; review manusia terbuka |
| C | Engine, enam model, migration, auth/lease/runtime dan lifecycle akun | Implementasi dan pengujian PostgreSQL lokal selesai |
| D | Katalog, landing, create/join/config/ready/lobby | Implementasi dan pemeriksaan visual lokal selesai |
| E | Editor virtual/romaji, 6 baris, feedback, aksesibilitas dasar | Unit/browser lokal selesai; IME/perangkat fisik terbuka |
| F | Realtime privat, hasil/rematch, replay/recovery/cleanup | Implementasi dan loopback selesai; UAT hosting terbuka |
| G | Verifikasi proyek, UAT final, budget, deploy dan aktivasi | Engineering lokal dicatat di UAT; gate production terbuka |

## 3. Pekerjaan yang Selesai

- [x] Audit aturan repository/panduan Next dan fondasi Kotoba Clash; namespace game terpisah.
- [x] Bekukan timer/countdown/reveal/scoring/tie/random/retensi dan batas v1 di modul.
- [x] Normalisasi, pending romaji, small kana, dakuten dan `ー`; audit alfabet seluruh kamus.
- [x] Pipeline read-only, deduplikasi/provenance homofon, whitelist kategori dan validation-only.
- [x] Seed idempotent dengan lock; release immutable dilindungi trigger dan FK.
- [x] Kontrak Zod dan engine murni; posisi duplikat, deadline, 6 slot, replay dan shared reveal.
- [x] Migration additive via Prisma create-only generator disposable; replay 45 migration lokal,
  RLS/grant, FK same-room dan constraint ditinjau/diperiksa.
- [x] Account/guest, Origin, admission, rate limit, lease takeover dan runtime-control per game.
- [x] Export personal, redaksi kata/identitas saat anonimisasi dan retensi cron.
- [x] Landing/registry/sitemap/robots, room/hasil private metadata dan flag default-off.
- [x] Lobby config/ready revision, Start atomik, roster beku dan pesan late join.
- [x] Papan privat 3-7 x 6, keyboard/romaji, feedback dan input error tanpa memakai slot.
- [x] WebSocket invalidation personal, heartbeat/boundary, reconnect replay dan watchdog.
- [x] Hasil tersimpan, review pribadi, rematch dan close dengan konfirmasi.
- [x] Unit test input/domain/kamus, socket loopback/admission dan checker PostgreSQL nyata.
- [x] Browser lokal landing 1280px dan papan 320px; pending, romaji, Backspace dan dakuten.
- [x] Dokumen modul/plan/UAT, hub/index/overview, database, ledger dan runbook diperbarui.

## 4. Gate Sebelum Aktivasi Production

- [ ] Review manusia untuk seluruh 94 target, kategori, arti/provenance dan kelayakan publik.
- [ ] Migration dan seed pada database target oleh Release Owner; cek checksum, RLS/grant,
  constraint/trigger, cron, export dan penghapusan akun pada deployment flag-off.
- [ ] UAT host/guest dengan dua perangkat dan browser; 3/5/10 ronde, semua panjang, konfigurasi,
  solved/exhausted/timeout, rematch dan hasil historis.
- [ ] IME native iOS/Android/Jepang, paste, zoom, screen reader, tema dan reduced motion.
- [ ] Adapter hosting nyata, reconnect melewati rotasi 270s, lintas instance, lost publish,
  proses mati, outage Redis/DB, revoke/logout, guest expiry dan drain deployment lama.
- [ ] Ukur trafik/biaya PostgreSQL JSONB+row lock, Redis lease/pubsub dan Vercel terhadap
  concurrency yang ditargetkan serta dampak pada Kotoba Clash/situs utama.
- [ ] Acceptance user dan aktivasi kedua flag/runtime control sesudah gate diterima.

## 5. Cara Verifikasi dan Rilis

```sh
npm run kana-race:dictionary:check
npm run seed:kana-race:check
npx prisma validate
npm run verify
# Checker hanya menerima DB loopback bernama kana_race_* yang sudah dimigrasikan/diseed:
npm run check:kana-race -- postgresql://<user>@127.0.0.1:<port>/kana_race_check
# Tambahkan port Redis loopback disposable sebagai argumen terakhir untuk uji Lua nyata.
```

Urutan target: migration -> seed release -> deploy flag-off -> UAT/budget -> aktivasi.
Account export/anonimisasi/cron memakai tabel baru walau game off, sehingga migration harus
mendahului deploy. Drain memakai `npm run kana-race:runtime -- disable` sebelum flag redeploy.
Jangan memakai `db push`, drop data saat rollback biasa, atau menandai UAT production PASS
berdasarkan tes lokal. Bukti dan known limits ada di dokumen verifikasi.
