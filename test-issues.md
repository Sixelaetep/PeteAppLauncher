# Test & Issues — Changelog

Full version history for `test-issues.html`. As of v1.73, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

## v1.76 (TI-087, TI-088) — Quota-safe local saves + testing-first mode

Two changes in one build.

### TI-087 — "Pull failed: The quota has been exceeded"

**Cause.** `save()` called `localStorage.setItem()` with no guard. When the browser's per-origin quota (shared by every app on the same origin, not just this one) was full, the `QuotaExceededError` threw out of `saveState()` — which `syncPull()` calls *inside* its `try` block. So a pull whose network fetch and merge had both succeeded was reported as "Pull failed", the status went to Error, and the render/refresh steps after `saveState()` never ran. Reproduced exactly on v1.75 (same message, Error state) before fixing.

**Fix.** `save()` now contains the failure: in-memory state stays correct, the cloud copy is untouched, and the pull completes normally. The failure surfaces as a visible **⚠ Storage full** marker in the nav bar, a log entry (naming whether a cloud session exists), and a delayed toast. With **no** cloud session (local-only mode) the message is explicit — "export a backup now" — because in that case the write that failed was the only copy. The first successful write afterwards clears the warning and logs the recovery. `save()` now returns true/false; no existing caller depended on it returning nothing.

**Diagnosis aid.** Sync & Backup → Storage now also lists the whole origin's total and its six largest localStorage keys (UTF-16 bytes, the same basis as `PalSync.trimIfLarge`). Read-only. This is how to tell whether `ti_v1` or another app's key is actually consuming the quota — the v1.75 trim never fired in the reported case (no "Local cache trimmed" log line), which means either `ti_v1` was under 500 KB or writes were pending, so the large key may well belong to a different app. The trim step now logs when it is skipped because of pending writes.

**What this does not do.** It does not free any space. If the quota is genuinely full, the local cache stays stale (cloud remains correct) until something is reduced. The new Storage breakdown identifies what.

### TI-088 — Testing-first mode (Issues hidden by default)

This app is now used for testing releases, not for tracking issues. Issues are **hidden, not removed**: records still load, sync, export and import exactly as before; Sync & Backup → Display → *Show Issues* brings the whole UI back (per-device setting, key `ti_show_issues`). Hidden when off: Issues tab, + Issue, Issues/Build stat chips, Kanban issue board and brief bar, Kanban "📦 Issues", Apps-tab issue lists, "Log Issue" actions, deployed-issue wording in the clean-up sheet.

Testing flow changes (apply regardless of the toggle):
- **Opens on the build to test.** First visit to Kanban or Tests in a page load selects the most recent release that still has untested tests, scoped to that app and version.
- **Version selector on the Tests tab** (previously only settable by clicking a version on the Apps tab). Choosing an app defaults to its newest build with untested tests; "All versions" is still one tap away.
- **Importing a manifest lands on the imported version**, not the whole app.
- **📋 Failures** (Kanban bar and Tests tab): copies a report of failed tests in the current view — test id, title, steps, expected, observed (the fail note) — to paste into the app's Claude project. When the Kanban guided run finishes with failures and Issues are hidden, it offers this report instead of the Log Issue flow.

No manifest-schema change: `resolvesIssues` remains accepted (and resolves issues if any exist) but can be sent empty or omitted. No data-model change, no migration, `pal-shared.js` unchanged.

Files changed: `test-issues.html` only.

**Tested — genuinely run** (jsdom, real `test-issues.html` + `pal-shared.js`, stubbed Supabase and quota; 54 checks): the v1.75 error reproduced; v1.76 pull completes under quota failure and stays Synced; edits while full still update memory and push to cloud; recovery clears the warning; local-only warning; default scoping; version select; fail → report content and scoping; Kanban end-of-run sheet; toggle on/off with issue data retained; issues-visible mode regression (Issues tab, Log Issue, Apps issue lists); manifest import with and without `resolvesIssues`; trim-skip logging. `node --check` passes.

**Not tested:** real Safari / real browser quota behaviour; mobile layout (the extra select and button sit in rows that already wrap); real Supabase round-trip; the launcher (`index.html` not supplied for this change).

---

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
