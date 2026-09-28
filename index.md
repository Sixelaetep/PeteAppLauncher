# P Apps Launcher — Changelog

Full version history for `index.html`. As of v10.89, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

## v10.93 (PET-098) — Layout wasn't syncing between devices

**Cause.** The launcher never calls `PalSync.initSession()` (that listens for an inbound `PAL_SESSION`, which the launcher *sends* to apps), and the only code that ever called `PalSync.setSession()` directly was the load-speed diagnostics removed at PET-092. Since then `PalSync.hasSession()` has been false in the launcher, and both `loadLayoutConfig()` and `saveLayoutConfig()` returned early on that check with no message. The layout has only ever been saved to `pal_layout_cache` in localStorage on the device it was edited on.

**Fix.**
- `layoutSyncReady()` hands PalSync the launcher's live `sbSession` (token + user id) immediately before every load and save, so it always uses the current refreshed token.
- `pullLayoutConfig()` reads the cloud row; if none exists but this device already has a customised local layout, it pushes that up once. Anything set up before this fix therefore reaches the cloud on the next launch of the device it was made on, and other devices then pick it up.
- Errors are no longer silent: a failed pull shows the PalSync error hint (e.g. table missing), a failed save shows the actual message, and saving while not signed in says it stayed on this device.
- The layout is re-pulled when the page becomes visible again (max once per 30s, skipped while the settings panel is open so an edit in progress isn't overwritten), so a device left open picks up changes without a reload.

**To finish setting up:** the `pal_layout` table and policies from v10.89 must exist in Supabase. If the table is missing, the new toast will now say so.

**Known limit.** Cloud wins on load; there is no per-field merge. If the same layout is edited on two devices while one is offline, the later save overwrites the other.

Verified with `node --check`; the session and upsert path was read against `pal-shared.js` (`setSession`, `sbFetch`, `table().upsert`, which throws on failure). Not run against live Supabase from here.

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
