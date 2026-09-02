# Modul Conversation dan Speaking

## Status Aktual

**Preview saja; belum ada modul aplikasi yang dapat digunakan.** Repository hanya menampilkan dua section konsep pada landing page.

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

- `robots.ts` sudah memblokir path `/conversation` dan `/speaking`, tetapi path tersebut belum diimplementasikan.
- `src/features/study/lib/tts.ts` hanya menyediakan speech synthesis browser untuk kana/vocabulary dan belum menjadi conversation engine.
- Preview tidak membuat data palsu di database; semua tampilannya statis.

## File Utama

- `src/app/(public)/page.tsx`
- `src/app/robots.ts`
- `src/features/study/lib/tts.ts`

