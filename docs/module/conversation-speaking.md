# Modul Conversation dan Speaking

## Status Aktual

**Versi awal fungsional; belum siap produksi.** Percakapan teks dan suara sudah berjalan end-to-end
untuk user login dengan session tersimpan di database. Provider balasan bisa `mock` atau OpenAI
(lewat gateway). Penegakan quota, moderation, dan retention belum ada.

Rancangan, keputusan, dan status per tahap ada di
[`conversation-speaking-design.md`](conversation-speaking-design.md) (§11.0). Spesifikasi aset
karakter ada di [`conversation-persona-assets.md`](conversation-persona-assets.md).

## Feature Flag

| Key | Default | Saat `false` |
|---|---|---|
| `FEATURES_CONVERSATION` | `true` | `/conversation/*` mengembalikan 404 (guard di tiap page), `POST /api/conversation/[sessionId]/turn` mengembalikan 404, seluruh Server Action menolak dengan `disabled`, menu Percakapan di header/sidebar dan section di home tidak dirender |
| `FEATURES_SPEAKING` | `true` | `/speaking/*` mengembalikan 404, pembuatan session `mode: "VOICE"` ditolak, menu Bicara dan section speaking di home tidak dirender |

- `FEATURES_SPEAKING` ikut mati bila `FEATURES_CONVERSATION=false`, karena speaking memakai jalur
  turn yang sama. Kombinasi ini tidak membuat aplikasi gagal start.
- Validasi env di `src/constants/index.ts` hanya memeriksa konfigurasi provider bila
  `FEATURES_CONVERSATION=true`: `CONVERSATION_PROVIDER=mock` ditolak saat `VERCEL_ENV=production`,
  dan `CONVERSATION_PROVIDER=openai` mewajibkan `OPENAI_API_KEY`. Karena default flag sekarang
  `true`, deployment produksi yang belum siap memakai provider nyata wajib mengisi
  `FEATURES_CONVERSATION=false`.
- Menggantikan `CONVERSATION_ENABLED` dan `SPEAKING_ENABLED`, yang tidak lagi dibaca.

## Route

- `/conversation`, `/conversation/setup`, `/conversation/[sessionId]`
- `/speaking`, `/speaking/setup`, `/speaking/[sessionId]`
- `POST /api/conversation/[sessionId]/turn` — streaming balasan (NDJSON)

Semua route berada di route group `(public)`. Guest melihat halaman gate ber-CTA login, bukan
redirect; akses sebenarnya dijaga di halaman, Server Action, dan route handler.

## Yang Sudah Ada

- Setup persona, level JLPT (N5-N3), dan topik; mode suara tanpa topik.
- Session dan turn tersimpan di database (4 tabel, RLS aktif, tanpa grant Data API) dengan
  ownership check; persona, level, dan topik dibaca dari database, bukan dari payload client.
- Consent `allowConversationStorage` di-snapshot saat session dibuat (`transcriptRetained`).
- Provider `mock` dan OpenAI-compatible (gateway 9Router) dengan streaming dan feedback per giliran.
- Speaking: mikrofon, permission flow, level meter, STT dan TTS lewat Web Speech API, serta
  karakter dengan lip-sync.
- Pemakaian harian dicatat secara atomik.

## Yang Belum Ada

- Penegakan batas quota; pemakaian baru dicatat, belum ditolak. Wajib aktif sebelum provider nyata
  dipakai dengan API key produksi.
- Moderation endpoint.
- Retention cron, penghapusan saat consent dicabut, dan data conversation pada ekspor/hapus akun.
- STT/TTS cloud dan uji lintas browser untuk speaking (saat ini butuh browser berbasis Chromium).

## Catatan Arsitektur

- `robots.ts` selalu men-`disallow` `/conversation` dan `/speaking`. `src/proxy.ts` sengaja tidak
  melindungi keduanya supaya guest melihat halaman gate.
- Streaming memakai route handler, bukan Server Action; handler menjalankan ulang seluruh guard
  (flag, session, kepemilikan, Zod).
- `src/features/study/lib/tts.ts` tetap milik kana/flashcard; speaking memakai lib sendiri di
  `src/features/conversation/lib/`.

## File Utama

- `src/features/conversation/actions.ts`
- `src/features/conversation/lib/session-guard.ts`
- `src/features/conversation/lib/provider/`
- `src/app/(public)/conversation/`
- `src/app/(public)/speaking/`
- `src/app/api/conversation/[sessionId]/turn/route.ts`
- `src/constants/index.ts`
