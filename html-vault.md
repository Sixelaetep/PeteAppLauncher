# HTML Vault — Changelog

Full version history for `html-vault.html`. As of v1.8, new entries go here in full; the inline comment in the `.html` gets a short pointer only, to avoid the file bloating — see the `.html`'s own top-of-file comments for everything before v1.8.

## v1.8 (HTV-010)

Stat cache for the launcher's new customizable-layout system (index.html PET-094): this app has no local data model at all — it's always talked straight to Supabase, with nothing in localStorage. Every other launcher card reads its live stat straight off localStorage directly (no cross-frame query, works whether or not the iframe is loaded); Vault never had anything there to read, which is exactly why it's never had a card before now.

Added `cacheStatForLauncher()`, called from the one place `items` is ever fetched and reassigned (`loadList()`, itself called from every mutation path — upload, delete, reorder, tag change), writing `{ count, updatedAt }` to a new `pal_vault_stat` localStorage key. Nothing else about this app's data model changes — items themselves are still never persisted locally, only this one summary. If localStorage is unavailable for any reason, the write is silently skipped (try/catch) and the launcher's card just shows nothing new, same graceful-empty pattern used everywhere else in the suite.

No other function, upload flow, or Supabase table touched. Verified via a manual reload, upload, and delete, confirming `pal_vault_stat` updates correctly each time and the app's own UI is unaffected.
