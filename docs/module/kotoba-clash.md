# Modul Kotoba Clash

Tanggal rancangan: **16 Oktober 2026 (Asia/Jakarta)**.

## Status Aktual

**Fondasi fase B dibuat; game publik belum diimplementasikan.** Probe default mati telah
diuji pada Vercel Hobby dengan 20 peserta selama 16 menit, lintas instance, dan 60 reconnect.
Snapshot Usage Vercel 30 hari dari user sudah dicatat pada 17 Oktober 2026. Gate A belum ditutup:
memory-hours, command Redis bulanan, dan biaya probe yang terpisah dari baseline belum terukur.
Bukti dan runbook ada di
[laporan fase A](../verification/kotoba-clash-phase-a.md). Enam tabel game dan migration baru sudah
diverifikasi lokal, belum diterapkan pada Supabase. Engine, transaksi Start/answer/reconcile,
credential guest, flags, export dan anonimisasi tersedia sebagai fondasi internal.
[Laporan B](../verification/kotoba-clash-phase-b.md) mencatat bukti dan pekerjaan yang tersisa.

Dokumen ini adalah sumber aturan produk dan kontrak teknis. Checklist pengerjaan ada di
[plan](../plan/mini-games-kotoba-clash.md), hasil penerimaan dicatat pada
[UAT](../verification/mini-games-kotoba-clash-uat.md), dan penemuan game berada di
[Mini Games](mini-games.md). Rujukan existing: [project rules](../project-rules.md),
[database](../database.md), [practice](practice.md), [auth](auth.md), dan
[engineering baseline](../operations/engineering-baseline.md).

## 1. Tujuan dan Scope

**Kotoba Clash - Battle kuis JLPT bersama teman.** Host membagikan kode/link room, peserta
menjawab soal yang sama secara bersamaan, dan pemenang ditentukan dari poin jawaban benar,
kecepatan, serta streak jawaban benar.

### Keputusan dari diskusi user

| Topik | Keputusan |
|---|---|
| Wadah publik | Katalog Mini Games, agar game lain bisa ditambahkan |
| Pemain | 2-20 per room |
| Bergabung | Kode/link undangan; peserta guest diperbolehkan |
| Level | Satu level N5, N4, N3, N2, atau N1 per pertandingan |
| Pemilihan tipe | Checkbox bertingkat kategori dan subkategori |
| Jumlah soal | Tepat 5, 10, 15, atau 20 |
| Alur | Ready, host Start, soal serentak, deadline, reveal, otomatis lanjut, pemenang |
| Jawaban | Privat; peserta lain tetap bisa menjawab sampai deadline |
| Pendatang setelah Start | Spectator, menunggu pertandingan berikutnya |
| Infrastruktur | Vercel Hobby, Upstash Redis Free, PostgreSQL Supabase Free |
| Realtime | WebSocket sendiri; rancang agar mudah dibawa ke VPS |
| Audio | Choukai ditunda; v1 fokus moji-goi, bunpou, dan dokkai |

Baseline dari rencana yang dilanjutkan: host wajib login dan ikut bermain; guest mengisi
nickname; room dipakai ulang untuk rematch; jawaban pertama final; seluruh skor dibuka saat
reveal. Timer, scoring `v1`, dan retensi di bawah dibekukan pada 17 Oktober 2026 untuk fondasi B.
Kuota global tetap batas uji sementara, bukan hasil pengukuran kapasitas gratis.

### Kontrak fondasi B (17 Oktober 2026)

- Engine murni berada di `src/features/kotoba-clash/domain`; semua waktu berupa epoch milidetik.
  Interval soal awal inklusif/akhir eksklusif. Countdown 5 detik dan reveal 8 detik tetap.
- Guest memakai token acak 32 byte (base64url) di cookie `__Host-kotoba_guest`, HTTPS, httpOnly,
  SameSite=Lax, Path=/; masa berlaku absolut 7 hari. Database hanya menyimpan SHA-256 token.
  Cookie berlaku lintas room, tetapi membership dan expiry selalu diverifikasi per room.
- Nickname 2-24 karakter, normalisasi NFKC, trim dan rapatkan spasi; hanya huruf, angka, spasi,
  titik, underscore, dan hyphen. Unique room memakai versi lowercase hasil normalisasi.
- Roster menyimpan referensi membership, tanpa salinan nickname/avatar di hasil. Anonimisasi
  menghapus userId/hash dan mengganti nickname, mempertahankan ledger numerik lawan.
- Tidak ada host transfer. Room tanpa host sah tidak dapat configure/Start/rematch; pertandingan
  yang sudah mulai tetap mengikuti jadwal. Ready terikat `configRevision` dan reset saat berubah.
- Lock transaksi berurutan: akun (bila ada), room, match; answer/finalisasi mengunci match yang sama.
  Clock database dibaca setelah lock, sehingga penantian lock tidak mengakali deadline.
- Aturan scoring/ranking memakai versi `v1`. Hasil dihitung ulang dari ledger ronde yang telah
  direveal, termasuk reset streak untuk jawaban salah/kosong; finalisasi retry mengganti agregat.
- Detail room/match/jawaban bertahan sampai 7 hari setelah jadwal akhir, lobby idle 30 menit.
  Runtime memeriksa expiry walau cron belum berjalan. Guest yang kedaluwarsa tidak mendapat akses.
- Flags Mini Games/Kotoba Clash default mati selama pengembangan. Batas uji awal satu room aktif,
  20 pemain dan 5 spectator; ini tidak menetapkan jumlah sesi harian yang aman pada free tier.
- Transport aktif nantinya memeriksa otorisasi ulang paling lambat setiap 20 detik dan sebelum
  setiap command; host command selalu memeriksa session terkini. Satu lease per membership,
  takeover atomik mengganti connectionId; socket lama tidak boleh memperpanjang/menghapus lease.
  Drain lintas deployment harus dibuktikan sebelum endpoint publik dibuat aktif.

V1 berfokus pada room undangan. Matchmaking, ranked global, chat, hadiah, host transfer,
pertanyaan buatan user, dan integrasi hasil ke nilai mock JLPT tidak termasuk scope awal.
Karena bank soal existing juga dapat dipelajari di halaman lain, fitur ini adalah permainan
belajar sosial; v1 tidak mengklaim kompetisi dengan pencegahan menyontek yang ketat.

## 2. Route dan Organisasi Kode

Route publik, navigasi, dan feature flag mengikuti [kontrak Mini Games](mini-games.md).
Invite menuju `/mini-games/kotoba-clash/room/[code]`. Hasil memakai
`/mini-games/kotoba-clash/room/[code]/results/[matchId]`, sehingga rematch tidak menimpa URL hasil.

Struktur yang direncanakan:

```text
src/features/mini-games/              registry dan UI katalog
src/features/kotoba-clash/
  schemas.ts                          input dan envelope event Zod
  actions.ts                          create/join/configure/ready/start melalui Server Action
  domain/                             lifecycle, jadwal, scoring; tanpa import Next/Vercel
  server/                             repository Prisma, auth, cache, pub/sub, command service
  transport/                          adapter WebSocket Vercel dan bootstrap VPS
  components/                         landing, lobby, runner, spectator, hasil
  hooks/                              koneksi, snapshot, dan countdown client
src/app/(public)/mini-games/           halaman publik dan guard flag
src/app/api/mini-games/kotoba-clash/ws/ handshake WebSocket
```

Nama file rinci dapat mengikuti hasil spike fase A. Engine menerima principal terverifikasi,
clock, repository, dan publisher melalui interface; engine tidak membaca cookie atau env sendiri.
Auth akun tetap melalui helper `src/lib/auth.ts`. UI memakai React Context, renderer Jepang,
Tailwind, komponen shadcn/base-ui, dan bahasa visual existing.

## 3. Identitas, Akses, dan Kepemilikan

| Aktor | Boleh | Tidak boleh |
|---|---|---|
| Pengunjung | Membaca katalog/landing, memasukkan kode | Membaca snapshot room tanpa proses join |
| Host | Membuat room, mengubah konfigurasi lobby, Start, rematch, menutup lobby | Mengubah konfigurasi/jawaban/skor pertandingan aktif |
| Pemain | Ready, menjawab ronde aktif sekali, melihat hasil room | Menjawab atas nama orang lain atau membaca pilihan orang lain |
| Spectator | Mengikuti soal, reveal, dan leaderboard yang sama | Submit jawaban atau masuk roster pertandingan yang sudah dimulai |

- Kode room acak, tidak berurutan, memiliki unique constraint dan retry collision. Kode bukan
  credential pemain. Endpoint lookup/join dibatasi agar kode pendek tidak mudah dipindai.
- Akun dipetakan dari session server. Guest memakai credential acak berentropi tinggi di cookie
  `httpOnly`, `secure`, `sameSite=lax`; server menyimpan hash/registry yang diperlukan. Nickname,
  user ID, member ID, dan room code dari client tidak membuktikan identitas.
- Session guest terpisah dari session akun dan cookie guest practice/exam existing. Tidak membuat
  baris `User` palsu. Membership room selalu diverifikasi ulang; guest baru tidak bisa mengambil
  identitas pemain hanya dengan memakai nickname yang sama.
- Validasi nickname di server, batasi panjang, render sebagai teks, dan cegah nickname ambigu
  dalam room. Akun dapat memakai nama tampilan yang telah divalidasi.
- Handshake memverifikasi Origin, flag, identitas, membership, dan kapasitas sebelum subscribe.
  Jangan menaruh credential pada query URL atau payload broadcast.
- `src/proxy.ts` kini melindungi `/api/*`. Pengecualian hanya endpoint game yang memang memerlukan
  guest, bukan membuka seluruh prefix API. Pengecualian proxy tetap memerlukan auth game sendiri.
- Command host memeriksa session akun dan ownership terkini. Koneksi lama tidak boleh menjadi
  jalan melewati logout/revocation. Kontrak revalidasi session selama socket aktif dibekukan dan
  diuji pada fase B; mutasi host selalu melakukan pemeriksaan ulang.
- Satu identitas mempunyai satu slot pemain dalam room. Tab tambahan tidak menambah slot; jawaban
  identik menjadi retry dan jawaban berbeda tidak dapat menimpa pilihan pertama.

## 4. Lobby dan Konfigurasi

Host membuat room lalu dapat membagikan link sebelum konfigurasi selesai. Landing menyediakan
CTA Buat Room dan form kode. Guest yang memilih Buat Room mendapat CTA login dengan `next` aman.

### Seleksi soal

- Satu level per pertandingan. Level dan subkategori ditawarkan berdasarkan jumlah soal eligible
  di database, bukan asumsi semua fixture sudah diimpor.
- Kategori induk: `MOJI_GOI`, `BUNPOU`, `DOKKAI`. Anak memakai `MondaiType` existing dan label
  Indonesia/Jepang di `src/constants/jlpt.ts`.
- Memilih induk memilih seluruh anak yang tersedia pada level tersebut. Memilih sebagian anak
  membuat induk indeterminate. Anak kosong disabled dengan alasan, bukan ikut terpilih diam-diam.
- Minimal satu anak terpilih. Hanya tawarkan 5/10/15/20 yang muat dalam total soal eligible unik.
  Server menghitung ulang pada Start untuk menghindari stale catalog.
- Sampling tanpa duplikat, dengan sebaran antar subkategori terpilih yang diusahakan merata.
  Jika jumlah subkategori melebihi jumlah soal, UI tidak menjanjikan setiap subkategori muncul.
- Soal harus memiliki pilihan valid dan kunci yang cocok. Soal yang bergantung pada audio
  dikecualikan. Media visual yang diperlukan oleh soal teks tetap memakai renderer existing.
- `QuestionContext` dibawa utuh untuk soal yang memerlukannya; jangan mengacak stem tanpa bacaan.
  Total soal menghitung pertanyaan individual, bukan jumlah bacaan. V1 menampilkan konteks kembali
  bila soal berbeda memakai bacaan sama dan tidak mengasumsikan pemain sudah membacanya.
- Urutan soal dan pilihan sama bagi seluruh pemain. Assignment dan snapshot konten dibekukan
  sekali saat Start; perubahan konten admin tidak mengubah jawaban pertandingan yang berjalan.

### Ready dan Start

- Perubahan level, anak terpilih, atau jumlah soal menaikkan `configRevision` dan mereset ready.
  Ready berlaku hanya untuk revision yang disetujui pemain.
- Start memerlukan host sah, 2-20 pemain aktif termasuk host, seluruh roster siap pada revision
  terbaru, stok soal cukup, dan kuota room/koneksi tersedia.
- Roster dibekukan atomik bersama Start. Race join/ready/Start menghasilkan satu keputusan:
  membership yang tidak masuk roster menjadi spectator untuk pertandingan itu.
- Retry Start tidak membuat pertandingan kedua. Satu room hanya mempunyai satu pertandingan
  aktif. Konfigurasi tidak dapat diganti setelah countdown dimulai.

## 5. Lifecycle dan Waktu

```text
LOBBY -> COUNTDOWN -> QUESTION(1) -> REVEAL(1)
                   -> QUESTION(2) -> REVEAL(2) -> ... -> FINISHED
FINISHED -> LOBBY untuk pertandingan baru, dengan matchId baru
LOBBY -> CLOSED bila ditutup host atau idle expiry
```

`CLOSED` adalah keadaan room; fase COUNTDOWN/QUESTION/REVEAL/FINISHED milik pertandingan. Deadline
menggunakan UTC; timezone UI tidak mengubah interval. Semua jadwal ronde disimpan sejak Start:
waktu tampil soal, deadline jawaban, dan akhir reveal. Schedule mengikuti versi aturan pertandingan.

| Parameter | Default rancangan |
|---|---|
| Countdown | 5 detik |
| Moji-goi | 30 detik per soal |
| Bunpou: grammar / susun kalimat / wacana | 45 / 60 / 90 detik |
| Dokkai: pendek / sedang / panjang | 90 / 150 / 240 detik |
| Dokkai: terpadu / gagasan utama / cari informasi | 240 / 180 / 120 detik |
| Reveal | 8 detik per soal |

Durasi dipilih otomatis berdasarkan tipe, bukan diatur host pada v1. Pertandingan dokkai bisa
jauh lebih panjang daripada 20 menit; TTL, reconnect, dan retensi harus mengikuti `scheduledEndAt`.
Uji 15-20 menit pada fase A adalah uji koneksi, bukan batas durasi permainan.

### Kontrak waktu

- Server menerima jawaban hanya pada interval `questionStartsAt <= acceptedAt < questionEndsAt`.
  Tepat pada deadline sudah terlambat. Timestamp browser tidak dipercaya.
- `acceptedAt` ditetapkan oleh clock database pada operasi penerimaan atomik. Waktu tersebut
  dipakai untuk validasi deadline dan bonus cepat, sehingga instance berbeda tidak menilai dari
  clock browser atau timestamp yang dikirim pemain.
- Penerimaan dinilai dari `acceptedAt` tersebut; ACK baru dikirim setelah commit. Pengiriman client
  sebelum deadline tidak menjamin diterima jika operasi penerimaan baru berjalan setelah deadline.
- Semua peserta tetap mendapat kesempatan sampai deadline, walaupun pemain lain sudah menjawab
  atau seluruh pemain sudah selesai. V1 tidak memajukan reveal lebih awal.
- Countdown lokal memakai estimasi waktu server dari snapshot/round-trip. Tampilan bisa dikoreksi
  saat sync; keputusan menerima jawaban tetap milik server.
- Timer pada instance adalah pemicu best effort. Jadwal tersimpan menentukan fase yang benar.
  Jangan menjadikan `setTimeout`, koneksi host, atau memori satu instance sebagai sumber waktu.
- Setelah instance mati/reconnect, server menghitung fase saat ini dan mengejar finalisasi yang
  tertunda secara idempotent. Bila semua offline, tidak ada kewajiban mengeksekusi background job
  tepat saat deadline; akses berikutnya memulihkan fase/hasil dari jadwal dan jawaban tersimpan.
- QStash bukan dependensi v1. Kebutuhan pekerjaan tepat waktu tanpa koneksi aktif adalah keputusan
  terpisah jika kelak ditambahkan, bukan jaminan yang dibuat oleh timer WebSocket.

## 6. Jawaban, Poin, dan Ranking

Jawaban pertama yang diterima server final. Pilihan invalid, ronde asing, spectator, pemain bukan
roster, atau jawaban di luar interval ditolak tanpa membuka kunci. Retry pilihan sama mengembalikan
ACK yang konsisten; retry pilihan berbeda ditolak. Pilihan pemain lain tidak disiarkan.

Rumus default versi `v1`, dengan `D` durasi soal, `t` waktu sejak soal dimulai, dan `s` streak benar
termasuk soal saat ini:

```text
salah atau kosong: poin = 0; streak berikutnya = 0
benar:
  base   = 1000
  speed  = floor(400 * clamp((D - t) / D, 0, 1))
  streak = min(50 * max(s - 1, 0), 250)
  poin   = base + speed + streak
```

Streak pertama tidak mendapat bonus; benar kedua +50, ketiga +100, dan seterusnya sampai +250.
Streak berarti **jawaban benar berturut-turut**, bukan kemenangan antarpertandingan. Tidak menjawab
karena disconnect tetap dihitung kosong. Kecepatan dinormalisasi terhadap durasi soal dan bukan
bonus untuk orang yang kebetulan submit pertama di antara pemain lain.

Contoh: soal 30 detik, benar pada detik 6, streak ketiga -> 1000 + 320 + 100 = **1420**.
Latensi jaringan tetap berpengaruh; skor benar sengaja menjadi komponen terbesar.

Ranking: total poin menurun, lalu jumlah benar menurun, lalu total waktu jawaban benar menaik.
Jika ketiganya sama, posisi dibagi dan dapat ada pemenang bersama. Urutan tampilan stabil tidak
menjadi tie-break tersembunyi. Hasil menampilkan total poin, benar/salah/kosong, akurasi, dan streak
terbaik. Poin battle tidak diproyeksikan menjadi skor JLPT 180 atau mengubah analytics exam.

## 7. Reveal dan Pencegahan Kebocoran

| Fase | Payload yang boleh dilihat pemain/spectator |
|---|---|
| Lobby/countdown | Konfigurasi, peserta, ready, jadwal; belum ada soal mendatang |
| Question | Soal aktif, konteks, pilihan, deadline, jumlah terjawab, status submit diri sendiri |
| Reveal | Kunci dan pembahasan soal tersebut, jawaban sendiri, tambahan poin, leaderboard |
| Finished | Hasil dan review ronde yang sudah selesai pada pertandingan tersebut |

- Sebelum reveal, jangan mengirim `questionAnswer`, `isCorrect`, explanation, transkrip, alasan
  per pilihan, perubahan skor/streak ronde aktif, atau metadata yang menyiratkan kunci.
- ACK jawaban hanya menyatakan diterima/ditolak dan identitas ronde; benar/salah tetap menunggu
  reveal. Leaderboard yang terlihat saat soal berjalan hanya memuat ronde yang sudah direveal.
- Props RSC, cache, snapshot reconnect, retry ACK, event Pub/Sub, log, export akun, dan error ikut
  mematuhi batas reveal. Spectator tidak mendapat payload yang lebih lengkap daripada pemain.
- Furigana dibuang di server untuk instruksi, stem, bacaan, dan pilihan selama pengerjaan, termasuk
  cara baca kanji pada underline. Review boleh memakai markup lengkap sesuai aturan existing.
- Jangan mengirim daftar soal/ID soal mendatang ke browser. Gunakan ID ronde untuk submit, bukan
  endpoint grading bank soal yang menerima sembarang `questionId`.
- Pembahasan singkat tampil selama reveal; versi lengkap tersedia setelah selesai. Bila explanation
  belum tersedia, tampilkan kunci dan fallback jujur tanpa membuat pembahasan palsu.

## 8. Persistence dan Konsistensi

Entitas berikut sudah tersedia pada `prisma/schema.prisma` dan migration fondasi B. Migration
baru diuji pada PostgreSQL lokal; database Supabase belum diubah.

| Entitas | Tanggung jawab |
|---|---|
| `KotobaClashRoom` | Kode, host, konfigurasi/revision, status, dan expiry |
| `KotobaClashRoomMember` | Identitas akun/guest, nickname, membership, dan ready revision |
| `KotobaClashMatch` | Satu pertandingan, versi aturan, schedule, status, dan hasil final |
| `KotobaClashMatchPlayer` | Roster beku dan agregat nilai per pemain per pertandingan |
| `KotobaClashRound` | Urutan, snapshot soal/kunci privat, jadwal, dan status finalisasi |
| `KotobaClashAnswer` | Satu jawaban, waktu penerimaan, dan hasil grading per ronde/pemain |

### Invariant database

- Kode room unik; maksimal satu match aktif per room; nomor ronde unik dalam match.
- Satu membership per identitas dalam room; satu match-player per membership dalam match.
- Satu answer per `(round, matchPlayer)`. Constraint/relasi harus mencegah answer menggabungkan
  ronde dan pemain dari pertandingan berbeda, bukan hanya mengandalkan pemeriksaan UI.
- Start, penerimaan jawaban, dan finalisasi dijaga transaksi pendek dengan lock ordering yang
  konsisten. Pemeriksaan deadline dan insert jawaban atomik terhadap finalisasi ronde.
- Snapshot assignment dan roster tersimpan sebelum pertandingan dianggap mulai. Set soal tidak
  digenerate ulang pada setiap koneksi atau request.
- Skor diturunkan dari ledger jawaban dan assignment. Finalisasi retry tidak memakai penambahan
  agregat tanpa guard; hasil harus dapat direkonstruksi tanpa Redis.
- Index FK dan query room/match/expiry/ownership ditinjau, termasuk unique aktif yang tepat.
  Prisma memakai singleton dan pooled `DATABASE_URL`; tidak membuka koneksi DB per socket.
- Tabel aplikasi tetap RLS aktif tanpa grant/policy Data API untuk `anon`, `authenticated`, atau
  `service_role`. Guest mengakses server aplikasi, bukan tabel Supabase langsung.

### Batas PostgreSQL dan Redis

PostgreSQL adalah sumber kebenaran room, schedule, jawaban, dan hasil. Redis menyimpan cache
snapshot, koordinasi Pub/Sub, rate limit, serta lease koneksi/admission bila diperlukan. Key
bernamespace game melalui `redisKey()`, dengan prefix environment existing dan TTL yang jelas.
Jangan mencampur key auth dengan key permainan.

Mutation commit dahulu, lalu invalidate/publish event tersanitasi. Tidak menganggap transaksi
PostgreSQL dan Redis sebagai satu transaksi atomik. Publish gagal tidak boleh membatalkan jawaban
yang sudah committed atau membuat skor ganda. Snapshot authoritative memulihkan event yang hilang;
retry, boundary fase, dan reconnect menjalankan rekonsiliasi. Tidak ada network call Redis atau
broadcast yang ditunggu di dalam transaksi DB yang memegang lock.

Live state tidak masuk cache Next lintas user. Cache katalog soal boleh mengikuti cache key/tag
existing; snapshot room selalu memverifikasi membership dan reveal cutoff. Redis rusak tidak
mengubah hasil; command yang tidak dapat memverifikasi auth/admission ditolak sementara dengan
pesan retry. Karena auth existing juga membutuhkan Redis, tidak menjanjikan mode bypass saat Redis
down. TTL cache tidak boleh mengakhiri pertandingan sebelum `scheduledEndAt`.

## 9. Protokol WebSocket dan Recovery

Envelope tervalidasi Zod membawa `protocolVersion`, `requestId` bila command, `roomId`, `matchId`
bila relevan, dan revision dari server. ID tersebut hanya referensi, bukan bukti otorisasi.

| Arah | Pesan rencana | Tujuan |
|---|---|---|
| Client -> server | `subscribe`, `sync`, `submit_answer` | Join channel terotorisasi, ambil snapshot, kirim pilihan |
| Server -> client privat | `snapshot`, `answer_ack`, `command_error` | State tersaring sesuai waktu dan ACK milik pengirim |
| Server -> room | `lobby_changed`, `phase_changed`, `answer_count_changed`, `leaderboard_updated`, `match_finished`, `room_closed` | Perubahan publik yang aman |

Create/join/configure/ready/start/rematch menggunakan Server Action existing pattern yang memanggil
command service yang sama. Adapter WebSocket menangani subscribe/sync/answer; aturan domain tidak
diduplikasi dalam transport. Event klien tidak pernah langsung di-relay sebagai event server.

- Setiap instance subscribe Redis Pub/Sub untuk room yang dilayaninya. Broadcast memori hanya
  mencapai socket lokal dan tidak cukup untuk room yang tersebar di beberapa instance.
- Pub/Sub bukan penyimpanan pesan atau jaminan urutan. Event memiliki revision, duplikat/lebih
  lama diabaikan, gap memicu sync. Snapshot memuat jadwal fase dan status jawaban sendiri.
- Reconnect memakai backoff dengan jitter, mengulang autentikasi/subscribe, lalu mengambil snapshot.
  Terputus tidak mereset membership, skor, ready yang masih valid, atau jawaban tersimpan.
- Deployment baru dan lama dapat hidup bersamaan sampai socket lama ditutup. Versi protokol/aturan
  pertandingan tidak berubah diam-diam; deployment tidak kompatibel memerlukan drain terencana.
  Penonaktifan flag memerlukan invalidasi runtime/drain yang dibuktikan, bukan asumsi bahwa proses
  lama membaca env baru setelah redeploy.
- Jawaban yang belum mendapat ACK disimpan sebagai pending sementara pada tab. Setelah reconnect,
  client membaca status server; hanya retry request yang belum terkonfirmasi, dengan ID yang sama.
  Pending client bukan bukti jawaban sudah diterima sebelum deadline.
- Jangan menyiarkan setiap detik countdown, heartbeat, atau setiap keystroke. Status jumlah jawaban
  dapat dibatch. Heartbeat liveness tidak membuka write DB/Redis per pemain per detik.
- Batas payload, frekuensi command, koneksi per identitas, dan jumlah subscribe dibatasi. Koneksi
  idle ditutup; satu browser tidak membuat socket baru setiap render React.
- Host terputus saat bermain tidak menghentikan jadwal. Host tetap pemilik room; v1 tidak melakukan
  transfer host otomatis. Di lobby, room tanpa host dapat idle-expire.
- Pemain yang ada pada roster bisa kembali saat match berlangsung. Identitas baru menjadi spectator.
  Setelah selesai, host membuka lobby berikutnya dan seluruh peserta memilih ready lagi.

## 10. Free Tier dan Portabilitas VPS

Dokumentasi provider diperiksa pada **16 Oktober 2026**. Angka di bawah adalah snapshot dokumentasi,
bukan hasil uji project ini dan bukan jaminan tersedia untuk jumlah room tertentu selamanya.

| Layanan | Acuan gratis | Implikasi |
|---|---|---|
| Vercel Hobby | WebSocket public beta, Fluid Compute; koneksi maksimal 300 detik | Reconnect dan resync wajib, termasuk saat pertandingan belum selesai |
| Vercel Functions | 4 CPU-hour, 360 GB-hour provisioned memory, 1 juta invocation/bulan | Socket terbuka ikut memakai resource; kuota dibagi seluruh aplikasi |
| Upstash Redis Free | 500 ribu command/bulan | Battle berbagi kuota dengan session/auth; Pub/Sub dan recovery perlu diukur |
| Supabase PostgreSQL Free | Mengikuti storage, koneksi, dan egress project aktif | Batasi retensi dan gunakan pooling; tidak mengaktifkan Supabase Realtime |

Sumber resmi:

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Vercel usage/pricing](https://vercel.com/docs/functions/usage-and-pricing)
- [Upstash pricing](https://upstash.com/pricing/redis)
- [Upstash REST Pub/Sub](https://upstash.com/docs/redis/features/restapi#subscribe--publish-commands)
- [Supabase pricing](https://supabase.com/pricing)

Fase A menguji 20 koneksi selama 15-20 menit, pemulihan melewati cutoff 5 menit, dan event antar
instance. Catat Active CPU, memory-hours, transfer, invocation, command Redis, latency/ACK, dan
jumlah koneksi. Jangan menghitung 20 pemain sebagai pasti 20 instance atau pasti satu instance.

Batas room aktif global, total koneksi, spectator per room, create/join rate, dan idle timeout
menjadi konfigurasi server yang **ditetapkan dari hasil fase A**. Mulai pengujian dengan satu room;
uji tambahan diperlukan sebelum menaikkan kapasitas serentak. Limit harus atomik dan mengembalikan
pesan penuh/coba lagi, bukan membuka layanan berbayar otomatis atau membuat antrean tanpa batas.
Mode pengujian beban tidak menjadi endpoint publik tanpa guard.

### Migrasi ke VPS

Gunakan interface transport dan storage sehingga engine/scoring tidak mengimpor API upgrade
Vercel. Pada VPS, bootstrap Node.js dan reverse proxy melayani path WebSocket origin yang sama;
frontend memakai endpoint terkonfigurasi. Database tetap dapat memakai Supabase dan Redis tetap
dapat memakai Upstash. Redis lokal dapat ditambahkan lewat adapter jika memang diputuskan nanti.

Migrasi tetap membutuhkan konfigurasi proses, TLS/proxy, deployment, dan uji ulang. Sasaran
portabilitas adalah mempertahankan protokol, domain, dan data, bukan menjanjikan nol perubahan.
API upgrade Next.js pada Vercel dan kompatibilitas SDK dipastikan dalam spike, setelah membaca
dokumentasi Next yang terpasang; jangan menempelkan server Socket.IO pada instance Next tanpa
menguji dukungan adapter hostingnya.

## 11. Retensi, Akun, dan Operasional

Retensi fondasi B dibekukan sebagai berikut; integrasi cleanup cron belum dibuat:
lobby idle ditutup setelah 30 menit; pertandingan aktif tidak di-expire sebelum jadwal selesai;
hasil/jawaban detail dibersihkan setelah 7 hari. Masa akses guest juga dibatasi expiry credential.
Copy UI harus menyatakan batas penyimpanan yang benar; v1 tidak menjanjikan riwayat permanen.

- Redis memakai TTL untuk cache/lease. Penutupan room menolak join/game baru tetapi hasil yang
  masih dalam retensi dapat dibaca oleh membership sah sampai credential/retensi habis.
- Pembersihan PostgreSQL dapat memakai cleanup cron existing secara batch dan idempotent; cron
  tersebut bukan timer ronde. Data expired ditolak pada runtime walau cleanup belum berjalan.
- Relasi akun baru wajib masuk `anonymizeAccount` dan export akun. Anonimisasi menghapus linkage
  personal/nickname/avatar yang tersimpan tanpa merusak hasil peserta lain; keputusan FK dan
  snapshot identitas harus selaras. Export tidak membuka kunci sebelum reveal atau data lawan.
- Cookie guest, retensi jawaban, dan pemrosesan nickname diperbarui di dokumen hukum pada saat
  implementasi, sebelum fitur diaktifkan. Kode room, token, pilihan, dan kunci tidak masuk log.
- Gunakan logger existing untuk event operasional tanpa PII: handshake/subscribe gagal, publish
  gagal, recovery gagal, finalisasi gagal, limit tercapai, serta latency agregat.
- Rilis awal melalui feature flag. Jika dukungan beta atau budget tidak memenuhi gate fase A,
  catat blocker dan revisi adapter/rencana; jangan menandai fitur siap hanya karena build lulus.

## 12. Definition of Done

- Fase A membuktikan adapter pada Vercel Hobby project ini dan mempunyai catatan penggunaan nyata.
- Katalog Mini Games, landing game, invite, guest, konfigurasi, dan ready bekerja end-to-end.
- Pertandingan 5/10/15/20 soal selesai otomatis dengan skor yang dapat direkonstruksi.
- Reconnect, join saat bermain, multi-tab, retry, race Start, deadline, serta kehilangan event tidak
  merusak roster, jawaban, atau hasil.
- Tidak ada kunci/pembahasan/perubahan skor ronde aktif yang bocor sebelum reveal.
- Gate engineering, migration bila ada, desktop/mobile, dan UAT lulus dengan bukti yang dicatat.
- Batas kuota, retensi, flag, cleanup, dan langkah migrasi VPS didokumentasikan sesuai kode aktual.

Status migration fase A: **not required**. Fondasi B: **required, belum diterapkan pada Supabase**,
`20261016174702_kotoba_clash_foundation`. Terapkan sebelum kode pembaca tabel baru dirilis;
langkah dan hasil pemeriksaan ada di [laporan B](../verification/kotoba-clash-phase-b.md).
