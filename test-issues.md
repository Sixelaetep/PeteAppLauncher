# Test & Issues — Changelog

Full version history for `test-issues.html`. As of v1.73, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

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
