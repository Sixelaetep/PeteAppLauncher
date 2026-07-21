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
  function _queueForRetry(tableName, prefix, id, data) {
    _rehydrateRetryQueue();
    _retryQueue = _retryQueue.filter(function (q) {
      return !(q.tableName === tableName && (q.prefix || '') === (prefix || '') && q.id === id);
    });
    _retryQueue.push({ tableName: tableName, prefix: prefix || '', id: id, data: data });
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
      try { await table(q.tableName, { prefix: q.prefix }).upsert(q.id, q.data); flushed++; }
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
  async function fetchTableRows(tableName) {
    if (!hasSession()) return [];
    const PAGE = 1000;
    const basePath = '/' + tableName + '?user_id=eq.' + _userId +
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
    return all;
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
      try {
        const patch = await sbFetch(
          '/' + tableName + '?user_id=eq.' + _userId + '&record_key=eq.' + encodeURIComponent(recordKey),
          'PATCH', row
        );
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
        if (err && err.status === 401) _queueForRetry(tableName, prefix, id, data);
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
    // Returns { merged, pushedCount, rows, skipped }:
    //   merged      — final live record array (tombstones stripped) —
    //                 the app should replace its local array with this.
    //   pushedCount — how many local-only records were pushed to cloud.
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
      if (!hasSession()) return { merged: localRecords, pushedCount: 0, rows: [], skipped: true };

      const allRows = preFetchedRows || await fetchTableRows(tableName);
      // Scope the merge to this instance's prefix, if any — otherwise a
      // table holding multiple record kinds (each with an id field) would
      // get cross-contaminated (e.g. issues merging into an apps pull).
      const rows = prefix ? allRows.filter(function (r) { return r.record_key.indexOf(prefix) === 0; }) : allRows;

      const localMap = {};
      localRecords.forEach(function (r) { localMap[r[idField]] = r; });

      rows.forEach(function (row) {
        const remote = row.data;
        if (!remote || !remote[idField]) return; // not a record this merge cares about (e.g. a settings/meta row)
        if (remote._deleted) { delete localMap[remote[idField]]; return; }
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

      const merged = Object.values(localMap).filter(function (r) { return !r._deleted; });
      return { merged: merged, pushedCount: localOnly.length, rows: allRows, skipped: false };
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
    table:            table,
    errorHint:        errorHint,
    flushRetryQueue:  flushRetryQueue,
    retryQueueLength: retryQueueLength
  };
})();
