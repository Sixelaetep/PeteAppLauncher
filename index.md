# P Apps Launcher — Changelog

Full version history for `index.html`. As of v10.89, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

## v10.98 (PET-103 / PGC-003) — PeteGCal added: new app, nav icon, home card, iframe

PeteGCal is a new standalone app (`PeteGCal.html` v1.0) — not a replacement for GigsAndTrips, which is untouched and keeps running exactly as before. PeteGCal treats Pete's own primary Google Calendar (shared with Lex at edit-access level) as the source of truth, and is a read-only agenda view at this stage: signs in with Google, fetches everything on the calendar from 14 days ago to 180 days ahead, and lists it grouped by day. No create/edit/delete yet (PGC-004), no conflict detection (PGC-005), no trip-spanning (PGC-006) — those are later phases in the same brief.

**Design decisions baked into v1.0, from the PGC scoping discussion:** the calendar ID is hardcoded to Pete's actual account email rather than the literal string `'primary'` — `'primary'` resolves to whichever account is signed in, which would silently show Lex her own calendar instead of Pete's shared one when she's the one logged in. Every event on the calendar is shown, no exclusions — app-created events carry a small `extendedProperties.private` tag (read via the new `pal-gcal.js` module's `readAppMeta()`) showing their type; native Calendar entries typed straight into Google Calendar show a plain "Calendar" tag instead, with no separate treatment otherwise, per the "full mirror, no exclusions" decision.

**New shared module:** `pal-gcal.js` — deliberately separate from `pal-shared.js` rather than merged into it, since `pal-shared.js` is loaded by every app in the suite and this is unproven outside PeteGCal so far. Handles Google OAuth (sign-in, silent token refresh), `listEvents`/`createEvent`/`updateEvent`/`deleteEvent`/`getEvent` wrappers, and the `extendedProperties` read/write helpers (`withAppMeta`/`readAppMeta`) other apps could reuse later if this proves solid.

**Launcher changes.** New `LAYOUT_APPS` entry (`petegcal`, order 12, full width, card + icon visible by default), new nav icon (🗓️, indigo `#4f46e5`, after Film & TV Tracker), new home card (ships with a static "Open app" stat — no live summary yet, same precedent as Vault/Horizon's first releases), new lazy-loaded iframe (`frame-petegcal` → `PeteGCal.html`), and a `PAL_NAV_SLUG_MAP` entry (`'PeteGCal': 'petegcal'`) for consistency with how `GigsAndTrips` is mapped, though nothing currently sends that slug.

**Known limitation, accepted for this phase.** PeteGCal cannot function without a live Google sign-in — unlike GigsAndTrips' Supabase-backed data, there's no local fallback if the token can't be silently refreshed. A failed refresh shows "Reconnect needed" and drops back to the sign-in gate rather than failing silently. This is a deliberate trade-off flagged during scoping, not an oversight.

**Open item carried over from PGC-001/002, not yet fully closed.** Pete's own write access to his calendar is proven. Lex's write access to Pete's *shared* calendar specifically (as opposed to her own) was run successfully once via the `pal-gcal.js`-based test page, but hasn't been re-confirmed since. Worth a final check before PGC-004 adds real create/edit/delete, since that phase is where a silent wrong-calendar write would actually matter.

Files changed: `index.html` (2 version markers, 1 new nav-btn, 1 new home card, 1 new iframe, 1 new `LAYOUT_APPS` entry, 1 new `PAL_NAV_SLUG_MAP` entry — structural diff confirms nothing else moved), `index.md`. New files: `PeteGCal.html` (v1.0), `pal-gcal.js` (new shared module, not yet consumed by any other app).

**Tested:** `node --check` on every inline script block in both `index.html` and `PeteGCal.html`, and on `pal-gcal.js` — all pass. A structural diff of `index.html` against v10.97 confirms only the PeteGCal-related lines changed; no other nav button, card, iframe, or catalog entry was touched. `pal-gcal.js`'s underlying API calls (sign-in, token refresh, create, read-back, list) were proven working via the `gcal-test.html` spike page in the development session.

**Not tested:** `PeteGCal.html` itself has not been run — the agenda rendering, day-grouping, empty state, silent sign-in on load, and reconnect-on-expiry paths are all reasoned through against `pal-gcal.js`'s proven behaviour but not yet exercised in a browser. The launcher's new nav icon, home card, and lazy iframe load have not been clicked through in a live launcher. Lex's write access to Pete's shared calendar (vs. her own) has not been re-confirmed since the one successful test noted above.

## v10.97 (PET-102) — On Budget card: tappable columns, Food Spend / Bills Spend buttons

Pete's request. On the On Budget home card, the Food & Travel column now opens On Budget on its **Spending** tab and the Bills column opens it on the **Bills** tab (Ledger view — the one whose cleared balance and lowest-projected figures the column shows). Each column label carries a small › as the only cue that it is tappable. The single full-width "+ Add spend" button is replaced by two buttons directly under their own columns: **+ Food Spend** (left, the existing food/travel add sheet — unchanged behaviour) and **+ Bills Spend** (right, the Bills Ledger's own Add transaction sheet). Tapping anywhere else on the card still just opens the app, as before.

**Interpretation to confirm.** "Could the bottom transaction button stay" was read as "the add-transaction buttons stay at the bottom of the card, but split one per side", i.e. the old single button is replaced by the two, not kept alongside them. If the old button was meant to stay as well, it is a one-line addition.

**Implementation.** The buttons are static markup, independent of the stat rendering, so they are present even when the card shows "No data yet" / "Open app to refresh" (the columns are not, since they are part of the stat). The button row is a two-column grid with the same 12px gap as `.ob-grid`, so each button sits exactly under its column (measured: 0.0px offset at 390px and 1280px). New `launchOBAction(e, action)` uses the same ensureLoaded → switchTo → `OB_ACTION` sequence as `launchOBAddSpend`, which is unchanged. Bills Spend deliberately does *not* reuse the existing `openBillsSheet` action — that one opens the *Recurring* bill sheet, not a transaction.

**Cross-file dependency.** Needs `on-budget.html` v3.81 (ON--075), which adds the `openSpendingTab`, `openBillsTab` and `openBillsTxSheet` actions. Deploy them together, or on-budget.html first: a new launcher with the old v3.80 app degrades gracefully (the app opens where it was left, no sheet, no error) but the buttons and columns then don't do what they say.

**Known and unchanged:** if the On Budget card is set to half width in the layout panel, the balance figure is clipped at 390px — identical in v10.96, not caused by this change. The buttons wrap onto two lines there rather than truncating.

Files changed: `index.html` (CSS, card markup, the two column templates in `statOnBudget()`, new `launchOBAction()`, version markers, inline pointer) and `on-budget.html` (v3.81). Every other launcher function is byte-identical to v10.96.

Tested in real headless Chromium against the real launcher with the real on-budget.html in its iframe (Supabase auth stubbed): 28 checks, all passing. At 390px and 1280px: two tappable columns and two buttons, labels correct, each button exactly under its column, no horizontal overflow, no page errors. Left column takes the app from History to Spending with no sheet; right column opens Bills → Ledger with no sheet, and lands on Ledger even if the app was last left on Recurring; Food Spend opens the food sheet (regression); Bills Spend opens Bills Ledger + "Add transaction" and not the food sheet; clicking the card title still opens the app with no sheet; the existing `openBillsSheet` action still opens Bills → Recurring. Card states: Not started (columns still tappable), no dashboard summary (buttons present, no columns, no errors), Decreasing mode (content unchanged). Also checked visually in dark and light themes, and the old-app/new-launcher pairing described above.

Not tested: a physical phone (touch behaviour, safe areas), live Supabase, or saving an actual transaction from either sheet (the sheets were confirmed to open, not submitted).

## v10.96 (PET-101) — Layout changes now sync between devices

Bug fix, reported directly: launcher layout adjustments (order, width, card/icon visibility, groups, standalone) made on one device never appeared on another.

**Root cause.** `loadLayoutConfig()` and `saveLayoutConfig()` both only talk to Supabase when `PalSync.hasSession()` is true. But the launcher holds its own Supabase session (`sbSession`) and never handed it to PalSync — PalSync only learns a session from a `PAL_SESSION` postMessage (which the launcher sends *to its iframes*, never to itself) or an explicit `setSession()`. Inside the launcher `hasSession()` was therefore always false, both cloud paths returned early, and the layout lived only in each device's `pal_layout_cache` localStorage. The "Layout saved" toast (PET-095) never showed either, which is consistent with this. The apps' own sync was unaffected — they receive `PAL_SESSION` normally.

**Fix.**
- New `feedPalSyncSession()` passes `sbSession` to `PalSync.setSession()` on sign-in (before `applyUserView()` → `loadLayoutConfig()`), on every proactive token refresh, and clears it on lock.
- New `pal_layout_dirty` localStorage flag marks a local edit the cloud hasn't confirmed. While set, the local config wins over the cloud copy on load and is re-pushed. Previously a failed/offline save was overwritten by the older cloud copy on the next load and lost.
- Cloud read extracted to `syncLayoutFromCloud()`. It now also runs when the launcher returns to the foreground (`visibilitychange`), so a long-open home-screen launcher picks up changes made elsewhere. Skipped while the layout settings panel is open, and a no-op if nothing differs.
- If the cloud has no layout row yet, the device publishes its existing local layout.
- Save failures now say why (`PalSync.errorHint`: 401 / 403 / 404) instead of the generic "will sync once back online"; not-signed-in reports "Saved on this device only".

**Behaviour to be aware of on first use.** Because nothing ever reached the cloud before, `pal_layout` is empty. The first device to open v10.96 publishes its layout; other devices then adopt it. Open the device whose layout you want to keep first.

**No data-model, storage-key (other than the new dirty flag), schema, backup or import/export change.** `pal-shared.js` unchanged (its `?v=10.87` cache-buster is deliberately left as-is). Requires the `pal_layout` table and RLS policies from v10.89 to exist in Supabase — if that SQL was never run, saves will now report "table not found" rather than failing silently.

Files changed: `index.html` (5 functions changed, 6 added, version markers, inline pointer), `index.md`. 85 other launcher functions byte-identical to v10.95.

Tested with a two-device simulation (separate storage per device) against a fake Supabase, using the real `pal-shared.js` and the real layout code sliced from the launcher: change on device 1 reaches the cloud; fresh device loads it on sign-in; an already-open device picks it up on return to foreground; a second device's edit updates the same row (no duplicate); offline save keeps the dirty flag, survives a reload against an older cloud copy and is re-pushed; a 404 is reported with a hint; existing local layout is published to an empty cloud. The same suite against v10.95 fails all cloud checks. `node --check` on every inline script block.

Not tested: a real browser, a real Supabase project (RLS, the actual `pal_layout` table), a physical phone, or Lex's view (unaffected by design — layout is Pete-only).

## v10.95 (PET-100) — Film & TV Tracker card: top 3 favourites

The Film & TV Tracker dashcard now shows the top three favourites under its existing counts line: a small "Top favourites" label and three posters with titles beneath (film/TV glyph behind each poster, so a poster that fails to load falls back to it). They are the first three in the tracker's saved favourite order, i.e. the same three that lead the tracker's My favourites shelf. The counts line ("14 on watchlist · 7 available now · 2 for bedtime") and its green/neutral colouring are unchanged, tapping the card still opens the tracker, and with no favourites the card looks exactly as before. Header badge and `<title>` are both bumped to v10.95 together (the v10.93 drift fix).

**Where the data comes from.** Film & TV Tracker v2.5 writes `topFavourites` into the `pal_ftt_stat` cache the card already reads. So the card works straight away after this update (before the tracker has been opened once), a cache with no `topFavourites` key falls back to deriving the top three from the tracker's own saved data (`ftt_v1`) using the tracker's ordering rule (saved favourite order; for data that predates ordering, oldest-added first). Once the cache has the key, even an empty list, the saved data is not read again. Two safeguards: titles and poster URLs are HTML-escaped, and a poster is used only if it is a plain `https://` URL (`javascript:`, `http:` and inline images are refused, showing the glyph instead). An empty watchlist with favourites shows "Watchlist is empty" at full strength (it stays dimmed only when there is nothing else to show).

**Layout.** Tiles are 80px wide with 2:3 posters and titles clamped to two lines (broken only at word boundaries), left-aligned. On a phone the card grows from roughly 100px to about 272px with three favourites. Works in both dark and light themes; no horizontal overflow at 390px or 1280px.

**Files changed:** `index.html` (CSS block, `statScreen()`, three small helpers, the two version markers) and `film-tv-tracker.html` (v2.5). All 86 other launcher functions are byte-identical to v10.94.

Tested in a real browser against the real launcher code, with poster requests intercepted: 30 checks, all passing. Cache with three / two / one / no favourites; counts line and colour preserved exactly; empty watchlist with and without favourites; no cache, corrupt cache (both unchanged); old cache falling back to saved data (with and without order numbers, none, and cache-wins-over-saved-data); a `<img onerror>` title shown as text and never run; `javascript:` / `http:` posters refused; a quote in a poster URL unable to break out of the attribute; a failing poster falling back to the glyph; long titles clamped; returning Home refreshing the card; tapping the card still opening the tracker; no overflow at either width; and all 12 other dashcards rendering byte-for-byte the same as v10.94. Then a round trip with the real tracker inside the launcher's iframe: with no cache the card says "Open app to set up"; after opening the tracker it shows the top three in order; reordering favourites in the tracker changes them on return Home; removing all favourites removes the strip (6/6).

Not tested: a signed-in session and live TMDB poster loading (posters were intercepted and served locally; in a test browser the launcher's own refresh, which runs after sign-in, was triggered by hand), a physical phone, or Lex's account.

## v10.94 (PET-099) — On Budget card: lead with card balance in Increasing mode

On Budget's Food & Travel launcher column now leads with the real card balance in Increasing (credit card) mode, with the amount left of the month's budget as a smaller bracketed sub-line — matching the app's own hero card (on-budget.html v3.80), fixing a mismatch where the two showed different figures for the same account. Reads the new `summary.cardBalance` and `summary.potDirection` fields; falls straight through to the previous pot-led display for Decreasing mode or an older on-budget.html save that predates these fields. No change to Bills, colour thresholds, or any other launcher card.

Tested in jsdom against the real launcher code, using the app's own screenshot data: Increasing mode leads with £67.08 (card balance) and "(£682.92 left of budget)" underneath; Decreasing mode and an old summary without the new fields both render exactly as before; Not-started and Bills columns unaffected.

## v10.93 (PET-098) — Version drift fix

Housekeeping only, Pete's direct request. The header badge (`.nav-version`, next to the "P Apps" logo) still read v10.90 while `<title>` said v10.92 — v10.91 (PET-096) and v10.92 (PET-097) bumped the title and this changelog but not the badge. Both now read v10.93. Also added the missing inline pointer comment in `index.html` for v10.91–v10.93 (the inline block stopped at v10.90).

No functional, layout, data or storage changes. Checked for other launcher version representations: none found beyond `<title>`, the badge and the inline comments. The `pal-shared.js?v=10.87` cache-buster is deliberately left as-is — it tracks when that shared file last changed, not the launcher's own version (bumping it would only force an unnecessary re-download).

Tested: `node --check` on every inline script block, and a search confirming the only live version strings are now `<title>` and the badge, both v10.93. Not tested in a browser.

## v10.92 (PET-097) — Film & TV Tracker shared with Lex

Pete's direct request, following a comparison against `GigsAndTrips.html`'s existing sharing pattern before touching anything.

**What GigsAndTrips actually does — and what it doesn't.** Read through the real file rather than assuming: it does *not* use `window.PalSync`/`pal-sync.js` at all — deliberate, per its own header comments — it has a bespoke sign-in form and calls the Supabase REST API directly. The part that matters for sharing is its RLS shape: every GigsAndTrips table's policy requires `auth.uid()` to be Pete *or* Lex specifically (`auth.uid() = ANY(ARRAY[...])` against their two known UIDs), not `auth.uid() = user_id` per-row ownership — `user_id` is still stamped on each row, but only for authorship, never checked for access. Replicating GigsAndTrips' whole bespoke sync layer onto Film Tracker would have been a large, unnecessary rewrite: Film Tracker already goes through this launcher's ordinary `PAL_SESSION` postMessage relay exactly like every other non-legacy app, and that relay is already generic per signed-in user (`currentUser`/`KNOWN_USERS`), not Pete-specific — confirmed by reading the actual relay code before concluding this, not assumed. So `window.PalSync.initSession()` in film-tv-tracker.html already receives whichever of Pete or Lex is signed into the launcher, with their own real token; `pal-sync.js`'s `table()/pull()/upsert()` never filter by user in JS at all — every bit of access control already happens in Postgres. Net effect: **film-tv-tracker.html needed zero code changes.** Only the RLS policy shape needed copying, plus making the app actually reachable from Lex's home screen.

**Launcher change (this file).** The "screen" nav-btn and app-card both lost their `pete-only` class — that class is the *only* thing `applyUserView()` checks, and Lex's home screen never calls `loadLayoutConfig()`/`renderHomeGrid()` at all (confirmed both are gated `if (isPete)`), so removing the class was the complete fix for visibility; no `LAYOUT_APPS` change needed, since that catalog only feeds Pete's own layout-customization panel.

**Supabase migration (Pete needs to run this, not shipped as code).** Replace `pal_film_tracker`'s per-user policies with GigsAndTrips' allow-list shape, using the two UIDs already on file in `PAL_CONFIG.KNOWN_USERS`:

```sql
drop policy if exists "pal_film_tracker_select_own" on public.pal_film_tracker;
drop policy if exists "pal_film_tracker_insert_own" on public.pal_film_tracker;
drop policy if exists "pal_film_tracker_update_own" on public.pal_film_tracker;

create policy "pal_film_tracker_select_shared"
  on public.pal_film_tracker for select
  using (auth.uid() = ANY (ARRAY['d3203136-833d-405b-9a48-13d7045df4fd', '0e5607ff-7bc8-420e-92c6-fa82b680a0f0']::uuid[]));

create policy "pal_film_tracker_insert_shared"
  on public.pal_film_tracker for insert
  with check (auth.uid() = ANY (ARRAY['d3203136-833d-405b-9a48-13d7045df4fd', '0e5607ff-7bc8-420e-92c6-fa82b680a0f0']::uuid[]));

create policy "pal_film_tracker_update_shared"
  on public.pal_film_tracker for update
  using (auth.uid() = ANY (ARRAY['d3203136-833d-405b-9a48-13d7045df4fd', '0e5607ff-7bc8-420e-92c6-fa82b680a0f0']::uuid[]))
  with check (auth.uid() = ANY (ARRAY['d3203136-833d-405b-9a48-13d7045df4fd', '0e5607ff-7bc8-420e-92c6-fa82b680a0f0']::uuid[]));
```

`user_id` stays on every row exactly as before (still stamped with whoever's `getUserId()` created it) — it's just no longer checked for access, same as GigsAndTrips' `events` table. Existing data isn't touched or migrated; only the policy changes, so nothing already in the table needs to move.

**Consequence worth stating plainly, not burying:** once this runs, Lex will see Pete's *entire* existing library immediately — every title and service already saved, not just things added from here on — since it's now one shared table read under one shared policy, not a merge of two separate datasets. That's the explicit ask ("one data set... read and write into this app with the same data"), not a side effect.

Tested: `node --check` on all three inline script blocks, an HTML tag-balance check, and confirmed no duplicate ids were introduced. Not tested: the SQL itself (no live Supabase access from the build sandbox) and Lex's actual home-screen view post-migration — both worth a first real check once the policy change has been run.

## v10.91 (PET-096) — Film & TV Tracker registered

Launcher-side half of bringing up the new Film & TV Tracker app (film-tv-tracker.html v1.0, FTT-001 — see that app's own changelog for the app itself). Three additions, all additive:

**Nav icon + home card.** New `nav-btn`/`app-card` pair, `data-target="screen"` (🎬, `--app-color:#2dd4bf`), placed after Food System. Unlike Claim Tracker/HTML Vault/Horizon, this app has no host app to embed inside — there's no "standalone" concept for it — so it follows the plain always-on pattern used by Gigs/Gym/Reading/Fantasy/Food (visible by default, no `data-layout-managed`, no `display:none`) rather than the hidden-until-standalone pattern PET-094 introduced for the three embeddable apps.

**`LAYOUT_APPS` entry.** `{ id:'screen', order:11, width:'full', cardVisible:true, iconVisible:true }` — sits after Horizon, card and icon visible from the very first load (no migration needed, matching PET-094's rule that a new catalog entry's defaults describe today's actual layout).

**`statScreen()` card stat.** Reads `pal_ftt_stat` — a small `{watchlistCount, availableNow, bedtimeNow}` cache film-tv-tracker.html writes on every save, same cache-then-reconcile shape as `statVaultSub()`/`statHorizonSub()`. Shows watchlist count, plus "N available now" / "N for bedtime" when non-zero; falls back to "Open app to set up" before the app's ever been opened. Wired into `refreshCardStats()` alongside the other sub-cards.

Also added `film-tv-tracker: 'screen'` to `PAL_NAV_SLUG_MAP` and a new `frame-screen` iframe (`film-tv-tracker.html`).

Tested: `node --check` on all three inline script blocks, an HTML tag-balance check, and a full cross-reference confirming every new id (`stat-screen`, `frame-screen`, `data-target="screen"`, `data-app="screen"`) is singular and doesn't collide with an existing one. Not tested live in a browser — first real open of the launcher with the new app registered is still outstanding.

## v10.90 (PET-095) — Two layout-system bugs, both reported directly

**(1) Cards with Card unchecked (or an embedded app's card, standalone off) were showing on the home screen anyway.** Root cause: `applyUserView()` runs on every load and sets `display:''` (visible) on every `.pete-only` element for Pete, unconditionally — including every managed card, before `loadLayoutConfig()`/`renderHomeGrid()` ever get a chance to run. `renderHomeGrid()` only ever explicitly touched the cards it was *showing*; anything not in that visible set was left exactly as `applyUserView()` had just set it — visible. Confirmed against the reported screenshots: Claim Tracker, Test & Issues, HTML Vault, and Horizon all had Card unchecked (or standalone off) yet all four were rendering. Fix: `renderHomeGrid()` now explicitly hides every `.app-card[data-app]` unconditionally first, then only re-shows the ones actually in the visible set — correct regardless of what state `applyUserView()`'s blanket unhide left them in. `renderNavIcons()` already did this correctly (it touches every app unconditionally, not just the visible ones), which is why nav icons weren't affected — only cards were.

**(2) Typing a new Order number didn't reorder anything else.** The old `layoutSetAppField()` just overwrote that one app's `order` value directly — if it collided with another app's existing number, or even if it didn't, nothing else moved. Replaced with `layoutMoveAppToOrder()`: the typed number is now treated as "move this app to this position," splicing it out of the current sequence and back in at the target index, then renumbering every app 0..n-1 to match — a real insert-and-shift. Tested against Pete's own screenshot scenario (Claim Tracker, currently order 8, moved to 2): correctly produces `gigs:0, gym:1, claims:2, budget:3, fantasy:4, food:5, reading:6, ti:7, fortnight:8, vault:9, horizon:10`.

**Also, in answer to Pete's question about whether there's a save step:** no — every field already auto-saves on its own `change` event, no separate Save button by design (confirmed this was already true; not a bug). Added one small improvement while in here: a "Layout saved" toast now confirms a successful sync, not just a failed one — there was previously no feedback at all on the success path, which made it reasonable to wonder whether anything had actually happened.

Verified via `node --check`, the reordering logic tested standalone with Pete's exact reported scenario, and the visibility fix traced through the actual call order (`applyUserView()` → blanket unhide → `loadLayoutConfig()` → `renderHomeGrid()`) to confirm the fix runs after and overrides the blanket unhide on every load and every settings change, not just some of them.

## v10.89 (PET-094) — Customizable home-screen layout

Pete's direct request, built over several messages of design discussion. Lets Pete regroup, reorder, resize (full/half width) and independently show/hide every app's nav icon and home card, plus choose "standalone" for the three apps that can otherwise live embedded inside another app's own tab (Claim Tracker/Fortnight Tracker, Horizon/On Budget, HTML Vault/Test & Issues). Pete-only — Lex's home screen is unaffected; every element the system touches already carries `.pete-only`, so `applyUserView()` hides it for her exactly as it always has, and `loadLayoutConfig()` is only ever called when `isPete` is true.

### Data model and sync

One new Supabase table, `pal_layout`, one row per user, `record_key` fixed at `'layout'`, holding the whole config as a single JSON blob under `data`:

```sql
create table public.pal_layout (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  record_key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, record_key)
);

alter table public.pal_layout enable row level security;

create policy "pal_layout_select_own"
  on public.pal_layout for select
  using (auth.uid() = user_id);

create policy "pal_layout_insert_own"
  on public.pal_layout for insert
  with check (auth.uid() = user_id);

create policy "pal_layout_update_own"
  on public.pal_layout for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

No delete policy — there's only ever one row per user, upserted in place, never deleted.

Same shape every other `pal_*`/app table already uses (`user_id`/`record_key`/`data`/`updated_at`), so `PalSync.table('pal_layout').upsert('layout', layoutConfig)` works with zero special-casing in `pal-sync.js`. Reading it deliberately does **not** use `PalSync.table().pull()` — `pull()` is built for bidirectional merge of arrays of many records against a local array; this is one fixed record holding one settings blob, so a plain `PalSync.sbFetch()` GET is the right tool. A `pal_layout_cache` localStorage key mirrors the last-loaded config, so the layout renders correctly offline or before the network round-trip completes — same "cache, then reconcile" shape every live-stat card already uses, just for settings instead of a stat.

`LAYOUT_APPS` is the static catalog (one entry per app this system knows about) with default order/width/visibility/group values that describe **today's actual layout exactly** — so the very first load, before Pete has ever saved anything, changes nothing visually. `mergeLayoutConfig()` reconciles a saved config against this catalog: an app added to the catalog later gets appended with its defaults; one removed from the catalog is silently dropped.

### Rendering

- **`renderNavIcons()`** — sorts every `.nav-btn[data-target]` by its configured order (CSS `order`, since the nav bar is already a flex row) and toggles `display` by `iconVisible`. Claims/Vault/Horizon's icon only ever shows when that app's `standalone` flag is also true — `iconVisible:true` alone can't reveal it while still embedded, which would otherwise open a second way into an app that's supposed to have exactly one.
- **`renderHomeGrid()`** — the genuinely tricky part, flagged as such before building it. Sorts visible cards by order, then walks the list: consecutive half-width cards get wrapped in a `.card-pair` (generalizing the fixed Fantasy Football/Food System pairing from PET-093 — any two adjacent half-width cards now pair, wherever they land after a reorder), a group label is inserted before the first card of each group, full-width cards go straight into the grid. Reparents the actual existing card elements (so each card's own stat spans/ids are never recreated, just moved) rather than rebuilding card content from a template.
- **Claims' two cards** — one lives nested inside Fortnight's own card (`#stat-claims-sub`, existing since PET-089), one is a new standalone card (`#stat-claims-standalone`). Exactly one is ever visible, driven by the `standalone` flag; `statClaimsSub()` now writes both via a small `setClaimsStat()` wrapper, so the underlying calculation is untouched and neither card can show stale data.

### Settings panel

`renderLayoutSettings()` builds the form inside a `<details id="layoutSettingsPanel">` (collapsed by default, per Pete's spec) at the bottom of the home screen: a groups list (label + order, add/rename/remove) above a table, one row per app (order number, full/half select, card/icon checkboxes, group dropdown, and — Claims/Vault/Horizon only — a standalone checkbox). Every control writes straight to `layoutConfig` and calls `saveLayoutConfig()` on its own `change` event — no separate Save button, so there's nothing to forget to press. The card/icon checkboxes are disabled (with a title tooltip explaining why) for the three standalone-capable apps until standalone is turned on, since neither has meaning while the app is still embedded.

### Standalone flags — the cross-file half of this feature

`applyStandaloneFlags()` writes each of the three apps' setting to a fixed localStorage key (`pal_standalone_claims`, `pal_standalone_vault`, `pal_standalone_horizon`) — same-origin localStorage, no `postMessage` involved. Each embedding parent now checks its own flag once at its own boot:

- `fortnight-tracker.html` v3.71 (FT-064) — hides the Claims tab if `pal_standalone_claims === 'true'`
- `on-budget.html` v3.75 (ON--071) — hides the Horizon tab if `pal_standalone_horizon === 'true'`
- `test-issues.html` v1.73 (TI-084) — hides the Vault tab if `pal_standalone_vault === 'true'`

This means each parent is correct even when opened directly, bypassing the launcher entirely — there's no message to have missed, no timing race with an iframe that may or may not be loaded yet. Per Pete's explicit choice, standalone **replaces** the embed rather than the two coexisting — going standalone is a one-way door for that app's access point (its own icon/card, not a second route alongside the embedded tab).

### Three new card stats

- **`statTiSub()`** — Test & Issues regains a card (removed at PET-068, when only its icon survived). Reads `ti_v1` directly: open issues (`status:'open'` or unset) plus open/untested tests, which live nested on `app.versions[].tests[]`, not a flat top-level collection.
- **`statVaultSub()`** — HTML Vault's first-ever card. This app has no local data model at all (talks straight to Supabase) — `html-vault.html` v1.8 (HTV-010) now caches `{count, updatedAt}` to `pal_vault_stat` on every load/save specifically so this card has something to read.
- **`statHorizonSub()`** — Horizon's first-ever card. Deliberately **not** any "net worth" or "at retirement" figure — those are output of Horizon's scenario-projection engine (compounding, inflation, mortgage modelling), and reproducing that here would be exactly the kind of duplicated-business-logic drift this suite has been bitten by before. Instead: the plain total across "growth" buckets (`growIndefinitely:true` — retirement/investment pots, excluding sinking funds and the emergency pot), summing each bucket's own transaction ledger (credits minus debits) — the same real-money arithmetic `computeBucketBalance()`/`simulateDepositReadyAge()` use internally for their own "pot" figure, just no growth/assumptions applied. One accepted edge case: a bucket whose balance hasn't been touched since before HZN-008 (v4.5, when buckets moved from a directly-set `currentBalance` to a transaction ledger) could in principle still be in the old shape in raw localStorage; falls back to the raw `currentBalance` for just that one bucket rather than silently showing 0, instead of replicating Horizon's own migration function.

### Backup panel

Converted from a permanently-open `<div>` to a collapsed-by-default `<details>`, Pete's request alongside the settings panel. Only the wrapper changed — every backup row, `backupAll()`, and the individual trigger functions are untouched; confirmed all 10 individual Download buttons plus Download All are still correctly wired after every change in this release.

### Testing

`node --check` on the full extracted script; the three new stat functions tested standalone with representative mock data (confirmed correct open-issue/test counts, vault count passthrough, and growth-bucket total including the "wrong bucket excluded" case); a structural diff against the previous shipped version confirming no other card, nav icon, stat function, or backup mechanism was touched; manual verification of the settings panel round-tripping to the new Supabase table.
