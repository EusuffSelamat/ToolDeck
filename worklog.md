# TOOLDECK — Shared Worklog

This file is the single source of truth for milestone progress across all agents.
Append a new section (starting with `---`) for each Task ID. Do not overwrite.

---
Task ID: M1
Agent: GLM (main)
Task: Milestone 1 · Foundation — Next.js + TS + Tailwind scaffold with the §10 token file; auth (sign-up/login/logout); protected routes; PWA manifest + icons + service worker; dark shell with bottom nav.

Work Log:
- Read the full build pack (`upload/tooldeck-glm-build-pack.md`); confirmed 5-bullet understanding and got owner sign-off on 6 adapting decisions (Supabase→Prisma/SQLite + NextAuth credentials; z-ai-web-dev-sdk for vision; preview-panel + real-phone PWA install; custom §10 theme; hash-based routing under single `/` route).
- Adapted §5 `profiles`+`auth.users` to a single Prisma `User` model (`id, email, fullName, passwordHash, createdAt, updatedAt`) — SQLite. Full §5 schema deferred to M2.
- Installed `bcryptjs` + `@types/bcryptjs`; generated `NEXTAUTH_SECRET`; ran `db:push`.
- Wired NextAuth v4 credentials provider (`src/lib/auth.ts`) with JWT sessions, `trustHost: true`, callbacks injecting `id`/`name` into the session token.
- API routes: `src/app/api/auth/[...nextauth]/route.ts` (auth handler) and `src/app/api/signup/route.ts` (zod-validated account creation, bcrypt hash, duplicate-email guard).
- `src/components/providers.tsx` wraps the app in `SessionProvider`.
- Rewrote `src/app/globals.css` with the exact §10 tokens via Tailwind v4 `@theme` (`--color-bg-0`, `--color-teal`, `--color-gold`, `--color-magenta`, `--color-text-hi/mid/low`, `--font-display/sans`, `--radius-card/pill`) and remapped the shadcn semantic tokens onto the dark teal palette. Component primitives: `.glass-card`, `.glass-strong`, `.glass-selected` (gold), `.btn-teal`, `.btn-ghost-teal`, `.status-pill`, `.micro-label`, `.num-chip`, `.glow-ring`, `.pulse-live` (2.4s). `prefers-reduced-motion` respected.
- Fonts: Space Grotesk (display) + Inter (body) via `next/font/google`, variables on `<html>`; `<html className="dark">` forces dark mode.
- `PlexusBackground` — fixed full-viewport edge-biased constellation SVG (nodes + lines) at ~6% opacity with radial vignette + top/bottom fades (never behind dense text).
- `BrandMark` — two-tone "TOOL**DECK**" wordmark with a scan-frame glyph + corner brackets; `StatusPill` — dot+label per §10 status colours.
- `useHashRoute` hook — hash-based router (`#/`, `#/items`, `#/scan`, `#/locations`, `#/activity`) with `hashchange` listener + `navigate()`. Keeps back/forward/refresh working under the single exposed `/` route.
- `AuthScreen` — glass card on plexus: Sign in / Create account toggle, name/email/password fields with icon prefixes, teal primary button, inline error states, loading spinner, success toast.
- `TopBar` — sticky glass-strong bar: BrandMark left, search + account dropdown (initials avatar → name/email + Sign out) right.
- `BottomNav` — fixed glass-strong 5-slot nav with raised centre SCAN button (teal glow ring + 2.4s pulse). Active tab = teal icon + label; inactive = text-low. Safe-area inset respected.
- `AppShell` — `min-h-screen flex flex-col` wrapper: TopBar + `<main>` (max-w-md centred, `pb-24` to clear nav) + BottomNav.
- Five M1 views: `DashboardView` (stat-pill skeletons + radar placeholder + needs-attention card), `ItemsView` (empty-state "No items yet — tap Scan to add your first" + Scan CTA), `ScanView` (hero: camera viewport with teal corner brackets + scan-line, rotating tip line, glowing shutter, 3 empty last-scan thumbnails), `LocationsView`, `ActivityView` (on-brand placeholders noting their target milestone).
- `src/app/page.tsx` — auth gate: `useSession()` → loading spinner / `AppShell` / `AuthScreen`.
- PWA: `public/manifest.webmanifest` (standalone, portrait, teal theme, any + maskable icons); `public/sw.js` (app-shell cache, network-first navigations, SWR for static assets, never caches `/api/*`); `public/offline.html`; `SWRegister` client component. Icons generated via `scripts/gen-icons.ts` (sharp) — 192/512 any + maskable + 180 apple-touch.
- Lint: clean (`bun run lint` → no errors).
- Self-verified with Agent Browser (iPhone 14 viewport): auth screen renders (VLM-confirmed on-brand dark teal glass); signup → signed in → shell renders with toast; all 5 tabs navigate via hash routes; Scan hero + Dashboard VLM-confirmed on-theme with no bugs; sign-out → auth screen; re-login with persisted credentials → success; back-button routing works; desktop 1280px → centred column + fixed bottom nav (VLM-confirmed). No console errors, no hydration warnings. Manifest/SW/icons all serve 200.

Stage Summary:
- M1 acceptance met: sign-up works on a phone-sized viewport; PWA is installable (manifest + SW + maskable icons served over the gateway's HTTPS); the dark shell matches the §10 tokens exactly (VLM-verified).
- Architecture decisions for future milestones: `User.id` (cuid) will stand in for `profiles.id` in M2's `items.holder_id` / `created_by` / `transactions.person_id`. Photos will use a local `public/item-photos/` folder (decision 1a) in M3/M4. Vision route will use `z-ai-web-dev-sdk` server-side in M4.
- Single `/` route + hash router is in place; later milestones add `#/items/:code`, `#/settings`, etc. without architectural change.
- Produced artifacts: `prisma/schema.prisma` (User only), `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/signup/route.ts`, `src/app/globals.css` (§10 tokens), `src/components/{providers,plexus-background,brand-mark,status-pill,top-bar,bottom-nav,app-shell,auth-screen,sw-register}.tsx`, `src/components/views/{dashboard,items,scan,locations,activity}-view.tsx`, `src/hooks/use-hash-route.ts`, `src/app/{layout,page}.tsx`, `public/{manifest.webmanifest,sw.js,offline.html,icons/*}`, `scripts/gen-icons.ts`, `.env.local`.
- Ready for owner review against M1 acceptance criteria before starting M2 (Database).
