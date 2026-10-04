# Pete Apps — Development Changelog

This is the consolidated historical development changelog for every application in the Pete Apps suite (P Apps launcher and the apps it hosts) and for the shared JavaScript components (`pal-shared.js`, `pal-gcal.js`). It replaces the individual per-app `.md` changelogs as the single historical development record for the whole ecosystem.

**Conventions used in this file**

- Newest first within every section. Version numbers, dates and feature/issue IDs are exactly as recorded in the source changelogs; a date appears only where the source gave one.
- ⚠ marks a discrepancy, reused ID, gap, superseded item or ambiguity carried over from the source. These are preserved, not corrected.
- Changes to shared JavaScript that affected several apps are recorded once under **Shared Components**. App sections keep a one-line pointer at the relevant version, plus any app-specific detail.
- Backlog, planned, deferred and open items are kept in clearly labelled sections and are **not** completed work.
- "Tested / Not tested" notes are kept in short form because the source changelogs consistently separate verified behaviour from assumptions.

## Application Index

| Application | File | Current / Latest Version | Changelog Coverage |
|---|---|---:|---|
| P Apps Launcher | `index.html` | v11.00 | v10.89 – v10.99 and v11.00. Earlier history is in inline comments in `index.html` (not supplied). ⚠ The v10.99 entry was added retrospectively (from the Gigs & Trips v7.101 release notes, not from a diff of the file) |
| Fantasy Football Tracker | `fantasy-football-tracker.html` | v1.48 | v1.0 – v1.48 (complete) |
| Film & TV Tracker | `film-tv-tracker.html` | v2.7 | v1.0 – v2.7 (complete). ⚠ v2.2 and v2.6 are each used for two builds |
| Fortnight Tracker | `fortnight-tracker.html` | v3.73 | v3.2 – v3.73. ⚠ Not recorded: v3.1, v3.7, v3.10–v3.16, v3.46, v3.51–v3.67 |
| Gigs & Trips | `GigsAndTrips.html` | v7.105 | v7.77 – v7.105 (GIG-072 onward). GIG-001 – GIG-071 remain as inline HTML comments (not supplied). Backlog rev 3 is recorded separately |
| Gym Tracker | `gym-tracker.html` | v2.109 | v2.32 – v2.109. ⚠ Not recorded: v2.33, v2.91 – v2.106; anything before v2.32 |
| Horizon | `horizon.html` | v4.12 (2026-09-26) | v1.0 (2026-08-05) – v4.12 (2026-09-26). ⚠ No standalone v3.0 entry (only v3.0.1) |
| HTML Vault | `html-vault.html` | v1.8 | v1.8 only. Earlier history is in `html-vault.html` inline comments (not supplied) |
| On Budget | `on-budget.html` | v3.81 | v1.0 – v3.43 and v3.73 – v3.81. ⚠ v3.44 – v3.72 are kept inline in `on-budget.html` (not supplied); v3.14 and v3.21 have no entry; v3.22 – v3.24 retired |
| Reading Tracker | `reading-tracker.html` | v3.70 | Selected entries only: v3.29, v3.30, v3.32, v3.33, v3.47 – v3.52, v3.69, v3.70 |
| Test & Issues | `test-issues.html` | v1.77 | v1.73 – v1.77. Earlier history is inline in `test-issues.html` (not supplied) |

**Applications referenced in the changelogs but with no changelog supplied**

| Application | Current / Latest Version | Where it is recorded |
|---|---:|---|
| PeteGCal (`PeteGCal.html`) | v1.0 | Launcher v10.98 (PET-103 / PGC-003); `pal-gcal.js` |
| Claim Tracker (`claim-tracker.html`) | Not established | Embedded in Fortnight Tracker (FT-041, FT-062, FT-064); CLA-013, CLA-014 referenced |
| Meal Planner | Not established | MP-045 referenced (sync audit); out of scope for pal-sync compaction |
| Food System | Not established | Launcher card referenced only |
| pal-fpl-proxy (Supabase Edge Function) | v1.4 | Fantasy Football Tracker v1.0, v1.16, v1.17, v1.19 |

**Shared components**

| Component | Latest version established | Notes |
|---|---:|---|
| `pal-shared.js` | pal-config section v1.2; pal-sync section v1.13 | Combined bundle of pal-config.js + pal-sync.js + pal-utils.js. The three standalone files are retired (no app loads them) |
| `pal-gcal.js` | v3 | Google Calendar access layer; consumers PeteGCal and Gigs & Trips |

---

# Shared Components

## `pal-shared.js`

Combined bundle of `pal-config.js` + `pal-sync.js` + `pal-utils.js`, concatenated in that load-order-critical order (config sets `window.PAL_CONFIG` before sync and utils reference it). Each section is byte-identical to its original standalone file. Loaded as `<script src="pal-shared.js?v=X.X">`. Rows handled by the sync section are shaped `{ user_id, record_key, data, updated_at }`; the library never touches an app's own localStorage or data model.

### Bundle consolidation — three script tags replaced by one `pal-shared.js`

- The three separate `<script>` tags (`pal-config.js`, `pal-sync.js`, `pal-utils.js`) were replaced with one `pal-shared.js` tag. No code inside any section changed; the purpose was fewer requests.
- Verified per app with `node --check` and a manual reload confirming sync / theme / esc / uid / toast.
- Affected applications (each recorded in its own changelog):
  - Fantasy Football Tracker v1.47 (FF-019)
  - Fortnight Tracker v3.69 (FT-063)
  - Gym Tracker v2.107 (GYM-095)
  - On Budget v3.74 (ON--070)
  - Reading Tracker v3.70 (MR-055)
  - Horizon v4.12 (HZN-014, 2026-09-26)
- Not converted at that point: the Claim Tracker iframe nested inside Fortnight Tracker still loaded its own three tags (FT-063).
- Cache-busting conventions recorded in the app changelogs:
  - Launcher deliberately keeps `pal-shared.js?v=10.87`, which tracks when the shared file last changed rather than the launcher's own version (v10.93, v10.96).
  - Film & TV Tracker moved to `?v=1.8` alongside pal-sync v1.12 (FTT-013).
  - Gym Tracker and On Budget bump the query string in step with their own version (Gym v2.108/v2.109; On Budget v3.81).
  - Horizon v4.8 (HZN-010) first added `?v=` cache-busting to `pal-config.js` / `pal-sync.js`, tied to its own version.

### `PalSync.trimIfLarge(key, maxKB)` — TI-086

**Introduced in Test & Issues v1.75**

- New shared function, purely additive, added to the public return block. Deletes a localStorage key once it exceeds `maxKB`, so the app's existing pull from Supabase repopulates it fresh. Size measured as UTF-16 bytes (`(key.length + raw.length) * 2`).
- Safety rule: skips entirely if `PalSync.retryQueueLength() > 0` (writes still pending). Returns a result object (`{ trimmed, reason, sizeKB, ... }`) rather than logging, so each app reports it in its own way.
- Must be called only after a completed pull with a live session. Never call it in `onNoSession` (no cloud copy to restore from, so trimming would be real data loss).
- Explicitly **not** valid for Gigs & Trips: its bespoke sync layer never routes through `PalSync.table()`, so `retryQueueLength()` says nothing about its pending writes.
- Reason: a Safari storage-quota error found in Gigs & Trips was traced to shared per-origin storage pressure across the suite; `ti_v1` was the largest single contributor at ~2 MB.
- Framed in the source as a drift/staleness guard, not a permanent size reduction: normal save-on-edit rewrites the full dataset afterwards.
- Tested: all four branches (missing key; under threshold; over threshold with no pending writes → trims; over threshold with pending writes → does not trim) once in Node for TI-086; not re-tested per app.
- Affected applications (adopted):
  - Test & Issues v1.75 (TI-086): 500 KB, `onSession` made async, called after `syncPull()`.
  - Film & TV Tracker v2.7 (FTT-039): 2048 KB, deliberately above the real ~1.2 MB library; safety net only.
  - Fortnight Tracker v3.73 (FT-065, 3 Oct 2026): 500 KB, called inside the `pullFromCloud()` success callback.
  - ⚠ FT-065 says the mechanism was rolled out "across the suite this round … and several others"; the other apps are not named in the supplied material.
- Follow-up: Test & Issues v1.76 (TI-087) found the trim never fired in the reported quota case.
- Further follow-up: Test & Issues v1.77 (TI-089) stops caching its ~2 MB locally at all; see `PalSync.cacheSet()` below. The `trimIfLarge('ti_v1', 500)` call is left in place and is now effectively inert for that key.

### `PalSync.cacheSet(key, value, opts)` and `PalSync.storageUsage()` — TI-089

**pal-sync section v1.13. Introduced in Test & Issues v1.77.** Purely additive: two new members on the public object, no existing function changed, so any app that does not call them behaves exactly as before.

- `storageUsage()` — read-only scan of the origin: `{ totalKB, keys: [{ key, kb }] }`, largest first, same `(key + value) * 2` UTF-16 basis as `trimIfLarge`. Returns `null` if localStorage is unavailable.
- `cacheSet(key, value, { maxKB, cloudSafe })` — quota-safe write for a key that is only a cache of Supabase. Never throws. Returns `{ stored, mode, kb, ... }`:
  - `mode: 'cloud-only'` — value is over `maxKB`, the caller asserts `cloudSafe` (nothing unsynced), there is a live session and `retryQueueLength() === 0`: nothing is written and a stale copy of the key is removed (`freedKB` reported).
  - `mode: 'local'` — written.
  - `mode: 'failed'` — the browser refused; `quota: true` when the reason was space.
  - In every case where any of the four conditions does not hold, it writes rather than skips.
- The library cannot see an app's own failed pushes, so `cloudSafe` is the caller's claim. Not valid for Gigs & Trips (bespoke sync; `retryQueueLength()` says nothing about its pending writes) — same rule as `trimIfLarge`.
- Adopted by: Test & Issues v1.77 (300 KB cap). Available to every other app; none has adopted it yet.
- Cache-busting: Test & Issues loads `pal-shared.js?v=1.77`. The launcher still loads `?v=10.87` (it does not use the new functions) and other apps keep their existing query strings, so they keep running the previous copy until they next bump it — safe because the change is additive.
- Tested: see Test & Issues v1.77 (unit checks of every `cacheSet` branch and `storageUsage`, plus `trimIfLarge` regression). Not tested in a real browser.

### pal-sync section — version history

Recorded in the pal-sync section header of `pal-shared.js` (no dates given). App cross-references are listed only where an app changelog records them.

- **v1.13 — storage helpers (TI-089).** `storageUsage()` and `cacheSet()`; additive, see the section above. Affected: Test & Issues v1.77.
- **v1.12 — opt-in shared mode.** `table(name, { shared: true })` and `fetchTableRows(name, { shared: true })`. Shared fetch drops the `user_id` filter (RLS is the boundary), orders by `record_key` then `user_id`, and collapses duplicate `record_key`s to the newest `updated_at`. Shared upsert PATCHes by `record_key` alone and omits `user_id` from the PATCH body (no forked copy, no ownership change); POST of a new record still stamps the caller's `user_id`. The flag is carried in the retry queue. Compaction stays per-user. Callers without the flag behave byte-for-byte as before.
  - Affected: Film & TV Tracker v1.8 (FTT-013) — `pal_film_tracker` titles, services and settings. Must be deployed together with the app.
- **v1.11 — tombstones no longer forgotten after one pull.** `pull()` no longer strips every `_deleted:true` record from `merged`; only deletes the cloud has confirmed leave the working set. An unconfirmed local tombstone whose id already exists in cloud is re-pushed on every pull (`retriedDeleteCount`). Root cause traced via On Budget ON--049 / ON--050 (resurrection of deleted records).
  - Consequence: `merged` can now contain `_deleted:true` records, so every app must filter `!record._deleted` at render/calc time.
  - Audit recorded in the header: Reading Tracker and Test & Issues needed filtering added; Fortnight Tracker had it for codes but not bundles; On Budget, Gym Tracker and Claim Tracker already compliant. Fortnight Tracker's follow-up is v3.33 (FT-030).
- **v1.10 — tombstone compaction**, the suite's only sanctioned hard `DELETE`: `countCompactableTombstones(table, days)` and `compactTombstones(table, days)`. Targets rows that are both tombstoned (`data->>_deleted = true`) and older than the threshold (default 90 days, clamped to a 30-day minimum). Not automatic; apps show a count-then-confirm button. Gigs & Trips and Meal Planner (bespoke shared sync) out of scope.
- **v1.9 — pagination and persisted retry queue.** `fetchTableRows()` requests 1,000-row pages with a `Range` header, ordered by `record_key`, `Prefer: count=exact`, looping until the `Content-Range` total is reached, and fails loudly if pagination stalls. The 401 retry queue is mirrored to localStorage key `pal_retry_queue_v1` and rehydrated at load; entries are `{ tableName, prefix, id, data }`. Because the origin is shared, any app with a live session can flush any app's stranded writes.
- **v1.8 — 401 retry queue and shared error hints.** `table().upsert()` queues a write that fails with 401 and still re-throws; the queue flushes automatically on the next session arrival. New `flushRetryQueue()`, `retryQueueLength()`, `errorHint(status, message)` (lifted from Gym Tracker's local `syncErrorHint()`).
  - On Budget v3.19 (ON--031) wired `onRetryFlushed` and shows "N pending sync".
  - Gym Tracker v2.52 (GYM-048) removed its own `syncErrorHint()` wrapper (added in v2.29).
- **v1.7** — `tombstone()` takes an optional `updatedAtField` (camelCase apps had been building tombstones by hand).
- **v1.6** — `PalSync.setSession(token, userId)` for sessions obtained outside the `PAL_SESSION` postMessage flow (Reading Tracker and Gigs & Trips standalone logins cited). Launcher v10.96 (PET-101) uses it via `feedPalSyncSession()`.
- **v1.5** — thrown errors carry `.status`.
- **v1.4** — local-only records are pushed exactly as they are, including `_deleted:true` ones (offline deletes reach the cloud). On Budget v3.16 migrated against "pal-sync.js (now v1.4)".
- **v1.3** — optional `preFetchedRows` (4th arg to `pull()`), new `fetchTableRows(tableName)`, and the tie-break changed to cloud-wins (`>=`). Used by On Budget v3.16 (seven record kinds, one fetch) and Fortnight Tracker v3.17 (preFetchedRows pattern from Test & Issues).
- **v1.2** — `pull()` takes `updatedAtField` (Test & Issues uses camelCase `updatedAt`; previously every comparison silently evaluated false).
- **v1.1** — optional `prefix` per `table()` instance (several record kinds in one table).
- **v1.0** — extracted from Claim Tracker's sync layer as the one canonical pattern.

**Known library property recorded by several apps:** `table().pull()` only pushes records whose id is missing from cloud (or unconfirmed tombstones). It does not push an edit to a record that already exists in cloud. Horizon v1.16 and Reading Tracker v3.30 (MR-016) each worked around this with explicit direct upserts.

**App migrations onto pal-sync recorded in app changelogs:** Fortnight Tracker v3.9 (FT-003); On Budget v3.16; Horizon v1.16; Film & TV Tracker v1.0 (built on it). Gigs & Trips is deliberately not on PalSync (bespoke sync; GIG-055 "closed: leave as-is").

### pal-config section

- **v1.2 (FTT-001)** — added `TMDB_API_KEY` / `TMDB_READ_TOKEN`; only the v4 read token is used. Affected: Film & TV Tracker v1.0.
- **v1.1 (FF-002 follow-up)** — added `FF_PROXY_KEY` (the shared header value for `pal-fpl-proxy`). Affected: Fantasy Football Tracker v1.2, which moved the key out of the app file.
- `KNOWN_USERS` maps the Pete and Lex Supabase user ids to display info. Used by Fantasy Football Tracker v1.29 (allow-list check) and as the source of the two UIDs in the launcher v10.92 RLS migration for `pal_film_tracker`.

### pal-utils section

- Origin: the PAD-1 audit found the same helpers reimplemented across apps (esc/escHtml ~9 times, applyTheme ~8, todayISO / toast / closeModal / uid 4–7 each).
- Functions: `esc` / `escHtml` (null-safe, escapes `& < > " '`; fixed Fortnight Tracker's escHtml throwing on null and Reading Tracker's esc rendering "undefined"), `todayISO`, `toast` / `showToast` (2800 ms), `applyThemeCore(isDark, colors)` (attribute-setting only; per-app colours stay local), `closeModal(id)` (removes the `open` class), `uid(prefix)`.
- Gigs & Trips' and Fortnight Tracker's zero-argument `closeModal()` were deliberately not included.
- App-specific effects recorded:
  - Horizon v4.10 (HZN-012, 2026-09-26) deleted its local `escHtml()` and `uid()`.
  - Fantasy Football Tracker v1.27 calls `applyThemeCore` at boot to sync the meta theme-colour.
  - Film & TV Tracker v1.1 (FTT-002) declares its own `closeModal(id)` because it uses `.modal-overlay.hidden`, so the shared version was a silent no-op.
  - Gigs & Trips backlog records the GIG-050/052/053 load-speed and pal-utils work as complete.

## `pal-gcal.js`

Shared Google Calendar access layer, kept separate from `pal-shared.js` on purpose (pal-shared.js loads in every app; this module was unproven). Scope `https://www.googleapis.com/auth/calendar.events`. The Google Identity Services script must load before it. App metadata is stored in `extendedProperties.private` under the key `petegcal` (`META_NAMESPACE`). Access is client-side only: a GIS access token (~1 hour), silent refresh while the page is open, no refresh token.

Public API: `init`, `signIn`, `signOut`, `hasToken`, `getTokenExpiry`, `requestTokenRefresh`, `errorHint`, `withAppMeta`, `readAppMeta`, `listEvents`, `listInstances`, `createEvent`, `updateEvent`, `deleteEvent`, `getEvent`.

Affected applications: PeteGCal (first consumer) and Gigs & Trips.

### v3 — GIG-115

**Gigs & Trips v7.102**

- `listEvents` gains optional `opts`: `singleEvents` (default true; `false` returns recurring masters plus individually changed/cancelled instances; `orderBy=startTime` is only sent when expanding), `showDeleted`, `updatedMin`, `pageSize`.
- New `listInstances(calendarId, masterEventId, timeMin, timeMax, opts)`, paginated.
- Defaults unchanged, so PeteGCal and every existing call behave exactly as before.
- Tested in Node with a stubbed fetch (default parameters identical to v2; no `orderBy` when un-expanded; pagination; instances URL and encoding).
- Gigs & Trips v7.103, v7.104 and v7.105 record `pal-gcal.js` as unchanged (still v3). v7.105 adds the write path for repeating events on top of the existing `createEvent` / `updateEvent` (with `expectEtag`) / `deleteEvent`; the event metadata for a series carries `kind:'series'` alongside `app:'gigs-and-trips'`.

### v2 — `updateEvent` `expectEtag`

**Gigs & Trips v7.97**

- `updateEvent(calendarId, eventId, patchBody, meta, opts)` with `opts.expectEtag`: if the event's etag in Google differs, the update is refused with error code `etag-mismatch`, status 412, `e.data` = current event. Reuses the GET that the meta merge already makes, so no extra call.
- Callers that do not pass `opts` are unaffected.
- Gigs & Trips script tag moved to `?v=2`; PeteGCal still loads `?v=1` and is unaffected.
- ⚠ ID discrepancy: the `pal-gcal.js` header attributes v2 to GIG-102; the Gigs & Trips v7.97 changelog attributes it to GIG-115 ("reduced"). Both preserved.

### v1 — PGC-002

**Introduced with PeteGCal — launcher v10.98 (PET-103 / PGC-003)**

- New shared module: Google OAuth (sign-in, silent token refresh about 5 minutes before expiry), list/create/update/delete/get wrappers, and `withAppMeta` / `readAppMeta` helpers. `init` takes `onAuthChange`, `onTokenRefreshed`, `onAuthError` and `onInitFailed` (fires if the Google script never loads after ~20 attempts).
- Underlying API calls proven via the `gcal-test.html` spike page.
- Adopted by Gigs & Trips v7.77 (GIG-072), reusing PeteGCal's OAuth Client ID (one Client ID per origin).
- Constraints recorded in the Gigs & Trips backlog against the original version: `listEvents` hard-coded `singleEvents=true` and `orderBy=startTime` (made optional in v3); `updateEvent` with `meta` makes two calls (GET then PATCH); the metadata key is shared with PeteGCal (AD-9: keep `petegcal`, add an `app:'gigs-and-trips'` field — done in Gigs & Trips v7.94).

---

# Application Development History

# P Apps Launcher

`index.html`. From v10.89, full entries live in `index.md`; the inline HTML comment keeps a short pointer only.

### v11.00 — PET-104 — Test & Issues card reads `pal_ti_stat`

- Companion to Test & Issues v1.77 (TI-089). `statTiSub()` now reads the small `pal_ti_stat` summary first (`openIssues`, `openTests`) and falls back to parsing `ti_v1` exactly as before, so the card works with both the new and an older Test & Issues build. A corrupt `pal_ti_stat` also falls back to `ti_v1`; with neither key the card says "Open app to load".
- Why: Test & Issues no longer keeps `ti_v1` in the browser when it is large (it was exhausting the shared storage quota), so the card would otherwise have shown "Open app to load" permanently.
- Version: title and nav badge set to v11.00. `pal-shared.js?v=10.87` deliberately unchanged (the launcher does not use the new pal-sync v1.13 functions).
- ⚠ Version numbering: the supplied `index.html` was v10.99 although the previous changelog entry is v10.98 (v10.99 is referenced only by Gigs & Trips v7.101 and its `statGigs` comment about `gat_v1`). v10.99 has no entry of its own; this release continues from the file, not from the changelog. v11.00 was chosen rather than v10.100 so versions still sort sensibly.
- Tested: `statTiSub` extracted from the real `index.html` and run against the new key, the old key, both, neither, and a corrupt key (6 checks); `node --check` on the launcher's inline script. Not tested: the launcher in a browser, the card refreshing live while Test & Issues is open.

### v10.99 — Gigs & Trips card reads `gat_v1` directly; skips repeating-series records

- ⚠ Recorded retrospectively. This version shipped with Gigs & Trips v7.101 (AD-7) and was the base for v11.00, but had no entry. Reconstructed from the Gigs & Trips v7.101 release notes, not from a diff of the file.
- `statGigs()` reads `gat_v1` only (previously `gat_v1_clean` with a fallback to `gat_v1`) and drops tombstones itself. Gigs & Trips stopped writing `gat_v1_clean` in v7.101 and removes a stale copy at startup, so an older cached launcher still fell back correctly and a stale copy could not be read.
- Repeating-series records (`ev.recurrence`) are skipped, so a repeating event is not shown as a one-off on its first date; individually changed occurrences (ordinary gigs) still count; data containing only a series shows "Nothing upcoming".
- Version: title and nav version badge set to v10.99.
- Tested in Node: `statGigs` extracted from the real file — reads `gat_v1` with no clean copy present, drops tombstones, skips series records, counts changed occurrences, shows "Nothing upcoming" for series-only data, ignores a lingering `gat_v1_clean`; `node --check` on the inline script. Not tested: the launcher in a browser, the card on screen.

### v10.98 — PET-103 / PGC-003 — PeteGCal added: new app, nav icon, home card, iframe

- PeteGCal (`PeteGCal.html` v1.0) is a new standalone app, not a replacement for Gigs & Trips (untouched). It treats Pete's primary Google Calendar (shared with Lex at edit access) as the source of truth. v1.0 is a read-only agenda: Google sign-in, events from −14 to +180 days, grouped by day.
- Later phases, not built: create/edit/delete (PGC-004), conflict detection (PGC-005), trip-spanning (PGC-006).
- Calendar ID hardcoded to Pete's account email rather than `'primary'` (which resolves to whoever is signed in, so Lex would see her own calendar).
- Full mirror, no exclusions: app-created events show their type via `readAppMeta()`; native entries show a plain "Calendar" tag.
- New shared module `pal-gcal.js` — see Shared Components.
- Launcher changes: `LAYOUT_APPS` entry `petegcal` (order 12, full width, card + icon visible); nav icon 🗓️ (`#4f46e5`, after Film & TV Tracker); home card with a static "Open app" stat; lazy iframe `frame-petegcal`; `PAL_NAV_SLUG_MAP` entry `'PeteGCal': 'petegcal'`.
- Known limitation (accepted): PeteGCal needs a live Google sign-in; no local fallback. A failed refresh shows "Reconnect needed" and returns to the sign-in gate.
- Open item: Lex's write access to Pete's shared calendar was confirmed once only; recheck before PGC-004.
- Tested: `node --check` on index.html, PeteGCal.html and pal-gcal.js; structural diff against v10.97. Not tested: PeteGCal.html in a browser, the launcher icon/card/iframe click-through.

### v10.97 — PET-102 — On Budget card: tappable columns, Food Spend / Bills Spend buttons

- Food & Travel column opens On Budget on **Spending**; Bills column opens **Bills → Ledger**. A small › on each label is the only tap cue.
- The single "+ Add spend" button is replaced by **+ Food Spend** (existing food/travel sheet) and **+ Bills Spend** (Bills Ledger "Add transaction" sheet), each under its column. Static markup, so present even in "No data yet" states.
- New `launchOBAction(e, action)` uses the same ensureLoaded → switchTo → `OB_ACTION` sequence as `launchOBAddSpend` (unchanged). Bills Spend does not reuse `openBillsSheet` (that opens the Recurring sheet).
- Cross-file dependency: on-budget.html v3.81 (ON--075) adds `openSpendingTab`, `openBillsTab`, `openBillsTxSheet`. Deploy together or app first; a new launcher with v3.80 degrades gracefully.
- Interpretation to confirm: the old single button was replaced, not kept alongside.
- Known and unchanged: at half width the balance figure clips at 390px (same in v10.96).
- Tested: 28 headless checks with the real on-budget.html in the iframe. Not tested: physical phone, live Supabase, submitting a transaction.

### v10.96 — PET-101 — Layout changes now sync between devices

- Bug: layout edits on one device never reached another.
- Root cause: `loadLayoutConfig()` / `saveLayoutConfig()` only talk to Supabase when `PalSync.hasSession()` is true, but the launcher never passed its own `sbSession` to PalSync, so layout only lived in each device's `pal_layout_cache`.
- Fix:
  - New `feedPalSyncSession()` calls `PalSync.setSession()` on sign-in (before `applyUserView()` → `loadLayoutConfig()`), on each token refresh, and clears it on lock.
  - New `pal_layout_dirty` localStorage flag: an unconfirmed local edit wins over the cloud copy on load and is re-pushed.
  - Cloud read extracted to `syncLayoutFromCloud()`, also run on `visibilitychange` (skipped while the layout panel is open).
  - Publishes the local layout if the cloud has no row yet; save failures report `PalSync.errorHint` (401/403/404); not signed in reports "Saved on this device only".
- First use: `pal_layout` was empty, so the first device to open v10.96 publishes its layout.
- Requires the `pal_layout` table and RLS from v10.89. `pal-shared.js` unchanged (`?v=10.87` kept).
- Tested: two-device simulation against a fake Supabase with the real pal-shared.js; the same suite fails all cloud checks on v10.95. Not tested: real browser/Supabase, physical phone, Lex's view.

### v10.95 — PET-100 — Film & TV Tracker card: top 3 favourites

- Card shows "Top favourites" with three posters and titles under the existing counts line, read from `topFavourites` in `pal_ftt_stat` (Film & TV Tracker v2.5).
- If the cache has no `topFavourites` key, derives them from `ftt_v1` using the tracker's ordering rule; once the key exists (even empty), `ftt_v1` is not read again.
- Titles and poster URLs HTML-escaped; posters used only if plain `https://`. Tiles 80px, 2:3 posters, titles clamped to two lines.
- Header badge and `<title>` bumped together.
- Tested: 30 checks plus a 6/6 round trip with the real tracker in the iframe. Not tested: signed-in session, live TMDB posters, physical phone, Lex's account.

### v10.94 — PET-099 — On Budget card: lead with card balance in Increasing mode

- Food & Travel column leads with the real card balance in Increasing (credit card) mode, with "(£X left of budget)" as a smaller sub-line, matching on-budget.html v3.80.
- Reads `summary.cardBalance` and `summary.potDirection`; Decreasing mode or an older save without these fields falls through to the previous pot-led display.
- Tested in jsdom with the app's screenshot data.

### v10.93 — PET-098 — Version drift fix

- Header badge (`.nav-version`) still read v10.90 while `<title>` read v10.92 (v10.91 and v10.92 did not bump the badge). Both now v10.93; inline pointer comments added for v10.91–v10.93.
- `pal-shared.js?v=10.87` deliberately left as-is.

### v10.92 — PET-097 — Film & TV Tracker shared with Lex

- Reviewed the Gigs & Trips sharing pattern first: it does not use PalSync; its RLS requires `auth.uid() = ANY(ARRAY[<Pete>, <Lex>])`, with `user_id` stamped for authorship only.
- Concluded `film-tv-tracker.html` needed no code change (the launcher's `PAL_SESSION` relay is already per signed-in user).
- Launcher: the "screen" nav-btn and app-card lost their `pete-only` class (the only thing `applyUserView()` checks for Lex).
- Supabase migration for Pete to run: drop `pal_film_tracker_select_own` / `_insert_own` / `_update_own`; create `pal_film_tracker_select_shared` / `_insert_shared` / `_update_shared` using `auth.uid() = ANY (ARRAY['<Pete uid>', '<Lex uid>']::uuid[])` (UIDs from `PAL_CONFIG.KNOWN_USERS`). `user_id` stays on every row; no data migration.
- Consequence: Lex sees Pete's entire existing library immediately.
- ⚠ Follow-up: Film & TV Tracker v1.8 (FTT-013) later found PalSync itself filtered by `user_id`, so Lex still saw nothing; fixed by pal-sync v1.12 shared mode.
- Not tested: the SQL, Lex's home screen after migration.

### v10.91 — PET-096 — Film & TV Tracker registered

- New nav-btn/app-card pair `data-target="screen"` (🎬, `--app-color:#2dd4bf`), after Food System; always-on pattern (not the hidden-until-standalone pattern).
- `LAYOUT_APPS` `{ id:'screen', order:11, width:'full', cardVisible:true, iconVisible:true }`.
- `statScreen()` reads `pal_ftt_stat` (`{ watchlistCount, availableNow, bedtimeNow }`); "Open app to set up" before first open. Wired into `refreshCardStats()`.
- `PAL_NAV_SLUG_MAP` `film-tv-tracker: 'screen'`; new iframe `frame-screen`.
- Companion registration: Test & Issues v1.74 (TI-085).

### v10.90 — PET-095 — Two layout-system bugs

- (1) Cards set to hidden still showed: `applyUserView()` unhides every `.pete-only` element for Pete before the layout renders, and `renderHomeGrid()` only touched cards it was showing. Fix: `renderHomeGrid()` hides every `.app-card[data-app]` first, then shows the visible set. Nav icons were already correct.
- (2) Typing an Order number did not reorder others. `layoutSetAppField()` replaced by `layoutMoveAppToOrder()` (splice and re-insert, renumber 0..n-1). Verified with the reported scenario (Claim Tracker 8 → 2).
- Every field already auto-saves on change (no Save button by design); a "Layout saved" toast now confirms success.

### v10.89 — PET-094 — Customizable home-screen layout

- Pete-only (Lex unaffected). Regroup, reorder, full/half width, independent card/icon visibility, and "standalone" for the three embeddable apps: Claim Tracker (inside Fortnight Tracker), Horizon (inside On Budget), HTML Vault (inside Test & Issues).
- **Data and sync:** new Supabase table `pal_layout` (`id uuid pk`, `user_id`, `record_key` fixed at `'layout'`, `data jsonb`, `updated_at`, unique `(user_id, record_key)`), RLS select/insert/update own, no delete policy. Write via `PalSync.table('pal_layout').upsert('layout', layoutConfig)`; read via a plain `PalSync.sbFetch()` GET; `pal_layout_cache` mirrors the last config.
- `LAYOUT_APPS` catalogue defaults describe the existing layout exactly; `mergeLayoutConfig()` appends new catalogue apps and drops removed ones.
- **Rendering:**
  - `renderNavIcons()` sorts by CSS `order` and toggles by `iconVisible`; embeddable apps' icons show only when standalone.
  - `renderHomeGrid()` reparents existing card elements; consecutive half-width cards become a `.card-pair` (generalising the fixed Fantasy Football / Food System pairing from PET-093); group labels inserted.
  - Claims has two cards (`#stat-claims-sub` nested in Fortnight's card since PET-089, new `#stat-claims-standalone`), both written via `setClaimsStat()`.
- **Settings panel:** `renderLayoutSettings()` inside a collapsed `<details id="layoutSettingsPanel">`; groups list plus one row per app; every control saves on change.
- **Standalone flags:** `applyStandaloneFlags()` writes `pal_standalone_claims`, `pal_standalone_vault`, `pal_standalone_horizon`. Each host checks its own flag at boot: fortnight-tracker v3.71 (FT-064), on-budget v3.75 (ON--071), test-issues v1.73 (TI-084). Standalone replaces the embed.
  - ⚠ on-budget.md records v3.75 as ON--069 (hero-card sub-line) with no standalone-flag entry, and uses ON--071 for v3.77.
- **New card stats:**
  - `statTiSub()` — Test & Issues card restored (removed at PET-068): open issues plus open/untested tests nested in `app.versions[].tests[]` from `ti_v1`.
  - `statVaultSub()` — HTML Vault's first card, from `pal_vault_stat` (html-vault v1.8, HTV-010).
  - `statHorizonSub()` — Horizon's first card: plain total of growth buckets' transaction ledgers (`growIndefinitely:true`), no projection maths; falls back to raw `currentBalance` for a bucket not yet in ledger shape (pre-HZN-008).
- Backup panel converted to a collapsed `<details>`; all 10 individual Download buttons and Download All still wired.
- Tested: `node --check`; the three stat functions with mock data; structural diff; manual settings round trip to `pal_layout`.

### Launcher changes recorded only in other apps' changelogs

These launcher (`index.html`) changes are described in other changelogs; their launcher version numbers are not recorded in `index.md`.

- PET-068 — Test & Issues card removed (icon kept); restored by v10.89. Also cited by Gym Tracker v2.73 ("PET-068 / GYM-071") for `round2()` ported into `statGym()`.
- PET-075 — Horizon home card removed (Horizon v4.3 / On Budget context).
- PET-086 — Fantasy Football next-gameweek deadline on the dashcard via `statFantasy` (Fantasy Football v1.30).
- PET-089 — Claim Tracker nav icon and home card removed; Fortnight card gains a Claims sub-stat line (Fortnight v3.68).
- PET-090 — Horizon nav button removed (On Budget v3.73).
- PET-093 — Fantasy Football / Food System half-width pairing (generalised in v10.89).
- Fantasy Football v1.35 — `statFantasy()` fixed to read the per-user scoped `ff_squad_cache_u_…` key.
- Fortnight Tracker v3.43 — launcher listens for `FT_DATA_UPDATED` and calls `refreshCardStats()`.
- Fortnight Tracker v3.47 — Claim Tracker dashcard repointed via `launchFortnightClaims()` / `FT_ACTION`.
- Gym Tracker v2.64 — nutrition progress bars on the Gym card; full-width change removing the `#pairGymReading` wrapper.
- Gym Tracker v2.69 — water intake on the Gym card.
- On Budget v3.41 (ON--045) — "+ Add spend" quick-action button sending `openFoodSheet` (replaced in v10.97).
- ⚠ Gigs & Trips v7.101 — "optional launcher release (v10.99) reads `gat_v1` directly". No v10.99 entry exists in `index.md` (latest recorded v10.98).

---

# Fantasy Football Tracker

`fantasy-football-tracker.html`. The source states the same entries are kept in the changelog comment at the top of the app's script block. Versions are mirrored in five places: `<title>`, the nav badge (`#navVer`), `pal-shared.js?v=`, the `FF_VERSION` constant, and the export backup `appVersion` (which reads `FF_VERSION` from v1.48).

Supabase tables used: `ff_settings`, `ff_squad_cache`, `ff_score_history`, `ff_advice_cache`, `ff_transfer_log`, `ff_external_check`, `ff_manual_lineup`. Live data comes through the `pal-fpl-proxy` Edge Function.

### v1.48 — FF-020

- Locked-in / planned transfers no longer linger once FPL confirms the same transfer.
- Root cause: in `syncTransfersFromFPL()` the "already in the log" check ran before the step that upgrades a matching planned/locked entry, so a confirmed FPL transfer could never absorb a later manual entry (double-counting in the running total and free-transfer slots). Separately, `pullRemoteTransferLog()` merges by id (union), so a manual entry removed on one device could be resurrected.
- Fix: new idempotent `reconcileTransferLog()` — pairs each manual planned/locked/made entry with a synced `'auto'` FPL entry for the same player out + player in (one-to-one; ignores FPL transfers from a clearly earlier gameweek), keeps the FPL entry, carries the manual note across, removes the manual one. Runs after every sync, after loading from cache, after the cross-device merge (re-persists so Supabase heals) and when a lock-in is added for a swap FPL already shows. Sync no longer upgrades in place: one code path.
- Export backup `appVersion` was hard-coded `'1.46'`; now reads `FF_VERSION`.
- No data-model or schema change; existing logs heal on first load.

### v1.47 — FF-019

- Adopted the combined `pal-shared.js`. See Shared Components.

### v1.46

- Second, lower risk tier on squad cards: 🩹 for any milder injury flag (doubtful with decent/unknown chance, any non-`'a'` status, or status `'a'` with FPL news text). 🚑 (v1.45) unchanged.

### v1.45

- 🚑 icon next to genuinely at-risk players on Live and Locked-in cards, reusing `isEffectivelyUnavailable()` unchanged (the same gate used for the suggested XI and captaincy). Hover shows status, chance % and FPL news. Additive to the existing colour dot.

### v1.44 — FF-017 Phase E

- External tab gains a "Review session" banner (brief §14/§15) reusing `getReviewSessionStatus()`; STALE shows the reason and a Refresh & Analyse button (`refreshAndAnalyse()`). Refreshed after every analysis and on tab switch.
- Closes the remaining scope of the FF-017 Gameweek Review Session brief.

### v1.43 — FF-018

- Advice tab key sections (Gameweek Summary, Things to Watch, Recommended Team, Captain/Vice, Transfer Opportunities, Player Watchlist, External Review) are now individually collapsible, default expanded.
- In the "🔎 External advice considered" banner, the itemised detail (XI adjustments, unresolved flags, "Differs from an external AI's own recommended XI", external transfer advice) is wrapped in its own auto-collapsed section; the high-level summary stays visible. Skipped when there is nothing to show.
- Both use the native `[open]` attribute and the custom-triangle CSS pattern. ⚠ The element names are missing from the source text.

### v1.42 — FF-017 Phase D

- Combined decision support (brief §12): the external-advice banner opens with players researched, agree / changed XI / inconclusive counts, a Captain line and a Transfer line.
- New `algorithmicTransferVerdict()` mirrors `transferVerdictLine`'s "worth it" bar. All figures are read from values already computed in the same render pass; "Agree" is an inferred count.

### v1.41 — FF-017 Phase C

- External Review card gains the multi-AI hand-off (brief §8/§9): per-source status row (Claude / ChatGPT / Gemini), Copy Prompt, Download JSON, Open Claude / ChatGPT / Gemini (new one-line `openAIProvider`). No API integration (out of scope per brief §19).
- Primary button reads "Get External Review" / "Regenerate Review Package".

### v1.40 — FF-017 Phase A + B

- Phase A: "Refresh & Analyse" (`refreshAndAnalyse()` = `loadSquad()` then `loadAdvice()`); `importExternalCheck()` now auto-runs `loadAdvice()` after a valid, non-mismatched import.
- Phase B: `getReviewSessionStatus()` — a computed view over `_lastAdviceRenderData` / `_lastExportPayload` / `_externalChecks` returning READY / EXTERNAL_PENDING / PARTIAL / COMPLETE / STALE. New "🌐 External Review" card (`renderExternalReviewCard()`, `startExternalReview()`). `generateExportPrompt()` now returns true/false.
- Covers brief §5, §6, §7, §10, §11. Deferred: staleness from a changed squad composition.

### v1.39 — FF-016

- Bug: free transfers showed 0 remaining with nothing transferred. `computeTransferSlotUsage()` counted every active (locked/planned) entry ever logged, with no gameweek scope.
- Fix: `addManualTransfer()` stamps `gwId` at creation; only entries for the current planning gameweek count. Others are reported as `staleActiveCount` with a Transfers-tab banner. Pre-fix entries (`gwId: null`) drop out of the count.

### v1.38 — FF-015

- Export prompt now asks whether to transfer: adds `transferContext` (free transfers, used via `computeTransferSlotUsage()`, remaining, bank) and `algorithmicTransferSuggestions`; schema gains `transferRecommendation` (action hold/transfer, swaps with reason + confidence, `usesFreeTransfer`); new step 7a.
- Import hardening: `extractJsonCandidate()` tries a ```json fence, any fence, then the outermost `{...}`. Rejections show in `#importErrorBox` with a specific reason and a "Copy a message to send back to the AI" button.
- New `buildTransferContradictionFlags()` compares an imported recommendation with the algorithm's `transferOpportunities`; never auto-applied. Recommendation shown on its own card in the External tab.

### v1.37

- Live squad cards: two labelled boxes. "This week" (match state, coloured by new `matchOutcomeSentiment()` — GK/DEF by clean sheet, MID/FWD by team scoring; a simple heuristic) and "Next gameweek" (opponent + FDR from `fixtureGW`).

### v1.36

- Live match scores on Live cards (`buildMatchStateByTeam()` / `matchStateChipHtml()`: 🔴 LIVE score + minute, FT, or kickoff). Fields already in the FPL fixtures feed; no proxy or Edge Function change.
- Bug fix: Live squad showed next gameweek's fixtures (`fixtureGW`) instead of its own locked gameweek (`gwId`). Live now uses `gwId`; Locked In Squad / Advice keep `fixtureGW`. Explicit gameweek labels added.
- Delete button on each imported external check (no confirmation).

### v1.35

- Lex's launcher dashcard was blank: launcher `statFantasy()` still read the bare `ff_squad_cache` key after v1.33's per-user scoping. Fixed in `index.html`. Also added an `FF_DATA_UPDATED` broadcast on every squad save.
- Team name header on the Squad section via the existing `/entry/:id` proxy route (fault-tolerant; never fails the squad load).

### v1.34

- Bug: an export could bake in a stale gameweek (`rd.gwId` from the last Advice run). Three layers: `generateExportPrompt()` uses `currentPlanningGw()` and blocks with a one-click fix if it disagrees with the last analysis; an old squad cache gets a warning, not a block; schema v4 adds `forGameweekDeadline` and asks the AI to set `gameweekMismatchSuspected`, surfaced on import and in the External tab.
- Caught in testing: the first draft compared `rd.gwId` with `currentPlanningGw()`, which would have blocked every Live export; corrected to `rd.fixtureGW`.

### v1.33

- Bug: Lex's Settings showed Pete's FPL entry ID. Per-user localStorage keys were unscoped since the single-user era.
- Fix: `scopedKey()` suffixes the user id on `ff_settings_local`, `ff_squad_cache`, `ff_score_history`, `ff_advice_cache`, `ff_transfer_log`, `ff_external_check`, `ff_manual_lineup` (`ff_show_position_best` excluded as a shared display preference). Per-user cache loads deferred until the user is known (`onSession`, `onNoSession`, no-PalSync fallback). One-time migration of Pete's legacy keys (scoped to his user id; legacy key removed). Entry ID placeholder now generic.
- Supabase was never at risk (RLS `auth.uid() = user_id`). Tested end-to-end with both users in one browser.

### v1.32

- Bug fix: v1.31's gameweek filter compared `forGameweek` with `gwId`, wrongly excluding current checks in Live mode. Now compares with `fixtureGW` in both modes.

### v1.31

- Live stat boxes (Gameweek, GW Points, Total Points via `entry_history.total_points`) and a per-player GW-points badge (`elements[].event_points`).
- Toggle for the purple "TOP SCORER" cards (localStorage display preference, not synced).
- Locked In Squad stat row (next gameweek, deadline via `currentPlanningGwDeadline()`, transfers applied).
- Correctness fix: external checks now filtered to `activeExternalChecks` (`forGameweek === gwId`) before `buildExternalSignalMap` / `buildContradictionFlags`. `externalAdviceSummaryHtml` distinguishes "nothing imported" from "imported but not for this gameweek".

### v1.30 — PET-086 follow-up

- Next gameweek's deadline (`bootstrap.events[].deadline_time`) shown in-app and on the launcher dashcard. `buildTrimmedSquadCache` captures `nextGwDeadline`; new `currentPlanningGwDeadline()`.

### v1.29

- Multi-user support for Lex: removed the hardcoded default `entryId` (Pete's FPL ID) from settings load and backup import.
- `KNOWN_USERS` allow-list check in `onSession` (pattern from Reading Tracker), with a blocking overlay for an unexpected session; RLS remains the real boundary.
- Theme: confirmed the only toggle lives in `index.html`. Reverted to no per-app toggle and added a live `PAL_THEME` postMessage listener.

### v1.28

- `buildPerPlayerDisagreementLabels` — per-player "🔀 ChatGPT would bench this" labels in Recommended Team, wired through the advice cache.
- Bench order: outfield reserves ranked by score with 1st/2nd/3rd sub labels; bench GK last.
- Restored a bidirectional theme toggle writing `pal_theme`. ⚠ Reverted in v1.29.

### v1.27

- Re-importing a check no longer re-expands other AI sections (open state captured and reapplied).
- Export payload carries a human-readable `squadBasis`; schema v3 asks for `confirmedSquadBasis`, shown on import.
- New manual-lineup layer for Locked In Squad (starting XI, bench order, captaincy): tap-to-swap UI, GK swaps only with bench GK, outfield swaps checked with `isValidFormation`. `getEffectiveLockedInPicks` is the single source for Squad and Advice; a stale lineup reinitialises. New table `ff_manual_lineup`.
- Bug: Advice never read `is_captain`, overriding a manually set captain. New "Your captain" section shows the actual captain and the algorithm's pick only when different.
- Settings and Diagnostics merged into one tab.
- Per-app theme toggle removed; boot-time `applyThemeCore` syncs the meta theme-colour.

### v1.26

- New `buildContradictionFlags` compares an external AI's `recommendedXI` with the algorithm's final XI (after overrides). Case-insensitive name matching; needs at least 8 resolved names. Shown as opinion-only, never auto-applied. Captain compared the same way.

### v1.25

- `projectionStatusNote()` differentiates locked / planned / mixed (the banner wrongly said "Not live on FPL yet" for locked transfers).
- "Planned" renamed "Locked In Squad"; with no active transfers it shows the current squad.
- `exportSquadFile()` and generic `downloadJson()` (includes price and squad value).
- `autofillTransferCostDelta` (from `now_cost`) and a running total for active transfers.
- External check rewritten for multiple AI sources (`AI_SOURCE_LABELS`, one check per AI, own "External" tab, schema v2 with `aiSource` and an independent `recommendedXI`, `downloadExportPromptJson()`).
- The advice engine now uses external input carefully: `buildExternalSignalMap` (worst case across confident sources only), `applyExternalOverridesToXI` (same-position clean bench swap only; unresolved if none), extended `recommendCaptainAndVice`. "External advice considered" summary with attribution.

### v1.24

- External team-news check via a chat round trip (no free structured API exists; scraping ruled out).
- `buildPriorityPlayers` (from SELL / CONSIDER_SELL / MONITOR decisions, doubtful/injured status and top transfer candidates); `generateExportPrompt` / `buildExportPromptText` (self-contained prompt, confidence per player, self-check pass); `importExternalCheck`; new table `ff_external_check`.
- Shown in its own violet section, never merged into scores, decisions, advice cache or history. `_lastAdviceRenderData` (in-memory) added.

### v1.23

- Bug: `buildProjectedSquad` labelled the projection with `baseCache.gwId` (the locked gameweek) instead of `baseCache.nextGwId`. Fixed; projection also carries `baseGwId` for "built from your GW4 squad" framing.
- Transfers tab split into "For your next deadline — Gameweek N" and "Already on FPL — your Gameweek N squad" (`transferEntryCardHtml` extracted).
- "Transfers to consider" and "Transfer opportunities" carry explicit "for Gameweek N" tags.

### v1.22

- Advice states the locked gameweek vs the gameweek a transfer applies to.
- `annotateTransferOpportunitiesWithPlanStatus()` (matching / conflicting / not recorded).
- New status LOCKED IN (cyan badge); `isActiveTransferStatus()` threaded through `buildProjectedSquad`, `computeTransferSlotUsage` (locked takes priority) and the sync matcher. Transfer form: "Add as planned" vs "I've done this on FPL".
- Free-transfer gameweek no longer typed: `currentPlanningGw()` (squad cache carries `nextGwId`); `freeTransfersSavedForGw` prompts a reconfirm only on divergence.

### v1.21

- `computeTransferSlotUsage` assigns FREE / −4 HIT slots in date order; one function used everywhere.
- Staleness warning when the free-transfer count's gameweek doesn't match.
- Sync-merge: a synced transfer upgrades a matching PLANNED entry in place.
- `annotateTransferOpportunitiesWithSlots` and an explicit Gameweek Summary verdict line.

### v1.20

- Confirmed "squad a gameweek behind" is FPL mechanics (picks hidden until deadline).
- Player picker (`ensurePlayersLoaded`, `filterPlayerPicker`, `selectPlayerPickerFromRow`) gives transfers real ids; `extractTransferPlayerIds` checks explicit ids first.
- `buildProjectedSquad` applies planned transfers to the last live squad (matches by current slot occupant; conflicting second plan reported as skipped).
- Live/Planned toggle on Squad (instant) and Advice (needs re-run). A projected run never writes score history or the advice cache. Amber-dashed "PROJECTED" banner.

### v1.19

- `pal-fpl-proxy` v1.4 `x-pal-force-fresh` header bypasses the proxy's 15-minute picks cache on explicit user fetches (new `proxyHeaders()`); the result is still written back to cache.

### v1.18

- Transfer rating: points of player in vs player out since the transfer gameweek. Only for `'auto'` entries (ids recovered from the `auto_…` id string, retroactive). Reuses `fetchPlayerHistoryCached` (refactored from FF-012); lazy-loaded.

### v1.17

- `pal-fpl-proxy` v1.3 treats a 404 on the transfers route as an empty result (FPL returns 404 for "no data yet"). New `proxyErrorDetail()` shows the proxy's `{error, detail}` body.

### v1.16 — FF-012 + FF-008

- FF-012: score history graph inside each player's existing points-breakdown section; lazy `element-summary` fetch per expanded player; hand-rolled inline SVG; full-season history.
- FF-008: new Transfers tab. `'auto'` entries from new proxy route `entry/:id/transfers` (`pal-fpl-proxy` v1.2, needs redeploy); `'manual'` entries for planned moves. Advisory only. New table `ff_transfer_log`.

### v1.15

- Pattern fix for stale computed values in caches: new `FF_VERSION` constant (now one of five version locations), stamped as `appVersion` on the squad cache. `maybeAutoRefreshStaleSquadCache` paints a mismatched cache instantly then silently runs `loadSquad()`.

### v1.14

- Bug: opponent showed "?" because the cached teams list was trimmed. All 20 teams now kept.

### v1.13

- Per-player points breakdown (exact count × value from season totals; appearance and defensive points bundled into an "Appearances & defensive actions*" remainder row).
- "Top scorer at this position" reference card per position (dashed purple, TOP SCORER tag). Cache gains `topPlayerIdByPos`.

### v1.12

- Squad view shows season total vs the highest `total_points` in the same position league-wide (`buildMaxPointsByPos` runs before trimming; only four numbers cached).

### v1.11

- New "Recommended team" section consolidating keep / XI changes / transfers with priced alternatives. Presentation only; `optimal` carries `starterIds`.

### v1.10

- Bug: no fixture data in the Squad view because `gwId` (falls back to the last finished gameweek) was reused for fixture lookups. New `findNextFixtureGW()` (is_next → is_current → smallest unfinished → computed fallback) fixed at four call sites.

### v1.9

- Next opponent + FDR chip on every squad player (reuses `buildNextFixtureByTeam`); `loadSquad` now fetches `/fixtures`; squad cache carries `nextFixtureByTeam`.

### v1.8

- Priority 1 of the v1.8 brief: the analyst/decision layer as pure functions — `calculateMomentum`, `calculateFixtureSwing`, `calculateMinutesRisk`, `evaluatePlayerDecision`, `evaluateTransferOpportunity`, `buildTransferOpportunities`, `findBuyOpportunities`, `generateWatchItems`, `evaluateCaptainConfidence`.
- Decision rules: one negative signal → MONITOR, two → CONSIDER_SELL, three → SELL; unavailable → SELL directly; doubtful → MONITOR.
- Data limits flagged: momentum needs 2+ gameweeks of history; "minutes risk" is a season-to-date band.
- Advice tab reordered per the brief; cache payload extended. Deferred: Priority 2 (pitch view), 3 (full summary widget), 4 (watchlist filtering).

### v1.7

- `findOptimalXI()` compares totals only within the same fallback tier (an all-available formation always wins).
- Value-free `startScore` (Form 30 / Fixtures 25 / Reliability 25 / Availability 20) for XI selection only.
- Captain reasoning shows `ep_next`, opponent, home/away, FDR; vice-captain added.
- Advice caching (localStorage + new `ff_advice_cache` table); deadline shown in `adviceMeta`.

### v1.6

- Bug: an injured player could still be suggested to start. `isEffectivelyUnavailable()` (status i/s/u/n, or d with `chance_of_playing_next_round <= 25`) is a hard gate in `findOptimalXI()` and `recommendCaptain()`. Composite score unchanged.
- "Player breakdown" and "How this works" sections added.

### v1.5 — FF-004 to FF-007

- Advice tab: composite 0–100 score (form 25 / fixture run 20 / value 15 / reliability 20 / availability 20), brute-force optimal XI, captaincy, sell flags with buy suggestions.
- Uses FPL's `form` / `points_per_game` and `ep_next` rather than extra per-player calls.
- New table `ff_score_history` (up to 6 gameweeks). All `esc()` calls swapped to `safeEsc()`.

### v1.4

- Bug: squad reset on refresh (localStorage unreliable in iframes on Safari). Added Supabase `ff_squad_cache` (trimmed snapshot); Supabase pull self-heals an empty local cache. `renderSquad()` signature changed to `(elements, teams, picksData, gwId)`.

### v1.3 — FF-003

- Squad view: `bootstrap-static` plus current gameweek picks via `pal-fpl-proxy`, grouped by position, captain/vice badges, bench. Current gameweek from `events[].is_current` with fallback. Last load cached to localStorage. Player photos deliberately left out.

### v1.2

- `FF_PROXY_KEY` moved into `pal-config.js` (see Shared Components); `testConnection()` checks for the placeholder value.

### v1.1 — FF-003 hardening

- "Tabs not responding" not reproduced. Hardened anyway: missing `PAL_CONFIG`, PalSync boot and the theme toggle now guard for absent dependencies with a clear toast/console message.

### v1.0 — FF-001 + FF-002

- Initial release: app shell, Settings for the FPL entry ID (synced via `PalSync.table('ff_settings')`), Diagnostics round-trip through `pal-fpl-proxy` `/bootstrap`. Squad tab placeholder.
- Launcher `HEALTH_APPS` / `BACKUP_ROW_MAP` integration deferred to FF-009.

---

# Film & TV Tracker

`film-tv-tracker.html`. From v1.2, full entries live in the `.md`; the inline HTML comment keeps a pointer. Supabase table `pal_film_tracker` (`title_` / `service_` / `ignore_` prefixes, single `__settings__` row), shared between Pete and Lex since v1.8. Local key `ftt_v1`; launcher stat cache `pal_ftt_stat`. Data from TMDB (GB/UK region).

### v2.7 — FTT-039 — Local cache trim on sync

- Adopted `PalSync.trimIfLarge()` (see Shared Components) at 2048 KB. `onSession` made async; trim after `syncPull()`, never in `onNoSession`.
- Different situation from Test & Issues: `ftt_v1` (~1.2 MB) is the real current library, so trimming cannot reduce it; wired in as Pete's explicit call as a safety net against future unbounded growth.
- Not tested in a real browser.

### v2.6 — FTT-038 — Reorder list stays put when you change a title's Interest

- In the grouped reorder list, choosing an Interest level still moves the title to the end of its new group (saved and synced), but the screen no longer scrolls to it; the neighbouring row takes its place and the moved row flashes in its new group. Arrows, drag and Move to position unchanged.
- No data, sync or backup change.
- ⚠ Shares the v2.6 version number with FTT-037 below.

### v2.6 — FTT-037 — Interest groups for the Available to watch queue

- New optional per-title field `interest: 'high' | 'medium' | 'low'`; missing = Unrated. User-set only; independent of `favourite`, `favouriteOrder`, `watchlistOrder`. No migration write (verified no re-stamp on load).
- Ordering: Available to watch is High → Medium → Low → Unrated, then `watchlistOrder`. Changing Interest puts the title at the end of the new group. Reorders inside one group only renumber within that group's existing numbers; only moved titles are stamped and synced.
- Normal shelf: one shelf per group with heading and count, 8 tiles each with per-group See all; a single plain shelf when nothing is rated.
- Reorder list grouped: numbering per group from 1, arrows stop at group ends, drag within group, Move to position clamped; per-row Interest menu (cross-group drag not supported).
- Detail Interest row on Want to Watch titles; Selection-mode "◐ Set interest…" bulk action; More filters High / Medium / Low interest and Unrated.
- Interest retained through favourite, unavailable and watched transitions.
- Decisions to be aware of: Unrated rows are numbered (brief sketch showed them unnumbered); reorder rows ~76px (was ~62px); bulk Set interest is an addition beyond the brief.
- Tested: 80 new checks (headless Chromium, stub sync) plus earlier suites. Not tested: physical iPhone, real library/Supabase, two devices.

### v2.5 — FTT-036 — Reorder is now a dense vertical list

- Tile-based reorder (draggable poster tiles, ☰ badge) removed. Reorder swaps the shelf for a list: ☰ handle (42×52 target), position number, thumbnail, title, year/type/service, ↑ ↓ (38×40). Lists the whole collection (Available to watch: available, Want to Watch, non-favourite by `watchlistOrder`; Favourites: available favourites by `favouriteOrder`).
- Pointer-event drag (touch: handle only; mouse: whole row), floating copy, dashed slot, live renumbering, edge auto-scroll below the sticky header. ↑ ↓ and keyboard; optional Move to position.
- Done commits; changing view/tab/filter, entering selection mode or backgrounding also saves.
- A reorder now writes less: rearranged titles move among the numbers they already hold; only moved titles are stamped and synced; falls back to renumbering 1..n if ties or gaps make that unsafe.
- No data-model, sync or backup change. Tested: 66 new checks plus earlier suites. Not tested: physical iPhone, real library/Supabase.

### v2.4 — FTT-035 — Cinema + streaming releases by date, Not interested, new pills, Update from TMDB

- New stored data: `release { kind, date }` on titles from the New releases import, and a **Not interested** list (`state.ignored`). No backup-format change.
- **New releases import:** window (7 / 14 / 30 days / 3 months) and Cinema + streaming / Cinema only / Streaming only. Three TMDB UK queries: cinema films (`/discover/movie`, theatrical release types), streaming films (`/discover/movie`, digital release type 4, on a UK subscription service), new series (`/discover/tv`, first air date in window, UK subscription). Up to 30 each, deduplicated (a film in both counts as cinema). Owned, previously deleted and Not interested titles skipped before detail fetches.
- **New release view (pill):** unwatched titles with a release upcoming or in the last 90 days, split under **Coming up** and **Out now**, each tile labelled 🎬 Cinema / 📺 Streaming. Films with no release record fall back to the stored cinema date.
- **Not interested:** 🚫 button (key N) in the review window removes the title and records its id. Stored per item: id and `updatedAt` only (`m<tmdbId>`, `t<tmdbId>`, or `n<slug>[~year]`); each is its own synced row (prefix `ignore_`), included in JSON backup. Undo reverses both. List import skips these. Sync & Backup → Import shows the count and "Clear Not interested list" (tombstones the rows).
- **Pills:** All · New release · Tag view · TV · Films · More (More: Available, Favourites, Unavailable, Short / Bedtime, New season, Reviewed, Tags →).
- **Update from TMDB** (Library Maintenance; replaces v2.3's "Tag library from TMDB genres"): Want to Watch or Whole library; refreshes tags from genres (combined TV genres split, existing spelling reused, nothing removed), release dates, UK availability (replaces stored list; no UK entry keeps existing), certification, new-season flags, and fills only empty poster/overview/genres. Changed-only sync; idempotent; cancellable.
- Tested: 65 new checks (mocked TMDB). Not tested: real TMDB responses, physical iPhone, two devices syncing Not interested rows.

### v2.3 — FTT-034 — Available pill order, New release pill, Tag view, TMDB genre tagging, New releases import

- Available pill (and Want to Watch tab) default to favourites in favourite order, then `watchlistOrder`.
- The Cinema filter becomes the **New release** pill (Detail/Edit cinema-date wording unchanged).
- More → **Tag view**: one shelf per tag (most used first, 8 shown, See all) then Untagged.
- "Tag the library from TMDB genres" (⚠ superseded by Update from TMDB in v2.4): adds genres as tags, splits combined TV genres, never removes or re-spells; up to 20 tags per title.
- Add title → **New releases**: `/discover/movie`, UK region, theatrical release types (recorded in the source as "23"), most popular first, up to 40; skips owned and previously deleted; untagged imports with a short-lived `importSource` flag, reviewed in the import window.
- Tested: 61 new checks (mocked TMDB).

### v2.2 — FTT-033 — Simplified Library: four collections, one compact card

- ⚠ On-screen label stays **v2.2** (per the brief); the build id moves to FTT-033.
- The Library (no filter/search) is four collections: **Favourites** (manual `favouriteOrder`), **Available to watch** (non-favourite Want to Watch, not blocked; manual `watchlistOrder`), **Unavailable** (blocked Want to Watch, favourites included, no manual order), **Watched** (newest added). "Available" = anything not blocked (includes rent/buy-only and no-data titles).
- Transitions fall out of the data (favouriting keeps the queue number for later; blocked favourites keep favourite order; watched favourites retain both orders). Every title appears exactly once.
- Simplified ordering model: favourites are no longer given a `watchlistOrder`; a reorder moves titles among the slots they already hold.
- One card everywhere: `titleCardHtml`, the large 3-column cards, the four hard-wired discovery shelves, `shelfFavourites`, `isFullyWatched`, `.lib-grid` and `.lcard` removed; `miniCardHtml` used throughout. Shelves show 8 with See all / Show less; lists page 60 at a time.
- No data, sync or backup change; nothing migrated. Tested: 74 new checks plus earlier suites.

### v2.2 — FTT-032 — Ordered Want to Watch, new Library hierarchy, personal tags

- ⚠ Built from v2.11; the brief asked for the label v2.2, which reads lower than v2.11.
- Two new optional per-title fields: `watchlistOrder` and `tags`. No sync-table or backup-format change.
- Library: My favourites → Want to Watch (new, Reorder) → Available to watch → New seasons, then All titles grouped Want to Watch / Unavailable now / Watched.
- Want to Watch queue reorder reuses the favourites machinery generalised to two collections (`favKind: fav | queue`); only renumbered titles are pushed. New titles append; favourites keep a queue slot; watched titles keep their number.
- Upgrade: titles without `watchlistOrder` numbered once silently (no `updatedAt` change, nothing pushed).
- Tags: chip editor in Edit Title (30 chars, 20 per title), case-insensitive normalised keys reusing existing spelling, Title Case rules for new tags. Library search now matches title, original title, genres (new behaviour) and tags. More → Tags (match ANY). Detail tag chips filter the Library. Cards show no tags. Bulk "Add tag" not included.
- Tested: 107 new checks plus earlier suites. Not tested: physical iPhone, real library/Supabase, two devices.

### v2.11 — FTT-031 — Unavailable now becomes a full-size group; Delete in the import tagging window

- ⚠ Replaces the v2.10 (FTT-030) mini shelf, which is removed entirely.
- All view: small shelves, then full-size groups Want to Watch (not blocked), Unavailable now (blocked; favourites first), Watched; each paged separately and hidden when empty. Want to Watch tab remains flat.
- Import tagging window: 🗑 Delete (key D) tombstones the title; Undo reads "Undo delete" and restores it. Wording "tagged" → "done".
- No stored data, sync or backup change. Tested: 22 new checks plus earlier suites.

### v2.10 — FTT-030 — "Unavailable now" shelf restored on the All view

- ⚠ Superseded by v2.11.
- Want to Watch titles whose only sources are unticked services (`resolveAvailability` state `unavailable`), each showing "Needs X"; favourites first; 8 tiles with See all.
- No stored data change. Tested: 20 checks.

### v2.9 — FTT-029 — Ready-made AI prompt for the title list import

- Sync & Backup → Import Titles → "🤖 Have an AI write the list for you": Copy prompt button with a select-and-copy fallback (clipboard can be blocked in the launcher iframe).
- Prompt asks for a bare JSON array of `{ title, year, type }`, explicitly no `tmdb_id` / `imdb_id` (often guessed wrongly; the importer treats ids as exact).
- Importer strips markdown code fences from a pasted reply.
- Tested: 14 checks plus the 37-check import suite. Not tested: how a real AI follows the prompt.

### v2.8 — FTT-028 — Title list import is the only importer

- Removed the Netflix history (CSV), Viewing history (JSON) and Watchlist (JSON) importers: `importNetflixCSV`, `importHistoryJSON`, `importWatchlistJSON`, `importGenericTitleList`, `parseGenericTitleListJSON`, `tmdbSearchTypedTop`, `tmdbSearchTop`, `addUnmatchedGeneric`, `splitNetflixTitle` (and `NETFLIX_SEASON_RE`). Shared helpers kept.
- Consequence: new imports no longer create per-season watched marks or `timesWatched`; existing data untouched. JSON backup Restore unaffected.

### v2.7 — FTT-027 — Title list import and tagging window

- New import (CSV or JSON): `tmdb_id` + type or `imdb_id` match exactly; otherwise `title` + `year` + `type`. Year sent as a TMDB filter with retry without; both types searched when no type; non-exact matches marked best guess. In-file repeats and existing titles skipped; unmatched titles still added.
- New per-title fields `importPending`, `importMatch`, `importLabel` (removed once tagged). Titles arrive as Want to Watch placeholders.
- Tagging window opens after import: one title at a time with ♥ Favourite, Want to Watch, ✓ Watched, Skip, Undo (keys 1, 2, F, S, Z). "Tag imported titles (N waiting)" button to resume.
- Tested: 37 checks (mocked TMDB).

### v2.6 — FTT-026 — Favourites reorder: every favourite, and scrolling that works on a phone

- Reorder from the row now covers every favourite in that view's shelf (was first 8).
- Touch: tiles `touch-action: pan-y`; only the ☰ handle (30px on touch) starts a drag. Edge auto-scroll via `requestAnimationFrame`.
- No stored data change. Tested: `node --check` only.

### v2.5 — FTT-025 — Launcher dashcard top 3 favourites

- `writeStatCache` adds `topFavourites` (first three in favourite order: title, type, year, poster only if plain `https://` under 300 characters) and `favouriteCount` to `pal_ftt_stat`; rewritten on every save and once on every open. Consumed by launcher v10.95 (PET-100).
- Tested: 14 checks plus the 44-check v2.4 suite.

### v2.4 — FTT-024 — Sectioned All view, Want to Watch priority, per-view favourites, search-then-add

- Tabs All · Want to Watch · Watched; opens on All. All view: My favourites → Available to watch → New seasons → Want to Watch section → Watched section.
- Want to Watch priority: favourites → available on an owned service → everything else (newest added); new sort "Favourites, available, unavailable".
- Watched view's favourites shelf shows fully watched only (`isFullyWatched`). ⚠ `isFullyWatched` later removed in v2.2 (FTT-033).
- Search across the library tags results with status; no-match offers "+ Add" with TMDB pre-searched.
- No stored data change. Tested: 44 new checks.

### v2.3 — FTT-023 — My favourites shelf with manual ordering

- New My favourites shelf (8 shown, See all). Numeric per-title `favouriteOrder` (1 = first), syncing with each title; only favourites carry it.
- Reorder from the home row or the Favourites filter; the rearranged set moves among the positions it already held (slot rule). Saved on Done or on view change/backgrounding.
- `ensureFavouriteOrder()` at boot and before every save: legacy favourites numbered oldest-added first; duplicates and junk values fixed; silent (no `updatedAt` bump, nothing pushed).
- Favourites first by default in Available to watch, Want to Watch and the Available filter (`favFirstCmp`).
- Test-environment caveat: over `file://`, headless Chromium intermittently discards a save across reload (also on v1.12 and v2.1); 0/40 over `http://`.
- Tested: 85 feature checks + 39 (later addition) + v2.1's 76.

### v2.1 — FTT-021 — Selection mode, delete from detail, dynamic heading, polish

- Selection mode with pinned bulk bar. Bulk framework: `BULK_ACTIONS` entries run by `runBulk(actionId, ids)` (replaces `bulkFavourite` / `bulkWatched` / `bulkRemove`). Contextual Favourite/Remove favourite; Mark watched hidden when all watched.
- Select all covers only titles on screen (60 per page); a selection prunes when a filter hides a title.
- Delete beside Edit in detail; soft delete (`_deleted` + tombstone); confirmation wording.
- Dynamic heading with count; discovery rows capped at 8; card text "✓ Netflix".
- No data-model change. Tested: 76 checks.

### v2.0 — FTT-020 — Library redesign

- Tabs are now **Library** and **Services**; Reviews tab removed (new "Reviewed" filter instead).
- Library: search with separate "+ Add title" (TMDB search moved into that dialog); Want to Watch / Watched / All switch; secondary filters with More ▾; compact discovery rows; My library with Sort.
- Cards: true 2:3 poster, one contextual line; per-card ⭐ / ✅ quick buttons removed (moved to detail and Select mode). Full-screen title detail view.
- Behaviour changes: Cinema now means unwatched films released within the last 90 days or upcoming (`CINEMA_WINDOW_DAYS`); grid pages 60 at a time; favourite shown as ♥ everywhere.
- No data-model change; sync, importers, new-season checker, backup and edit modal untouched.

### v1.12 — FTT-019

- Library search/filter bar moved directly under the stat boxes (sticky from there); curated rows moved below it. HTML reorder only.

### v1.11 — FTT-018

- Curated preview rows restored (⭐ Favourites, 🌙 Good for tonight, ✅ Available now, 🚫 Interested-but-can't-watch-yet, 🕘 Recently watched, 🆕 New Seasons), each with See all via `goToStat()`. Favourites now pulls from Watchlist and Watched.

### v1.10 — FTT-017

- Sticky-header gap fixed with `--chrome-h` / `--tabs-h` variables (the removed theme button had shrunk the header).
- Library search/filter row sticky under the tabs.
- "Good for tonight" restored as a stat box; Any-filter "Short / Bedtime" now uses the same not-blocked check.
- Poster ratio 2:2.7; toggle buttons 29px, more opaque, with border and shadow.

### v1.9 — FTT-014, FTT-015, FTT-016

- FTT-014: Dashboard, Watchlist, Watched and Search/Add merged into one "Films" tab with one filterable list; one select/bulk bar. Favourites stat now Status=All + Favourite.
- FTT-015: duplicate services diagnosed — `seedDefaultServices()` created 12 defaults with new random ids in every fresh session (four sessions). New "🔀 Merge duplicate services" tool (`mergeServices()`) keeps one per name, folds in access/notes, tombstones the rest.
- FTT-016: theme toggle is launcher-only (button and `toggleTheme()` removed); caches into its own `ftt_theme_pref`, matching On Budget's `ob_theme_pref` pattern.

### v1.8 — FTT-013 — Shared sync between Pete and Lex

- Bug: Lex saw no titles although RLS allowed both users; PalSync filtered by `user_id`.
- Fix: requires pal-sync v1.12 shared mode (see Shared Components); titles, services and the settings row use `shared: true`. `pal-shared.js` cache-bust `?v=1.8`; deploy together.
- Seed de-dupe in `syncPull()`: drops a local untouched default service whose name the cloud already has (live or tombstoned).
- Consequences: services and settings are household-level; titles fully shared, last-write-wins per record.
- Built on the v1.7 changes.

### v1.7 — FTT-010, FTT-011, FTT-012

- FTT-010: `checkAutoCompleteSeries(t)` marks a show Watched when every known season is fully watched (one-directional; guarded when the total is unknown).
- FTT-011: "Check for new seasons" (lightweight `/tv/{id}`) sets `t.newSeasonsDetected`; badge and dashboard section; `acknowledgeNewSeasons()` adopts the new total.
- FTT-012a: in-library search on every list tab (`filterAndSort()` takes `searchTerm`).
- FTT-012b: Watched multi-select with its own selection set (`selectModeWd` / `selectedIdsWd`); `selectVariant: 'wl' | 'wd'`.

### v1.6 — FTT-009

- Dashboard stat boxes clickable via `goToStat(tab, filterElId, filterValue)`. Favourites click only reaches watchlist favourites (flagged, not fixed).

### v1.5 — FTT-008

- Generic JSON import for viewing history and watchlist (bare array or `{"titles":[...]}`; string or object entries). Dedupe rules per import type, matched by TMDB id; unmatched still added.
- Netflix importer's progress UI renamed to shared `importControls` / `importRunning` / `importProgress`; `cancelImport()` / `_bulkImportCancel`.

### v1.4 — FTT-007

- `seasonsWatchedSummary()` denominator now `t.seasons` (real total). `renderSeasonsList()` lists every season 1..N; new `quickMarkSeasonWatched()` / `unmarkSeasonWatched()`.

### v1.3 — FTT-006 — Netflix history import, "times watched"

- Imports a Netflix viewing-history CSV (quoted-CSV parser; season markers resolve 166 shows / 277 show-season pairs / 1,060 ambiguous strings in Pete's file). Matching heuristic with exact-name TV check and full-string fallback; unmatched kept and flagged.
- No duplicates: merges seasons into existing shows; increments new field `timesWatched` for films. Seasons recorded as `seasonsProgress[n] = { manuallyMarkedWatched: true, … }`.
- One request at a time (150 ms spacing); local save per row; one bulk cloud push at the end.

### v1.2 — FTT-003, FTT-004, FTT-005

- FTT-003: suite-standard sync-chip and Data Modal (matching Fortnight Tracker v3.71); `slog()`, `setSyncStatus()` with `PalSync.retryQueueLength()`, `manualPull()` / `manualPush()`, no-pal banner after 3 s.
- FTT-004a: search results offer "+ Watchlist" and "✅ Add as Watched".
- FTT-004b: Watchlist multi-select with bulk Favourite / Mark Watched / Remove; quick mark-watched button; `titleCardHtml(opts)`.
- FTT-005: episode-level tracking via `/tv/{id}/season/{n}` stored in `t.seasonsProgress`; specials (season 0) excluded.

### v1.1 — FTT-002 — Modals were unclosable

- The shared `closeModal(id)` removes `open`, but this app uses `.modal-overlay.hidden`, so every close was a silent no-op. Fixed by declaring a local `closeModal(id)` after pal-shared.js loads. Added ✕ buttons and Escape handling.

### v1.0 — FTT-001 — New app

- Dashboard, Watchlist, Watched, Services, Search/Add, Reviews tabs. TMDB (GB) search, metadata and watch providers via `append_to_response=watch/providers`; Watchmode considered only if coverage proves thin.
- Availability kept separate from ownership; bedtime mode from episode runtime (20/30/45-minute threshold); cinema release date stored with a Google fallback.
- Supabase `pal_film_tracker` (`title_` / `service_` prefixes, `__settings__`) using `table()` / `pull()` / `upsert()`.
- `pal-shared.js` updated alongside: TMDB keys in `PAL_CONFIG` (see Shared Components).

---

# Fortnight Tracker

`fortnight-tracker.html`. The app's inline comment block keeps the 15 most recent releases; the full history was in `fortnight-tracker.md`, resequenced newest-to-oldest because the original inline order mixed ascending and descending runs. Supabase table `fortnight_bundles` (bundles keyed by `record_key`; `code_`, `leave_`, `bh_`, `la_` prefixed rows share the table). Local key `fn_tracker_v5`, also read directly by PeteGCal and Gigs & Trips for the working-day alert.

⚠ Several FT IDs are reused across versions in the source (for example FT-062 at v3.72 and v3.68; FT-039 at v3.44 and v3.42; FT-030 at v3.36 and v3.33; FT-026 at v3.34 and v3.32; FT-020 to FT-025 at multiple versions). They are preserved as recorded.

### v3.73 — FT-065 — 3 Oct 2026 — Local cache trim on sync

- Adopted `PalSync.trimIfLarge()` at 500 KB (see Shared Components), called inside `pullFromCloud()`'s success callback after `render()` (callback-style pull, not async/await).
- `fn_tracker_v5` is also read by PeteGCal and Gigs & Trips; trimming only forces this app's next load to re-pull, which rewrites the key immediately.
- This app was not confirmed as a large contributor to the original quota problem.
- Not tested in a real browser; the cross-app read was not re-verified.

### v3.72 — FT-062 — 29 Sep 2026 — Default timesheet code rows

- New fortnight bundles start each week with three zero-minute placeholder rows: DSA Architecture, DSA Strategy and Other Meetings (`OTHER_MEETINGS`), all code 0001, on day 1 and day 6. Matched by fixed seed ids `seed_dsa_arch`, `seed_dsa_strat`, `seed_tm_meet` (`DEFAULT_TS_CODE_IDS`); a deleted or archived default is skipped. Existing bundles untouched; no schema or backup change.
- Knock-on fix: leave auto-allocation (`isPureAutoAlloc` / `applyAutoAbsence`, the `setStat` toggle-off path, `revertAutoLeaveDay`) treated any multi-row day as a manual split; zero-minute placeholder rows are now ignored and preserved. Leave prefill in `createBundle` runs after the defaults are seeded.
- Tested: 15 logic tests against the real functions. Not click-tested in a browser.

### v3.71 — FT-064 — Claim Tracker standalone-mode support

- For launcher PET-094: if `pal_standalone_claims` is `'true'` at boot, the Claims tab button is hidden (and the app redirects off it). Plain same-origin localStorage read; correct even when opened directly. Claims iframe logic and `claim-tracker.html` untouched.

### v3.70 — FT-061 — Claims embed full width

- `#claims-embed-wrap` is now a sibling of `<main>` rather than a child, so the nested Claim Tracker iframe spans the full page width and its own 900px desktop breakpoint can fire. DOM position and CSS only.

### v3.69 — FT-063

- Adopted the combined `pal-shared.js` (see Shared Components). The nested Claim Tracker iframe still loads its own three separate tags.

### v3.68 — FT-062 — Claim Tracker re-embedded as a "Claims" tab

- Lazy-loaded nested iframe (`claim-tracker.html` untouched), reversing the reversal of v3.47; same pattern as Vault-in-Test & Issues (TI-083). Kept outside `#root` so tab switches never reload it; early return in `render()`.
- `pingClaimsFrame()` relays `PAL_THEME` and session data; `_palSessionData` captures the raw `PAL_SESSION` payload because `initSession()` keeps the token private.
- Launcher side (PET-089): Claim Tracker's nav icon and home card removed; Fortnight's card gains a Claims sub-stat (amount and entry count). Claim Tracker's standalone iframe, backup entry and `PAL_NAV_SLUG_MAP` registration unchanged.

### v3.50 — FT-044

- Sat/Sun weekend pickers side by side (`.weekend-days` two-column grid). Layout only.

### v3.49 — FT-043 — Weekend hours

- Two pickers per bundle: "Weekend before Week 1" and "Weekend before Week 2", stored on the bundle as `weekend1` / `weekend2` (`{ satH, satM, sunH, sunM }`).
- Counted straight into `bundleStats()` (`weekendMins()` folded into `doneMins` / `predMins`) against the 70h target; not fed into Timesheet totals or `tsWeekTarget`.
- `migrateDays()` backfills zeroed weekend objects; syncs with the bundle, no schema change.

### v3.48 — FT-042

- New bundle day defaults match Pete's working pattern: start 08:15; eight full days end 16:00 with 45m extra (8h = `stdMins` 480); the short Friday (`i===4`) ends 14:45 with 0 extra (6h = 360). `buildDays()` only; existing data untouched.

### v3.47 — FT-041 — Claim Tracker merged in as a "Claims" tab

- Embedded via a lazy-loaded nested iframe (`claim-tracker.html` untouched), same pattern as Horizon-in-On Budget. `loadClaimsFrame()` / `pingClaimsFrame()` relay `PAL_SESSION` and `PAL_THEME`.
- Launcher dashcard kept and repointed via `FT_ACTION` (launcher `launchFortnightClaims()`); Claim Tracker's nav icon removed; its standalone iframe, backup entry and slug map unchanged.
- Top-row "＋ Bundle" button removed.
- ⚠ This embedding was later reversed (in a version not in the supplied changelog) and then re-applied in v3.68 (FT-062).

### v3.45 — FT-040 — Capex tracker card

- Top of the Timesheet tab. Code `'0001'` = opex; any other code = capex; a code with no value defaults to opex. One global target % (`_store.data.settings.capexTargetPct`), tracked for the open bundle and the tax year to date. Includes draft allocations. Old backups get an empty `settings` object.

### v3.44 — FT-039

- Holiday allowance card shows a days-equivalent (hrs/8) under remaining/over hours.

### v3.43

- `saveLocal()` posts `FT_DATA_UPDATED` to `window.parent` after every write; the launcher refreshes the Fortnight card (same pattern as Gym's `GYM_DATA_UPDATED`).

### v3.42 — FT-039

- Viewport meta gains `maximum-scale=1.0` and `user-scalable=no` (iOS double-tap zoom in the Timesheet matrix); now matches the suite standard.

### v3.41 — FT-038 — Holiday hours allowance

- One allowance per tax year on the Leave tab (deterministic record id), shown as hours remaining (Holiday only), red when over. Clearing removes the allowance (distinct from 0h). Synced via `fortnight_bundles` with the `la_` prefix.

### v3.40 — FT-037

- Multi-day leave date pickers: End follows Start until End is set deliberately (or would fall before Start).

### v3.39 — FT-035, FT-036

- FT-036: deleting a manual leave record left auto-filled bundle days stuck as Holiday/Sick. Auto-fills now tag the day with the source record and its pre-fill end/lunch; deleting the record reverts the day; editing reverts then re-applies.
- FT-035: single-day leave modal shows the fortnight pattern hint ("Normally 8h this day") and defaults hours for a new record.

### v3.38 — FT-034

- Adding or editing a manual leave record now also folds it into any existing bundle day for that date (if not already marked); each affected bundle saved individually.

### v3.37 — FT-032, FT-033

- FT-032: Leave records grouped by month, collapsed by default, with counts.
- FT-033: creating a bundle folds in matching manual leave records (status/hours set, clock zeroed via start=end, no lunch).

### v3.36 — FT-029, FT-030

- FT-029: duplicate leave lines from differing date string formats; every date passes through `normDate()` (plain `YYYY-MM-DD`).
- FT-030: multi-day leave is pattern-aware (8h, 6h short Friday; weekends, the fortnight's Friday off and observed bank holidays pre-excluded). New Bank Holidays list seeded with England & Wales dates 2025–2027 (all off by default), synced with the `bh_` prefix.

### v3.35 — FT-027, FT-028

- FT-027: `leaveEntriesForYear` dedupes by date + type across bundle days and manual records, keeping the larger hours (ties favour manual).
- FT-028: Add Leave offers Single day vs Multiple days (one record per weekday, 60-day cap).

### v3.34 — FT-026 — Leave tab

- Holiday/Sick hours and days-equivalent (8h/day) over a UK tax year (1 Apr – 31 Mar). Combines bundle days (read live) with new manual records `_store.data.leave`, synced via `fortnight_bundles` with the `leave_` prefix. Soft-delete only; old backups default `leave` to `[]`.

### v3.33 — FT-030 — Suite-wide sync audit / pal-sync.js v1.11

- `deleteBundle()` used to splice the bundle out before its tombstone reached the cloud. It now marks `_deleted: true` and keeps it locally (soft delete, matching On Budget and Gym Tracker), so pal-sync v1.11's retry can act on it.
- New `visibleBundles()` helper used by every render, selection and lookup path (`render()` lists, `tsBundle()`, `tsNavPrev()` / `tsNavNext()` rewritten to walk the visible list, `openDataModal()`, `openModal()`, `createBundle()`).

### v3.32 — FT-026 — Suite-wide sync audit

- `importData()` used to forge a new `updatedAt` on every imported bundle and blind-push. Now preserves the backup's own timestamp and pulls-and-merges before pushing. Same defect as Meal Planner MP-045, Reading Tracker MR-011 and On Budget ON--049.

### v3.31 — FT-024

- Week header total live-updates on cell change (`mx-whdr-` id patched by `tsMxRefreshTotals`); emoji format 🎯 / ✅ / ⏳; `fmtHrs()` and `wkHdrHtml()` helpers.

### v3.30 — FT-023

- Fix: totals not updating (`tsMxUpdCell` passed undefined `b` to `tsMxRefreshTotals`, ReferenceError). Number input replaced by a select (0–10h in 0.5h steps, `tsMxSelHtml`). Submitted weeks are read-only.

### v3.29 — FT-022

- Matrix input replaces the day accordion on the Timesheet tab.

### v3.28 — FT-021

- Collapsible week cards on the Timesheet tab.

### v3.27 — FT-020

- Fix Prev/Next navigation direction on the Timesheet tab.

### v3.26 — FT-019

- Timesheet navigation, totals row, week submit toggle.

### v3.25 — FT-018

- PDF report gains a Week Total footer row.

### v3.24 — FT-017

- Fix blank PDF pages: print CSS switched from `visibility:hidden` to `display:none` on non-print elements, with height resets.

### v3.23 — FT-025

- PDF export of a week's timesheet via native print-to-PDF (no library): hidden `#ts-print-area` with forced light styling, then `window.print()`.

### v3.22 — FT-024

- `dayTarget` always returns the day's standard length (`stdMins`), so partial-day absences no longer flag a correctly worked day red.

### v3.21 — FT-023

- Per-day target, colour states and remainder-based code pre-fill restored, without requiring a Done/Conference/Training status. Tab badge counts unreconciled days.

### v3.20 — FT-022

- Reverted v3.19's target reduction: flat week targets 38:00 (week 1) / 32:00 (week 2), leave counting toward them. `weekAbsenceMins` / `weekAdjustedTarget` removed. Holiday/Sick days get a "Full day" / "Partial H:MM" badge.

### v3.19 — FT-021

- Simplified week-target model: removed `dayExpectedMins`; week target reduced only by recorded holiday/sickness (`weekAbsenceMins`); auto-leave allocation excluded from `weekWorkAllocated`. ⚠ Reverted in v3.20.

### v3.18 — FT-016

- Hour/minute selects (5-minute steps); `migrateDays` backfills auto-allocation on absence days marked before v3.17 (including archived bundles); "Copy previous day"; weekly report as a per-day grid with TSV copy.

### v3.17 — FT-020 — Timesheet tab

- Per-week code allocation against 38:00 / 32:00 (from `stdMins`), day editor with searchable code picker, per-week report with TSV copy, code library (add/edit/archive).
- Codes seeded from Pete's Timesheetcodes doc with fixed ids (so two devices converge). Codes are `code_`-prefixed rows in `fortnight_bundles`; safe because pal-sync's merge skips rows without the merge id field — **codes must never gain a `startDate` field**. Pull fetches once and feeds both merges (`preFetchedRows`).
- Allocations live in day objects (`{ codeId, mins }`). Done/Conference/Training jumps to the Timesheet editor; Holiday/Sick auto-allocate to flagged auto-holiday / auto-sick codes; manual splits never overwritten. Backwards compatible.

### v3.9 — FT-003 — Migrated to shared pal-sync.js

- Required prerequisite: `ALTER TABLE fortnight_bundles RENAME COLUMN bundle_start TO record_key;` (pal-sync hardcodes `record_key`).
- `save()` now stamps `bundle.updatedAt` before pushing (bundles previously had no timestamp; the old pull was cloud-authoritative full replace).

### v3.8 — FT-002

- Hard DELETE on bundle removal replaced with a tombstone soft-delete (`data._deleted: true`); `pullFromCloud` filters tombstones; Manual Push pulls first. Version number added to `<title>`.

### v3.6 — FT-001

- Live/Archive tab bar centred like the rest of the content on desktop.

### v3.5

- Header content centred within the 900px desktop zone.

### v3.4

- Desktop breakpoint (900px+) widens main from 600px to 900px.

### v3.3

- Light theme (suite-wide toggle rollout), controlled by the launcher via `PAL_THEME`; no in-app toggle.

### v3.2

- Security fix: the `PAL_SESSION` listener now checks `e.origin`. Removed the anon-key fallback in the Authorization header.

---

# Gigs & Trips

`GigsAndTrips.html`. From v7.87, full entries go in the `.md`; the inline HTML comment keeps a short pointer (same convention as `index.md` and `PeteGCal.md`). Entries before GIG-072 (GIG-001 – GIG-071) were not migrated and remain as inline comments in the HTML (see "Pre-GIG-072 history" below).

Architecture notes recorded across the changelog and backlog:
- Gigs & Trips does **not** use PalSync: bespoke sign-in and direct Supabase REST calls. Supabase has one `events` table (`id`, `user_id`, `type` = `'gig' | 'trip' | 'venue_*'`, `start_date`, `end_date`, `data` jsonb, `updated_at`); gigs, trips and venues are whole-document rows; trip items are nested in `trip.days[].items[]`. RLS is an allow-list of the Pete and Lex UIDs (`user_id` for authorship only).
- Local storage: `gat_v1` (plus `gat_v1_clean` until v7.101), on an origin shared with the whole suite.
- Google Calendar via `pal-gcal.js` (see Shared Components), shared OAuth client and Cloud project quota with PeteGCal; calendar id `GCAL_CALENDAR_ID` hardcoded to Pete's account.
- Recurrence model (in force since v7.100): **Series → virtual occurrences → exceptions**. Extend it; never add a second recurrence implementation or return to creating hundreds of real records.
- Google projection of recurrence (since v7.105): a series is **one Google recurring event** (RRULE + time zone); a changed occurrence is an **override of that Google instance** (id = series id + original slot); a cancelled occurrence is an **EXDATE** on the series; a date that has a changed occurrence is never sent as an EXDATE.

### v7.105 — GIG-116 — Repeating events sent to Google Calendar, two-way

- **Model:** series = one Google recurring event (rule + time zone); changed occurrence = override of that Google instance (id = series id + original slot, the format verified on the real calendar in v7.103/v7.104); cancelled occurrence = EXDATE on the series. A date with a changed occurrence is not sent as an EXDATE (that would delete the override in Google).
- **What now reaches Google**
  - A **new series** is created when saved: rule, start in the series' time zone, 3-hour default end computed in real elapsed time (correct across both UK clock changes), the structured description, colour and metadata `{ app:'gigs-and-trips', type, gigId, kind:'series' }`.
  - **Edit all events** updates that Google event, with the version check (`expectEtag`).
  - **Edit this event only** on a series already in Google creates the changed occurrence pointing at Google's instance, so saving it changes that instance. If the series reaches Google later, its changed occurrences are adopted as overrides; a stand-alone copy sent earlier is queued for deletion so nothing is duplicated.
  - **Cancel this event only** adds the EXDATE and updates the series. **Delete all events** deletes the Google series and its changed occurrences (404/410 count as done).
  - Converting an ordinary gig that is already in Google into a series turns that event into the recurring one rather than creating a second.
  - The send queue handles repeats: retries, a rejected rule becomes a visible Failed item, and a drain sends the series before its changed occurrences.
- **Older series are not sent because they were edited.** Series made before this release (no Google event) are created in Google only through **Sync & Backup → "⬆ Send N repeating events to Google…"**, which lists them, asks first and sends one by one. Their changed occurrences wait without queueing; one already sent as a stand-alone event keeps syncing that way until its series is sent.
- **Google-managed (imported) series are editable again.** ⚠ Supersedes the read-only behaviour recorded under v7.104 (the guards were removed). The daily refresh now covers every series that has a Google series id, including ones sent from here; the button is now "↻ Refresh repeating events from Google now".
- **No silent overwrites**
  - A push is refused if the series changed in Google since the last sync. With nothing waiting to send here, Google's version wins (the title is stripped of the app's type icon, so it cannot grow on each round trip). If both changed, nothing is touched and it is listed under "Calendar changes to review" with a **Repeats** line and **Use Gigs & Trips / Use Google**: the first accepts Google's version number and sends ours over it; the second takes Google's rule and fields.
  - If Google changes the repeat to a form this app cannot represent, it is not applied: the series is flagged Failed with the reason and left as it was.
  - The daily refresh skips a series with edits waiting to be sent, a send queued, or (for a series made here) no sync baseline. A new Google version number with identical content is no longer counted as an update.
- **Review fixes made while finishing the release.** An unfinished earlier cut of this feature was found in the working copy and reviewed before release. Three defects were fixed: it sent every series on any save, including older never-sent ones; a changed occurrence of an unsent series was queued indefinitely and would have shown as "waiting to send" for ever; and a new Google version number alone counted as an update. Two earlier tests were updated because the behaviour intentionally changed (v7.94 metadata objects 3 → 4; v7.100 "series never sent").
- Not done: "this and following"; changing a single occurrence's time zone.
- Files: GigsAndTrips.html, GigsAndTrips.md. `pal-gcal.js` unchanged (v3). Launcher unchanged.
- Tested in Node against a stub Google (16 suites pass): event bodies (weekly timed, all-day yearly, a 31 Dec all-day end, ends across the autumn and spring clock changes, EXDATE excluding only cancelled dates, monthly last-Friday with UNTIL); create/update with the version precondition; converting a gig already in Google; what is and is not sent (older series, new series, changed occurrences of an unsent series, stand-alone copies); signed-out queueing and drain order; adoption of changed occurrences including queuing deletion of the stand-alone copy; edit-this and cancel-this with and without the series in Google; the three mismatch outcomes and both resolutions; refresh protection; a rule round trip for six varied series through the real event body; the explicit Send flow including failure and permanent rejection; series instances and overrides never imported as separate gigs; deleting a synced series; a series deleted in Google flagged but kept.
- Not tested: real Google or a browser. This is the first release that writes recurring events to the real calendar. Unproven assumptions: Google accepts the event body as built (time zone on both ends, `recurrence` in a PATCH to an existing single event, colour); a PATCH of an instance id creates an override; the version precondition behaves on recurring masters as on single events. A one-series first test was requested.

### v7.104 — GIG-117, GIG-116 (read direction) — Fold imported repeats into series; Google-managed series

- The second real-calendar scan verified the sync assumptions: instance-id format matched Google on all live instances checked (timed across BST/GMT and all-day), this app's engine produced Google's dates (56/56, 28/28, 14/14, 13/13 imported ids matched); remaining mismatches were occurrences changed in Google.
- **New "🔁 Fold imported repeats into series…"** (Sync & Backup → Checks), opt-in:
  - Re-checks Google and shows the verdict; conversion stays disabled unless a live check compares real instances and matches ids and dates, with any unreproducible id/date explained by a changed occurrence.
  - Steps: **1 · Download a backup first**, then **2 · Convert now** (disabled until the backup step, refused if the check is over 15 minutes old, confirm required).
  - Brings in every representable series that has imports here or is still running (yearly birthdays/anniversaries included). Predicted from the last scan: 89 series (46 replacing imports, 43 new running), 212 imported gigs folded in, 2 kept as changed occurrences, 14 Google-changed occurrences as exceptions, net −149 KB.
  - Writes nothing to Google; local + Supabase only; one local save for the whole job (if it fails, nothing changes and nothing is pushed).
  - Edited/reviewed/reclassified gigs kept as changed occurrences (date excluded from the series); Google-changed occurrences become exceptions linked to the Google instance; cancelled dates and Google EXDATEs recorded. Deleted series/exceptions not resurrected; app-made series never overwritten. Idempotent (a bug where exceptions were rewritten on a second run was found and fixed).
- **Google-managed series** (made by the conversion): read-only in the app — occurrence view says "managed in Google Calendar" with an Open in Google Calendar link; form shows no repeat controls; Delete also deletes from Google. Refreshed automatically once a day after sign-in (only once a conversion has run) and via "↻ Refresh Google-managed series now": applies title, time, place, notes, rule and end-date changes, adds new running series, lists a series deleted in Google under "Calendar changes to review" (never removed automatically). App-created series behave as in v7.100.
- Scan report folds single-clean-import series into one line ("ONE IMPORTED GIG EACH, ALL CLEAN (41)").
- After converting: 214 gigs become 89 series; occurrences are Standard class (hidden under Important); series appear in Needs Review; the rolling pull still skips recurring instances.
- Not done: writing series from the app to Google, "this and following", refresh more often than daily.
- Files: GigsAndTrips.html, GigsAndTrips.md. `pal-gcal.js` unchanged (v3).
- Tested in Node against a stub Google modelled on real rule strings (zero Google writes, exactly one save, idempotent second run, verdict failure cases, refresh behaviour, managed-series guards). Not tested: real Google, browser, or the conversion on real data — hence the gate and backup step; reversible only by restoring that backup.

### v7.103 — GIG-115 follow-up — Fixes from the real Google scan; scan v2 with local verification and a dry run

- The first real scan found 114 recurring series (about 95 yearly), 38 individually changed occurrences, 214 imported gigs belonging to them (212 plain, about 272 KB), and three v7.102 defects:
  - Rule reader too strict: `FREQ=MONTHLY;BYMONTHDAY=28` (Payday) and `FREQ=YEARLY;BYMONTH=8` now accepted when the value equals the start date. "Dad Bday" (`FREQ=YEARLY;BYMONTHDAY=30`, no month) still refused on purpose (means every month).
  - "Green Bn Out" (UNTIL before its start) became an endless series; now refused with "ends before it starts".
  - The live check picked three ended series and compared nothing; instance-id format and engine dates were therefore still unverified.
- **Scan v2** (read-only): requests cancelled occurrences, ignores deleted series; verifies from local data with no extra Google calls (recomputes each imported instance's id and dates); live check picks up to three series running now (imports first) and labels a vacuous result "not a real check"; compact report; **dry run** of what an import/collapse would do. A pure builder for an imported series record (deterministic id `gcal_<Google id>`, Standard class) exists but nothing calls it yet.
- Consequence noted: since v7.94 (AD-10) recurring instances are not imported, so a yearly event imported once will not reappear next year, and ~90 yearly series were never brought in.
- `pal-gcal.js` unchanged (v3). Tested in Node against real rule strings and a stub Google. Not tested: real Google or browser.

### v7.102 — GIG-115, STORAGE follow-ups — Google recurrence groundwork (read-only) and storage report from real numbers

- Device results (Safari 27, tab inside the launcher): repeat check 22/22; measured storage limit about **3.57 M characters**, **1.73 M (48%) used**; Gigs & Trips holds 466 KB (about 6–7%); **86% of storage belongs to other apps** on the origin, mainly `ftt_v1` (1.19 MB) and `gym_tracker_v1` (713 KB). Inside `gat_v1`, 230 of 293 gigs are Google imports (291 KB, 62%); 172 look like instances of 6 recurring series.
- `pal-gcal.js` → **v3** (see Shared Components).
- Recurrence codec: series → Google RRULE/EXDATE writer; Google → series reader (accepts daily/weekly/monthly/yearly, interval, COUNT or UNTIL, weekly weekdays, monthly 1st–4th/last weekday, EXDATE in three forms; refuses BYMONTHDAY, BYSETPOS, RDATE, hourly, multiple RRULEs, COUNT with UNTIL, weeks not starting Monday, with a reason); Google instance id (master id + original start as UTC stamp, or date for all-day). Timed UNTIL converted through the series' time zone.
- New read-only "🔎 Scan Google recurring events" (Sync & Backup → Checks): one paged list call, at most three instance calls; no writes.
- Storage report:
  - Percent used is of the measured limit (stored in tiny key `gat_storage_limit`); the old fixed 5 MB guess removed (it showed 66% when 48% was true).
  - Every key classified, including launcher keys `pal_layout_cache`, `pal_ftt_stat`, `pal_standalone_*`, suite `pal_device_id`, and other apps by owner where the launcher names them (Fantasy Football, Gym, Fortnight, Claim, Reading, Meal Planner, Horizon); otherwise "Another app (prefix)".
  - Retired keys removed at startup: `gat_calAgendaShowEmpty`, `gat_itemSortMode`, `gat_hideTripGigs`, `gat_calView`.
  - Once-a-day early warning at ≥85% of the measured limit (silent until measured).
- Not done deliberately: writing series to Google, reading series edits back, the collapse.
- Files: GigsAndTrips.html, pal-gcal.js (v3), GigsAndTrips.md. Tested in Node (codec round trip of 13 series over five years; scan stub; storage). Not tested: real Google, browser.

### v7.101 — STORAGE-001/002/004, CLASS-001, RECUR-TEST-001/002/003 — Storage completion, Needs Review queue, repeat self-check

- **STORAGE-001:** `saveData()` no longer writes `gat_v1_clean`; one local copy. The launcher already read `_clean` with a fallback to `gat_v1` and filtered tombstones itself. Stale copy removed once at startup. Quota-recovery path from v7.94 kept. Optional launcher v10.99 reads `gat_v1` directly; the app is safe with either launcher version.
- **STORAGE-002:** every key in the Storage report has a category and retention rule; unrecognised keys reported as Unclassified.
- **STORAGE-004:** opt-in "Measure real limit" writes temporary 64K-character chunks until refused, removes them, checks storage is writable; leftover chunks removed at startup. The only storage feature that writes.
- **CLASS-001 — Needs Review queue:** a gig needs review when its class is a guess (Google import, or no class and an ambiguous type: other, gym, pets, or travel/stay/food/key stop/attraction not on a trip). Derived each time; only `classReviewed: true` is stored. Sync & Backup → "Review classes (N)", 30 per page, one-tap Gig / Appointment / Standard / ✓ Keep, plus "Keep all".
- **RECUR-TEST-001:** "Check repeating events" runs 22 cases in the user's browser (DST, months, leap years, COUNT, UNTIL, exceptions, window slicing, cap); shown to be able to fail; reads/writes nothing.
- **RECUR-003:** `recurrence.timeZone` (default `Europe/London`) stored on the series only; v7.100 series default when read (no migration write).
- **RECUR-002:** one expansion implementation (`recurOccurrences`, used via `recurExpandAll`). Clash warnings now include occurrences. Places that do not show occurrences: Past, Reviews, completion prompts, launcher card, trip link pickers, venue statistics.
- Not done: STORAGE-003 retention, Google recurrence, collapsing imports.
- Files: GigsAndTrips.html, GigsAndTrips.md; optional launcher index.html v10.99 (⚠ no v10.99 entry in `index.md`). Tested in Node. Not tested in a browser.

### v7.100 — GIG-106, GIG-107 — Repeating events, stage 1: in the app

- Deliberately not the GIG-048 design removed in GIG-060.
- A repeating event is **one gig record** (the series) with a recurrence rule; occurrences are computed when needed, never stored. Changing a single occurrence stores an ordinary gig (exception) pointing back via `recurrenceOf` and `recurrenceOriginalDate`; the series skips that date via `recurrence.exdates`. Cancelling one occurrence adds to `exdates`. Dates are plain calendar dates with wall-clock times (DST-safe). No Supabase schema change.
- Rules: daily; weekly on chosen days; monthly by date, 1st–4th weekday or last weekday; yearly; every N; ends never / on a date / after N. Weeks start Monday; a non-existent monthly date is skipped; 29 Feb only in leap years; COUNT counts before cancellations.
- UI: Repeats section on the gig form; occurrence view (🔁) with Edit this event only / Edit all events / Cancel this event only / Delete all events. A repeating event cannot be in a trip (a single changed occurrence can). Upcoming (next 120 days, capped at 400) and Agenda show occurrences; Past does not.
- Guards: the series record never appears as an extra entry, completion prompt, review candidate, clash or duplicate candidate. Series not synced to Google (changed occurrences sync as single events). Mirror deletion check recognises recurring events by occurrences.
- Known limits: no done/missed/review per occurrence; same-date/day-off warnings ignore occurrences (⚠ clash checks added in v7.101); no "this and following"; converting a Google-linked gig to a series leaves its single Google event.
- No `pal-gcal.js`, launcher or schema change. Tested in Node. Not tested in a browser or against real Google.

### v7.99 — GIG-111 — Upcoming and Past: day headers, class filter, "On now"

- Day headers within each month (weekday + date, relative labels, "N events", weekend accent, Today highlighted); grouping uses the existing sort date (trip start on Upcoming, end on Past).
- "On now" block at the top of Upcoming for trips under way (not repeated below).
- Class filter bar (All · Important · Gigs · Appts · Trips · Standard) on Upcoming and Past, sharing `gat_cal_filter` with the Agenda; default Important; hidden-count line. Search ignores the filter and stays flat.
- Consequence: own gigs of type "other" (Standard) hidden by default.
- No data, sync, Supabase or `pal-gcal.js` change. Tested in Node. Not tested in a browser.

### v7.98 — GIG-118 follow-up — Duplicate finder that matches what the duplicates are

- ⚠ The backlog records this work as GIG-119 ("duplicate finder by date + normalised title"); the changelog heading calls it a GIG-118 follow-up.
- Diagnosis (from code and the old changelog, not yet confirmed on data): the old "add to Calendar" URL flow created a new Google event each time (`[Sent 4 Jul]` / `[Updated - 14 Jul]` suffixes); the mirror and 4-year backfill imported each as a gig.
- "🧹 Find duplicates" replaces v7.96's button: same date + normalised title (ignoring icon and suffixes) among gigs, trip items and trips; same Calendar id as a trip/item; different-time unsuffixed pairs left alone; repeating titles reported, never removed. Only plain gigs removable; the keeper is the edited/reviewed/reclassified/trip-linked record, then unsuffixed, then older.
- Two removal choices: local + Supabase only, or also queue Google deletes via the v7.96 queue (never deleting an event a kept record owns). Recomputed at press time.
- Import guard: the Calendar import skips likely copies of existing gigs/trips/items (same date and normalised title, and same time / no time / suffixed copy); at most one of two copies in a batch. Sync Log reports skips.
- Tested in Node. Not tested on real data or in a browser.

### v7.97 — GIG-100 part, GIG-102, GIG-103, GIG-104 part, GIG-105, GIG-115 — Two-way sync for gigs

- Supabase stays the source of truth. Google may change a gig's **title, date, time, location and notes** only. Each gig stores `gcalEtag` and `gcalSyncedHash` (hash of those five fields).
- On every pull: Google unchanged → nothing; Google changed only → applied; both changed → no overwrite, listed under "Calendar changes to review" (per-field, Use Gigs & Trips / Use Google). Gigs linked before this release are silently baselined (edits made in Google before v7.97 are not pulled in).
- Round-trip safe (GIG-100 part): icon prefix stripped on the way back; notes read back out of the structured description block.
- Push protection (GIG-115 reduced): `pal-gcal.js` **v2** `expectEtag` (see Shared Components); mismatch routed to review (or Google's change applied if no local edit) and not re-queued. Script tag `?v=2`.
- Deletions in Google (GIG-103/104 part): linked gigs, trips and items missing from the pull window are checked individually (max 10 per pull; a 500 stops the check). Gone/cancelled → listed for a decision: gigs Remove here / Re-create in Google / Keep, unlink; trips and items re-create or unlink only.
- Not included: Google→app edits for trips/items, scheduled weekly reconciliation, richer hidden metadata (GIG-100 remainder), recurrence. Review entries stored in device-local `gat_gcal_conflicts`, pruned when stale.
- Tested in Node. Not tested against real Google: assumes etag in list/patch responses and 404/410 or `status: cancelled` for deleted events.

### v7.96 — GIG-101, GIG-103 part, mirror bug fix — Calendar sync queue, safer deletes, no more duplicate imports

- ⚠ The backlog records the mirror bug as GIG-118.
- Bug: `gcalUnmatchedEvents()` only checked gig-owned Calendar ids, so trip and item events (since GIG-078/079) were re-imported as duplicate "other" gigs. Now also skips ids owned by trips/items, ids with a queued delete, and events tagged as trip/item. "🧹 Find duplicate Calendar imports" removes only plain unedited copies (local + Supabase; never Google). Storage report shows a duplicate-looking count.
- **GIG-101 — Calendar sync queue:** failed or signed-out gig/trip/item syncs queued in `gat_gcal_queue` (ids only); replay re-reads the current record and updates if another device linked it. Failure classes: sign-in/offline don't use attempts; rate/quota pauses 10 minutes; server errors retry up to 6 times; permission errors and "event no longer exists" go to Failed (never auto-recreated). Drains after sign-in, on return to the app and on reconnect (max once a minute). Sync & Backup shows Waiting/Failed, Retry now, Discard failed; forms show "⏳ waiting to send" / "⚠ sync failed".
- **GIG-103 part:** a committed local delete queues any Google delete that didn't succeed; closes the GIG-082 gap (`generateDays()` cascade). 404/410 counts as success.
- `pal-gcal.js` and launcher unchanged. Tested in Node with a stub Google client. Not tested in a browser or against real Google.

### v7.95 — GIG-092, GIG-095, GIG-096, GIG-097, GIG-098, GIG-099 — Event Class and the Agenda filter

- Every entry has a class: Gig / Event, Appointment, Trip / Itinerary, Standard, Other. A gig stores `eventClass` only when chosen or set by an import; otherwise derived at read time (no bulk migration, no Supabase write storm).
- Defaults: music, play, musical, comedy, sport, festival, cinema → Gig / Event; appointment → Appointment; travel, stay, food, key stop → Trip / Itinerary on a trip, otherwise Appointment; attraction → Trip / Itinerary on a trip, otherwise Gig / Event; gym, pets, other → Standard. Trip items always Trip / Itinerary. New Calendar imports stored as Standard.
- Gig form "Calendar class" selector (Auto removes stored class).
- Agenda filter bar (All · Important · Gigs · Appts · Trips · Standard), remembered in `gat_cal_filter`. Important includes anything inside a trip; Trips includes anything on a trip. Agenda defaults to Important with a hidden-count line; NOW/NEXT only considers matching entries.
- Consequence: existing "other" gigs (including all Google imports) hidden from the default Agenda.
- No launcher, `pal-gcal.js`, Supabase or Google change.

### v7.94 — GIG-089, GIG-091 part, AD-9, GIG-110 — Storage write safety, import hygiene, housekeeping

- **GIG-089:** a `QuotaExceededError` used to throw out of `saveData()` and abort `saveEvent()` before `pushEvent()`. Now: on quota failure remove `gat_v1_clean` and retry once; otherwise a rate-limited toast and Sync Log entry, and the Supabase push still happens. `saveData()` returns true/false. Limitation: with storage genuinely full the edit is in Supabase but not shown on that device.
- **GIG-091 (b)(d):** imports carry `importedFrom: 'gcal'`; recurring instances (`recurringEventId`) no longer imported by the rolling pull or 4-year backfill (counts shown). Reversible via `GCAL_SKIP_RECURRING`.
- **AD-9:** gig/trip/item Calendar metadata gains `app: 'gigs-and-trips'`; metadata key stays `petegcal`.
- **GIG-110:** v7.92 entry labelled GIG-087.
- Deliberately not done: Europe/London `timeZone` on Google writes (AD-11, ships with GIG-116).
- No launcher, `pal-gcal.js` or data-model change.

### v7.93 — GIG-088 — Read-only storage report

- Sync & Backup → Storage → "Storage report (read-only)": every localStorage key on the origin with size, owner and category, by-category totals, and a summary of `gat_v1` (gigs, trips, days, items, tombstones, venues, `_clean` size, types, import-looking and recurring-looking counts, five largest records), plus home-screen app vs browser mode. "Copy report".
- Changes nothing: collectors take the storage object as a parameter, tested against a shim that throws on any write.
- Version strings v7.92 → v7.93 in title, header and `pal-shared.js` cache-bust; functions between `// ==GIG-088 BEGIN==` and `END` markers.
- Notes: nominal 5 MB figure is a rough guide (⚠ replaced by a measured limit in v7.102); recurring-looking count relies on Google's instance-id pattern (⚠ confirmed in v7.104).

### v7.92 — GIG-087 — Fix: Calendar mirror pull throttled

- First real-world finding: `gcalMirrorPull()` fired on every page load. With heavy reloading during GIG-072–086, the backfill and the migration tool (sharing the Google Cloud project quota with PeteGCal), it hit Google's Calendar API quota ("The quota has been exceeded"). Nothing lost (read-only pull; failure reported correctly).
- Fix: throttled to once per 10 minutes, keyed on last attempt; new "🔄 Pull from Calendar now" bypasses the throttle. `minsAgoLabel()` helper.
- Tested in Node against the real failure scenario.

### v7.91 — GIG-086 — Agenda navigation and secondary metadata

- "↑ Today" button (`scrollAgendaToToday()`); previous/next-period paging deliberately not built (no period grid exists).
- Item rows show duration only when real `durationMinutes` exists.
- Completes the original Agenda/Today build (GIG-081–086).

### v7.90 — GIG-085 — Today mode: NOW/NEXT

- Compact NOW/NEXT card at the top of the Agenda (not a separate tab), reusing `renderAgenda()`'s data.
- "Never invent an end time": gigs have no duration and are never NOW; items are NOW only with an explicit `durationMinutes`. NEXT skips started/finished and all-day-today entries.
- `durationMinutes` added to the item agenda-entry shape.

### v7.89 — GIG-084 — Agenda UI

- New Agenda tab between Upcoming and Past (same `switchTab()` / `.ni` pattern). Date-grouped stream of `getAgendaItems()`; trip context as a small label above the entry. Empty days never shown. Window today → +60 days. Reuses existing typography.

### v7.88 — GIG-083 — Agenda data layer

- `getAgendaItems(startDate, endDate)` combines standalone gigs and trip items into one sorted stream, reusing `sortDayTimeline()` and the `_linkedGig` merge: a trip-linked gig is folded into its day once; an orphaned `tripId` falls back to standalone; ghost items excluded. Helpers `agendaEntryFromGig`, `agendaEntryFromItem`.

### v7.87 — GIG-082 — Deletion failure handling

- `gcalDeleteGig` / `gcalDeleteTrip` / `gcalDeleteItem` return true / false / `'skipped'`. `confirmDeleteGig`, `confirmDeleteTrip`, `deleteItem` await the Calendar delete and on failure ask whether to delete anyway or cancel; trip failures summarised in one confirm.
- Known limitation: `generateDays()` cascade delete on shrinking a trip still fire-and-forget (⚠ closed in v7.96).

### v7.86 — GIG-081 — Structured Calendar descriptions

- Built from a pasted external spec (source unconfirmed). One formatter `gcalFormatDescription` plus `gcalGigDescriptionFields`, `gcalTripDescriptionFields`, `gcalItemDescriptionFields`, using real fields only (no booking ref / confirmation number fields exist). Native fields not duplicated.
- Retires the "rich Calendar descriptions" entry in `gigs-and-trips-gcal-backlog.md` (not supplied).

### v7.85 — GIG-080 — Item-level Calendar button

- "View in Google Calendar" / "Sync to Google Calendar" on the trip-item form; hidden for unsaved and ghost items. Completes GIG-077–080.

### v7.84 — GIG-079 — Item-level Calendar sync

- Every trip item gets its own Calendar event via `itemTime()`, `itemLocationName()`, `typeIcon()`. Accommodation syncs as a multi-night all-day span; ghost items skipped.
- Fixed in the same pass: deleting a trip cascades to item events; shrinking a trip's dates deletes orphaned items' events.

### v7.83 — GIG-078 — Trip-level Calendar sync

- One multi-day all-day event per trip (end-date-exclusive), replacing the URL popup. `gcalTripUrl()` and `markCalendarAdded()` removed.

### v7.82 — GIG-077 — Foundation for trip/item sync

- Added `GCAL_ITEM_COLOR_MAP` (7 `ITEM_TYPES`) and `GCAL_TRIP_COLOR_MAP` (3 `TRIP_TYPES`). No behaviour change.

### v7.81 — GIG-076 — Full Calendar mirror

- Rolling pull (−14 / +180 days, same as PeteGCal) on load; unmatched events (by real `calendarEventId`) imported as `gigType: 'other'`. Separate "Import 4 years of Calendar history" backfill. Depends on GIG-073 having run.
- Discovered already present: `checkGigFormConflicts()` and the working-day alert reading Fortnight Tracker's data.

### v7.80 — GIG-075 — Gig form simplified

- Ticket URL/price behind a collapsible "+ Ticket details". Separate ticket/seat note merged into Notes on edit open and cleared on save.

### v7.79 — GIG-074 — Real Calendar sync replaces the URL-popup flow

- `saveGig()` calls `createEvent` / `updateEvent`; fire-and-forget, never blocks the save. Silent sign-in on load. Calendar button reflects real state. Deleting a gig deletes its event. `gcalGigUrl()` removed.

### v7.78 — GIG-073 — One-time Calendar link-up migration

- "Link existing gigs to Google Calendar": gigs with `calendarAdded` and no `calendarEventId` matched by date + title, linked one at a time (title match is a heuristic because of the `[Sent D Mon]` suffix).

### v7.77 — GIG-072 — Google Calendar sync foundation

- Added `pal-gcal.js` and the Google Identity Services script, reusing PeteGCal's OAuth Client ID. Constants `GCAL_CLIENT_ID` and `GCAL_CALENDAR_ID` (hardcoded to Pete's account, not `'primary'`). Initialises on boot and logs to the Sync Log. No behaviour change.

### Pre-GIG-072 history (GIG-001 – GIG-071)

⚠ Not supplied as a changelog. It remains as inline comments in `GigsAndTrips.html`; migrating it is backlog item GIG-113 (deliberately its own scoped, tested piece of work). The following older facts are recorded only in the backlog document and are preserved here as stated there:

- GIG-033 — `calSnapshot*` / `calendarStatus` removed in v7.8.
- GIG-036 — per-item URL flow and `[Sent D Mon]` suffix (superseded by GIG-079/080).
- GIG-043 follow-up "Convert to Gig" — removed in GIG-057.
- GIG-045 — Calendar tab with Month/Week/Day/Agenda; removed in GIG-057 (v7.58). GIG-046/047 "Show empty days" went with it.
- GIG-048 — repeating gigs as materialised rows (`seriesId`, `seriesIndex`); removed in GIG-060. Orphan `seriesId` data may remain and is ignored.
- GIG-049 — FAB merge / merged gig-item types; reversed by GIG-058 (merged `GIG_TYPES` entries remain).
- GIG-050 / 052 / 053 — load-speed and pal-utils work; GIG-052 batched pushes.
- GIG-055 — pal-sync.js migration closed: leave as-is (shared-data model incompatible with per-user rows).
- GIG-056 follow-up — "Hide trip gigs" toggle (added v7.27) removed.
- GT-001 — tombstone confirm/strip; GT-004 — JSON export/import with cloud reconcile before push; incremental Supabase pull with an `updated_at` cursor.

## Gigs & Trips — Backlog & planning record (not completed changes)

From `GigsAndTrips-Backlog.md`, "Consolidated Backlog (now at v7.101) — rev 3" (⚠ the document's header has since moved on to v7.105, still rev 3). It was produced from v7.92 plus later revisions and is a planning document. ⚠ This section predates v7.102–v7.105; some items below were progressed after it was written (noted where the changelog shows it). Not inspected when it was written: `gigs-and-trips-gcal-backlog.md`, the external UX spec, the live Supabase schema.

### Status at rev 3 (v7.101)

| Area | Status at rev 3 |
|---|---|
| Event Class and filters | Implemented (v7.95, v7.99) |
| Agenda / Today / Now-Next filtering | Implemented |
| Recurrence stage 1 | Implemented, confirmed working on device (v7.100) |
| Storage reporting; quota-safe saving | Implemented (v7.93, v7.94) |
| Sync queue; import foundation; two-way gig sync | Implemented / partial (trip/item edits and series not synced) |

Review items: STORAGE-001 done (v7.101); STORAGE-002 done, still needs a real device report; STORAGE-003 retention **deliberately deferred**; STORAGE-004 tool built, validation to be run on the device; CLASS-001, RECUR-TEST-001, RECUR-002, RECUR-003 done (v7.101); Google recurrence API (GIG-115), Google recurrence sync (GIG-116) and imported-recurring collapse (GIG-117) next.

### Agreed models and rules

- Architecture position: Supabase → canonical events → Event Class → recurrence → Agenda / Today / Search → Google projection.
- Google recurrence model: GAT series ↔ Google recurring master; GAT exception ↔ Google **instance override** (replaces the earlier "exclude the date and send a separate event" idea). Needs non-expanded listing, `showDeleted` and an instances call; `recurrence.timeZone` becomes the master's `timeZone`; `recurrenceOriginalDate` maps an exception to its instance.
- Imported recurring events: identify `recurringEventId` → group → fetch master → preview → recommend JSON export → convert. **Never delete Google events during a local collapse** (a gig delete normally deletes the real event). ⚠ Implemented in v7.104 as "Fold imported repeats into series".

### Outstanding / open items (as listed at rev 3)

- **GIG-094** — retention policy: duplicate retired (v7.101); tiered policy, cleanup triggers and an export-first "Prune imported Standard events older than N months" tool deferred until a real report justifies them.
- **GIG-100** — remainder: hidden metadata in `extendedProperties.private` (app, ids, class), clean title in metadata.
- **GIG-104** — partial: no scheduled weekly reconciliation sweep.
- **GIG-106 / GIG-107** — stage 2 (Google import/write of series) and "this and following" deferred. ⚠ Stage 2 delivered: import/read in v7.104, write in v7.105. "This and following" is still deferred.
- **GIG-108** — storage health indicator (⚠ measure tool and 85% early warning added in v7.101/v7.102).
- **GIG-109** — remove legacy flows: item-card URL link (`gcalItemUrl`), `markItemCalendarAdded`, `calendarAdded` badges, after GIG-093 is verified.
- **GIG-090** — canonical event model specification (design only).
- **GIG-093** — sync-link block `gcal: { eventId, htmlLink, etag, remoteUpdated, lastSyncedAt, lastSyncedHash, state }` with dual-write of `calendarEventId` / `calendarHtmlLink`.
- **GIG-091** (a)(c)(e) — deterministic import id `gcal_<googleEventId>`, trimmed stored fields, backfill breakdown.
- **GIG-112** — Trips dashboard / Month grid (P3).
- **GIG-113** — migrate GIG-001–071 history into the `.md`.
- **GIG-114** — real-device verification checklist for GIG-072–087 (iPhone Safari and the PWA).
- **GIG-115** — remaining library options not needed yet (syncToken, single-call metadata update, configurable namespace).
- **GIG-116** — recurrence ↔ Google sync (⚠ read direction for Google-managed series delivered in v7.104; app → Google writes delivered in v7.105, not yet proven against real Google).
- **GIG-117** — collapse imported instances (⚠ delivered as the v7.104 conversion).
- PeteGCal retirement — decision open (shared quota and calendar; risk R-9).
- Parked: Year / 3-day views, drag-and-drop calendar, desktop scheduling grid, countdown-heavy UI.
- Known small gaps at rev 3: series record selectable in trip link pickers and counted once in venue statistics; no done/missed/review per occurrence; no "this and following"; launcher card ignores series by design.

### Architecture decisions (as recorded at rev 3)

| # | Decision | Status / outcome |
|---|---|---|
| AD-1 | Keep event documents vs normalise trip items into rows | Decided: keep documents; add `updatedAt` per trip item and merge items by id on pull |
| AD-2 | Field ownership Supabase vs Google | Decided with a condition: Google may change title/date/time/location/notes and recurrence; everything else app-owned |
| AD-3 | Imported Google events default to Standard | Decided: yes |
| AD-4 | Defaults for ambiguous gig types | Open (proposed mapping; flagged records reviewed) |
| AD-5 | Gig inside a trip appears in two filters | Decided: yes |
| AD-6 | Recurrence storage | Open, refined: series master + virtual expansion + exceptions, mapped to RRULE / instance overrides; unsupported rules Google-managed read-only (⚠ implemented v7.100–v7.105; unsupported rules are refused with a reason rather than shown read-only) |
| AD-7 | Launcher dependency on `gat_v1_clean` | Decided: launcher reads `gat_v1` |
| AD-8 | Prune old imported Standard events | Open: explicit tool, export first |
| AD-9 | Metadata namespace / ownership with PeteGCal | Decided: keep `petegcal` key, add `app: 'gigs-and-trips'` (done v7.94) |
| AD-10 | Stop importing new recurring instances until series support | Implemented v7.94 (`GCAL_SKIP_RECURRING`) |
| AD-11 | Europe/London `timeZone` on Google writes | Decided: ships with GIG-116 (⚠ done in v7.105: series start and end carry the series' `timeZone`) |

### Migration risks recorded

R-1 preserve `calendarEventId` verbatim; R-2 `calendarAdded` without id stays unlinked; R-3 nested trip items mean item writes rewrite the whole trip; R-4 additive Supabase fields only; R-5 removing `_clean` could break the launcher card; R-6 the 4-year backfill cannot be undone by the app; R-7 old backups must import and classify; R-8 Lex edits the same documents (whole-doc last-write-wins); R-9 shared quota and calendar with PeteGCal; R-10 time zones / all-day / 3-hour default gig duration must survive round trips.

### Findings recorded at rev 1 that remain useful context

- Trip items have no `updatedAt`; merge is whole-trip last-write-wins on the trip's `updatedAt`.
- Mirror-pull race: the "already imported?" check is local-only, so two devices can import the same event with different ids.
- Google access is client-side only, so nothing syncs while the app is closed.
- Earlier decisions made Google the source of truth for date/time/location; the brief made Supabase canonical with Google as a projection, reconciled through explicit field ownership (AD-2).
- Almost everything since GIG-072 was marked "not tested in a real browser" (GIG-114).

---

# Gym Tracker

`gym-tracker.html`. The app's inline comment block keeps the 15 most recent releases; the rest was in `gym-tracker.md`, resequenced newest-to-oldest. Supabase tables follow the generic `gym_*` shape (`record_key` + jsonb `data`, RLS `auth.uid() = user_id`). Local key `gym_tracker_v1`; cross-app summary key `gym_pal_xapp`.

⚠ Source notes: v2.48 was used for two unrelated fixes, kept as (i) and (ii). GYM-072, GYM-073, GYM-059 and GYM-074 are each reused for different tickets. v2.68 is labelled CLA-013 and v2.47 FT-031 (misfiled IDs; both are Gym Tracker changes).

### v2.109 — Remove a whole circuit

- Circuit-level 🗑 removes a circuit and all its exercises after a confirm naming the circuit and count. Plan editor: `removePlanCircuit()` (draft only until Save Plan). Live session: `removeSessionCircuit()` (stops or re-points a running timer; drops the circuit from `_activeSession.circuits`). Per-exercise ✕ and "Not in a circuit" unchanged.
- No data-model, localStorage, sync or JSON change. `pal-shared.js?v=2.109`, title, badge and `VERSION` bumped.

### v2.108 — GYM-094

- Plan picker auto-collapses to the selected plan with "Show other plans (N)" (`_pickerShowAll`, `showAllPickerPlans()`, collapsed branch in `fillPlanPickerList()`; reset by `resetPickerSections()`). Edit mode opens collapsed; one-tap "Start from a plan" unchanged.
- Session Cancel / Finish (Save Changes when editing) moved from a fixed footer to the end of the session after Session Notes (`.session-footer` removed).
- No data change. `pal-shared.js?v=2.108`. Tested: 52 headless checks at 390px and 1280px.

### v2.107 — GYM-095

- Adopted the combined `pal-shared.js`. See Shared Components.

### v2.90 — GYM-082 — Progress Breakdown

- Overall Progress shown as a colour-coded segmented bar (`progressBarAndLegend()`) in a new "📈 Progress Breakdown" section.
- Segmented by primary body area (`tags[0]`, `primaryAreaForExercise()`); legend entries link to a new trend filter on the Exercise List (All/Up/Steady/Mixed/Down) via `jumpToExerciseListFiltered()`.
- History: `computeProgressHistory()` samples the score at 8 points using rolling 30-day windows one week apart, plotted with `sparklineSvg()`.
- Explicitly not weighted by training frequency (rationale in the comment above `scoreFor()`); a recommendation, not a closed decision.

### v2.89 — GYM-081 — What "progress" means per exercise

- `bestSetValue()` (source of every trend read) now uses estimated 1RM (Epley: weight × (1 + reps/30)) for reps/weight.
- New per-exercise settings: Progress Direction for time (Longer/Endurance vs Shorter/Speed) and Progress Basis for distance (More Distance vs Faster Pace); defaults preserve previous behaviour; stored on the exercise so history re-reads under the new choice.
- `computeOverallProgressScore()`: among exercises with ≥2 occurrences in the window, (improving − declining) / judged as ±100%. Flagged as a judgement call.

### v2.88 — GYM-080

- ⚠ Built from the uploaded v2.87; an earlier, different v2.88 (GYM-079, water averaging as its own row) apparently never reached GitHub and is superseded — discard it if found.
- Water sits in the same Active/Rest Days cell as calories/protein (`computeWaterAverageSplit()`, independent of food dates); a cell renders if either has data.
- Protein figures labelled "165g protein" in Insights, PDF nutrition cells and the Notes targets line.
- Tab order: Home, Insights, Plans, Exercises, Notes.

### v2.87 — GYM-078 — Insights / Notes / Home reorganisation

- Moved to Notes: PDF Report generation and Nutrition/Water targets (same modals and save functions).
- Moved to calendar day cards: PT session logging (`dayPTSummary(date)`, `openPTModal(presetDate)`); `renderPTSection()` removed.
- Insights rebuilt: "📊 Period Overview" first; new "🏋️ Exercise List" (every exercise done ≥1x, sorted by count, searchable) replaces "📈 Progression Summary" and "📈 Exercise Progress"; shared `groupItemsByExercise()` / `exerciseHistoryEntries()` with `buildExerciseListData()`; "🎯 What To Train Next" after it (own call); Body Weight list collapsed by default; "Body Areas Worked" at the bottom with its own Week/Month/3 Months/Year/All filter.

### v2.86 — GYM-077 — Summary section

- "📈 Progression Summary" for exercises trained ≥2 times: completion ratio, trend (Steady/Improving/Declining/Mixed — every consecutive pair must agree) and sparkline, in Insights and the PDF report.
- "📊 Period Overview" in Insights (sessions, completion, avg duration, avg cal/protein); PDF Summary grid gains avg cal/protein cells.
- Shared plumbing: `buildExerciseProgressionData()`, `classifyProgressionTrend()`, `sparklineSvg()`, `computeNutritionAverages()` (extracted from GYM-066's PDF code).
- Not related to GYM-049's removed "auto-progression".

### v2.85 — GYM-075, GYM-076

- GYM-075: finishing a session no longer auto-opens the GymSummary Shortcut modal; goes straight to `offerPlanPrompt()`. The modal is manual via a chip button renamed "📤 Send to Notes" (was "📤 Send to Watch"). `promptSessionSummary()` / `_pendingFinishedSessionForPrompt` removed.
- GYM-076: saving checks for partially logged exercises and asks once whether the session was completed in full (yes ticks every remaining set and marks every exercise Completed, including untouched ones — confirmed intent). Session chip shows Completed/Partial/Skipped (`sessionStatus()`) and a "✓ Complete All" button.

### v2.84 — GYM-074 — First-open sync errors

- The app only listened passively for the launcher's `PAL_SESSION`. `requestFreshSession()` (GYM-021) now also fires every 700ms up to 6 times in the first ~4s after load, stopping when a session arrives. No launcher change required.

### v2.83 — GYM-074-water

- The two water views from v2.82 merged into one card list (every ⚡ Quick Add item plus any item logged today), each with −/+ and 🗑 to clear the day's count. Selecting a search pill logs one instance immediately. Typing a name matching a saved item uses that item's canonical volume.
- `migrateWaterEntries()` (additive only) backfills the `savedItemId` link on older entries, never rewriting or merging history.

### v2.82 — GYM-073

- Saved water items can be flagged ⚡ Quick Add, shown at the top of the Water modal with a stepper. Repeated taps aggregate into one entry per item per day, linked by `savedItemId`. Manually editing a quick-add entry clears the link.

### v2.81 — GYM-072-d

- Log_Weight Shortcut now receives the bare number (e.g. "82.4"); the formatted sentence from v2.80 broke it ("couldn't convert text to number"). Clipboard copy matches.

### v2.80

- Log Weight Save button is a real anchor launching the `Log_Weight` Shortcut, `href` kept current via `oninput`; invalid weight calls `event.preventDefault()`. `shortcutUrlFor()` takes the shortcut name.

### v2.79

- `target="_blank"` (+ `rel="noopener"`) added to the Shortcut link as a further iOS home-screen PWA workaround; if still blocked, the restriction is likely PWA-specific (test in a Safari tab; next avenue would be a Shortcuts Automation, NFC or Focus trigger).
- New `compactSetsSummary()` collapses identical consecutive sets ("5×60kg x3") for the Shortcut text only.

### v2.78 — GYM-072-b follow-up

- Copy & Send is now a real `<a href="shortcuts://...">` with the URL pre-set; the click handler only copies and never calls `preventDefault()` (script-driven `location.href` was swallowed in the iOS standalone web app).

### v2.77

- After saving a session, a modal shows a plain-text summary with "Copy & Send", opening `shortcuts://run-shortcut?name=GymSummary` with the summary as input. Navigation happens synchronously before the clipboard write. "📤 Send to Watch" chip for resending.

### v2.76 — GYM-072 (reused)

- Optional PT Name on Log PT Session, shown in the session list and Insights summary. ⚠ GYM-072 also used for v2.74.

### v2.75 — GYM-073

- History tab dropped (six tabs → five). The flat session list was redundant with calendar chips (GYM-070) and the report; the exercise-progress picker moved into Insights as a collapsible section. Removed `setHistoryMode()`, `renderHistory()`, `sessionSummaryCard()`, `renderHistorySessionsList()`; kept functions still used by `calSessionChip()`.

### v2.74 — GYM-072

- New suite-wide rule: tab bars text-only (icons removed unless a cheap live metric applies). "Prog & Plans" shortened to "Plans". No live counts added (Notes undone-count flagged as a possible follow-up).

### v2.73 — PET-068 / GYM-071

- ⚠ Uploaded file's title/badge read v2.72 but `VERSION` was '2.71'; reconciled.
- Launcher dashcard showed floating-point noise. `fmtProtein()` generalised to `round2()`; applied at save time for calorie/protein/volume inputs and at every sum/display site; `round2()` ported into `index.html`'s `statGym()`.

### v2.72 — GYM-071

- `fmtProtein()` limits protein display to at most 2 decimal places (no padding) at every read-only display site; not applied to edit fields or stored data. Brief title said 1dp, body said 2dp; implemented 2dp and flagged.

### v2.71 — GYM-070

- Expanding a completed session chip on the calendar offers ✏️ Edit Session (existing `editSession()`), alongside 📋 Edit Plan and 🗑 Remove.

### v2.70 — GYM-069

- Protein progress bars use `--accent5` (purple) instead of `--accent3` (shared by other UI).

### v2.69 — GYM-068 — Water intake tracker

- Mirrors the meal log: searchable auto-building saved-items library (name + ml), per-day log, modal with a progress bar against a single daily target (no active/rest split).
- New synced data `waterEntries`, `savedWaterItems`, `waterTargets`; new tables `gym_water_entries`, `gym_saved_water_items`, `gym_water_targets` (works offline until created). Shown on the launcher Gym card.

### v2.68 — CLA-013 (misfiled)

- Nutrition targets split into Active day / Rest day pairs (`isActiveDay()` / `getTargetsForDate()`: a day with any scheduled or logged workout is active). Day card, Meals modal and PDF pick the right target and tag 🏋️/😴; PDF splits averages. Old single target migrates to both.

### v2.67 — GYM-067 follow-up

- Completed plan chips gain 🗑 Remove (deletes the underlying session).

### v2.66 — GYM-066

- Generate Report gains "Include food / nutrition data" (default on, remembered per device): overview plus per-day meal table, scoped to the report range.

### v2.65 — GYM-065

- Meal editing replaced three sequential `prompt()` dialogs with one modal (shared by saved meals and logged entries); logged meal entries gain Edit.

### v2.64 — GYM-062, GYM-063, GYM-064

- GYM-062: `var(--ink1)` was used in 5 places but never defined (invisible text); changed to `var(--ink)`. Calorie/protein progress bars (`nutriBarsHtml()`) on the day card, Meals modal and the launcher Gym card; full-width launcher change (removed `#pairGymReading`).
- GYM-063: per-plan-item notes (copied into the session at start; exercise notes stay live); `notes` field in the program-import template.
- GYM-064: search-first meal entry with saved-meal pills; library builds itself (never overwrites saved numbers); "Manage Saved Meals". New table `gym_saved_meals`.

### v2.63 — GYM-061, GYM-060, GYM-059 (notes)

- ⚠ GYM-059 reused across two tickets.
- GYM-061: plan-target update on finish is a two-button modal ("No, just save" / "Yes, update plan"); session always saved first.
- GYM-060: meal/nutrition log per calendar day (manual calories/protein with a Google-search shortcut; no paid API). New data `nutritionEntries`, `nutritionTargets`; tables `gym_nutrition_entries`, `gym_nutrition_targets`.
- GYM-059 (notes): exercise notes resolved live at session start; plan notes shown as a banner; programs gain notes (📝); import template `programNotes`; PDF gains a Notes section.

### v2.62 — GYM-059

- ⚠ The uploaded file already read "2.61" but lacked the v2.61 code; applied fresh and shipped as v2.62.
- Import duplicate fix: re-importing a matching `programName` creates a distinct dated sibling program (" #2", " #3"…); every plan date-tagged; `uniqueName()` guarantees no silent name collision.
- Prog & Plans reorganised into Active / Other / Archived collapsible sections; plan picker gains the same sections and archived plans become selectable.

### v2.61 — GYM-056

- Distance exercises: metres mandatory, min:sec optional; defaults 0 (unset); "/mm:ss" omitted when no time; progression for distance compares metres. PT Companion display updated for parity.

### v2.60 — GYM-058 (hotfix)

- v2.59 accidentally deleted `renderPlanCard()` while still calling it, breaking the whole render pipeline (and making a successful import look failed). Restored unchanged; verified with an integration test calling the real render functions.

### v2.59 — GYM-057 — Programs & Plans restructure

- Plans tab ("Prog & Plans") lists programs as collapsed cards. Programs gain `isActive` (at most one) and `archived` (cascades to plans; unarchive restores). Removing a program asks per removal whether to keep or delete its plans.
- Plan picker surfaces the active program's plans first. No schema change (fields ride in `gym_programs` jsonb).

### v2.58 — GYM-055 (PT-004 dependency)

- Programs as a grouping entity. New table `gym_programs`. Optional `programId` on plans. `importProgramFileHandler()` resolves a program (from `bundle.programName` or today's date); name collisions add a date-suffixed plan instead of skipping.

### v2.57 — GYM-054

- Report modal "🧑‍🏫 Since Last PT Session" quick range (From = last PT session date, inclusive; To = today).

### v2.56 — GYM-052, GYM-053

- GYM-052: scheduled plan rows show "⏱ ~N min" from per-exercise `estimatedMinutes`.
- GYM-053: Personal Trainer log (date + notes) in Insights; "Since Last PT Session" stat in the PDF. New data `ptSessions` with tombstones and backup support; table `gym_pt_sessions` (not yet created at the time).

### v2.55 — GYM-051

- Pending scheduled plan rows get "N exercises — show ▾" read-only expansion.

### v2.54 — GYM-050

- Completed plan chips offer Edit Plan (only if the plan still exists); `openPlanEditor()` guards stale ids.

### v2.53 — GYM-049

- Auto-progression removed entirely (per-exercise progression in the plan editor, progressed targets for ad hoc exercises, the live "Progress by" picker). Logging starts from last actuals or plan targets. Old `progressionMode` / `progressionAmount` fields ignored.

### v2.52 — GYM-048

- Removed the `syncErrorHint()` passthrough (added v2.29); call sites use `window.PalSync.errorHint()` directly.

### v2.51 — GYM-047 (third, actual root cause)

- The cloud likely held a corrupted note set (archived by the v2.48 bug) newer than the backup. On import, `trainerNoteSets` now defaults properly, every note set's `updatedAt` is bumped to the import time (restore wins), and `ensureActiveNoteSet()` runs immediately. Documented trade-off: restore is authoritative for this collection.

### v2.50 — GYM-047 (second root cause)

- Race condition: an automatic pull started before a JSON import could overwrite the import with stale merge results. New `_envGeneration` counter; a pull discards results if the generation changed.

### v2.49 — GYM-047 (regression from v2.48)

- ⚠ Source text is split: the v2.49 entry ends "the note-set dedup added in", and the text under "v2.48 (ii)" reads as its continuation. Preserved as in source:
  - The note-set dedup picked whichever active set was created most recently, ignoring content, so an empty auto-created set could win and archive the real notes. Fixed: a non-empty set never loses to an empty one; recency (`updatedAt`) only breaks ties. Restore button added on archived note sets.

### v2.48 (i) — GYM-046 — Full sync-logic review

- `ensureActiveNoteSet()` handles two devices each bootstrapping a first active set (older one archived).
- `savePlan()` / `saveExercise()` guard against the record being deleted on another device mid-edit.
- `loadStarterLibrary()` duplicate check excludes `_deleted`.
- Noted but not changed: `deletePlan()` doesn't cascade to schedule entries/repeat rules; note-set merges are whole-record last-write-wins.

### v2.48 (ii)

- ⚠ See v2.49 above: the text under this heading in the source describes the note-set dedup regression fix and the Restore button.

### v2.47 — FT-031 (mislabelled; Gym Tracker fix)

- Trainer Notes textareas auto-size on every render (guarded when the Notes panel is hidden, as `scrollHeight` reads 0).

### v2.46 — GYM-044, GYM-045

- GYM-044: calendar day cards no longer offer to restart a plan already done that date; when all are done, the card shows the unscheduled-day options.
- GYM-045: sync error "column gym_trainer_notes.record_key does not exist" was a Supabase schema mistake (table created with `id` instead of `record_key`); corrected SQL provided; no app change.

### v2.45 — GYM-043 — Trainer Notes

- New tab with an active note set (add/edit/check/remove) and "Archive & Start New"; archived sets read-only. New collection `trainerNoteSets`, table `gym_trainer_notes`. Active notes appear at the top of the PDF report.

### v2.44 — GYM-042 — Plan editor upgrades

- Confirms before saving a plan used by future schedule entries or repeat rules.
- Exercise type (Reps/Time/Distance) editable in the plan editor; global change cascades to other plans (confirmed; resets target sets). Exercise editor now cascades the same way.
- Per-item progression shown in the plan editor (⚠ progression removed in v2.53).

### v2.43 — GYM-041

- Sync pill aligned to the suite standard: one tinted sync-chip button (Gigs & Trips pattern) opening the Data & Backup drawer.

### v2.42 — GYM-039 — Cross-app schedule sharing

- On every save, a lightweight summary (plan names + schedule/repeat rules; no sessions, exercises or weight) is written to localStorage key `gym_pal_xapp` (`GYM_XAPP_KEY`), tombstone-free, for other same-origin apps (currently Gigs & Trips).

### v2.41 — GYM-038

- Scheduled plans tap-to-edit: picker prefilled with plan and Repeats state; repeat edits apply to the whole series; toggling repeat converts one-off ↔ rule via tombstone + create.

### v2.40 — GYM-037 rework

- Done days automatic (any day before today); manual Done button and `kind:'dayDone'` records retired (left inert). Current week: today pinned top, future days, then past days greyed at the bottom. Past weeks plain Mon–Sun.

### v2.39 — GYM-037

- Done-day toggle stored as `kind:'dayDone'` records in the schedule table. ⚠ Superseded by v2.40.

### v2.38 — GYM-036

- Multiple plans per day (one-offs and repeats coexist; v2.34's one-plan rule retired), each with Start (today) and Remove. Plan-first picker with an off-by-default Repeats toggle and an explicit Add. Duplicate guard. Per-plan "Change" removed.

### v2.37

- Home and Calendar merged: the calendar is Home, with hero stats and body weight on top. Up Next, Quick Start and Recent Sessions removed. Today's card gains ▶ Freestyle and ▶ Start from a plan (today only).

### v2.36 — GYM-035

- Every logged session appears on its date as a compact ✓ chip, expandable (reuses History's expansion state and a shared exercise-row renderer).

### v2.35 — GYM-034

- "Up Next" on Home (Today and Tomorrow) with Start / Done; schedule mutations refresh Home. ⚠ Removed in v2.37.

### v2.34 — GYM-033 — Repeating scheduled plans

- Rule-based (`kind:'repeat'` record in `scheduleEntries` / `gym_schedule`), occurrences computed at render time. Frequencies: daily, weekly, chosen weekdays, every N days. Removing an occurrence: this date only (exception list), end from here (`endDate`), or delete the rule (tombstone). Older versions ignore rule records. No SQL migration.

### v2.32

- Suite-wide modal audit: click-outside-to-close added to the Exercise, Plan, Exercise Picker, Weight Log and Report Config modals. Session Overlay deliberately unchanged.

---

# Horizon

`horizon.html`. Inline comments keep recent releases; from v4.9 the `.md` is loaded alongside the HTML before any change and both are updated together. Supabase table `horizon_records` (every record kind distinguished by `record_key`; RLS `auth.uid() = user_id`). Embedded inside On Budget as a nested iframe since v4.3 (standalone-capable via the launcher since PET-094).

### v4.12 — HZN-014 — 2026-09-26

- Adopted the combined `pal-shared.js`. See Shared Components.

### v4.11 — HZN-013 — 2026-09-26

- Dropped all three Google Fonts (Fraunces, IBM Plex Sans, IBM Plex Mono); `--serif`, `--sans`, `--mono` keep their system fallback chains (Georgia, system sans, system monospace). Same trade-off as Fortnight Tracker FT-056. Visual only.

### v4.10 — HZN-012 — 2026-09-26

- Joined the shared pal-utils rollout: local `escHtml()` and `uid()` deleted (see Shared Components). Only the shape of new ids changes. Cache-busting query strings bumped to `?v=4.10`.

### v4.9 — HZN-011 — 2026-09-26

- Changelog housekeeping only: v2.4 back to v1.0 (28 entries) moved verbatim into the `.md`; the HTML keeps v4.9 to v3.0.1 inline.

### v4.8 — HZN-010 — 2026-08-31

- Suite-wide load-speed pass (app 5, after Claim Tracker CLA-014, Fortnight Tracker FT-053, Gigs & Trips GIG-050, Gym Tracker GYM-085): `pal-config.js` and `pal-sync.js` tags gain `?v=4.8`, tied to the app version.
- `VERSION` constant drift fixed (stuck at "4.5" while the badge read v4.7).
- `PAL_SESSION` handoff through the On Budget embed re-checked.

### v4.7 — HZN-009 follow-up — 2026-08-22

- Collapsed bucket row reduced to name and £/mo on one line; £/yr, balance and tag moved into Details. Layout only.

### v4.6 — HZN-009 — 2026-08-22

- Buckets panel reads like a calculator: always-on readout (income left after outgoings, total £/mo allocated, left over); over-allocation callout kept. Each bucket card is a one-line summary with "Details ▾" holding Edit, Delete, transactions and "+ Add transaction". Display only (`computeBucketFlows`, `computeBucketBalance` untouched).

### v4.5 — HZN-008 — 2026-08-09

- iPhone layout fixes from real screenshots: `.modal-overlay` z-index 50 was below `.topbar-sticky` 60 (modals behind the header) → raised to 100; `.scenario-card .meta` gets `flex-basis: 100%`; verdict badges wrap consistently below 600px.
- Serious bug fixed: `simulateDepositReadyAge` still read fields removed in the v3.0/v4.0 rewrite (`household.currentDepositPot`, `monthlyDepositSavings`, `assumptions.depositGrowthRate`), so it always reported "not within 60 years". Now uses the same bucket-balance maths as `projectScenario`.
- Five stale texts describing the old single-growth-pot model corrected.
- Bucket transaction log: new `buckettx_*` records `{ bucketRecordKey, date, type: credit|debit, amount, note }`. Balance is now the sum of transactions (`computeBucketBalance`, `activeBucketTransactions`), no longer directly editable. `migrateBucketsToTransactionsIfNeeded()` turns each old `currentBalance` into one "Opening balance" credit (verified to the penny).
- `computeHouseReadinessProgress()`: progress bar on growth buckets against the selected mortgage's deposit + purchase costs, reusing `projectScenario`'s `cashNeeded`.

### v4.4 — HZN-007 — 2026-08-08

- Removed the v4.3 "back to On Budget" button (HTML, CSS, handler). Embedding unchanged.

### v4.3 — 2026-08-08

- Horizon is reached from inside On Budget's new Horizon tab (session relayed via `PAL_SESSION`, one extra hop), no longer from the launcher directly.
- "← 🪙" button posts `PAL_BACK_TO_HOST` when nested, or navigates to `on-budget.html` when opened directly. Tab handler scoped to `.tab-btn[data-tab]` to avoid a misfire. ⚠ Button removed in v4.4.
- Tested with a real nested-iframe test (launcher → On Budget → Horizon); the final relayed hop inferred from unchanged shared code (jsdom limitation).

### v4.2 — HZN-006 — 2026-08-08

- Year-by-year tracker in Setup: one entry per age with each active bucket's actual balance and note, the emergency pot and a general note. Growth buckets compared with the "rent" scenario's own `growthPot` trajectory; sinking funds get no projected comparison. `computeTrackerImpact()` tiers ahead / watch (<10% short) / behind (≥10%). Prompt when the current age has no entry; deleted buckets shown read-only.

### v4.1 — 2026-08-08

- Fix: growth pot still derived from total income minus outgoings. `computeBucketFlows()` and `projectScenario()` no longer sweep leftover automatically; every bucket gets only its explicit £/mo. Unallocated leftover shown but goes nowhere. Bucket list shows £/yr.

### v4.0 — HZN-701, HZN-702 — 2026-08-08

- Re-scoped around a simpler model (three kinds of money; guaranteed income vs a backup pot; mortgage first then redirect), built on the v3.0 single-pot rewrite.
- HZN-701: buckets replace the single `growthPot`. New `bucket_*` records `{ name, monthlyAllocation, growIndefinitely, currentBalance }`; `computeBucketFlows()` (⚠ its auto-sweep into growth buckets removed in v4.1); sinking funds (Holiday, House/repairs, Family/emergency) started empty; `growthPot` = sum of growth buckets; `migrateToBucketsIfNeeded()` creates a "Growth" bucket from a pre-v4.0 balance. Buckets panel in Setup with over-allocation warning.
- HZN-702: `computeEarliestSafe4PercentSwitchAge()` scans switch ages from retirement, simulating income-needs drawdown then flat 4%, checking both `ranOut` and `shortfallEver` to `HORIZON_AGE`. Not a death/survivor simulation.
- Checkpoints capture the full bucket list.

### v3.0.1 — 2026-08-08

- Net worth graph correction (brief section 4): `projectScenario` stops contributions at target retirement age and draws down the growth pot for living cost + housing net of pension income, replacing the disconnected `simulateRetirementDrawdown` logic in block 5 so the chart and blocks agree.
- ⚠ No standalone v3.0 entry in the source; v3.0 is referred to as the "single-pot rewrite" (two fixed scenarios, mortgage-tab-driven purchase, unified trajectory).

### v2.4 — HZN-003 — 2026-08-08

- Scenario allocation Linked vs Custom ("Use household rate" reads Setup live); new scenarios linked; old scenarios treated as Custom.
- `birthDate` drives `referenceAge` via `getSettings()`.
- New Mortgage tab: multiple products (value, deposit %, costs, rate, term, overpayment) with deposit-ready age, payoff ages; one selected option feeds every buy scenario via `resolveMortgageTerms()`. Payoff-age message bug fixed.

### v2.3 — 2026-08-07

- Regression fix: `contingencyReserveAtAge()` returned a real figure used as nominal (double-deflated); now inflates to nominal first (same fix as v1.21).

### v2.2 — HZN-005 — 2026-08-07

- Part A: `insertMissingOneoffSeeds(records)` inserts any missing starter one-off cost by label; seeding fires whenever `assumptions.oneoffSeeded` isn't set; "Restore default one-off costs" button.
- Part B: `assumptions.targetScenarioId` (one flagged target, `"__baseline__"` allowed, 🎯 badge). `computeTargetSavingsPlan()` (separate `depositMonthly` and `retirementMonthly`, honest `achievable:false`), `resolveActiveTargetPlan()`, optional `targetOverride` on `computeAnnualSavingsGoal()`, `renderTargetPlanSummary()`; block 6 labels Target derived vs manual.
- Part C: `snapshotCurrentState()` captures a `targetPlan` block as it stood; pre-v2.2 checkpoints render gracefully.
- Tests: 41 inherited + 19 new on `__horizonTestHooks`.

### v2.1 — HZN-004 — 2026-08-07

- One-off costs gain `data.scope: "all" | "ownedOnly"` (owning-specific costs only apply once the scenario owns; recurring cycles start from ownership). `oneoffScope()` fallback; `migrateOneoffScopeIfNeeded()`.
- `buildOneoffSchedule()` keeps `schedule.always` resolved and `schedule.ownedOnlyItems` raw; new `ownedOnlyItemFiresAtAge()` and `ownedOnlyOccurrencesForItem()` threaded through `projectScenario`, `simulateRetirementDrawdown` and markers.
- Scope selector and tags in the UI. 12-item starter set (`ONEOFF_SEED_LIST`: 4 universal, 8 owning-specific); `seedOneoffCostsIfNeeded()` with `assumptions.oneoffSeeded`.

### v2.0.1 — HZN-003 — 2026-08-07

- Master list physically sorted by rank (`buildScenarioRankData()` exposes `sortedEntries`).
- "All extra → pension" preview row defaults to the first DC pot via `resolvePreviewPensionTargetKey()`; disabled with a note when no DC pot exists. Preview only.

### v2.0 — HZN-003 — 2026-08-07

- Re-architecture around the scenario: five data tabs replaced by **Setup** (all data entry, nominal/real toggle) and **Scenarios** (ranked master list with verdict pill, plus a six-block one-pager per scenario). v1.21 engine reused untouched in its core maths.
- Engine additions: three-way allocation (`scenario.allocation`, `pensionTargetKey`, `getScenarioAllocation()`, `migrateScenarioAllocationIfNeeded()`, fifth "all extra → pension" row); timed one-off costs (`oneoff_*` records, `fromPot` deposit/savings/pension, `buildOneoffSchedule()`, extra outflows into the DC pot); `simulateRetirementDrawdown()` (depletion age or sustains to 100); `assumptions.annualSavingsTarget` and `computeAnnualSavingsGoal()`; `computeScenarioVerdict()`.
- Cloud sync unchanged. Tests HZN-2.0-T1 to T10 via `__horizonTestHooks`.

### v1.21 — HZN-002 — 2026-08-07

- Net worth column added to the allocation-modelling table.
- Housing column explains itself (rent inflating / mortgage active to age X / cleared).
- Contingency reserve (`contingencyReserveRent` £5,000 / `contingencyReserveBuy` £15,000) held back in `netWorthDrawdownIncomeAtAge()`; `contingencyReserveAtAge()`; breakdown shows "discretionary net worth".

### v1.20 — 2026-08-07

- Clearer labels (Guaranteed = DB + State; Estimated = DC drawdown) and a total line.
- Scenarios ranked by retirement-security margin (not net worth); gold #1 badge.
- Outgoings can be Monthly or Annual (`outgoingAmount()`, `outgoingFrequency()`, `outgoingMonthlyEquivalent()`).

### v1.19 — HZN-001 — 2026-08-07

- Three separate figures per scenario: guaranteed pension income (£/yr and £/mo), estimated DC income, net worth at retirement → at 90 ("not income"). `computeAtRetirementBreakdown()`, `buildAtRetirementHtml()`. Note that contributions are assumed to continue to 90.

### v1.18 — 2026-08-06

- Mobile redesign: inputs at 16px (stops iOS zoom "jump"); `.table-scroll` wrapper; panels grouped into 5 tabs (Today / Pensions / Plan / Retire / History) with a sticky topbar. Tab state session-only.

### v1.17 — 2026-08-06

- DC pot depletion modelling: `simulateDrawdown()` year-by-year (withdrawal rate × starting pot, then inflating); configurable `withdrawalRate` (default 4%); "sustains to 100" / "depletes at age X".

### v1.16 — 2026-08-06

- Joined the suite's Supabase sync via pal-sync.js: one table `horizon_records`; sync badge and drawer (suite-standard ids); Export/Import moved into the drawer; `recordsToSyncArray` / `syncArrayToRecords`; 2 s debounced auto-sync from `saveState`. Pete-only via RLS (`horizon_supabase_setup.sql`). `exportJSON`, `importJSON`, `openSyncDrawer` exposed on `window`.
- Two bugs fixed before ship: `pull()` doesn't push edits to records the cloud already has (explicit push of newer local records added); hard deletes replaced by `softDeleteRecord()`.

### v1.15 — 2026-08-06

- Editable "extra to model" (`assumptions.modeledExtraMonthly`, null = auto) decoupled from real cash flow; `computeReachAgeWithExtra()`.

### v1.14 — 2026-08-06

- Household, Income & Outgoings and House Deposit merged into "Cash flow & saving". Dead `HOUSEHOLD_FIELDS` removed; shared `renderFieldGroup()`; the allocation table explains when there is nothing to show.

### v1.13 — 2026-08-06

- Checkpoints: `checkpoint_*` deep-cloned timestamped snapshots via `snapshotCurrentState()`; save, view, delete. No comparison yet.

### v1.12 — 2026-08-06

- Allocation-scenarios table (Current / all extra → deposit / all extra → savings / half & half) via `computeAllocationVariant()`.

### v1.11 — 2026-08-06

- Itemised income & outgoings (`income_*` / `outgoing_*` records); import from an On Budget JSON export (`data.bills.recurring`) with a review list; `computeCashFlow()` takes the item lists. Lossless migration from v1.10.

### v1.10 — 2026-08-05

- Income split into `peteNetMonthlyIncome` / `lexNetMonthlyIncome`; aggressive-deposit preview; feasibility check on "save extra now"; shared `scenarioRetirementGapAtAge()`; label tidy-up.

### v1.9 — 2026-08-05

- Income switched to net monthly (take-home); `computeCashFlow()` no longer divides by 12; no automatic conversion of old values.

### v1.8 — 2026-08-05

- `monthlyOutgoings` and a live "Remaining" readout; buy scenarios answer in the right direction; savings counted as retirement income via `netWorthDrawdownIncomeAtAge()`; per-scenario `monthlyDepositSavingsOverride`.

### v1.7 — 2026-08-05

- `requiredMonthlyDeposit()` and `requiredMonthlyRetirementSaving()` (binary search against the same formulas).

### v1.6 — 2026-08-05

- "Retirement security" panel against Pensions UK 2026/27 standards for two people (Moderate £45,400; Minimum £22,500; Comfortable £62,700), housing added back per scenario, evaluated in real terms.

### v1.5 — 2026-08-05

- Dedicated house deposit pot (`currentDepositPot`, `monthlyDepositSavings`, `depositGrowthRate` default 3.5%), separate from general savings.

### v1.4 — 2026-08-05

- Global nominal/real display toggle; `pensionRevaluationRate` renamed `inflationRate`.

### v1.3 — 2026-08-05

- Fix: assumption fields added later were not backfilled into saved sessions (NaN pension income); `loadState()` backfills; safe numeric fallbacks.

### v1.2 — 2026-08-05

- Pension cards show projected £/yr.

### v1.1 — 2026-08-05

- Typed pension list (deferred DB, active DB/CARE, DC pot, State Pension); DB/State kept out of net worth; new `pensionRevaluationRate`.

### v1.0 — 2026-08-05

- Initial release: household inputs, assumptions, buy-scenario builder (asap / fixed age), SVG net-worth chart, stats table, JSON export/import.

---

# HTML Vault

`html-vault.html`. From v1.8, new entries go in the `.md`; everything before v1.8 is in the HTML's own top-of-file comments (not supplied). Talks straight to Supabase; no local data model.

### v1.8 — HTV-010 — Stat cache for the launcher

- For launcher PET-094: new `cacheStatForLauncher()` called from `loadList()` (the only place `items` is fetched, itself called after upload, delete, reorder and tag change) writes `{ count, updatedAt }` to localStorage key `pal_vault_stat`. Items themselves are still never stored locally. Silently skipped if localStorage is unavailable.
- Consumed by launcher `statVaultSub()` (v10.89).
- Verified manually (reload, upload, delete).

---

# On Budget

`on-budget.html`. The app's inline comment keeps the detailed recent-era releases (v3.44 onward); the `.md` holds v1.0–v3.43 plus v3.73 onward. ⚠ v3.44–v3.72 are not in the supplied changelog (ON--049 / ON--050, referenced by pal-sync v1.11 and Fortnight v3.32, fall in that range). One Supabase table shared across many record kinds via `record_key` prefixes (`billsoverride_`, `billsscenario_`, `savingsgoal_`, `savingstx_` and others). Horizon is embedded as a nested iframe tab.

⚠ Reused IDs in the source: ON--069 (v3.73 and v3.75), ON--070 (v3.74 and v3.76), ON--025 (v3.18 and v3.20). Launcher v10.89 cites "on-budget.html v3.75 (ON--071)" for the Horizon standalone flag, which has no entry here.

### v3.81 — ON--075 — Launcher deep-links

- Three new `OB_ACTION` actions for launcher v10.97 (PET-102): `openSpendingTab`; `openBillsTab` (always Ledger); `openBillsTxSheet` (Ledger, then `openBtxSheet` after the same 120ms delay as `openFoodSheet`). `openFoodSheet` and `openBillsSheet` unchanged.
- Version updated everywhere it appears: `<title>`, badge, header comment, `pal-shared.js?v=`, and the `version` field in the save and JSON backup (display-only).

### v3.80 — ON--074 — Lead with the card balance in Increasing mode

- In Increasing (credit card) mode the hero card and launcher showed different figures. Both now lead with the real card balance, with "(£X left of £Y budget)" as a smaller sub-line. The v3.78 "Card balance" row and Set button folded into the hero.
- `computeDashboardSummary()` exports `cardBalance` and `potDirection` for the launcher (v10.94). No calculation change; Decreasing unchanged.

### v3.79 — ON--073 — Increasing mode wording

- A month set up with a £0 start balance and the £750 logged as income showed Headroom as −reserve (correct maths). In Increasing mode setup asks for the "Spending limit", the button reads "Update spending limit", and a £0 limit shows a prompt. No calculation change. Fix for affected months: set the limit to £750.

### v3.78 — ON--072 — Increasing mode: spend counter plus real card balance

- ⚠ Supersedes v3.77's "ignore income" change.
- Hero value is the spend counter with "£X left of £Y pot". Income is a payment to the card, so it no longer raises pot or headroom (pot = start balance − spent).
- New **Card balance** = carried-over balance + spent − payments ± adjustments, carried month to month. **Set** stores only the difference as a month-level `cardAdjust` (a month field because every spend total treats non-income transactions as spend). Syncs with the month record; defaults null.
- Behaviour change: income no longer counts toward pot or headroom in Increasing mode.

### v3.77 — ON--071

- Increasing mode "Card balance" showed −£750 after a pay-in; the card balance became simply total spent. ⚠ Reworked in v3.78.

### v3.76 — ON--070

- Decreasing mode hero gains "£X spent of £Y pot" sub-line, mirroring Increasing mode. Display only.

### v3.75 — ON--069

- Confirmed the hero card updates live when Pot tracking direction is toggled; headroom is direction-agnostic by design (v3.67 / ON--065). Increasing mode gains "£X left of £Y pot" (or "over") under the hero value.

### v3.74 — ON--070

- Adopted the combined `pal-shared.js`. See Shared Components.

### v3.73 — ON--069 — Horizon re-embedded as a tab

- Lazy-loaded nested iframe (`horizon.html` untouched), reversing the reversal of v3.60 / PET-067; same pattern as Claims-in-Fortnight (FT-062) and Vault-in-Test & Issues (TI-083). Session relayed only (Horizon has a single dark theme); `_palSessionData` captures the raw payload. The old `openHorizonTab` deep-link (v3.70 / ON--066) deliberately not restored.
- Launcher (PET-090): Horizon nav button removed (no home card since PET-075); standalone iframe, backup entry and slug map unchanged.

### v3.43 — ON--047 — History insights

- Four read-only cards: stacked Food/Travel/Other spend trend (inline SVG, last 12 completed months); latest month vs average of up to six previous; all-time top shops from labels; "left over" trend (startBalance + income − spend). Month cards gain left-over and top shop. Shown only with enough history.

### v3.42 — ON--046 — HTML escaping

- On Budget had no `esc()`. Every innerHTML sink rendering user text now escapes it (labels, bills names/notes, scenarios, goals, savings notes, print window, sync log). Label chips use `data-label` with a delegated listener instead of inline onclick strings. Icon-only elements gain aria-labels.

### v3.41 — ON--045 — Launcher deep-link actions

- `OB_ACTION` postMessage support: `openFoodSheet` and `openBillsSheet`. Launcher card gains "+ Add spend" (⚠ replaced by two buttons in launcher v10.97).

### v3.40 — ON--044 — Budget snapshot per month

- `startMonth()` snapshots `weeklyFoodBudget` and `travelBudget`; mid-month Settings edits no longer affect the current month. New "Adjust this month's budgets" sheet (`weeklyFoodAdjustment` for current and remaining weeks; Travel monthly total edited directly). `getWeeks()` and `calcReserve()` extended. `syncUpsertMonth()` and pull now carry the snapshot fields.

### v3.39 — ON--043

- Removed the "worth exporting?" backup nag banner (`BACKUP_THRESHOLD` and related functions). Export, last-backup status and `meta.changesSinceBackup` handling kept.

### v3.38 — ON--042

- Scenario rows highlighted when added or modified (reusing `diffScenario()`); "Changed" badge for modified.

### v3.37 — ON--041

- Optional note on recurring items, carried through occurrences into the cleared transaction.

### v3.36 — ON--040

- Bills Ledger's Cleared filter shows newest first (All filter unchanged).

### v3.35 — ON--039

- Scenario item sort: Date (linked items use the real item's next due; unlinked last), Value, Type. `renderScenItemCard()` extracted.

### v3.34 — ON--038

- Bills › Recurring sort toggle: Next due / By type.

### v3.33 — ON--037 — Data-loss fix for Food & Travel transactions

- Transactions had no `monthKey`; pal-sync's auto-push of a local-only record sent no `monthKey`, and `syncPull()` discarded it. Reproduced against the real pal-sync.js with a mock.
- Fix: `saveSpend()` stamps `monthKey`; `syncPull()` backfills it; recovery falls back to local location, then a month derived from the date, and re-pushes. `beforeunload` warning while a sync is in flight.

### v3.32 — ON--036

- Scenario Outgoing showed the sign-flipped value (identical to Net when income unchanged); value and colour decoupled (also in Delta row and PDF).

### v3.31 — ON--035

- Scenario "Overall change" card shows Income / Outgoing / Net separately; PDF banner matches.

### v3.30 — ON--034 — Savings & Goals tab

- New top-level tab. Each goal has a name and optional target amount + date; balance is always derived from the goal's own transactions (never a stored counter — the ON--002 lesson). £/month needed = days remaining ÷ (365.25/12).
- Goals and transactions are separate synced collections (`savingsgoal_` / `savingstx_`); deleting a goal cascades tombstones to its transactions.
- Progress bar colouring bug found in review (amber at 50–80%) fixed to always positive.

### v3.29 — ON--033

- Overall scenario note removed (per-change notes from v3.28 remain).

### v3.28 — ON--032

- Per-change notes on scenario items, including removal notes (`_scenarioDraft.removedNotes` keyed by real recurring id).

### v3.27 — ON--030 / ON--031

- Bug: delta cells used unscoped `ok`/`warn` classes so colours never rendered; replaced by `deltaColor()` / `netImpact()`. Scenario note field; "Overall change" callout; "What changed" (`diffScenario()`); PDF export rewritten with brand colours and an explicit Delta row.

### v3.26 — ON--029 — Scenario planning in Bills

- Third subtab: a scenario is a snapshot copy of `bills.recurring`; monthly equivalents use 52/12 weeks per month; As-is vs Scenario vs Delta. Saved scenarios in `bills.scenarios[]` (prefix `billsscenario_`). Export PDF via `window.print()`.

### v3.25

- Reverted the ON--026 / 027 / 028 pinned-header attempts (v3.22 sticky, v3.23 sticky retry, v3.24 fixed-position) back to the known-good v3.21. ⚠ Versions 3.22–3.24 retired, not reused.

### v3.20 — ON--025

- Per-day figures count only days after today (labels "(after today)").

### v3.19 — ON--031

- Adopted pal-sync v1.8's 401 retry queue: `onRetryFlushed` wired; `setSyncState()` shows "N pending sync"; error logs use `PalSync.errorHint()`. See Shared Components.

### v3.18 — ON--025

- Shop list moved from one union-merged blob (`__ft_labels__`) to per-record entries (id = lowercased name) via pal-sync `table()`; deletes now propagate; `count` / `lastUsed` last-write-wins; old blob tombstoned.

### v3.17 — ON--024

- `syncPull()` re-entrancy guard (`_syncInFlight`, shared with `syncPush`), matching Test & Issues' `_syncLock`.

### v3.16

- Migrated to shared pal-sync.js (then v1.4): loads `pal-config.js`; settings singletons and shop list stay hand-rolled; months, transactions, recurring bills, bills transactions and overrides via `table()` instances sharing one `PalSync.fetchTableRows()`.

### v3.15

- Header badge drift fixed (v3.13 vs v3.14). `lastExported` added to the save/export envelope.

### v3.13 — ON--023

- "By tag" breakdown on the Other card (case-insensitive grouping); breakdown body max-height 400px, scrollable.

### v3.12 — ON--020 / 021 / 022

- Food & Travel transactions editable in place. Weekly bars show £spent/£target. Next-month projection spells out full vs partial weeks.

### v3.11 — ON--019

- Dashboard redesign: Pot and Headroom share a row; Food full-width with a bar per week; Travel + Other share a row. Settings live next-month projected headroom (`projectNextMonthHeadroom()`; `getWeeks()` optional `weeklyFood` override).

### v3.10 — ON--018

- Travel reintroduced as its own category with `monthlyTravel` (default £150); headroom = pot − (food + travel reserves). `migrateCategories()` fixed to only migrate `food`. ⚠ v2.8's Travel → Other merge cannot be undone for old data.

### v3.9 — ON--017

- Negative figures show a real minus sign (four places used `Math.abs()`).

### v3.8 — ON--016

- Self-building quick-pick shop list (`ftLabels`, synced via `__ft_labels__`, union merge). ⚠ Moved to per-record entries in v3.18.

### v3.7 — ON--015

- Food & Travel income transactions; pot nets income; `type: 'outgoing'` backfilled on old transactions.

### v3.6

- Per-day figures for Weekly Budget and Headroom (today counted). ⚠ Changed to "after today" in v3.20.

### v3.5 — ON--004

- Overdue unresolved recurring occurrences kept visible (generated from the item's anchor date) with an Overdue badge.

### v3.4 — ON--003

- Editing uncleared Bills transactions; recurring occurrences edited via per-occurrence overrides (`bills.overrides[]`, sync prefix `billsoverride_`), never touching the template.

### v3.3 — ON--002 root cause

- `saveBtx()` changed `clearedBalance` without stamping `bills.settings.updated_at` or calling `syncUpsertBillsSettings()`, so the change reverted on pull. Fixed; reproduced first in a harness. Existing drifted balances need one manual reconcile.

### v3.2

- Audit of every Bills balance mutation; visible audit trail in the Cloud Sync log and toasts.

### v3.1

- Header and tab-bar content centred within the 900px desktop zone.

### v3.0

- Desktop breakpoint (900px+) widens main from 540px to 900px.

### v2.9

- Dark theme (pilot for the suite-wide light/dark toggle), controlled by the launcher via `PAL_THEME`; local fallback `ob_theme_pref`.

### v1.0 – v2.8 (combined summary in source)

- ⚠ Never logged as individual entries; preserved as one summary.
- Backwards compatible with v1.0–v3.3 JSON backups. v1.9 Bills account. v2.0 till-style penny entry and forecast modes. v2.1 Bills merged into one chronological list with a filter. v2.2 backup-reminder banner; v2.3 per-account breakdown. v2.4 banner scroll fix and row-level delete. v2.5 Supabase cloud sync with tombstone deletes. v2.6 pull now refreshes Settings UI. v2.7 Food & Travel spends sync on add. v2.8 categories simplified to Weekly Budget / Other via `migrateCategories()` (food → weekly, travel → other).

---

# Reading Tracker

`reading-tracker.html`. The `.md` archives part of the clean changelog block (v3.29 – v3.67) from the HTML; the inline comment keeps the 15 most recent. ⚠ Only the entries listed below were supplied; older short notes elsewhere in the code were left in place. Syncs via pal-sync across four tables (trackers, books, entries, wishlist).

### v3.70 — MR-055

- Adopted the combined `pal-shared.js`. See Shared Components.

### v3.69 — MR-054

- Dropped Playfair Display and Inter (Google Fonts) for the system font stack across ~39 call sites (no central font variable). Same trade-off as Fortnight Tracker FT-056. Visual only.

### v3.52 — MR-037

- The widget's "This month's target" label now switches to "This cycle's target" when `cfg.cycleStartDate` is set. The rest of the report (day count using calendar-month maths) not explained; needs a fresh export to investigate.

### v3.51 — MR-036

- Monthly widgets never appeared: cards reuse `.now-reading-card` (default `display:none`) and `renderMonthlyWidget()` never set the card's own display. Fixed; `moBookCard` / `moAudioCard` need an explicit lookup.

### v3.50 — MR-035

- `isBookListItemDone()` treated a book with no page count as done (`0 >= 0`), excluding it from `bookListQueue()`. Now completes only on an explicit page count (`manualComplete` still works). New "No page count set yet" widget state where the log input sets the total; add-time toast warns when Pages is blank.

### v3.49 — MR-034

- Shared cycle start date `appState.monthlyConfig.cycleStartDate` used by `daysLeftInMonthlyCycle()`; blank falls back to calendar month.

### v3.48 — MR-033

- Remaining user-facing "Wishlist" strings renamed "Book List" (internal names unchanged). "Reading goal" collections renamed "dated collections".

### v3.47 — MR-032 — Book List rebuild

- Replaces the tracker-based Monthly Mode (v3.44–v3.46). The wishlist ("Book List" in the UI) holds unread books and reading progress, with two live queues (Books, Audiobooks).
- Items gain `dateAdded`, `readingEntries` (`{ id, date, pageTo }`), `completedDate`; `backfillBookListFields()`.
- `bookListQueue(type)` sorted per `appState.monthlyConfig` (`dateAdded`, tag with genre fallback, or manual = stored array order).
- `mergeMonthlyTrackerIntoBookList()` one-time migration of a "Monthly Reads" tracker (tracker tombstoned), via a dashboard banner.
- `appState.monthlyConfig` is new **local-only** state, now included in `buildJSON()` export and `doRestore()` import.
- Active/Past split by `completedDate`; dated collections as read-only rollups.
- Stats: `monthlyStatsFor` / `renderMonthlyStatsSection`; `renderStats()` gains a second pass over wishlist `readingEntries` (Book List reading was invisible before).

### v3.33 — MR-018

- "Add to wishlist" moved above the controls as a collapsed button (existing collapsible pattern).

### v3.32 — MR-017, HZN-004

- ⚠ HZN-004 carries Horizon's prefix but is a Reading Tracker change (misfiled).
- MR-017: log by % read (`book.logMode`, persisted per book), converted to a page number at the input boundary.
- HZN-004: third tracking mode `'pace'` — locks an original projected finish date (re-locked only on a pace change) and shows a live projection from actual pace with days ahead/behind. `trackingModeOf()` infers mode for older trackers. Not wired into the Now Reading daily bar.
- Tracker edits had the same sync gap as MR-016: `pushTrackerNow()` added; `flattenForSync()` whitelist extended with pace fields.

### v3.30 — MR-016 — Confirmed root cause of edits not syncing

- v3.29's diagnostics read `row.id`; rows from `fetchTableRows()` are `{ record_key, data, updated_at }`. Fixed to read `record_key` / `row.data`.
- Root cause: `table().pull()` only pushes ids missing from the cloud (or unconfirmed tombstones), never an edit to an existing record. `pushBookNow()` added and wired into every book mutation (including `trackerId`), matching v3.29's `pushWishlistItemNow()`. No new table.

### v3.29 — MR-016

- Detailed content-level sync diagnostics (wishlist tags/ownership) in the Sync & Backup log. `pushWishlistItemNow()` introduced (per v3.30). ⚠ The diagnostics' own field read was wrong; corrected in v3.30.

---

# Test & Issues

`test-issues.html`. From v1.73, full entries go in the `.md`; the inline comment keeps a pointer. Local key `ti_v1`; `APP_REGISTRY` drives app names, icons and prefixes. Hosts HTML Vault as an embedded tab (TI-083, not in the supplied changelog).

### v1.77 — TI-089 — Cloud-first local cache (Test & Issues stops exhausting browser storage)

- **Problem (measured on Pete's Mac, Safari).** `ti_v1` was ~2 MB of data that is already in Supabase and is re-fetched in full on every session anyway. With the rest of the suite at 3.3 MB the write was refused ("Pull complete — 624 pulled, local cache full — not saved locally"; "Local cache write failed (The quota has been exceeded.)"). Sync itself worked (TI-087). Details of the arithmetic are under Cross-App Development → shared per-origin quota.
- **Policy.** If the serialised data exceeds `LOCAL_CACHE_MAX_KB` (300), there is a live session, `PalSync.retryQueueLength()` is 0 **and** none of this app's own pushes has failed, the local copy is not written and any stale one is removed ("cloud mode"). Otherwise behaviour is exactly as before v1.77, including the TI-087 warnings. Under the cap (small datasets) nothing changes. Once in cloud mode a fast path skips serialising ~2 MB on every edit.
- **Failed pushes are tracked.** `_pendingPush` records `app:<id>` / `issue:<id>` / `meta` when `syncApp`, `syncIssue`, `syncDeleteIssue`, `syncMeta` or the `…Direct` import variants fail (the `…Direct` ones still rethrow). A failure immediately writes the full local copy as a safety net; a later successful push of that record, or a successful **Push**, clears it, and the next save drops the local copy again. When both the push and the local write fail the message says so ("a cloud push has also failed: export a backup now") instead of claiming the cloud holds the edit.
- **Launcher card.** New tiny key `pal_ti_stat` `{ openIssues, openTests, updatedAt }`, written on every `saveState()` (same pattern as `pal_ftt_stat` / `pal_vault_stat`; never overwritten by an empty not-yet-loaded state). Same arithmetic the launcher used on `ti_v1`, tombstones not excluded (unchanged). Launcher v11.00 (PET-104) reads it first.
- **First render with no local copy.** Empty views would have said "No apps tracked yet — import a manifest", implying data loss, so they say "Loading from the cloud…" until the first pull settles (success, failure, or no session after the 3 s timeout). The TI-088 testing-first landing (`_testScopeInit` / `_kbScopeInit`) is now only consumed once there is data, otherwise the empty first render would have used it up before the pull arrived.
- **Backup/restore.** `lastExported` (the backup reminder) was stored only inside the wrapper, so it would have reset to "Never" every load; it now also lives in `ti_last_exported`. **Restore from backup** previously wrote only the local copy; it now calls `_markPending('restore')` so cloud mode cannot skip it, until a **Push** succeeds.
- **Sync & Backup → Storage** shows a "Local cache: off — data is held in the cloud" chip in cloud mode.
- Shared: `pal-shared.js` pal-sync v1.13 (`cacheSet`, `storageUsage`) — see Shared Components. Loaded as `pal-shared.js?v=1.77`. No data-model or Supabase change; no schema change; manifest schema unchanged.
- **Known trade-offs.** (1) Test & Issues needs a connection and a session to show data; offline or logged-out it starts empty (Export backup still works). (2) A few milliseconds between an edit and its push confirming have no local copy; closing the tab inside that window loses the edit. (3) Launcher counts still include tombstoned records, as before. (4) The cloud data itself is unchanged: the 606 legacy issues (~536 KB) and ever-growing version history remain, and are still pulled in full each session. Archiving them would delete cloud data and is a separate decision.
- Tested (60 checks, real `test-issues.html` + real `pal-shared.js` in jsdom with a fake Supabase and a quota-limited localStorage): the v1.76 build reproduced the failure in the same harness (control); v1.77 pulls cleanly, writes no `ti_v1`, leaves every other key byte-identical and adds <5 KB; edits reach the cloud; failed push → local fallback written, tracked, cleared by Push, then cloud mode resumes; push failure with storage full → warning without a false "cloud holds it" claim; small dataset still cached locally; reload with no local copy (wording, testing-first landing); no-session wording; export date survives reload; real `importBackup`; release-manifest import success and failure; every `cacheSet` branch and `storageUsage`; `trimIfLarge` regression; launcher `statTiSub` with the new key, the old key, both, neither and a corrupt key.
- Not tested: real Safari / the real 5 MB limit, real Supabase, the launcher card in a browser iframe, mobile layout, offline behaviour on a device.

### v1.76 — TI-087, TI-088 — Quota-safe local saves and testing-first mode

- **TI-087 — "Pull failed: The quota has been exceeded".** `save()` called `localStorage.setItem()` unguarded; when the origin quota was full, `QuotaExceededError` threw out of `saveState()` inside `syncPull()`'s try block, so a successful pull was reported as failed. Reproduced on v1.75.
  - Fix: `save()` contains the failure (memory and cloud stay correct); visible **⚠ Storage full** nav marker, log entry and toast; local-only mode tells you to export a backup now; first successful write clears the warning. `save()` returns true/false.
  - Diagnosis aid: Sync & Backup → Storage lists the origin total and the six largest localStorage keys (UTF-16 bytes). The v1.75 trim never fired in the reported case, so the large key may belong to another app; trim now logs when skipped for pending writes.
  - Does not free space.
- **TI-088 — Testing-first mode.** Issues hidden, not removed: still load, sync, export and import; Sync & Backup → Display → _Show Issues_ (per-device key `ti_show_issues`). Testing flow: first visit opens on the latest release with untested tests; version selector on the Tests tab; manifest import lands on the imported version; **📋 Failures** copies a failed-tests report (also offered at the end of a guided run when Issues are hidden).
- No manifest-schema change (`resolvesIssues` optional), no data-model change, pal-shared.js unchanged.
- Tested: 54 checks (jsdom with real test-issues.html + pal-shared.js). Not tested: real Safari quota, mobile layout, real Supabase, launcher.

### v1.75 — TI-086 — Local cache trim on sync

- Introduced `PalSync.trimIfLarge()` in `pal-shared.js` (see Shared Components). Wired into `onSession` (made async) after `syncPull()` at 500 KB; not in `onNoSession`.
- `ti_v1` was ~2 MB of genuine data (every app's version history and issues).
- Not wired into Gigs & Trips (bespoke sync layer).
- Not tested in a real browser.

### v1.74 — TI-085 — Film & TV Tracker registered

- `APP_REGISTRY` entry `{ id: 'film-tv-tracker', name: 'Film & TV Tracker', emoji: '🎬', prefix: 'FTT', aliases: ['film-tv-tracker'] }`; companion to launcher PET-096. `resolveCanonicalAppId()`, `appIcon()`, `migrateAppRegistry()` and the brief generator key off the array.

### v1.73 — TI-084

- Vault standalone-mode support: if `pal_standalone_vault` is set, the Vault tab button is hidden at boot (same-origin read). `loadVaultFrame()` / `pingVaultFrame()` and `html-vault.html` untouched.
- Brief generator reworked into two explicit steps: **Step 1 — Review and confirm** (read requirements and current files; confirm the `.html` and its companion `.md` are provided; stop and ask if missing or not confirmed current) and **Step 2 — Build** (existing four-item delivery list). Extends the html+md pairing convention (TI-083).

---

# Cross-App Development

Significant changes that affected the application ecosystem as a whole. Each item is supported by the changelogs cited; details are in the Shared Components and per-app sections.

## Shared JavaScript architecture

- **pal-sync becomes the canonical sync pattern.** Extracted from Claim Tracker (pal-sync v1.0) and adopted by Fortnight Tracker (v3.9, with the `bundle_start → record_key` column rename), On Budget (v3.16), Horizon (v1.16), Film & TV Tracker (v1.0), Reading Tracker, Test & Issues, Gym Tracker and Fantasy Football Tracker. Gigs & Trips deliberately stays on its own bespoke sync (GIG-055).
- **pal-utils extraction (PAD-1 audit)** deduplicated `esc` / `escHtml`, `todayISO`, `toast`, `applyThemeCore`, `closeModal`, `uid`. Horizon joined in v4.10 (HZN-012). Film & TV Tracker overrides `closeModal` (v1.1).
- **Three script tags consolidated into `pal-shared.js`** — FF-019, FT-063, GYM-095, ON--070, MR-055, HZN-014.
- **`pal-gcal.js`** introduced as a separate shared module (PGC-002) for PeteGCal and adopted by Gigs & Trips (GIG-072); extended with `expectEtag` (v2) and recurrence-aware listing (v3).
- **Shared configuration in `pal-config`**: `FF_PROXY_KEY` (FF v1.2), TMDB keys (FTT-001), `KNOWN_USERS`. Edited once, never regenerated per release.

## Common storage and sync mechanisms

- **Suite-wide sync audit.** Restoring a backup used to forge new timestamps and blind-push, overwriting newer cloud data: fixed in Meal Planner (MP-045), Reading Tracker (MR-011), On Budget (ON--049) and Fortnight Tracker (FT-026, v3.32). Deleted records could resurrect after a failed tombstone push: fixed at library level in pal-sync v1.11 (root cause traced via ON--049 / ON--050), requiring every app to filter `!record._deleted`; Fortnight Tracker moved bundles to soft delete (FT-030, v3.33).
- **Soft-delete tombstones everywhere** (Fortnight v3.8, Horizon v1.16, Film & TV soft deletes, On Budget v2.5), with optional compaction from pal-sync v1.10.
- **401 retry queue** built into pal-sync v1.8 (from Gym Tracker's own pattern) and persisted to `pal_retry_queue_v1` in v1.9; any app on the origin can flush another app's stranded writes.
- **Known `pull()` limitation** (edits to records already in the cloud are not pushed by `pull()`): worked around in Horizon v1.16 and Reading Tracker v3.30 / v3.32 with direct upserts.
- **Shared per-origin localStorage quota.** All apps share one origin (GitHub Pages). A Safari quota error in Gigs & Trips led to:
  - `PalSync.trimIfLarge()` (TI-086), adopted by Test & Issues, Film & TV Tracker (FTT-039) and Fortnight Tracker (FT-065), not valid for Gigs & Trips;
  - quota-safe saves in Gigs & Trips (GIG-089, v7.94) and Test & Issues (TI-087, v1.76);
  - Gigs & Trips storage report, key classification and measured limit (v7.93, v7.101, v7.102). Real device numbers (v7.102): limit ~3.57 M characters, 48% used, 86% belonging to apps other than Gigs & Trips, mainly `ftt_v1` (1.19 MB) and `gym_tracker_v1` (713 KB);
  - Gigs & Trips retiring its duplicate `gat_v1_clean` copy (v7.101).
  - **Safari on the Mac, October 2026 (TI-089):** the origin held 3,340.7 KB; Test & Issues' pull then tried to write `ti_v1` at 2,005.7 KB (18 apps' version history 1,469 KB + 606 legacy issues 536 KB) = 5,346 KB, over a ~5,120 KB (5 MB, UTF-16) ceiling by ~225 KB. This matches the observed "local cache full" failure exactly and **suggests the real ceiling on that Mac is ~5 MB, not the ~3.57 M characters (~7 MB) recorded for another device at v7.102** — inferred from arithmetic, not yet re-measured with the Measure real limit button on the Mac. Largest keys at the time: `ftt_v1` 1,221 KB, `gym_tracker_v1` 713 KB, `gat_v1` 466 KB, `on_budget_v1` 169 KB.
  - Resolved for Test & Issues by v1.77 (cloud-first local cache, `PalSync.cacheSet`, launcher `pal_ti_stat`). Not yet addressed: Film & TV Tracker `availability[].url` (~300 KB estimated, nothing reads it), Gym Tracker, the Fantasy Football caches.
- **Shared data between Pete and Lex.** Gigs & Trips uses an RLS allow-list of both UIDs. Film & TV Tracker adopted the same RLS (launcher v10.92 / PET-097) and needed pal-sync v1.12 shared mode (FTT-013, v1.8) to actually read both users' rows. Fantasy Football Tracker went the other way: per-user scoping of local caches (v1.33) and a `KNOWN_USERS` check (v1.29) so each person sees only their own team.
- **Cross-app localStorage reads (no postMessage):**
  - `fn_tracker_v5` (Fortnight Tracker) read by PeteGCal and Gigs & Trips for the working-day alert.
  - `gym_pal_xapp` (Gym Tracker v2.42, GYM-039) read by Gigs & Trips.
  - Launcher stat caches written by apps: `pal_ftt_stat` (Film & TV), `pal_vault_stat` (HTML Vault v1.8), plus launcher reads of `ti_v1`, `gat_v1`, Horizon's records and others.
  - Standalone flags `pal_standalone_claims` / `_vault` / `_horizon` written by the launcher and read by host apps at boot.
- **Data-updated broadcasts to the launcher:** `GYM_DATA_UPDATED`, `FT_DATA_UPDATED` (Fortnight v3.43), `FF_DATA_UPDATED` (Fantasy Football v1.35).

## Common Google Calendar functionality

- PeteGCal (launcher v10.98) and Gigs & Trips (from v7.77) share one OAuth Client ID, one Google Cloud project quota and the same calendar (Pete's primary, shared with Lex). Calendar ID hardcoded to Pete's account in both.
- The quota incident (Gigs & Trips v7.92, GIG-087) came from un-throttled mirror pulls plus backfill and migration traffic on the shared project; mirror pulls are now throttled to once per 10 minutes.
- App metadata shares the `petegcal` key in `extendedProperties.private`; Gigs & Trips adds `app: 'gigs-and-trips'` (AD-9, v7.94) so ownership is identifiable.
- PeteGCal retirement remains an open decision (Gigs & Trips backlog, risk R-9).

## Common UI and framework changes

- **Launcher-controlled theme via `PAL_THEME` postMessage**, no in-app toggles: Fortnight Tracker v3.3, On Budget v2.9 (pilot, `ob_theme_pref`), Fantasy Football Tracker v1.29, Film & TV Tracker v1.9 (`ftt_theme_pref`). Embedded hosts relay theme to nested iframes where the child has its own theme (Claim Tracker), but not to Horizon (single dark theme).
- **Embedding apps inside other apps** via lazy-loaded nested iframes with session relay: Claim Tracker in Fortnight Tracker (FT-041, re-embedded FT-062), Horizon in On Budget (Horizon v4.3; re-embedded ON--069 v3.73), HTML Vault in Test & Issues (TI-083). Launcher PET-094 (v10.89) made each optionally standalone.
- **Customisable launcher layout** (PET-094) synced via `pal_layout`, fixed for cross-device sync in PET-101 (v10.96).
- **Suite-standard sync chip / Data Modal**: Gigs & Trips pattern adopted by Gym Tracker (v2.43, GYM-041) and Film & TV Tracker (v1.2, FTT-003, matching Fortnight Tracker v3.71).
- **Tab bars text-only rule** (GYM-072, Gym Tracker v2.74), also referenced as applied to On Budget.
- **Modal audit**: click-outside-to-close (Gym Tracker v2.32, described as a suite-wide audit).
- **Load-speed pass**: cache-busting query strings on shared scripts (Claim Tracker CLA-014, Fortnight Tracker FT-053, Gigs & Trips GIG-050, Gym Tracker GYM-085, Horizon HZN-010) and dropping Google Fonts for system fonts (Fortnight Tracker FT-056, Reading Tracker MR-054, Horizon HZN-013).
- **Desktop breakpoints** (900px) added to Fortnight Tracker (v3.4–v3.6) and On Budget (v3.0–v3.1).
- **Viewport standard** `maximum-scale=1.0, user-scalable=no` (Fortnight Tracker v3.42 brought in line with the suite).
- **Security**: `PAL_SESSION` origin guard (Fortnight Tracker v3.2; built into pal-sync's `initSession`), HTML escaping across On Budget (v3.42).

## Development process conventions recorded across apps

- Companion `.md` changelogs with short inline pointers in the HTML: Gigs & Trips (v7.87), launcher (v10.89), Test & Issues (v1.73), Film & TV Tracker (v1.2), HTML Vault (v1.8), Horizon (v4.9); Fortnight Tracker, Gym Tracker, On Budget and Reading Tracker keep recent releases inline. This file now replaces those `.md` changelogs.
- Test & Issues' brief generator requires each new session to confirm the `.html` and its companion `.md` are present and current before building (TI-084).
- Releases routinely state what was tested (usually Node / jsdom / headless Chromium) and what was not (real browser, physical iPhone, live Supabase or Google). Version drift between `<title>`, header badge and `VERSION` constants recurred (launcher v10.93, Horizon v4.8, Gym Tracker v2.62 / v2.73, On Budget v3.15, Fantasy Football Tracker v1.48) and is a known risk area.
