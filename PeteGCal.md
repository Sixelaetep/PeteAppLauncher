# PeteGCal — Changelog

Full version history for `PeteGCal.html`. New entries go here in full; the inline comment in the `.html` gets a short pointer only, same convention as `index.md` for the launcher.

Launcher-side integration (nav icon, home card, iframe, `LAYOUT_APPS`/`PAL_NAV_SLUG_MAP` entries) is tracked in `index.md` against `index.html`'s own version, not duplicated here — this file is PeteGCal's own behaviour only.

---

## Before v1.0 — groundwork (not shipped as app versions)

**PGC-001 — OAuth spike.** Google Cloud project created, OAuth consent screen configured (External, Testing mode, Pete + Lex as test users), Calendar API enabled, OAuth Client ID issued for `https://sixelaetep.github.io`. Proven via a throwaway test page (`gcal-test.html`, not part of PeteGCal's own lineage): sign-in, event create, read-back, and silent token refresh all confirmed working from the real GitHub Pages origin — both for Pete and, separately, for Lex signing in with her own Google account.

**PGC-002 — `pal-gcal.js`.** New shared module, deliberately kept separate from `pal-shared.js` (which every other app loads — not worth risking for something unproven outside this one app so far). Provides Google sign-in/token-refresh, `listEvents`/`createEvent`/`updateEvent`/`deleteEvent`/`getEvent`, and `extendedProperties` read/write helpers (`withAppMeta`/`readAppMeta`) for PeteGCal's own app-metadata tagging. Re-verified via an updated `gcal-test.html` that calls the module directly rather than the raw API — same checks as PGC-001, plus a new `listEvents()` check (with pagination) the original spike never exercised.

---

## v1.0 (PGC-003) — Initial app: read-only agenda view

First real version of `PeteGCal.html`. Not a replacement for GigsAndTrips — runs alongside it, untouched, until PeteGCal is proven out.

**What it does.** Signs in with Google (silent attempt on load, falls back to a "Connect" gate if that fails), fetches every event on the shared calendar from 14 days ago to 180 days ahead via `pal-gcal.js`'s `listEvents()`, and renders it as a day-grouped agenda list (Today / Tomorrow / weekday+date headers). Read-only — no create, edit, or delete yet.

**Calendar ID is hardcoded to `peteshellard@gmail.com`, not the literal string `'primary'`.** `'primary'` resolves to whichever account is signed in — correct for Pete, silently wrong for Lex (it would show her own unrelated calendar). This was caught during PGC-001/002 testing before it became a real bug in the app itself.

**No exclusions — every event shown**, per the "full mirror" design decision. App-created events (tagged via `extendedProperties.private`, read with `readAppMeta()`) show their type as a pill; anything typed straight into native Google Calendar shows a plain "Calendar" tag instead, with no other special treatment.

**Known limitation, accepted deliberately for this phase.** No offline fallback — unlike GigsAndTrips' Supabase-backed local-first data, PeteGCal has nothing to show without a valid Google token. A failed silent refresh shows "Reconnect needed" and drops back to the sign-in gate. Offline caching is scoped for later (PGC-007), not part of this version.

**Not yet built:** create/edit/delete (PGC-004), conflict detection (PGC-005), trip-spanning (PGC-006), offline caching (PGC-007).

**Tested:** `node --check` passes on both inline script blocks. `pal-gcal.js`'s underlying calls (sign-in, refresh, create, read-back, list) were proven separately via `gcal-test.html` before this version was built on top of them.

**Not tested:** `PeteGCal.html` itself has not been run in a browser. Agenda rendering, day-grouping, the empty state, the silent-sign-in-on-load path, and the reconnect-on-expiry path are all reasoned through against `pal-gcal.js`'s already-proven behaviour, not yet exercised directly.

**Open item carried over, not yet closed.** Lex's write access to Pete's shared calendar (as opposed to her own) was confirmed once via the module-based `gcal-test.html`, but not re-confirmed since. Worth closing out before PGC-004 adds real writes from inside PeteGCal itself.
