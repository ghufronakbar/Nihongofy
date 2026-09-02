# Release dan Incident Management

## Severity Bug

| Severity | Definisi | Contoh | Keputusan release | Target respons |
|---|---|---|---|---|
| P0 | Security/data corruption/answer leakage/hasil final salah atau layanan inti tidak dapat dipakai | Answer key terkirim sebelum submit, cross-user access, submit menghasilkan dua final state | Stop release, containment segera | Segera setelah terdeteksi |
| P1 | Core flow tidak reliable tetapi belum terbukti membocorkan/merusak data luas | Resume gagal, password recovery rusak, content penting salah | Release ditahan sampai owner menerima fix/risk | Hari kerja yang sama |
| P2 | Degradasi retention, insight, UX, atau edge case dengan workaround aman | Filter salah, empty state buruk, statistik non-kritis tertunda | Boleh release dengan issue dan owner | Dijadwalkan pada iterasi terdekat |
| P3 | Polish atau expansion non-core | Copy, animasi, fitur preview | Tidak memblokir release | Backlog terurut |

Naikkan severity bila blast radius, exploitability, atau ketidakpastian lebih tinggi dari perkiraan.
Jika ragu antara dua level untuk security atau correctness, gunakan level yang lebih tinggi sampai
triage selesai.

## Owner

Role owner berlaku sampai nama individu ditetapkan pada release/incident record.

| Area | Primary owner | Backup/escalation |
|---|---|---|
| Content incident | Content Owner (repository maintainer untuk saat ini) | Engineering Owner |
| Security/privacy incident | Security Owner (engineering maintainer untuk saat ini) | Database/Platform Owner |
| Availability/build/deploy | Engineering Owner | Database/Platform Owner |
| Release decision | Release Owner | Security Owner untuk veto security |

Incident tidak boleh berstatus tanpa owner. Orang yang pertama melakukan triage menjadi temporary
owner sampai handoff diterima secara eksplisit.

## Release Checklist

- [ ] Scope, known issue, dan owner perubahan terdokumentasi.
- [ ] `npm run verify` lulus pada commit yang akan dirilis.
- [ ] Catatan migration menyatakan required/not required; migration/seed/cache refresh sudah dijalankan.
- [ ] Checklist manual untuk seluruh flow terdampak sudah diserahkan dan hasil user dicatat.
- [ ] Audit answer-key leakage lulus bila query/action/cache soal berubah.
- [ ] Ownership/isolation dua user lulus bila data user-owned berubah.
- [ ] Error response generik, structured log tersedia, dan tidak ada secret/PII/answer key pada log.
- [ ] Tidak ada P0/P1 terbuka. P2/P3 yang diterima memiliki owner dan tindak lanjut.
- [ ] Release Owner mencatat keputusan `GO` atau `NO-GO` beserta waktu.

## Content Incident

1. Tandai severity dan paket/question/fixture yang terdampak; jangan menyalin kunci ke kanal publik.
2. Hentikan release atau akses ke konten terdampak sesuai severity.
3. Identifikasi source fixture, provenance, checksum/review note, dan attempt yang mungkin terdampak.
4. Koreksi fixture melalui review, jalankan validation existing, lalu seed dengan prosedur yang ada.
5. Jika answer key berubah, hitung dampak pada `AttemptAnswer.isCorrect` dan hasil historis sebelum
   membuka kembali konten.
6. Refresh/redeploy dan invalidasikan cache sesuai runbook content.
7. Jalankan ulang checklist exam/practice/result/leakage dan catat root cause serta pencegahan.

## Security Incident

1. Klasifikasikan sebagai P0 sampai scope dan exploitability diketahui; tunjuk Security Owner.
2. Contain surface terdampak: hentikan release, nonaktifkan route/credential/integration yang relevan,
   dan batasi akses database bila diperlukan.
3. Simpan event ID, waktu, route, dan log ter-redact. Jangan menyalin cookie, token, password,
   answer key, raw request body, atau data pribadi ke issue/chat.
4. Tentukan data/user/asset yang terdampak dengan query read-only dan ownership scope yang jelas.
5. Rotasi credential yang relevan. Rotasi `SESSION_SECRET` mencabut seluruh JWT existing; gunakan
   hanya sebagai containment sadar dampak sampai revocation granular tersedia.
6. Perbaiki root cause, jalankan audit dua user dan leakage, lalu `npm run verify`.
7. Release hanya setelah Security Owner dan Release Owner menyetujui hasil verifikasi.
8. Catat timeline, blast radius, keputusan, follow-up, dan kebutuhan notifikasi user tanpa memuat
   data sensitif.

