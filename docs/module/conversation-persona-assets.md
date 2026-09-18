# Spesifikasi Aset Karakter Persona

Dokumen produksi. Isinya untuk dibawa ke tool gambar dan ke ilustrator, bukan spesifikasi kode.
Rancangan modulnya ada di [`conversation-speaking-design.md`](conversation-speaking-design.md);
arah VTuber ditetapkan di §12.1 dokumen tersebut.

Karakter pertama yang diproduksi: **Misaki Tsubame**. Karakter lain menyusul setelah karakter ini
terbukti menaikkan daya tarik pada penilaian user.

---

## 1. Prinsip Produksi

Tiga aturan yang menentukan berhasil atau tidaknya seluruh proses:

1. **Jangan menggambar tiap kombinasi.** Ekspresi hidup di mata dan alis, ucapan hidup di mulut.
   Keduanya sumbu terpisah yang ditumpuk saat runtime. 5 ekspresi × 6 bentuk mulut = 30 tampilan,
   dari 12 berkas — bukan 30 gambar.
2. **Registrasi dijaga lewat editing, bukan generate ulang.** Setiap varian dibuat dengan mengedit
   gambar base yang sama, lalu dipotong pada kotak yang persis sama. Menggenerate tiap ekspresi dari
   nol akan menggeser wajah beberapa piksel dan hasil tumpukannya terlihat meleset.
3. **Semua layer diekspor pada kanvas seukuran base.** Bukan di-crop rapat. Dengan begitu layer
   tinggal ditumpuk `position: absolute` tanpa menghitung offset sama sekali. Berkas yang sebagian
   besar transparan tetap kecil setelah kompresi WebP.

---

## 2. Identitas Karakter

| Field | Nilai |
|---|---|
| `personaKey` | `tsubame` |
| Nama tampil | Misaki Tsubame |
| Nama Jepang | 美咲 つばめ |
| Kanji lencana | 燕 |
| Gender | female |
| Personality | `tsundere` (kosakata baru; perlu ditambahkan ke `ConversationPersonality`) |
| Voice type | `cool` |
| Aksen warna aplikasi | `blue` |
| Level yang didukung | N4, N3 |
| Parameter suara | `rate: 0.95`, `pitch: 1.2` |

**Deskripsi (untuk user):** Ketus di permukaan, tapi sebenarnya telaten. Suka mengoreksi, dan diam-diam
senang kalau kamu berhasil.

**Tags:** `tsundere`, `sekolah`, `koreksi-detail`

**Gaya bicara (untuk system prompt Tahap E):** Nada ketus dan singkat di awal, memakai bentuk biasa
yang tegas, sering menyangkal perhatiannya sendiri, lalu tetap memberi koreksi yang benar dan
akurat. Tidak pernah merendahkan atau menyurutkan semangat user — ketusnya bercanda, bukan kasar.

**Sapaan pembuka:**

```
べつに、あなたのために{来|き}たんじゃないから。…まあ、{練習|れんしゅう}したいなら、いいけど。
```

- Terjemahan: "Bukan berarti aku datang demi kamu, ya. …Yah, kalau memang mau latihan, boleh saja."
- Romaji: "Betsu ni, anata no tame ni kita n ja nai kara. …Maa, renshuu shitai nara, ii kedo."

---

## 3. Panduan Visual

Diturunkan dari gambar referensi yang dikirim user. Referensi itu hasil generate AI tanpa acuan
karakter anime yang sudah ada, sehingga aman dipakai komersial — status ini dinyatakan oleh user dan
dicatat di sini sebagai dasar keputusan.

| Elemen | Deskripsi | Perkiraan warna |
|---|---|---|
| Rambut | Panjang lurus melewati pinggang, poni rata dengan helai membingkai wajah | Dasar `#232842`, bayangan `#171B33`, kilau `#3D4670` |
| Mata | Amber keemasan, besar, iris berlapis dengan highlight putih | Iris `#C9A227`, tepi `#8C6E1A` |
| Kulit | Cerah hangat | `#FBE3D4`, bayangan `#EFC7B4` |
| Beret | Hitam kebiruan, miring ke kanan, kancing bulat emas kecil | `#1C1C26`, kancing `#C9A227` |
| Atasan | Seragam sailor putih, kerah dengan dua garis navy | Putih `#FDFDFD`, garis `#2A3055` |
| Pita | Pita teal di dada | `#26A69A` |
| Rok | Lipit navy | `#2B3358` |
| Rona pipi | Selalu tampak tipis; menguat pada ekspresi tsun | `#F2A0A8` |

**Gaya gambar:** cel shading anime bersih, lineart tipis rata, bayangan dua tingkat tanpa gradasi
berat, tanpa outline tebal. Tidak memakai gaya neo-brutalist aplikasi — bingkai dan latar berwarna
disediakan oleh UI, karakternya sendiri tetap gaya anime.

---

## 4. Kanvas dan Struktur Layer

| Item | Nilai |
|---|---|
| Ukuran kanvas | **1024 × 1536** piksel (rasio 2:3), berlaku untuk **semua** berkas |
| Format | WebP dengan alpha (PNG boleh sebagai sumber kerja) |
| Latar | Transparan penuh. Jangan sertakan latar warna apa pun |
| Framing | Setengah badan sampai sekitar pinggang. Ubun-ubun beret ± 6% dari tepi atas |
| Posisi wajah | Tengah wajah pada sumbu X ± 50% lebar kanvas |
| Total ukuran | Seluruh berkas karakter ini di bawah 900 KB |

**Titik jangkar.** Koordinat sebenarnya diukur dari aset Misaki Tsubame yang sudah jadi:

| Kotak | Koordinat terukur (1024 × 1536) |
|---|---|
| Kotak mata + alis | x 311–710, y 161–360 |
| Kotak mulut | x 381–640, y 366–475 |

Kelima layer mata memakai kotak yang identik, begitu pula keenam layer mulut. Untuk karakter
berikutnya, ukur ulang dari base-nya sendiri — angka di atas khusus framing karakter ini.

---

## 5. Daftar Berkas

Disimpan di `public/conversation/personas/tsubame/`.

| Berkas | Isi | Wajib |
|---|---|---|
| `base.webp` | Karakter utuh dengan ekspresi netral dan mulut tertutup | ya |
| `eyes-neutral.webp` | Kotak mata: tatapan tenang, sedikit dingin | ya |
| `eyes-happy.webp` | Kotak mata: mata melengkung tertutup, senang | ya |
| `eyes-listening.webp` | Kotak mata: sedikit membesar, alis naik, menyimak | ya |
| `eyes-thinking.webp` | Kotak mata: melirik ke atas samping, satu alis naik | ya |
| `eyes-tsun.webp` | Kotak mata: menyipit, memalingkan pandangan, alis menukik | ya |
| `mouth-closed.webp` | Kotak mulut: tertutup, garis tipis sedikit melengkung | ya |
| `mouth-a.webp` | Kotak mulut: あ — terbuka lebar, oval tinggi | ya |
| `mouth-i.webp` | Kotak mulut: い — melebar mendatar, celah tipis | ya |
| `mouth-u.webp` | Kotak mulut: う — kecil mengerucut ke depan | ya |
| `mouth-e.webp` | Kotak mulut: え — terbuka sedang, agak melebar | ya |
| `mouth-o.webp` | Kotak mulut: お — oval bulat, lebih sempit dari あ | ya |
| `fx-blush.webp` | Rona pipi kuat, dipakai bertumpuk saat tsun dan senang | opsional |

12 berkas wajib. Kombinasinya: 5 ekspresi × 6 mulut = 30 tampilan.

---

## 6. Prompt

Ditulis dalam bahasa Inggris karena model gambar paling stabil dengan itu.

### 6.1 Base

```
Anime character illustration, original character, clean cel-shaded anime style,
thin even lineart, two-tone shading, no heavy outlines.

Subject: teenage Japanese schoolgirl, half body from the waist up, facing forward,
standing straight, arms relaxed at her sides, calm slightly cool expression,
mouth closed with a faint line, faint blush on cheeks.

Hair: very long straight dark navy hair (#232842) falling past the waist,
straight blunt bangs, thin strands framing the face, subtle blue highlights.

Eyes: large golden amber anime eyes (#C9A227), layered iris, white highlight
in the upper left of each iris.

Outfit: white sailor school uniform with a navy double-striped collar,
teal ribbon bow at the chest, black beret tilted slightly to her right
with a small gold round button.

Composition: centered, head near the top of the frame, full transparent background,
no background elements, no text, no watermark, no shadow on the ground.

Output: transparent PNG, 1024x1536.
```

### 6.2 Varian mulut

Untuk setiap vokal, **edit `base.webp`** dengan prompt berikut. Jangan generate dari nol.

```
Edit only the mouth of this character. Keep every other pixel exactly identical:
same hair, same eyes, same outfit, same pose, same lighting, same background.

Change the mouth to: <BENTUK>
```

Isi `<BENTUK>`:

| Berkas | `<BENTUK>` |
|---|---|
| `mouth-a` | wide open in the Japanese vowel "A" shape, tall oval, relaxed lips |
| `mouth-i` | the Japanese vowel "I" shape, stretched horizontally, thin opening, corners pulled back |
| `mouth-u` | the Japanese vowel "U" shape, small rounded pursed lips pushed forward |
| `mouth-e` | the Japanese vowel "E" shape, medium open, slightly widened |
| `mouth-o` | the Japanese vowel "O" shape, rounded oval, narrower than A |
| `mouth-closed` | closed, a soft faint line with a slight upward curve |

### 6.3 Varian ekspresi

Edit `base.webp` dengan pola yang sama, mengganti area mata dan alis.

| Berkas | Prompt bagian ekspresi |
|---|---|
| `eyes-neutral` | calm, slightly cool gaze looking straight ahead, relaxed brows |
| `eyes-happy` | closed happy eyes curved upward like gentle arcs, relaxed raised brows |
| `eyes-listening` | eyes slightly wider and attentive, both brows raised a little |
| `eyes-thinking` | eyes glancing up and to the side, one brow slightly raised |
| `eyes-tsun` | narrowed eyes looking away to the side, brows angled down in mild annoyance, stronger blush |

---

## 7. Ekspor dan Pemeriksaan

> **Temuan dari produksi karakter pertama.** Tool gambar menghasilkan latar putih, bukan transparan.
> Saat kotak mata dan mulut dipotong, area di luar siluet karakter ikut membawa putih opak, sehingga
> muncul pita putih vertikal di tepi kotak ketika layer ditumpuk. Di dalam siluet, piksel-nya justru
> identik dengan base — registrasinya sendiri sempurna.
>
> Karena itu ada satu langkah pasca-proses wajib: **alpha tiap layer dikalikan dengan alpha base**,
> sehingga apa pun di luar siluet menjadi transparan tanpa mengubah bagian dalam sama sekali.
> Skripnya ada di `docs/generated-assets/mask-layers.py` (butuh Pillow):
>
> ```
> python3 docs/generated-assets/mask-layers.py <slug-sumber> <personaKey>
> ```
>
> Skrip ini membaca dari `docs/generated-assets/<slug-sumber>/` dan menulis hasil bersihnya ke
> `public/conversation/personas/<personaKey>/`. Berkas mentah di `docs/generated-assets/` tetap
> disimpan sebagai sumber.

Untuk setiap hasil edit:

1. Buka hasil edit berdampingan dengan `base`, perbesar 400%, periksa **garis rambut dan tepi
   seragam** — harus identik. Kalau bergeser, ulangi editnya.
2. Potong hanya kotak yang bersangkutan (kotak mata atau kotak mulut) dari hasil edit.
3. Tempelkan potongan itu ke kanvas transparan 1024 × 1536 **pada koordinat aslinya**.
4. Ekspor WebP dengan alpha.

Checklist sebelum diserahkan:

- [ ] Sudah dijalankan melalui `mask-layers.py`; tidak ada piksel opak di luar siluet base

- [ ] Semua 12 berkas berukuran tepat 1024 × 1536
- [ ] Latar benar-benar transparan, bukan putih
- [ ] Tidak ada bayangan lantai atau elemen latar yang ikut terbawa
- [ ] Menumpuk `base` + `eyes-neutral` + `mouth-closed` menghasilkan wajah yang sama persis dengan `base`
- [ ] Menumpuk tiap ekspresi dengan tiap mulut tidak memperlihatkan garis potongan
- [ ] Total seluruh berkas di bawah 900 KB
- [ ] Tidak ada teks, tanda air, atau tanda tangan di gambar

---

## 8. Integrasi ke Kode

Sudah dikerjakan:

1. `tsundere` ditambahkan ke `ConversationPersonality` beserta label dan warna badge-nya.
2. Persona `tsubame` masuk ke `src/features/conversation/data/personas.ts`, lengkap dengan
   `appearance` sebagai fallback SVG bila asetnya kelak tidak tersedia.
3. Field `art` opsional pada persona. Bila terisi, `PersonaCharacter` menumpuk layer gambar; bila
   kosong, tetap memakai SVG. Enam persona lain tidak terpengaruh.
4. Mesin lip-sync berbasis mora di `lib/mora-lipsync.ts` (9 unit test) dan pemutarnya di
   `lib/use-lip-sync.ts`.

### Tiga masalah yang ditemukan saat integrasi

Dicatat karena akan berulang pada karakter berikutnya:

1. **Optimizer gambar Next.js membuang alpha.** `next/image` menegosiasikan format lewat header
   `Accept` dan dapat mengembalikan JPEG, sehingga layer transparan menjadi kotak putih. Aset ini
   sudah WebP berukuran dan terkompresi tepat, jadi disajikan dengan `unoptimized`.
2. **Layer ekspresi dan mulut sempat di-lazy load.** Keduanya bagian wajah yang sama dengan base,
   sehingga karakter dapat tampil sesaat tanpa mata dan mulut. Keduanya kini `loading="eager"`.
3. **Framing potongan kepala tidak bisa ditebak lewat transform CSS.** Diganti kotak potong persegi
   dalam piksel sumber yang diukur langsung dari aset (`art.crops`), lalu dikonversi ke persen.
   Untuk karakter ini: `head { x: 222, y: 20, size: 560 }` dan `bust { x: 0, y: 0, size: 1024 }`.
   **Setiap karakter baru wajib diukur sendiri.**

Contoh keluaran nyata untuk sapaan Tsubame — 33 mora, sekitar 4,6 detik pada `rate` 0,95:

```
べつに、あなたのために{来|き}たんじゃないから。…まあ、{練習|れんしゅう}したいなら、いいけど。
e u i  a a a o a e i  i  a closed  a a i a a a a e closed  u u i a i a a i i e o
```

`べつに` menjadi `e u i`, `{来|き}` mengambil bacaan `き` sehingga bervokal `i`, dan `ん` menjadi
mora tertutup.

### Pemilihan suara

Uji dengar pertama menghasilkan suara laki-laki untuk karakter perempuan. Penyebabnya kode mengambil
suara ja-JP **pertama yang ditemukan**; pada macOS yang diuji itu "Eddy", suara laki-laki, untuk
semua persona.

Sekarang tiap persona menyebut daftar nama suara menurut prioritas. Hasil pada perangkat uji
(sebelas suara Jepang tersedia): Misaki Tsubame, Sakura, dan Aoi memakai **Kyoko**; Yuki memakai
**O-Ren**; Kenji **Hattori**; Haruto **Rocko**. Bila tak satu pun nama itu ada, pemilihan jatuh ke
tabel nama yang gendernya dikenal, baru ke suara apa pun yang tersedia.

Batasnya tetap: ini suara TTS sistem, bukan pengisi suara karakter. Untuk suara bergaya anime,
lihat catatan TTS cloud di §8.2 dokumen rancangan.

### Kalibrasi laju bicara

Pengujian pertama menunjukkan pergantian mulut lebih cepat daripada suaranya: perkiraan awal 7,5
mora/detik terlalu tinggi untuk TTS browser, yang membaca lebih lambat daripada percakapan manusia.

Dua perubahan:

1. Nilai awal diturunkan ke **5,2 mora/detik**. Arah kesalahan sengaja dipilih melambat — mulut yang
   masih bergerak saat suara habis jauh lebih tidak mengganggu daripada mulut yang berhenti
   sementara suaranya masih berjalan.
2. **Kalibrasi otomatis.** Web Speech Synthesis tidak memberi tahu durasi sebelum diucapkan, tetapi
   memberi tahu kapan mulai dan selesai. Selisihnya dipakai menghitung laju sebenarnya perangkat itu,
   lalu dihaluskan ke estimasi berjalan yang dipakai ucapan berikutnya. Jadi angka 5,2 hanya titik
   awal; setelah beberapa ucapan, laju menyesuaikan sendiri dengan perangkat dan suara yang dipakai.

Ucapan yang terlalu pendek (di bawah 4 mora atau 400 ms) diabaikan sebagai sampel, dan hasilnya
ditahan pada rentang 3-10 mora/detik agar satu pengukuran aneh tidak merusak estimasi.

### Menghilangkan jeda tampil

Pengujian berikutnya menunjukkan gambar tertinggal sedikit dari suara — masalah berbeda dari laju,
dan penyebabnya dua:

1. **Jeda dekode.** Layer sebelumnya ditukar lewat `src`, sehingga tiap bentuk mulut yang baru
   pertama kali muncul harus diunduh dan didekode dulu. Sekarang **seluruh 12 layer dirender
   sekaligus** dan yang tidak aktif dibuat transparan, jadi pergantian hanya perubahan opacity.
   Terverifikasi di browser: 12 layer termuat penuh, hanya 3 yang terlihat.
2. **Jeda render.** Antara `onstart` berbunyi dan bentuk mulut tampil di layar ada satu putaran
   render React ditambah satu frame paint. Dikompensasi dengan `LEAD_MS = 55` yang memajukan
   urutan, dan bentuk mulut pertama dipasang langsung tanpa menunggu frame berikutnya.

Kompensasi jeda sengaja dipisahkan dari kalibrasi laju: kalibrasi hanya boleh mengurus kecepatan,
bukan menutupi jeda awal yang sifatnya tetap.

**Batasan yang harus disampaikan apa adanya:** dengan TTS browser, aplikasi tidak mengetahui vokal
yang sedang diucapkan. Lip-sync di atas adalah perkiraan dari teks, bukan dari audio — makin panjang
kalimatnya makin mungkin melenceng. Sinkronisasi presisi memerlukan audio nyata untuk dibaca
amplitudonya, dan itu konsekuensi dari pindah ke TTS cloud (§8.2 dokumen rancangan).

---

## 9. Status Produksi

| Karakter | Status |
|---|---|
| Misaki Tsubame (`tsubame`) | **Selesai dan terpasang.** 12 berkas, 1024 × 1536 WebP, total 256 KB di `public/conversation/personas/tsubame/`. Registrasi kotak mata dan mulut identik, kebocoran latar putih sudah dibersihkan, keenam bentuk vokal dan kelima ekspresi terbaca benar, dan integrasi kode (§8) sudah dikerjakan |
| Lima persona lain | Belum; masih memakai fallback SVG |

---

## 10. Belum Diproduksi Sekarang

- Lima karakter lain. Tunggu sampai Misaki Tsubame terbukti menaikkan daya tarik.
- Rig Live2D. Butuh PSD berlapis rapi, lisensi SDK, dan TTS cloud agar lip-sync-nya hidup.
- Pose tangan, variasi kostum, dan latar situasional.
- Ekspresi marah. Tidak punya tempat pada partner latihan bahasa — untuk koreksi, `eyes-tsun`
  sudah cukup dan lebih sesuai karakter.
