# PeteGCal — Changelog

Full version history for `PeteGCal.html`. New entries go here in full; the inline comment in the `.html` gets a short pointer only, same convention as `index.md` for the launcher.

Launcher-side integration (nav icon, home card, iframe, `LAYOUT_APPS`/`PAL_NAV_SLUG_MAP` entries) is tracked in `index.md` against `index.html`'s own version, not duplicated here — this file is PeteGCal's own behaviour only.

---

## v1.3 — root-cause fix: the GSI script tag was never actually in the file

**The real cause of every sign-in failure since v1.0.** `PeteGCal.html` never included `<script src="https://accounts.google.com/gsi/client" async defer></script>`. `pal-gcal.js` documents this requirement in its own header comment ("Load order: include the Google Identity Services script before this file...") but the file that actually needed to follow that instruction never did. `window.google.accounts.oauth2` was consequently never available, which is exactly what the v1.2 `onInitFailed` timeout correctly detected and reported — v1.2's diagnostics were accurate; the root cause just hadn't been found yet.

**This supersedes the investigation in v1.1/v1.2's entries below and the chat discussion around them.** Safari's Intelligent Tracking Prevention, content-blocker extensions, the launcher's iframe embedding, and network/device-level filtering were all explored as possible causes and were all the wrong layer — the script was never being requested by the page at all, so none of those could have mattered. Confirmed by: direct navigation to the GSI script URL working fine (that request never went through this file), while loading via the app failed identically in Safari, Chrome, standalone, and embedded — consistent with a tag missing from the page itself, not a browser- or network-level block.

**Fix.** Added the one missing script tag, between `pal-shared.js` and `pal-gcal.js`. Nothing else changed — `pal-gcal.js` itself, `CLIENT_ID`, `CALENDAR_ID`, the sign-in/refresh/error-handling logic, and the v1.2 timeout behaviour are all untouched.

Files changed: `PeteGCal.html` only (one added `<script>` tag, version markers).

**Tested:** `node --check` passes. The fix is minimal and mechanical enough to be low-risk, but:

**Not tested:** the actual sign-in flow has not yet been re-run with this fix in place. This is the fix most likely to actually work, given it addresses a confirmed, concrete absence rather than a theory — but "most likely" isn't "confirmed" until it's tried.

---

## v1.2 — visible version badge; init-failure handling in pal-gcal.js

Prompted by Pete hitting a genuinely ambiguous "Google sign-in issue: not initialised" error after the v1.1 fix, plus a fair complaint: no way to tell which version was actually running in the browser.

**Version badge.** Header now shows "PeteGCal v1.2" next to the app name, kept in sync with the `<title>` tag and the inline pointer comment on every release going forward — same three-places-at-once discipline the launcher's `index.html` already uses for its own version.

**`pal-gcal.js`: `init()` now has a timeout and a distinct failure path.** Previously, if `window.google.accounts.oauth2` never became available (script blocked by a content blocker, a stale cache, or any other load failure), `init()` retried every 300ms *forever*, in total silence — the app would just sit there, and any `signIn()`/`requestTokenRefresh()` call in that state would fail with a bare `'not-initialised'` code and no further explanation. Now it gives up after ~6 seconds (20 attempts) and calls a new `onInitFailed(msg)` callback with a specific, actionable message — distinct from `onAuthError`, since "the script never loaded" and "a sign-in attempt was made and rejected" are different failure modes that deserve different handling and different user-facing text.

**Readable error text.** `PeteGCal.html` now maps the `'not-initialised'` code to a plain sentence instead of showing the raw code string in the toast.

**Not a confirmed fix for Pete's original Safari issue** — this makes the failure mode diagnosable (loud, specific, timed-out) rather than fixing an unconfirmed root cause. Two live suspects, not yet distinguished: (1) Safari serving a stale cached copy of `PeteGCal.html` from before the v1.1 fix, since the page itself has no cache-busting query string unlike the scripts it loads; (2) a content blocker/extension preventing `accounts.google.com/gsi/client` from loading at all. The next real-world attempt, now with the version badge confirming which code is actually running and a proper hard refresh beforehand, should distinguish between these.

Files changed: `PeteGCal.html` (version badge, `onInitFailed` wiring, `authErrorText()` helper, version markers), `pal-gcal.js` (`init()`/`_tryInit()` restructured with a 20-attempt timeout and new `onInitFailed` callback — backward compatible, defaults to a no-op if a consumer doesn't supply it).

**Tested:** `node --check` passes on both files.

**Not tested:** Not yet re-run against the actual failure. The timeout path (Google script genuinely never loading) hasn't been triggered deliberately to confirm `onInitFailed` fires as designed — only reasoned through against the code.

---

## v1.1 — fix: auth errors failed completely silently

Bug fix, found immediately on first real-world use. Pete clicked "Sign in with Google" in Safari and nothing visible happened at all — no popup, no error, no console output.

**Root cause.** `pal-shared.js`'s `toast(msg, type)` looks for `document.getElementById('toast')` and silently returns if it's not found — by design, so a missing toast container never throws, it just no-ops. v1.0 never added that element to `PeteGCal.html`. So every call to `toast('Google sign-in issue: ' + reason, 'error')` in the `onAuthError` handler was generating a real, specific error message internally and then discarding it unseen. Nothing was actually broken in the auth flow itself as far as this fix is concerned — the app just had no way to tell Pete what it already knew.

**Fix.** Added the `#toast` element and its CSS (copied verbatim from `GigsAndTrips.html`'s own `.toast`/`.toast.show` rules, so it matches the suite's existing look) — a bottom-centered pill, 2.8s auto-dismiss. Also added `console.error('[PeteGCal] Google auth error:', reason)` alongside every toast call in `onAuthError`, and a `console.info` note for the expected-silent first attempt, so DevTools shows the real reason even if the on-screen toast is missed or dismissed too quickly to read.

**Not yet known.** This fix makes the *symptom* (total silence) impossible going forward, but doesn't by itself explain Pete's original failure — we don't yet know what Google's actual error reason was, since v1.0 swallowed it. Safari's stricter third-party cookie/popup handling (Intelligent Tracking Prevention, FedCM-related changes) is the leading suspect given the browser involved, but needs the real error string from this fix to confirm rather than assume.

Files changed: `PeteGCal.html` only (CSS addition, one new `<div>`, `onAuthError` handler logic). No change to `pal-gcal.js`, `pal-shared.js`, or the launcher.

**Tested:** `node --check` passes on both inline script blocks.

**Not tested:** Not yet re-run in Safari — this fix exists to make the next attempt diagnosable, not confirmed to fix the underlying sign-in failure itself.

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
