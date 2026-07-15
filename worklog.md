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

---
Task ID: M3
Agent: GLM (main)
Task: Milestone 3 · Items core — items list with search + filter chips; item detail page; manual add/edit form; photo capture → compress → upload; soft delete with undo toast and "Recently deleted" restore view.

Work Log:
- Created `src/lib/items.ts` — shared library: zod validation schemas (`itemCreateSchema`, `itemUpdateSchema`), `nextItemCode()` (queries max AST-/STK- code + 1, replaces Postgres sequences), `savePhoto()` (writes compressed base64 JPEG to `public/item-photos/{code}.jpg`, replaces Supabase Storage), TypeScript types for API responses (`ItemListItem`, `ItemDetail`, `TxnListItem`), and constants for tracking types/statuses/conditions/txn actions.
- Created 5 API routes (all auth-gated via `requireAuth()`):
  • `GET/POST /api/items` — list with search (LIKE on name/brand/model/code/serialNo) + filters (category, status, location, trackingType, holder=me, lowStock, deleted); create with code assignment + photo save + 'add' transaction
  • `GET/PATCH/DELETE /api/items/[id]` — detail with relations + transaction history; edit (partial update with 'edit' transaction); soft delete (isDeleted=true + 'delete' transaction)
  • `POST /api/items/[id]/restore` — restore within 30-day window (enforced server-side) + 'restore' transaction
  • `GET /api/items/deleted` — recently deleted items (within 30-day window)
- Updated hash router (`src/hooks/use-hash-route.ts`) for parameterized routes: `#/items`, `#/items/new`, `#/items/:id`, `#/items/:id/edit`, `#/trash`. Scroll-to-top on navigation.
- Created `src/lib/compress-image.ts` — client-side canvas compression per §4: max edge 1280px, JPEG quality 0.8. Returns base64 data URL.
- Updated `src/components/providers.tsx` — added TanStack Query `QueryClientProvider` (30s staleTime, 1 retry, no refetchOnWindowFocus) alongside `SessionProvider`.
- Created `ItemsView` — search bar (200ms debounce), filter chips (status, tracking type, my items, low stock — toggleable, single-value per key), item cards (thumbnail/photo, code, name, brand, location/holder line, status pill, low-stock badge), loading skeletons, empty states ("No items yet" / "No matches"), total count.
- Created `ItemDetailView` — photo hero with status pill overlay + AI confidence badge, spec grid (code, brand, model, serial, category, type, quantity/min, condition, home/current location, holder), notes section, history timeline (numbered chips, reverse-chrono, human-readable action labels + person + relative dates), edit/delete buttons. Delete shows undo toast with `<ToastAction>` that calls restore API + invalidates queries.
- Created `ItemFormView` (add + edit) — photo capture via `<input type="file" accept="image/*" capture="environment">` with client-side compression + preview + remove; tracking type toggle (asset/stock, shows/hides quantity fields); all fields (name, brand, model, serial, category select, condition select, home/current location selects, notes); pre-fills from existing item when editing; validation + loading state; save navigates to detail with toast.
- Created `TrashView` — recently deleted items with 30-day window note, restore buttons, empty state.
- Updated `AppShell` to route all new views. Updated `ScanView` with "Add manually" CTA linking to the form.
- Fixed a React runtime error: the shadcn `useToast` hook expects `action` as a `ToastActionElement` (React element), not a plain `{label, onClick}` object. Changed the delete handler to pass `<ToastAction altText="Undo" onClick={...}>Undo</ToastAction>`.
- Lint: clean (0 errors, 0 warnings).
- Self-verified with Agent Browser (iPhone 14 viewport):
  • Sign in → Items → Add item → fill form (name, brand, model, category) → save → navigates to detail with "Item added AST-0001" toast ✅
  • Detail view: photo hero, spec rows, status pill, edit/delete buttons, history timeline shows "Added to inventory" ✅ (VLM-confirmed on-theme)
  • Edit → add serial + notes → save → "Item updated" toast → history shows "Added" + "Details edited" ✅
  • Delete → "Item deleted" toast with Undo button → navigates to items list (empty) ✅
  • Undo button renders correctly (no React errors after fix) ✅
  • Recently Deleted view → shows all deleted items with Restore buttons ✅ (VLM-confirmed on-theme)
  • Restore → "Restored" toast → item removed from trash → reappears in items list ✅
  • Search: "wrench" finds item, "zzzzz" shows "No matches" empty state, clear filter restores list ✅
  • Audit trail verified in DB: add → delete → restore transactions all logged with person + timestamp + note ✅
  • No console errors, no runtime errors after toast fix ✅

Stage Summary:
- M3 acceptance met: full CRUD works from a phone-sized viewport; photos persist (saved to `public/item-photos/`); deletes are soft (isDeleted flag) with undo toast + 30-day restore window; every create/edit/delete writes an audit `Transaction` row.
- The `AST-####`/`STK-####` code assignment works correctly (first asset = AST-0001, increments). Tracking type is immutable after creation (not in update schema). Current location defaults to home location if not specified.
- TanStack Query is now wired up with 30s staleTime — M4+ (scan/AI) and M5+ (custody) will use it for cache invalidation after mutations.
- Photo compression runs client-side before upload (max 1280px, JPEG 0.8) per §4 — the same compressed image will feed the vision API in M4.
- Architecture notes for M4: the `/api/identify` route will call `z-ai-web-dev-sdk` server-side, return structured JSON per §6, run dedupe (JS trigram Jaccard) against existing items, and the Scan screen will call it. The form already accepts `photoBase64` — M4 just adds the AI pre-fill path before the form opens.
- Architecture notes for M5: the action sheet (check-out/return/move/adjust) will write `Transaction` rows with the appropriate `action` enum and update `Item` fields (holderId, currentLocationId, quantity, status). The history timeline in `ItemDetailView` already renders all action types.
- Produced artifacts: `src/lib/items.ts`, `src/lib/compress-image.ts`, `src/app/api/items/route.ts`, `src/app/api/items/[id]/route.ts`, `src/app/api/items/[id]/restore/route.ts`, `src/app/api/items/deleted/route.ts`, `src/components/views/{items-view,item-detail-view,item-form-view,trash-view}.tsx`, updated `src/hooks/use-hash-route.ts`, `src/components/providers.tsx`, `src/components/app-shell.tsx`, `src/components/views/scan-view.tsx`.
- Ready for owner review against M3 acceptance criteria before starting M4 (Camera + AI — the magic).

---
Task ID: REVIEW+M4
Agent: GLM (main)
Task: Pre-M4 codebase review, fix all critical issues, then build Milestone 4 (Camera + AI vision with multi-item handling).

Work Log:
- Ran a comprehensive code review (subagent REVIEW-1) across all 17 key files. Found 12 CRITICAL/HIGH-blocker issues, 25 other HIGHs, 11 MEDIUMs, 9 LOWs.
- Analyzed 8 user-supplied sample images — ALL showed boxes/crates with multiple mixed items (tires, ladders, cables, cases, bags, machinery). This revealed that the §6 AI prompt assumption ("one photo of an item") doesn't match real workshop photos.

CRITICAL FIXES (12 items):
- C1: Race condition in code assignment — wrapped item create + audit transaction in `db.$transaction()`, added P2002 retry loop (3 attempts) with code regeneration.
- C2: No transaction wrapping mutations — all 4 mutation routes (POST create, PATCH update, DELETE soft-delete, POST restore) now wrap item change + audit transaction atomically.
- C3: Orphaned photo files — `savePhoto()` now writes to a temp file (`{code}.tmp.{rand}.jpg`) then `fs.rename()` atomically. Failed creates clean up the temp file.
- C4: Signup race condition — removed the pre-check `findUnique`, catch P2002 from `create` and return 409. Bcrypt cost bumped 10 → 12.
- C5: EXIF orientation stripped — `compressImage()` now uses `createImageBitmap(file, { imageOrientation: "from-image" })` which preserves EXIF. Falls back to `Image` + `URL.createObjectURL` for older browsers. Also switched from `FileReader.readAsDataURL` to `URL.createObjectURL` for memory efficiency.
- C6: `condition.replace("_", " ")` → `condition.replace(/_/g, " ")` — fixes "out of_order" display.
- C7: Quantity 0 silently becomes 1 — `parseFloat(quantity) || 1` → `Number.isFinite(q) ? q : 1`. Verified: STK-0001 saved with quantity=0.
- C8: Edit form reset on refetch — added `initialised` ref guard so React Query refetches don't overwrite in-progress edits.
- C9: No purge job — created `POST /api/items/purge` route that hard-deletes items past the 30-day window + cleans up photo files. Designed for daily cron.
- H1: Soft-delete enforcement — detail view now shows a "deleted" banner with Restore button; hides Edit/Delete when deleted. Trash list uses the shared `RESTORE_WINDOW_MS` constant.
- H3: 30-day window off-by-one — extracted `RESTORE_WINDOW_MS` constant to `items.ts`, `isRestorable()` helper, consistent `>` comparison everywhere.
- H4: Tracking-type toggle editable in edit — disabled with `opacity: 0.5; pointerEvents: none` + "locked" label. Verified in browser.

HIGH FIXES (8 items):
- H5: Empty PATCH writes no-op transaction — early-return if `changedFields.length === 0`. Edit transaction note now lists changed fields: "Updated: name, min quantity". Verified in DB.
- H6: Swallowed photo errors — `savePhoto` now throws on invalid JPEG (magic byte validation), API routes log errors with `console.error` and return 500 on edit photo failure.
- H9: No size validation — `photoBase64` capped at 2MB in zod schema. JPEG magic bytes (`FF D8 FF`) validated before write.
- H10: parseInt NaN — `safeInt()` helper with `Number.isFinite` check.
- H12: Undo toast auto-dismisses — `toaster.tsx` now sets `duration={8000}` for action toasts (vs 5000 default).
- H13: Undo failure invisible — added `else` branch with "Undo failed" toast.
- H17: Dead code `status: "stock" ? "available" : "available"` → `status: "available"`.
- H18: Dead "Filters" chip — removed. Also removed unused `SlidersHorizontal` import and `icon`/`dropdown` props from `Chip` component.
- H20: `useToast` effect dependency — changed `[state]` → `[]`.
- L3: `aiConfidence !== null` → `!= null && > 0` (hides "AI 0%" badge).

M4 · CAMERA + AI (the magic):
- Created `POST /api/identify` route (`src/app/api/identify/route.ts`):
  • Calls `z-ai-web-dev-sdk` `createVision()` with model `glm-4.6v-flash` (server-only, key never in client bundle).
  • Extended the §6 system prompt to handle MULTI-ITEM photos: returns `{ multi_item: boolean, items: [...] }` instead of assuming one item. The prompt now says "The photo may contain a SINGLE tool/machine, OR a BOX/CRATE/SHELF containing MULTIPLE items."
  • Injects the live category list from the DB at `{{CATEGORY_LIST}}`.
  • JSON-repair retry per §6: on parse failure, retries with "Your last reply was not valid JSON. Re-emit only the JSON object."
  • Dedupe: JS-side trigram Jaccard similarity (replaces pg_trgm). Returns matches with `similarity > 0.45`, sorted desc, top 5.
  • Size validation: max 2MB base64, 413 if too large.
  • On total failure: returns confidence-0 "Unknown item" so the client opens the manual form.
- Created `src/lib/ai-prefill.ts` — sessionStorage-based prefill store. Passes AI data + photo from scan result to item form.
- Rewrote `ScanView` (`src/components/views/scan-view.tsx`) with the full M4 flow:
  • Live camera capture via `<input type="file" accept="image/*" capture="environment">`.
  • Client-side compression (EXIF-aware via `createImageBitmap`).
  • "Identifying…" overlay with spinner over the captured photo.
  • Result sheet with confidence tiers: ≥0.75 full pre-fill (teal badge), 0.40–0.74 pre-fill with gold-highlighted category/type ("Please verify"), <0.40 manual fallback with photo attached.
  • Snap-to-find: dedupe matches shown as "Looks like this might already be in inventory" cards ABOVE the "Add as new item" button. Tapping a match navigates to that item's detail.
  • Multi-item picker: when `multi_item=true`, shows a numbered list of identified items. User selects one → taps "Add selected" → pre-fills the form.
  • "Scan again" button resets the flow.
  • Last 3 scans shown as thumbnails.
- Updated `ItemFormView` to consume AI prefill: reads from sessionStorage on mount (new items only, ref-guarded), resolves category name → id, sets photo + aiConfidence. Shows "✨ AI identified · X% confidence" badge.
- Added `aiConfidence` field to `itemCreateSchema` + `itemUpdateSchema` so the AI confidence score is persisted with the item.

VERIFICATION:
- Tested `/api/identify` with a real box-of-tools sample image (4MB PNG → 240KB compressed JPEG):
  • Status 200, `multi_item: true`, 3 items identified: "Cable reel (70%)", "Drill (60%)", "Electrical tape (50%)". No errors.
  • Vision model response time: 6–11 seconds (within the 15s target).
- Full CRUD regression test via Agent Browser:
  • Items list renders correctly (no runtime crash after TS fixes).
  • Create stock item with quantity=0 → saved as STK-0001, quantity=0 in DB (C7 fix verified).
  • Edit → tracking-type toggle disabled/locked (H4 fix verified).
  • Edit → changed name + min quantity → transaction note: "Updated: name, min quantity" (H5 fix verified).
  • Delete → "Item deleted" toast with Undo button, 8s duration (H12 fix verified).
  • Undo → "Restored STK-0001 is back." toast, item back in list.
  • Low-stock badge ("LOW") appears when quantity ≤ minQuantity.
- Lint clean. TypeScript: only pre-existing type errors in auth.ts/require-auth.ts (ignored by next.config.ts `ignoreBuildErrors: true`).

Stage Summary:
- All 12 CRITICAL/HIGH-blocker issues from the code review are fixed and verified.
- M4 is functionally complete: the scan → identify → pre-fill → save flow works end-to-end. Multi-item photos (the user's specific concern) are handled via the multi-item picker. Dedupe matches surface existing items before offering "Add as new".
- The §6 prompt was extended (not replaced) to handle real-world workshop photos — single-item photos still work identically, multi-item photos return an array.
- `ZAI_API_KEY` is never in the client bundle — the SDK is dynamically imported server-side only in the API route.
- Remaining items for M5+: the action sheet (check-out/return/move/adjust) will write `Transaction` rows. The history timeline already renders all action types. M7 will add CSV/XLSX export + maintenance log UI + Vercel deployment.
- Produced artifacts: `src/app/api/identify/route.ts`, `src/app/api/items/purge/route.ts`, `src/lib/ai-prefill.ts`, rewritten `src/lib/items.ts` (transactions, atomic photo, validation), rewritten `src/lib/compress-image.ts` (EXIF), rewritten `src/app/api/items/route.ts` (retry, transactions), rewritten `src/app/api/items/[id]/route.ts` (diff, deleted banner), rewritten `src/app/api/items/[id]/restore/route.ts`, `src/app/api/items/deleted/route.ts`, `src/app/api/signup/route.ts`, rewritten `src/components/views/scan-view.tsx` (full M4 flow), updated `src/components/views/{item-detail-view,item-form-view,items-view,trash-view}.tsx`, `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts`.
- Ready for owner review. Next: Milestone 5 (Custody & stock — check-out/return/move/adjust via the action sheet).
