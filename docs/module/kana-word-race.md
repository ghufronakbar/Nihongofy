# Modul Kana Word Race

Diperbarui: **19 Oktober 2026 (Asia/Jakarta)**.

## Status Aktual

Implementasi v1 tersedia di kode dan default **mati**. Migration, seed kamus, engine,
room/lobby, WebSocket, papan privat, hasil/rematch, export, anonimisasi dan cleanup tersedia.
UI memakai border/bayangan tebal, font Geist dan panel neo brutalism yang konsisten dengan
Kotoba Clash, dengan aksen utama hijau neo (`--neo-green`) pada header, tombol, pilihan mode,
sticker dan checkbox. Mode solo tersedia untuk akun, dengan pengaturan dan hasil pribadi.
Pengujian engineering PostgreSQL/WebSocket serta pemeriksaan browser lokal dicatat di
[verifikasi](../verification/kana-word-race-uat.md). Database/deployment production tidak
berubah dalam pekerjaan ini. UAT lintas perangkat pada hosting target, review konten manusia,
dan pengukuran budget tetap menjadi gate aktivasi.

Nama implementasi **Kana Word Race**, slug `kana-word-race`. Nama kerja dari diskusi dipakai
untuk v1; perubahan branding kelak tidak perlu mengubah identitas data.

Rujukan: [plan](../plan/mini-games-kana-word-race.md), [UAT](../verification/kana-word-race-uat.md),
[Mini Games](mini-games.md), [Kotoba Clash](kotoba-clash.md),
[database](../database.md), dan [migration](../operations/migrations.md).

## 1. Aturan Produk v1

Pemain dapat latihan sendiri atau berlomba dalam room menebak bacaan rahasia yang sama.
Setiap pemain mempunyai papan privat; dalam multiplayer, hanya progres dan hasil angka
yang terlihat bersama.

| Aturan | Nilai |
|---|---|
| Peserta | Solo: 1 akun terverifikasi. Multiplayer: 2-20; host akun terverifikasi, peserta akun atau guest |
| Panjang | Tetap 3/4/5/6/7 kana atau acak; default 5 |
| Ronde | 3/5/10; default 3 |
| Kesempatan | 6 tebakan valid per pemain per ronde |
| Normal | 3-4 kana: 90s; 5: 120s; 6-7: 150s |
| Santai | Normal ditambah 60s |
| Awal pertandingan | Countdown 5s |
| Reveal | 8s lalu ronde berikutnya; setelah reveal terakhir masuk hasil |
| Kategori | Opsional, default off; sama bagi seluruh pemain |
| Pengulangan | Target unik dalam satu match; rematch boleh mengulang |
| Acak panjang | Kantong 3-7 diacak, diulang seimbang lalu urutan ronde diacak |
| Skor benar | `1000 + floor(1000 * sisaWaktu / durasiRonde)` |
| Skor gagal | 0; tidak ada bonus jumlah tebakan |
| Tie | Total poin sama mendapat peringkat sama (1, 1, 3) |

Skor dihitung memakai waktu penerimaan database dan baru dipublikasikan setelah reveal.
Status pemain `PLAYING`, `SOLVED`, `EXHAUSTED`, atau `TIMED_OUT`. Pemain pertama yang benar
menutup input pribadinya, sementara lawan tetap berhak memakai sisa kesempatan/waktu.
Reveal terjadi saat seluruh roster terminal atau deadline. Pemain offline tetap menunggu
deadline; disconnect tidak memberi kesempatan baru.
Dalam solo, satu pemain adalah seluruh roster sehingga solved/exhausted langsung memicu
reveal tanpa menunggu pemain lain; timeout tetap mengikuti deadline server.

V1 tidak mencakup spectator, matchmaking, chat, ranked global, custom target, AI saat bermain,
atau perubahan kartu/jadwal FSRS. Kapasitas 20 adalah batas admission yang diuji lokal,
belum merupakan kapasitas deployment yang terukur.

## 2. Room dan Hak Akses

| Route | Akses |
|---|---|
| `/mini-games/kana-word-race` | Landing publik, kode undangan, create untuk akun |
| `/mini-games/kana-word-race/room/[code]` | Join nickname, lalu snapshot personal untuk member |
| `/mini-games/kana-word-race/room/[code]/results/[matchId]` | Member yang masuk roster match tersebut; match harus selesai |
| `/api/mini-games/kana-word-race/ws?room=<uuid>` | Same-Origin, membership, session/guest dan lease wajib |

Room/hasil `noindex`; sitemap hanya memuat landing ketika flag aktif. Guest boleh bergabung
melalui action, tanpa pengecualian auth umum untuk API lain. Pengecualian proxy hanya endpoint
WebSocket game yang tepat.

- Kode acak delapan karakter tanpa karakter ambigu, nickname 2-24 karakter ternormalisasi dan
  unik per room. Guest token acak 32 byte disimpan dalam cookie `__Host-kana_race_guest`,
  `httpOnly`, `secure`, `sameSite=lax`, 7 hari tetap. Redis/database hanya memakai hash SHA-256.
- Create idempotent memakai request UUID. Satu host membuat room baru akan menutup room
  **Kana Word Race** miliknya yang lama; room Kotoba Clash dan host lain tidak disentuh.
- Join baru hanya di lobby. Roster/config/release dibekukan saat Start. Peserta terlambat
  mendapat pesan untuk menunggu host kembali ke lobby; tidak otomatis masuk spectator.
- Ready terikat revision. Join/perubahan pengaturan membuat ready lama tidak berlaku.
  Start memeriksa host, revision, 2-20 peserta, kesiapan semua member aktif, dan stok target.
- Pilihan "Main sendiri" membuat sesi solo pada route room yang sama, tanpa kode/undangan
  di UI dan tanpa langkah ready. Server mewajibkan tepat satu member pemilik saat Start;
  akun lain maupun guest tidak boleh join. Pemilik dapat membuka ulang sesi miliknya.
- `config.mode` dibekukan saat create dan tidak dapat diganti lewat configure. Default
  untuk JSON lama tanpa mode adalah `multiplayer`. Retry create terikat mode/request UUID.
  Membuat solo atau room baru menutup sesi Kana Word Race milik akun yang sebelumnya.
- Rematch mengembalikan lobby dan reset ready, dengan kode tetap serta match UUID baru.
  Retry rematch ketika sudah lobby tidak mengubah revision lagi.
  Pada solo, "Latihan lagi" membuka pengaturan dan dapat langsung Start tanpa ready.
  Hasil menampilkan skor pribadi/jumlah kata tertebak serta review, tanpa podium lawan.
- Host menutup room melalui konfirmasi UI. Host disconnect tidak menghentikan match;
  sesi/guest yang kedaluwarsa tidak boleh mengirim command. Penghapusan akun host menutup room.
- Tidak ada transfer host/kick/leave khusus pada v1. Room tertutup dapat membuka hasil yang
  sudah selesai sampai retensi habis; hasil match aktif tidak dibuka lewat URL historis.

## 3. Kana, Editor, dan Evaluator

Satu kotak = satu code point kana setelah NFKC, katakana ke hiragana, dan NFC. Ini bukan
hitungan mora: `きゃ` dua kotak; `が` satu; `っ`, `ゃ`, `ゅ`, `ょ` dan `ー` masing-masing satu.
`アルバイト` menjadi `あるばいと` (5), `女の人` menjadi `おんなのひと` (6), dan
`小学校` menjadi `しょうがっこう` (7).

WanaKana **5.3.1** dipin untuk konversi. `convertLongVowelMark:false` mempertahankan `ー`
(`ギター` -> `ぎたー`, bukan `ぎたあ`). Server hanya menormalisasi kana; input Latin
harus sudah dikomposisikan client dan tidak bisa menembus validasi server.

Editor memakai satu input, dengan enam baris visual 3-7 kotak. Default keyboard kana virtual
(input sistem disembunyikan); tombol romaji membuka input teks dan menyembunyikan keyboard
kana. Input tersembunyi berjangkar pada composer di atas papan; pemindahan fokus memakai
`preventScroll`. Tombol Tebak/hapus, draft, dan pesan validasi berada bersama di composer,
yang menempel di bawah navigasi saat keyboard kana digulir pada layar sempit. Panel lebar
menempatkan papan dan keyboard berdampingan; ukuran tile dibatasi agar kata pendek tidak
membuat papan terlalu tinggi. Input menjadi read-only selama menunggu ACK, sehingga fokus
tetap tersedia untuk tebakan berikutnya setelah diterima.

`k` dan `n` pending tidak
mengisi kotak; `ka` -> `か`, `kyo` -> `きょ`, `nn`/`n'` -> `ん`, `gakkou` -> `がっこう`.
Konversi parsial disimpan sebagai kana plus pending agar Backspace menghapus satu pending
atau satu kana, bukan satu suku romaji asli. Tombol kecil/voicing mengubah kana terakhir;
`は` -> `ば` -> `ぱ` -> `は`. Virtual kana mengganti pending Latin yang belum lengkap.

Komposisi IME dipisahkan dari Enter submit; native `isComposing`/229 diperiksa. Paste/editor
yang melebihi kotak dibatasi pada tampilan; **tidak mengirim otomatis** dan server tetap
menolak panjang/alfabet yang salah. Tujuh kotak penuh tidak otomatis mengirim tebakan.
Draft disimpan lokal per ronde/accepted count, tidak ikut berubah karena progres lawan.

Evaluator dua tahap: tandai tepat posisi, hitung sisa kemunculan target, lalu tandai kana
pindah posisi sebanyak stok sisanya. Target `かたかな`, tebakan `かかかか` menghasilkan
tepat/absen/tepat/absen. `か/が` dan `つ/っ` berbeda. Keyboard mempertahankan informasi
terkuat (tepat > hadir > absen); tile dan legend mempunyai label aksesibel.

Kata asing bagi kamus, duplikat, ilegal, belum lengkap, atau terlambat tidak memakai slot.
Pesan menggunakan "Kata belum tersedia di kamus game", bukan menyimpulkan bahasa Jepang salah.

## 4. Kamus Game

Sumber tetap fixture flashcard `src/flashcard-data/vocab/n5.json` sampai `n1.json`.
Bacaan diambil dari **`content.word` melalui `readingFromMarkup` yang dipakai pipeline
flashcard**, bukan split `FlashcardVocab.key` dan bukan menyalin tabel kartu.
`key` menjadi provenance stabil; FK `vocabId` opsional menghubungkan vocab yang sudah diseed.

Pipeline read-only menyaring content kosong, `readingUncertain`, AI doubt, alfabet di luar
keyboard dan panjang selain 3-7; menormalisasi, deduplikasi bacaan, dan menggabungkan sumber
homofon. Arti pertama dan bentuk tulis tanpa markup menjadi materi reveal. Tidak menimpa
fixture asli, kartu, subscription, flag modul Flashcard, atau progres belajar.

`src/kana-race-data/curation.json` adalah whitelist target dan kategori terpisah. Filler seperti
`えーっと` tidak dijadikan target. Whitelist awal disusun untuk kata yang umum; review manusia
seluruh 94 target/kategori masih diperlukan sebelum aktivasi publik.

| Kana | Tebakan | Target |
|---|---:|---:|
| 3 | 1.630 | 20 |
| 4 | 2.294 | 20 |
| 5 | 1.041 | 20 |
| 6 | 464 | 20 |
| 7 | 194 | 14 |
| Total | 5.623 | 94 |

894 entri sumber dikeluarkan saat kompilasi. Pengamatan 5.714 kandidat mentah pada diskusi awal
mendahului filter kelayakan; bukan jumlah release final. Setiap panjang mempunyai minimal 10
target untuk seluruh pilihan jumlah ronde.

Release v1: `dfe413f2ad5aa0e3b06b7391237dc5e773bf433bc59e7806c4278536e067f61e`.
Checksum SHA-256 dihitung dari payload deterministik. `dictionary.v1.json` adalah artefak
review, tidak diimpor komponen produksi/client. Runtime memakai release database yang terbaru
berdasarkan tanggal penerbitan; match menyimpan release ID serta snapshot target/sumber.
Release existing tidak dapat dimutasi oleh UPDATE (trigger database); reseed idempotent,
dan perubahan konten membuat checksum/release baru. Release lama yang masih dirujuk bertahan.

```sh
npm run kana-race:dictionary:check
npm run kana-race:dictionary   # regenerasi setelah mengubah curation/sumber, lalu review diff
npm run seed:kana-race:check   # validasi tanpa query/write database
npm run seed:kana-race        # hanya setelah target database dan migration diverifikasi
```

Seed memakai advisory lock, memperbarui kelayakan/provenance tabel game dan menerbitkan
release immutable dalam satu transaksi. Vocab yang hilang tidak merusak provenance `sourceKey`.

## 5. Persistence, Transaksi, dan Privasi

| Model | Fungsi |
|---|---|
| `KanaWord` | Bacaan unik, panjang, eligibility guess/answer, kategori, retiredAt |
| `KanaWordSource` | PK wordId/sourceKey, optional FK FlashcardVocab SET NULL |
| `KanaRaceDictionary` | Checksum PK, payload release immutable, createdAt |
| `KanaRaceRoom` | Host, kode, config/revision, current match, expiry/idle/closed |
| `KanaRaceMember` | Identitas akun/guest, nickname, ready dan anonimisasi |
| `KanaRaceMatch` | Dictionary FK, state v1 privat, finishedAt dan expiry |

V1 menyimpan roster, ronde, target, accepted guesses, feedback dan waktu dalam **JSONB privat
per match**, bukan tabel round/player/guess terpisah. Match kecil dibatasi 10 ronde x 20 pemain
x 6 tebakan. Satu room row lock menserialisasi mutasi, termasuk seluruh penulisan state.
Keputusan ini memudahkan snapshot/recovery; biaya pembacaan/penulisan JSON dan lock contention
wajib diukur sebelum kapasitas operasional ditingkatkan.

Lock order: account bila ada -> room UUID terurut -> member/match. Waktu `clock_timestamp()`
diambil setelah room lock. Start/retry dan submit/retry atomik. Request tebakan yang sudah
accepted dengan payload sama tidak menambah slot walau ronde lewat; payload berbeda ditolak.
Constraint database menjaga bentuk dasar JSON, identitas, panjang, kode, ready dan satu match
belum selesai per room. FK composite memastikan current match berasal dari room yang sama.
Detail Zod/engine menjaga alfabet tepat, roster, slot dan aturan antar-ronde.
Migration `20261018051003_kana_word_race_solo` memperbarui CHECK match: mode solo tepat satu
roster; mode multiplayer/JSON lama tetap 2-20. Tidak ada tabel/kolom atau reseed baru.

Semua enam tabel RLS aktif, tanpa client policy/grant ke PUBLIC/anon/authenticated/service_role.
Akses hanya Prisma server. Release immutable boleh di-cache global berdasarkan checksum;
**snapshot personal tidak di-cache bersama**. Cache immutable tidak melakukan revalidation
background dan cache miss memakai transaksi yang sama untuk mendukung pool satu koneksi.

Projection eksplisit mengirim config publik, anggota, progres/status/jumlah tebakan, skor dari
ronde yang sudah reveal, dan papan **viewer sendiri**. Target/sumber/review hanya dikirim
sesuai fase. Akun host tidak menerima target lebih awal. Export menyaring berdasarkan akun,
hanya tebakan sendiri serta materi ronde yang sudah reveal.

Anonimisasi akun/guest menghapus tautan identitas, nickname dan kata/feedback tebakan, sambil
menyimpan jumlah, waktu dan boolean keberhasilan agar angka lawan tidak berubah. Match tidak
menyalin nama/email/user ID. Runtime tidak mencatat kata, token, atau error Prisma mentah.

## 6. Realtime, Recovery, dan Retensi

WebSocket memakai adapter `@vercel/functions`, Node, maxDuration 300s; koneksi dirotasi 270s.
Satu subscription Upstash per room/proses hanya membawa invalidasi `{roomId, version:1}`;
setiap socket membaca projection sendiri. State di-commit sebelum publish. Publish hilang
pulih lewat heartbeat/sync 20s dan boundary timer; setelah proses mati, clock database
menghitung fase dari jadwal yang tersimpan, termasuk beberapa deadline yang terlewat.

Lease Redis 60s diperbarui setiap 20s. Tab baru menggantikan owner lama; command lama ditolak.
Auth/revocation, runtime control dan ownership diperiksa setiap command/heartbeat. Origin
ketat, payload 2KB, maksimal 4 message/detik/koneksi, 120 command/menit/member, 60 handshake/
menit/IP HMAC, 30 entry/menit/IP HMAC. Rate limit termasuk command yang ditolak engine.

Client reconnect dengan backoff/jitter; watchdog 45s menutup koneksi yang tidak memberi data.
Pending request direplay dengan UUID lama setelah snapshot, accepted guesses dipulihkan dari
server. Draft yang belum accepted dapat hilang ketika refresh. UI tidak menerima poin lokal.
Outage Redis/auth fail-closed. HTTP upgrade yang gagal mengarahkan UI ke reconnect/muat ulang;
keberhasilan adapter Vercel tetap memerlukan UAT deployment.

Lobby idle ditutup setelah 30 menit. Room selesai ditutup 30 menit setelah akhir pertandingan,
dengan deadline deterministik walau baru dipulihkan kemudian. Ready/join/config/rematch di lobby
memperbarui aktivitas. Room/membership mempunyai retensi 7 hari dari create/start terakhir;
masing-masing match 7 hari sejak Start. Akses expired ditolak sebelum cron.
Cron `/api/cron/auth-cleanup` memproses batch 100, menghapus expired match/room, menganonimkan
guest expired, memulihkan akhir jadwal, dan membersihkan release tak dirujuk yang lebih tua 7
hari; release terbaru dipertahankan. Cleanup harian dapat menghapus fisik setelah deadline
akses berlalu. Field/hook account lifecycle harus tetap tersedia walau game flag mati.

## 7. Deploy dan Operasi

`FEATURES_MINI_GAMES=true` dan `FEATURES_KANA_WORD_RACE=true` diperlukan bersama. Keduanya
default false termasuk env kosong. Flashcard tidak harus aktif agar game dapat membaca release.
Namespace cookie/cache/lease/channel/runtime control terpisah dari Kotoba Clash.

Urutan Release Owner:

1. Review migration `20261018035428_kana_word_race`, backup dan target DIRECT_URL; jalankan
   `npx prisma migrate deploy`. **Migration wajib sebelum deploy walau flag off**, karena
   export akun, anonimisasi dan cron memakai tabel baru.
2. Validasi dan seed kamus game; verifikasi checksum/count, RLS/grant dan trigger immutable.
   Untuk upgrade instalasi existing ke solo, terapkan juga migration
   `20261018051003_kana_word_race_solo`; kamus existing dapat langsung dipakai tanpa reseed.
3. Deploy flag-off; verifikasi route guard, account export/deletion dan cron.
4. Jalankan UAT hosting target (dua perangkat, guest/akun, IME, reconnect >270s, rematch,
   lintas instance), review konten, dan ukur PostgreSQL/Redis/Vercel sebelum aktivasi publik.
5. Aktifkan kedua flag dan runtime control setelah gate diterima.

Drain: `npm run kana-race:runtime -- disable`, tunggu minimal 20s, lalu redeploy flag-off dan
refresh tab. `status`/`enable` memakai key game ini saja. Rollback aplikasi mempertahankan
migration additive dan data sesuai retensi; jangan drop tabel untuk rollback biasa.
Untuk upgrade solo, drain dan selesaikan match aktif sebelum redeploy, lalu refresh semua tab.
Kode lama memakai config strict tanpa mode dan tidak dapat membaca config yang ditulis kode baru.

## 8. Pemeliharaan

Perubahan aturan/input/curation harus memperbarui modul ini, plan dan bukti UAT bersama.
Bedakan kode tersedia, pengujian lokal, migration applied, deployment dan acceptance user.
Jangan meluluskan kapasitas/provider/IME mobile hanya berdasarkan unit test atau screenshot.
