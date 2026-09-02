# Modul Shared Study Utilities

## Status Aktual

**Selesai sederhana.** Feature `study` saat ini hanya menyediakan helper Text-to-Speech bersama untuk modul Kana dan Vocabulary.

## Fitur Aktif

- Mendeteksi `speechSynthesis` dan `SpeechSynthesisUtterance` di browser.
- Membatalkan utterance sebelumnya sebelum memutar suara baru.
- Memakai locale `ja-JP` dan rate 0.85.
- Mengembalikan pesan fallback bila browser tidak mendukung atau playback gagal.

## Yang Belum Ada

- Provider audio server/cloud.
- Cache/preload file audio.
- Voice selection dan preference user.
- Speech recognition atau microphone capture.
- Pronunciation scoring.
- Abstraksi conversation/speaking.

## File Utama

- `src/features/study/lib/tts.ts`

