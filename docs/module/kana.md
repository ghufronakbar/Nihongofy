# Modul Kana

## Status Aktual

**Selesai untuk pengenalan dan self-review dasar.** Hiragana dan katakana berasal dari fixture terkurasi; aktivitas user disimpan sebagai counter per kartu.

## Route

- `/kana/hiragana`
- `/kana/katakana`

## Fitur Aktif

- Grid gojuon dengan 46 karakter dasar per script.
- Pencarian berdasarkan karakter, romaji, dan variasi bunyi.
- Filter kelompok bunyi.
- Flip card dan romaji.
- Dakuten/handakuten ditampilkan sebagai variasi pada kartu terkait.
- Mode review dengan rating `AGAIN` dan `CORRECT`.
- TTS bahasa Jepang melalui Web Speech API browser.

## Data dan Persistence

- Konten kana adalah fixture kode di `src/features/kana/data/kana.ts`, bukan tabel content database.
- Untuk user login, `KanaProgress` menyimpan `viewCount`, `correctCount`, `againCount`, dan timestamp.
- Untuk guest, UI tetap bisa dipakai tetapi data hanya hidup di state halaman dan hilang saat refresh.
- Data progress divalidasi terhadap daftar stable `kanaKey` yang dikenal aplikasi.

## Keterbatasan Aktual

- Bukan SRS: tidak ada due date, interval, random queue, atau jadwal review.
- Tidak ada latihan menulis/drawing, recognition quiz, digraph yoon seperti `きゃ`, atau kata contoh.
- Audio bukan file rekaman; kualitas dan ketersediaan bergantung pada voice browser/device.
- Variasi dakuten/handakuten bukan kartu mandiri, sehingga progress dan audio tidak dapat dinilai per variasi.
- Update progress di UI bersifat optimistik dan hasil error action tidak ditampilkan kembali kepada user.
- Progress hanya counter agregat dan belum masuk ke modul Analytics/Progress utama.

## File Utama

- `src/features/kana/data/kana.ts`
- `src/features/kana/actions.ts`
- `src/features/kana/components/kana-page.tsx`
- `src/features/kana/components/kana-study-grid.tsx`
- `src/features/study/lib/tts.ts`
