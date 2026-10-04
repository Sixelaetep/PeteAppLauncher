# GigsAndTrips — Changelog

Full version history for `GigsAndTrips.html`. As of v7.87, new entries go here in full; the inline comment in the `.html` gets a short pointer only, same convention as `index.md` for the launcher and `PeteGCal.md` for PeteGCal.

Entries before GIG-072 (the start of the Google Calendar sync work) are not yet migrated here — they still live as inline comments scattered through the HTML, the way the whole file worked before this convention started. Retroactively moving ~70 historical entries out of a 7,000-line production file is a separate, much larger and riskier piece of work than adopting the convention going forward; see the note at the bottom of this file.

---

## v7.103 (GIG-115 follow-up) — Fixes from the real Google scan; scan v2 with local verification and a dry run

**What your scan showed.** 114 recurring series in Google (including about 95 yearly birthdays and anniversaries), 38 occurrences changed individually, 214 imported gigs that belong to them (212 plain, about 272 KB). It also exposed three defects in my v7.102 code, which this release fixes:
1. **The rule reader was too strict.** It refused 5 of 114 series. Four were valid: Google writes "monthly on the 28th" as `FREQ=MONTHLY;BYMONTHDAY=28` (the three "Payday" series) and "every August" as `FREQ=YEARLY;BYMONTH=8`. These are now accepted **when the value equals the start date** (several days, `-1` for "last day" or a different month are still refused). The fifth, "Dad Bday" (`FREQ=YEARLY;BYMONTHDAY=30`, no month), is still refused on purpose: in the standard that means *every month*, not once a year.
2. **A series that ends before it starts ran forever.** "Green Bn Out" has `UNTIL` one day before its start. The reader dropped the impossible end and made an endless series, which the scan's own check correctly flagged as differing from Google. It is now refused with the reason "ends before it starts". (A series ending exactly on its start day is fine.)
3. **The live check proved nothing.** It picked the first three supported series, which had all ended years ago, so it compared nothing ("0 instances"). So **the instance-id format and the engine-versus-Google dates are still not verified against live Google**; I will not claim otherwise.

**Scan v2 (still read-only; nothing in Google or in your data changes).**
- It now asks Google for cancelled occurrences too, so single occurrences you deleted in Google are visible, and ignores deleted series.
- **Verification from your own data, with no extra Google calls.** Every imported instance already carries the id Google assigned it, so for each series the scan recomputes the id this app would assign and reports how many match, and whether this app's engine produces the same dates. A moved occurrence is expected to differ and is shown. This is real evidence from your calendar rather than my assumption.
- **The live check** now picks up to three series that are running *now* (those with imports first), never ended ones; and if Google returns nothing in the window it says "not a real check" instead of passing.
- **Compact report:** series that already have imported gigs get detail; still-running series without imports are summarised (yearly birthdays and anniversaries listed ten at a time, others by name); ended series are counted, not listed; unrepresentable ones are listed with the reason.
- **Dry run:** the report states what an import/collapse would do: how many series it would create, how many imported gigs it would replace, how many it would keep as changed occurrences (anything you edited, reviewed or reclassified), how many Google-changed occurrences and cancelled dates it would record as exceptions, and the net change in local storage. Policy used: a series is brought in if this app can represent it and it either already has gigs imported here or is still running; ended series with nothing imported are left alone.
- A pure builder for the record an imported series would become exists and is tested (deterministic id `gcal_<Google id>`, Standard class, tiny), but **nothing calls it to save anything yet**.

**One consequence to know about.** Since v7.94 recurring Google instances are not imported (AD-10), so a yearly birthday or anniversary that was imported as a single gig will not reappear in the app next year, and the roughly 90 yearly series Google holds were never brought in. They are Standard class (hidden under the default Important filter) but visible under All/Standard. Importing them as series is exactly what the dry run describes.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. `pal-gcal.js` is unchanged (still v3).

**Tested — in Node:** the exact rule strings from your scan (Tue/Thu with two EXDATEs from a Thursday start; Green Bin weekly with only `WKST`; every 2 weeks; every 16 days; three Payday variants including UNTIL; yearly `BYMONTH=8`; a 1985 birthday; 1st-Tuesday with `EXDATE;VALUE=DATE`; the `UNTIL` instants for 18:00 GMT and 22:59:59Z in summer) parse to the intended rules and generate the right dates; "Green Bn Out" and "Dad Bday" are refused with those reasons; every other refusal path (`-1`, several days, wrong day, wrong month, wrong frequency, with BYDAY) still refuses; a series ending on its own start day yields one occurrence. Scan v2 against a stub Google modelled on your data: cancelled masters ignored, cancelled and changed occurrences counted, status active/ended/unsupported, **the id and date verification (three ids match, the moved one is shown as differing with the computed value, all-day ids use the plain date)**, orphan instances attach to no series, the dry-run numbers (including that an ended series' override and an un-imported series' cancellation are excluded), the compact report (a hundred yearly series fit in under 30 lines), read-only (no writes, no storage change, no data change), live checks (ended series never used, imported-here first, a Google miss reported as DIFFER, a genuinely vacuous check labelled so, none running), and the series builder. All earlier suites and the launcher test pass; scripts pass `node --check`.

**Not tested:** nothing ran against real Google or in a browser. The id format and the engine's dates are verified only against my fixtures until you run the new scan, which will tell us from your real data.

---

## v7.102 (GIG-115, STORAGE follow-ups) — Google recurrence groundwork (read-only) and storage report from real numbers

**What the device results showed (Safari 27, browser tab inside the launcher).** The repeat check passed 22 of 22 in Safari. The measured storage limit is about **3.57 M characters**; **1.73 M (48%) is used**, so about half is free. Gigs & Trips holds **466 KB (about 6–7% of the limit)**; **86% of what is stored belongs to other apps sharing the origin**, mainly `ftt_v1` (1.19 MB) and `gym_tracker_v1` (713 KB). The earlier Safari trouble was therefore the combined total, not this app. Inside `gat_v1`, 230 of 293 gigs are Google imports (291 KB, 62% of the file), and **172 of those look like instances of just 6 recurring series** (two "Gym" series of 56 and 54, Green Bin 28, Pete NWD 14, Blue Bin 13). Collapsing them would remove roughly half of `gat_v1`.

**Google recurrence API (GIG-115), read-only so far.** Nothing in this release writes recurrence to Google.
- `pal-gcal.js` is now **v3** (upload it): `listEvents` gains optional `singleEvents:false` (series not expanded; `orderBy` is then not sent, as Google refuses it), `showDeleted` and `updatedMin`; new `listInstances(calendar, masterId, min, max)`. Defaults are unchanged, so PeteGCal and every existing call behave exactly as before.
- The app gains one codec in the recurrence code: a **series to Google RRULE/EXDATE writer**, a **Google to series reader**, and the **id Google gives each occurrence** (master id + the original start as a UTC stamp, or the date for all-day). The reader accepts only shapes this app can represent (daily/weekly/monthly/yearly, interval, COUNT or UNTIL, weekly weekdays, monthly 1st–4th/last weekday, EXDATE in all three forms Google uses) and refuses everything else with a reason (BYMONTHDAY, BYSETPOS, RDATE, hourly, several RRULEs, COUNT with UNTIL, weeks not starting Monday, and so on) rather than guessing. Timed UNTIL values are converted through the series' time zone.
- **New read-only "🔎 Scan Google recurring events"** (Sync & Backup → Checks). It lists the series in your Google Calendar un-expanded, shows for each whether it can be represented and why not, how many of its occurrences are already imported here as separate gigs (and how many of those are plain), and totals the storage the collapse would free. For up to three supported series it also **checks my assumptions against your real calendar**: whether Google's instance ids match the format I compute, and whether Google's occurrence dates are identical to this app's engine. It makes one paged list call and at most three instance calls, and never writes to Google or to your data. Please run it and send me the result; it decides how the sync is built.

**Storage report, from your real report.**
- Percent used is now of the **measured limit** (stored in a tiny `gat_storage_limit` key when you press Measure real limit); with no measurement it says so instead of showing the old fixed 5 MB guess, which was wrong for your device (it said 66% when 48% was true). It also states Gigs & Trips' own share.
- Every key on your real list is classified: the launcher's `pal_layout_cache`, `pal_ftt_stat`, `pal_standalone_*` and the suite's `pal_device_id` are named; other apps' keys show their owner where the launcher's own code names it (Fantasy Football Tracker, Gym Tracker, Fortnight Tracker, Claim Tracker, Reading Tracker, Meal Planner, Horizon) and otherwise "Another app (prefix)" rather than a guess. Nothing from your list is left Unclassified.
- Four tiny leftovers of removed features (`gat_calAgendaShowEmpty`, `gat_itemSortMode`, `gat_hideTripGigs`, `gat_calView`) are removed at startup; the code only mentions them in comments.
- **Early warning:** once a day, if everything on the origin is at 85% or more of the measured limit, a message says so. It stays silent until you have measured the limit.

**Not done, deliberately:** writing series to Google, reading Google edits to a series back, and the collapse of the imported instances. They wait for the scan result. No collapse tool exists yet, so nothing in your data changes.

Files changed: `GigsAndTrips.html`, `pal-gcal.js` (v3), `GigsAndTrips.md`. No schema or launcher change.

**Tested — in Node:** the library with a stubbed `fetch` (default listEvents parameters identical to v2; un-expanded mode sends no `orderBy`; `showDeleted`, `updatedMin` and page size; pagination in both modes; the instances URL, encoding, `showDeleted` off by default; every earlier export still present). The codec: wall-clock to UTC around both UK clock changes and another zone, and a lossless round trip over 1,100 days at three times of day; instance ids for timed and all-day; the writer for every rule shape including interval, count, UNTIL in winter and summer, all-day UNTIL and EXDATE in both forms; the reader on shapes Google writes including UNTIL before and exactly at the day's slot and EXDATE in TZID, date and UTC forms; 14 refusal cases; and a **round trip of 13 varied series (series → RRULE → series) producing identical occurrences and exceptions** over five years. The scan against a stub Google: grouping of imported instances by master, plain vs reviewed counts, unsupported rule reported with its reason, un-expanded request, the checks pass when Google matches, **and report MISMATCH / DIFFER when I deliberately break the id format or drop dates**, errors contained, no sign-in and an old cached library detected, and **no writes, no storage change and no data change**. Storage: every key from your real report classified, retired keys removed with everything else untouched, the measured-limit percentage and share, the limit persisted after a measurement, and the early warning silent / silent / once a day. All earlier suites and the launcher test still pass; scripts pass `node --check`.

**Not tested:** nothing ran against real Google or in a browser. The two Google behaviours the scan exists to confirm are still assumptions: the instance id format, and that un-expanded listing returns series and individually changed instances as I expect. The scan screen and the early-warning message have not been seen.

---

## v7.101 (STORAGE-001/002/004, CLASS-001, RECUR-TEST-001/002/003) — Storage completion, Needs Review queue, repeat self-check

A batch that follows the post-v7.100 review.

**STORAGE-001 — the duplicate dataset is retired.** `saveData()` no longer writes `gat_v1_clean`; one copy of the data is kept locally. Why it is safe: the launcher already read `gat_v1_clean` *with a fallback to `gat_v1`* and filtered tombstones itself, so the second copy only doubled local storage (it existed for the launcher card, not for quota recovery). A stale copy left by an older version is removed once at startup, which also stops an older cached launcher reading frozen data. The quota-recovery path from v7.94 is kept and still frees a stale duplicate if one is found. The optional launcher release (v10.99) reads `gat_v1` directly; **the app is safe with either launcher version**, so upload order does not matter.

**STORAGE-002 — every key has a category and a retention rule.** The Storage report now ends each key with its rule (for example "Keep. Never auto-deleted", "Removed only when sent or discarded", "Not this app's: never touched"). Known keys are all classified; anything unrecognised is reported as Unclassified. There are no "Migration" keys at present. No cleanup was added beyond the duplicate and leftover test keys, because there is nothing else of this app's that is large or stale; retention work (STORAGE-003) should wait for a real report.

**STORAGE-004 — measure the real limit on the device.** The Storage report has a new opt-in **"Measure real limit"** button. It confirms, then writes temporary 64K-character chunks until the browser refuses, removes every chunk, checks storage is still writable, and appends the measured limit to the report. It is the only storage feature that writes. Leftover chunks (for example if the page was killed mid-test) are removed at startup.

**CLASS-001 — Needs Review queue.** A gig needs review when its class is a guess: anything imported from Google, or with no class chosen and an ambiguous type (other, gym, pets, or travel/stay/food/key stop/attraction not on a trip). It is derived each time; the only thing stored is `classReviewed:true`. **Sync & Backup → "Review classes (N)"** (and a link on the Upcoming hidden-count line) opens a list, upcoming first, with one-tap Gig / Appointment / Standard / ✓ Keep per row, 30 at a time, plus "Keep all N as they are". Saving a gig with an explicit class also counts as reviewing it. Keep does not invent a stored class.

**RECUR-TEST-001 — the repeat engine can check itself on your device.** **Sync & Backup → "Check repeating events"** runs 22 cases in memory in the browser you are using (so Safari and the home-screen app are covered, not just my Node runs): daily every day and every 2 days across the UK clock changes, weekly one/several days and every 2 weeks, monthly by date / first Monday / last Friday, the 31st and 30th skipping short months, yearly anniversary, 29 Feb and 2100, leap and non-leap February, COUNT, inclusive UNTIL, a cancelled or changed date being skipped, COUNT not reduced by a cancelled date, window slicing, and the safety cap. It shows ✅/❌ with expected vs actual and a Copy button, and never reads or writes your data.

**RECUR-003 — time zone on the series.** `recurrence.timeZone` (default `Europe/London`) is stored on the series, never on occurrences, and preserved when a series is edited. The engine itself works in wall-clock dates, so a 09:00 event stays 09:00 across BST/GMT; the zone is what the Google projection will use. Series made in v7.100 have none stored and default to Europe/London when read (no migration write).

**RECUR-002 — one engine everywhere.** There is exactly one expansion implementation (`recurOccurrences`, used through `recurExpandAll`). Agenda, Upcoming, Now/Next, search and the class filter already used it. **New:** clash warnings (a new gig on a date, the gig form's date check, occurrence cards) now include occurrences of repeating events, without a series clashing with itself or with a cancelled date. Known places that do not show occurrences by design or not yet: Past, Reviews, completion prompts, the launcher card (series records are skipped there; changed occurrences count), trip link pickers and venue statistics (the series record counts once).

**Not done:** STORAGE-003 broader retention (nothing justifies it yet), Google recurrence (waits on the testing and unified-engine items above, per the review), collapsing already-imported recurring events.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`; optional launcher `index.html` v10.99. No `pal-gcal.js` or schema change.

**Tested — in Node:** one copy written, tombstones kept in the working copy, startup cleanup removes only the stale duplicate and test keys (other keys untouched), a simulated launcher read works with and without a stale `_clean`, a genuinely full store still degrades safely; every known key has a category and retention rule and none are Unclassified; the report prints the rules; the self-test against a quota-limited store (hits the limit, removes every chunk, existing data untouched, stays writable, reports honestly when the ceiling is reached first, cleans up even when a write throws something unexpected); the repeat self-check passes all cases **and is proven able to fail** (a deliberately broken engine is caught) and does not touch storage; time zone default / preserved / legacy; clash detection for a new gig, the series itself, an occurrence card, a non-Friday and a cancelled date; exactly one expansion function exists and no RRULE generation is duplicated; review rules for every type and flag, ordering, Keep vs choose, bulk keep leaves other records alone, paging and empty state; entry points present. Launcher v10.99 card logic tested separately (reads `gat_v1`, drops tombstones, skips series records, counts changed occurrences, shows "Nothing upcoming" for series-only, ignores a lingering `_clean`). All earlier suites pass; scripts pass `node --check`.

**Not tested:** none of this has run in a browser. In particular the real storage limit (that is what the new button measures), whether Safari/the home-screen app behave differently, how the review list and the two new buttons look on a phone, and the launcher card on screen.

---

## v7.100 (GIG-106, GIG-107) — Repeating events, stage 1: in the app

First stage of recurrence. **Repeating events now work inside Gigs & Trips; they are not sent to Google Calendar yet** (stage 2). This is deliberately not the GIG-048 design that was removed in GIG-060.

**How it works.** A repeating event is **one gig record** (the series) with a `recurrence` rule. Its occurrences are worked out when needed and never stored, so changing the series changes every occurrence at once. Changing a single occurrence stores an ordinary gig (an exception) that points back to the series (`recurrenceOf`, `recurrenceOriginalDate`) and the series skips that date (`recurrence.exdates`); cancelling one occurrence also just adds the date to `exdates`. Dates are plain calendar dates with a wall-clock time, so clock changes can never move or duplicate an occurrence. No Supabase schema change: the series and exceptions are normal gig documents with extra fields (an older copy of the app would show the series as a single gig on its first date).

**Rules supported.** Daily; weekly on chosen days; monthly on the same date, the 1st–4th weekday ("3rd Friday") or the last weekday; yearly. Every N days/weeks/months/years; ends never, on a date, or after N times. Weeks start Monday (as Google does); a monthly date that does not exist (the 31st in a 30-day month) is skipped, not moved; 29 Feb only occurs in leap years; "after N times" counts occurrences before any cancelled ones are removed.

**Using it.** The gig form has a new **Repeats** section. Tapping an occurrence (Upcoming or Agenda, marked 🔁) opens a short view with: **Edit this event only** (creates the changed occurrence and opens it), **Edit all events** (opens the series; changes apply to every occurrence except ones you changed individually), **Cancel this event only**, and **Delete all events** (removes the series and its changed occurrences). A repeating event cannot be part of a trip; pick the trip on a single changed occurrence instead, which then also appears inside the trip. Upcoming and the Agenda show occurrences (Upcoming: next 120 days, capped at 400); **Past does not list them**. They respect the class filter and the day headers.

**Guards.** The series record itself never appears as an extra entry, a completion prompt, a review candidate, a same-date clash, or a duplicate-removal candidate. Google: a series is not synced (logged, nothing queued, no Google event created); its changed occurrences are ordinary gigs and do sync as single events. The mirror's deletion check now recognises a Google recurring event by its occurrences, so it makes no needless lookups.

**Stage 2 (next): Google.** Write the series to Google as one recurring event (with the cancelled/changed dates excluded), import recurring Google events as series instead of skipping them, read edits to a Google series back, and collapse the recurring instances already imported as separate gigs. Needs a `pal-gcal.js` change (non-expanded listing) and is the part I can least test without real Google.

**Known limits in stage 1:** occurrences have no done/missed/review of their own (a changed occurrence does); same-date and day-off warnings ignore occurrences; "this and following" is not offered; converting an existing gig that is already in Google Calendar into a series leaves its single Google event in place.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. No `pal-gcal.js`, launcher or schema change.

**Tested — in Node:** the expansion engine against hand-checked dates (daily every 3 days across a month end; weekly single and multiple days; a start mid-week; every 2 weeks with Monday-based weeks; count; the 31st skipped in short months; every 3 months; 3rd and last Friday; 29 Feb; every 2 years; cancelled dates not reducing COUNT); window slicing equals filtering the full expansion for five rules over three windows; the cap; an inverted window and a bad start date; days across the UK clock change; rule cleaning and descriptions (defaults, bad values, "until" beating "count", ordinals); the real `render()` and agenda: the series is not listed, about 17 weekly occurrences appear in 120 days starting at the right date, a cancelled date is skipped and a changed occurrence is listed once, Past shows none, the class filter applies; the occurrence view, edit-this (exception created once, date skipped, form opened), cancel-this, delete-series (everything tombstoned, Google deletes only for records that had a Calendar event), deleting from the form routes through the series path; form reading and validation (no day ticked, nth/last monthly, bad interval, missing or backwards end date, bad count) and form rendering for a new gig, a series and a changed occurrence; the series is never sent to Google while its changed occurrence is. Inline script passes `node --check`; all earlier suites still pass.

**Not tested:** not opened in a browser, so the Repeats section layout, the day-chip and "On" controls on a phone, and the occurrence view are unseen. Nothing has run against real Google. Creating a series through the real form and saving it was checked through its pieces (form reader, expansion, lists), not end to end by pressing Save.

---

## v7.99 (GIG-111) — Upcoming and Past: day headers, class filter, "On now"

**The problem.** The Upcoming list went year → month → a flat run of cards, so events on different days looked identical and several events on one day were indistinguishable from events on separate days.

**Day headers.** Inside every month group there is now one header per calendar day: weekday and date (for example "FRI 20 Nov"), a relative label near term (Today, Tomorrow, "in 3 days"; on Past: Yesterday, "10 days ago"), an "N events" count when a day has more than one, a heavier rule under it, and weekends in the accent colour. Today's header is accent-coloured. Events are grouped by the same date the list already sorted on (a trip by its start date on Upcoming, end date on Past), so ordering is unchanged. Year and month collapsing behave as before, and the cards themselves are untouched.

**"On now" block.** A trip already under way used to sit under a start date in the past. On Upcoming it now appears first in its own "On now" block (its card still shows "Day N of D") and is not repeated in the month groups.

**Class filter on both lists.** The All · Important · Gigs · Appts · Trips · Standard bar from the Agenda now also appears on Upcoming and Past and shares the same remembered choice (`gat_cal_filter`). Default is Important, so imported birthdays, bin days and other Standard gigs no longer swamp the list. "N hidden by this filter · Show all" is shown whenever something is hidden, and a filter that hides everything shows a message instead of a blank screen. Trips always count as Important; a Standard-class gig placed inside a trip still shows under Important (as on the Agenda). **Search ignores the filter**, searches everything, and stays a flat list with no filter bar or day headers.

**Consequence to know about:** your own gigs of type "other", which count as Standard, are hidden from Upcoming and Past by default exactly as on the Agenda, until you switch to All/Standard or give them a class on the gig form.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. No data, sync, Supabase or `pal-gcal.js` change.

**Tested — in Node, running the real `render()` with stubbed cards:** one header per day with cards in order and correct counts; Today/Tomorrow/"in 3 days" labels and none far out; the weekend tint matches the real weekday; Important hides Standard gigs and counts them; All restores them; Gigs hides appointments; a chip tapped on a list tab re-renders that list while the Agenda tab still re-renders the Agenda; an in-progress trip appears first in "On now" and only once, a future trip is grouped normally, and a Standard gig on a trip stays visible; Past is newest first with Yesterday / "N days ago"; search is global and flat with no filter bar; an all-filtered list shows the bar and message; the empty list message is unchanged; a collapsed month still hides its days. All earlier suites (v7.93–v7.98, library) still pass; the script passes `node --check`.

**Not tested:** not opened in a browser. How the headers look on a phone (spacing, the 10px indent matching the month header, weekend colour), and whether the card's own date block feels redundant under a day header, are unconfirmed.

---

## v7.98 (GIG-118 follow-up) — Duplicate finder that matches what the duplicates actually are

**Why.** v7.96's cleanup only found gigs that share a Calendar id with a trip/item, and it found nothing on real data. Most duplicates do not share an id. The old "add to Calendar" link created a **new** Google event every time it was used (title suffixed `[Sent 4 Jul]` / `[Updated - 14 Jul]`), and the mirror and 4-year backfill then imported every one of those events as its own gig. This is a diagnosis from the code and the old changelog, not yet confirmed against your data; the finder shows its findings before anything is changed so a wrong guess costs nothing.

**New "🧹 Find duplicates" (Sync & Backup)** replaces the v7.96 button. It opens a report and changes nothing until you choose:
- **Same date + title**, ignoring the icon and any `[Sent …]` / `[Updated …]` suffix, among gigs, and against trip items and trips (a trip is matched on its start date). One record of every group is always kept (a record you edited, reviewed, reclassified or put on a trip always wins; then one without a suffix; then the older).
- **Same Calendar id as a trip/item** (the v7.96 case).
- Two records on the same day with different times and no suffix are treated as different events and left alone (listed as "left alone").
- **Repeating titles on many dates** (for example a weekly bin day) are reported but never removed; they are recurring Google events imported one gig per occurrence and belong to the series work.
- Only "plain" gigs can be removed: type other, not on a trip, no review, no ticket data, not reclassified.

**Two removal choices.** "Remove N here" removes them from Gigs & Trips and Supabase only; Google Calendar is not touched. "Remove N here and delete M extra events from Google Calendar" also queues the deletes through the v7.96 retry queue (rate-limit aware, visible under Calendar sync queue). A Google event is never deleted if a record you are keeping still owns it. The result is re-computed when you press the button, so it acts on current data. Take a JSON backup first.

**Copies can no longer come back (import guard).** The Calendar import now skips any event that is a likely copy of a gig, trip or item you already hold (same date and normalised title, and either the same time, no time, or a `[Sent]/[Updated]` copy). That stops old URL-flow copies, and extra Google events you chose to keep, being re-imported on the next pull. Two copies arriving in one batch import at most one. It is a heuristic used only to *suppress* an import; the event stays in Google. The Sync Log reports how many were skipped.

Files changed: `GigsAndTrips.html`, `GigsAndTrips.md`. No `pal-gcal.js`, launcher or data-model change.

**Tested — in Node:** title normalisation (suffixes, stacked suffixes, icons, ZWJ emoji, other brackets left alone); the URL-flow pile (real gig kept, three copies including one at a different time removed, the kept gig's own Google event protected); two identical imported events (older unsuffixed kept); different-time pair left alone; reviewed and reclassified records never removed and chosen as keeper; trip and item copies removed while the trip's and item's own Calendar events are protected, a different-time unsuffixed gig kept, a gig sharing an item's id removed but its id protected; repeating titles reported not removed; local-only removal makes zero Google calls; "also Google" queues deletes for the extra events only; running it twice finds nothing; the import guard suppresses the four copies and imports the two genuinely new events, with recurring instances still counted separately. All earlier suites (v7.93–v7.97, library) still pass; scripts pass `node --check`.

**Not tested:** not run on your data or in a browser. How many duplicates it finds, and whether any are a pattern it does not cover, is unknown until you open the report. The modal layout and the Google deletes against real Google are unconfirmed.

---

## v7.97 (GIG-100 part, 102, 103, 104 part, 105, 115) — Two-way sync for gigs

**Google → Gigs & Trips, for gigs.** Supabase stays the source of truth. Google may change a gig's **title, date, time, location and notes**; nothing else (trip link, tickets, cost, reviews, class) is ever touched. Each gig now remembers `gcalEtag` (Google's version number) and `gcalSyncedHash` (a hash of those five fields) from the last successful sync. On every Calendar pull (the existing 10-minute-throttled mirror, or "Pull from Calendar now"):

- Google unchanged → nothing.
- Google changed, you did not → Google's fields are applied to the gig.
- **You and Google both changed it → nothing is overwritten**; it is listed under "Calendar changes to review" in Sync & Backup showing, per field, Gigs & Trips vs Google, with **Use Gigs & Trips** / **Use Google**.
- Gigs linked before this release have no baseline: they are baselined silently (Google's version number adopted, nothing applied), so old differences, such as titles from the URL-popup era, do not flood you with prompts. The cost is that edits made in Google *before* this release are not pulled in.
- Native events imported from now on carry a baseline from the start.

**Round-trip safe (GIG-100, part).** The icon this app puts on titles is stripped on the way back, and notes are read back out of the structured description block (a description that is not our block is taken as notes in full), so a gig that goes out and comes back unchanged produces no difference.

**Pushes no longer overwrite Google edits (GIG-115, reduced).** `pal-gcal.js` is now v2: `updateEvent` takes an optional `expectEtag`; if the event in Google has changed since, it refuses (error code `etag-mismatch`, status 412, carrying the event as it is now) instead of overwriting. It reuses the fetch the metadata merge already makes, so no extra API call. Callers that do not pass it behave exactly as before. The app then routes the mismatch to the same review list (or applies Google's change if you had not edited), and does not re-queue it. **`pal-gcal.js` must be uploaded with this release** (script tag is now `?v=2`); PeteGCal, which still loads `?v=1`, is unaffected.

**Deletions in Google (GIG-103/104, part).** Linked gigs, trips and trip items whose Calendar event is absent from the pull window are checked individually (it may simply have been moved outside the window; a moved gig is handled as an edit). Only if Google says the event is gone or cancelled is it listed for a decision, never auto-deleted: gigs offer **Remove here** (local + Supabase only, no Google call), **Re-create in Google**, or **Keep, unlink**; trips and items offer re-create or unlink only, so a trip is never removed by a Calendar deletion. At most 10 checks per pull; a server error stops the check and flags nothing.

**Not in this release:** Google→app edits for trips and trip items (only their deletion is detected); a scheduled weekly reconciliation; richer hidden metadata (trip/item ids, class) in Google (GIG-100 remainder); recurrence. A small hidden-state cost: records gain `gcalEtag`/`gcalSyncedHash` and sync to Supabase like any field. Review entries live in one small device-local key, `gat_gcal_conflicts`, and are pruned automatically when stale.

**Tested — in Node:** `pal-gcal.js` v2 against a stubbed `fetch`: unchanged behaviour with no options; meta-only still GET+PATCH with existing metadata preserved; `expectEtag` match adds no extra call; a mismatch sends **no** PATCH and returns the current event; an event without an etag is not blocked. App logic against the real functions with a stub Google: notes round trip through the real description builder (multi-line, empty, native, edited inside the block); icon stripping; a real outbound sync followed by the same event coming back gives "no change", a differing etag with identical content just re-baselines, a Google time edit applies without polluting title or notes, and both-changed is a conflict; review applies/baselines/records conflicts correctly across four gigs; deletion detection flags gone/cancelled gigs, trips and items, skips out-of-window and pending-delete records, treats a moved event as an edit, ignores a 500, and respects the cap of 10; push-time mismatch cases (conflict recorded and not re-queued, Google wins when the app was unchanged, stays pending with no data, no precondition without a baseline); every resolution (use Google, use app with Google's version number, remove with zero Google calls, re-create, unlink, trip and item unlink); imports carry a baseline; stale entries pruned; panel text. Inline scripts and `pal-gcal.js` pass `node --check`; the v7.93–v7.96 suites still pass.

**Not tested:** nothing ran against real Google or in a browser. Two Google behaviours are assumed, not observed: that event resources in list and patch responses include `etag`, and that fetching a deleted event returns 404/410 or `status: cancelled`. The review panel layout, the toast, and the first-pull baselining of your existing linked gigs are unconfirmed.

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
