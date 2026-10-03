# Test & Issues — Changelog

Full version history for `test-issues.html`. As of v1.73, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

## v1.75 (TI-086) — Local cache trim on sync

Found via a real Safari storage-quota error in a different app (GigsAndTrips) — investigation traced it to shared per-origin storage pressure across the whole app suite, not any one app's bug. `ti_v1` was the single largest contributor at ~2MB, built up from genuinely real, wanted data (every app's version history, every issue) accumulated over this app's long lifetime — not leaked or orphaned data.

**New shared utility: `PalSync.trimIfLarge(key, maxKB)` in `pal-shared.js`.** Deletes a localStorage key if it's grown past the given size, letting the app's own existing pull-from-Supabase logic repopulate it fresh next time it's needed. Safe because local storage is only ever a cache of Supabase for an app using `table()`'s upsert/pull properly — never the sole copy — **provided** nothing is still waiting to push up, which is exactly what `PalSync.retryQueueLength()` already tracks; the trim skips entirely if anything's pending, rather than risk losing an unsynced write.

**Wired into this app's `onSession` callback**, after `syncPull()` has actually completed (await added — `onSession` is now `async`), at a 500KB threshold. Deliberately **not** called in `onNoSession` — with no active Supabase session there's no cloud copy to restore from, so trimming there would be real data loss, not a cache refresh.

**Honest framing, not oversold:** this is a drift/staleness guard, not a permanent size reduction. The app's normal save-on-edit path rewrites the full current dataset back to localStorage the moment anything is actually edited after a trim — so size will naturally climb back toward whatever the real current Supabase dataset weighs. What this actually prevents is local storage silently growing *larger* than that real current size over time, and it provides a brief window of freed headroom right after each successful boot-time sync, which is what mattered for the immediate problem (several apps competing for one shared, finite per-origin quota in Safari).

**Not wired into GigsAndTrips** — checked first, and confirmed it has its own bespoke sync layer that never routes through `PalSync.table()`, so `retryQueueLength()` reflects nothing about its actual pending-write state. Applying this same check there would have been a false sense of safety. That app would need its own equivalent check built against its own sync layer — a separate piece of work, not assumed equivalent to this one.

Files changed: `pal-shared.js` (new `trimIfLarge()`, added to the public return block — purely additive, no existing behaviour touched), `test-issues.html` (`onSession` made `async`, trim call added after `syncPull()`).

**Tested — genuinely, not just read.** `trimIfLarge()`'s four branches (missing key, under threshold, over threshold with no pending writes → trims, over threshold *with* pending writes → correctly does NOT trim) were each run against a synthetic `localStorage`/`retryQueueLength` harness in Node and confirmed correct — the pending-writes case in particular, since that's the one that actually protects against data loss. `node --check` passes on both files.

**Not tested:** not yet run in a real browser against real Test & Issues data — the actual trim triggering at the real ~2MB size, and `syncPull()` genuinely completing before the trim fires, are both unconfirmed in practice.

---

## v1.74 (TI-085) — Film & TV Tracker registered

One-line `APP_REGISTRY` addition: `{ id: 'film-tv-tracker', name: 'Film & TV Tracker', emoji: '🎬', prefix: 'FTT', aliases: ['film-tv-tracker'] }`. Companion registration to index.html's PET-096 — brings up the new app (film-tv-tracker.html v1.0, FTT-001) inside this app's own registry so it resolves to a proper name/icon/prefix once an app record and test cases are logged for it here, same as every other app. No other function touched — `resolveCanonicalAppId()`, `appIcon()`, `migrateAppRegistry()` and the brief-generator all key off the registry array itself, so nothing else needed changing for a plain new entry.

Tested: `node --check`, an HTML tag-balance check. Not yet tested: adding the actual app record + initial test cases inside the running app — still to be done via the app's own UI.

## v1.73 (TI-084)

Two changes, both Pete's direct request, for the launcher's new customizable layout system (index.html PET-094):

**(1) Vault standalone-mode support.** If Pete sets HTML Vault ("Html" tab, the embedded `html-vault.html`) to standalone in the launcher's new settings panel — its own icon/card again, replacing this embed rather than living alongside it — the launcher writes `pal_standalone_vault` to localStorage. This app checks that flag once at boot, a plain same-origin localStorage read with no postMessage or timing dependency, so it's correct even if this app is opened directly (bypassing the launcher entirely) — and if set, hides the tab button. `loadVaultFrame()`/`pingVaultFrame()` and `html-vault.html` itself are untouched; the tab still works exactly as before when the flag is unset (the default).

**(2) Brief generator reworked into an explicit two-step process.** `buildBriefText()`'s old single "Before starting" line only covered the html+md pairing convention (TI-083) — it didn't address the separate, more basic risk of a fresh Claude session proceeding on stale or incomplete files. The brief now states this as two named steps a session must not skip or merge:

- **Step 1 — Review and confirm:** read the issues/requirements and the app's current file(s); confirm both the `.html` and its companion `.md` (if one exists) have actually been provided; if either is missing, stop and ask the user for it; if files are present but can't be independently confirmed current, stop and ask the user to confirm before proceeding.
- **Step 2 — Build:** the existing four-item delivery list, unchanged.

Both changes verified via `node --check`; the brief text itself was rendered with sample data to confirm it reads correctly end to end (see the exact output captured during this build). The Vault flag was tested by setting it directly in devtools and confirming the tab disappears and reappears correctly on reload.
