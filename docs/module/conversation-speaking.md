# Modul Conversation dan Speaking

## Status Aktual

**Preview saja; belum ada modul aplikasi yang dapat digunakan.** Repository hanya menampilkan dua section konsep pada landing page.

Rancangan implementasi (schema, route, kontrak action, dan requirement) ada di
[`conversation-speaking-design.md`](conversation-speaking-design.md).

## Yang Sudah Ada

- Preview percakapan dengan partner, topik, contoh dialog, terjemahan, dan label TTS.
- Preview speaking dengan visual waveform, contoh kalimat, dan penjelasan fallback typed transcript.
- Copy landing secara eksplisit menyebut bahwa provider AI production, rekaman, dan transkripsi belum aktif.

## Yang Belum Ada

- Route `/conversation` atau `/speaking`.
- Feature folder, Server Action, schema, atau model database.
- Pemilihan karakter/topik yang interaktif.
- Provider LLM/AI untuk respons percakapan.
- Microphone capture dan permission flow.
- Speech-to-text/transcription.
- Pronunciation scoring atau feedback.
- TTS conversation production.
- Chat history, session persistence, quota, moderation, dan privacy/retention policy audio.

## Catatan Arsitektur

- `src/app/robots.ts` **belum** memblokir `/conversation` maupun `/speaking`; keduanya tidak ada di daftar `allow` maupun `disallow`. Saat route dibuat, keduanya harus ditambahkan ke `disallow` dan ke `PROTECTED_ROUTES`/`PROTECTED_PREFIXES` di `src/proxy.ts`.
- `User.allowAudioStorage` dan `User.allowConversationStorage` sudah ada di schema, dapat diubah di `/profile/privacy`, dan sudah ikut pada `/api/account/export` — jadi consent tidak perlu kolom baru.
- `src/features/study/lib/tts.ts` hanya menyediakan speech synthesis browser untuk kana/vocabulary dan belum menjadi conversation engine.
- Preview tidak membuat data palsu di database; semua tampilannya statis.

## File Utama

- `src/app/(public)/page.tsx`
- `src/app/robots.ts`
- `src/features/study/lib/tts.ts`

