# On Budget — Changelog

Full version history for `on-budget.html`. The app's own inline comment block keeps only the detailed, recent-era releases (v3.44 onward) for quick reference during active work — everything from v1.0 through v3.43 lives here instead. Wording is unchanged from the original inline entries; only the line-wrapping is reflowed. Note: v1.0–v2.8 were never logged as individual entries in the source file — only this one combined summary paragraph — so that's reproduced as-is rather than split up.

## v1.0–v2.8 (combined summary)

Backwards compatible with v1.0–v3.3 JSON backups. v1.9 added a Bills account. v2.0 added till-style penny entry and forecast modes. v2.1 merged Bills into one chronological list with a filter. v2.2 added a backup-reminder banner; v2.3 gave it a real per-account breakdown. v2.4 fixed banner scroll visibility and added row-level delete. v2.5 added Supabase cloud sync with tombstone deletes. v2.6 fixed pull not refreshing the Settings tab UI. v2.7 fixed Food & Travel spends not syncing on add. v2.8: simplified the Food & Travel spend categories from three (Food/Travel/Other) to two (Weekly Budget/Other) — Weekly Budget behaves exactly like Food did (counts against the £/week reserve), Other absorbs both old Travel and old Other (comes off the balance, never touches the weekly reserve). migrateCategories() maps old data forward (food→weekly, travel→other) on load, import, and cloud pull, so historical spending totals stay correct either way.

## v2.9

added a dark theme (pilot for the suite-wide light/dark toggle). Theme is controlled by the launcher and pushed down via a PAL_THEME postMessage — no UI toggle inside this app itself. Falls back to a locally cached preference (ob_theme_pref) if opened before the launcher's message arrives, so there's no flash of the wrong theme. Purely visual — no data model or storage format changes.

## v3.0

added a desktop breakpoint (900px+) that widens the main panel from 540px to 900px max-width. Additive only — nothing below 900px changed, so the iPhone/mobile experience is untouched.

## v3.1

header and tab-bar content now centers within that same 900px zone on desktop (their backgrounds still span full width — only the content, e.g. logo/badge/tabs, is centered). Additive only.

## v3.2

audited every Bills balance mutation (create/clear/delete/reconcile) line by line, added a visible audit trail (delta + result logged to Cloud Sync log, toasts show resulting balance).

## v3.3

that audit trail immediately paid off — found the actual root cause of ON--002. saveBtx() (Bills "Add transaction" for a cleared ad-hoc entry) mutated clearedBalance locally but never stamped bills.settings.updated_at and never called syncUpsertBillsSettings(). The transaction record synced fine; the balance change never left the originating device, and a later pull on that same device saw the still-stale cloud copy as "not older" (its own change had no newer timestamp to compare against) and silently reapplied it — exactly the add→sync→revert sequence reported. Fixed by adding the missing timestamp + push, matching the other three mutation sites which were already correct. Reproduced the exact bug in a standalone harness against the old code, then confirmed the fix resolves it, before shipping. Existing drifted balances aren't auto-corrected (the transactions themselves were always fine, just the cached balance number) — do one manual reconcile in Settings after updating.

## v3.4

added editing of uncleared Bills transactions (ON--003). For an ad-hoc planned entry, edits the tx record directly. For a recurring occurrence, edits NEVER touch the recurring template — they create a small per-occurrence override (bills.overrides[], keyed to that one scheduled date) that's applied only when generating that specific occurrence for display. Deleted once the occurrence is cleared or skipped, since the real tx record becomes authoritative at that point. Fully backed by its own sync record type (billsoverride_*) with the same tombstone pattern as everything else. Neither edit path touches clearedBalance, since neither has affected it yet.

## v3.5

fixed ON--004 — billsForecastData()/nextDueRaw() generated recurring occurrences starting from "today", so an occurrence that went unresolved past its own due date simply stopped being generated at all and silently vanished from Upcoming. Both now generate from the recurring item's own anchor date instead, so an overdue-and-unresolved occurrence keeps showing (flagged with an Overdue badge and a left-edge highlight) for as long as it stays unresolved — only clearing, skipping, or deleting it removes it. No performance concern: tested a 3-year-old weekly item, generation completed in ~1ms.

## v3.6

added per-day figures to Weekly Budget and Headroom, counting today as one of the remaining days (e.g. 3 days left = today, tomorrow, day after). Weekly Budget: remaining budget ÷ days left in the current week. Headroom: headroom ÷ days until pay-in. Both handle the over-budget/negative case (shown as "over"/"short") and are simply omitted when there are 0 or fewer days left, rather than dividing by zero.

## v3.7

added income transactions to Food & Travel (ON--015). The Add sheet now has an Income/Outgoing toggle — Weekly Budget/Other category only applies to outgoing (income never draws against the weekly reserve, so there's nothing to categorise). Pot remaining now nets income in (startBalance + income − outgoing); the pot progress bar still tracks outgoing spend against the original starting balance only, so it stays meaningful even when income boosts the pot above 100%. Old transactions (all implicitly outgoing) are migrated with a backfilled type:'outgoing' on load/import/pull, so pot calculations on existing data are unaffected by this change.

## v3.8

added a self-building quick-pick shop list (ON--016) for faster Food & Travel entry. Picking a chip fills the label instantly; typing a new one and saving adds it automatically — no separate "add to list" step. New ftLabels{items,updated_at} synced via its own record (__ft_labels__), but merged as a UNION on pull rather than last-write-wins — two devices can legitimately add different shops between syncs, and a whole-blob replace would silently drop whichever one didn't sync last. Settings has a prune-only management list (the list builds itself; Settings is just for removing unwanted entries).

## v3.9

fixed ON--017 — headroom, the over-budget weekly figure, and both per-day figures used Math.abs() to format the number, which silently dropped the minus sign and relied on colour alone to show a negative. All four now show a real "-" when negative, on top of (not instead of) the existing colour coding. Audited every other currency display in the app (pot, Bills cleared balance, lowest projected, running balance) — none of those use Math.abs, so they already showed negative signs correctly via native toFixed/toLocaleString and needed no change.

## v3.10

reintroduced Travel as its own category with its own monthly budget (ON--018) — Food/Travel/Other, back from the two-category Weekly/Other model. New setting monthlyTravel (default £150). Food's reserve is still the sum of remaining weekly budgets; Travel's is a single monthly budget − spend-so-far-this-month (no per-week split). Headroom = pot − (food reserve + travel reserve); Other has no budget and never affects headroom, same as before. Dashboard gained a Travel stat card (mirroring Food's) and the headroom breakdown shows both reserves plus a combined total. IMPORTANT LIMITATION: v2.8 had folded old Travel transactions into Other, and that merge can't be undone — there's no way to tell which historical Other entries were originally Travel. This only affects data from before that merge; everything from here forward tracks Travel correctly and separately. migrateCategories() was also fixed here — it was unconditionally rewriting 'travel' to 'other' on every load/import/pull, which would have silently destroyed every new Travel entry the moment this shipped; only the old 'food' key is migrated now.

## v3.11

dashboard redesign (ON--019). Pot remaining and Headroom now share a row (compact 2-col) instead of each being full-width, to make room for: Food is now full-width and shows a bar for EVERY week of the month, not just this one — past/current weeks green (within budget) or red (over, capped at 100% width), future weeks empty with the budget target as the label rather than "£0 spent" (getWeeks already pro-rates partial weeks correctly, reused as-is). Travel + Other now share a row. Settings gained a live "next month's projected headroom" preview under the Budget fields — recalculates from whatever's currently typed (even unsaved) using the same week/pro-ration logic via a new projectNextMonthHeadroom(), so a partial first/final week in next month's cycle is still costed by daily rate, not assumed to be a full week. getWeeks() gained an optional weeklyFood override parameter so this preview never has to mutate global settings to compute with unsaved form values.

## v3.12

ON--020/021/022. Food & Travel transactions can now be edited post-entry — tap any row to reopen the same sheet prefilled, change value/category/type/label/date, Save changes or Delete. Edits happen in place (id preserved) since the pot is always derived fresh from the live transaction list, never a stored counter, so there's no balance-reversal step needed the way Bills needs one. Known limit: editing a date to fall outside the current pay-cycle doesn't move the transaction to a different month's bucket — totals stay correct, but it may not show in that cycle's weekly bars. Weekly food bars now show £spent/£target for every week, not just one figure, so future weeks read as "£0.00/£125.00" instead of just the target alone. Settings' next-month projection now spells out full vs partial weeks explicitly (e.g. "3 full weeks (£125 each) + 1 partial week (3 days, £53.57)") instead of just a week count, so the day-rate maths behind a partial week is visible, not just its result.

## v3.13

added a "By tag" breakdown to the Other card (ON--023) — Other transactions this month grouped by label (case-insensitively, so "Amazon"/"amazon" combine), sorted by total descending, unlabelled entries bucketed together rather than lost. Collapsible, matching the existing headroom breakdown pattern. Also increased the shared breakdown-body max-height from 300px to 400px and made it scrollable, so a month with many distinct Other tags doesn't get silently clipped.

## v3.15

fixed the header logo badge showing v3.13 while the title bar, JS header, and save/export envelope all said v3.14 — version drift across the file. Also added lastExported to the save/export envelope (was missing; every other app in the suite tracks it) using the existing meta.lastBackupAt as the source of truth.

## v3.16

migrated to the shared pal-sync.js (now v1.4). Now loads pal-config.js instead of hardcoding SB_URL/SB_ANON. Settings/bills settings singletons and the shop list's union merge stay hand-rolled exactly as before — neither fits pal-sync's generic per-record model. Months, transactions, recurring bills, bills transactions, and occurrence overrides now go through pal-sync's table() instances, one per record_key prefix, sharing a single fetch via PalSync.fetchTableRows() instead of doing 7 near-identical GETs.

## v3.17 (ON--024)

syncPull() had no re-entrancy guard. The v3.16 migration replaced one atomic pass with 6 sequential awaited .pull() calls, which widened the window for a second PAL_SESSION (an initial broadcast plus a near-immediate refresh, or a re-send on tab focus) to trigger an overlapping syncPull() before the first had finished — both racing to upsert the same records, one of them hitting a duplicate-key conflict and surfacing as an immediate sync error. Added a _syncInFlight guard shared by syncPull/syncPush, matching the pattern Test & Issues already uses (_syncLock).

## v3.19 (ON--031)

On Budget had no handling at all for a push failing because the session token expired mid-use (401) — just logged and dropped, relying on the next full pull to notice the local record is newer and push it again. Gym Tracker was the only app with any protection here; that pattern is now built into pal-sync.js itself (v1.8) so every app gets it automatically. table().upsert() queues a 401 internally and pal-sync flushes it the next time a fresh session arrives — no code changes needed here beyond wiring onRetryFlushed into initSession() to log the outcome, and reading window.PalSync.retryQueueLength() in setSyncState() to show "N pending sync" instead of a bare error while a retry is queued. Every sync error log message now also runs through the shared PalSync.errorHint() instead of a bare err.message, matching the wording every other migrated app now uses.

## v3.18 (ON--025)

the shop list moves from one blob with a union merge to individual per-record entries (id = lowercased name), going through pal-sync's table() pattern like everything else in this app. The union merge could only ever add — a delete on one device never propagated to another that still had the name locally, and could even get silently resurrected by that device's next push. Tradeoff: count/lastUsed used to merge as max(both values); now it's whichever device wrote most recently, same as every other collection. Existing local items are migrated in place (id/updated_at backfilled) and the old __ft_labels__ blob is tombstoned once it's no longer needed.

## v3.20 (ON--025)

per-day figures (Weekly Budget and Headroom) now count only the days AFTER today, not today itself. Agreed with Pete first — the app has no time-of-day awareness, so counting today made the figure ambiguous (generous if checked before spending, stale if checked after, which is his actual habit). Excluding today gives one stable meaning: "budget per day for the days I haven't decided on yet." Labels now say "(after today)" to make this explicit. On the last day of a period this means 0 days remain after today, so the figure disappears that day rather than showing 0 — same guard as before, now triggered a day earlier.

## v3.25

reverted the ON--026/027/028 "keep Pot/Headroom/Cleared balance pinned in view" work (v3.22 sticky attempt, v3.23 sticky retry, v3.24 fixed-position rebuild) — none of it was confirmed working correctly on-device, and v3.24's fixed-position approach introduced enough structural change (separate DOM elements outside the panels, measured spacer syncing) that Pete asked to just revert to the known-good v3.21 rather than keep debugging blind. Version numbers 3.22–3.24 are retired/superseded, not reused. Everything else from v3.21 (Bills sync/tombstones, income transactions, edit-in-place, Other-by-tag breakdown, per-day figures excluding today, etc.) is unchanged and intact.

## v3.26 (ON--029)

added Scenario planning to Bills — a 3rd subtab alongside Ledger/Recurring. A scenario starts as a snapshot of the real recurring set (bills.recurring), never a live link — editing, removing, or adding items in a scenario can never touch the real recurring items, verified directly. Frequencies normalise to a £/month equivalent (52/12 weeks-per-month average, not a flat ×4) so weekly/custom/monthly/yearly items compare on one footing. Shows As-is vs Scenario vs Delta for income/outgoing/net. Scenarios can be named and saved (bills.scenarios[], synced per-record like everything else via a new billsscenario_ prefix table), reloaded as an independent copy (editing a loaded scenario never mutates the saved version until Save is tapped again), deleted (soft-delete + sync tombstone), or reset back to the as-is snapshot. Export PDF opens a print-formatted view and triggers window.print() — deliberately not a bundled PDF library, to keep the app dependency-free; "Save as PDF" is one tap away in the browser's own print dialog on iOS/Android/desktop alike.

## v3.27 (ON--030/031)

found and fixed a real bug while addressing the feedback — delta cells used bare class="ok"/"warn", but those only exist scoped to .stat-card-sub/.log-entry, so the green/red colouring never actually rendered despite the code looking right. Replaced with deltaColor()/netImpact() returning real colour values directly. Added: a note field per scenario (what/why, shown in-app and in the saved-scenarios list as a snippet); an "Overall change" callout card, colour-matched to whether the scenario is net better or worse; a "What changed" itemized section (diffScenario(), matched by baseId) showing exactly which items were added/removed/modified and each one's signed monthly impact — omits anything unchanged, since the point is explaining differences, not restating everything. PDF export rewritten to match: app-branded header, a colour-filled overall-change banner, an explicit Delta row (previously missing entirely — Pete's report), the note, and the same itemized changes section, all using the app's actual brand hex values (hardcoded, since a standalone print window can't see the page's CSS variables).

## v3.28 (ON--032)

moved from one overall scenario note to a note per individual change, shown right next to that item's name in "What changed" (in-app and PDF) rather than collected in one place — "why did I add/remove/change THIS one" is a different question for every line. Added a note field to the scenario item sheet; also shown as a preview on the item's own card. Closed a real gap this surfaced: there was no way to explain a REMOVAL, since deleting an item took its note field with it. deleteScenarioItem() now captures whatever's in the note field at the moment of removal into a small _scenarioDraft.removedNotes map keyed by the real recurring item's id, which "What changed" looks up for removed lines — carried through save/load/reset like everything else. The overall scenario-level note from v3.27 is unchanged and still there for describing the scenario as a whole.

## v3.29 (ON--033)

removed the overall scenario note entirely — now that every change has its own note (v3.28), the one-at-the-top field was redundant. Removed the textarea from the Scenario tab, its snippet from the saved-scenarios list, its box from the PDF export, and all read/write of it in save/load/new/reset. Per-change notes and removal notes (both v3.28) are untouched.

## v3.30 (ON--034)

Savings & Goals — a new top-level tab. Each goal has a name and an optional target amount + target date; balance is derived fresh from that goal's own transactions every time, never a stored counter (the ON-002 clearedBalance lesson applied from the start, so there's nothing to keep in sync by hand). When both a target and a date are set, £/month needed is computed from actual days remaining ÷ average days-per-month (365.25/12), the same day-rate precision principle used for pro-rated weeks elsewhere, so it updates smoothly as today advances or a transaction changes the balance, rather than jumping in coarse monthly steps. Goals/transactions are separate synced collections (savingsgoal_/savingstx_ prefixes), mirroring the proven bills.recurring/bills.tx split. Deleting a goal cascades tombstones to all its transactions. Verified goalBalance()/goalMonthlyRequired() directly against every state (no target, target met, target with no date, normal, and target date passed) before shipping. Also found and fixed a real bug in the progress bar colouring during review: it showed green under 50% progress but amber between 50-80%, backwards for a savings goal where more progress is always better and there's no "danger zone" — simplified to always show the positive colour.

## v3.31 (ON--035)

the Scenario "Overall change" card now shows three explicit sections — Income / Outgoing / Net — each with its own colour-coded value, instead of just the one net figure. Outgoing keeps the same sign convention as the totals table above it (less outgoing = a positive change, shown green). PDF export's overall banner gets the same three-way breakdown, in white text on the existing solid colour background (green/red text on top of an already-coloured banner would fight for contrast).

## v3.32 (ON--036)

fixed Outgoing showing what looked like the same figure as Net. The colour rule was already correct — the VALUE was wrong: it displayed -deltaOutgoing (sign-flipped to match the colour convention) instead of deltaOutgoing itself, so whenever income didn't change, Outgoing's number was mathematically identical to Net's. Fixed by decoupling value from colour: Outgoing now shows its own actual change (e.g. "-£200.00" when outgoing decreased), while the colour still follows net-impact (green when outgoing decreased, red when it increased) — same fix applied to the totals table's Delta row and the PDF export's equivalents.

## v3.33 (ON--037)

fixed real data loss — a Food & Travel transaction created and closed before its push finished could be silently dropped on the next pull. Root cause, found by reading pal-sync.js (v1.4) directly rather than guessing: Food & Travel transactions never carried their own monthKey field — saveSpend() only relied on which months[mk] array held them. syncUpsertTx() knew to stamp monthKey onto the pushed data by hand, but pal-sync's pull() ALSO auto-pushes any local-only record it finds (exactly the case when the original push never reached the cloud) via upsert(r.id, r) using only the record's own fields — no way for it to know which month array the record came from. The pushed row ended up with no monthKey, and syncPull()'s own rebuild step (`if (!mk) return`) silently discarded it. Reproduced the exact sequence against the real pal-sync.js with a mock Supabase layer before and after the fix to confirm both the failure and the recovery. Fixed three ways: (1) saveSpend() now stamps monthKey on every transaction at creation, so any push path — explicit or pal-sync's own fallback — carries it; (2) syncPull() backfills monthKey for any transaction that predates this fix before merging; (3) if a stale cloud row from before this fix still wins the merge without monthKey, recovery falls back to where the transaction lived locally, then to a month derived from its own date field if there's no local trace left at all (covers a transaction already lost from a past occurrence of this exact bug, even with no other information to go on) — and re-pushes the recovered record so the cloud copy is corrected too, not just local. Also added a beforeunload warning while a sync is actively in flight, targeting the reported trigger directly (closing the app mid-sync) — not a complete fix on its own since a request can still be interrupted, but it gives a chance to wait rather than force-close.

## v3.34 (ON--038)

added a sort toggle to Bills > Recurring — "Next due" (chronological by next occurrence, paused items and anything with no computable next date pushed to the end rather than sorted arbitrarily among real dates) and "By type" (Income first, then Outgoing — "who it's going to" is the item's own name, so grouping by that is just an alphabetical sort within each type, with a small section label between them). Ledger view is unchanged, as requested.

## v3.35 (ON--039)

brought the same sort toggle to the Scenario tab's item list, with three modes instead of two since scenario items don't have their own due date the way real recurring items do. Date: only an item linked back to a real recurring item (baseId) has an actual schedule — reuses THAT item's own next-due date (not the scenario item's possibly-edited frequency, to avoid a mismatch between an edited amount/frequency and the real anchor date); an unlinked/new hypothetical item has nothing to sort by, so it's pushed to the end, same treatment paused items get in Recurring's Next due sort. Value: Income then Outgoing, each ordered by monthly-equivalent magnitude, highest first. Type: same Income/Outgoing grouping, alphabetical within each (unchanged concept from Recurring's By type). Extracted renderScenItemCard() so all three modes render identical cards from shared logic.

## v3.36 (ON--040)

Bills Ledger's Cleared filter now shows newest-first instead of oldest-first. Deliberately scoped to the Cleared filter alone — the All filter concatenates cleared history before the uncleared/forecast items to form one continuous past-to-future timeline, and flipping the cleared side of that would turn it into a confusing zigzag (recent past, jump back to distant past, jump forward to near future) rather than reversing it as a whole. Cleared rows never showed a running balance in the first place (reconciling decouples the balance from transaction history), so there's no balance-sequence coherence to break by changing display order.

## v3.37 (ON--041)

recurring items can now have an optional note, shown on the item's own card in the Recurring list, on its generated upcoming/uncleared occurrence rows, and carried through into the actual transaction record once cleared or skipped — so it's visible on the cleared row too, not just up to the point of clearing. Verified the whole chain end to end: recurring item → uncleared occurrence → clear sheet context → cleared bills.tx entry → cleared row display, confirming the note survives every step unchanged.

## v3.38 (ON--042)

scenario item rows are now visually highlighted (left border + tinted background) when they're added or modified relative to as-is, reusing the same diffScenario() classification already powering the What Changed section rather than a separate check. A modified item (linked to a real recurring item, values edited) also gets a "Changed" badge; an added item doesn't need one since its existing "new" badge already says as much — showing both would be redundant. Unchanged items (linked, values identical to the real item) get no highlight at all. Removed items aren't in the scenario's item list to begin with, so there's no row for them here — that's still covered by the What Changed section, unaffected by this.

## v3.39 (ON--043)

removed the dismissible "worth exporting?" backup nag banner (BACKUP_THRESHOLD counter, showBackupBanner/hideBackupBanner/dismissBackupPrompt, and the boot-time/post-save trigger checks). The Export function itself, the Sync & Backup drawer's "Last backup: …" status line, and the underlying txCountsSinceBackup()/txCountsPhrase() helpers that feed it are untouched — only the nagging banner is gone. meta.changesSinceBackup is still reset to 0 on export and still read back from old JSON backups without erroring, so nothing breaks on existing exports; it's just no longer acted on.

## v3.40 (ON--044)

Settings' weekly food budget and monthly travel budget now only take effect for a month that hasn't started yet. startMonth() snapshots both into the new month (weeklyFoodBudget, travelBudget) the moment it begins — every calculation for the current month reads that snapshot, never live Settings, so editing Settings mid-month can never retroactively change a month already in progress. Added an in-month adjustment on top: a new "Adjust this month's budgets" sheet lets Food's weekly amount be changed for the current + remaining weeks only (weeklyFoodAdjustment — a week that's already finished keeps showing what it actually was budgeted at the time, so history is never rewritten) and Travel's monthly total edited directly (no weekly split, per the agreed design — travel doesn't fit a weekly model the way food does). Both reset to whatever Settings says at the next month's snapshot. getWeeks() and calcReserve() extended accordingly; verified directly with the exact scenario of a mid-month Settings edit provably not affecting the current month, and the adjustment/reset lifecycle. Sync fixed too — syncUpsertMonth() and the pull/rebuild path only ever carried {monthKey, startBalance, updated_at}; the new snapshot fields would have silently failed to sync across devices without this.

## v3.41 (ON--045)

deep-link actions from the launcher dashboard card. The launcher can now send an OB_ACTION postMessage once the app is loaded — currently supports 'openFoodSheet' (switches to Food & Travel and opens the Add transaction sheet) and 'openBillsSheet' (switches to Bills > Recurring and opens the Add recurring sheet). The launcher card for On Budget gains an "+ Add spend" quick-action button that navigates to the app and fires openFoodSheet; the card's main tap still opens the app normally. Stop-propagation prevents the card click from also firing when the button is tapped.

## v3.42 (ON--046)

HTML escaping — On Budget was the only app in the suite with no esc() helper. Every innerHTML sink that renders user-entered text (shop labels, recurring bill names and notes, scenario names/items/notes, goal names, savings notes, the cleared-bill sheet, the scenario print/export window, and the sync log, which can echo server error text) now escapes it. The quick-label and manage-label chips also stop interpolating label names into inline onclick strings (fragile quote-escaping, and an injection path via a label name) — they now carry the name in a data-label attribute with one delegated click listener per container, attached at boot. Icon-only elements gained aria-labels. Zero data-model or behaviour change: labels, names and notes render identically unless they contained markup, which now displays literally instead of being interpreted.

## v3.43 (ON--047)

History insights. The History tab, previously a flat list of month cards, gains four read-only insight cards computed from existing data (no schema change): (1) a stacked spend-trend chart of Food/Travel/Other across the last 12 completed months, inline SVG, no chart library; (2) latest completed month vs the average of up to six completed months before it, per category, with above/below deltas; (3) all-time top shops, aggregated from transaction labels across every month including the current one — the labels feature has been quietly building a merchant dataset that was only used for autocomplete until now; (4) a "left over" trend line — startBalance plus income minus spend per completed month. Deliberately labelled "left over" rather than "headroom": live headroom is time-dependent (pot minus the reserve still needed before pay-in) and has no meaningful value for a finished month, so the honest retrospective figure is what actually remained. Each month card also gains a left-over line and that month's top shop. Cards appear only when enough history exists (trend/average/left-over need 2+ completed months; top shops need any labelled spending), so sparse data degrades gracefully rather than showing empty charts.
