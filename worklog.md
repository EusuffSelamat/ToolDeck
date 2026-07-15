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

---
Task ID: M2
Agent: GLM (main)
Task: Milestone 2 · Database — full §5 schema (locations, categories, items, transactions, maintenance_logs) including RLS equivalent, sequences, trigram index adaptation, storage plan; seed §14 categories + one demo location.

Work Log:
- Extended `prisma/schema.prisma` from M1's single `User` model to the full §5 schema. Six tables total: `User`, `Location`, `Category`, `Item`, `Transaction`, `MaintenanceLog`. All foreign keys + named relations (disambiguating multiple FKs between the same model pairs, e.g. Item→User has "ItemHolder" + "ItemCreator").
- Adaptation notes (Supabase/Postgres → Prisma/SQLite, per decision 1a):
  • Postgres enums (`tracking_type`, `item_status`, `txn_action`) → Prisma `String` fields; validation moves to the API layer (zod schemas in M3+). SQLite doesn't support Prisma enums.
  • `numeric` → `Float` (adequate for inventory quantities at ≤2000-item scale).
  • `uuid` + `gen_random_uuid()` → Prisma `@default(cuid())`.
  • `timestamptz` / `date` → `DateTime`.
  • `pg_trgm` trigram index → not available in SQLite. Items list search will use `LIKE` on name/brand/model/code (M3, adequate at scale). Dedupe similarity() → JS-side trigram Jaccard function (M4, computed in the `/api/identify` route). Documented for future milestones.
  • Postgres sequences (`asset_code_seq`, `stock_code_seq`) → application-level code assignment: `nextItemCode()` queries the max existing `AST-`/`STK-` code and increments. To be implemented in M3's create-item API within a Prisma `$transaction` (SQLite transactions are serializable → safe at this scale).
  • Supabase RLS → API-layer auth gating via `requireAuth()` helper (`src/lib/require-auth.ts`). Every data-touching route calls it and returns 401 if no session. Authenticated users get full read/write (matching §5 RLS). No delete policy — soft delete only (`isDeleted=true`, `deletedAt=now()`).
  • Storage bucket `item-photos` → `public/item-photos/` folder (M3). "Public read" = served statically by Next.js; "authenticated write" = the upload API route requires a session.
- Added indexes on `Item` (trackingType, status, isDeleted, holderId, currentLocationId, categoryId), `Transaction` (itemId, action, createdAt, personId), `MaintenanceLog` (itemId, nextDue) for query performance.
- Ran `bun run db:push` — all 6 tables created. Existing 2 User accounts (1 from M1 testing + 1 from owner's phone testing) preserved.
- Created `scripts/seed.ts` — idempotent (upsert by unique key). Seeds the §14 category tree (12 categories with sort order 0–11) and one demo location ("Main Workshop", kind="site").
- Ran seed: 12 categories + 1 location confirmed.
- Created `src/lib/require-auth.ts` — `requireAuth()` returns the typed session or null; the RLS equivalent.
- Created `src/app/api/meta/route.ts` — `GET /api/meta` (auth-gated) returns `{ categories, locations }`. Serves as both the M2 verification endpoint and the data source for M3+ (category/location pickers in the Items form, Locations view, Settings).
- Lint: clean.
- Verification:
  • Anonymous `curl /api/meta` → 401 `{"error":"Unauthorized"}` ✅ (RLS equivalent proven)
  • Authenticated `fetch('/api/meta')` via Agent Browser (signed in as sarah@tooldeck.test) → 200 with `{categories: [12 items], locations: [1 item]}` ✅
  • Direct DB inspection: 6 tables, 2 users, 12 categories (Power Tools…Other), 1 location (Main Workshop/site), 0 items/transactions/maintenance (expected — data lands in M3+) ✅
  • Dev log clean, no runtime errors ✅

Stage Summary:
- M2 acceptance met (adapted): all §5 tables exist in SQLite; anonymous API requests are rejected (401); seeds (12 categories + 1 demo location) are present and queryable by authenticated users.
- The `requireAuth()` helper is the single chokepoint for all future API routes — M3+ routes just call it and return 401 if null.
- The `/api/meta` endpoint is ready for M3's Items form (category + location dropdowns) and the Locations/Settings views.
- Architecture notes for M3: item codes (`AST-####`/`STK-####`) assigned via `nextItemCode()` in a transaction; soft delete via `isDeleted` flag (never `db.item.delete()`); every create/update writes a `Transaction` row (audit trail); photos to `public/item-photos/` with the item code as filename.
- Produced artifacts: `prisma/schema.prisma` (full §5), `scripts/seed.ts`, `src/lib/require-auth.ts`, `src/app/api/meta/route.ts`.
- Ready for owner review against M2 acceptance criteria before starting M3 (Items core).
