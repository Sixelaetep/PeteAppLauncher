# PeteGCal — Changelog

Full version history for `PeteGCal.html`. New entries go here in full; the inline comment in the `.html` gets a short pointer only, same convention as `index.md` for the launcher.

Launcher-side integration (nav icon, home card, iframe, `LAYOUT_APPS`/`PAL_NAV_SLUG_MAP` entries) is tracked in `index.md` against `index.html`'s own version, not duplicated here — this file is PeteGCal's own behaviour only.

---

## Backlog (not scheduled into a phase yet)

**Location field: Google Maps search/autocomplete, not plain text.** GigsAndTrips already has a venue autocomplete + Google Maps linking system (`gmapsSearchUrl()`/`venueLinkHtml()`) that PGC-004 deliberately didn't port over, to keep the first create/edit form minimal. Worth a proper look later. One thing to know going in: this needs the Google Places API, which is a separate enable step from Calendar API in Cloud Console, and typically requires a billing account attached to the project even for usage that stays within the free tier — a new manual setup step, not just code. Scope question for when this gets picked up: does the resolved address just fill the existing plain-text `location` field (simplest, no data-model change), or does it also store `place_id`/coordinates via `extendedProperties` for something richer later (a map preview, say) — the second option is more useful but is additional scope, not free.

**Repeating events.** Google Calendar natively supports recurrence (RRULE), and `pal-gcal.js`'s `listEvents()` already requests `singleEvents: 'true'`, which expands recurring events into individual instances when reading — so recurring events created natively in Google Calendar already display correctly today, with no extra work. What's missing is creating one from inside PeteGCal (a repeat option on the form — None/Daily/Weekly/Monthly, with an end condition) and, the genuinely non-trivial part, **editing** one: Google's API distinguishes editing a single instance (creates an exception) from editing the whole series (targets the recurring event's own ID, not the instance's), and the form/UI needs to ask which the person means, the same way Google Calendar's own UI does with its "this event / this and following / all events" prompt. Worth sizing properly as its own phase rather than folding into a future PGC-004-style pass — closer in shape to the trip-spanning complexity than to a quick form addition.

---

## v1.10 — Agenda restructured to actually match GigsAndTrips: month grouping + per-card date block

v1.8/v1.9.1 ported GigsAndTrips' *colours and class names* but deliberately kept PeteGCal's own day-grouped structure, reasoning a per-card date block would be redundant under a day-group header. Pete asked for the real GigsAndTrips layout anyway — this delivers it properly rather than half-porting it again.

**What changed:**
- **Grouping moved from individual day to month.** `renderAgenda()` now groups by `monthKey()` (`YYYY-MM`) instead of `dayKey()`. Month headers (`.month-hdr`) show the month name and event count, styled at the same visual weight as GigsAndTrips' primary `.year-hdr` — a deliberate adaptation, not a direct copy: GigsAndTrips nests month under year because it covers unbounded history; PeteGCal's rolling window (14 days back, 180 forward) rarely crosses more than one year boundary, so a single "Month YYYY" level does the job without a redundant second nesting level. The label includes the year only when it isn't the current one.
- **Every card now carries its own stacked date block** (`.card-date-block` — day number large, month and weekday small above/below), ported at GigsAndTrips' exact values, sitting left of the title/location/time/type in a `.card-top` flex row.
- **"Today" scroll-targeting moved from day-group containers to individual cards.** Each card now carries a `data-datekey` attribute; `scrollToToday()` finds the first card at or after today's date and scrolls to it directly, rather than to a day-group wrapper that no longer exists.
- **Dead code removed**, not left behind: `formatDayLabel()` (only ever used by the old day-group header) is gone entirely, and the explanatory comment above `.event-card` — which argued *against* a date block — was rewritten to describe why one exists now, rather than left stale and misleading for whoever reads it next.

**Verification habits from the v1.9.1 miss, applied again here rather than only that one time:** re-ran the same CSS-comment-closure simulation across the whole stylesheet after this edit too (0 broken, 87/87 braces balanced) — not just trusting that a bigger structural change didn't reintroduce the same class of bug.

Files changed: `PeteGCal.html` only — CSS (`.month-hdr`/`.card-date-block`/`.card-top`/`.card-info` added; old `.day-group`/`.day-label` removed), `renderAgenda()`, `renderEventCard()`, `scrollToToday()` all rewritten; `formatDayLabel()` deleted.

**Tested:** `node --check` passes; CSS-comment integrity and brace-balance re-verified; ID cross-check clean; grepped for any remaining `day-group`/`day-label` references to confirm nothing stale was left half-migrated.

**Not tested:** not yet run in a browser. Month-header rendering, the date-block's layout alongside the title/meta row, and the today-scroll targeting a specific card rather than a day-group container are all unconfirmed in practice.

---

## v1.9.1 — Fix: card styling was never actually rendering since v1.8

Found by Pete comparing a live screenshot against GigsAndTrips directly — cards had no background, border, or shadow at all, just plain text with no visual separation, nothing like the ported design v1.8 claimed to add.

**Root cause, confirmed not guessed.** The v1.8 CSS comment explaining the card port contained the literal text `.card-*/.type-pill` — and `*/` is CSS's comment-close sequence. The comment closed right there, mid-sentence, and the rest of its prose (plain English, not valid CSS) got parsed as broken stylesheet content from that point until the parser could resync — which silently dropped `.event-card`, `.card-body`, and the rules immediately following them. The classes were being applied correctly in the DOM (verified by direct inspection of `renderEventCard()` — nothing wrong there) and `.type-pill`/`.cal-badge` further down the stylesheet were unaffected, which is why the type/calendar badges still showed correctly even with the card chrome missing entirely.

**Fix.** Reworded the comment to avoid the `*/` substring (a comma instead of a slash between class names). Verified properly this time: simulated the same non-greedy comment-matching a real CSS parser performs, across the entire stylesheet, and confirmed all 4 comment blocks now close cleanly with nothing malformed inside any of them — not just confirming the one fix, checking for any other instance of the same mistake.

Files changed: `PeteGCal.html` only (one comment reworded).

**Tested:** `node --check` passes; the CSS-comment-closure simulation above is a genuine test of the actual bug mechanism, not just a syntax check.

**Not tested:** not yet confirmed rendering correctly in a real browser — the simulation proves the stylesheet is no longer structurally broken, not that the cards look right.

**Open question for Pete:** the screenshot showed "Gym" events with a plain "📅 Calendar" badge rather than a coloured Gym type-pill — correct if those were pre-existing native Calendar entries never touched by PeteGCal, a bug worth chasing if they were actually created through PeteGCal's own form. Worth confirming which, once the card-chrome fix is visible.

---

## v1.9 — Event types expanded from 6 to 12, matching GigsAndTrips exactly

Pete's call, made specifically before deploying for real: music/play/musical/comedy/sport/festival/cinema — originally collapsed into one generic "Gig/Event" bucket during PGC-004's "keep it minimal" scoping — are kept as their own distinct types after all. Applied consistently in both places that had a type system, not just the one Pete pointed at: `PeteGCal.html`'s own `EVENT_TYPES` (the create/edit picker and card badges) **and** `reconcile-gigs.html`'s import mapping, since leaving only one updated would have meant an imported "Comedy" gig showing correctly coloured on the real Calendar but badged generic "Other" the moment it's viewed inside PeteGCal itself.

**What actually changed:** type *definitions* only — 6 entries became 12, each with GigsAndTrips' own exact icon and colour (ported directly from `GIG_TYPES`, not reinvented). No change to how types are stored (`extendedProperties`, same as always), no change to the create/edit form's structure, no change to card rendering logic — everything downstream of `EVENT_TYPES` already worked generically off the array, so expanding it was the entire change.

**Google `colorId` assignment:** Google's native palette only has 11 colours for 12 types, so two pairs share (`pets`/`comedy` both Tangerine, `food`/`musical` both Banana) — picked deliberately so the pairs sharing a colour are unlikely to appear side-by-side often, rather than left to chance.

**`reconcile-gigs.html` also gained an icon prefix on created events** (`🎸 Event name`, etc.) — it didn't have one before. GigsAndTrips' own old URL-based "Add to Calendar" flow always prefixed an icon onto the title; matching that now means newly-created imports look consistent with anything already on the calendar from an earlier manual send, rather than introducing a third, unprefixed title style.

Files changed: `PeteGCal.html` (`EVENT_TYPES`, `.type-pill` CSS), `reconcile-gigs.html` (`TYPE_MAP` — now identity for the 7 instead of collapsing, `TYPE_COLOR`, new `TYPE_ICON`, icon prefix in `createFromGig()`).

**Tested:** `node --check` passes on both files; confirmed all 12 keys present in `EVENT_TYPES` by direct grep, not assumption.

**Not tested:** not yet run in a browser — the 12-chip type picker's layout/wrapping, the shared-colorId pairs' actual visual distinctness, and the icon-prefixed titles on newly created imports are all unconfirmed.

---

## Companion one-off tools

**`reconcile-gigs.html`** — not part of `PeteGCal.html` itself, no version number of its own, not added to the launcher. A one-off (run-when-needed, not a standing feature) check: reads GigsAndTrips' real gigs from `localStorage['gat_v1_clean']` in whichever browser it's opened in, fetches real Google Calendar events across that date range in one bulk call, and matches each gig against Calendar by same-date + title-contains (a heuristic, not a certainty — GigsAndTrips' old URL-based "Add to Calendar" flow stamped a `[Sent D Mon]` suffix on every send, so exact-title matching would miss gigs sent more than once under slightly different titles). Shows a review list with per-item **Create** buttons — confirmed as the approach over a single bulk-confirm, given the heuristic's real but occasional mismatch risk. **Strictly one-way**: creates Calendar events, never writes anything back to GigsAndTrips' own data — confirmed as the approach over also marking `calendarAdded` on the source records. `gigType` (16 possible values, including 4 trip-item types that can technically appear on a gig record) is mapped exhaustively onto PeteGCal's 6 types, nothing left to an implicit fallback. Must be run in the same browser GigsAndTrips has actually been used in, since it reads local data directly — the tool says so plainly and shows a distinct message when no GigsAndTrips data is found at all, rather than silently reporting zero gigs.

**Tested:** `node --check` passes; ID cross-check clean; the GSI script tag's presence was explicitly re-verified by direct grep this time, specifically because of the v1.3 miss.

**Not tested:** not yet run against real data — the bulk date-range fetch, the title-matching heuristic's actual hit rate against real gig titles, and the per-item create flow are all unconfirmed in a browser.

---

## v1.8 — Background Fortnight sync, calendar-ID audit, card restyle to match GigsAndTrips

Three separate requests addressed in one pass.

**1. Hidden Fortnight Tracker instance for fresher working-day data.** A hidden `<iframe src="fortnight-tracker.html">` now loads on boot. PeteGCal captures its own incoming `PAL_SESSION`/`PAL_UNLOCKED` message (new — it never listened for this before, having no `PalSync` usage of its own) and relays it to the hidden frame once both the session and the frame are ready, in either order. This is the exact same pattern `fortnight-tracker.html` already uses for its own embedded Claims tab (FT-062), not a new approach — confirmed by reading that file directly rather than assuming the pattern would transfer. **Honest limitation:** only works when PeteGCal itself is embedded in the launcher, since that's the only place it receives a session to relay in the first place. Opened standalone, Fortnight's hidden copy just times out after 3 seconds and runs local-only — a safe no-op, not a failure.

**2. Calendar-ID audit, both read and write paths.** Checked directly rather than asserted from memory: every `PalGCal.listEvents`/`createEvent`/`updateEvent`/`deleteEvent` call site uses the `CALENDAR_ID` constant, with zero stray `'primary'` references anywhere in actual code (one harmless mention survives in an explanatory comment). Confirmed correct for both read and write, for both users, by direct inspection of all four call sites — no code change needed.

**3. Event cards restyled to match GigsAndTrips.** `GigsAndTrips.html` was re-read directly for its actual `.event-card`/`.card-*`/`.type-pill`/`.cal-badge` CSS, and those exact class names and colour values were ported in — not a lookalike under different names, the same vocabulary, so the two apps share one visual language going forward. Type-pill colours now match 1:1 for the four shared type keys (gym, appointment, pets, food, other); the new `gig` key reuses GigsAndTrips' `music` pill colours as the closest fit for a merged "Gig/Event" category. The "native Calendar entry" tag now uses GigsAndTrips' actual `.cal-badge` styling (Google-blue), which turned out to be a class already built for exactly this purpose. Past events now dim (`opacity:.72`), matching GigsAndTrips' own treatment. **One deliberate non-port:** GigsAndTrips shows a per-card date block because it only groups by year/month; PeteGCal already groups by individual day, so a per-card date block would duplicate the day-group header above it — kept the existing compact time line instead, serving the same role without the redundancy.

Files changed: `PeteGCal.html` only (hidden iframe + session relay, `--sh0` token, full card CSS/markup rewrite in `renderEventCard()`).

**Tested:** `node --check` passes; ID cross-check clean; the calendar-ID audit is itself a form of testing (direct inspection of all four call sites, not inference).

**Not tested:** none of this has run in a browser yet. In particular, the session-relay timing (session arriving before vs. after the hidden frame finishes loading, both paths written but not watched happen) and the restyled cards' actual appearance are unconfirmed.

---

## v1.7 (PGC-005, part 2) — Working-day alert, and PGC-005 is now complete

**PGC-005 is done.** Both halves — event-overlap warning (v1.6) and this one — are built.

**What this reads.** `fortnight-tracker.html` was uploaded and actually read, rather than guessed at — the approach taken after the v1.3 miss. Its day records (`bundle.days[]`, each `{date, status, ...}`) use `status: null|'done'|'training'|'conference'` for an actual rostered working day, and `'holiday'|'sick'` for a day off that was originally rostered. `day.date` is `YYYY-MM-DD`, identical format to PeteGCal's own `dayKey()` — direct string comparison, no parsing translation needed. Data lives under `localStorage['fn_tracker_v5']` (with a `v4`/`v3` fallback chain, same as the launcher's own `statFortnight()`), which PeteGCal can read directly since every app in the suite shares one origin and therefore one `localStorage`.

**Deliberately does not reimplement Fortnight's 9-day pattern.** `buildDays()` in `fortnight-tracker.html` generates working days at fixed offsets (`[0,1,2,3,4,7,8,9,10]` from a bundle's start date — Mon–Fri short-Friday week one, Mon–Thu week two, the alternating-Friday RDO plus both weekends making up the other 5 days of the 14-day cycle). PeteGCal does not re-derive this forward for dates beyond whatever bundles already exist in the data — only real, already-entered bundles are read. A future date with no bundle created for it yet simply shows no alert, rather than PeteGCal guessing at the pattern independently and risking drift from Fortnight's own logic — same principle the launcher's own Horizon card comment documents for exactly this kind of cross-app read.

**UI.** A small badge appears under the Date field, only when the selected date is a confirmed working day (`💼 This is a working day, per Fortnight Tracker`) — silent for a confirmed day off and silent when there's no data for that date either, since the badge is only worth showing for the one alert-worthy case. Checked live on date change and once when the form first opens, same pattern as the conflict-overlap check.

Files changed: `PeteGCal.html` only (`FORTNIGHT_KEYS`, `getFortnightWorkingDates()`, `isWorkingDay()`, `workday-badge` CSS/element, `updateWorkdayBadge()`, wired to `f-date` and called on form open).

**Tested:** `node --check` passes; ID cross-check clean.

**Not tested:** not yet run in a browser. In particular, the cross-app `localStorage` read has not been confirmed to actually find real Fortnight Tracker data on Pete's device — the data shape was read correctly from the uploaded file, but reading your *own* browser's stored data is a different thing from reading the file that produces it.

---

## v1.6 (PGC-005, part 1) — Event-overlap conflict warning

First half of PGC-005. The second half — an alert when an event falls on a working day, read from `fortnight-tracker.html`'s pattern rather than a duplicated setting (decided during PGC-004 scoping) — is **pending**: the launcher's own code only partially reveals that app's data shape (`fn_tracker_v5` in localStorage, `bundles` → `days`, `status` can be `'holiday'`/`'sick'`), not enough to know what actually marks a day as "working" versus a rest day in its 9-day pattern. Asked Pete to upload `fortnight-tracker.html` directly rather than guess — a deliberate change in approach after the v1.3 root-cause miss, where guessing at a dependency's behaviour wasted real debugging time that reading the actual file would have avoided.

**What's built.** The create/edit sheet now checks live, on every date/time change, for overlap against every event already loaded in the current window (`_eventsById`) and shows an inline amber warning naming the clashing event(s) and their times. Purely informational — never blocks Save, since a genuine overlap (two things on at once, deliberately) is a real use case, not an error. Also runs once when the form first opens, so editing an event that already clashes with something shows the warning immediately, not only after the first edit. The event being edited never flags against itself.

**Deliberately out of scope for this pass:** all-day events are skipped on both sides of the check. A timed gig overlapping an all-day entry (a holiday, say) is worth surfacing eventually, but day-level overlap needs different handling than a straight time-range comparison, and this cut keeps to the original ported-overlap-check shape from GigsAndTrips rather than growing it.

Files changed: `PeteGCal.html` only (`conflict-warning` CSS + `--warn`/`--warn-dim` tokens, the `conflictWarning` element in the sheet, `checkConflicts()`, wired to `f-date`/`f-start`/`f-end`/`f-allday` and called once on form open).

**Tested:** `node --check` passes; ID cross-check clean.

**Not tested:** not yet run in a browser — the overlap math, the self-exclusion on edit, and the live-update-on-typing behaviour are reasoned through, not watched happen.

---

## v1.5 — Defaults to today, with a Today button

Small UX gap from v1.4: the agenda always opened at the top of the 14-day-past window, so "today" was buried a couple of scrolls down on every single open — exactly the opposite of what an agenda view should default to.

**Fix.** Every rendered day-group now carries a stable `id` (`day-YYYY-MM-DD`). After each render, the view auto-scrolls to today's group — or, if today has nothing on it, the nearest upcoming day — using an instant (non-animated) scroll so it doesn't feel like a jarring jump on open. A new **Today** button in the header does the same scroll on demand, animated this time, for whenever you've scrolled away to check something further out. `scroll-margin-top` on each day-group accounts for the sticky header so the destination doesn't land hidden underneath it.

Files changed: `PeteGCal.html` only.

**Tested:** `node --check` passes; every `getElementById` reference cross-checked against the markup, no mismatches.

**Not tested:** not yet run in a browser — the scroll targeting (exact-day match, nearest-upcoming fallback, the sticky-header offset) is reasoned through against the DOM structure, not yet watched happen.

---

## v1.4 (PGC-004) — Create, edit, delete

**PGC-003 is now confirmed working end to end**, not just reasoned through: Pete signed in, the agenda populated from the real calendar, and — from the earlier chat thread — Lex independently confirmed write access to Pete's shared calendar via the module-based test page. All three gates from PGC-001/002/003 are closed.

**What's new.** A floating "+" button opens a bottom-sheet form to create an event; tapping any existing event card (app-created or native) opens the same form pre-filled, for editing. Delete always removes the real Google Calendar event, with a confirm step first, per the house rule decided during scoping.

**Minimum field set**, agreed before building rather than ported wholesale from GigsAndTrips' larger set: Title, Type, Date/time (or all-day), Location, Notes. Explicitly dropped for this phase: venue autocomplete/Google Maps linking, multi-currency costs, travel/meal sub-types, and anything trip-structural — trips stay deferred to PGC-006 as planned.

**Event types — 6, not 16.** GigsAndTrips has a much larger `GIG_TYPES`/`ITEM_TYPES` set built for its trip-item system; PeteGCal's first pass uses a deliberately small set: 🎫 Gig/Event, 💪 Gym, 📅 Appointment, 🐶 Pets, 🍽️ Food, 📌 Other. Stored via `pal-gcal.js`'s existing `extendedProperties` mechanism (`{type: 'gig'}` etc.), same as before.

**New: type also maps to Google's native `colorId`.** Not explicitly requested, but close to free given Google already supports it — each type sets a native event colour (e.g. Gig/Event → Grape/purple, Gym → Basil/green), so the distinction is visible in the real Google Calendar app on your phone too, not just inside PeteGCal. This is a plain top-level field on the event body, unrelated to the `extendedProperties` metadata.

**Editing a native Calendar entry for the first time** defaults its type to "Other" (no type existed before), consistent with the "every event is first-class regardless of origin" design — enriching it just means picking a real type and saving, same form either way.

**Field-to-Google mapping**, confirming how little custom infrastructure this needed: Title → `summary`, Location → `location`, Notes → `description` — all native Google Calendar fields, no custom venue system required for this minimum version.

**Noted for later, not built yet:** a working-days conflict alert (PGC-005) is now explicitly scoped to **read from the existing `fortnight-tracker.html` pattern** rather than duplicate a separate working-days setting inside PeteGCal — a design decision made during scoping, ahead of actually building PGC-005, specifically to avoid maintaining the same shift pattern in two places.

Files changed: `PeteGCal.html` only (new CSS for the FAB/sheet/type-chips, new sheet markup, `EVENT_TYPES` constant, `openCreateForm`/`openEditForm`/`closeForm`/`handleSave`/`handleDelete` and supporting helpers, `_eventsById` lookup map populated on every load, event cards now clickable). No change to `pal-gcal.js` — its existing `createEvent`/`updateEvent`/`deleteEvent`/`withAppMeta` were already exactly what this phase needed.

**Tested:** `node --check` passes on both inline script blocks. Every `getElementById` call in the file was cross-checked against the actual markup — no ID mismatches (a lesson taken from the v1.3 root-cause miss: verify references exist rather than assume).

**Not tested:** none of the actual create/edit/delete flow has been run in a browser yet — form validation, the all-day toggle, the type picker, the colorId showing correctly in native Google Calendar, editing a native-origin event, and the delete confirm flow are all reasoned through against `pal-gcal.js`'s already-proven CRUD methods, not yet exercised directly.

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
