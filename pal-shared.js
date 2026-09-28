/**
 * pal-shared.js
 * ─────────────────────────────────────────────────────────────
 * Combined bundle: pal-config.js + pal-sync.js + pal-utils.js, in that
 * exact order — same load-time-critical sequence every app already
 * relied on (config sets window.PAL_CONFIG before sync/utils reference
 * it), just concatenated into one file instead of three separate
 * <script src="..."> tags/requests. Nothing else changed: each
 * section below is byte-identical to its original standalone file,
 * this header is the only new text. Loaded via
 * <script src="pal-shared.js?v=X.X"><\/script> — same cache-busting
 * pattern as before, one tag instead of three.
 *
 * Editing: change whichever section needs it, in place, exactly as
 * you would have edited that file on its own. The section dividers
 * below are cosmetic only and carry no meaning to the browser.
 * ─────────────────────────────────────────────────────────────
 */

// SECTION 1 of 3 — originally pal-config.js

/**
 * pal-config.js
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for app configuration.
 * This is the ONLY file containing the Supabase credentials.
 * All app HTML files load this first and read from PAL_CONFIG.
 *
 * Loaded via <script src="pal-config.js"></script> in each HTML file.
 *
 * v1.1 (FF-002 follow-up): added FF_PROXY_KEY — the shared header
 * value fantasy-football-tracker.html sends to pal-fpl-proxy, matching
 * the PAL_PROXY_KEY secret set on that Edge Function (see its own
 * header comment for the `supabase secrets set` command). Lives here
 * rather than hardcoded in fantasy-football-tracker.html specifically
 * so it survives every future release of that app unchanged — this
 * file is edited once and is never part of a per-app release diff,
 * unlike the app HTML files which get regenerated wholesale each time.
 * v1.2 (FTT-001): added TMDB_API_KEY / TMDB_READ_TOKEN for
 * film-tv-tracker.html's search and metadata/availability enrichment.
 * Same reasoning as FF_PROXY_KEY above — a personal, non-commercial
 * TMDB key, safe to use client-side (read-only public metadata API,
 * same risk posture as the Supabase anon key above), kept here once
 * rather than hardcoded per-release into the app file. Only
 * TMDB_READ_TOKEN (the v4 Bearer token) is actually used by the app;
 * TMDB_API_KEY (the v3 key) is stored alongside it for reference/
 * future use only, since TMDB issues both from one account.
 * ─────────────────────────────────────────────────────────────
 */
window.PAL_CONFIG = {

  // ── Supabase credentials ──────────────────────────────────
  // These are your anon (public) keys — safe to use client-side
  // because Row Level Security is enabled on all tables.
  // Only one place to update if you ever rotate the key.
  SB_URL: 'https://gnzxsbbmfwmtkqidxgoj.supabase.co',
  SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduenhzYmJtZndtdGtxaWR4Z29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjE0OTAsImV4cCI6MjA5NzI5NzQ5MH0.Jr-EiAdmpwuj69tJ7zRK22L7I2oiQaO3oWnu1uB915A',

  // ── Fantasy Football Tracker — pal-fpl-proxy shared header ──
  // Must match the PAL_PROXY_KEY secret set on the pal-fpl-proxy
  // Edge Function. Edit this one value here, once — you do NOT
  // need to re-enter it every time a new fantasy-football-tracker.html
  // is delivered.
  FF_PROXY_KEY: 'zarsor-0tUsma-vamboj',

  // ── Film & TV Tracker — TMDB credentials ─────────────────────
  // TMDB_READ_TOKEN (v4 auth, Bearer token) is what film-tv-tracker.html
  // actually sends on every request. TMDB_API_KEY (v3 key) is kept for
  // reference only — not currently used by any app.
  TMDB_API_KEY: 'bab49adcb39449717588da9fedf1b6d2',
  TMDB_READ_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiYWI0OWFkY2IzOTQ0OTcxNzU4OGRhOWZlZGYxYjZkMiIsIm5iZiI6MTczNjcwNzUzNS45NTUwMDAyLCJzdWIiOiI2Nzg0MGRjZmM1ZDJlOTZlMjY3YjliMWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.aCbl2u57im1rRU6M5yhl9Z-wjXGxt6wN3F3WPHFAmuY',

  // ── Known users ───────────────────────────────────────────
  // Maps Supabase Auth user_id → display info.
  // Add or remove users here — no other file needs editing.
  KNOWN_USERS: {
    'd3203136-833d-405b-9a48-13d7045df4fd': {
      name:   'Pete',
      avatar: '👨',
      color:  'var(--accent)',
      key:    'pete',
      isPete: true
    },
    '0e5607ff-7bc8-420e-92c6-fa82b680a0f0': {
      name:   'Lex',
      avatar: '👩',
      color:  'var(--accent4)',
      key:    'lex',
      isPete: false
    }
  }

};

// ══════════════════════════════════════════════════════════════════
// SECTION 2 of 3 — originally pal-sync.js
// ══════════════════════════════════════════════════════════════════

/**
 * pal-sync.js
 * ─────────────────────────────────────────────────────────────
 * Shared Supabase sync helper for Pete's Apps.
 * v1.0 — extracted from Claim Tracker's sync layer, which was the
 * most robust of four slightly-different implementations found
 * across the suite (Claim Tracker / On Budget / Test & Issues used
 * proper bidirectional last-write-wins merge; GigsAndTrips did too
 * but with tombstones kept forever and a different field name;
 * Gym Tracker and Fortnight Tracker did a cloud-replaces-local
 * approach with their own tombstone workarounds). This file is the
 * one canonical pattern going forward.
 * v1.1 — added an optional `prefix` per table() instance. Some apps
 * (Test & Issues) share ONE Supabase table across multiple record
 * kinds using a record_key prefix ('app_', 'issue_'), where more than
 * one kind carries an `id` field — without prefix scoping, pulling
 * "apps" would also merge in "issues" that happen to expose `.id`.
 * Each table() instance now optionally scopes itself to one prefix;
 * omitting it (Claim Tracker's usage) is unchanged and fully backward
 * compatible — prefix defaults to '', so id === record_key as before.
 * v1.2 — pull() hardcoded the merge timestamp field as `updated_at`.
 * Claim Tracker's own records use that name, but Test & Issues' apps
 * and issues use `updatedAt` (camelCase) — so for that app, EVERY
 * comparison silently evaluated `'' > ''` (false), meaning an existing
 * local record could never be updated by a genuinely newer cloud copy.
 * This wasn't a hidden risk, it was total breakage for that field
 * convention. pull() now takes an optional updatedAtField (3rd arg,
 * default 'updated_at' — unchanged for existing callers).
 * v1.3 — two fixes surfaced while planning On Budget, which shares one
 * table across SEVEN record kinds (far more than Test & Issues' two):
 * (1) pull() did its own full-table GET every time — fine for one or
 * two kinds, wasteful for seven near-identical fetches of the same
 * rows. pull() now accepts an optional 4th arg, preFetchedRows; when
 * provided, it skips the network call and merges against those rows
 * instead. New PalSync.fetchTableRows(tableName) does the one fetch a
 * multi-kind app needs, shared across all its table() instances.
 * Existing 3-arg callers (Claim Tracker, Test & Issues) are unaffected
 * — they keep doing their own single fetch exactly as before.
 * (2) the tie-break on an exact timestamp match was local-wins (`>`).
 * On Budget's own hand-rolled merges (already in production, proven)
 * use cloud-wins-on-tie (`>=`) — that's what makes a push-then-pull on
 * the same device converge cleanly instead of re-diverging. Adopted
 * `>=` as the one canonical choice; Claim Tracker and Test & Issues
 * inherit this too, since a tie is an edge case rare enough that
 * consistency across apps matters more than which side wins it.
 * v1.4 — the "push local-only records up" step in pull() excluded
 * anything with _deleted:true. Fine for apps that splice a deleted
 * record out of its local array immediately (Claim Tracker, Test &
 * Issues) — there's no local tombstone left to exclude. But On Budget
 * keeps _deleted:true records in their local arrays deliberately, so a
 * delete made while offline survives until it's confirmed synced. With
 * the old exclusion, that offline tombstone would never get pushed by
 * a pull — it would just be silently stripped from the merged result
 * (pull()'s output has always dropped _deleted records, correctly),
 * with the cloud never having been told. Other devices would then never
 * see the deletion. Local-only records are now always pushed up exactly
 * as they are (including a _deleted:true one), regardless of which
 * pattern the calling app uses — a strict correctness improvement, not
 * a behavior choice, since a tombstone that never reaches the cloud
 * defeats the entire point of tombstoning.
 * v1.5 — thrown errors only ever carried a message string. Gym Tracker's
 * retry queue needs to tell "session token expired (401) — worth queuing
 * for automatic retry once a fresh token arrives" apart from any other
 * failure, and parsing a status code back out of message text is fragile.
 * Errors now carry a .status property (the HTTP status, where available)
 * alongside .message — purely additive, no existing catch that only reads
 * .message is affected.
 * v1.6 — some apps (Reading Tracker, GigsAndTrips) have a second, standalone
 * auth path — an email/password login with its own refresh-token flow —
 * for when the app is opened directly rather than through the launcher.
 * Until now there was no way to hand a token obtained that way to this
 * library; _token/_userId were only ever settable via the internal
 * PAL_SESSION postMessage listener. New PalSync.setSession(token, userId)
 * lets an app feed in a session from any source, so a standalone-auth path
 * can use the same table()/pull()/upsert() machinery as the normal
 * launcher path instead of needing a second, parallel sync implementation.
 * v1.7 — tombstone() always stamped the dead record's timestamp as
 * `updated_at` (snake_case), with no way to override it. Every camelCase
 * app (Test & Issues, Gym Tracker, Fortnight Tracker, Reading Tracker)
 * noticed this during their own migration and worked around it by never
 * calling tombstone() at all — building the tombstone object by hand
 * instead, since the hardcoded field wouldn't refresh whatever their own
 * merge actually reads. Not a live bug (every app already sidesteps it),
 * but a landmine for the next migration that assumes the helper "just
 * works" regardless of field convention. tombstone() now takes an
 * optional updatedAtField (3rd arg, default 'updated_at' — unchanged for
 * existing callers, e.g. Claim Tracker's and On Budget's).
 * v1.8 — only Gym Tracker had any handling for a push failing because the
 * session token expired mid-use (401): it queued the record and retried
 * once a fresh PAL_SESSION arrived. On Budget, Test & Issues, Claim
 * Tracker, and Fortnight Tracker had none — a 401 during upsert() was
 * just logged and dropped by the caller, relying on the next full pull()
 * to notice the local record is newer than cloud and push it again. Not
 * data loss, but inconsistent, and something every app would otherwise
 * have to reimplement by hand (as Gym Tracker did). Two additions, both
 * purely additive:
 * (1) table().upsert() now auto-queues itself internally whenever a
 * PATCH/POST fails with status 401, then still re-throws exactly as
 * before — existing callers that catch and log the error see no change
 * in behaviour. The queue auto-flushes the next time a session arrives,
 * via initSession()/setSession(), before any app code runs — no app
 * needs to remember to call anything for the common case. New
 * PalSync.flushRetryQueue() is also exposed for a manual/explicit flush,
 * and PalSync.retryQueueLength() for a UI to show "N pending".
 * (2) PalSync.errorHint(status, message) — Gym Tracker's syncErrorHint()
 * pulled out into the shared library, so every app gets the same plain-
 * English translation of a 401/403/404 instead of a bare status code.
 * v1.9 — two latent-bug fixes, no API changes, no app-side changes needed:
 * (1) PAGINATION. fetchTableRows() did one GET with no Range header, and
 * Supabase/PostgREST caps a single response at 1,000 rows by default. No
 * table is near that yet, but Reading Tracker history and Gym sessions
 * grow forever and tombstones accelerate it — and a capped pull wouldn't
 * error, it would silently truncate. Worse, pull()'s push-local-only-up
 * step would then treat the missing rows as "not in cloud" and re-push
 * them. fetchTableRows() now requests pages of 1,000 with a Range header
 * (ordered by record_key for stable pages) and Prefer: count=exact, then
 * loops until the Content-Range total confirms every row is in hand —
 * robust even if the server's max-rows is ever configured lower than
 * 1,000. Single-page tables behave exactly as before: one request.
 * (2) PERSISTED RETRY QUEUE. The v1.8 401 retry queue was memory-only —
 * a queued write followed by a tab close or launcher iframe eviction was
 * gone until the next full pull happened to reconcile it. The queue now
 * mirrors to localStorage ('pal_retry_queue_v1') on every change and
 * rehydrates at script load, so a stranded write survives eviction and
 * flushes on the next session arrival. Queue entries no longer hold live
 * table() references (unserialisable) — they store {tableName, prefix,
 * id, data} and the flush reconstructs a table() on demand. Deliberate
 * consequence: localStorage is shared across the suite's origin, so ANY
 * app with a live session flushes ANY app's stranded writes — a write
 * stranded by Gym Tracker gets rescued the moment On Budget next opens,
 * instead of waiting for Gym specifically. A double-flush race between
 * two simultaneously-open apps is harmless (upserts are last-write-wins
 * with a fresh updated_at); a read-modify-write race on the stored queue
 * between two apps queueing at the exact same moment could in theory
 * drop one entry, accepted as vanishingly unlikely at this scale and
 * self-healing via the next pull. Non-401 failures during a flush are
 * dropped, same as v1.8 (documented behaviour, not a regression).
 * v1.10 — tombstone compaction, the suite's ONE sanctioned use of hard
 * DELETE. Soft-delete tombstones are kept forever by design (they stop
 * resurrection on pull), but they accumulate without bound and every
 * pull fetches all of them. countCompactableTombstones(table, days) and
 * compactTombstones(table, days) target only rows that are BOTH
 * tombstoned (data->>_deleted = true) AND stale (updated_at older than
 * the threshold, default 90 days, clamped to a 30-day minimum). Safety
 * argument: a device offline longer than the threshold does a fresh
 * bootstrap on return, and bootstrap treats cloud as authoritative — a
 * compacted tombstone therefore has nothing left to protect against.
 * Live rows and recent tombstones are untouchable by construction (the
 * WHERE clause, plus RLS scoping everything to the caller's own rows).
 * Deliberately NOT automatic: apps surface it as a count-then-confirm
 * button. GigsAndTrips and Meal Planner (bespoke shared sync) are out
 * of scope — their shared-data tombstone policy needs its own thinking.
 * v1.11 — pull()'s final line unconditionally dropped every _deleted:true
 * record from `merged`, regardless of whether the cloud had actually
 * confirmed the deletion. Every calling app rebuilds its local array
 * straight from `merged`, so this meant: delete something, and on the
 * VERY NEXT pull — success or failure of that delete's own tombstone
 * push — the local record of the deletion itself was gone, not just the
 * (correctly) hidden record. If the tombstone push had failed for any
 * reason (network blip, 401, offline), the cloud still held the old live
 * row, and with local memory of the delete now wiped too, a LATER pull
 * would freely adopt that stale row as if it were legitimate unseen data
 * — the deleted record resurrects, permanently, with no further chance
 * to self-correct. Traced through On Budget ON--049 and ON--050: the
 * second bug was an app-level retry sweep (compare _deleted:true local
 * records against cloud confirmation) that could never fire, because by
 * the time it ran, pull() had already erased the local tombstone it
 * needed to check. Root cause was here, one layer below any app's own
 * logic, affecting every app and every table using table().pull().
 * Two changes, no signature change, existing 3-arg and 4-arg callers
 * both unaffected other than getting the fix:
 * (1) merged no longer strips _deleted:true unconditionally. A record
 * only leaves merged once the CLOUD independently confirms the
 * deletion (its own row for that id also carries _deleted:true) — at
 * that point it's already removed from the working map by the existing
 * "cloud tombstone wins" branch earlier in pull(), so nothing extra is
 * needed to drop it. Anything still _deleted:true in the map by the end
 * is, by construction, one the cloud hasn't echoed back yet, and now
 * stays in merged so the calling app's local array keeps remembering it
 * across pulls instead of forgetting after one cycle.
 * (2) an unconfirmed local tombstone whose id already exists in cloud
 * (so the existing "local-only" push skips it, since that only fires
 * for ids missing from cloud entirely) now gets its own explicit retry
 * push every pull, until the cloud confirms it. Previously such a
 * tombstone was pushed exactly once, at the moment of deletion, with no
 * second chance if that single push failed.
 * Consequence every calling app needs to know: merged can now contain
 * _deleted:true records it never used to. Every app in the suite is
 * documented as filtering !record._deleted at render/calc time — that
 * pattern is what makes this safe; an app that instead relied on pull()
 * having already scrubbed deletes for it will start showing tombstoned
 * records until the cloud confirms them. Audited alongside this release
 * (see each app's own changelog): Reading Tracker and Test & Issues had
 * no such filtering anywhere and needed it added; Fortnight Tracker had
 * it for codes but not bundles. On Budget, Gym Tracker, and Claim
 * Tracker already filtered consistently and needed no changes for this.
 *
 * v1.12 — opt-in SHARED mode for tables that two known users read and
 * write together (first user: Film & TV Tracker, pal_film_tracker).
 * Everything above was strictly per-user: fetchTableRows(), upsert()'s
 * PATCH and the compaction filters all hard-coded user_id=eq.<me>, so
 * even when a table's RLS let both users in, each only ever saw their
 * own rows. table(name, { shared: true }) and fetchTableRows(name,
 * { shared: true }) change that, and ONLY for callers that pass the flag
 * — every existing app behaves byte-for-byte as before.
 * Shared mode: (1) fetch drops the user_id filter (RLS is the boundary)
 * and collapses duplicate record_keys to the newest updated_at, ordered
 * by record_key then user_id so pagination stays stable; (2) upsert()
 * PATCHes by record_key alone and omits user_id from the PATCH body, so
 * one user editing the other's record updates it in place instead of
 * forking a second copy or taking ownership; POST (new record) still
 * stamps the caller's user_id; (3) the flag rides along in the retry
 * queue so a queued shared upsert is replayed as shared. Compaction is
 * left per-user on purpose (see v1.10 note on shared-data tombstones).
 *
 * Loaded via <script src="pal-sync.js"></script> AFTER pal-config.js
 * in each app HTML file. Depends on window.PAL_CONFIG (SB_URL, SB_KEY).
 *
 * Does NOT touch localStorage or any app's data model — this only
 * knows about Supabase rows shaped { user_id, record_key, data,
 * updated_at }. Each app still owns its own local storage, envelope
 * shape, and rendering.
 * ─────────────────────────────────────────────────────────────
 */
window.PalSync = (function () {

  let _token  = null;
  let _userId = null;
  let _listenerAttached = false;
  let _sessionCallbacks  = [];   // fns called with (token, userId) on every PAL_SESSION/PAL_UNLOCKED
  let _retryFlushCallbacks = []; // fns called with ({flushed, stillQueued}) after an auto-flush attempt
  let _retryQueue = [];          // [{ tableName, prefix, id, data }] — queued upsert()s awaiting a fresh session

  // v1.9: the queue survives tab close / iframe eviction by mirroring to
  // localStorage on every change. Entries are plain serialisable objects
  // (tableName + prefix instead of a live table() reference); the flush
  // reconstructs a table() on demand. Shared across the whole origin by
  // design — any app with a live session can flush any app's strays.
  const RETRY_QUEUE_KEY = 'pal_retry_queue_v1';

  function _persistRetryQueue() {
    try {
      if (_retryQueue.length) localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(_retryQueue));
      else localStorage.removeItem(RETRY_QUEUE_KEY);
    } catch (e) { /* storage full/unavailable — queue still works in-memory for this page's lifetime */ }
  }

  function _rehydrateRetryQueue() {
    try {
      const raw = localStorage.getItem(RETRY_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _retryQueue = parsed.filter(function (q) {
          return q && typeof q.tableName === 'string' && q.id !== undefined && q.data !== undefined;
        });
      }
    } catch (e) { /* corrupt entry — start clean rather than wedge every app on the origin */ _retryQueue = []; }
  }
  _rehydrateRetryQueue();

  // Every 401 upsert lands here (see table().upsert() below); flushed
  // automatically the next time a session arrives via _onSessionArrived,
  // so ordinary apps never need to call this directly. Re-read the stored
  // queue first so a queue written by another app moments ago isn't
  // clobbered by this app's stale in-memory copy.
  function _queueForRetry(tableName, prefix, id, data, shared) {
    _rehydrateRetryQueue();
    _retryQueue = _retryQueue.filter(function (q) {
      return !(q.tableName === tableName && (q.prefix || '') === (prefix || '') && !!q.shared === !!shared && q.id === id);
    });
    _retryQueue.push({ tableName: tableName, prefix: prefix || '', id: id, data: data, shared: !!shared });
    _persistRetryQueue();
  }

  function retryQueueLength() { return _retryQueue.length; }

  // Re-attempts every queued upsert. Safe to call with an empty queue or
  // no session (no-op). A record that fails again with a 401 is re-queued
  // by upsert()'s own 401 path; any other failure is dropped, same as any
  // other failed upsert (unchanged v1.8 behaviour).
  async function flushRetryQueue() {
    _rehydrateRetryQueue(); // pick up strays queued by other apps on this origin
    if (!_retryQueue.length || !hasSession()) return { flushed: 0, stillQueued: _retryQueue.length };
    const queue = _retryQueue; _retryQueue = [];
    _persistRetryQueue();
    let flushed = 0;
    for (const q of queue) {
      try { await table(q.tableName, { prefix: q.prefix, shared: !!q.shared }).upsert(q.id, q.data); flushed++; }
      catch (e) { /* 401 → upsert() re-queued (and re-persisted) it; other errors dropped as documented */ }
    }
    return { flushed: flushed, stillQueued: _retryQueue.length };
  }

  // Common tail for both session-arrival paths (postMessage and
  // setSession()): fire the app's own onSession callbacks first, then
  // attempt a retry-queue flush and report the outcome to anyone
  // listening via opts.onRetryFlushed. Ordering matters — an app's
  // onSession handler typically does its first pull() before anything
  // else, so the queue gets a real chance to flush against a live
  // session rather than racing it.
  function _onSessionArrived() {
    _sessionCallbacks.forEach(function (fn) { fn(_token, _userId); });
    if (_retryQueue.length) {
      flushRetryQueue().then(function (result) {
        _retryFlushCallbacks.forEach(function (fn) { fn(result); });
      });
    }
  }

  // ── Session (PAL_SESSION / PAL_UNLOCKED, with origin guard) ──────────
  // Call once at startup. onSession fires every time a session arrives
  // (including re-auth after expiry). onNoSession fires once if nothing
  // arrives within noSessionMs (default 3000) — apps use this to show a
  // "not connected" banner, same as every app already does. onRetryFlushed
  // (optional, v1.8) fires after every session arrival that had queued
  // retries to attempt — apps can use it to log/display the outcome.
  function initSession(opts) {
    opts = opts || {};
    if (!_listenerAttached) {
      _listenerAttached = true;
      window.addEventListener('message', function (e) {
        if (e.origin !== window.location.origin) return;
        if (e.data && (e.data.type === 'PAL_SESSION' || e.data.type === 'PAL_UNLOCKED')) {
          _token  = e.data.access_token || null;
          _userId = e.data.user_id || null;
          if (_token && _userId) _onSessionArrived();
        }
      });
    }
    if (opts.onSession) _sessionCallbacks.push(opts.onSession);
    if (opts.onRetryFlushed) _retryFlushCallbacks.push(opts.onRetryFlushed);
    if (opts.onNoSession) {
      setTimeout(function () {
        if (!_token) opts.onNoSession();
      }, opts.noSessionMs || 3000);
    }
  }

  function hasSession() { return !!(_token && _userId); }
  function getUserId()  { return _userId; }

  // Feed in a session obtained outside the PAL_SESSION postMessage flow
  // (e.g. a standalone email/password login). Triggers the same
  // onSession callbacks as a normal PAL_SESSION arrival, so callers that
  // pull-on-first-session don't need a separate code path for this.
  function setSession(token, userId) {
    _token  = token || null;
    _userId = userId || null;
    if (_token && _userId) _onSessionArrived();
  }

  // Plain-English translation of a sync failure's HTTP status, shared
  // across every app so error messages read the same everywhere (v1.8 —
  // lifted out of Gym Tracker's local syncErrorHint(), which was the
  // only app that had one).
  function errorHint(status, message) {
    if (status === 401) return 'session token invalid or expired — reopen the app via the launcher to refresh it';
    if (status === 404) return 'table not found — the matching Supabase table may not have been created yet (check the SQL setup)';
    if (status === 403) return 'access denied — check the RLS policy on this table';
    return message || ('HTTP ' + status);
  }


  // ── Low-level REST wrapper ────────────────────────────────────────
  // extraHeaders (optional, v1.9): merged over the defaults — used by the
  // paginated fetchTableRows() for Range/Prefer. No existing caller passes
  // it, so all prior behaviour is unchanged.
  async function sbFetch(path, method, body, extraHeaders) {
    method = method || 'GET';
    const headers = {
      'apikey':        window.PAL_CONFIG.SB_KEY,
      'Authorization': 'Bearer ' + _token,
      'Content-Type':  'application/json',
      'Prefer':        method === 'PATCH' ? 'return=representation'
                       : method === 'DELETE' ? 'return=minimal' : ''
    };
    if (extraHeaders) Object.keys(extraHeaders).forEach(function (k) { headers[k] = extraHeaders[k]; });
    const opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(window.PAL_CONFIG.SB_URL + '/rest/v1' + path, opts);
  }

  // ── Fetch all rows in a table once ─────────────────────────────────
  // For apps with several record kinds sharing one table (e.g. On
  // Budget's 7 kinds under one table), fetch once and pass the result
  // into each table() instance's pull() as preFetchedRows, instead of
  // each instance doing its own identical full-table GET.
  // v1.9: paginated. PostgREST caps a single response at 1,000 rows by
  // default, and an over-cap fetch doesn't error — it silently truncates,
  // which pull() would then misread as "those records aren't in cloud".
  // Pages are ordered by record_key (stable pagination needs a total
  // order) and the loop is driven by the Content-Range total rather than
  // page size, so it stays correct even if the server's max-rows is ever
  // configured below our requested page size. A table that fits in one
  // page costs exactly one request, same as before.
  // v1.12: opts.shared — see changelog. Default (no opts) is unchanged.
  async function fetchTableRows(tableName, opts) {
    if (!hasSession()) return [];
    const shared = !!(opts && opts.shared);
    const PAGE = 1000;
    const basePath = shared
      ? '/' + tableName + '?select=user_id,record_key,data,updated_at&order=record_key.asc,user_id.asc'
      : '/' + tableName + '?user_id=eq.' + _userId +
        '&select=record_key,data,updated_at&order=record_key.asc';
    let all = [];
    for (;;) {
      const res = await sbFetch(basePath, 'GET', null, {
        'Range-Unit': 'items',
        'Range':      all.length + '-' + (all.length + PAGE - 1),
        'Prefer':     'count=exact'
      });
      if (!res.ok) { const err = new Error(res.status + ' ' + (await res.text())); err.status = res.status; throw err; }
      const page = await res.json();
      all = all.concat(page);
      // Content-Range: "0-999/2345" (or "*/0" for an empty table).
      const cr = res.headers.get('Content-Range') || '';
      const total = parseInt(cr.split('/')[1], 10);
      if (isNaN(total) || all.length >= total) break;   // done, or header unavailable — what we have is what one request yields (pre-v1.9 behaviour)
      if (!page.length) {                               // server says more rows exist but returned none — bail loudly rather than loop forever
        const err = new Error('pagination stalled fetching ' + tableName + ' (' + all.length + ' of ' + total + ' rows)');
        err.status = 500; throw err;
      }
    }
    if (shared) {
      // Two users can each hold a row for the same record_key (e.g. both
      // wrote '__settings__' before sharing was wired up). Keep the newest.
      const byKey = {};
      all.forEach(function (r) {
        const cur = byKey[r.record_key];
        if (!cur || (r.updated_at || '') > (cur.updated_at || '')) byKey[r.record_key] = r;
      });
      all = Object.keys(byKey).sort().map(function (k) { return byKey[k]; });
    }
    return all;
  }

  // ── Tombstone compaction (v1.10) ─────────────────────────────────
  // Shared WHERE for both functions: this user's rows, tombstoned, and
  // older than the cutoff. olderThanDays defaults to 90 and is clamped
  // to a 30-day floor — below that, a rarely-used device could plausibly
  // still be relying on the tombstone to learn about the delete.
  function _compactFilter(tableName, olderThanDays) {
    const days = Math.max(30, olderThanDays || 90);
    const cutoff = new Date(Date.now() - days*86400000).toISOString();
    return '/' + tableName + '?user_id=eq.' + _userId +
           '&data->>_deleted=eq.true&updated_at=lt.' + encodeURIComponent(cutoff);
  }

  // How many tombstones WOULD be removed — zero-row GET, count from the
  // Content-Range header. Always call this first and show the number.
  async function countCompactableTombstones(tableName, olderThanDays) {
    if (!hasSession()) return { count: 0 };
    const res = await sbFetch(_compactFilter(tableName, olderThanDays) + '&select=record_key', 'GET', null, {
      'Range-Unit': 'items', 'Range': '0-0', 'Prefer': 'count=exact'
    });
    if (!res.ok) { const err = new Error(res.status + ' ' + (await res.text())); err.status = res.status; throw err; }
    const total = parseInt((res.headers.get('Content-Range') || '').split('/')[1], 10);
    return { count: isNaN(total) ? 0 : total };
  }

  // The hard DELETE. Same filter, so it can never touch a live row or a
  // recent tombstone. Returns the server-reported removed count when
  // available (Content-Range with count=exact), else null — callers can
  // re-count to verify.
  async function compactTombstones(tableName, olderThanDays) {
    if (!hasSession()) return { deleted: 0 };
    const res = await sbFetch(_compactFilter(tableName, olderThanDays), 'DELETE', null, {
      'Prefer': 'return=minimal,count=exact'
    });
    if (!res.ok) { const err = new Error(res.status + ' ' + (await res.text())); err.status = res.status; throw err; }
    const total = parseInt((res.headers.get('Content-Range') || '').split('/')[1], 10);
    return { deleted: isNaN(total) ? null : total };
  }

  // ── Per-table helper ──────────────────────────────────────────────
  // tableName: the Supabase table (record_key + jsonb data + updated_at,
  // RLS scoped to auth.uid() = user_id — see the reference tables already
  // set up for Claim Tracker / On Budget / Test & Issues / Gym Tracker).
  //
  // opts.prefix (optional): if a table holds more than one record kind
  // under the same table (e.g. Test & Issues' 'app_'/'issue_' prefixes),
  // scope this instance to one kind. record_key becomes prefix + id.
  // Create one table() instance per kind sharing the same tableName.
  function table(tableName, opts) {
    const prefix = (opts && opts.prefix) || '';
    const shared = !!(opts && opts.shared);   // v1.12 — see changelog

    // PATCH first (matches existing row for this user_id + record_key);
    // POST if nothing matched. Throws on failure so callers can log it.
    // id: the record's own id — record_key sent to Supabase is prefix + id.
    // v1.8: a 401 here is now also queued automatically via _queueForRetry,
    // in addition to being thrown as before — existing callers that catch
    // and log the error see identical behaviour; the queue is purely
    // additive and flushes itself on the next session arrival.
    async function upsert(id, data) {
      if (!hasSession()) return;
      const recordKey = prefix + id;
      const row = { user_id: _userId, record_key: recordKey, data: data, updated_at: new Date().toISOString() };
      // Shared: match by record_key only (either user's row) and never
      // send user_id on the PATCH, so ownership of the row is untouched.
      const patchPath = shared
        ? '/' + tableName + '?record_key=eq.' + encodeURIComponent(recordKey)
        : '/' + tableName + '?user_id=eq.' + _userId + '&record_key=eq.' + encodeURIComponent(recordKey);
      const patchBody = shared ? { data: data, updated_at: row.updated_at } : row;
      try {
        const patch = await sbFetch(patchPath, 'PATCH', patchBody);
        if (patch.ok) {
          const body = await patch.json();
          if (Array.isArray(body) && body.length === 0) {
            const post = await sbFetch('/' + tableName, 'POST', row);
            if (!post.ok) { const err = new Error('POST failed: ' + (await post.text())); err.status = post.status; throw err; }
          }
        } else {
          const err = new Error('PATCH failed: ' + (await patch.text())); err.status = patch.status; throw err;
        }
      } catch (err) {
        if (err && err.status === 401) _queueForRetry(tableName, prefix, id, data, shared);
        throw err;
      }
    }

    // Soft-delete: upsert the same record with _deleted:true baked into
    // its data, rather than a hard DELETE. Keeps the row visible to other
    // devices so their next pull removes it locally too, instead of
    // silently vanishing (the exact bug this library exists to prevent).
    // updatedAtField: name of the timestamp field to stamp on the
    // tombstone (default 'updated_at'). Every camelCase app so far
    // (Test & Issues, Gym Tracker, Fortnight Tracker, Reading Tracker)
    // has worked around this by never calling tombstone() at all —
    // building the dead record manually instead, since the old hardcoded
    // snake_case stamp wouldn't refresh the field their own merge reads.
    // That workaround still works, this just means it's no longer needed.
    async function tombstone(id, currentData, updatedAtField) {
      updatedAtField = updatedAtField || 'updated_at';
      const dead = Object.assign({}, currentData, { _deleted: true });
      dead[updatedAtField] = new Date().toISOString();
      await upsert(id, dead);
    }

    // Bidirectional last-write-wins merge, tombstone-aware, pushes
    // local-only live records up. This is the canonical pattern — same
    // logic regardless of which app or table calls it.
    //
    // localRecords: current array of the app's local records. Each must
    //   have an id field (default 'id') and may have a timestamp field
    //   (default 'updated_at') / _deleted.
    // idField: name of the id field on each record (default 'id').
    // updatedAtField: name of the last-modified timestamp field on each
    //   record (default 'updated_at'). Must match whatever field name
    //   the calling app actually stamps — a mismatch here means every
    //   comparison silently evaluates false and incoming updates never
    //   win, which is exactly what happened before this was configurable.
    // preFetchedRows: optional — if you've already called
    //   PalSync.fetchTableRows(tableName) (e.g. once per pull cycle for
    //   an app with several record kinds sharing one table), pass the
    //   result here to skip this instance's own network fetch.
    //
    // Returns { merged, pushedCount, retriedDeleteCount, rows, skipped }:
    //   merged      — final record array. v1.11: NO LONGER strips every
    //                 _deleted:true record — only ones the cloud has
    //                 independently confirmed (its own row for that id
    //                 also carries _deleted:true) are gone, and those are
    //                 removed earlier in this function, not here. An
    //                 unconfirmed local tombstone stays in merged so the
    //                 calling app's local array keeps remembering the
    //                 deletion across pulls instead of forgetting it
    //                 after one cycle. The app should replace its local
    //                 array with this either way, same as always — but
    //                 must filter !record._deleted at render/calc time
    //                 (the suite-wide documented pattern) since merged
    //                 can now legitimately contain tombstones.
    //   pushedCount — how many local-only (unknown-to-cloud) records were
    //                 pushed to cloud.
    //   retriedDeleteCount — v1.11: how many unconfirmed local tombstones
    //                 (id already exists in cloud, just not yet marked
    //                 deleted there) were re-pushed this pull.
    //   rows        — ALL rows fetched from the table, unfiltered by
    //                 prefix — for callers that keep another record kind
    //                 alongside this one (e.g. Test & Issues' '__meta__',
    //                 or Claim Tracker's '__settings__', neither of
    //                 which carry an id field so this merge ignores them
    //                 automatically either way).
    //   skipped     — true if there's no session; merged === localRecords.
    async function pull(localRecords, idField, updatedAtField, preFetchedRows) {
      idField = idField || 'id';
      updatedAtField = updatedAtField || 'updated_at';
      if (!hasSession()) return { merged: localRecords, pushedCount: 0, retriedDeleteCount: 0, rows: [], skipped: true };

      const allRows = preFetchedRows || await fetchTableRows(tableName, { shared: shared });
      // Scope the merge to this instance's prefix, if any — otherwise a
      // table holding multiple record kinds (each with an id field) would
      // get cross-contaminated (e.g. issues merging into an apps pull).
      const rows = prefix ? allRows.filter(function (r) { return r.record_key.indexOf(prefix) === 0; }) : allRows;

      const localMap = {};
      localRecords.forEach(function (r) { localMap[r[idField]] = r; });

      rows.forEach(function (row) {
        const remote = row.data;
        if (!remote || !remote[idField]) return; // not a record this merge cares about (e.g. a settings/meta row)
        if (remote._deleted) { delete localMap[remote[idField]]; return; } // cloud confirms the delete — drop it here, unconditionally, regardless of local state
        const local = localMap[remote[idField]];
        if (local && local._deleted) return; // local tombstone wins — don't resurrect from an older cloud copy
        if (!local || (remote[updatedAtField] || '') >= (local[updatedAtField] || '')) {
          localMap[remote[idField]] = remote;
        }
      });

      // Derived from each row's own data[idField], not the raw record_key —
      // safe regardless of whether this instance uses a prefix.
      const cloudIds  = new Set(rows.map(function (r) { return r.data && r.data[idField]; }).filter(Boolean));
      // Local-only records not yet in cloud — push them up exactly as
      // they are, INCLUDING a _deleted:true one. A delete made offline
      // still needs to reach the cloud so other devices learn about it;
      // excluding tombstones here would silently strand offline deletes.
      const localOnly = Object.values(localMap).filter(function (r) { return !cloudIds.has(r[idField]); });
      for (const r of localOnly) await upsert(r[idField], r);

      // v1.11: a local tombstone that survived the merge above (meaning
      // the cloud hasn't echoed the delete back yet) but whose id DOES
      // already exist in cloud — so the localOnly push above skipped it,
      // since that only covers ids missing from cloud entirely — gets
      // its own retry here. Without this, a tombstone whose first push
      // failed for any reason was never tried again; it would just sit
      // there until its still-live cloud counterpart eventually won a
      // future merge and resurrected. Best-effort: a failure here is not
      // rethrown, since the record stays in merged (below) and gets
      // another attempt on the next pull regardless.
      const localOnlyIds = new Set(localOnly.map(function (r) { return r[idField]; }));
      let retriedDeleteCount = 0;
      for (const r of Object.values(localMap)) {
        if (r._deleted && cloudIds.has(r[idField]) && !localOnlyIds.has(r[idField])) {
          try { await upsert(r[idField], r); retriedDeleteCount++; } catch (e) { /* best-effort — retried again next pull */ }
        }
      }

      // v1.11: previously filtered out every _deleted:true record here,
      // unconditionally. That was the bug — see the v1.11 changelog entry
      // at the top of this file. Anything still _deleted:true in the map
      // at this point is, by construction, one the cloud has NOT yet
      // echoed back (a cloud-confirmed delete was already removed above,
      // in the rows.forEach loop), so keeping it here is exactly what the
      // calling app needs: without it, an app that rebuilds its local
      // array from `merged` (every app in the suite does) permanently
      // forgets its own delete after just one pull if the first tombstone
      // push failed, and the cloud's still-live copy gets silently
      // re-adopted as legitimate on a later pull.
      const merged = Object.values(localMap);
      return { merged: merged, pushedCount: localOnly.length, retriedDeleteCount: retriedDeleteCount, rows: allRows, skipped: false };
    }

    return { upsert: upsert, tombstone: tombstone, pull: pull };
  }

  return {
    initSession:      initSession,
    hasSession:       hasSession,
    getUserId:        getUserId,
    setSession:       setSession,
    sbFetch:          sbFetch,
    fetchTableRows:   fetchTableRows,
    countCompactableTombstones: countCompactableTombstones,
    compactTombstones: compactTombstones,
    table:            table,
    errorHint:        errorHint,
    flushRetryQueue:  flushRetryQueue,
    retryQueueLength: retryQueueLength
  };
})();

// ══════════════════════════════════════════════════════════════════
// SECTION 3 of 3 — originally pal-utils.js
// ══════════════════════════════════════════════════════════════════

/**
 * pal-utils.js
 * ─────────────────────────────────────────────────────────────
 * Shared PURE, STATELESS utility functions used across the PAD suite.
 * Loaded via <script src="pal-utils.js?v=X.X"><\/script> — same
 * cache-busting pattern as pal-config.js and pal-sync.js.
 *
 * What belongs here: small helpers with zero cross-app state and no
 * real per-app configuration baked in. Sync logic stays in
 * pal-sync.js, untouched. Anything with genuine per-app config (theme
 * colors, localStorage persistence) stays local to that app — see
 * applyThemeCore() below for how that split works in practice.
 *
 * Origin: extracted from an audit that found the same handful of
 * utility functions reimplemented slightly differently in nearly
 * every app (esc/escHtml ~9 times, applyTheme ~8 times, todayISO/
 * toast/closeModal/uid 4-7 times each). Full audit and per-function
 * decisions are in the PAD-1 release notes for whichever app you're
 * reading this alongside.
 * ─────────────────────────────────────────────────────────────
 */

// ── HTML escaping ───────────────────────────────────────────────
// Canonical version escapes all five HTML-significant characters
// (& < > " ') and guards null/undefined safely. This is a strict
// superset of every existing per-app implementation — nothing that
// was escaped before becomes unescaped by switching to this, some
// things that weren't (mainly single quotes) now additionally are,
// which is harmless (an HTML entity renders back to the same visible
// character). Two real bugs fixed by centralizing on this version:
// fortnight-tracker's escHtml threw a TypeError on null/undefined
// (no guard at all); reading-tracker's esc rendered the literal word
// "undefined" for a null input instead of blank. Both names kept as
// aliases so no app needs its call sites renamed, only its local
// function definition removed.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escHtml(s) { return esc(s); }

// ── Today's date, ISO format (YYYY-MM-DD, local time) ────────────
// All prior per-app versions were already functionally identical —
// pure deduplication, no behavior change anywhere.
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── Toast notifications ───────────────────────────────────────────
// Assumes a <div id="toast"></div> exists in the page (true of every
// app that had a local toast()/showToast() implementation; Horizon
// has neither the element nor a local function, so it simply never
// calls this). Accepts an optional `type` class for apps that style
// toast variants — currently only fortnight-tracker has .toast.ok /
// .toast.err CSS; passing a type in apps without matching CSS is
// harmless, just an unstyled extra class. Timeout standardized to
// 2800ms (prior per-app values ranged 2200-2800ms, cosmetic drift
// only, no functional significance to the exact number). Both names
// kept as aliases, matching the esc/escHtml split-naming pattern.
let _palToastTimer;
function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '') + ' show';
  clearTimeout(_palToastTimer);
  _palToastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function showToast(msg, type) { toast(msg, type); }

// ── Theme: shared attribute-setting logic only ────────────────────
// Deliberately NOT a drop-in replacement for every app's applyTheme —
// each app's meta-theme-color pair is real per-app branding config,
// not duplication, and On Budget additionally persists the choice to
// localStorage, which is app-specific state that has no business
// living in a shared file. This function does only the genuinely
// identical part (setting data-theme, and optionally the meta tag's
// content); each app's own applyTheme() becomes a thin wrapper around
// this that supplies its own colors and any extra side effect it
// needs. Call as: applyThemeCore(isDark, {dark:'#hex', light:'#hex'})
// — colors argument is optional; omit it if an app has no meta tag.
function applyThemeCore(isDark, colors) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (colors) {
    const metaColor = document.getElementById('metaThemeColor');
    if (metaColor) metaColor.setAttribute('content', isDark ? colors.dark : colors.light);
  }
}

// ── Modal close (generic id-based version only) ───────────────────
// Only the true generic version is here, matching Claim Tracker's
// and Gym Tracker's existing closeModal(id) signature exactly.
// GigsAndTrips's and Fortnight Tracker's closeModal() are NOT
// included — despite the shared name, each hardcodes a single
// specific modal id with a zero-argument signature, so they're not
// actually the same function and were deliberately left alone.
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ── Unique ID generator ────────────────────────────────────────────
// Each app now passes its own prefix explicitly at the call site,
// rather than a hidden hardcoded default. This only affects the
// SHAPE of newly-generated IDs going forward — existing persisted
// IDs are untouched and nothing anywhere parses/validates uid()'s
// output format, so this is safe. See each app's release notes for
// the specific prefix preserved at its call sites.
function uid(prefix) {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
