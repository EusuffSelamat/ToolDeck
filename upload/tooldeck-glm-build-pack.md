# TOOLDECK — AI Build Pack v1.0
### Company Tools & Machinery Inventory · Snap-to-Identify
*Planning: Claude (Fable 5), July 2026 · Execution: GLM · Working name "TOOLDECK" — owner may rename.*

---

## 0 · How to use this document

**For the owner (human):**
1. Open a fresh GLM chat and paste this ENTIRE document.
2. Send: *"Read this build pack fully. Summarise your understanding in 5 bullets, ask any blocking questions, then wait for my go. We build one milestone at a time, starting with Milestone 1 (§11)."*
3. Review each milestone's output against its acceptance criteria before requesting the next.
4. Complete the Owner Setup Checklist (§13) in parallel — it takes about 15 minutes.

**For GLM (the builder) — standing rules:**
- You are acting as a senior full-stack engineer. Build exactly what this spec says; propose deviations only with a stated reason, and wait for approval before applying them.
- Generate complete, runnable code. No placeholders, no `// TODO`, no "add your logic here".
- All secrets live server-side in env vars. The vision API key must never appear in client code or the browser bundle.
- The UI theme in §10 is non-negotiable: use the exact tokens.
- Work milestone by milestone (§11). Do not skip ahead or merge milestones.
- UI language: English. Mobile-first: design for a phone screen first, desktop second.

---

## 1 · Product summary

TOOLDECK is an installable web app (PWA) for a company-wide tools & machinery inventory. The core interaction: **a staff member points their phone camera at any item, and AI identifies it** — either creating a pre-filled new record, or recognising it as an existing item and offering actions (check out, return, move, update condition, adjust quantity). Around this sits a live dashboard in a dark "holographic glass" teal aesthetic: stat pills, a category radar, a locations panel, a needs-attention list, and a full activity trail. It turns an unidentified, unlisted pile of company tools into a system where adding an item takes one photo and one tap.

---

## 2 · Locked decisions (from the planning interview — do not reopen)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Item domain | Tools & machinery |
| 2 | Users | Whole company; every authenticated user can add & edit |
| 3 | Data home | Supabase (Postgres + Auth + Storage) |
| 4 | Tracking model | Hybrid: unique **Assets** (AST- codes) + counted **Stock** (STK- codes) |
| 5 | Custody & movement | Both: person check-out/return AND location tracking, fully logged |
| 6 | Extra data | Condition status + maintenance log per item |
| 7 | Labels/QR | **None** — replaced by "snap-to-find" photo matching (§7.2) |
| 8 | Vision AI | Z.ai **glm-4.6v-flash** (free tier); upgrade path glm-4.6v |
| 9 | Platform | Mobile-first PWA (Next.js), deployed on Vercel free tier |
| 10 | Export | One-tap CSV + XLSX of the current filtered list |
| 11 | Safety net for open editing | Full audit trail + soft delete with restore (no hard deletes from the UI) |

---

## 3 · Assumptions — keep configurable (owner has not yet confirmed these)

- **Trade unknown** → seed the generic tool taxonomy in §14; categories are fully editable in Settings.
- **Scale** assumed ≤ ~2,000 items across 1–5 locations. The architecture below comfortably handles 10× that.
- Single currency, English UI, Singapore timezone default (owner-adjustable in Settings).
- If the owner later supplies trade / scale / site details, adjust seed data only — not the architecture.

---

## 4 · Tech stack

- **Frontend:** Next.js 14+ (App Router) · TypeScript · Tailwind CSS. Icons: lucide-react. Charts: Recharts.
- **Backend:** Supabase — Auth (email + password), Postgres (with `pg_trgm`), Storage bucket `item-photos`, Row Level Security.
- **Vision AI:** server-only route `POST /api/identify` → Z.ai model `glm-4.6v-flash` (free tier: 1 concurrent request, no card required — simultaneous scans simply queue). Endpoint: `https://api.z.ai/api/paas/v4/chat/completions` (mainland mirror `https://open.bigmodel.cn/api/paas/v4/chat/completions`) — GLM: verify the current endpoint form at docs.z.ai before wiring. Upgrade path if accuracy or concurrency needs grow: `glm-4.6v` (approx. US$0.30 per 1M input / $0.90 per 1M output tokens — one identification costs a fraction of a cent). Alternate provider, env-swap only: Google Gemini Flash.
- **Camera:** `<input type="file" accept="image/*" capture="environment">` (most reliable across iOS/Android browsers). Client-side compression before anything else: max edge 1280px, JPEG quality 0.8, via canvas. The same compressed image goes to both the vision API and Storage.
- **PWA:** manifest + icons + installable; simple service worker caching the app shell only — data is always live.
- **Deploy:** Vercel. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ZAI_API_KEY`.
- **Export:** SheetJS (`xlsx`) client-side, generated from the currently filtered item set.

---

## 5 · Data model

Run as one migration in the Supabase SQL editor.

```sql
create extension if not exists pg_trgm;

create type tracking_type as enum ('asset','stock');
create type item_status  as enum ('available','checked_out','needs_service','out_of_order');
create type txn_action   as enum ('add','checkout','checkin','move','adjust_qty',
                                  'condition','edit','delete','restore','maintenance');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  created_at timestamptz default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'site',          -- site | room | vehicle
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  sort int default 0
);

create sequence asset_code_seq;
create sequence stock_code_seq;

create table items (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                  -- AST-0001 / STK-0001, assigned on insert
  name text not null,
  brand text, model text, serial_no text,
  category_id uuid references categories,
  tracking_type tracking_type not null,
  status item_status not null default 'available',   -- meaningful for assets
  quantity numeric not null default 1,                -- meaningful for stock
  min_quantity numeric not null default 0,            -- low-stock threshold (stock)
  condition text not null default 'good',             -- good | needs_service | out_of_order
  home_location_id uuid references locations,
  current_location_id uuid references locations,
  holder_id uuid references profiles,                 -- who currently has it (assets)
  photo_url text,
  ai_confidence numeric,
  notes text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references profiles,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index items_search_trgm on items using gin
  ((coalesce(name,'')||' '||coalesce(brand,'')||' '||coalesce(model,'')) gin_trgm_ops);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  action txn_action not null,
  qty_delta numeric,
  from_location_id uuid references locations,
  to_location_id uuid references locations,
  person_id uuid references profiles,   -- who performed the action
  holder_id uuid references profiles,   -- who received the item (checkout)
  note text,
  created_at timestamptz default now()
);

create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  done_at date not null default current_date,
  description text not null,
  cost numeric,
  next_due date,
  created_by uuid references profiles,
  created_at timestamptz default now()
);
```

**RLS (enable on every table):** authenticated users get `select / insert / update` on all rows; **no delete policy anywhere** — deletion is `update items set is_deleted = true, deleted_at = now()`. Anyone can restore within 30 days via a "Recently deleted" view. Storage bucket `item-photos`: authenticated write, public read (photos aren't sensitive; simpler than signed URLs — switch to signed URLs later if the owner prefers).

**Every state change writes a `transactions` row.** That audit trail is what makes "everyone can edit" safe without approval gates.

---

## 6 · AI identification contract

`POST /api/identify` receives `{ imageBase64 }`, calls the vision model with `temperature: 0.1` and this system prompt (inject the live category list at `{{CATEGORY_LIST}}`):

```
You are the recognition engine of a tools & machinery inventory app.
You receive one photo of an item. Reply with ONLY minified JSON — no markdown,
no commentary — matching exactly this shape:

{
 "name": string,                  // short generic name, e.g. "Angle grinder 115mm"
 "brand": string|null,            // only if visible/readable
 "model": string|null,            // only if readable — never guess
 "category": string,              // exactly one of: {{CATEGORY_LIST}}
 "tracking_type": "asset"|"stock",// asset = unique serialised unit (machines, power tools);
                                  // stock = counted small items (bits, blades, fasteners, PPE)
 "condition_guess": "good"|"needs_service"|"out_of_order"|"unknown",
 "estimated_quantity": number|null, // only if the photo clearly shows multiple identical stock items
 "description": string,           // one plain-English sentence
 "identifying_features": [string],// up to 3 visible cues (colour, markings, wear)
 "confidence": number             // 0.0-1.0, honest overall confidence
}

Rules: if the object is not a tool/machine or is unidentifiable, return
name "Unknown item", category "Other", confidence <= 0.2. Never invent
serial numbers or model codes you cannot actually read.
```

**Client behaviour by confidence:** ≥ 0.75 → fully pre-filled confirm sheet. 0.40–0.74 → pre-filled, but category and tracking_type highlighted for explicit confirmation. < 0.40 → open the manual add form with the photo already attached. If the model returns invalid JSON, retry once with *"Your last reply was not valid JSON. Re-emit only the JSON object."* — on second failure, treat as confidence 0.

**Dedupe (runs before any create is offered):**

```sql
select id, code, name, brand, model, photo_url, status, quantity,
       similarity(name||' '||coalesce(brand,'')||' '||coalesce(model,''), $candidate) as sim
from items
where is_deleted = false
order by sim desc
limit 5;
```

Surface matches with `sim > 0.45` as "Possible existing matches" cards (photo + code + status) ABOVE the "Create new item" button.

---

## 7 · Core user flows

**7.1 · Snap-to-add.** Scan screen → capture → compress → `/api/identify` → dedupe → confirm sheet (photo hero, AI-filled fields, all editable) → Save. App assigns `AST-####` or `STK-####`, uploads the photo, writes the item + an `add` transaction. Target: under 15 seconds end-to-end.

**7.2 · Snap-to-find (replaces QR labels).** Same Scan screen, no mode switch. When dedupe finds strong matches, the top of the result sheet reads *"Looks like this might already be in inventory"* with match cards. Tapping a match opens that item's **action sheet**: Check out · Return · Move · Update condition · Adjust quantity. Only below the matches sits "None of these — add as new". One camera, both jobs.

**7.3 · Check-out / return (assets).** Check-out: holder defaults to the signed-in user (changeable), pick destination location, optional expected-return date, optional note → status `checked_out`, holder + current_location set, `checkout` transaction written. Return: one tap → status `available`, holder cleared, location resets to home (editable), `checkin` transaction. Overdue expected-returns surface on the dashboard.

**7.4 · Move.** For assets or whole stock lots: pick a new location → `move` transaction with from/to.

**7.5 · Stock adjust.** Plus/minus stepper or direct entry, with a reason (used / restocked / counted / damaged) → `adjust_qty` transaction with the delta. When `quantity ≤ min_quantity`, the item appears under Low Stock.

**7.6 · Condition & maintenance.** Condition is editable from the action sheet (`condition` transaction). Maintenance log entries (what / when / cost / next due) live on the item page; items with `next_due` within 14 days or condition `needs_service` appear in the dashboard "Needs attention" list.

**7.7 · Search & filters.** Item list with instant search (trigram-backed; matches name, brand, model, code) and filter chips: category, status, location, tracking type, "my items", low stock.

**7.8 · Export.** From the item list: current filtered set → `.xlsx` and `.csv`. Columns: code, name, brand, model, category, type, status, condition, quantity, min quantity, location, holder, last activity, notes.

**7.9 · Activity feed.** Reverse-chronological, human-readable transactions: *"Sarah checked out AST-0042 Angle grinder → Site B · yesterday 16:20"*. Filterable by person, item, action, date.

---

## 8 · Screens & navigation

Bottom nav, 5 slots with a big raised centre button: **Dashboard · Items · ⦿ SCAN · Locations · Activity**.

1. **Login / Sign-up** — minimal glass card on the plexus background; full name + email + password.
2. **Dashboard** — see §9.
3. **Scan** (the hero screen) — near-fullscreen camera trigger with a teal glow ring around the shutter, the last 3 scans as small thumbnails, and a rotating tip line ("Point at any tool — I'll do the rest").
4. **Items list** — search bar, filter chips, item cards (thumbnail, code, name, status pill, location/holder line).
5. **Item detail** — photo hero with a status pill overlay, spec rows, action sheet trigger, maintenance section, full history timeline styled like the reference image's "Related Laws" cards.
6. **Locations** — one card per location with item count and a small category breakdown bar; tapping opens the pre-filtered item list.
7. **Activity** — the feed from §7.9.
8. **Settings** — categories editor, locations editor, profile, export, and the "Recently deleted" restore list.

---

## 9 · Dashboard layout (maps the reference image to inventory)

- **Top bar:** brand mark left ("TOOLDECK · Inventory Platform" in the two-tone style of the reference logo), search icon right.
- **Row 1 — stat pills** (horizontally scrollable on phones): Total items · Available · Checked out · Needs service · Low stock. Micro-label above, big numeral below, tiny trend arrow where meaningful.
- **Row 2 — category radar:** the reference's circular radar motif rendered as a donut/radial chart of items by category, total count in the centre; tapping a segment opens the filtered item list.
- **Row 3 — locations panel:** a glowing node per location, node size proportional to item count, thin teal connector lines over the plexus background. If a node graph proves heavy on mobile, fall back to constellation-styled location cards — keep the aesthetic, drop the physics.
- **Row 4 — needs attention** (styled like the reference's numbered "Related Laws" list): overdue returns, needs-service items, low stock, upcoming maintenance. The active/tapped card receives the gold border treatment.
- **Bottom — floating command bar** (the reference's chat bar): a rounded glass pill with a search input and a teal-glow camera button, floating above the nav.

---

## 10 · UI style guide — non-negotiable tokens

Derived from the owner's reference image: dark holographic teal, glassmorphism, hairline borders, a single gold selection accent, magenta alert accents, plexus background texture.

```css
:root {
  /* canvas */
  --bg-0: #030A0A;                        /* page — near-black teal */
  --bg-1: #061111;                        /* raised surface base */
  --glass: rgba(10, 26, 26, 0.55);        /* card fill (pair with blur) */
  --glass-strong: rgba(14, 34, 33, 0.78); /* sheets, bottom nav */
  --hairline: rgba(126, 222, 210, 0.16);  /* 1px borders */

  /* brand */
  --teal: #19E3C4;          /* primary actions, live data, "available" */
  --teal-bright: #6BFFE9;   /* glow cores, hover states */
  --teal-deep: #0E4F4A;     /* chart tracks, subtle fills */
  --gold: #C9A063;          /* selection, "checked out", highlights */
  --magenta: #E06FB2;       /* needs-service and low-stock alerts */
  --danger: #E0566B;        /* out-of-order (only non-reference colour) */

  /* text */
  --text-hi: #EAF7F4;
  --text-mid: #9FBDB8;
  --text-low: #6E8D89;

  /* effects */
  --glow-teal: 0 0 24px rgba(25,227,196,.35), 0 0 64px rgba(25,227,196,.12);
  --radius-card: 20px;
  --radius-pill: 999px;
  --blur: blur(14px);
}
```

**Typography.** Display + numerals: Space Grotesk (Google Fonts). Body/UI: Inter. Micro-labels: 10–11px, UPPERCASE, letter-spacing 0.14em, colour `--text-low` — the reference uses these everywhere ("EXECUTION RATE" style). Stat numerals: Space Grotesk 600, 28–40px, with the unit (%, ×) at roughly 55% size and raised — exactly like the "72 %" treatment in the reference. Body 14–15px in `--text-mid`; headings in `--text-hi`.

**Component recipes.**
- *Glass card:* `background: var(--glass); backdrop-filter: var(--blur); border: 1px solid var(--hairline); border-radius: var(--radius-card);` plus a 1px inner top highlight `rgba(255,255,255,0.04)`.
- *Selected / active card:* border switches to `--gold`, fill to `rgba(201,160,99,0.10)` — the reference's highlighted card. **Maximum one gold element visible per view.**
- *Numbered section chips* (like the ③ ④ chips in the reference): 22px circle, 1px teal border, teal numeral. Use ONLY where order or a real count exists (steps in a flow, counts of linked records) — never as decoration.
- *Status pills:* dot + label. available → `--teal` · checked_out → `--gold` · needs_service → `--magenta` · out_of_order → `--danger`.
- *Primary button:* `--teal` fill, text colour `#04211D`, `--glow-teal` on hover/press.
- *Background:* a fixed plexus/constellation SVG (thin lines + node dots) at 4–6% opacity, kept to edges and corners — never behind dense text.
- *Charts:* teal strokes on `--teal-deep` tracks, hairline gridlines, no multi-colour palettes.

**Motion.** 180–220ms ease-out transitions; a 2.4s soft pulse on live indicators and the scan shutter ring; glow intensifies on hover; skeleton shimmer in teal at 8% opacity. Calm and precise — no spring or bounce. Respect `prefers-reduced-motion`.

**Don'ts.** No pure-white surfaces. No colours outside the token block. Glow is reserved for the primary action and live elements. Dark mode only. Text contrast ≥ 4.5:1 (the tokens above pass on `--bg-0`).

---

## 11 · Build milestones — one at a time, in order

**M1 · Foundation.** Next.js + TypeScript + Tailwind scaffold with the §10 token file; Supabase client; email/password sign-up, login, logout; protected routes; PWA manifest + icons; dark shell with bottom nav.
✓ *Accept when:* sign-up works on a phone, the app installs to the home screen, and the shell matches the tokens.

**M2 · Database.** The full §5 migration including RLS, sequences, and the trigram index; storage bucket + policies; seed the §14 categories and one demo location.
✓ *Accept when:* tables are visible in Supabase, anonymous requests are rejected, seeds are present.

**M3 · Items core.** Items list with search + filter chips; item detail page; manual add/edit form; photo capture → compress → upload; soft delete with an undo toast and a "Recently deleted" restore view.
✓ *Accept when:* full CRUD works from a phone, photos persist, deletes are restorable.

**M4 · Camera + AI (the magic).** Scan screen; the `/api/identify` route with the §6 prompt, the JSON-repair retry, and clear error states; the dedupe query + match cards; the confirm sheet per confidence tier.
✓ *Accept when:* photographing a drill yields a correct pre-filled record in under 15 seconds, and photographing the same drill again surfaces the existing record first.

**M5 · Custody & stock.** Check-out / return / move / adjust flows via the action sheet; a transaction written for every action; the item history timeline; a "My items" filter; expected-return dates.
✓ *Accept when:* the history answers who / what / where / when for every change.

**M6 · Dashboard.** §9 in full: stat pills, category radar, locations panel, needs-attention list, activity feed, floating command bar.
✓ *Accept when:* every number on the dashboard reconciles with the database.

**M7 · Polish + export.** CSV/XLSX export of filtered sets; maintenance log UI with next-due surfacing; empty states written in the interface voice ("No items yet — tap Scan to add your first"); loading skeletons; error toasts; final theme pass; Vercel deployment.
✓ *Accept when:* the full §12 checklist passes end-to-end.

---

## 12 · Final acceptance checklist

- [ ] Sign-up and login work in a phone browser; the PWA installs
- [ ] Snap a new item → correct pre-fill → saved with photo and an AST/STK code
- [ ] Snap the same item again → the existing record is offered first, no duplicate created
- [ ] A low-confidence photo degrades gracefully to the manual form
- [ ] Check-out sets holder + location; return clears them; both appear in history
- [ ] Stock at or below min quantity appears under Low Stock
- [ ] Condition changes and upcoming maintenance surface in Needs attention
- [ ] Every add/edit/move/delete is visible in Activity with person + timestamp
- [ ] Soft-deleted items are restorable for 30 days by anyone
- [ ] Export downloads valid .xlsx and .csv matching the current filter
- [ ] `ZAI_API_KEY` is absent from the client bundle (verify via view-source / network tab)
- [ ] Theme matches §10 exactly; max one gold element per view; contrast ≥ 4.5:1

---

## 13 · Owner setup checklist (~15 minutes, human tasks)

1. **Supabase** — supabase.com → New project (region: Singapore) → copy the Project URL and the anon public key.
2. **Z.ai key** — z.ai → sign up → API Keys → create one. The free tier covers `glm-4.6v-flash` with no card required as of July 2026 — re-check current limits before going live.
3. **GitHub + Vercel** — create accounts; log into Vercel with GitHub.
4. **Env vars** — put the three values into Vercel → Project → Settings → Environment Variables, and into `.env.local` for local runs. Avoid pasting real keys into any AI chat; if one ever leaks, rotate it.
5. **First run** — deploy, sign up as the first user, add your real locations in Settings, then walk the workshop and start snapping.

---

## 14 · Seed category tree (fully editable in Settings)

Power Tools · Hand Tools · Machinery & Plant · Welding & Fabrication · Measuring & Testing · Lifting & Rigging · Electrical & Cabling · Air & Pneumatic · Safety & PPE · Consumables & Fasteners · Vehicles & Transport · Other

---

## 15 · Deliberately out of scope for v1

QR/barcode labels (owner's call — snap-to-find covers it; printable QR per item code can be added later with zero schema changes) · approval workflows (open editing + audit trail instead) · depreciation and accounting · multi-language · offline-first data sync (the PWA caches the shell only).

---

*End of build pack. GLM: confirm your understanding, then begin Milestone 1.*
