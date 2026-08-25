# Fase 1 - Route Architecture dan Design Foundation

Tanggal selesai: 26 Agustus 2026

## Hasil

Fase 1 mengubah entry point aplikasi dari redirect putih menjadi home publik neo-brutalist yang
mengikuti bahasa visual `reference_ui_web`. Marketing, auth, dan dashboard sekarang memiliki shell
terpisah sehingga header/footer publik tidak masuk ke flow ujian existing.

### Route dan shell

- Menambah route group `(marketing)` dengan home publik `/`.
- Menambah `PublicHeader`, mobile Sheet navigation, `PublicFooter`, `BrandMark`, dan `PageContainer`.
- Menambah skip link pada shell marketing dan auth.
- Menghapus page redirect-only lama pada `(auth)/page.tsx`.
- Menghapus `/first-time-setup` dan mengarahkan URL lamanya secara permanen ke `/register`.
- Menambah `/register` sebagai route publik non-mutating untuk memvisualkan kontrak form Fase 2.
- Mempertahankan dashboard dan seluruh exam flow di shell protected existing.

### Design foundation

- Mengganti token shadcn neutral menjadi palette reference: pale blue, white, cobalt, coral,
  yellow, green, dan ink black.
- Menambah hard offset shadow, border tiga pixel, radius kecil, pressed state, grid-paper surface,
  typography scale, dan utility neo-brutalist shared.
- Mempertahankan seluruh semantic variable shadcn agar komponen existing tetap kompatibel.
- Menambah page-load reveal ringan dan fallback `prefers-reduced-motion`.
- Mengubah document language menjadi Bahasa Indonesia dan memberi `lang="ja"` pada aksen Jepang.
- Menambah metadata route home/login/register dan Open Graph text metadata untuk home.

### Auth transition

- Login existing tetap memakai username agar user lama dan attempt miliknya tidak rusak.
- Login menerima `next` dan memvalidasinya sebagai internal relative path sebelum redirect.
- Proxy meneruskan pathname dan query protected route ke `/login?next=...`.
- Logic one-time registration dan `count(User)` lock telah dihapus.
- Public registration mutation belum diaktifkan. Fase 2 harus lebih dahulu:
  - menambah display name dan normalized email tanpa mengarang email user existing;
  - menetapkan backfill/migration akun lama;
  - mencabut privilege `anon`/`authenticated` atau mematikan Supabase Data API;
  - menambah duplicate handling dan rate limit.

## Verifikasi

Perintah yang lolos:

- `npm run lint`
- `npx next typegen`
- `npx tsc --noEmit`
- `npm run build`
- `git diff --check`

Smoke test local:

| Route | Hasil |
|---|---|
| `/` | `200` publik, hero neo-brutalist ter-render |
| `/login` | `200` publik |
| `/register` | `200` publik, tidak melakukan mutation |
| `/first-time-setup` | `308` ke `/register` |
| `/dashboard` tanpa session | `307` ke `/login?next=%2Fdashboard` |
| `/test-package?id=x` tanpa session | `307` ke safe encoded `next` |

Browser in-app tidak tersedia pada environment saat verifikasi, sehingga screenshot desktop/mobile
belum dapat diambil. Source preflight tetap memverifikasi mobile breakpoints, menu Sheet, visible
focus, contrast CTA, reduced motion, min-height dynamic viewport, route hidup, dan tidak adanya
visible em dash pada surface baru.

Hydration warning yang terlihat pada dev log berasal dari atribut `bis_*` yang disuntikkan browser
extension pada DOM, bukan dari output aplikasi.

## Acceptance criteria

- [x] `/` dapat dibuka tanpa session.
- [x] Dashboard/exam tidak mendapat header/footer marketing.
- [x] Protected route tetap tidak dapat dibuka tanpa session.
- [x] Mobile menu memiliki implementasi nyata, bukan placeholder.
- [x] Focus state dan reduced-motion fallback tersedia.
- [x] First-time setup tidak lagi menjadi model registrasi.
- [x] Tidak ada migration atau user row baru pada fase ini.

## Lanjut ke Fase 2

Fase 2 dapat dimulai setelah review visual manual singkat. Fokus berikutnya adalah menyelesaikan
home narrative, mengaktifkan register multi-user secara aman, mengganti login dari username ke email,
menambah show/hide password, dan menutup blocker Supabase sebelum endpoint register dibuka.
