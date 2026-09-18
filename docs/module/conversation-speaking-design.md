# Rancangan Modul Conversation dan Speaking

Dokumen rancangan (bukan status implementasi). Status aktual ada di
[`conversation-speaking.md`](conversation-speaking.md); urutan pengerjaan ada di
[`../plan/index.md`](../plan/index.md) Fase 8.

Rujukan wajib: [`../project-rules.md`](../project-rules.md) (arsitektur),
[`../database.md`](../database.md) (schema dan aturan data),
[`../project-overview.md`](../project-overview.md) (route dan flow).

Sumber prototype: project referensi `tanoshii-japanese` pada
`src/app/conversation/setup/page.tsx`, `src/app/conversation/page.tsx`,
`src/app/speaking/setup/page.tsx`, `src/app/speaking/page.tsx`, dan `src/data/types.ts`.
Prototype tersebut adalah UI-only: state disimpan di `localStorage`, respons AI berasal dari
`getPlaceholderResponses()`, dan rekaman mikrofon disimulasikan dengan `setTimeout`.

---

## 1. Ringkasan Rancangan

| Aspek | Keputusan |
|---|---|
| Jumlah modul | **Satu** feature (`src/features/conversation`) dengan dua mode: `TEXT` (conversation) dan `VOICE` (speaking) |
| Arah produk Speaking | **Karakter bergaya VTuber.** Persona adalah daya tarik utamanya, bukan pelengkap — karakter ditampilkan besar saat memilih dan beranimasi mengikuti ucapan |
| Route group | `(public)` — shell publik. Halaman boleh dibuka tanpa akun dan menampilkan CTA masuk; pemakaiannya tetap hanya untuk user login |
| Sumber persona/topik | **Fixture terkurasi** dengan stable key, bukan tabel konten di database |
| Persistence | `ConversationSession` + `ConversationTurn` per user, mengikuti pola `PracticeSession`/`PracticeAnswer` |
| Provider AI | **Format wire OpenAI** (SDK `openai`), diarahkan ke gateway 9Router atau langsung ke provider lewat `baseURL`. Dibungkus abstraction di `lib/provider/` |
| STT/TTS MVP | Web Speech API browser (nol biaya, capability-aware) + typed transcript fallback |
| Kontrol biaya | Feature flag, quota harian per user (atomic upsert), effort rendah untuk turn balasan, prompt caching |
| Privasi | Opt-in `allowConversationStorage` / `allowAudioStorage` yang **sudah ada** di `User`, di-snapshot per session |
| Pendekatan pengerjaan | **UI dulu di atas provider mock** agar dapat dinilai sebagai end user, baru persistence dan provider nyata |
| Urutan rilis | Conversation TEXT dulu sampai lulus gate, baru Speaking VOICE |

---

## 2. Batasan Project yang Mengikat Rancangan Ini

Rancangan di bawah tidak bebas; ia harus tunduk pada aturan yang sudah berlaku di repo:

1. **Validasi**: setiap Server Action wajib divalidasi Zod sebelum menyentuh database, schema hidup di
   `src/features/conversation/schemas.ts` dan dipakai bersama form (rules §5).
2. **Env**: tidak boleh `process.env.X` langsung; semua lewat `src/constants/index.ts` yang divalidasi
   Zod dan fail fast (rules §7).
3. **Cache key**: semua tag/key di `src/constants/cache-key.ts` (rules §6).
4. **Isolation**: setiap query wajib berawal dari `session.userId`; `userId` dari client tidak pernah
   menjadi sumber otorisasi (rules §4, database.md).
5. **TypeScript**: `any` dilarang total. Payload provider AI dan hasil STT masuk sebagai `unknown` lalu
   dinarrow dengan Zod (rules §11).
6. **UI**: pakai komponen di `src/components/ui` (shadcn/base-ui) dan utility `neo-*` yang sudah ada di
   `src/app/globals.css`; jangan membuat sistem komponen baru (rules §3, §9).
7. **Dependency baru**: tabel stack di rules §1 tidak mencakup provider AI. Menambahkan
   `openai` (SDK yang dipakai untuk seluruh provider berformat OpenAI) **butuh persetujuan eksplisit user**.
8. **Migration**: `prisma migrate dev` bermasalah pada setup Supabase ini — perubahan schema ditulis
   sebagai SQL manual lalu dijalankan dengan `prisma migrate deploy`.

---

## 3. Pemetaan Prototype ke Project Asli

| Elemen prototype | Keputusan di project asli | Alasan |
|---|---|---|
| `localStorage.setItem('conversationSettings', …)` lalu `router.push('/conversation')` | Server Action `startConversationSessionAction` membuat row `ConversationSession`, redirect ke `/conversation/[sessionId]` | Sama persis dengan pola `createAttemptAction` → `/exam/[attemptId]/1` dan practice → `/exercises/[sessionId]`. Konfigurasi yang menentukan biaya AI tidak boleh dipegang client. |
| `MOCK_CHARACTERS` / `MOCK_SPEAKING_CHARACTERS` di `src/data/mocks.ts` | Fixture `src/features/conversation/data/personas.ts` dengan `personaKey` stabil | Preseden `KanaProgress`: konten adalah fixture terkurasi, database hanya menyimpan aktivitas user. Tidak perlu tabel konten + seed script untuk 6–10 persona. |
| Avatar `api.dicebear.com/...` (remote URL) | Aset self-hosted di `public/conversation/personas/` atau Cloudinary | `next.config.ts` saat ini tidak punya `images.remotePatterns`; remote host apa pun harus didaftarkan. Aset pihak ketiga di runtime menambah dependensi yang tidak perlu. |
| `difficulty: 'beginner' \| 'intermediate' \| 'advanced'` | Enum `JlptLevel` (`N1`–`N5`) yang sudah ada | Produk ini berbasis JLPT. Level menentukan batasan kosakata/tata bahasa di prompt dan konsisten dengan modul lain. |
| 4 state gambar karakter (`idle`/`talking`/`listening`/`happy`) + animasi | Dipertahankan sebagai state UI murni (`CharacterAnimationState`), tidak masuk database | Murni presentasi. Tetap harus punya `prefers-reduced-motion` dan alt text. |
| `getPlaceholderResponses()` + `setTimeout` | Provider abstraction nyata; **tidak boleh ada respons palsu** di halaman non-preview | Aturan yang sudah dipegang docs: jangan mengarang state/hasil user. Bila provider mati → error state jujur, bukan jawaban dummy. |
| Toggle `micEnabled` di setup | Diganti **capability probe + permission flow nyata** saat runner dibuka | Toggle boolean tidak mencerminkan izin browser. Mikrofon hanya diminta saat user menekan rekam. |
| Waveform statis (9 bar `h-*`) | Waveform nyata dari `AnalyserNode` Web Audio, atau indikator level sederhana | Preview home sudah menyatakan "tidak ada rekaman palsu"; runner harus menepati itu. |
| `showRomaji` toggle | Dipertahankan, disimpan sebagai preferensi UI per session (bukan konten baru) | Konsisten dengan toggle furigana di modul lain. |
| Neo-brutalist styling (`neo-card`, `neo-button`) | Dipetakan ke utility `neo-*` yang sudah ada di project asli | Project asli sudah memakai `neo-ink`, `neo-yellow`, `shadow-neo-sm`, `neo-surface`. Salin arah desainnya, bukan kelasnya mentah-mentah. |
| Tidak ada quota/consent/moderation | Wajib ada sebelum rilis | Modul ini satu-satunya yang memanggil provider berbayar dan (untuk speaking) memproses suara user. |

---

## 4. Keputusan Arsitektur

### 4.1 Satu feature, dua mode

Conversation dan Speaking adalah domain yang sama: dialog bergiliran dengan satu persona. Yang berbeda
hanya modalitas input/output. Membuat dua feature folder + dua set tabel akan menduplikasi lifecycle
session, prompt builder, quota, retention, dan audit.

Keputusan: satu folder `src/features/conversation`, satu pasang tabel, dibedakan kolom
`ConversationSession.mode` (`TEXT` | `VOICE`). Komponen runner tetap dua file berbeda.

Konsekuensi baik: Speaking bisa dirilis belakangan tanpa migration kedua — cukup mengaktifkan flag
`FEATURES_SPEAKING` dan menambah komponen.

### 4.2 Persona dan topik sebagai fixture

```
src/features/conversation/data/personas.ts   // personaKey, nama, gender, personality, voiceType, tags, deskripsi, greeting, gaya bicara, parameter suara, level yang didukung
src/features/conversation/data/topics.ts     // topicKey, label ID/JA, ikon
```

Kosakata `personality` (`friendly`/`strict`/`playful`/`professional`/`shy`), `voiceType`
(`cute`/`cool`/`calm`/`energetic`/`formal`), dan `tags` disamakan dengan prototype referensi supaya
persona terbaca sama oleh user, meski aset dan implementasinya berbeda.

Spesifikasi produksi aset karakter ada di dokumen terpisah:
[`conversation-persona-assets.md`](conversation-persona-assets.md). Karakter pertama yang diproduksi
adalah **Misaki Tsubame** (`tsubame`, tsundere).

Persona juga membawa `appearance` — gaya rambut, warna rambut/mata/kulit, warna pakaian, dan aksesori
— yang dirender sebagai **inline SVG parametrik** (`components/persona-character.tsx`). Tiga alasan:

1. Self-hosted penuh; tidak ada generator avatar pihak ketiga yang dipanggil saat runtime (X-5).
2. Menambah persona berarti menambah beberapa baris fixture, bukan menambah berkas gambar.
3. Garis tebal dan warna datar mengikuti bahasa visual neo-brutalist project, sehingga karakter
   terlihat menyatu alih-alih tempelan.

Ekspresi berubah menurut `CharacterState`, jadi komponen yang sama dipakai untuk kartu pilihan,
pratinjau besar di setup, dan karakter yang berbicara di runner. Bila kelak ada ilustrasi pesanan
yang lebih detail, ia menggantikan isi komponen ini tanpa mengubah kontrak persona maupun runner.

Persona juga membawa `voice: { rate, pitch, preferred }`. `preferred` adalah daftar nama suara ja-JP
menurut urutan prioritas.

Ini bukan detail sepele. Perangkat menyediakan beberapa suara Jepang dengan gender berbeda — macOS
yang diuji punya sebelas, antara lain Kyoko dan O-Ren (perempuan) serta Hattori, Eddy, dan Rocko
(laki-laki). Mengambil suara pertama yang ditemukan berarti seluruh persona memakai Eddy, sehingga
karakter perempuan terdengar laki-laki. Pemilihannya sekarang berjenjang: nama yang disebut persona,
lalu suara mana pun yang gendernya cocok dari tabel nama yang dikenal, baru menyerah ke apa pun yang
tersedia.

**Batas jujurnya:** ini tetap suara TTS sistem, bukan pengisi suara karakter. Rate dan pitch membuat
persona terdengar berbeda satu sama lain, tetapi tidak mengubahnya menjadi suara anime. Suara
berkarakter sungguhan memerlukan TTS cloud (§8.2).

Aturan: `ConversationSession.personaKey` dan `topicKeys` harus cocok dengan fixture yang dikenal
aplikasi (persis aturan `KanaProgress.kanaKey` di `database.md`). Fixture yang dihapus tidak boleh
membuat session lama gagal render — sediakan fallback "persona tidak lagi tersedia".

Persona prompt adalah **konten yang direview manusia**, bukan input user. Ia tidak boleh dibentuk dari
data yang dikirim client.

### 4.3 Route dan route group

Kedua modul memakai shell publik `(public)`, sejajar dengan `/kana`, `/flashcard`, `/exercises`,
`/test-package`, `/exam`, dan `/result` — di project ini `(public)` berarti layout header/footer, bukan
"boleh diakses tanpa akun".

Pemakaiannya tetap hanya untuk user login: modul ini memanggil provider berbayar, menyimpan data
pribadi, dan terikat quota per user.

Yang berbeda dari route terlindungi lain, `/conversation/*` **sengaja tidak dimasukkan ke `proxy.ts`**.
Guest yang membukanya tidak dilempar ke `/login`, melainkan melihat halaman berisi penjelasan fitur dan
CTA masuk/daftar (`ConversationSignInGate`). Redirect keras membuat CTA di landing page terasa seperti
jalan buntu; halaman gate menjelaskan dulu apa yang didapat, baru meminta akun.

Penjagaan aksesnya berlapis di tempat yang benar:

1. Setiap halaman memeriksa `getSession()` dan hanya merender runner/setup bila ada session.
2. `generateConversationReplyAction` memeriksa ulang session dan mengembalikan `unauthorized` bila
   tidak ada — server tidak pernah bersandar pada guard halaman.
3. `robots.ts` tetap men-`disallow` `/conversation` selama modul masih versi awal dengan provider mock.

| Route | Isi |
|---|---|
| `/conversation` | Index: kartu masuk ke setup, sisa quota hari ini, daftar session sebelumnya (kalau transcript disimpan), status ketersediaan fitur |
| `/conversation/setup` | Pilih persona (filter), level JLPT, topik (multi), toggle terjemahan/romaji, ringkasan consent + quota, tombol mulai |
| `/conversation/[sessionId]` | Runner chat: riwayat turn, komposer teks, TTS per bubble, toggle furigana/romaji/terjemahan. Tidak ada tombol akhiri — percakapan selesai dengan meninggalkan halaman atau memulai yang baru |
| `/speaking` | Index mode suara + hasil probe dukungan browser |
| `/speaking/setup` | Setup yang sama dengan conversation (`mode="VOICE"`), **tanpa pemilihan topik** — latihannya berfokus pada mengucapkan, bukan pada tema. Menyertakan pratinjau state karakter dan contoh suara per persona |
| `/speaking/[sessionId]` | Runner suara. Desktop dua kolom: kiri karakter + level meter + tombol rekam + transcript (sticky, tidak bergeser), kanan riwayat yang bergulir di dalam kotaknya sendiri. Mobile menumpuk ke bawah |

Perubahan infrastruktur yang menyertainya:

- `src/proxy.ts` — **tidak** menambahkan `/conversation` maupun `/speaking`. Aksesnya dijaga di
  halaman dan Server Action supaya guest mendapat CTA, bukan redirect (lihat di atas).
- `src/app/robots.ts` — tambahkan `/conversation` dan `/speaking` ke `disallow`.
  **Catatan koreksi:** `conversation-speaking.md` menyatakan robots sudah memblokir kedua path itu;
  pada kode saat ini keduanya tidak ada di daftar `disallow`. Ini harus benar-benar ditambahkan.
- `src/components/app-sidebar.tsx` dan `src/components/marketing/public-header.tsx` — tambahkan entri
  menu, hanya bila flag fitur aktif (pola yang sama seperti `/flashcard`, yang juga berada di `(public)`
  tetapi tetap muncul di sidebar).
- `src/app/(public)/page.tsx` — section percakapan menampilkan CTA ke `/conversation` bila flag aktif.
  Badge tetap jujur terhadap keadaan: `Preview` saat flag mati, `Versi awal` saat flag aktif, dan
  keterangan "balasan berasal dari skrip tetap" selama provider masih mock. Klaim "tersedia" penuh baru
  boleh dipasang setelah release gate (§12).

### 4.4 Abstraction provider

```
src/features/conversation/lib/provider/
  types.ts     // ChatProvider, SttProvider, TtsProvider — antarmuka murni
  chat.ts      // implementasi provider nyata
  mock.ts      // implementasi mock: delay, kegagalan, dan balasan skrip
  stt.ts       // implementasi browser-first; slot untuk vendor cloud
  tts.ts       // wrapper speakJapanese() + slot vendor cloud
  index.ts     // resolver berdasarkan env/flag
```

Seluruh implementasi nyata memakai satu SDK (`openai`) dan hanya berbeda pada `baseURL` serta string
model, sehingga berpindah antara OpenAI langsung, Gemini, dan gateway 9Router tidak menyentuh kode
domain (§7.5).

`mock.ts` adalah satu-satunya tempat data simulasi boleh hidup. Komponen, action, dan route handler
tidak boleh tahu implementasi mana yang aktif — inilah yang membuat UI hasil Tahap B/C (§11) tidak
perlu ditulis ulang saat provider nyata masuk.

Aturan: nama model, prompt, dan header API **tidak boleh muncul di komponen UI atau route handler**.
UI hanya melihat tipe domain (`ConversationTurnDraft`, `TutorReply`, `TurnFeedback`).

### 4.5 Consent dan retention

Kolom yang **sudah ada** dan harus dipakai (jangan menambah kolom consent baru):

- `User.allowConversationStorage` (default `false`) — boleh menyimpan transcript.
- `User.allowAudioStorage` (default `false`) — boleh menyimpan file audio.
- Keduanya sudah diedit di `/profile/privacy` lewat `src/features/profile/privacy-actions.ts` dan sudah
  ikut di `/api/account/export`.

Aturan rancangan:

1. Consent di-**snapshot** ke `ConversationSession.transcriptRetained` / `audioRetained` saat session
   dibuat. Mencabut consent kemudian tidak boleh mengubah arti data lama — ia memicu penghapusan.
2. `allowConversationStorage = false` → session tetap boleh berjalan, tetapi turn hanya hidup di memori
   proses/permintaan; yang disimpan hanya baris agregat (jumlah turn, token, waktu) untuk quota dan
   audit biaya. Ini yang menjadikan fitur tetap bisa dipakai tanpa memaksa opt-in.
3. `allowAudioStorage = false` → audio tidak pernah diunggah. Pada jalur STT browser, audio memang tidak
   pernah meninggalkan perangkat sama sekali.
4. `retentionExpiresAt` diisi dari `CONVERSATION_TRANSCRIPT_RETENTION_DAYS` /
   `CONVERSATION_AUDIO_RETENTION_DAYS`; cron menghapus yang lewat jatuh tempo.
5. Menonaktifkan consent di `/profile/privacy` harus menghapus data terkait dalam transaksi yang sama
   (transcript dan/atau audio), bukan sekadar mengubah flag.
6. Hard-delete akun sudah cascade lewat relasi `User`; audio Cloudinary ikut dijadwalkan hapus seperti
   pola `scheduleAvatarCleanup` di `src/lib/cloudinary.ts`.

### 4.6 Quota, rate limit, dan biaya

- **Quota harian** per user: jumlah turn, jumlah detik audio, dan token. Dihitung sejak 00.00 pada
  `User.timeZone` (aturan yang sama dengan batas harian flashcard).
- **Keputusan tahap sekarang: batas dimatikan selama development.** Provider masih mock sehingga
  biayanya nol, dan angka batas yang sebenarnya akan datang dari modul plan/pricing terpisah, bukan
  di-hardcode di sini. Tabel `ConversationQuota` tetap dibuat dan tetap mencatat pemakaian sejak
  Tahap D — yang dimatikan hanya penolakannya, bukan pencatatannya.
- **Wajib diaktifkan kembali sebelum Tahap E berjalan dengan API key nyata.** Tanpa batas, satu akun
  dapat menghabiskan biaya tanpa plafon. Ini syarat rilis yang tidak boleh dilewati hanya karena
  masih development.
- **Enforcement** memakai `INSERT ... ON CONFLICT DO UPDATE` atomik pada `ConversationQuota`, mengikuti
  pola `AuthRateLimit` — bukan select-lalu-update. Durabel dan tidak hilang saat Redis dievict.
- **Concurrency lock** memakai Redis (`redisKey("conversation", "inflight", userId)`, TTL pendek) agar
  satu user tidak menjalankan beberapa permintaan streaming sekaligus.
- **Kill switch**: `FEATURES_CONVERSATION=false` mematikan route, action, dan menu sidebar tanpa deploy
  ulang kode.
- **Ceiling biaya**: quota harian dikalikan estimasi token per turn harus menghasilkan angka rupiah yang
  user setujui sebelum rilis. Estimasi ditulis di dokumen ini §9.4 dan diverifikasi ulang dari
  `usage` pada respons nyata.

---

## 5. Rancangan Schema

Semua nama enum/model di bawah baru; tidak ada perubahan pada tabel existing selain menambah relasi di
`User`.

```prisma
enum ConversationMode {
  TEXT
  VOICE
}

enum ConversationSessionStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}

enum ConversationTurnRole {
  USER
  ASSISTANT
}

enum ConversationInputSource {
  TYPED
  SPEECH
}

// Satu sesi latihan percakapan milik user. Persona dan topik adalah stable key
// fixture, bukan konten yang disimpan di database.
model ConversationSession {
  id Int @id @default(autoincrement())

  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int

  mode       ConversationMode
  personaKey String    @db.VarChar(64)
  topicKeys  String[]
  jlptLevel  JlptLevel

  status     ConversationSessionStatus @default(ACTIVE)
  startedAt  DateTime                  @default(now())
  finishedAt DateTime?

  // Audit: hasil lama harus dapat dijelaskan walau prompt/model berubah.
  promptVersion String  @db.VarChar(32)
  chatModel     String  @db.VarChar(64)
  sttModel      String? @db.VarChar(64)
  ttsModel      String? @db.VarChar(64)

  // Snapshot consent saat session dibuat. Mencabut consent memicu penghapusan,
  // bukan reinterpretasi data lama.
  transcriptRetained Boolean   @default(false)
  audioRetained      Boolean   @default(false)
  retentionExpiresAt DateTime?

  turnCount        Int @default(0)
  totalInputTokens Int @default(0)
  totalOutputTokens Int @default(0)

  turns ConversationTurn[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, startedAt])
  @@index([status])
  @@index([retentionExpiresAt])
}

// Satu giliran bicara. Baris hanya dibuat bila session menyimpan transcript.
model ConversationTurn {
  id Int @id @default(autoincrement())

  session   ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId Int

  order Int
  role  ConversationTurnRole

  contentJa          String  @db.Text
  contentTranslation String? @db.Text
  contentRomaji      String? @db.Text

  inputSource     ConversationInputSource?
  audioUrl        String? @db.Text
  audioPublicId   String? @unique @db.VarChar(255)
  audioDurationMs Int?
  sttConfidence   Float?

  moderationFlagged Boolean @default(false)
  latencyMs         Int?
  inputTokens       Int?
  outputTokens      Int?

  feedback ConversationTurnFeedback?

  createdAt DateTime @default(now())

  @@unique([sessionId, order])
  @@index([sessionId])
}

// Koreksi terstruktur untuk satu giliran user. Bentuknya JSON blok tervalidasi
// Zod, mengikuti pola Article.body — bukan HTML dan bukan teks bebas.
model ConversationTurnFeedback {
  id Int @id @default(autoincrement())

  turn   ConversationTurn @relation(fields: [turnId], references: [id], onDelete: Cascade)
  turnId Int              @unique

  rubricVersion      String  @db.VarChar(32)
  corrections        Json    @db.JsonB
  summary            String  @db.Text
  pronunciationScore Float?

  createdAt DateTime @default(now())
}

// Counter harian per user. Diperbarui atomik seperti AuthRateLimit; menjadi
// sumber kebenaran quota dan audit biaya walau transcript tidak disimpan.
model ConversationQuota {
  id Int @id @default(autoincrement())

  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int

  quotaDate    DateTime @db.Date
  turnCount    Int      @default(0)
  audioSeconds Int      @default(0)
  inputTokens  Int      @default(0)
  outputTokens Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, quotaDate])
  @@index([quotaDate])
}
```

Tambahan relasi di `User`:

```prisma
  conversationSessions ConversationSession[]
  conversationQuotas   ConversationQuota[]
```

Catatan schema:

- `topicKeys String[]` adalah scalar list Postgres. Bila ingin menghindari scalar list (project belum
  memakainya di mana pun), alternatifnya kolom `Json` tervalidasi Zod. Jangan membuat tabel join untuk
  data fixture sekecil ini.
- `ConversationTurn` **tidak** ada bila `transcriptRetained = false`. Agregat tetap hidup di
  `ConversationSession` dan `ConversationQuota`, sehingga quota dan biaya tetap terhitung.
- `pronunciationScore` nullable dan hanya diisi bila fitur skor pengucapan benar-benar dirilis. Ia tidak
  boleh dipakai di analytics maupun proyeksi skor JLPT.

Aturan yang perlu ditambahkan ke `database.md` saat implementasi:

- `personaKey`/`topicKeys` harus cocok dengan fixture yang dikenal aplikasi.
- `promptVersion`, `chatModel`, dan `rubricVersion` wajib diisi; hasil lama tidak boleh dinilai ulang
  dengan versi baru secara diam-diam.
- Seluruh query conversation berawal dari `session.userId`.
- Konten turn dari model AI diperlakukan sebagai teks tidak tepercaya: disimpan apa adanya, dirender
  lewat renderer teks Jepang yang sudah ada, tidak pernah sebagai HTML mentah.

---

## 6. Server Action, Route Handler, dan Kontrak Data

```
src/features/conversation/
  schemas.ts        // Zod: StartSession, SendTurn, EndSession, DeleteSession
  actions.ts        // mutasi + get non-streaming
  queries.ts        // pembacaan session/turn, selalu scoped userId
  data/personas.ts
  data/topics.ts
  lib/prompt.ts
  lib/quota.ts
  lib/retention.ts
  lib/moderation.ts
  lib/provider/…
  components/…
```

| Nama | Jenis | Input (Zod) | Output | Cache |
|---|---|---|---|---|
| `getConversationCatalog` | Server Action `get` | — | persona + topik fixture, status flag | `unstable_cache` + `CACHE_TAGS.conversationCatalog` (global, tanpa data user) |
| `getConversationQuotaStatus` | Server Action `get` | — | sisa turn/detik hari ini | tidak di-cache |
| `getConversationSessions` | Server Action `get` | filter opsional | daftar session user | tidak di-cache (read-your-own-writes) |
| `getConversationSession` | Server Action `get` | `sessionId` | session + turn, `notFound()` bila bukan milik user | tidak di-cache |
| `startConversationSessionAction` | Server Action `mutate` | `mode`, `personaKey`, `jlptLevel`, `topicKeys[]`, preferensi tampilan | redirect ke runner | invalidasi daftar session |
| `sendConversationTurn` | **Route Handler** `POST /api/conversation/[sessionId]/turn` | body tervalidasi Zod | stream token + persist di akhir | — |
| `endConversationSessionAction` | Server Action `mutate` | `sessionId` | status `COMPLETED` | invalidasi daftar session |
| `deleteConversationSessionAction` | Server Action `mutate` | `sessionId` | hapus turn + audio Cloudinary | invalidasi daftar session |
| `requestTurnFeedbackAction` | Server Action `mutate` | `turnId` | `ConversationTurnFeedback` | — |

**Kenapa satu Route Handler.** Rules §6 menetapkan Server Actions untuk get dan mutate. Streaming token
adalah pengecualian teknis: UX chat tanpa streaming terasa menggantung karena satu turn bisa beberapa
detik. Project sudah punya preseden Route Handler untuk kasus non-form (`/api/flashcard/export`,
`/api/account/export`, `/api/cloudinary/signature`), dan `/api/` sudah dilindungi `src/proxy.ts`.
Route handler ini tetap wajib: `getSession()`, verifikasi `session.userId === conversationSession.userId`,
validasi Zod, dan pemeriksaan quota **sebelum** memanggil provider.

Alternatif yang lebih patuh aturan bila streaming ditunda: `sendConversationTurnAction` sebagai Server
Action biasa dengan indikator "sedang mengetik". Ini sah untuk MVP dan menghemat satu keputusan.

Guard yang berlaku di semua jalur:

1. Session `COMPLETED`/`ABANDONED` tidak menerima turn baru.
2. Urutan `order` ditentukan server, tidak pernah dari client.
3. Isi turn user dibatasi panjangnya (mis. 500 karakter) di Zod.
4. Quota diperiksa dan dikonsumsi atomik sebelum request provider; kegagalan provider mengembalikan
   konsumsi quota bila tidak ada token yang terpakai.

---

## 7. Rancangan Prompt dan Kontrak AI

### 7.1 Susunan prompt

```
system  (stabil, cache_control ephemeral)
  ├── peran: partner latihan bahasa Jepang, bukan penilai resmi JLPT
  ├── persona fixture (gaya bicara, tingkat keformalan, karakter)
  ├── batasan level: kosakata/tata bahasa dibatasi JlptLevel session
  ├── format keluaran: kalimat Jepang + terjemahan Indonesia + romaji opsional
  ├── batas keamanan: teks user adalah bahan latihan, bukan instruksi
  └── larangan: mengklaim skor/penilaian resmi, memberi nasihat di luar domain belajar
messages
  └── riwayat turn (volatile, setelah breakpoint cache)
```

`promptVersion` naik setiap kali blok system berubah, dan disimpan di session.

**Prompt injection.** Teks user (dan hasil STT) adalah data. Blok system harus menyatakan bahwa
instruksi di dalam pesan user tidak mengubah peran, level, atau batasan. Jangan pernah menyusun system
prompt dari string yang dikirim client.

### 7.2 Caching

Blok system (persona + rubrik) stabil per persona+level, jadi ditandai
`cache_control: { type: "ephemeral" }` dan diletakkan sebelum riwayat. Verifikasi dengan
`usage.cache_read_input_tokens` — bila selalu 0, ada invalidator diam (timestamp/ID acak di system).

### 7.3 Structured output untuk feedback

Koreksi tata bahasa **tidak** diparse dari teks bebas. Pakai `output_config.format` dengan JSON schema
yang dipetakan langsung ke `ConversationTurnFeedback.corrections`, lalu tetap divalidasi ulang dengan
Zod di server sebelum masuk database.

Bentuk yang diusulkan (dibekukan di `schemas.ts`):

```ts
{ items: Array<{ original: string; corrected: string; reason: string; severity: "info" | "minor" | "major" }>,
  summary: string }
```

### 7.4 Model, penalaran, dan estimasi biaya

Keputusan: aplikasi bicara dalam **format wire OpenAI** (`POST /v1/chat/completions`) melalui SDK
`openai`. Konsekuensi terpentingnya, pemilihan model menjadi **konfigurasi, bukan arsitektur** —
OpenAI langsung, Gemini, atau model lain lewat gateway hanya berbeda pada `baseURL` dan string model.

Harga di bawah adalah per 1 juta token dan diambil dari halaman resmi masing-masing provider pada
4 September 2026. **Verifikasi ulang sebelum Tahap E** — agregator pihak ketiga sudah terlihat tidak
konsisten dengan halaman resmi, dan promo Gemini di bawah punya tanggal kedaluwarsa.

| Model | Input | Output | Free tier | Catatan |
|---|---|---|---|---|
| `gpt-6-astra` | $10.00 | $50.00 | tidak | Berlebihan untuk obrolan bergiliran |
| `gpt-5.6-sol` | $4.00 | $20.00 | tidak | Cadangan untuk pass feedback bila kualitas koreksi kurang |
| `gpt-5.6-terra` | $2.00 | $12.00 | tidak | Naik ke sini bila Luna kurang pada evaluasi rubrik |
| **`gpt-5.6-luna`** | **$0.20** ($0.40 konteks panjang) | **$1.20** ($1.80) | lihat catatan free tier | **Default yang disarankan.** Konteks 1,05 juta token, output maks 128K; mendukung structured output JSON schema, tool calling, dan prompt caching. Diposisikan OpenAI untuk beban chat bervolume tinggi dan sensitif latency — persis kasus ini |
| `gpt-5.5` | $5.00 | $30.00 | tidak | Generasi sebelumnya, lebih mahal dari Terra |
| `gemini-3.8-flash` | $0.75 (naik $1.50 setelah 31 Des 2026) | $3.75 (naik $7.50) | ya | Opsi kedua; termurah di kelasnya saat ini |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | ya | Untuk beban ringan/eksperimen |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | tidak | Setara harga Terra |

Estimasi biaya per turn memakai profil §7.4 sebelumnya (system ~700 token, riwayat ~600 token,
keluaran ~200 token; system sebagian besar terbaca dari cache setelah turn pertama):

| Model | Per turn (kasar) | 40 turn/hari/user |
|---|---|---|
| `gpt-5.6-sol` | ~$0.0092 | ~$0.37 |
| `gpt-5.6-terra` | ~$0.0050 (~$0.0037 dengan cache) | ~$0.20 (~$0.15) |
| **`gpt-5.6-luna`** | **~$0.0005** (~$0.0004 dengan cache) | **~$0.020** (~$0.015) |
| `gemini-3.8-flash` | ~$0.0017 | ~$0.068 |
| `gemini-3.5-flash-lite` | ~$0.0009 | ~$0.036 |

Angka ini adalah alat bantu menetapkan plafon P-3, bukan janji. Wajib diverifikasi dari field `usage`
pada respons nyata dan dicatat ke log terstruktur (`src/lib/server-logger.ts`) tanpa isi pesan.

Setelan yang disarankan:

- Turn balasan: model default `gpt-5.6-luna`, `reasoning_effort` rendah — latency lebih menentukan
  pengalaman daripada kedalaman penalaran untuk satu giliran obrolan pendek, dan tugas ini bukan
  penalaran berat. Naik ke `gpt-5.6-terra` hanya bila evaluasi rubrik P-6 menunjukkan Luna gagal
  menjaga batasan level JLPT atau kualitas koreksinya kurang.
- Konteks 1,05 juta token membuat batas panjang percakapan tidak lagi menjadi persoalan teknis.
  `CONVERSATION_MAX_TURNS_PER_SESSION` tetap ada murni sebagai pengendali biaya.
- Pass feedback terstruktur: boleh naik satu tingkat model atau effort, karena dipanggil atas
  permintaan dan jauh lebih jarang (keputusan terbuka #5).
- `stream: true` untuk jalur balasan (Tahap E).
- **Prompt caching**: pada OpenAI, prefix yang cukup panjang di-cache otomatis dan ditagih sekitar 10%
  tarif normal. Susunan prompt §7.1 sudah benar untuk itu — blok system stabil di depan, riwayat yang
  berubah di belakang. Verifikasi dari field usage bahwa cached token benar-benar terbaca.
- `response_format: { type: "json_schema", strict: true }` untuk feedback terstruktur (§7.3). Gemini
  memakai `responseSchema`; lewat gateway OpenAI-compatible, dukungan strict-mode **harus diuji per
  provider** dan hasilnya tetap divalidasi ulang dengan Zod di server.

#### Catatan free tier OpenAI

OpenAI tidak lagi punya kredit pendaftaran maupun model gratis umum. Yang ada adalah **Data Sharing
Program**: opt-in per project di Data Controls, lalu project itu mendapat jatah token gratis harian
(publikasinya sekitar 1 juta token/hari untuk keluarga GPT-5 dan sampai 10 juta untuk model mini).

Syaratnya yang menentukan: **prompt dan output pada project yang di-share dipakai OpenAI untuk
training.** Opt-in dapat dicabut kapan saja dan OpenAI menyatakan akan memberi notifikasi 30 hari
sebelum program dihentikan.

Untuk project ini konsekuensinya jelas dan dapat dipisahkan rapi:

- **Tahap A-E dan evaluasi rubrik: pakai free tier.** Trafiknya adalah data uji Anda sendiri, dan di
  fase inilah token paling banyak terbakar karena iterasi prompt. Ini pemakaian yang tepat sasaran.
- **Produksi: project terpisah tanpa data sharing.** Teks latihan user dapat memuat perkenalan diri,
  pekerjaan, dan kebiasaan harian — data pribadi. Mengirimnya ke project yang training-enabled
  bertabrakan dengan D-1..D-9 dan dengan model consent aplikasi ini, yang menjadikan penyimpanan
  sebagai opt-in dan default mati.

Pemisahannya tidak butuh kode tambahan: dua project OpenAI, dua API key, dan `OPENAI_API_KEY` memang
sudah per-environment (§9).

### 7.5 Gateway 9Router

User berencana mengarahkan trafik ke [9Router](https://9router.com/), gateway AI self-hosted berlisensi
MIT yang mengekspos satu endpoint OpenAI-compatible ke 60+ provider.

Kapabilitas yang relevan:

| Aspek | Kondisi |
|---|---|
| Endpoint | Chat/LLM, STT, TTS, embedding, image, image-to-text, web search/fetch — semuanya format OpenAI |
| Penamaan model | Berprefiks provider, mis. `openai/gpt-5`, dan `google/...` untuk Gemini |
| Deployment | Self-hosted. **Sudah di-host sendiri oleh user**, sehingga dapat dijangkau dari Vercel. Default lokal `http://localhost:20128/v1`; URL diatur lewat `NINEROUTER_URL` |
| Auth | `Authorization: Bearer <key>`; dapat dimatikan dengan `requireApiKey=false` |
| Fitur | Fallback 3 tingkat (subscription → murah → gratis), rotasi multi-akun, quota tracking, request logging, kompresi token (RTK, Caveman Mode) |
| Biaya | Gateway gratis; yang dibayar hanya infrastruktur dan pemakaian provider |
| Kegagalan | `503` beserta `retry-after` saat seluruh akun tidak tersedia |

Keuntungan untuk project ini nyata: satu integrasi kode untuk semua provider, sehingga keputusan
terbuka #4 (OpenAI vs Gemini) turun menjadi perubahan konfigurasi.

Tetapi 9Router diposisikan untuk **coding tool**, bukan untuk berada di jalur permintaan aplikasi web
produksi. Lima hal berikut wajib ditangani sebelum ia dipakai di produksi:

1. **Uptime gateway.** Sudah selesai dari sisi jangkauan karena gateway di-host sendiri. Yang tersisa
   adalah konsekuensinya: gateway menjadi single point of failure yang Anda operasikan, jadi
   kegagalannya harus tampil sebagai error state jujur (CONV-11), bukan sebagai balasan kosong.
2. **Kompresi token wajib dimatikan.** RTK dan Caveman Mode mengubah isi prompt. Untuk tutor bahasa
   Jepang, mengubah prompt berisiko merusak batasan level dan markup furigana. Fitur itu dirancang
   untuk git diff, bukan untuk konten berbahasa yang presisi.
3. **Fallback lintas provider harus dikunci.** Bila gateway diam-diam berpindah ke provider gratis,
   `ConversationSession.chatModel` yang tercatat menjadi salah dan mutu jawaban ikut berubah. Untuk
   route ini: pin satu model, atau catat model yang benar-benar melayani permintaan dari respons.
4. **Privasi.** Tier gratis sejumlah provider melatih model dari data yang masuk. Teks latihan user
   tunduk pada D-1..D-9, jadi daftar provider yang boleh melayani route ini harus dibatasi eksplisit
   ke yang kebijakan datanya dapat diterima.
5. **Latency.** Gateway menambah satu hop. Target NF-1 (p50 di bawah 3 detik) diukur dari sisi user,
   termasuk hop tersebut.

Rekomendasi: pakai `OPENAI_BASE_URL` sebagai satu-satunya pembeda antara gateway dan provider
langsung. Karena gateway sudah berjalan, memakainya sejak Tahap E masuk akal — fallback, rotasi akun,
dan quota tracking-nya justru berguna saat menguji. Yang perlu dijaga hanyalah butir 2-5 di atas, dan
kemampuan untuk kembali ke provider langsung dalam satu env var bila gateway bermasalah.

---

## 8. Rancangan Speaking (mode VOICE)

### 8.1 Pipeline

```
probe dukungan browser
  └── didukung → izin mikrofon (diminta saat user menekan rekam, bukan saat halaman dibuka)
        └── rekam (MediaRecorder) + level meter (AnalyserNode)
              └── STT → transcript
                    └── transcript DAPAT DIEDIT user sebelum dikirim
                          └── jalur turn yang sama seperti mode TEXT
                                └── balasan → TTS
  └── tidak didukung / izin ditolak / STT gagal
        └── typed transcript fallback (jalur TEXT penuh, bukan versi lumpuh)
```

### 8.2 Pilihan STT dan TTS

Baik OpenAI maupun Gemini menyediakan STT dan TTS, jadi berpindah dari Anthropic menghapus kebutuhan
vendor kedua. Harga per 4 September 2026 dari halaman resmi masing-masing:

| Kebutuhan | Opsi | Harga | Catatan |
|---|---|---|---|
| STT | Web Speech API browser | gratis | Audio tidak meninggalkan perangkat; dukungan praktis terbatas ke Chromium |
| STT | `gemini-3.5-transcribe` | $0.003/menit | Termurah; ada varian `-live` untuk streaming ($0.005/menit) dan free tier |
| STT | `gpt-transcribe` | $0.0045/menit | Satu vendor dengan chat bila memakai OpenAI |
| STT | `whisper` | $0.006/menit | Generasi lama |
| TTS | `speakJapanese()` browser | gratis | Sudah ada di `src/features/study/lib/tts.ts`; kualitas ja-JP bervariasi per perangkat |
| TTS | `gemini-2.5-flash-preview-tts` | $0.50/1M teks in, $10/1M audio out | Ada free tier |
| TTS | `gpt-4o-mini-tts` | ~$0.015/menit audio | Perkiraan; verifikasi ulang |
| Suara dua arah | `gpt-realtime-2.1` | ~$0.05/menit (mini ~$0.016) | Di luar scope (§13), dicatat untuk arah pengembangan |

Rekomendasi tidak berubah: **Tahap C tetap memakai Web Speech API**. Alasannya bukan biaya semata —
dari situ Anda mengetahui apakah akurasi dan cakupan browsernya sudah memadai sebelum membayar apa pun.
Naikkan ke STT/TTS berbayar di Tahap G hanya bila hasil Tahap C menunjukkan itu perlu.

Bila naik ke berbayar, Gemini lebih murah pada STT dan punya free tier untuk pengujian, sementara
OpenAI memberi satu vendor dan satu key untuk chat, STT, dan TTS sekaligus. Lewat 9Router keduanya
sama-sama terjangkau tanpa integrasi kedua.

**Kualitas bahasa Jepang tidak diputuskan dari tabel harga.** Keduanya mengklaim dukungan multibahasa
kuat; yang menentukan adalah evaluasi rubrik P-6 pada Tahap H dengan sampel suara dan kalimat Anda
sendiri.

### 8.3 Bila audio disimpan

Hanya bila `allowAudioStorage = true` **dan** jalur vendor cloud dipilih:

- Upload melalui Cloudinary bertanda tangan, `resource_type: "video"` (Cloudinary memperlakukan audio di
  jalur video), folder `jlpt-exam/conversation-audio/{userId}/`, mengikuti pola verifikasi
  `verifyManagedAvatar` di `src/lib/cloudinary.ts`.
- Batas durasi dan ukuran divalidasi server, bukan hanya client.
- Penghapusan mengikuti pola `scheduleAvatarCleanup`/`destroyManagedAvatar`.

### 8.4 Skor pengucapan

Di luar scope rilis pertama. Bila kelak ditambahkan: tampilkan ketidakpastian, sebut rubrik dan versinya,
dan jangan pernah menyebutnya penilaian resmi. Jangan memasukkannya ke `/analytics` atau `/progress`.

---

## 9. Env, Constants, dan Cache Key

Tambahan di `src/constants/index.ts` (divalidasi Zod, fail fast, pola "wajib berpasangan" seperti
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`):

| Variabel | Wajib | Keterangan |
|---|---|---|
| `FEATURES_CONVERSATION` | tidak (default `true`) | `"true"`/`"false"`. Kill switch modul teks |
| `FEATURES_SPEAKING` | tidak (default `true`) | Kill switch modul suara; otomatis mati bila `FEATURES_CONVERSATION=false` |
| `CONVERSATION_PROVIDER` | ya | `mock` \| `openai`. `mock` hanya boleh di environment non-produksi (O-6) |
| `OPENAI_API_KEY` | wajib bila `CONVERSATION_PROVIDER=openai` | Server-only, tanpa prefix `NEXT_PUBLIC_`. Nilainya adalah key provider atau key 9Router, tergantung `OPENAI_BASE_URL` |
| `OPENAI_BASE_URL` | opsional | Kosong berarti API OpenAI resmi. Diisi URL 9Router (`https://<host>/v1`) untuk melewatkan trafik ke gateway. Satu-satunya pembeda antara provider langsung dan gateway |
| `CONVERSATION_CHAT_MODEL` | opsional | Default `gpt-5.6-luna`. Lewat gateway memakai bentuk berprefiks, mis. `openai/gpt-5.6-luna` atau `google/gemini-3.8-flash` |
| `CONVERSATION_DAILY_TURN_LIMIT` | ya | Integer positif |
| `CONVERSATION_DAILY_AUDIO_SECONDS` | wajib bila `FEATURES_SPEAKING=true` | Integer positif |
| `CONVERSATION_TRANSCRIPT_RETENTION_DAYS` | ya | Integer positif |
| `CONVERSATION_AUDIO_RETENTION_DAYS` | wajib bila audio disimpan | Integer positif |

Konstanta non-env: `CONVERSATION_PROMPT_VERSION`, `CONVERSATION_RUBRIC_VERSION`,
`CONVERSATION_MAX_TURNS_PER_SESSION`, `CONVERSATION_MAX_USER_CHARS`.

Tambahan di `src/constants/cache-key.ts`:

```ts
conversationCatalog: "conversation-catalog",
conversationSessions: (userId: number) => `conversation-sessions-${userId}`,
```

---

## 10. Requirement

Penomoran dipakai supaya bisa dirujuk di checklist implementasi dan UAT.

### 10.1 Requirement produk (harus diputuskan sebelum koding)

| ID | Requirement |
|---|---|
| P-1 | Use case sempit rilis pertama ditetapkan (mis. hanya percakapan sehari-hari N5–N4, 3 topik) |
| P-2 | Batas klaim pedagogis ditulis eksplisit: latihan, bukan penilaian resmi JLPT |
| P-3 | **Diputuskan: tanpa batas selama development.** Pemakaian tetap dicatat; angka batas menyusul dari modul plan/pricing terpisah. Wajib aktif sebelum provider nyata berjalan |
| P-4 | Kebijakan retention transcript dan audio ditetapkan dalam hari |
| P-5 | **Diputuskan: `gpt-5.6-luna` lewat SDK `openai`.** Jalur STT/TTS tetap memakai browser untuk sekarang |
| P-6 | Rubrik evaluasi + kumpulan skenario uji bahasa Jepang disiapkan untuk gate rilis |

### 10.2 Requirement fungsional — Conversation (TEXT)

| ID | Requirement |
|---|---|
| CONV-1 | User login dapat memilih persona, level JLPT, dan satu atau lebih topik dari fixture. Guest melihat halaman yang sama dalam bentuk penjelasan fitur beserta CTA masuk dan daftar, tanpa redirect paksa |
| CONV-2 | Menekan mulai membuat `ConversationSession` di server dan redirect ke `/conversation/[sessionId]` |
| CONV-3 | Greeting pembuka berasal dari fixture persona, tanpa memanggil provider |
| CONV-4 | User mengirim teks Jepang atau Indonesia; balasan datang dari provider nyata, tidak pernah dari placeholder |
| CONV-5 | Setiap balasan dapat ditampilkan dengan furigana, romaji, dan terjemahan Indonesia; ketiganya dapat di-toggle terpisah saat percakapan berjalan |
| CONV-6 | Balasan dapat dibacakan lewat TTS dengan pesan fallback jika browser tidak mendukung |
| CONV-7 | User dapat meminta koreksi terstruktur untuk giliran miliknya |
| CONV-8 | Refresh halaman tidak menghilangkan percakapan bila transcript disimpan; bila tidak disimpan, user diberi tahu sejak awal |
| CONV-13 | Mengirim pesan menggulirkan daftar pesan di dalam kotaknya, tidak menggeser header maupun komposer |
| CONV-9 | Percakapan berakhir dengan meninggalkan halaman atau memulai percakapan baru; tidak ada tombol akhiri eksplisit. Penandaan `COMPLETED`/`ABANDONED` di database menjadi urusan server pada Tahap D |
| CONV-10 | User dapat menghapus satu session beserta seluruh turn-nya, didahului dialog konfirmasi yang menyebut partner dan jumlah giliran yang akan hilang |
| CONV-11 | Kegagalan provider, timeout, moderation, dan quota habis muncul **berurutan di dalam alur percakapan** pada posisi giliran yang gagal, bukan sebagai banner tunggal, dan membawa aksi lanjut yang jelas (mis. coba lagi untuk giliran itu) |
| CONV-12 | Sisa quota harian terlihat sebelum dan selama session |

### 10.3 Requirement fungsional — Speaking (VOICE)

| ID | Requirement |
|---|---|
| SPK-1 | Halaman melakukan probe dukungan browser dan menampilkan hasilnya sebelum user mencoba merekam |
| SPK-2 | Izin mikrofon diminta saat user menekan rekam, bukan saat halaman dibuka |
| SPK-3 | Indikator level suara berasal dari sinyal audio nyata, bukan animasi statis |
| SPK-4 | Hasil STT ditampilkan sebagai transcript yang dapat diedit sebelum dikirim |
| SPK-5 | Typed transcript fallback berfungsi penuh saat mikrofon/STT tidak tersedia atau ditolak |
| SPK-6 | Audio hanya diunggah bila `allowAudioStorage = true`; selain itu tidak pernah meninggalkan perangkat |
| SPK-7 | Playback rekaman tersedia bila audio disimpan, beserta tombol hapus |
| SPK-8 | State animasi karakter menghormati `prefers-reduced-motion` dan tidak menjadi satu-satunya penanda status |
| SPK-9 | Skor pengucapan tidak dirilis pada versi pertama |
| SPK-10 | Mikrofon dilepas saat komponen runner dilepas, sehingga indikator perekaman browser tidak menyala setelah user pindah halaman |
| SPK-11 | Setup mode suara tidak meminta topik |
| SPK-12 | Setiap persona dapat dicoba sebelum dipilih: contoh suara diputar, dan state `idle`/`talking`/`listening`/`happy` dapat dilihat satu per satu |
| SPK-13 | State `talking` karakter mengikuti awal dan akhir ucapan yang sebenarnya (`onstart`/`onend`), bukan timer tebakan |
| SPK-14 | Ilustrasi karakter tampil pada kartu pilihan dan sebagai pratinjau besar di `/conversation/setup` maupun `/speaking/setup`, sehingga persona terlihat sebelum dipilih |
| SPK-17 | Mode bebas tangan: satu saklar dengar/hening. Selama aktif, transkrip final langsung dikirim tanpa tombol, dan pendengaran menyala lagi otomatis setelah karakter selesai bicara |
| SPK-18 | Kegagalan mikrofon menghentikan mode bebas tangan, bukan mengulang percobaan — izin yang ditolak tidak boleh menjadi perulangan tanpa akhir |
| SPK-15 | Mengirim giliran tidak menggeser halaman maupun karakter. Riwayat bergulir di dalam kotaknya sendiri, bukan lewat scroll halaman |
| SPK-16 | Pada desktop, karakter dan kontrol giliran menempati kolom tetap yang tidak bergerak saat riwayat bertambah — menyiapkan mode suara yang berpusat pada karakter |

### 10.4 Requirement non-fungsional

| ID | Requirement |
|---|---|
| NF-1 | Target latency turn pertama terlihat: p50 di bawah 3 detik dengan streaming; tanpa streaming, indikator progres wajib |
| NF-2 | Timeout provider, jumlah retry, dan perilaku saat gagal ditentukan eksplisit; tidak ada retry tak terbatas |
| NF-3 | Satu user tidak dapat menjalankan lebih dari satu permintaan turn bersamaan |
| NF-4 | Lint, typecheck, test, dan build lulus (`npm run verify`); tanpa `any` |
| NF-5 | Seluruh flow dapat dioperasikan dengan keyboard dan terbaca screen reader; status "sedang menjawab" diumumkan lewat live region |
| NF-6 | Layout runner berfungsi pada viewport mobile, termasuk komposer yang tidak tertutup keyboard virtual |
| NF-7 | Log menyertakan latency, token, dan status provider, tanpa isi pesan user |

### 10.5 Requirement data dan privasi

| ID | Requirement |
|---|---|
| D-1 | Transcript hanya disimpan bila `allowConversationStorage = true` |
| D-2 | Audio hanya disimpan bila `allowAudioStorage = true` |
| D-3 | Consent di-snapshot per session dan tidak diubah retroaktif |
| D-4 | Mencabut consent menghapus data terkait dalam transaksi yang sama |
| D-5 | Data conversation ikut di `/api/account/export` |
| D-6 | Hard-delete akun menghapus session, turn, feedback, quota, dan audio Cloudinary |
| D-7 | Cron retention menghapus data yang melewati `retentionExpiresAt` |
| D-8 | Seluruh query berawal dari `session.userId`; kepemilikan diverifikasi di setiap action dan route handler |
| D-9 | Konten dari provider tidak pernah dirender sebagai HTML mentah |
| D-10 | Project OpenAI yang melayani produksi tidak mengaktifkan Data Sharing Program. Free tier hanya dipakai pada project development dengan data uji, bukan data user (§7.4) |

### 10.6 Requirement operasional

| ID | Requirement |
|---|---|
| O-1 | Feature flag mematikan route, action, menu sidebar, dan CTA home tanpa deploy kode |
| O-2 | Job cron retention terdaftar di `vercel.json` dan memakai `CRON_SECRET` seperti `/api/cron/auth-cleanup` |
| O-3 | Kegagalan provider tercatat lewat `src/lib/server-logger.ts` dengan kategori yang dapat dibedakan |
| O-4 | Perubahan `promptVersion`/`rubricVersion` tercatat dan tidak mengubah tafsir data lama |
| O-5 | Copy home mengikuti keadaan sebenarnya: "Preview" saat flag mati, "Versi awal" beserta keterangan skrip saat provider mock, dan "tersedia" hanya setelah gate rilis (§12) terpenuhi |
| O-6 | Mode mock (`CONVERSATION_PROVIDER=mock`) hanya aktif di environment non-produksi, membawa banner "mode simulasi" yang jelas, dan tidak pernah menulis data yang tampak sebagai hasil belajar nyata |

### 10.7 Requirement dependency dan akun eksternal

| ID | Requirement |
|---|---|
| X-1 | Persetujuan menambah `openai` sebagai dependency |
| X-2 | Akun/billing provider AI aktif, dengan batas pengeluaran diset di sisi provider |
| X-3 | `OPENAI_API_KEY` dan `OPENAI_BASE_URL` tersedia di `.env`, `.env.example` (tanpa nilai), dan environment deployment |
| X-4 | Bila memilih vendor STT/TTS cloud: persetujuan dependency kedua, kunci API, dan kebijakan pemrosesan data vendor |
| X-5 | **Terpenuhi.** Karakter digambar sendiri sebagai inline SVG parametrik dari fixture persona — self-hosted penuh, tanpa generator avatar pihak ketiga saat runtime. Ilustrasi pesanan yang lebih detail dapat menggantikannya nanti tanpa mengubah kontrak persona |
| X-6 | Gateway 9Router sudah di-host user. Sebelum dipakai di produksi: kompresi token dimatikan, fallback dikunci, dan daftar provider dibatasi sesuai kebijakan data (§7.5) |
| X-7 | Dua project OpenAI terpisah: development (boleh Data Sharing Program) dan produksi (tanpa data sharing), masing-masing dengan API key sendiri |

---

## 11. Urutan Implementasi

Pendekatan: **UI lebih dulu di atas provider mock**, supaya alur dan tampilan dapat dinilai langsung
sebagai end user sebelum ada migration, biaya provider, atau keputusan vendor. Konsekuensinya
kontrak tipe harus dibekukan lebih dulu — itu yang membuat pekerjaan UI tidak terbuang.

Pemetaan ke [`../plan/index.md`](../plan/index.md): Tahap A menutup Fase 8.1 (Product dan Safety
Contract), Tahap B–F menutup Fase 8.2 (Conversation Text MVP), Tahap G menutup Fase 8.3 (Speaking).

| Tahap | Isi | Butuh migration | Butuh API key/biaya |
|---|---|---|---|
| A | Bekukan keputusan produk P-1, P-2, P-6. Tulis kontrak tipe (`schemas.ts`, tipe domain, antarmuka provider) dan fixture persona/topik | tidak | tidak |
| B | `lib/provider/mock.ts` + UI Conversation lengkap: `/conversation`, `/conversation/setup`, `/conversation/[sessionId]`. State session memakai pola `exam-provider` (context + `sessionStorage`), bukan `localStorage` ala prototype | tidak | tidak |
| C | UI Speaking lengkap: mikrofon, permission flow, level meter, STT, dan TTS **nyata** (Web Speech API); hanya balasan dan feedback yang mock | tidak | tidak |
| **Gate penilaian** | **User menilai alur, layout, copy, toggle, dan seluruh state gagal sebagai end user. UX dibekukan di sini.** | — | — |
| D | **Selesai.** Migration 4 tabel + RLS, Server Actions dengan ownership, consent snapshot, pencatatan quota atomik. Provider masih mock | ya | tidak |
| E | **Selesai sebagian.** Provider OpenAI nyata lewat gateway 9Router, prompt builder, feedback terstruktur, dan streaming aktif. Moderation endpoint belum | tidak | ya |
| F | Retention cron, penghapusan saat consent dicabut, data conversation pada ekspor/hapus akun | tidak | ya |
| G | Rilis Speaking: naikkan STT/TTS bila vendor cloud dipilih (X-4), uji lintas browser | tergantung | tergantung |
| H | Evaluasi rubrik, verifikasi biaya nyata, buka copy home dari "Preview" | tidak | ya |

### 11.0 Status pengerjaan

| Tahap | Status | Catatan |
|---|---|---|
| A | Selesai | Kontrak tipe, schema Zod, fixture 4 persona dan 6 topik, antarmuka provider |
| B | Selesai, menunggu penilaian user | `/conversation`, `/conversation/setup`, `/conversation/[sessionId]` di route group `(public)`, di atas `provider/mock.ts`; gate CTA untuk guest, CTA landing page, dan entri nav aktif mengikuti flag |
| C | Selesai, menunggu penilaian user | `/speaking`, `/speaking/setup`, `/speaking/[sessionId]`. Mikrofon, permission flow, level meter `AnalyserNode`, STT, dan TTS **nyata**; hanya balasan yang mock. Setup tanpa topik, dengan pratinjau state karakter dan contoh suara |

Revisi setelah penilaian awal: route dipindahkan dari `(dashboard)` ke `(public)`, tombol akhiri
session dihapus, toggle furigana ditambahkan di samping romaji dan terjemahan, kegagalan ditampilkan
berurutan di dalam alur percakapan, CTA ditambahkan pada section percakapan di landing page, guest
mendapat halaman gate ber-CTA alih-alih redirect ke `/login`, dan penghapusan percakapan meminta
konfirmasi lewat `AlertDialog`.

Revisi kedua: persona diperluas menjadi enam dengan kosakata `personality`, `voiceType`, dan `tags`
yang sama dengan prototype referensi, ditambah filter gender, badge, tag, contoh suara per persona,
dan pratinjau state karakter. Topik dihapus dari mode suara.

Revisi ketiga: arah VTuber ditetapkan (§12.1). Avatar tipografis diganti ilustrasi karakter SVG
parametrik dengan empat ekspresi, ditampilkan pada kartu pilihan dan pratinjau besar di kedua halaman
setup. Mulut karakter bergerak selama ucapan berlangsung.

Catatan Tahap C: Web Speech API belum ada di lib DOM TypeScript, jadi bentuk `SpeechRecognition` yang
dipakai dideklarasikan eksplisit di `lib/speech.ts` — platform API masuk sebagai tipe yang dinarrow,
bukan `any`. Setup Speaking memakai ulang `ConversationSetup` dengan prop `mode="VOICE"` alih-alih
menyalin komponennya.

Catatan penyimpangan dari rencana: entri `robots.ts` (semula Tahap D) ditarik maju ke Tahap B. Entri
`proxy.ts` sempat ditambahkan lalu dilepas kembali setelah diputuskan guest harus melihat CTA alih-alih
redirect. Selain itu,
`generateConversationReplyAction` sudah dibuat sebagai Server Action sejak Tahap B — bukan memanggil
mock dari client — supaya bentuk pemanggilannya identik dengan Tahap E dan seam provider benar-benar
teruji.

### 11.2 Catatan Tahap D

Migration `20260904230000_conversation_sessions` dijalankan dengan `migrate deploy` memakai SQL hasil
`migrate diff`, karena `migrate dev` bermasalah pada setup Supabase ini. Empat tabel dibuat dengan RLS
aktif dan nol grant ke role Data API — diverifikasi langsung ke database.

Empat keputusan yang muncul saat implementasi:

1. **`sessionStorage` dihapus seluruhnya.** Sumber kebenaran kini database. Bila consent penyimpanan
   mati, isi percakapan memang hilang saat halaman dimuat ulang — itu perilaku yang benar menurut D-1,
   bukan kekurangan yang perlu ditambal dengan cache client.
2. **Persona, level, dan topik dibaca dari database, bukan dari payload client.** Kalau ikut dikirim
   client, satu user dapat menukar persona atau level di tengah percakapan hanya dengan mengubah
   payload permintaan.
3. **`turnCount` mengikuti jumlah baris turn.** Sapaan pembuka menempati `order 0`, jadi session
   dengan consent aktif dimulai pada `turnCount = 1`. Tanpa ini giliran pertama menulis `order 0` lagi
   dan menabrak unique `[sessionId, order]` — ditemukan dan diperbaiki sebelum rilis.
4. **Quota dicatat, tidak ditolak.** Penambahannya atomik (`INSERT ... ON CONFLICT DO UPDATE`) seperti
   `AuthRateLimit`. Penegakan batas menyusul dari modul plan/pricing.

Diuji langsung ke database: pembuatan session, urutan turn `0,1,2` tanpa duplikat, penambahan quota
tiga kali menghasilkan 3, dan penghapusan session menyisakan nol turn lewat cascade.

### 11.3 Catatan Tahap E: perilaku gateway

Empat hal ditemukan saat menyambung ke gateway OpenAI-compatible, semuanya lewat pengujian langsung
dan bukan dugaan. Ini akan berlaku untuk gateway lain juga.

1. **SDK OpenAI diblokir oleh User-Agent-nya sendiri.** `User-Agent: OpenAI/JS <versi>` menghasilkan
   403 "Your request was blocked", sedangkan seluruh header `x-stainless-*` lolos. Diisolasi dengan
   menguji header satu per satu. Ditangani lewat `defaultHeaders` dengan identitas aplikasi sendiri.
2. **Nama model butuh prefiks provider.** Gateway mengekspos `cx/gpt-5.6-luna`, bukan
   `gpt-5.6-luna`. Nama tanpa prefiks juga menghasilkan 403, sehingga gejalanya sama dengan poin 1
   dan menutupinya.
3. **`response_format: json_schema` diabaikan diam-diam.** Status tetap 200 tetapi isinya teks biasa.
   Kegagalan seperti ini tidak muncul sebagai error, hanya sebagai balasan yang gagal diurai. Karena
   itu bentuk keluaran diminta lewat prompt berlabel (`JA:`/`ID:`/`RO:`), bukan lewat fitur provider.
4. **Keluaran model tidak selalu konsisten bentuknya.** Sesekali muncul penanda markdown, pagar kode,
   kalimat pembuka, atau furigana bergaya `何{なに}`. Pengurai dibuat toleran dan menormalkan furigana;
   balasan hanya ditolak bila benar-benar tidak mengandung aksara Jepang. Setiap kegagalan mencatat
   balasan mentahnya ke log server karena sifatnya sesekali dan tidak dapat direproduksi tanpa itu.

Satu bug klien juga ditemukan dari laporan pengguna bahwa ucapan pertama terdengar laki-laki lalu
berikutnya perempuan: `speechSynthesis.getVoices()` terisi asinkron, dan saat masih kosong tidak ada
suara yang dapat dipilih sehingga browser memakai suara bawaannya. Daftar suara kini dipanaskan sejak
runner dimuat dan diperbarui lewat event `voiceschanged`.

### 11.4 Catatan streaming

Streaming tidak dapat dilayani Server Action, jadi jalurnya memakai Route Handler
`POST /api/conversation/[sessionId]/turn` — pengecualian yang sudah diperkirakan di §6, sejajar dengan
`/api/flashcard/export`. Seluruh guard tetap dijalankan ulang di handler: flag fitur, session,
kepemilikan, dan validasi Zod. Handler tidak bersandar pada pemeriksaan yang sudah dilakukan halaman.

Empat hal yang menentukan bentuk implementasinya:

1. **Format wire NDJSON**, satu objek JSON per baris (`delta`, `done`, `error`). Lebih sederhana
   daripada SSE dan cukup untuk kebutuhan ini.
2. **Yang ditampilkan hanya bagian Jepang.** Karena keluaran berbentuk tiga baris berlabel, label
   `JA:` datang lebih dulu sehingga isinya dapat mengalir; terjemahan dan romaji menyusul di akhir.
   `extractPartialJapanese` mengurai potongan yang masih setengah jadi dan tetap menormalkan furigana.
3. **Delta `reasoning_content` disaring.** Gateway ikut mengalirkan proses berpikir model; hanya
   `content` yang dipakai.
4. **Penyimpanan tetap di server dan hanya setelah aliran selesai**, sehingga giliran separuh jadi
   tidak pernah tersimpan. Aliran yang putus tanpa penutup diperlakukan sebagai kegagalan, bukan
   sebagai balasan kosong yang tampak berhasil.

Konsekuensi struktural: `DENIED`, `requireOwnedSession`, `persistTurns`, dan `toConversationLevel`
dipindahkan dari `actions.ts` ke `lib/session-guard.ts`, karena file bertanda `"use server"`
mengharuskan seluruh ekspornya berupa async function.

### 11.1 Aturan tahap mock (B dan C)

Mock yang mulus akan menghasilkan penilaian yang terlalu optimistis: ia selalu instan dan selalu
benar, padahal justru latency, kualitas bahasa, dan kegagalan provider yang menentukan kelayakan
modul ini. Karena itu:

1. **Cakupan mock dibatasi dua fungsi**: balasan percakapan dan feedback terstruktur. Fixture persona,
   mikrofon, permission flow, level meter, STT, dan TTS dibangun nyata sejak Tahap B/C — semuanya
   berbasis API browser dan tidak berbiaya.
2. **Mock wajib menyuntikkan keadaan buruk**: delay yang dapat diatur (2–5 detik), timeout, error
   provider, quota habis, moderation flag, dan STT gagal. Semuanya dapat dipicu manual dari UI dev
   agar setiap error state benar-benar teruji.
3. **Route bentuk final sejak awal**: `/conversation/[sessionId]` dipakai sejak Tahap B dengan id
   sementara dari client. Tahap D hanya mengganti sumber datanya, bukan struktur halamannya.
4. **Dev-only dan jujur** (O-6): mode mock tidak boleh reachable di produksi dan wajib membawa banner
   "mode simulasi". Aturan docs project — tidak ada hasil, rekaman, atau transkripsi palsu yang
   disajikan sebagai nyata — tetap berlaku penuh.
5. **Tidak ada logika domain di dalam mock**: hitungan quota, urutan turn, dan lifecycle tetap ditulis
   sekali di tempat yang benar, supaya Tahap D tidak menulis ulang perilaku yang sudah dinilai user.

Speaking tetap **dirilis** setelah Conversation, meskipun UI-nya dibangun lebih awal pada Tahap C.

---

## 12. Acceptance Criteria dan UAT

Testing fungsional dilakukan user secara manual (keputusan scope di `plan/index.md`). Checklist UAT
ditulis ke `docs/verification/` mengikuti pola berkas yang sudah ada di sana.

Gate rilis Conversation:

1. Seluruh CONV-1..CONV-12 diverifikasi user di desktop dan mobile.
2. Skenario uji bahasa Jepang (P-6) dijalankan; relevansi, kesesuaian level, dan halusinasi dinilai
   terhadap rubrik dan hasilnya diterima user.
3. Biaya nyata per turn diukur dari `usage` dan cocok dengan plafon P-3.
4. Provider outage, timeout, quota habis, dan koneksi lambat diuji dan menghasilkan state yang jujur.
5. Ekspor akun dan hapus akun diuji dan benar-benar membawa/menghapus data conversation.

Gate rilis Speaking, sebagai tambahan:

6. SPK-1..SPK-9 diverifikasi pada minimal satu browser yang mendukung dan satu yang tidak.
7. Penolakan izin mikrofon dan pencabutan izin di tengah session diuji.
8. Bila audio disimpan: upload, playback, hapus manual, dan hapus otomatis via cron diuji.

---

## 12.1 Arah Speaking: Karakter VTuber

**Ditetapkan sebagai arah produk.** Speaking dibangun di sekitar karakter bergaya VTuber: persona
adalah daya tarik utamanya, bukan hiasan. Konsekuensinya karakter ditampilkan besar saat memilih,
punya contoh suara sendiri, dan beranimasi mengikuti ucapan.

Yang sudah menjadi bagian rilis ini: ilustrasi karakter SVG per persona dengan empat ekspresi,
pratinjau state di setup, contoh suara per persona, dan animasi `talking` yang mengikuti awal dan
akhir ucapan sebenarnya.

**Arah suara: TTS karakter, bukan realtime.** User memutuskan memakai suara khas karakter (kandidat
utama VOICEVOX) agar persona terasa hidup. Ini menutup pertanyaan realtime, karena keduanya saling
meniadakan:

| | Realtime API | Pipeline + TTS karakter |
|---|---|---|
| Suara | Dihasilkan model, milik provider, tidak dapat diganti | Bebas dipilih |
| Latency | Terendah, dapat disela di tengah | Bergiliran, jeda sekitar 1-2 detik |
| Lip-sync | Dari aliran audio | Dari berkas audio, sama presisinya |

Realtime API menyediakan beberapa suara percakapan yang natural dan dapat diarahkan lewat instruksi,
tetapi tidak ada varian karakter anime. Untuk modul yang justru menjadikan persona sebagai daya
tariknya, suara netral menghilangkan sebagian besar nilainya — jadi pipeline yang dipilih.

Konsekuensinya untuk implementasi: slot `lib/provider/tts.ts` yang sudah ada menjadi tempat
VOICEVOX dipasang, dan `use-lip-sync.ts` kelak beralih dari perkiraan mora ke amplitudo audio nyata.
Lisensi VOICEVOX berlaku per karakter suara dan umumnya menuntut pencantuman kredit — wajib
diverifikasi ke dokumentasi resminya sebelum rilis.

**Realtime tidak tersedia lewat gateway.** Diperiksa langsung pada 9Router: `/v1/realtime` dan
`/v1/realtime/sessions` menjawab 404, dan tidak ada model realtime di katalognya. Ini bukan sekadar
belum dipasang — Realtime API berjalan di atas WebSocket sedangkan gateway adalah proxy HTTP.
Sebaliknya `/v1/audio/speech` dan `/v1/audio/transcriptions` menjawab 405, artinya rutenya ada dan
hanya perlu POST, sehingga jalur pipeline memang terbuka.

**Sebagai gantinya: mode bebas tangan.** Sebagian besar kesan "live" datang dari hilangnya tombol,
bukan dari transport realtime. Giliran berputar sendiri — bicara, berhenti, karakter menjawab, lalu
mendengarkan lagi. Yang tidak didapat hanya kemampuan menyela di tengah kalimat.

Percakapan suara realtime dua arah tetap dicatat di bawah sebagai pembanding, bukan sebagai rencana.

**Bagian yang murah dan sudah dikerjakan.** Karakter yang beranimasi saat berbicara tidak butuh
realtime. State `talking` digerakkan oleh `onstart`/`onend` milik ucapan yang sebenarnya, dan mulut
karakter ikut bergerak selama itu. Yang belum bisa adalah sinkronisasi per suku kata, karena Web Speech Synthesis tidak
mengekspos aliran audionya. Begitu TTS pindah ke vendor cloud yang mengembalikan berkas audio (§8.2),
amplitudonya dapat dibaca `AnalyserNode` dan dipakai menggerakkan mulut karakter — tanpa menyentuh
arsitektur percakapan sama sekali.

**Bagian yang mahal.** Percakapan suara dua arah sungguhan mengubah empat hal sekaligus:

| Aspek | Sekarang | Bila realtime |
|---|---|---|
| Model biaya | Per giliran, ~$0.0005 dengan `gpt-5.6-luna` | Per menit, ~$0.05/menit (`gpt-realtime-2.1`) atau ~$0.016/menit pada varian mini |
| Satuan quota | Jumlah giliran | Detik audio — kolom `ConversationQuota.audioSeconds` sudah disiapkan untuk ini |
| Privasi | Audio tidak pernah meninggalkan perangkat | Audio mengalir terus ke provider; klaim privasi Speaking saat ini gugur dan butuh disclosure baru |
| Transport | Server Action biasa | WebRTC atau WebSocket, dengan token sesi berumur pendek yang dicetak server — kunci utama tidak boleh menyentuh browser |

Sesi 5 menit berarti sekitar $0.25 (atau $0.08 pada mini), dibanding ~$0.02 untuk satu sesi teks
penuh 40 giliran. Selisihnya nyata tetapi tidak mustahil; yang menentukan adalah apakah plafon P-3
sanggup menanggungnya.

Rekomendasi: jangan dikerjakan sebelum Tahap H selesai. Kualitas bahasa Jepang dan kesesuaian level
harus terbukti lebih dulu pada jalur teks yang murah — kalau prompt dan levelnya masih meleset,
memperbaikinya di jalur realtime jauh lebih mahal dan lebih lambat diuji.

---

## 13. Di Luar Scope Rancangan Ini

- Skor pengucapan dan penilaian otomatis apa pun yang mengklaim setara JLPT.
- Percakapan suara real-time dua arah (full-duplex). Dicatat sebagai arah lanjutan di §12.1, bukan bagian rilis ini.
- Memori lintas session (persona mengingat percakapan sebelumnya).
- Conversation untuk guest tanpa akun.
- Memasukkan metrik conversation ke `/analytics`, `/progress`, atau proyeksi skor mock.
- Sharing atau publikasi transcript antar user.

---

## 14. Keputusan Terbuka

Diurut berdasarkan dampaknya ke schema dan UX. Masing-masing diberi rekomendasi.

| # | Pertanyaan | Rekomendasi |
|---|---|---|
| 1 | Transcript disimpan default atau opt-in? | Tetap opt-in lewat `allowConversationStorage` yang sudah ada; fitur tetap berjalan penuh tanpa opt-in |
| 2 | STT/TTS browser atau vendor cloud pada rilis pertama? | Browser dulu — sekaligus dipakai sejak Tahap C sehingga akurasi dan cakupan browsernya ikut dinilai sebelum vendor cloud dipertimbangkan |
| 3 | ~~Kapan streaming masuk?~~ **Selesai di Tahap E** lewat Route Handler NDJSON. Tahap B cukup memakai indikator "sedang menjawab" dari mock yang diberi delay, karena yang dinilai di situ adalah desain state menunggu, bukan mekanisme transportnya |
| 4 | Model default mana? | **Dikunci: `gpt-5.6-luna`.** Harganya ~$0.0005/turn, mendukung structured output yang dibutuhkan §7.3, dan memang diposisikan untuk chat bervolume tinggi. `gpt-5.6-terra` dan `gemini-3.8-flash` tetap jadi pembanding pada rubrik P-6; keduanya hanya perubahan konfigurasi |
| 4c | Free tier OpenAI dipakai di produksi? | Tidak. Free tier menuntut data sharing untuk training; pakai hanya di project development (D-10, X-7) |
| 4b | 9Router di jalur produksi atau hanya development? | Development dulu. Produksi langsung ke provider sampai gateway terbukti stabil sebagai infrastruktur; perpindahannya cukup satu env var (§7.5) |
| 5 | Feedback koreksi otomatis tiap turn atau atas permintaan? | Atas permintaan — menghemat sekitar separuh biaya dan mengurangi gangguan saat berlatih |
| 6 | Persona sebagai fixture atau tabel database? | Fixture, mengikuti preseden kana |
| 7 | Satu tabel dengan `mode` atau tabel terpisah per modul? | Satu tabel dengan `mode` |
| 8 | Batas maksimum turn per session? | Ada, sebagai perlindungan biaya dan konteks; nilai ditentukan bersama quota |
