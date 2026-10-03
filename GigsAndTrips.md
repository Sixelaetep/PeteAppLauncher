# GigsAndTrips — Changelog

Full version history for `GigsAndTrips.html`. As of v7.87, new entries go here in full; the inline comment in the `.html` gets a short pointer only, same convention as `index.md` for the launcher and `PeteGCal.md` for PeteGCal.

Entries before GIG-072 (the start of the Google Calendar sync work) are not yet migrated here — they still live as inline comments scattered through the HTML, the way the whole file worked before this convention started. Retroactively moving ~70 historical entries out of a 7,000-line production file is a separate, much larger and riskier piece of work than adopting the convention going forward; see the note at the bottom of this file.

---

## v7.96 (GIG-101, GIG-103 part, mirror bug fix) — Calendar sync queue, safer deletes, no more duplicate imports

**A real bug found while planning this, fixed first.** `gcalUnmatchedEvents()` (the Calendar mirror and the 4-year backfill) only checked whether an event's Calendar id belonged to a **gig**. Since GIG-078/079 started writing **trip and trip-item** events to Calendar, those events looked "new" to the mirror and were re-imported as duplicate `other` gigs. It now also skips ids owned by any trip or trip item, ids whose Calendar delete is still queued (so a deleted event is not resurrected), and anything this app tagged as a trip/item. **Existing duplicates are not removed automatically.** Sync & Backup has a new "🧹 Find duplicate Calendar imports" button: it finds gigs that share a Calendar id with a trip or item, lists them, and removes only plain, unedited ones (type other, no trip, no review, no ticket data). It removes them from Gigs & Trips and Supabase only; it never touches Google Calendar. The Storage report now also shows a "duplicate-looking imports" count so you can see the size first.

**GIG-101 — Calendar sync queue.** A failed or impossible Calendar write no longer just logs and waits for a manual button. Gig, trip and item syncs that fail, or that happen while signed out, are queued (ids only, in one small key `gat_gcal_queue`); replay re-reads the **current** record, so it always sends the latest state, and updates rather than creates if another device has linked it meanwhile. Failures are classified: sign-in needed and offline do not use up attempts; rate/quota errors pause automatic retries for 10 minutes; server errors retry up to 6 times; permission errors and "event no longer exists in Google" go straight to a visible Failed state (never auto-recreated, to avoid resurrecting events you deleted in Google). The queue drains automatically a moment after sign-in, when you return to the app, and when the network comes back (at most once a minute), and stops at the first rate-limit or sign-in problem. Sync & Backup shows Waiting/Failed counts, the first few items, **Retry now** (revives failed ones too) and **Discard failed**. Gig, trip and item forms show a quiet "⏳ waiting to send" or "⚠ sync failed — reason" line only when something is actually pending. State is derived from the queue and `calendarEventId`; nothing extra is written onto records.

**GIG-103 (part) — deletes no longer orphan Calendar events.** Previously, deleting a gig/trip/item while signed out (or choosing "delete anyway" after a failure) silently left the real Calendar event behind. Once you commit to deleting locally, any Calendar delete that did not succeed is queued and retried. This also closes the GIG-082 known gap: the cascade delete when a trip's dates shrink is no longer fire-and-forget. A Calendar delete that returns "not found / gone" now counts as success. The confirm wording changed from "will remain, orphaned" to "will keep retrying".

**Not in this release:** Google→app updates, deletion detection, reconciliation and conflicts (GIG-102/104/105) and the `pal-gcal.js` additions they need (GIG-115). `pal-gcal.js` and the launcher are unchanged.

**Tested — in Node, running the real functions against a stub Google client:** error classification including the real "quota has been exceeded" message; signed-out sync queues without touching the record and de-duplicates; each failure class (transient up to the attempt limit, permanent immediately, offline without burning attempts, rate sets back-off); success clears the entry and links the record; a drain sends the **current** record state for every queued item and empties the queue; a rate limit stops the drain after the first call, holds automatic drains, and "force" overrides; no token or offline leaves the queue intact; a record deleted while queued makes no API call; a record linked by another device is updated, not duplicated; delete helpers treat 404/410 as success and report 500 as failure; queued deletes retry then clear; the mirror skips gig-, trip-, item- and pending-delete-owned ids and tagged trip/item events while still importing a genuine native event; duplicate cleanup removes only the plain copies and makes **zero** Google calls; Storage report duplicate count; badges; Discard failed. Inline scripts pass `node --check`; the v7.93, v7.94 and v7.95 suites still pass.

**Not tested:** nothing has run against real Google or in a browser. The confirm dialogs, the Sync & Backup layout, the badge placement in the three forms, automatic draining after a real sign-in/visibility change, and the delete flows end to end (they were checked in source and through the helpers, not by deleting a real record) are unconfirmed. How many duplicate imports actually exist is unknown until you press the button or run the Storage report.

---

## v7.95 (GIG-092, 095, 096, 097, 098, 099) — Event Class and the Agenda filter

First user-visible step of the event-architecture work.

**Event Class (GIG-092/095).** Every calendar entry now has a class: Gig / Event, Appointment, Trip / Itinerary, Standard, or Other. A gig stores `eventClass` **only when you choose one** (or an import sets it); otherwise it is derived at read time from its type and trip link, so there is no bulk migration, no mass write to Supabase, and no sync churn on Lex's devices. Defaults: music, play, musical, comedy, sport, festival, cinema → Gig / Event; appointment → Appointment; travel, stay, food, key stop → Trip / Itinerary when on a trip, otherwise Appointment; attraction → Trip / Itinerary on a trip, otherwise Gig / Event; gym, pets, other → Standard. Trip items are always Trip / Itinerary. New Calendar imports are stored as Standard. Agenda entries now carry their class.

**Class on the gig form (GIG-096, first part).** New "Calendar class" selector (Auto — from type, or an explicit class). Auto removes any stored class so the default applies. The bulk "needs review" list is not built.

**Filter (GIG-097).** Agenda has a compact scrolling filter bar: All · Important · Gigs · Appts · Trips · Standard. The last choice is remembered in one tiny UI key, `gat_cal_filter` (not event data, and now recognised by the Storage report). Important = Gig / Event, Appointment, Trip / Itinerary, **plus anything placed inside a trip**; Trips = Trip / Itinerary or anything on a trip, so a gig inside a trip appears under both Gigs and Trips.

**Agenda and NOW/NEXT (GIG-098/099).** Agenda defaults to **Important**. A line under NOW/NEXT shows "N hidden by this filter · Show all" whenever something is filtered out, so nothing disappears silently. NOW/NEXT only considers entries that match the filter. Because NOW/NEXT lives on the Agenda, there is no separate Today screen to change.

**Consequence to know about:** existing gigs of type "other" (including everything imported from Google, and any you added manually as "other") are Standard, so they now disappear from the default Agenda view until you switch to All/Standard or give them a class on the gig form. The hidden count tells you how many.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. No launcher, `pal-gcal.js`, Supabase or Google change; no data migration. Upcoming/Past are not filtered (Upcoming refinement is GIG-111).

**Tested — in Node against the real extracted functions with a stubbed DOM:** default class for every type with and without a trip; an explicit valid class wins and an invalid stored value is ignored; each filter against each class (including a Standard item inside a trip); filter default, persistence and fallback on a bad stored value; a full Agenda render on synthetic data for every filter, with correct entries and hidden counts, no hidden line on All, the empty-filter message, and the empty-data case; NOW/NEXT does not pick a filtered-out entry. Inline scripts pass `node --check`; the v7.93 and v7.94 test suites still pass.

**Not tested:** not opened in a real browser; the filter bar's fit at 390px width, its horizontal scroll, and the form selector's appearance are unconfirmed. The class selector was only checked in the source, not by saving a real gig.

---

## v7.94 (GIG-089, GIG-091 part, AD-9, GIG-110) — Storage write safety, import hygiene, small housekeeping

A batch of small, independent changes.

**GIG-089 — `saveData()` can no longer lose an edit to a full localStorage.** Before: a `QuotaExceededError` threw out of `saveData()`, which aborted `saveEvent()` *before* `pushEvent()`, so the edit reached neither local storage nor Supabase. Now: the main write is tried; if the quota is the cause, the one regenerable duplicate (`gat_v1_clean`, the launcher copy) is removed and the write retried once; if it still fails, a warning toast (rate-limited to once a minute) and a Sync Log entry appear and the caller carries on, so the cloud push still happens. The `_clean` write is now best-effort (the launcher already falls back to `gat_v1`). `saveData()` now returns true/false. **Known limitation:** when storage is genuinely full the app reads from localStorage, so the edit is safe in Supabase but will not show on that device until space is freed; the warning says so.

**GIG-091 (b)(d) — import hygiene, first part.** Calendar imports now carry `importedFrom:'gcal'`. Recurring instances (those Google marks with `recurringEventId`) are **no longer imported** by the rolling pull or the 4-year backfill; the Sync Log, backfill confirm and "nothing new" toast show how many were skipped. Already-imported instances are untouched. Reversible with the single constant `GCAL_SKIP_RECURRING`. Series support (GIG-106) and the one-off collapse of existing instances (GIG-117) come later.

**AD-9 — ownership tag.** The three Calendar metadata objects (gig, trip, item) now include `app:'gigs-and-trips'`. The metadata key stays `petegcal`. Existing Calendar events gain the tag the next time they are synced.

**GIG-110.** The v7.92 entry above is now labelled GIG-087.

**Deliberately not done:** the Europe/London `timeZone` on Google writes (AD-11, approved). Existing one-off events are sent as exact instants, so adding a zone changes nothing for them and could mislabel trips abroad; it is required only for recurring events, so it ships with GIG-116.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. No launcher, `pal-gcal.js` or data-model change.

**Tested — in Node against a quota-limited storage shim:** normal save writes both keys; a save that only fails because of the duplicate recovers by dropping it and the new data persists; genuinely full storage returns false, leaves the old data intact, warns once (second call rate-limited), and does not throw; `saveEvent()` still calls `pushEvent()` when local storage is full or blocked (SecurityError); recurring instances are skipped and counted, one-offs imported, already-known recurring instances untouched; `importedFrom` set; all three metadata objects carry the tag. Inline scripts pass `node --check`; the GIG-088 report tests still pass.

**Not tested:** not run in a real browser or Safari; the toast and the Sync Log wording are unseen on screen; no real Google call made.

---

## v7.93 (GIG-088) — Read-only storage report

First ticket of the backlog restructure. **Sync & Backup → Storage → "Storage report (read-only)"** lists every localStorage key on the origin (the whole PAD suite shares one), with size, owner and category (Persistent / Cache / Temporary / UI pref / Sync queue / Foreign / Unclassified), by-category totals, and a summary of what is inside `gat_v1`: counts of gigs, trips, days, items, tombstones and venues, the size of the duplicate `gat_v1_clean`, gig types, how many gigs look like Calendar imports, a heuristic count of recurring-looking instances, and the five largest records. It also records whether it ran in the home-screen app or a browser tab, since those keep separate storage. A "Copy report" button copies it as plain text.

**It changes nothing.** No `setItem`/`removeItem`/`saveData` is called; the collectors take the storage object as a parameter so they can be tested against a shim that throws on any write.

Files changed: `GigsAndTrips.html` only (version strings v7.92 to v7.93 in the title, header and `pal-shared.js` cache-bust; new button; new functions between `// ==GIG-088 BEGIN==` and `END` markers). No data-model, sync, Calendar or launcher change.

**Tested, in Node against a storage shim:** totals equal the sum of (key + value) x 2 bytes; the shim is byte-identical before and after (and throws on any write); counts of gigs/trips/days/items/tombstones/venues; import-looking and recurring-looking detection (trip-linked gigs excluded); classification of known, `gat_`-unknown and foreign keys; duplicate-size reporting; corrupt `gat_v1` JSON and empty storage do not throw; mode detection. The whole inline script passes `node --check`.

**Not tested:** not opened in a real browser or on Safari/iOS. The nominal 5 MB figure is a rough guide only; the report deliberately does not probe the real quota (that would write to storage). The recurring-looking count relies on Google's instance-id pattern, which is a heuristic until GIG-117 confirms it with Google's own data.

---

## v7.92 (GIG-087) — Fix: Calendar mirror pull throttled (real bug, found by real testing)

First real-world finding from actually opening the app: `gcalMirrorPull()` had zero throttling and fired on every single page load. During a day of heavy reloading while building and testing GIG-072–086 — plus the 4-year historical backfill and the migration tool, both sharing the same Google Cloud project's quota with PeteGCal — this hit Google's Calendar API quota (`"The quota has been exceeded"`).

**Worth being clear about:** nothing was lost or corrupted. The pull is read-only, and `syncLog` reported the failure exactly as designed, rather than silently swallowing it — the error-reporting discipline built through this whole line of work did its job.

**Fix.** Throttled to once per 10 minutes, keyed on the *last attempt* (not last success) — specifically so a quota-exceeded state doesn't keep retrying on every reload while the quota's still exhausted, which would only extend the problem. A new **"🔄 Pull from Calendar now"** button in Sync & Backup bypasses the throttle for an on-demand check, since the automatic version alone would otherwise mean no way to force a fresh pull inside the 10-minute window.

Files changed: `GigsAndTrips.html` only — `gcalMirrorPull()` gained a `force` parameter and throttle check, new `minsAgoLabel()` helper, new manual button.

**Tested — genuinely, against the actual failure scenario.** Extracted the throttle logic into a standalone Node test with a `localStorage` shim and confirmed: a fresh call runs; an immediate reload right after (the exact quota-error-then-reload pattern from the real report) is correctly throttled; the manual force button correctly bypasses the throttle; and an automatic reload right after a manual pull is correctly throttled again.

**Not tested:** whether this actually resolves the quota error in practice depends on Google's own quota window resetting — that's outside anything the app controls. Worth trying the app again once some time has passed, and using the new manual button rather than repeated reloads if checking again soon.

---

## v7.91 (GIG-086) — Agenda navigation + secondary metadata, and the trip-sync plan is now complete

Last piece of the original Agenda/Today build (GIG-081–086, all from the source spec).

**Navigation:** a small "↑ Today" button at the top of Agenda, scrolling the list back to its top. **Deliberately not built:** previous/next-*period* paging, which the source document also suggested — Agenda's current design is a fixed forward-rolling window with no Month/Week grid behind it, so there's no "period" to page through yet. Scope noted explicitly rather than inventing paging just to match the document's wording; worth revisiting if/when Week or Month views ever get built.

**Secondary metadata:** item rows now show duration (e.g. "1h 5m") when real `durationMinutes` data exists — matching the document's own travel-item example — and only then. Nothing else added: no cost, no booking status, no internal fields. The document's rule was "only what materially helps," not "show everything available," and that's held to here the same as everywhere else in this line of work.

Files changed: `GigsAndTrips.html` only — `.agenda-today-row`/`.agenda-today-btn` + `scrollAgendaToToday()`, `.agenda-duration` line in `agendaRow()`.

**Tested — genuinely.** Ran `agendaRow()` against synthetic data with and without `durationMinutes` set: duration line renders correctly formatted when present, is cleanly absent (no stray markup) when not.

**Not tested:** the Today button's actual scroll behaviour in a real browser.

---

## v7.90 (GIG-085) — Today mode: NOW/NEXT

A compact NOW/NEXT card at the top of the Agenda tab — not a separate tab, per the source spec's own preference against maintaining "two visually identical concepts." Reuses the items `renderAgenda()` already fetched; no second data call.

**The spec's "never invent an end time" rule shaped the actual logic, not just the prose.** A gig has no duration field anywhere in its data model — never eligible for "NOW," full stop. A trip item is only eligible if it has a real, explicitly-set `durationMinutes` (confirmed as genuine user-settable data, not a sync-only default, before using it) — an item whose start time has already passed but has no stored duration is correctly never shown as active, even though a cruder "has it started" check would have wrongly flagged it. "NEXT" skips anything already started/finished today and any all-day-today entry (ambiguous as "next"), picking the first genuinely upcoming timed item or future day.

Files changed: `GigsAndTrips.html` only — `durationMinutes` added to the item agenda-entry shape (GIG-083's `agendaEntryFromItem`, small additive change), `renderNowNext()`, new `.nownext-*` CSS.

**Tested — genuinely, with real timing logic exercised, not just read.** Built a synthetic test with items positioned relative to the actual current wall-clock time (so the test is deterministic regardless of when it's run) covering: a gig at a "currently active" time (correctly never shown as NOW), an item with no stored duration at a similar time (correctly never shown as NOW despite its start time having passed), an item with real duration genuinely in its active window (correctly shown as NOW), and a correct "NEXT" pick over a later same-day alternative. Also tested the fully-empty state ("No current item" / "Nothing else scheduled").

**Not tested:** not yet opened in a real browser against real GigsAndTrips data — only synthetic data confirmed in Node.

---

## v7.89 (GIG-084) — Agenda UI

New **Agenda** tab, added to the existing tab bar between Upcoming and Past, using the exact same `switchTab()`/`.ni` pattern Upcoming/Past/Reviews/Locations already use — not a bolted-on separate thing. Renders `getAgendaItems()` (GIG-083) as a date-grouped chronological stream: "Today" or "Weekday D Month" headers, then each entry as time → icon+title → location, with trip context (when applicable) rendered as a small uppercase label **above** the entry — matching the source spec's own example precisely, deliberately subordinate, never competing with the item's own title.

**Empty days are never shown, with no extra filtering needed** — `getAgendaItems()` only ever returns dates that actually have something on them, so this requirement from the spec was already satisfied by the data layer's own design.

**Window:** today → +60 days. Forward-looking only for this first cut — not a Past replacement, and bounded per the spec's own performance guidance against rendering hundreds of empty dates.

**Styling reuses the app's own existing typography values** (`.card-name`/`.card-sub`/`.card-time`'s exact font-sizes and colours) rather than inventing a new visual language for just this one tab.

Files changed: `GigsAndTrips.html` only — new tab button, `render()` dispatch, `renderAgenda()`/`agendaDateHeader()`/`agendaRow()`, new `.agenda-*` CSS block.

**Tested — genuinely, not just read.** Ran the actual `agendaDateHeader()`/`agendaRow()` functions against synthetic data in a standalone Node harness: confirmed "Today" labelling, correct weekday/day/month formatting for other dates, the trip label rendering above the row only when present and absent otherwise, all-day styling applying correctly, and no stray output when location is empty. Also confirmed every `.agenda-*` class referenced in the generated HTML has a matching CSS rule — checked explicitly, not assumed.

**Not tested:** not yet opened in a real browser — tapping through to a gig or item's detail view from an Agenda row, and the visual appearance of the 5-tab bar (one more tab than before), are both unconfirmed in practice.

---

## v7.88 (GIG-083) — Agenda data layer

First piece of the Agenda/Today work from the source spec. `getAgendaItems(startDate, endDate)` combines standalone gigs and trip items into one flat, chronologically sorted stream — data only, no rendering yet (GIG-084).

**Genuine reuse, not a new data model**, per the spec's own instruction: found that the existing itinerary view already has a `sortDayTimeline()` + `_linkedGig` merge pattern that folds a trip-linked gig into its day's timeline for display — `getAgendaItems()` reuses that exact mechanism rather than inventing a parallel one. A gig linked to a trip is folded into that trip's day and is **not** also shown as a standalone entry; an orphaned `tripId` (pointing at a trip that no longer exists) correctly falls back to standalone, so nothing silently disappears. Ghost items (multi-night-stay echoes) are excluded, same reasoning as GIG-079's Calendar sync.

Files changed: `GigsAndTrips.html` only (`getAgendaItems`, `agendaEntryFromGig`, `agendaEntryFromItem`, new section near `sortDayTimeline`).

**Tested — genuinely, not just read.** Extracted the real function and ran it against synthetic data covering all four cases (standalone gig, trip-linked gig, orphaned-tripId gig, ghost item) in a standalone Node harness: confirmed the linked gig is folded in exactly once and not duplicated, the orphaned gig correctly falls back to standalone, the ghost item is excluded, and chronological sort across dates and within a day is correct.

**Not tested:** only the data layer has been exercised — no UI renders any of this yet, and the function hasn't run against real GigsAndTrips data in a browser, only the synthetic test case.

---

## v7.87 (GIG-082) — Deletion failure handling

Closes the one real gap the source spec surfaced: `gcalDeleteGig`/`gcalDeleteTrip`/`gcalDeleteItem` used to be fire-and-forget — a failed Calendar delete still let the local record get removed anyway, silently stranding the real Calendar event with nothing left in GigsAndTrips pointing at it, un-retryable.

**Fix.** All three delete helpers now return `true`/`false`/`'skipped'` instead of swallowing the outcome. Every delete flow (`confirmDeleteGig`, `confirmDeleteTrip`, `deleteItem`) now `await`s the Calendar delete first; on failure, it asks explicitly — delete from GigsAndTrips anyway (Calendar event stays, orphaned) or cancel and keep both intact for a later retry. For a trip (which can cascade through many item deletes), failures are collected into one summary confirm rather than one prompt per failed item.

**Known limitation, not fixed here:** `generateDays()`'s cascade-delete, which fires when shrinking a trip's date range drops days (and their items) from the data, is still fire-and-forget. Smaller edge case than an explicit delete action — left as-is rather than restructuring `saveTrip()`'s whole flow for it in this pass.

Files changed: `GigsAndTrips.html` only (`gcalDeleteGig`/`gcalDeleteTrip`/`gcalDeleteItem` now return outcomes; the three call sites made `async` and await-aware).

**Tested:** `node --check` passes; CSS-comment integrity clean.

**Not tested:** not yet run in a browser — specifically, no real Calendar-delete failure has been triggered to confirm the "ask before proceeding" path actually surfaces correctly.

---

## v7.86 (GIG-081) — Structured Calendar descriptions

Built from a detailed external spec (document pasted by Pete, source unconfirmed — possibly an earlier version of this app) covering Calendar/Agenda UX and Google integration principles. Replaced the GIG-075-era notes-only description with a structured, per-type format: one shared formatter (`gcalFormatDescription`) plus three field-builders (`gcalGigDescriptionFields`, `gcalTripDescriptionFields`, `gcalItemDescriptionFields`), built from fields that actually exist in GigsAndTrips' data model.

**Deliberate deviation from the source spec's own example:** it shows "Booking ref: ABC123" / "Confirmation: XYZ456" — GigsAndTrips has no booking-reference or confirmation-number field anywhere, on any record type. Rather than invent fields that don't exist, the description builds from what's real: ticket price/URL for gigs, cost/payment status for items, trip status for trips. Nothing already native to the event (location, date/time) is duplicated into the description.

Retires the old "rich Calendar descriptions" backlog entry in `gigs-and-trips-gcal-backlog.md` — this is that work, done.

**Not tested:** none of the three description formats confirmed against real rendered data yet.

---

## v7.85 (GIG-080) — Item-level Calendar button

Same "View in Google Calendar" / "Sync to Google Calendar" pattern gigs (GIG-074) and trips (GIG-078) already had, now on the trip-item form too — completing the original trip-sync plan (GIG-077–080). Hidden for a brand-new unsaved item (nothing to sync yet) and for ghost items (the multi-night-stay display echo, which has no Calendar event of its own).

---

## v7.84 (GIG-079) — Item-level Calendar sync

Every trip item now gets its own real Calendar event, reusing the app's existing `itemTime()`/`itemLocationName()`/`typeIcon()` helpers rather than re-deriving the per-type field differences across all 7 item types. Accommodation syncs as a genuine multi-night all-day span (check-in date → check-in + nights), not a single point like everything else. Ghost items are skipped — the real item on its check-in day already covers the whole span.

**Two orphaning gaps found and fixed in the same pass, not left for later:** deleting a whole trip now cascades to delete every item's Calendar event, not just the trip's own; and shrinking a trip's date range (which silently drops days from the data) now also deletes any orphaned items' Calendar events as part of that operation.

---

## v7.83 (GIG-078) — Trip-level Calendar sync

Trips now get one real multi-day all-day Calendar event (`startDate`→`endDate`, correctly end-date-exclusive per Google's convention), replacing the old URL-popup flow — same shape GIG-074 gave gigs. `gcalTripUrl()` and `markCalendarAdded()` removed, both confirmed to have zero remaining callers before deletion.

---

## v7.82 (GIG-077) — Foundation for trip/item sync

Small — the real infrastructure (script tags, `PalGCal.init`, `CALENDAR_ID`) already existed from GIG-072; this added `GCAL_ITEM_COLOR_MAP` (7 `ITEM_TYPES`) and `GCAL_TRIP_COLOR_MAP` (3 `TRIP_TYPES`), both distinct type systems from gigs' own `GIG_TYPES`. No behaviour change.

---

## v7.81 (GIG-076) — Full Calendar mirror

GigsAndTrips now mirrors Google Calendar rather than only pushing to it. A rolling pull (14 days back, 180 forward, same window as PeteGCal) runs automatically on load — any Calendar event with no matching gig (checked by real `calendarEventId`, not a heuristic) is imported as a gig (`gigType: 'other'`), appearing in Upcoming/Past exactly like a manually-entered one. A separate "Import 4 years of Calendar history" button in Sync & Backup handles the one-off deeper backfill.

Depends on GIG-073's migration having already run — anything never linked to a real Calendar event would otherwise get re-imported as a duplicate.

**Also discovered during this work**, not newly built: `checkGigFormConflicts()` (same-date gig/trip clash checking) and a working-day alert reading Fortnight Tracker's real data were already present in the codebase — not in the originally-uploaded file, so added at some point earlier in this project, but genuinely already complete by the time GIG-076 shipped. No separate conflict-detection issue was needed.

---

## v7.80 (GIG-075) — Gig form simplified

Ticket URL/price moved behind a collapsible "+ Ticket details" section, open by default when either already has a value. The separate ticket/seat note field is removed — its content merges into the main Notes field the moment an existing gig's edit form opens, cleared from its old field on save so nothing lingers duplicated.

---

## v7.79 (GIG-074) — Real Calendar sync replaces the URL-popup flow

`saveGig()` now calls real `createEvent`/`updateEvent` instead of opening a Google Calendar URL in a new tab. Sync is fire-and-forget and never blocks the actual gig save — not signed in just means sync is skipped, recoverable via GIG-073's tool or the next edit. A silent sign-in attempt on load means this typically needs no visible prompt. The gig detail view's Calendar button reflects real state (View vs. Sync-to-retry). Deleting a gig deletes its real Calendar event too. `gcalGigUrl()` removed, confirmed unused first.

---

## v7.78 (GIG-073) — One-time Calendar link-up migration

New button in Sync & Backup: "Link existing gigs to Google Calendar". Scans gigs marked `calendarAdded` (the old URL-based flow) with no stored `calendarEventId`, matches each against real Calendar events by date + title, and presents a review list for linking one at a time — never bulk, since the title match is a heuristic (the old flow stamped a `[Sent D Mon]` suffix on every send, so exact-title matching would miss repeat sends).

---

## v7.77 (GIG-072) — Google Calendar sync foundation

Added `pal-gcal.js` and the Google Identity Services script tag — reusing the same OAuth Client ID already registered for PeteGCal (one Client ID per origin, no new Cloud Console setup needed). Added `GCAL_CLIENT_ID`/`GCAL_CALENDAR_ID` constants, the latter hardcoded to Pete's actual account rather than `'primary'`, which would resolve to whichever account is signed in. Module initialises on boot and logs to the existing Sync Log panel — no new UI, nothing behaviourally different yet. Pure foundation for everything that follows.

---

## Migrating the pre-GIG-072 history (open question, not yet actioned)

Everything before this point — the bulk of the app's actual history, GIG-001 through GIG-071 — still lives as inline comments scattered through `GigsAndTrips.html`. Pulling all of that out into this file and replacing it with pointer comments is a large, genuinely risky undertaking on a mature 7,000+ line production file: potentially 70+ historical blocks to locate, extract accurately, and verify nothing was lost or mis-transcribed in the process, across code that's been live and working for a long time. Worth doing deliberately, as its own scoped piece of work with its own testing pass — not folded silently into an unrelated feature change.
