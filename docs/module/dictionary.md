# Kamus seleksi JMdict

Diperbarui 18 Oktober 2026. Implementasi tahap 1–3 tersedia di kode; **default-off**.
Aktivasi publik menunggu [UAT dan budget hosting](../verification/dictionary-popup-uat.md).
Kontrak produk: [rencana](../plan/dictionary-popup.md). Sumber dan alternatif:
[riset](../research/dictionary-popup.md). Pemutakhiran: [runbook](../operations/dictionary.md).

## Perilaku

Blok kata/frasa Jepang pada area belajar yang diizinkan. Desktop membuka satu popup nonmodal
setelah seleksi stabil 200 ms; fokus tetap pada materi. Alt+K masuk ke kontrol kamus. Touch atau
viewport di bawah 768 px menampilkan tombol **Kamus**, lalu drawer setelah tombol ditekan.
Tidak ada pencarian saat hover atau single-click tanpa seleksi.

Popup memuat teks asli, ejaan, bacaan, bentuk dasar beserta alasan analisis, kelas kata, arti
Inggris, label penggunaan, penanda umum, salin, dan atribusi. Tiga kandidat dan tiga sense awal
dapat diperluas. Bahasa Inggris/Jepang ditandai dengan `lang`. Tidak menebak level JLPT,
terjemahan kalimat, pitch accent, atau arti Indonesia dari JMdict.

Escape, tutup, klik luar, scroll sumber, resize, toggle furigana, sumber yang dihapus, serta
pergantian konteks menutup popup. Scroll hasil kamus tetap berfungsi. Manual close mempertahankan
seleksi untuk Copy; membuat seleksi baru (termasuk double-click kata yang sama) dapat membuka
lagi. Pergantian soal/kartu/status reveal membersihkan seleksi konteks lama. Hasil request lama
diabaikan setelah seleksi/konteks berubah atau popup ditutup.

Preferensi **Kamus seleksi: aktif/nonaktif** disimpan di localStorage per browser, dengan fallback
memori bila storage ditolak. Cache hasil hanya di memori; tidak ada riwayat lookup per akun.
Seleksi dalam input, textarea, contenteditable, tombol, tautan, dan popup sendiri dikecualikan.
Seleksi lintas region/blok/paragraf/sel ditolak. `rt`/`rp` tidak masuk kueri, termasuk rentang
yang melintasi ruby dan node underline. Teks tampilan dipisahkan dari normalisasi NFKC kueri.

## Area integrasi

| Area | Gate dan batas |
| --- | --- |
| `/test-package/[id]/questions` | Konten mode baca pada mondai aktif, di dalam FuriganaScope. |
| `/result/[attemptId]/detail` | Konten review yang sudah diizinkan server existing. |
| `/exercises/[sessionId]` | `isAnswered` setelah konfirmasi server; pilihan yang terkunci menjadi teks statis yang bisa diseleksi. |
| `/flashcard/deck/[slug]/study`, `/flashcard/try/[slug]` | Seluruh kartu hanya setelah `revealed`. ID vocab, turn, dan furigana menjadi konteks. |
| `/discussion/question/[questionId]`, `/discussion/[commentId]` | Kartu soal dan thread yang sudah boleh dibaca. Redirect target kata/pola mengikuti halaman tujuan. |
| `/flashcard/discussion/[vocabId]` | Kartu terbuka, catatan, dan thread yang dirender. |
| `/bunpou/[key]`, `/bunpou/compare/[key]` | Materi/pola/tabel/contoh yang terbuka. Pola tanpa entri dapat menghasilkan hasil kosong. |
| `/flashcard/deck/[slug]` | Daftar kata; filter dan form di luar boundary. |
| `/article/[slug]` | Hanya body artikel, termasuk teks biasa; action/related di luar boundary. |
| Sheet diskusi pada area belajar | Region bertingkat memakai koordinator yang sama; composer dikecualikan. Portal di dialog sumber; Escape kamus mendahului sheet. |
| Kotoba Clash room | Hanya fase `REVEAL` dan terhubung. Jawaban sendiri sudah masuk belum cukup. |
| Kotoba Clash results | Setiap ronde yang tersedia pada review hasil; izin existing tetap berlaku. |

Exam berjalan, ringkasan skor, komunitas/post/profil, katalog, form, kana, Kana Word Race,
conversation/speaking, serta teks gambar/audio tanpa transkrip DOM tidak diberi boundary.
Komponen diskusi bersama tetap inert tanpa koordinator; target post secara eksplisit ditolak.
Kamus tidak mengubah query/payload kunci jawaban atau membuka transkrip/audio.

Reviewer menahan shortcut Space/Enter/1–4/F selama popup/aksi aktif, termasuk native activation
tombol rating yang masih fokus. Tombol di dalam kamus tetap dapat dioperasikan. Rating lewat
klik tetap bekerja dan membersihkan popup sebelum kartu berikutnya.

## Arsitektur dan batas kerja

Kode berada di `src/features/dictionary/`:

- `schemas.ts`, `types.ts`, `index-format.ts`: kontrak tervalidasi dan format indeks.
- `deinflect.ts`, `lookup.ts`: kandidat konjugasi terbatas dan proyeksi pasangan ejaan–bacaan–sense.
- `reader.ts`: server-only, lazy filesystem/gzip, hash tiap shard sebelum parsing, deduplikasi
  inflight, empat pembacaan disk bersamaan, LRU dengan estimasi memori 16 MiB. Data cache sudah
  tervalidasi sehingga tidak diparsing ulang pada hit. Batas LRU bukan batas RSS proses Node.
- `actions.ts`: Server Action publik, flag dan zod sebelum infrastruktur, limiter Redis HMAC-IP,
  cache Next versi/bahasa/kueri, timeout, batas concurrency, dan error generik.
- `selection.ts`, `client-cache.ts`, `components/`: ekstraksi DOM, cache hasil terbatas, preference,
  koordinator, Popover/Drawer Base UI existing, dan hasil kamus.

`DictionaryBoundary` adalah Server Component; hanya versi indeks yang diteruskan ke provider
client. `scope={false}` dipakai runner yang mengatur region reveal sendiri. Tidak ada listener
global tanpa provider dan tidak mengubah semua pemakaian `JapaneseText`.

| Batas | Nilai |
| --- | --- |
| Input client/server | 1–40 Unicode code point setelah trim; wajib karakter Jepang; kontrol ditolak |
| Kandidat / kedalaman | 96 / 5 |
| Pembacaan kandidat entri | Maksimal 160 ID |
| Respons | Maksimal 10 pasangan, 40 sense per pasangan, 96 KiB; pemotongan ditandai |
| Cache client | 40 hasil / estimasi 512 KiB, key versi + `eng` + kueri |
| Cache server Next | 24 jam, key/tag terpusat di `src/constants/cache-key.ts`; hasil kosong dicache |
| Kapasitas per proses | 8 lookup aktif; slot ditahan hingga pekerjaan asli selesai meski timeout |
| Timeout | 5 detik server; fallback UI 7 detik |
| Rate limit | 40 request per 60 detik per identitas HMAC-IP, mengikuti `REDIS_PREFIX` existing |

Padanan tepat mengungguli deinflection, lalu alternatif kana. Aturan konjugasi asli aplikasi
mendukung ichidan/godan/する/来る, sopan, negatif, lampau, te/progresif, i-adjective, serta bentuk
pasif/potensial/kausatif/kondisional/ajakan yang diuji. Kandidat wajib cocok dengan POS JMdict;
ini bukan parser kalimat. Ambiguitas pasif/potensial ditampilkan tanpa memaksakan satu analisis.

`appliesToKanji` dan `appliesToKana` dipertahankan untuk reading dan sense; daftar kosong bukan
wildcard. Penanda umum harus berlaku pada pasangan yang ditampilkan. Kata kana umum dapat
ditampilkan dalam kana ketika hanya ada ejaan kanji yang tidak umum. Satu entri dapat memberi
beberapa pasangan valid untuk bacaan ambigu.

Missing/corrupt shard dan timeout menghasilkan kegagalan, bukan hasil kosong yang dicache.
Redis gagal juga menghasilkan error generik. Busy memberi cooldown retry. Aplikasi melaporkan
error yang disanitasi dan metrik agregat per 100 lookup tanpa query, isi catatan, atau IP mentah.
Tracing Server Action bawaan Next pada **development** dapat mencetak argumen; gunakan teks
contoh publik saat QA dan jangan menganggap log dev sebagai log produksi yang anonim.

## Data dan lisensi

| Properti | Nilai |
| --- | --- |
| Sumber | JMdict English penuh / EDRDG melalui jmdict-simplified |
| Tanggal data / converter | 2026-10-12 / 3.6.2 |
| Versi indeks | `eng-3.6.2+20261012-f1-9a04fc1d0fac` |
| Entri / term normalisasi | 218.898 / 465.832 |
| Shard | 256 posting term + 256 entry gzip |
| Ukuran gzip / JSON | 17.209.096 / 100.384.580 byte, ditambah manifest 81.374 byte dan NOTICE |
| SHA-256 arsip | `9a04fc1d0facf87645f8ec7cdaa370647d4a8f59131f6e2a614bcd680f855b85` |
| Lisensi data turunan | CC BY-SA 4.0, terpisah dari kode aplikasi |

Artefak read-only di `assets/dictionary/` ikut version control dan output file tracing server.
Arsip sumber berada di `data/sources/dictionary/` yang diabaikan Git. Runtime tidak mengunduh
arsip, memakai API kamus eksternal, memuat seluruh dataset ke client/RSC, atau melakukan import.
NOTICE mencatat sumber, lisensi, versi, checksum, dan modifikasi. Sumber/lisensi selalu tampil
pada footer popup; versi/tanggal tersedia pada rincian hasil.

Pilihan awal penyimpanan adalah shard gzip dalam deployment Node. Ini sudah terukur secara
lokal; budget paket function, cold start, RSS dan biaya Redis pada hosting target tetap menjadi
gate aktivasi. Jika hosting tidak memenuhi budget, pindahkan **versi shard yang sama** ke object
storage existing melalui perubahan reader yang diverifikasi tersendiri; jangan fallback ke API arti.

## Feature flag dan operasi

`FEATURES_DICTIONARY=true` mengaktifkan provider pada area yang sudah diintegrasikan. Kosong,
tidak diisi, atau `false` berarti nonaktif. Baca hanya dari `FEATURES.dictionary`; tidak ada env
client. Modul induk tetap mengikuti flag/aksesnya sendiri. Perubahan env memerlukan restart atau
redeploy dan refresh tab; action selalu memeriksa flag server, termasuk dari tab lama.

Tidak ada migration, seed database, atau perubahan data aplikasi. Import adalah build artefak
kamus offline. Jangan mengganti manifest/shard dalam proses server yang masih berjalan.
Prosedur update bulanan, publish satu versi, rollback, dan pengukuran ada pada runbook.
