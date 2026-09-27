# Test & Issues — Changelog

Full version history for `test-issues.html`. As of v1.73, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating.

## v1.73 (TI-084)

Two changes, both Pete's direct request, for the launcher's new customizable layout system (index.html PET-094):

**(1) Vault standalone-mode support.** If Pete sets HTML Vault ("Html" tab, the embedded `html-vault.html`) to standalone in the launcher's new settings panel — its own icon/card again, replacing this embed rather than living alongside it — the launcher writes `pal_standalone_vault` to localStorage. This app checks that flag once at boot, a plain same-origin localStorage read with no postMessage or timing dependency, so it's correct even if this app is opened directly (bypassing the launcher entirely) — and if set, hides the tab button. `loadVaultFrame()`/`pingVaultFrame()` and `html-vault.html` itself are untouched; the tab still works exactly as before when the flag is unset (the default).

**(2) Brief generator reworked into an explicit two-step process.** `buildBriefText()`'s old single "Before starting" line only covered the html+md pairing convention (TI-083) — it didn't address the separate, more basic risk of a fresh Claude session proceeding on stale or incomplete files. The brief now states this as two named steps a session must not skip or merge:

- **Step 1 — Review and confirm:** read the issues/requirements and the app's current file(s); confirm both the `.html` and its companion `.md` (if one exists) have actually been provided; if either is missing, stop and ask the user for it; if files are present but can't be independently confirmed current, stop and ask the user to confirm before proceeding.
- **Step 2 — Build:** the existing four-item delivery list, unchanged.

Both changes verified via `node --check`; the brief text itself was rendered with sample data to confirm it reads correctly end to end (see the exact output captured during this build). The Vault flag was tested by setting it directly in devtools and confirming the tab disappears and reappears correctly on reload.
