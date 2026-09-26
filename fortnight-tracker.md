# Fortnight Tracker — Changelog

Full version history for `fortnight-tracker.html`. The app's own inline comment block keeps only the 15 most recent releases for quick reference during active work — everything else lives here. Wording is unchanged from the original inline entries. Resequenced strictly newest-to-oldest by version number, since the original inline order mixed an ascending run with a later descending run and wasn't actually chronological as written; no content was reworded.

## v3.50 (FT-044)

Sat/Sun weekend pickers now sit side by side instead of stacked — new .weekend-days grid wrapper (2 equal columns) around the same two .extra-row day rows from FT-043; only the layout changed, no data/id changes, so liveUpdateWeekend()/updWeekend() needed no updates.

## v3.49 (FT-043)

Weekend hours. Two new pickers per bundle — "Weekend before Week 1" (the Sat/Sun immediately before the bundle's own start date, e.g. bundle starting Mon 10th captures Sat 8th/Sun 9th) and "Weekend before Week 2" (the Sat/Sun that falls inside the bundle's own span, between week 1 Friday and week 2 Monday) — placed at the top of each week's day list on the Live tab, one row each for Sat/Sun, same H:MM select pickers as the existing daily "extra" field. Both weekends are stored on the bundle itself (weekend1/weekend2, each {satH,satM, sunH,sunM}) rather than as day entries, since neither Saturday nor Sunday has its own row in the 9-day cycle. Per Pete's steer, these hours are counted straight into the same totals bundleStats() already shows against the 70h target (both "Confirmed done" and "Projected"), not added as a separate on-top figure — bundleStats() now folds weekendMins() into doneMins/predMins unconditionally, since there's no "status" toggle for a weekend entry the way there is for a weekday: a number typed in is always real, not provisional. Deliberately NOT fed into the Timesheet tab's code-allocation totals or tsWeekTarget — Pete was explicit that reporting/timesheets don't relate to actual daily hours, so weekend hours are a Live-tab-only tally. Backwards compatible: migrateDays() backfills weekend1/weekend2 as zeroed objects on any bundle that doesn't have them (all pre-3.49 backups), so a legacy import behaves exactly as before until Pete fills the pickers in. Syncs for free — sbUpsert() already sends the whole bundle object, so the new fields ride along with no Supabase schema change needed.

## v3.48 (FT-042)

new bundle days now default to Pete's actual working pattern instead of the old placeholder (08:30 start, end derived from std+lunch). Every day now defaults to start 08:15; the 8 full days (both weeks minus the short Friday) default end 16:00 with 45m extra on top — 08:15-16:00 is 7h45m clock, minus the existing 30m lunch default is 7h15m, +45m extra = 8h, matching stdMins' existing 480min full-day target exactly. The short Friday (i===4, already the 6h/360min reduced day in stdMins) defaults end 14:45 with 0 extra — 08:15-14:45 is 6h30m clock, minus 30m lunch = 6h, matching stdMins' 360min exactly with no extra needed. Only affects buildDays() (new bundles going forward); existing bundles/days are untouched, every field remains individually editable per day as before, and the JSON backup schema is unchanged, so this is fully backwards compatible.

## v3.47 (FT-041)

Claim Tracker merged in as a new "Claims" tab — a separate app/file (claim-tracker.html, untouched), embedded via a lazy-loaded nested iframe rather than actually merged, same pattern as Horizon-in-On-Budget. Session (PAL_SESSION) and theme (PAL_THEME) are captured off this app's own incoming messages from the real launcher and relayed into the nested iframe once it's loaded (loadClaimsFrame/pingClaimsFrame) — Claim Tracker's own pal-sync.js listener picks them up identically regardless of which parent frame actually sent them, no changes needed on its side. Unlike Horizon (single dark theme, no relay needed), Claim Tracker has its own light/dark toggle, so PAL_THEME is relayed too, not just PAL_SESSION. The launcher's Claim Tracker dashcard is DELIBERATELY KEPT (unlike Horizon's, which was removed) — it's repointed to open this app and land straight on the Claims tab via a new FT_ACTION postMessage (launcher's launchFortnightClaims(), handled in the message listener below). Claim Tracker's own nav icon and top-bar entry point are removed from the launcher; its standalone iframe, backup entry, and PAL_NAV_SLUG_MAP registration there are all deliberately unchanged — "Download backup" from the launcher's Sync & Backup drawer still works exactly as before. Also: the top-row "＋ Bundle" tab-nav button removed (duplicated the Live tab's own inline add-bundle button), freeing a slot for the new Claims tab without crowding the row further.

## v3.45 (FT-040)

new Capex tracker card at the top of the Timesheet tab. Codes with code '0001' count as opex, any other code counts as capex (a code with no value set defaults to opex rather than silently counting as capex). One editable target % (a new global setting, _store.data.settings.capexTargetPct — not per-bundle, not per-year), tracked against two live scopes at once per Pete's call: the bundle currently open, and the tax year to date (own prev/next nav, separate from the Leave tab's year — defaults to the current tax year). Includes draft/unsubmitted allocations as they're typed, not just submitted weeks, so it moves live as the timesheet is built up. Pre-3.45 backups get an empty settings object on load (no target set, cards show "Set a target to track" until Pete enters one).

## v3.44 (FT-039)

the Holiday allowance card's remaining/over hours line now shows a days-equivalent line underneath it too, matching the convention already used for the Holiday/Sick totals above it (hrs/8). Sick has no allowance so this only applies to the Holiday card.

## v3.43

saveLocal() now posts FT_DATA_UPDATED to window.parent after every localStorage write. The launcher listens and calls refreshCardStats() so the Fortnight card updates immediately when a day is logged or a bundle changes, matching the Gym Tracker's GYM_DATA_UPDATED pattern. Silently ignored when run outside the launcher.

## v3.42 (FT-039)

viewport meta was missing maximum-scale=1.0 and user-scalable=no. On iOS a double-tap on a label or button zoomed the page — especially jarring in the dense Timesheet matrix. Now matches the suite-standard viewport declaration used by every other app.

## v3.41 (FT-038)

new holiday hours allowance, editable directly in the Holiday card on the Leave tab — one figure per tax year (deterministic record id, same fixed-id convergence pattern as SEED_CODES/bank holidays). Once set, the card shows hours remaining (allowance minus hours already booked as Holiday for that year — Sick doesn't count against it), in red if you've gone over. Clearing the field removes the allowance for that year rather than treating it as zero, so "not set" and "0h allowance" stay distinguishable. Synced via the same fortnight_bundles table (la_ prefix), same pattern as codes/leave/bank holidays.

## v3.40 (FT-037)

multi-day leave date pickers. The End date field used to sit on whatever it was last set to (usually today, from the modal's defaults) regardless of what Start was changed to, so opening End's native picker later showed the wrong month entirely — native date inputs open centred on their current value, there's no other way to steer them. Start's onchange now keeps End following Start (End is set to match) as long as End hasn't been deliberately set to something of its own, or would now sit before the new Start; once you pick an End yourself it stays put even if you go back and adjust Start again.

## v3.39 (FT-035, FT-036)

FT-036 — deleting a manual leave record left any bundle day it had auto-filled (FT-033/FT-034) stuck marked Holiday/Sick, which then kept showing as a Leave tab line sourced from the bundle even though the underlying record was gone. Every auto-fill now tags the day with which leave record filled it and remembers its pre-fill end/lunch; deleting that record reverts the day cleanly (status, hours, allocation, and clock times all restored), and editing a record now reverts its old fill first before re-applying at the (possibly new) date/hours, so an edit can't leave a stale fill behind either. FT-035 — the single-day Add/Edit Leave modal now shows what Pete's fortnight pattern says that date should be (e.g. "Normally 8h this day", or "Normally: Weekend (not a working day)"), using the same pattern logic as the multi-day preview; for a new record it also defaults the hour selects to that value, same convenience as multi-day rows, while editing an existing record just shows the hint.

## v3.38 (FT-034)

FT-033's auto-fill only fired at bundle-creation time, so adding (or editing) a manual leave record for a date inside a bundle that already existed never reached that bundle's day. Adding a manual leave record — single day, an edit, or each day in a multi-day batch — now also checks every existing bundle for a day matching that date and folds it in the same way (status/hours set, clock zeroed via start=end), as long as the day isn't already marked. Each affected bundle is saved individually so the sync fires per bundle. Toast now reports both the record(s) added and how many bundle days were updated.

## v3.37 (FT-032, FT-033)

FT-032 — Leave tab records are now grouped by month, collapsed by default with an instance counter on each header (e.g. "July 2026 — 3 instances"), using the same collapse/chevron convention as the Timesheet's week groups. FT-033 — creating a new bundle now checks its date range against existing manual leave records and folds any matches straight in: the bundle day's status/hours are set from the record, and its own clocked time is zeroed via the time clock (start=end, no lunch) so the day's credited hours come entirely from holidayMins — exactly as if it had been marked absent by hand. Covers a future holiday booked ahead of the bundle that will eventually cover it. The manual record itself is left untouched; the existing dedupe (FT-027/FT-029) already collapses the pair into one Leave line.

## v3.36 (FT-029, FT-030)

more Leave tab fixes/improvements. FT-029 — duplicates could still slip through when an archived (or any legacy) bundle day stored its date in a slightly different string form than newer records (missing zero-padding, a stray time suffix) — the dedupe in FT-027 keyed on the raw string, so two representations of the same calendar day didn't match. Every date now passes through normDate() first, which canonicalises to plain YYYY-MM-DD before comparison or keying. FT-030 — multi-day leave is now pattern-aware: adding a range shows a live day-by-day preview, defaulting each day's hours to Pete's actual fortnight pattern (8h, 6h for the short Friday of week 1), with weekends, the fortnight's built-in Friday off, and any *observed* bank holiday pre-excluded and greyed out — every included day stays individually editable before saving. New Bank Holidays list (own modal, reached from the Leave tab): seeded with the official England & Wales dates for 2025-2027, all off by default since SW doesn't take every one — toggle on whichever your employer actually gives, or add custom dates. Bank holidays sync via the same fortnight_bundles table (bh_ prefix), same pattern as codes/leave.

## v3.35 (FT-027, FT-028)

two Leave tab fixes/improvements from first real use. FT-027 — a date could show as two separate Holiday/Sick lines (e.g. a bundle-marked day with 0h alongside a manual record for the same date with real hours logged against it). leaveEntriesForYear now dedupes by date+type across both sources, keeping whichever entry carries the most hours (ties favour the manual record, as the more deliberate edit) — same real-world absence, one line. FT-028 — Add Leave Record now offers Single day vs Multiple days. Multiple days takes a from/to range and creates one independent record per weekday in it (weekends skipped, 60-day cap), each with the same hours/type/note; every created record is a normal standalone entry afterwards, editable/deletable on its own like any single-day one. Multi mode is only offered when adding — editing always targets one existing record.

## v3.34 (FT-026)

new Leave tab. Tracks Holiday/Sick hours (and a days-equivalent at 8h/day) over a UK tax year (1 Apr – 31 Mar), with forward/back year navigation. Totals combine two sources: Holiday/Sick days already marked inside fortnight bundles (read live off state.bundles — never copied), plus new standalone manual records (date + hours + type + optional note) added directly in this tab for leave that isn't tied to a specific bundle day. Manual records are a new array (_store.data.leave), synced via the same fortnight_bundles table using a 'leave_' record_key prefix — identical pattern to FT-020's codes ('code_' prefix), so bundles/codes/leave rows can never collide in the merge. Soft-delete only, matching every other data type in this app. Old JSON backups (no data.leave array) load fine — load() defaults it to [].

## v3.33 (FT-030, suite-wide sync audit / pal-sync.js v1.11)

deleteBundle() used to splice the bundle out of state.bundles immediately, before its tombstone even reached the cloud — a fire-and-forget push with no local record of the attempted delete surviving if that push failed for any reason (network blip, 401, offline). pal-sync.js v1.11 fixed the deeper bug this exposed (an unconfirmed tombstone permanently forgotten after one pull cycle, root-caused via On Budget ON--049/ON--050), but that fix only protects apps that actually keep a soft-delete marker locally for it to act on — this app never did. deleteBundle() now marks _deleted:true and keeps the bundle in state.bundles (soft delete, matching On Budget/Gym Tracker's existing pattern) instead of removing it outright. Every render/selection/lookup path that reads state.bundles now goes through the new visibleBundles() helper instead, so a tombstoned bundle pending cloud confirmation never appears in the UI: the three render() lists, tsBundle()'s active-scan and fallback, tsNavPrev()/tsNavNext() (rewritten to walk the visible list rather than raw array positions, since a tombstone can now sit between two visible bundles), openDataModal()'s stats, and the new-bundle date picker's "already exists"/latest-bundle logic in openModal() and createBundle(). idx/bi values passed around the app still always resolve to a raw state.bundles position via indexOf() on a bundle found through visibleBundles(), so nothing downstream needed to change. Bonus: since a soft-delete no longer shifts array positions the way splice() did, this is also safer for any other bi reference held mid-render-cycle.

## v3.32 (FT-026, suite-wide sync audit)

importData() (restore from backup) used to forge a brand-new updatedAt on every imported bundle regardless of the backup file's own timestamp, then blind-push every one straight to the cloud with no comparison against what was actually there. Together, this meant a stale backup could look artificially newer than genuinely newer cloud data and silently overwrite it — the same defect found and fixed in Meal Planner (MP-045), Reading Tracker (MR-011), and On Budget (ON--049). Now preserves the backup's own updatedAt where present (only stamping a fresh one if genuinely missing), and pulls-and-merges with the cloud before pushing — same fix already applied to manualPush (FT-002).

## v3.31 (FT-024)

Header total now live-updates on cell change. Added mx-whdr-{w} id to header span; tsMxRefreshTotals now patches it. New emoji format: 🎯 38h ✅ 7h ⏳ 31h (done/target/remaining). Added fmtHrs() and wkHdrHtml() helpers.

## v3.30 (FT-023)

Fix totals not updating — tsMxUpdCell passed undefined b to tsMxRefreshTotals (ReferenceError, line 1274 in v3.29). Replaced number input with select (0-10h in 0.5h steps via tsMxSelHtml helper). Submitted weeks: selects disabled, rem btn/add controls hidden, hint shown.

## v3.29 (FT-022)

Matrix input replaces day-accordion on Timesheet tab.

## v3.28 (FT-021)

Collapsible week cards on Timesheet tab

## v3.27 (FT-020)

Fix Prev/Next nav direction on Timesheet tab

## v3.26 (FT-019)

Timesheet nav, totals row, week submit toggle

## v3.25 (FT-018)

PDF report now includes a Week Total footer row — per-day column sums plus grand total — styled with a bold top border.

## v3.24 (FT-017)

Fix PDF export producing blank pages — switched print CSS from visibility:hidden (preserves layout height → blank pages) to display:none on all non-print elements, position:static on print area, and html/body height reset so browser paginates only actual content.

## v3.23 (FT-025)

PDF export for a week's timesheet report, via the browser's native print-to-PDF rather than a JS PDF library — no new dependency, works fully offline, matches the suite's single-file philosophy. A PDF button next to Copy renders the week's report (title, bundle label, total, the same code/day/total grid) into a hidden #ts-print-area with forced light/print-friendly styling (the app's dark theme would otherwise print as a solid dark block), then calls window.print(). The print stylesheet hides everything else via the visibility:hidden-then-visible-on-target trick, so nothing is removed from the DOM and the on-screen app is completely unaffected. On iPhone this surfaces the standard Share icon in the print preview — Save to Files, Mail, Messages or AirDrop all work from there, covering "save and send to myself" with no extra code. ── SUPABASE CONFIG ──────────────────────────────────────────────────────────

## v3.22 (FT-024)

fixes a partial-day-absence bug in dayTarget. A half day holiday/sick recorded a target of just the absence amount (e.g. 3:00), so logging the other half of the day as actual work (another 3:00) pushed the day to "6:00 / 3:00" and flagged it red — wrong, since 6:00 IS the day's correct full length on a normal Friday. dayTarget now always returns the day's own standard length (stdMins) regardless of status, full stop, matching the "don't adjust the target, only highlight" rule already applied at the week level (v3.20) — holiday/sick time counts toward filling the day's target exactly like any other code, whether the absence was full or partial. A full-day absence was never affected by this bug (holidayMins already equalled stdMins in that case); only partial days were wrong.

## v3.21 (FT-023)

restores the per-day target, colour coding and remainder-based code population Pete missed after v3.19's removal — but WITHOUT reintroducing the old requirement that a day be marked Done/Conference/Training for its target to exist. dayTarget(d,i) is now unconditional: every working day's target is its own standard length (stdMins — 8h normally, 6h the short Friday), falling back to the recorded absence amount (full or partial) on a Holiday/Sick day. Day rows show "logged / target" again with the familiar green/amber/red states, and the code picker pre-fills a new row with whatever the day still owes (dayTarget minus what's already allocated) — so the first code on an 8-hour day gets 8:00, and if that's edited down to 4:00, the next code added picks up the remaining 4:00 automatically. The flat week target (v3.20) and the absence Full day/Partial badge (v3.20) are unchanged and sit alongside this. The tab badge reverts to counting unreconciled DAYS (matching the restored day-level target) rather than weeks.

## v3.20 (FT-022)

reverted the v3.19 target reduction, at Pete's follow-up request — the week target is back to a flat, unconditional 38:00 (week 1) / 32:00 (week 2), with holiday/sick time counting toward it exactly as any other allocation (matching the pre-v3.19 mental model: leave fills the target rather than shrinking it, since no extra hours are worked elsewhere to compensate). weekAbsenceMins and weekAdjustedTarget removed; weekWorkAllocated reverted to a plain weekAllocated summing every allocation with no leave-code exclusion. In their place: a small highlight badge on any Holiday/Sick day showing "Full day" or "Partial H:MM" (comparing the day's recorded holidayMins — already full/partial-aware — against that day's standard hours), so the fact of the absence is visible without touching the week total at all.

## v3.19 (FT-021)

simplified week-target model, at Pete's request. Removed dayExpectedMins and every per-day "expected" derived from generic status categories (done/conference/training via stdMins) — that machinery meant a day only "counted" once marked with a particular status, which was more coupling to the bundle than needed. Replaced with a single rule: each week's target is the fixed 38:00 (week 1) / 32:00 (week 2), reduced ONLY by recorded holiday or sickness time that week (weekAbsenceMins, reading d.holidayMins — already partial-day-aware, since that field is hours-and-minutes editable on the Live tab, not just a full/none toggle). Nothing else is read from bundle day status for the calculation. The auto-Leave allocation (holiday/sick time auto-assigned to the flagged code, added in v3.17/v3.18) is unchanged and still appears in the report — but since its minutes are exactly what the reduced target already accounts for, it's excluded from the week reconciliation sum (weekWorkAllocated) so it isn't subtracted twice. Day rows now show allocated time only, with no per-day expected/colour comparison — only the week level has a target. The Timesheet tab badge counts weeks (0-2) in the shown bundle whose work allocation doesn't yet match the reduced target. Marking Done/Conference/Training still jumps to the Timesheet tab (pure navigation, not a calculation) — flagged in the release notes in case that's also unwanted.

## v3.18 (FT-016)

timesheet refinements from first real use. (1) Hour / minute free-type inputs replaced with select pickers — hours 0-10, minutes in 5-minute steps (an off-grid stored value gets its own option rather than being silently snapped). (2) Absence backfill: the v3.17 auto-allocation only fired on the Holiday/Sick TOGGLE, so any day already marked absent before deploy never got its Leave & Sickness row and the code was missing from reports. migrateDays now backfills an empty-alloc absence day with the flagged auto code — idempotent, deterministic on every device, and applies to archived bundles too so historical reports become correct. (3) "Copy previous day" in the day editor duplicates the nearest earlier day's codes (skipping codes already present, keeping their minutes for a like-for-like day and adjustable after). (4) The weekly report is now a per-day grid — codes down the left, Mon-Fri (or Mon-Thu) columns, per-day decimal hours and a Total column; Copy exports the same grid as TSV including the day columns.

## v3.17 (FT-020)

Timesheet tab. A third tab holding: per-week code allocation against the contractual targets (38:00 week 1, 32:00 week 2, derived from stdMins so they stay in step), day-level allocation editing with a searchable code picker, a per-week timesheet report (Description / Project / Task / Code / Hours decimal + h:mm) with copy-as-TSV, and a code library (add / edit / archive — archived codes leave pickers but stay resolvable in history). Codes seeded from Pete's Timesheetcodes doc on first run with FIXED ids so two devices seeding before first sync converge instead of duplicating. Sync: codes are code_-prefixed rows in the SAME fortnight_bundles table; safe beside the prefixless bundle pull because pal-sync's merge skips rows lacking the merge idField (codes have no startDate) — codes must never gain a startDate field. Pull fetches the table once and feeds both merges (Test & Issues' preFetchedRows pattern). Allocations live inside day objects ({codeId, mins}) so they ride bundle sync untouched. Workflow: marking a day Done / Conference / Training jumps to the Timesheet tab with that day's editor open; Holiday / Sick days auto-allocate their entered minutes to the code flagged auto-holiday / auto-sick (one code per flag, editable), and the auto allocation tracks later edits to the absence minutes — manual splits are never clobbered by any auto path. Fully backwards compatible: pre-3.17 backups and bundles migrate (alloc:[] added, codes normalised to []), and a day without allocations behaves exactly as v3.16.

## v3.9 (FT-003)

migrated to the shared pal-sync.js. Two changes worth flagging clearly: (1) The real Supabase table used `bundle_start` as its lookup column, not `record_key` like every other migrated app. pal-sync.js hardcodes `record_key` — rather than teach the library a second column-name convention for one app, the column was renamed (same data, same column, just renamed to match everyone else): ALTER TABLE fortnight_bundles RENAME COLUMN bundle_start TO record_key; This is a pure rename, no data reshaping, but it IS a required prerequisite — this file won't sync correctly against the old column name. (2) Bundles never carried their own updatedAt — pullFromCloud used to be cloud-authoritative-full-replace (see the FT-002 note below), which never needed per-record comparison. The canonical merge does, so save() (the one funnel every mutation already goes through) now stamps bundle.updatedAt before pushing.

## v3.8 (FT-002)

replaced hard DELETE on bundle removal with a tombstone soft-delete (data._deleted:true via the normal upsert path), matching the reference pattern used by Claim Tracker / Gym Tracker / Test & Issues. pullFromCloud filters tombstoned rows out of the working set. Manual Push now pulls before pushing, so it can't resurrect a bundle deleted on another device this one hasn't caught up with yet. Also added the version number to <title> — it was missing entirely.

## v3.6 (FT-001)

the Live/Archive tab-nav bar is a separate sibling element to header and main, and got missed in v3.5 — it kept its original left-aligned padding while everything around it centered, so the tabs no longer lined up with the content's left edge. Now centers the same way. Additive only.

## v3.5

header content now centers within that same 900px zone on desktop (header background still spans full width). Additive only.

## v3.4

added a desktop breakpoint (900px+) that widens main from 600px to 900px max-width. Additive only — nothing below 900px changed.

## v3.3

added a light theme (suite-wide toggle rollout). Theme is controlled by the launcher and pushed down via a PAL_THEME postMessage, same handshake as PAL_SESSION — no toggle inside this app itself. Purely visual, no data model or storage format changes.

## v3.2

security fix — the PAL_SESSION message listener accepted a session handoff from ANY origin (no e.origin check), unlike every other app in the suite. Added the origin guard. Also removed the anon-key fallback in the Authorization header (dead code in practice since every caller already checks _sbToken first, but a future caller skipping that guard would have silently sent requests as the anon role instead of failing).
