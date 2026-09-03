# Project-Specific Architecture & Rules

## 1. Tech Stack Summary

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Database | PostgreSQL (Supabase) via Prisma |
| File storage | Cloudinary (audio/images; DB stores URLs only) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | React Context |
| Auth | Custom credential + Google OIDC: `bcryptjs` + `jose`, Redis session registry/state, dan token PostgreSQL |
| Validation | `zod` (single source of truth for all input schemas) |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` |

Do NOT introduce other libraries for these concerns (e.g., NextAuth/Auth.js, Redux, axios, styled-components) without explicit approval.

## 2. Modular Folder Structure
* Maintain a modular and feature-driven folder structure.
* Separate global/generic UI building blocks (`./src/components/ui`) from feature-specific logic.
* Group components, hooks, and local state by feature (e.g., inside `./src/features/[feature-name]`) to encapsulate logic and maintain scalability.

## 3. UI Components & shadcn/ui
* **Location:** `./src/components/ui`
* Always check for and utilize existing shadcn/ui components before creating new custom components.
* Prefer utilizing existing hooks from the shadcn ecosystem (e.g., `use-toast`, `use-form`) for standard UI behaviors.
* When extending or overriding shadcn component styles, always use the `cn()` utility to prevent Tailwind class conflicts.

## 4. Authentication & Session
The product target is public multi-user registration. Credential auth dan Google OIDC aktif;
provider OAuth lain, MFA, dan role hierarchy tetap memerlukan persetujuan terpisah.

* **Login identifier:** user baru login dengan normalized email. Akun legacy yang belum memiliki email tetap dapat login dengan `username` sampai flow pengisian email tersedia.
* **Password hashing:** `bcryptjs` with cost factor 12. Hash on register and compare with `bcrypt.compare()` on login. `User.password` nullable hanya untuk akun OAuth-only yang belum membuat password. NEVER store or log plaintext passwords.
* **Session:** JWT signed with `jose` (HS256, secret from `SESSION_SECRET`) menyimpan `userId` dan `sessionId` dalam cookie **httpOnly, secure, sameSite=lax** bernama `session`. Expiry tetap 7 hari. Metadata serta status revocation session disimpan di Redis; JWT tidak boleh diterima jika registry Redis tidak dapat mengonfirmasi session tersebut.
* **Session helpers location:** `./src/lib/auth.ts` — seluruh pembuatan, pembacaan, daftar perangkat, dan revocation session wajib melalui helper di file ini. Jangan membaca cookie atau memanipulasi key session Redis secara manual dari feature lain.
* **Session revocation:** password reset dan perubahan password mencabut semua session lama. Logout perangkat lain menghapus `sessionId` target dari Redis. `sessionVersion` tidak digunakan selama registry Redis menjadi sumber kebenaran revocation.
* **Email lifecycle:** register credential baru tidak membuat session sebelum email dikonfirmasi. Token verifikasi dan reset password disimpan sebagai SHA-256 hash di `AuthToken`, memiliki expiry, maksimal satu token aktif per user/purpose, dan dikonsumsi melalui Server Action POST; jangan mengonsumsi token melalui GET. Email akun immutable; purpose/column email-change legacy tidak boleh dipakai runtime baru.
* **Google OAuth:** gunakan Authorization Code + PKCE S256, state yang terikat cookie, nonce, verifikasi ID token melalui JWKS, dan Google `sub` sebagai identity stabil. Transaction serta proof reauthentication bersifat sekali pakai dan disimpan di Redis dengan TTL. Jangan menyimpan access token atau refresh token Google.
* **OAuth linking:** login/register Google hanya membuat user baru bila normalized verified email belum terdaftar. Jika email sudah dimiliki akun credential tetapi identity Google belum terhubung, callback wajib menolak dan mengarahkan user untuk login dengan password lalu connect dari profile. Connect dari profile wajib memakai email yang sama persis. Akun OAuth-only wajib reauthenticate ke Google sebelum membuat password atau menjalankan account lifecycle sensitif.
* **Email delivery:** semua email auth dikirim server-side melalui Nodemailer. Cooldown pengiriman disimpan di Redis dan selalu diverifikasi ulang di server; countdown client hanya representasi UI.
* **Route protection:** `src/proxy.ts` (the `middleware.ts` convention was renamed to `proxy.ts` in this Next.js version) guards protected routes. No valid session redirects to `/login?next=<internal-path>`. This is an optimistic check only; protected layouts and Server Actions MUST verify session and ownership again.
* **Registration:** public registration aktif melalui credential (display name, normalized email, password, dan konfirmasi password) atau Google. Tidak ada first-time setup atau `count(User)` lock. Unique constraint email dan OAuth identity menjadi duplicate guard terakhir.
* **Auth rate limit:** login dan register memakai bucket atomik di `AuthRateLimit`. Key disimpan sebagai HMAC-SHA256, bukan email atau alamat IP mentah.
* **Bot protection:** seluruh form publik di route group `(auth)` wajib memakai Cloudflare Turnstile. Token harus diverifikasi server-side melalui Siteverify sebelum query database, pengiriman email, atau konsumsi rate-limit; cocokkan `action` dan hostname, lalu tolak secara fail-closed jika layanan verifikasi gagal.
* **Data isolation:** every query for attempts, comments, history, progress, settings, and future user content MUST scope access to `session.userId`.
* **Login safety:** on failed login, return a generic error message ("invalid credentials"), never reveal whether the email/username exists.
* **Supabase Data API:** tabel aplikasi pada schema `public` tidak boleh diberi grant ke `anon`, `authenticated`, atau `service_role`. RLS aktif tanpa client policy karena akses aplikasi hanya melalui Prisma server-side.

## 5. Input Validation (zod)
* Every Server Action MUST validate its input with a `zod` schema before touching the database. Never trust client data, including "internal" calls.
* Schemas live next to their feature (e.g., `./src/features/exam/schemas.ts`) and are shared between the form (client) and the action (server) — define once, use on both sides.
* Forms use `react-hook-form` with `zodResolver`; do not hand-roll form state for standard forms.

## 6. Server Actions & Caching
* Use Server Actions for both data fetching (`get`) and data mutations (`mutate`).
* **Caching for 'get' actions:** Implement caching for data-fetching Server Actions using Next.js caching mechanisms (such as `unstable_cache` with tags).
* **Centralized Cache Keys:** All cache keys and tags MUST be defined in `./src/constants/cache-key.ts`. Never hardcode cache key strings inside actions. This ensures easy invalidation (e.g., via `revalidateTag`) from a single source of truth.
* **Data leak guard:** actions that serve exam-mode data MUST NOT include `questionAnswer` or `explanation` in their return payload (see `database.md`). Use explicit Prisma `select` — never return full models by default.

## 7. Environment Variables & Constants
* **Location:** `./src/constants/index.ts`
* NEVER access `process.env.YOUR_VARIABLE` directly inside UI components, hooks, or business logic.
* All environment variables and global constants MUST be recalled, validated, and exported from `./src/constants/index.ts`.
* Required env vars: `APP_URL`, `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, konfigurasi Cloudinary, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_PREFIX`, konfigurasi SMTP, serta `CLOUDFLARE_TURNSTILE_SITEKEY` dan `CLOUDFLARE_TURNSTILE_SECRETKEY`. `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` harus diisi berpasangan untuk mengaktifkan Google OAuth. `CRON_SECRET` wajib di deployment yang menjalankan cleanup cron. Validate presence at startup (zod schema in the constants file); fail fast with a clear error if missing.
* NEVER expose server-only secrets to the client (no `NEXT_PUBLIC_` prefix on secrets).

## 8. State Management
* **Tool:** React Context.
* Use React Context for shared or global state management within features or the application.
* Isolate context providers to the lowest possible component tree level to prevent unnecessary re-renders.
* **Exam state:** in-progress answers/flags live in a feature-level context and are persisted to `sessionStorage` (survive refresh), committed to DB only on session submit (see `project-overview.md`).

## 9. Styling (Tailwind CSS v4)
* Use Tailwind CSS v4 standard utility classes and rely on the CSS-first configuration approach.
* Respect the CSS variables defined by the shadcn/ui setup for theming and color consistency.

## 10. Database & ORM (Prisma)
* Ensure the Prisma Client is instantiated using a singleton pattern in a dedicated utility file (`./src/lib/prisma.ts`) to prevent exhausting database connections during development hot-reloads.
* Schema rules, Japanese text markup, and query rules are defined in `database.md` — read it before writing any database code.

## 11. Verification & General Guidelines
* **TypeScript:** Keep strict typing enabled. The `any` type is prohibited, including explicit
  annotations, `as any` casts, generic arguments, and implicit `any`. Data from cookies, request
  bodies, external services, JSON, or other untrusted sources must start as `unknown` and be
  validated or narrowed before use. Do not disable the related TypeScript/ESLint rule to bypass an
  error; define the correct type or add runtime validation instead.
* **Build Verification:** Always run `npm run build` after making structural changes or modifying server actions/caching logic to verify the build integrity and catch errors early.
