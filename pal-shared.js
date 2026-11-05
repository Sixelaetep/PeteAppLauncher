/**
 * pal-shared.js (bundle 1.7.0, see section 5) — pal-config + pal-sync + pal-utils + pal-contract, concatenated in that order
 * (config sets window.PAL_CONFIG before sync/utils use it). Loaded as
 * <script src="pal-shared.js?v=X.X">. Edit a section in place.
 * Version history and design notes: PeteAppsChangeLog.md -> "pal-shared.js"
 * (the long per-version header notes were moved there verbatim, no code changed).
 */

// SECTION 1 of 4 — originally pal-config.js

/**
 * pal-config v1.2 — single source of app configuration (Supabase anon credentials,
 * pal-fpl-proxy header, TMDB tokens, KNOWN_USERS). History: PeteAppsChangeLog.md.
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
// SECTION 2 of 4 — originally pal-sync.js
// ══════════════════════════════════════════════════════════════════

/**
 * pal-sync v1.13 — shared Supabase sync helper. Rows are { user_id, record_key, data, updated_at };
 * never touches an app's own localStorage or data model. Needs window.PAL_CONFIG (SB_URL, SB_KEY).
 * Key behaviours (full per-version history in PeteAppsChangeLog.md -> "pal-sync section"):
 *  - pull() merges last-write-wins with tombstones; merged can contain _deleted:true records,
 *    so apps must filter them at render time.
 *  - upsert() that fails with 401 is queued (persisted) and flushed on the next session arrival.
 *  - fetchTableRows() pages 1,000 rows at a time; opts.shared reads/writes shared tables.
 *  - compactTombstones() is the only sanctioned hard DELETE. storageUsage()/cacheSet() are quota helpers.
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

  // Trims (deletes) a localStorage key if it's grown past maxKB, so the
  // app's own existing pull-from-Supabase boot logic repopulates it
  // fresh — local storage is a cache of Supabase for any app using
  // table()'s upsert/pull properly, never the only copy, so clearing it
  // is safe PROVIDED nothing is still waiting to push up. That's exactly
  // what retryQueueLength() tracks — skips the trim if anything's
  // pending, rather than risk a write that hasn't reached Supabase yet.
  //
  // Only meaningful for apps that actually route writes through
  // table()'s own upsert/retry path — retryQueueLength() reflects
  // nothing about an app with its own separate bespoke sync layer (e.g.
  // GigsAndTrips), so calling this there would be a false sense of
  // safety, not a real one. Call this once per boot, after your own
  // data has already loaded — never before, since deleting the key
  // first would just make the app start from nothing.
  //
  // Returns a result object rather than logging itself, since each app
  // has its own place to report it (syncLog, console, a toast) — this
  // function doesn't assume any of them exist.
  function trimIfLarge(key, maxKB) {
    try {
      if (retryQueueLength() > 0) return { trimmed: false, reason: 'pending-writes', pending: retryQueueLength() };
      const raw = localStorage.getItem(key);
      if (raw == null) return { trimmed: false, reason: 'not-found' };
      const sizeKB = (key.length + raw.length) * 2 / 1024; // UTF-16 bytes
      if (sizeKB <= maxKB) return { trimmed: false, reason: 'under-threshold', sizeKB: sizeKB };
      localStorage.removeItem(key);
      return { trimmed: true, sizeKB: sizeKB };
    } catch (e) {
      return { trimmed: false, reason: 'error', error: e };
    }
  }

  // ── v1.13 (TI-089): storage helpers — see header note ──────────────
  function _isQuotaError(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                   e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message || '')));
  }

  function storageUsage() {
    try {
      const keys = [];
      let totalKB = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        const kb = (k.length + v.length) * 2 / 1024; // UTF-16 bytes
        totalKB += kb;
        keys.push({ key: k, kb: kb });
      }
      keys.sort(function (a, b) { return b.kb - a.kb; });
      return { totalKB: totalKB, keys: keys };
    } catch (e) { return null; }
  }

  function cacheSet(key, value, opts) {
    opts = opts || {};
    const kb = (key.length + value.length) * 2 / 1024;
    try {
      if (opts.maxKB && kb > opts.maxKB && opts.cloudSafe && hasSession() && retryQueueLength() === 0) {
        let freedKB = 0;
        const old = localStorage.getItem(key);
        if (old != null) { freedKB = (key.length + old.length) * 2 / 1024; localStorage.removeItem(key); }
        return { stored: false, mode: 'cloud-only', kb: kb, freedKB: freedKB };
      }
    } catch (e) {
      return { stored: false, mode: 'failed', kb: kb, error: e, quota: false };
    }
    try {
      localStorage.setItem(key, value);
      return { stored: true, mode: 'local', kb: kb };
    } catch (e) {
      return { stored: false, mode: 'failed', kb: kb, error: e, quota: _isQuotaError(e) };
    }
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
    retryQueueLength: retryQueueLength,
    trimIfLarge:      trimIfLarge,
    storageUsage:     storageUsage,   // v1.13 (TI-089)
    cacheSet:         cacheSet        // v1.13 (TI-089)
  };
})();

// ══════════════════════════════════════════════════════════════════
// SECTION 3 of 4 — originally pal-utils.js
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

// ══════════════════════════════════════════════════════════════════
// SECTION 4 of 4 — pal-contract v1.1 (v1 added with launcher v11.35; v1.1 3 Nov 2026: optional `until` on attention items)
// ══════════════════════════════════════════════════════════════════

/**
 * PalContract — optional, read-only summary an app publishes for the launcher.
 * One localStorage key per app: 'pal_x_<appId>'. It is a DERIVED CACHE: the app stays the
 * only owner of its data, nothing here is ever read back by the app, and deleting the key
 * loses nothing (the app republishes on its next save). Every field is optional:
 *   { v:1, appId, userId, built, summary:{}, upcoming:[], attention:[], search:[] }
 *   upcoming  [{ id, date:'YYYY-MM-DD', time?, title, sub?, kind?, open? }]            (max 30)
 *   attention [{ id, level:'action'|'soon'|'info', title, sub?, due?, until?, open? }]  (max 10)
 *     until   (v1.1) 'YYYY-MM-DD': the last day the alert still applies. The launcher hides it from the next day on without the app having to run again
 *             (an alert computed at save time otherwise outlives the situation until the app is next opened). Optional; apps that do not send it behave as before.
 *   (search lists are NOT part of this key: since v11.38 they go through PalContract.publishSearch() into IndexedDB 'pal_x_db' so they
 *    cost nothing against the shared 5 MB localStorage quota; rows are { id, t: title, s: detail, k: kind, d: date, open })
 *   open      { view?, id? }  → the launcher sends the app { type:'PAL_OPEN', view, id }
 * v1.2 (pal-shared 1.5.0, Suite Phase 2 Batch A) adds OPTIONAL metadata fields: app (app version), schema (the app's data version), caps
 *   ({ quickAdd:true, ping:true, ... } what the app can do), lib (set automatically: PalShared.VERSION). The payload shape stays v:1, additive.
 * v1.2 also copies each published contract (without the search list) to the user's own row in the cloud table `pal_contracts`
 *   (record_key = appId), debounced, so the launcher can show current data even when this app has not run on the device in front of it.
 *   PalContract.pullCloud() is the launcher's side: it writes a cloud contract into the local pal_x_<app> key only when it is newer than
 *   the local one and belongs to the signed-in user. If the table does not exist yet, both sides quietly do nothing.
 * v1.3 (pal-shared 1.6.0, Suite Phase 3, R33) contract size policy (ContractSizeProposal.md, D18/D20). The limit stays 48 KB (JSON characters x 2 / 1024).
 *   publish(appId, payload, { trim: [...] }) : when the contract is over the limit, up to three trim steps are applied in order and publishing is retried
 *     after each; the first version that fits is stored and carries `trim: <steps used>`. A step is a dot path to delete ('summary.card.wishlist') or a function(o)
 *     that shrinks the contract object in place. No app passes `trim` yet, so this is dormant until one opts in. Returns { stored:true, trimmed:<steps> }.
 *   If nothing fits, the older contract is KEPT and gets `stale: { reason:'too-large', at, kb }` added (or, with no older contract, a small marker with built = 1970 so a
 *     valid cloud copy still wins). The next successful publish writes a fresh contract without it. Returns { stored:false, reason:'too-large', stale:true, kb }.
 *     The launcher shows a Needs attention alert for a stale contract and for one at 80% or more of the limit; the Device check lists it as an ISSUE.
 *   The cloud copy is made from the same (trimmed) contract, so a second device never receives a larger contract than the first; it is never sent when still too large.
 * userId is the publisher's Supabase user id; the launcher ignores a contract whose userId is not
 * the signed-in user and removes all pal_x_* keys on sign-out. publish() never throws, and does
 * nothing without a user id, so an app calling it keeps working if this section is absent
 * (callers guard with `if (window.PalContract)`).
 */
window.PalContract = (function () {
  var PREFIX = 'pal_x_';
  var CAPS = { upcoming: 30, attention: 10, search: 400 };
  var MAX_KB = 48;
  function clip(v, n) { v = v == null ? '' : String(v); return v.length > n ? v.slice(0, n - 1) + '…' : v; }
  function cleanOpen(o) {
    if (!o || typeof o !== 'object') return undefined;
    var r = {}; if (o.view) r.view = clip(o.view, 40); if (o.id) r.id = clip(o.id, 120);
    return (r.view || r.id) ? r : undefined;
  }
  function cleanList(list, cap, fields) {
    if (!Array.isArray(list)) return undefined;
    return list.slice(0, cap).map(function (it) {
      var o = {};
      Object.keys(fields).forEach(function (k) {
        if (it[k] == null || it[k] === '') return;
        o[k] = fields[k] === 'open' ? cleanOpen(it[k]) : clip(it[k], fields[k]);
        if (o[k] === undefined) delete o[k];
      });
      return o;
    });
  }
  function cleanCaps(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return undefined;
    var r = {}, n = 0;
    Object.keys(c).forEach(function (k) { if (n < 12 && /^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(k)) { r[k] = !!c[k]; n++; } });
    return n ? r : undefined;
  }
  // ── Cloud copy (v1.2) ─────────────────────────────────────────────────────
  // Table pal_contracts has the same shape as every other PalSync table (user_id, record_key, data, updated_at), so PalSync does the work.
  // Debounced per app (saves are frequent); an unchanged contract is not re-sent for 10 minutes. 'built' is ignored when comparing.
  var CLOUD_TABLE = 'pal_contracts', CLOUD_DELAY = 4000, CLOUD_GAP = 600000;
  var cloud = { enabled: true, pushed: 0, skipped: 0, lastPushAt: 0, lastError: '', disabled: '' };
  var _pend = {}, _tm = {}, _sig = {}, _at = {};
  function sigOf(c) { var x = {}; Object.keys(c).forEach(function (k) { if (k !== 'built') x[k] = c[k]; }); return JSON.stringify(x); }
  function scheduleCloud(appId, c) {
    if (!cloud.enabled || !(window.PalSync && window.PalSync.hasSession && window.PalSync.hasSession())) return;
    var copy = {}; Object.keys(c).forEach(function (k) { if (k !== 'search') copy[k] = c[k]; });
    if (JSON.stringify(copy).length * 2 / 1024 > MAX_KB) return;
    _pend[appId] = copy;
    if (_tm[appId]) clearTimeout(_tm[appId]);
    _tm[appId] = setTimeout(function () { flushCloud(appId); }, CLOUD_DELAY);
  }
  function flushCloud(appId) {
    _tm[appId] = null;
    var c = _pend[appId]; delete _pend[appId];
    if (!c || !cloud.enabled) return;
    var s = sigOf(c);
    if (_sig[appId] === s && Date.now() - (_at[appId] || 0) < CLOUD_GAP) { cloud.skipped++; return; }
    function ok() { _sig[appId] = s; _at[appId] = Date.now(); cloud.pushed++; cloud.lastPushAt = Date.now(); cloud.lastError = ''; }
    function fail(err) {
      cloud.lastError = clip(err && err.message || String(err), 160);
      if ((err && err.status === 404) || /42P01|PGRST205|does not exist|schema cache/i.test(cloud.lastError)) { cloud.enabled = false; cloud.disabled = 'table missing'; }
    }
    try { Promise.resolve(window.PalSync.table(CLOUD_TABLE).upsert(appId, c)).then(ok, fail); } catch (e) { fail(e); }
  }
  try {   // leaving the page: send whatever is waiting now rather than losing it
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') Object.keys(_pend).forEach(function (a) { if (_tm[a]) clearTimeout(_tm[a]); flushCloud(a); });
    });
  } catch (e) {}
  // Launcher side: copy newer cloud contracts into the local pal_x_<app> keys. Never overwrites a newer local one; ignores anything that is
  // not v:1, not for this app id, not owned by the signed-in user, not in opts.apps (when given) or too large. Resolves with a status object.
  var cloudPull = { at: 0, ok: null, rows: 0, applied: [], kept: 0, rejected: 0, error: '' };
  function pullCloud(opts) {
    opts = opts || {};
    var res = { at: Date.now(), ok: false, rows: 0, applied: [], kept: 0, rejected: 0, error: '' };
    function done() { cloudPull = res; return res; }
    if (!(window.PalSync && window.PalSync.hasSession && window.PalSync.hasSession())) { res.error = 'no session'; return Promise.resolve(done()); }
    var uid = window.PalSync.getUserId();
    var allow = Array.isArray(opts.apps) ? opts.apps : null;
    return Promise.resolve(window.PalSync.fetchTableRows(CLOUD_TABLE)).then(function (rows) {
      res.rows = rows.length;
      rows.forEach(function (r) {
        var id = r && r.record_key, c = r && r.data;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(id) || !c || typeof c !== 'object' || c.v !== 1 || c.appId !== id || c.userId !== uid || (allow && allow.indexOf(id) < 0)) { res.rejected++; return; }
        var cb = Date.parse(c.built); if (isNaN(cb)) { res.rejected++; return; }
        var loc = read(id), lb = loc && loc.userId === uid ? Date.parse(loc.built) : 0;
        if (lb && lb >= cb) { res.kept++; return; }
        var json = JSON.stringify(c);
        if (json.length * 2 / 1024 > MAX_KB) { res.rejected++; return; }
        var w; try { w = window.PalSync.cacheSet ? window.PalSync.cacheSet(PREFIX + id, json) : (localStorage.setItem(PREFIX + id, json), { stored: true }); } catch (e) { w = null; }
        if (w && w.stored) res.applied.push(id); else res.rejected++;
      });
      res.ok = true; return done();
    }).catch(function (e) {
      res.error = (e && e.status === 404) ? 'table missing' : clip(e && e.message || String(e), 160);
      return done();
    });
  }
  function kbOf(json) { return json.length * 2 / 1024; }
  // v1.3: delete the value at a dot path ('summary.card.wishlist'); a missing path is ignored.
  function dropPath(o, path) {
    var p = String(path).split('.'), cur = o;
    for (var i = 0; i < p.length - 1; i++) { cur = cur && cur[p[i]]; if (!cur || typeof cur !== 'object') return; }
    if (cur && /^[A-Za-z0-9_]+$/.test(p[p.length - 1])) delete cur[p[p.length - 1]];
  }
  // v1.3: the refused publish leaves the older contract in place; this adds a small `stale` note to it (or writes a marker when there is none).
  function markStale(appId, userId, kb) {
    try {
      var cur = read(appId), m;
      if (cur && cur.userId === userId) m = cur;
      else m = { v: 1, appId: appId, userId: userId, built: new Date(0).toISOString() };
      m.stale = { reason: 'too-large', at: new Date().toISOString(), kb: kb };
      var j = JSON.stringify(m);
      if (window.PalSync && window.PalSync.cacheSet) window.PalSync.cacheSet(PREFIX + appId, j); else localStorage.setItem(PREFIX + appId, j);
    } catch (e) {}
  }
  function publish(appId, payload, opts) {
    try {
      var userId = (opts && opts.userId) || (window.PalSync && window.PalSync.getUserId && window.PalSync.getUserId());
      if (!appId || !userId) return { stored: false, reason: 'no-user' };
      payload = payload || {};
      var o = { v: 1, appId: appId, userId: userId, built: new Date().toISOString() };
      if (payload.summary && typeof payload.summary === 'object') o.summary = payload.summary;
      var up = cleanList(payload.upcoming, CAPS.upcoming, { id: 120, date: 10, time: 5, title: 120, sub: 160, kind: 24, open: 'open' });
      var at = cleanList(payload.attention, CAPS.attention, { id: 120, level: 8, title: 120, sub: 160, due: 10, until: 10, open: 'open' });
      var se = cleanList(payload.search, CAPS.search, { id: 120, t: 120, s: 120, k: 24, d: 10, open: 'open' });
      if (up) o.upcoming = up; if (at) o.attention = at; if (se) o.search = se;
      // v1.2: optional metadata (all additive)
      if (payload.app) o.app = clip(payload.app, 24);
      if (payload.schema != null && payload.schema !== '') o.schema = clip(payload.schema, 24);
      var cp = cleanCaps(payload.caps); if (cp) o.caps = cp;
      try { if (window.PalShared && window.PalShared.VERSION) o.lib = String(window.PalShared.VERSION).slice(0, 12); } catch (x) {}
      var json = JSON.stringify(o);
      if (kbOf(json) > MAX_KB && o.search) {   // trim the (reserved) search list first
        while (o.search.length && kbOf(JSON.stringify(o)) > MAX_KB) o.search.length = Math.floor(o.search.length / 2);
        o.trimmed = true;
        json = JSON.stringify(o);
      }
      var steps = opts && Array.isArray(opts.trim) ? opts.trim.slice(0, 3) : [], used = 0;   // v1.3: the app's own trim ladder
      if (steps.length && kbOf(json) > MAX_KB && o.summary) { try { o.summary = JSON.parse(JSON.stringify(o.summary)); } catch (x) {} }   // trim a copy: the summary object belongs to the app and must never be edited in place
      for (var i = 0; i < steps.length && kbOf(json) > MAX_KB; i++) {
        try { if (typeof steps[i] === 'function') steps[i](o); else dropPath(o, steps[i]); } catch (x) {}
        used = i + 1; o.trim = used; json = JSON.stringify(o);
      }
      if (kbOf(json) > MAX_KB) {   // nothing fits: keep the older contract and mark it, never show old data as current
        var kbNow = Math.round(kbOf(json));
        markStale(appId, userId, kbNow);
        try { console.warn('PalContract: ' + appId + ' is ' + kbNow + ' KB, over the ' + MAX_KB + ' KB limit; the older copy is kept and marked stale.'); } catch (x) {}
        return { stored: false, reason: 'too-large', stale: true, kb: kbNow };
      }
      try { scheduleCloud(appId, o); } catch (x) {}   // v1.2: cloud copy, never blocks or throws (v1.3: made from the trimmed contract)
      var res = window.PalSync && window.PalSync.cacheSet ? window.PalSync.cacheSet(PREFIX + appId, json) : null;
      if (!res) { localStorage.setItem(PREFIX + appId, json); res = { stored: true, mode: 'local' }; }
      if (used && res && typeof res === 'object') res.trimmed = used;
      return res;
    } catch (e) { return { stored: false, reason: 'error' }; }
  }
  // ── Universal Search index (v11.38) ──────────────────────────────────────────────────────────────────────────────
  // One IndexedDB record per app { appId, v, userId, built, total, rows }. Derived cache like the rest of PalContract: only the launcher's
  // search reads it, the app never does, and clearAll() (sign-out) empties it. Writes are debounced per app (saves can be frequent) and every
  // failure is swallowed: no IndexedDB (private mode, old browser) simply means no results from that app.
  var DB = 'pal_x_db', STORE = 'search', SEARCH_MAX = 3000, _timers = {};
  function db() {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'appId' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error('blocked')); };
      } catch (e) { rej(e); }
    });
  }
  function publishSearch(appId, rows, total, opts) {
    try {
      if (!appId || !Array.isArray(rows)) return;
      var userId = (opts && opts.userId) || (window.PalSync && window.PalSync.getUserId && window.PalSync.getUserId());
      if (!userId) return;
      clearTimeout(_timers[appId]);
      _timers[appId] = setTimeout(function () {
        try {
          var clean = cleanList(rows, SEARCH_MAX, { id: 120, t: 120, s: 160, k: 24, d: 10, open: 'open' }).filter(function (r) { return r.t; });
          var rec = { appId: appId, v: 1, userId: userId, built: new Date().toISOString(), total: Math.max(total || 0, clean.length), rows: clean };
          db().then(function (d) {
            var tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(rec);
            tx.oncomplete = function () { d.close(); }; tx.onerror = function () { d.close(); };
          }).catch(function () {});
        } catch (e) {}
      }, (opts && opts.delay != null) ? opts.delay : 1200);
    } catch (e) {}
  }
  // Resolves { appId: { rows, total, built } } for records published by this user only. Never rejects.
  function readSearchAll(userId) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var out = {}, tx = d.transaction(STORE, 'readonly'), rq = tx.objectStore(STORE).getAll();
        rq.onsuccess = function () {
          (rq.result || []).forEach(function (r) { if (r && r.v === 1 && r.userId === userId && Array.isArray(r.rows)) out[r.appId] = { rows: r.rows, total: r.total || r.rows.length, built: r.built }; });
          d.close(); res(out);
        };
        rq.onerror = function () { d.close(); res({}); };
      });
    }).catch(function () { return {}; });
  }
  function clearSearch() {
    try { db().then(function (d) { var tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = function () { d.close(); }; tx.onerror = function () { d.close(); }; }).catch(function () {}); } catch (e) {}
  }
  function read(appId) {
    try { var o = JSON.parse(localStorage.getItem(PREFIX + appId) || 'null'); return (o && o.v === 1 && o.appId === appId) ? o : null; }
    catch (e) { return null; }
  }
  function clearAll() {
    try {
      var del = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) del.push(k); }
      del.forEach(function (k) { localStorage.removeItem(k); });
      clearSearch();   // v11.38
      Object.keys(_tm).forEach(function (a) { if (_tm[a]) clearTimeout(_tm[a]); }); _pend = {}; _tm = {};   // v1.2: nothing waiting for the cloud outlives the user
      return del.length;
    } catch (e) { return 0; }
  }
  // v11.38: Cmd/Ctrl+K pressed while an app (inside the launcher) has the focus is handed to the launcher, which opens Universal Search.
  // Only acts when embedded; a standalone app is untouched. Harmless if the launcher does not know the message.
  try {
    if (window.parent && window.parent !== window) {
      window.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 'k') {
          e.preventDefault();
          try { window.parent.postMessage({ type: 'PAL_SEARCH' }, window.location.origin); } catch (x) {}
        }
      });
    }
  } catch (e) {}
  return { publish: publish, read: read, clearAll: clearAll, publishSearch: publishSearch, readSearchAll: readSearchAll, clearSearch: clearSearch, PREFIX: PREFIX, VERSION: 1,
           pullCloud: pullCloud, cloudStatus: function () { return { push: cloud, pull: cloudPull }; } };   // v1.2 (pal-shared 1.5.0)
})();

// ═════════════════════════════════════════════════════════════════�
// PalBridge (bundle 1.5.0, Suite Phase 2 Batch A): one message envelope between the launcher and an app frame. ADDITIVE and OPT-IN: no app
// calls it yet, and the existing per-app messages (OB_ACTION, GYM_ACTION, RT_ACTION, CT_ACTION and their replies) are untouched.
//   App side:      PalBridge.listen('GYM', { quickAddWater: function (msg) { ...return a value or a Promise... } }, { app: '2.144' })
//   Launcher side: bridgeCall(frame, 'GYM', 'quickAddWater', { ml: 250 })   (defined in index.html)
// Protocol (same origin only; both sides check event.origin):
//   launcher -> app  { type: '<PFX>_ACTION', action, reqId, ...payload }
//   action 'ping'    -> app replies { type: '<PFX>_PONG', reqId, ready: true, app, lib }   (the shape the four existing handshakes already use)
//   any other action -> app replies { type: '<PFX>_RESULT', reqId, action, ok: true|false, result | error }
// An action with no handler replies ok:false, error:'unknown action', so the launcher never waits for a timeout to find that out.
// ═════════════════════════════════════════════════════════════════�
window.PalBridge = (function () {
  var VERSION = 1;
  function listen(prefix, handlers, info) {
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(String(prefix))) return false;
    handlers = handlers || {}; info = info || {};
    window.addEventListener('message', function (ev) {
      try {
        if (ev.origin !== window.location.origin) return;
        var d = ev.data;
        if (!d || d.type !== prefix + '_ACTION' || !ev.source) return;
        var reply = function (m) { try { ev.source.postMessage(m, window.location.origin); } catch (x) {} };
        if (d.action === 'ping') {
          reply({ type: prefix + '_PONG', reqId: d.reqId, ready: true, app: info.app || '', lib: (window.PalShared && window.PalShared.VERSION) || '' });
          return;
        }
        var h = handlers[d.action];
        if (typeof h !== 'function') { reply({ type: prefix + '_RESULT', reqId: d.reqId, action: d.action, ok: false, error: 'unknown action' }); return; }
        Promise.resolve().then(function () { return h(d); }).then(
          function (r) { reply({ type: prefix + '_RESULT', reqId: d.reqId, action: d.action, ok: true, result: r === undefined ? null : r }); },
          function (e) { reply({ type: prefix + '_RESULT', reqId: d.reqId, action: d.action, ok: false, error: String(e && e.message || e).slice(0, 200) }); }
        );
      } catch (e) {}
    });
    return true;
  }
  return { listen: listen, VERSION: VERSION };
})();

// ══════════════════════════════════════════════════════════════════
// SECTION 4d of 5 — PalRestore + PalUI (bundle 1.7.0, 5 Nov 2026, Suite Phase 3, R34). ADDITIVE and OPT-IN: no app calls anything here yet.
// ══════════════════════════════════════════════════════════════════
/**
 * PalSync.restorePreview(tableName, backupRecords, opts)  (decision D11, design in Phase2Close.md 2.4). Read only: it fetches this user's cloud rows
 *   and says what restoring `backupRecords` would do, record by record. Never writes. Resolves { ok:true, ... } or { ok:false, error } (no session,
 *   offline, table error), so the caller can fall back to a plain confirmation.
 *   opts: idField 'id' | updatedAtField 'updated_at' (the same two names pull() takes) | prefix '' | shared false (as table()) |
 *         authoritative false (true = the app's restore re-stamps its records so the backup wins; Gym and Reading) | label fn(record) -> name | maxNames 5
 *   Groups (counts, first names, and ids for the later report):
 *     return     in the backup but not in the cloud, or deleted in the cloud before the backup's time (or always when authoritative)
 *     replace    in both, different, and the backup is newer (or authoritative)
 *     keep       in both, different, and the cloud is newer or the same age: the cloud copy stays
 *     deleted    deleted in the cloud after the backup's time: stays deleted
 *     onlyCloud  in the cloud (not deleted) but not in the backup: added since, a restore never removes these
 *     unchanged  identical apart from the timestamp
 *   Ties go to the cloud, matching pull() (last write wins, the cloud copy on equal stamps).
 * PalSync.restoreReport(tableName, backupRecords, preview, opts)  after the restore AND the next completed sync: fetches again and says how many of the
 *   records predicted to return / be replaced are now in the cloud as the backup had them. { ok, returned, returnedOf, replaced, replacedOf, notReturned[], notReplaced[] }.
 * PalUI (small, self-contained, styled from the page's own colours and font so each app keeps its identity):
 *   confirm({ title, message, rows:[{label,value,names?}], okLabel, cancelLabel, danger, hideCancel }) -> Promise<boolean>   (Esc, backdrop or Cancel = false)
 *   notice({ title, message, rows, okLabel }) -> Promise<true>
 *   toast(message, { ms, action:{label,onClick} })       one at a time, role=status
 *   restoreSummary(counts, noun) -> "Restoring will bring back 4 items, replace 2, and keep 11 added since."
 *   confirmRestore({ app, preview, noun, extra }) -> Promise<boolean>     the warning before a restore; with an { ok:false } preview it says the cloud could not be checked
 *   showRestoreReport({ app, report, noun }) -> Promise<true>             the message after
 * Sheet, loading and error components are deliberately not here yet: no app needs them, and unused abstraction is what the programme avoids.
 */
(function () {
  if (!window.PalSync) return;
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  function bare(o, upF) {
    var c = {}; Object.keys(o || {}).forEach(function (k) { if (k !== upF && k !== 'updated_at' && k !== 'updatedAt') c[k] = o[k]; });
    return c;
  }
  function stampOf(rec, upF, row) { var v = rec && rec[upF]; return v ? String(v) : (row && row.updated_at ? String(row.updated_at) : ''); }
  function opt(o) {
    o = o || {};
    return { idF: o.idField || 'id', upF: o.updatedAtField || 'updated_at', prefix: o.prefix || '', shared: !!o.shared, auth: !!o.authoritative,
      max: o.maxNames > 0 ? o.maxNames : 5, label: typeof o.label === 'function' ? o.label : function (r) { return r.title || r.name || r.label || r.id; } };
  }
  function lbl(o, r) { try { var s = o.label(r); return String(s == null ? r[o.idF] : s).slice(0, 60); } catch (e) { return String(r[o.idF]); } }
  function cloudMap(rows, o) {
    var m = {};
    rows.forEach(function (row) {
      if (o.prefix && String(row.record_key).indexOf(o.prefix) !== 0) return;
      var d = row.data; if (!d || d[o.idF] == null || d[o.idF] === '') return;
      m[String(d[o.idF])] = { data: d, row: row };
    });
    return m;
  }
  function fetchCloud(tableName, o) {
    return Promise.resolve(window.PalSync.fetchTableRows(tableName, { shared: o.shared })).then(function (rows) { return { ok: true, rows: rows }; },
      function (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; });
  }
  function restorePreview(tableName, backup, opts) {
    var o = opt(opts);
    if (!window.PalSync.hasSession || !window.PalSync.hasSession()) return Promise.resolve({ ok: false, error: 'no session' });
    if (!Array.isArray(backup)) return Promise.resolve({ ok: false, error: 'no backup records' });
    return fetchCloud(tableName, o).then(function (f) {
      if (!f.ok) return f;
      var cloud = cloudMap(f.rows, o), seen = {};
      var G = { return: [], replace: [], keep: [], deleted: [], onlyCloud: [], unchanged: [] }, N = { return: [], replace: [], keep: [], deleted: [], onlyCloud: [], unchanged: [] };
      function add(g, id, name) { G[g].push(id); if (N[g].length < o.max) N[g].push(name); }
      var skipped = 0;
      backup.forEach(function (b) {
        if (!b || b[o.idF] == null || b[o.idF] === '' || b._deleted) { skipped++; return; }
        var id = String(b[o.idF]), c = cloud[id], bs = stampOf(b, o.upF), name = lbl(o, b);
        seen[id] = 1;
        if (!c) { add('return', id, name); return; }
        var cs = stampOf(c.data, o.upF, c.row);
        if (c.data._deleted) { if (o.auth || bs > cs) add('return', id, name); else add('deleted', id, name); return; }
        if (canon(bare(b, o.upF)) === canon(bare(c.data, o.upF))) { add('unchanged', id, name); return; }
        if (o.auth || bs > cs) add('replace', id, name); else add('keep', id, name);
      });
      Object.keys(cloud).forEach(function (id) { if (!seen[id] && !cloud[id].data._deleted) add('onlyCloud', id, lbl(o, cloud[id].data)); });
      var counts = {}; Object.keys(G).forEach(function (g) { counts[g] = G[g].length; });
      return { ok: true, table: tableName, at: new Date().toISOString(), total: backup.length, skipped: skipped, authoritative: o.auth, counts: counts, names: N, ids: G };
    });
  }
  function restoreReport(tableName, backup, preview, opts) {
    var o = opt(opts);
    if (!preview || !preview.ok) return Promise.resolve({ ok: false, error: 'no preview' });
    return fetchCloud(tableName, o).then(function (f) {
      if (!f.ok) return f;
      var cloud = cloudMap(f.rows, o), by = {};
      (backup || []).forEach(function (b) { if (b && b[o.idF] != null) by[String(b[o.idF])] = b; });
      function now(id) { var b = by[id], c = cloud[id]; return !!(b && c && !c.data._deleted && canon(bare(b, o.upF)) === canon(bare(c.data, o.upF))); }
      var r = { ok: true, returned: 0, returnedOf: preview.ids.return.length, replaced: 0, replacedOf: preview.ids.replace.length, notReturned: [], notReplaced: [] };
      preview.ids.return.forEach(function (id) { if (now(id)) r.returned++; else if (r.notReturned.length < o.max) r.notReturned.push(lbl(o, by[id] || { id: id })); });
      preview.ids.replace.forEach(function (id) { if (now(id)) r.replaced++; else if (r.notReplaced.length < o.max) r.notReplaced.push(lbl(o, by[id] || { id: id })); });
      return r;
    });
  }
  window.PalSync.restorePreview = restorePreview;
  window.PalSync.restoreReport = restoreReport;

  // ── PalUI ──────────────────────────────────────────────────────────────────
  var queue = Promise.resolve(), toastEl = null, toastTm = 0;
  function rgb(s) { var m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; }
  function theme() {
    var cs = null, bg = null, el = document.body || document.documentElement;
    try { cs = getComputedStyle(el); bg = rgb(cs.backgroundColor); if (!bg || bg[3] === 0) bg = rgb(getComputedStyle(document.documentElement).backgroundColor); } catch (e) {}
    var dark = false; try { dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    if (!bg || bg[3] === 0) bg = dark ? [24, 24, 28, 1] : [255, 255, 255, 1];
    var fg = (cs && rgb(cs.color)) || (bg[0] + bg[1] + bg[2] < 380 ? [240, 240, 240, 1] : [20, 20, 20, 1]);
    var c = function (a, al) { return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (al == null ? 1 : al) + ')'; };
    return { bg: c(bg), fg: c(fg), line: c(fg, .28), soft: c(fg, .08), muted: c(fg, .7), font: (cs && cs.fontFamily) || 'system-ui,sans-serif' };
  }
  function mk(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  function dialog(o, single) {
    return new Promise(function (resolve) {
      var t = theme(), prev = document.activeElement, id = 'palui' + Date.now();
      var wrap = mk('div', 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:' + t.font);
      var box = mk('div', 'background:' + t.bg + ';color:' + t.fg + ';border:1px solid ' + t.line + ';border-radius:14px;width:100%;max-width:420px;max-height:85vh;overflow:auto;padding:18px 18px 14px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.45);font-size:16px;line-height:1.45');
      box.setAttribute('role', single || o.hideCancel ? 'alertdialog' : 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', id + 't');
      var h = mk('div', 'font-size:18px;font-weight:600;margin:0 0 8px', o.title || 'Are you sure?'); h.id = id + 't'; box.appendChild(h);
      if (o.message) { var p = mk('div', 'margin:0 0 10px;color:' + t.muted, o.message); p.id = id + 'm'; box.setAttribute('aria-describedby', id + 'm'); box.appendChild(p); }
      (o.rows || []).forEach(function (r) {
        var row = mk('div', 'border-top:1px solid ' + t.line + ';padding:8px 0');
        var top = mk('div', 'display:flex;justify-content:space-between;gap:12px');
        top.appendChild(mk('span', '', r.label)); top.appendChild(mk('span', 'font-weight:600', String(r.value)));
        row.appendChild(top);
        if (r.names && r.names.length) row.appendChild(mk('div', 'font-size:13px;color:' + t.muted + ';margin-top:2px', r.names.join(', ')));
        box.appendChild(row);
      });
      var bar = mk('div', 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap');
      function done(v) { document.removeEventListener('keydown', onKey, true); wrap.remove(); try { prev && prev.focus && prev.focus(); } catch (e) {} resolve(v); }
      function btn(label, kind, v) {
        var b = mk('button', 'flex:1;min-width:110px;min-height:44px;border-radius:10px;font:600 16px ' + t.font + ';cursor:pointer;padding:8px 14px;' +
          (kind === 'danger' ? 'background:#c62828;color:#fff;border:1px solid #c62828' : kind === 'primary' ? 'background:' + t.fg + ';color:' + t.bg + ';border:1px solid ' + t.fg : 'background:transparent;color:' + t.fg + ';border:1px solid ' + t.line), label);
        b.type = 'button'; b.addEventListener('click', function () { done(v); }); return b;
      }
      var cancel = (single || o.hideCancel) ? null : btn(o.cancelLabel || 'Cancel', 'plain', false);
      var ok = btn(o.okLabel || 'OK', o.danger ? 'danger' : 'primary', true);
      if (cancel) bar.appendChild(cancel); bar.appendChild(ok); box.appendChild(bar); wrap.appendChild(box);
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && cancel) done(false); });
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(cancel ? false : true); return; }
        if (e.key === 'Tab') {
          var f = [].slice.call(box.querySelectorAll('button')); if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(wrap);
      (o.danger && cancel ? cancel : ok).focus();
    });
  }
  function enqueue(fn) { var p = queue.then(fn, fn); queue = p.then(function () {}, function () {}); return p; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function restoreSummary(c, noun) {
    noun = noun || 'item'; c = c || {};
    var a = [];
    if (c.return) a.push('bring back ' + plural(c.return, noun));
    if (c.replace) a.push('replace ' + c.replace);
    if (c.keep) a.push('keep ' + c.keep + ' that changed since');
    if (c.deleted) a.push('leave ' + c.deleted + ' deleted since');
    if (c.onlyCloud) a.push('keep ' + c.onlyCloud + ' added since');
    if (!a.length) return 'Restoring will not change anything.';
    var last = a.pop();
    return 'Restoring will ' + (a.length ? a.join(', ') + ', and ' : '') + last + '.';
  }
  function previewRows(p, noun) {
    var c = p.counts, n = p.names, rows = [];
    function add(g, label) { if (c[g]) rows.push({ label: label, value: c[g], names: n[g] }); }
    add('return', 'Will come back'); add('replace', 'Will be replaced by the backup'); add('keep', 'Kept as they are now (newer)');
    add('deleted', 'Stay deleted'); add('onlyCloud', 'Added since the backup, kept'); add('unchanged', 'Already the same');
    return rows;
  }
  window.PalUI = {
    VERSION: 1,
    confirm: function (o) { return enqueue(function () { return dialog(o || {}, false); }); },
    notice: function (o) { return enqueue(function () { return dialog(o || {}, true); }); },
    toast: function (message, o) {
      o = o || {};
      try {
        var t = theme(); if (toastEl) toastEl.remove(); clearTimeout(toastTm);
        var el = mk('div', 'position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483001;max-width:min(92vw,420px);background:' + t.fg + ';color:' + t.bg + ';border-radius:10px;padding:10px 14px;font:500 15px/1.4 ' + t.font + ';display:flex;gap:12px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.35)');
        el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
        el.appendChild(mk('span', '', message));
        if (o.action && o.action.label) { var b = mk('button', 'background:none;border:0;color:inherit;text-decoration:underline;font:600 15px ' + t.font + ';min-height:32px;cursor:pointer;padding:0 4px', o.action.label); b.type = 'button'; b.addEventListener('click', function () { el.remove(); toastEl = null; try { o.action.onClick && o.action.onClick(); } catch (e) {} }); el.appendChild(b); }
        document.body.appendChild(el); toastEl = el;
        toastTm = setTimeout(function () { if (toastEl === el) { el.remove(); toastEl = null; } }, o.ms || 3500);
      } catch (e) {}
    },
    restoreSummary: restoreSummary,
    confirmRestore: function (o) {
      o = o || {}; var p = o.preview;
      if (!p || !p.ok) return window.PalUI.confirm({ title: 'Restore ' + (o.app || 'this backup') + '?', message: "Couldn't check the cloud copy" + (p && p.error ? ' (' + p.error + ')' : '') + ", so there's no preview of what will change. The restore will run as usual." + (o.extra ? ' ' + o.extra : ''), okLabel: 'Restore', cancelLabel: 'Cancel' });
      return window.PalUI.confirm({ title: 'Restore ' + (o.app || 'this backup') + '?', message: restoreSummary(p.counts, o.noun) + (p.authoritative ? ' This restore replaces the cloud copy of those.' : ' The cloud copy stays in charge where it is newer.') + (o.extra ? ' ' + o.extra : ''), rows: previewRows(p, o.noun), okLabel: 'Restore', cancelLabel: 'Cancel', danger: !!(p.counts.replace || p.counts.return) });
    },
    showRestoreReport: function (o) {
      o = o || {}; var r = o.report;
      if (!r || !r.ok) return window.PalUI.notice({ title: 'Restore finished', message: "Couldn't check the cloud copy afterwards. Open the app on another device to see the result.", okLabel: 'OK' });
      var rows = [];
      if (r.returnedOf) rows.push({ label: 'Came back', value: r.returned + ' of ' + r.returnedOf, names: r.notReturned.length ? ['not back: ' + r.notReturned.join(', ')] : null });
      if (r.replacedOf) rows.push({ label: 'Replaced by the backup', value: r.replaced + ' of ' + r.replacedOf, names: r.notReplaced.length ? ['kept as before: ' + r.notReplaced.join(', ')] : null });
      var all = r.returned === r.returnedOf && r.replaced === r.replacedOf;
      return window.PalUI.notice({ title: 'Restore finished', message: rows.length ? (all ? 'Everything in the backup is now in the cloud copy.' : 'Some records stayed as they were because the cloud copy was newer or deleted.') : 'Nothing needed to change.', rows: rows, okLabel: 'OK' });
    }
  };
})();

// ══════════════════════════════════════════════════════════════════
// SECTION 5 of 5 — PalShared: bundle identity, date helpers, failed-write handler (bundle 1.4.0, 4 Nov 2026, Suite WP1.2 / WP1.4)
// ══════════════════════════════════════════════════════════════════

/**
 * PalShared — identifies this file and holds small shared helpers. Additive: nothing above is changed.
 *   VERSION   bundle version of pal-shared.js (semver). patch = comment/fix with no API change, minor = new function, major = removed/changed function.
 *             1.0.0 localISO. 1.1.0 safeSet, writeFailure, fmtDate, fmtDateTime, parseDate. 1.2.0 ukDateInputs. 1.3.0 ukDateInputs gains a calendar button. 1.3.1 calendar button fixes. 1.4.0 (this release) calendar button reworked: a transparent native date input over the icon.
 *             1.5.0 (Suite Phase 2 Batch A) PalContract 1.2: optional app / schema / caps fields and an automatic lib field, a debounced cloud copy in the pal_contracts table, PalContract.pullCloud() for the launcher; new PalBridge 1.0 (listen). Nothing existing changes; no app uses PalBridge yet.
 *             1.6.0 (Suite Phase 3, R33) PalContract 1.3: optional trim ladder (opts.trim), a `stale` marker when a contract cannot be stored, and the cloud copy made from the trimmed contract. Additive; an app that passes nothing behaves as before except that a refused publish now marks the kept contract stale.
 *             1.7.0 (Suite Phase 3, R34) new section 4d: PalSync.restorePreview / restoreReport (read-only restore preview and report, D11) and PalUI (confirm, notice, toast, restore dialogs). Additive; no app calls them yet.
 *   SECTIONS  versions of the four sections as they stood when VERSION was set (for the launcher's future mismatch report).
 *   localISO(d)   the LOCAL calendar date of Date d (default now) as 'YYYY-MM-DD'; '' for an invalid Date. Use this instead of
 *                 d.toISOString().slice(0, 10), which is the UTC date and a day early for local-midnight dates in British Summer Time.
 *   safeSet(key, value, label)   localStorage.setItem that never throws. Returns true when stored, false when the browser refused
 *                 (storage full or blocked). On failure it tells the user once (a red bar, at most once every 30 seconds) and records
 *                 the failure in PalShared.lastWriteFailure. The caller carries on, so the rest of its save still runs.
 *   writeFailure(label, err)     the reporting half of safeSet, for apps that already have their own try/catch.
 *   fmtDate(v)    UK display date 'dd/mm/yy' (Suite decision D10). v is 'YYYY-MM-DD', a longer ISO timestamp, or a Date. Timestamps and
 *                 Dates are shown in the viewer's local time. '' when invalid.
 *   fmtDateTime(v) 'dd/mm/yy hh:mm' (24 hour, local time). '' when invalid.
 *   parseDate(str) typed date -> 'YYYY-MM-DD'. Accepts d/m/yy, d/m/yyyy (separators / . - or space) and ISO. A two-digit year means 20yy.
 *                 Returns '' when it is not a real calendar date. Stored dates stay ISO; only display and typing are UK.
 */
window.PalShared = (function () {
  function pad2(n) { return String(n).padStart(2, '0'); }
  function localISO(d) {
    d = d || new Date();
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function toDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') { var n = new Date(v); return isNaN(n.getTime()) ? null : n; }
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) { var d0 = new Date(+m[1], +m[2] - 1, +m[3]); return (d0.getFullYear() === +m[1] && d0.getMonth() === +m[2] - 1 && d0.getDate() === +m[3]) ? d0 : null; }
    var d1 = new Date(s);
    return isNaN(d1.getTime()) ? null : d1;
  }
  function fmtDate(v) {
    var d = toDate(v);
    return d ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getFullYear() % 100) : '';
  }
  function fmtDateTime(v) {
    var d = toDate(v);
    return d ? fmtDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '';
  }
  function parseDate(str) {
    var s = String(str == null ? '' : str).trim();
    if (!s) return '';
    var y, mo, da, m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) { y = +m[1]; mo = +m[2]; da = +m[3]; }
    else {
      m = /^(\d{1,2})[\/.\-\s](\d{1,2})[\/.\-\s](\d{2}|\d{4})$/.exec(s);
      if (!m) return '';
      da = +m[1]; mo = +m[2]; y = +m[3];
      if (m[3].length === 2) y += 2000;
    }
    var d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return '';
    return y + '-' + pad2(mo) + '-' + pad2(da);
  }

  var lastWarn = 0;
  var api = { lastWriteFailure: null, writeFailures: 0 };
  function showBar(text) {
    try {
      if (!document.body) return;
      var el = document.getElementById('pal-write-warn');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pal-write-warn';
        el.setAttribute('role', 'alert');
        el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#b3261e;color:#fff;font:600 13px/1.4 -apple-system,system-ui,sans-serif;padding:10px 14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35)';
        el.onclick = function () { el.style.display = 'none'; };
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.style.display = 'block';
      setTimeout(function () { try { el.style.display = 'none'; } catch (e) {} }, 12000);
    } catch (e) {}
  }
  function writeFailure(label, err) {
    api.writeFailures++;
    api.lastWriteFailure = { label: label || '', at: new Date().toISOString(), error: String((err && (err.name || err.message)) || err || '') };
    var now = Date.now();
    if (now - lastWarn < 30000) return;
    lastWarn = now;
    showBar('Could not save your latest change on this device (storage is full or blocked). Take a backup now - changes may be lost if you close the app. Tap to dismiss.');
  }
  function safeSet(key, value, label) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { writeFailure(label || key, e); return false; }
  }

  // ukDateInputs(): shows every <input type="date"> as a dd/mm/yy text box on every device. The native picker follows the
  // device region (not the page language), so it cannot be forced to UK order from the page. The element keeps its id and its
  // .value contract: reading .value returns ISO 'YYYY-MM-DD' (or '' while incomplete/invalid); setting .value takes ISO.
  // Typing 041126 gives 04/11/26. Safe to call more than once; also covers inputs added later (modals).
  var ukOn = false;
  function ukEnhance(el) {
    if (!el || el.__ukd || el.tagName !== 'INPUT' || String(el.type).toLowerCase() !== 'date') return;
    el.__ukd = 1;
    var raw = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    var start = raw.get.call(el);
    el.type = 'text';
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('placeholder', 'dd/mm/yy');
    el.setAttribute('autocomplete', 'off');
    el.maxLength = 10;
    function norm(t) {
      t = String(t == null ? '' : t).trim();
      var m = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(t);
      return m ? m[1] + '/' + m[2] + '/' + m[3] : t;
    }
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return parseDate(norm(raw.get.call(el))); },
      set: function (v) { var p = parseDate(norm(v)); raw.set.call(el, p ? fmtDate(p) : ''); mark(); }
    });
    function mark() {
      var t = raw.get.call(el).trim();
      var bad = t && !parseDate(norm(t));
      el.style.outline = bad ? '2px solid #d33' : '';
      el.title = bad ? 'Enter a date like 27/11/26' : '';
    }
    el.addEventListener('input', function (e) {
      var t = raw.get.call(el);
      if (e && e.inputType && e.inputType.indexOf('delete') === 0) { mark(); return; }
      if (/^\d{2}$/.test(t) || /^\d{2}\/\d{2}$/.test(t)) raw.set.call(el, t + '/');
      mark();
    });
    el.addEventListener('blur', function () {
      var p = parseDate(norm(raw.get.call(el)));
      if (p) raw.set.call(el, fmtDate(p));
      mark();
    });
    el.value = start;
    ukCalendar(el, raw);
  }
  // Calendar button: the icon is a background image inside the right edge of the box, and a transparent NATIVE date input
  // sits exactly over it, so a tap or click lands on a real date control and the device opens its own picker (script-opened
  // pickers on hidden elements are refused by iOS Safari and others). The overlay is positioned from the box's real rectangle
  // and re-checked on resize/scroll/touch and every 150 ms, so layout changes do not leave it behind.
  var ukIcon = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M16 3v4M8 3v4M3 10h18'/%3E%3C/svg%3E\")";
  var ukPairs = [], ukTimer = 0, ukStyled = false;
  var ukIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function ukPlace() {
    for (var i = ukPairs.length - 1; i >= 0; i--) {
      var el = ukPairs[i].el, ov = ukPairs[i].ov;
      if (!el.isConnected) { if (ov.parentNode) ov.parentNode.removeChild(ov); ukPairs.splice(i, 1); continue; }
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.disabled || el.readOnly) { ov.style.display = 'none'; continue; }
      ov.style.display = 'block';
      var w = 42, h = r.height, want = r.right - w;
      if (!ov.__w || ov.__w !== w || ov.__h !== h) { ov.style.width = w + 'px'; ov.style.height = h + 'px'; ov.__w = w; ov.__h = h; }
      var o = ov.getBoundingClientRect();
      var dx = want - o.left, dy = r.top - o.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        ov.style.left = ((parseFloat(ov.style.left) || 0) + dx) + 'px';
        ov.style.top = ((parseFloat(ov.style.top) || 0) + dy) + 'px';
      }
    }
  }
  function ukCalendar(el, raw) {
    var st = el.style;
    // important: some app stylesheets set padding/background with !important (e.g. Gym's session date box)
    st.setProperty('padding-right', '40px', 'important');
    st.setProperty('background-image', ukIcon, 'important');
    st.setProperty('background-repeat', 'no-repeat', 'important');
    st.setProperty('background-position', 'right 10px center', 'important');
    st.setProperty('background-size', '20px 20px', 'important');
    try {
      var mw = parseFloat(getComputedStyle(el).maxWidth);
      if (mw && mw < 150) st.setProperty('max-width', '150px', 'important');
    } catch (x) {}
    if (!ukStyled && document.head) {
      ukStyled = true;
      var css = document.createElement('style');
      css.textContent = 'input.pal-ukd-pick{position:absolute;opacity:0;margin:0;padding:0;border:0;min-width:0;min-height:0;box-sizing:border-box;max-width:none;z-index:5;cursor:pointer;background:transparent;font-size:16px;-webkit-appearance:none}' +
        'input.pal-ukd-pick::-webkit-calendar-picker-indicator{position:absolute;left:0;top:0;width:100%;height:100%;margin:0;padding:0;cursor:pointer}';
      document.head.appendChild(css);
    }
    var ov = document.createElement('input');
    ov.__ukd = 1; ov.type = 'date'; ov.className = 'pal-ukd-pick';
    ov.tabIndex = -1; ov.setAttribute('aria-label', 'Pick date from calendar');
    ov.style.left = '0px'; ov.style.top = '0px';
    function sync() { ov.value = el.value || localISO(new Date()); }
    ['pointerdown', 'touchstart', 'mousedown', 'focus'].forEach(function (t) { ov.addEventListener(t, sync, { passive: true }); });
    ov.addEventListener('click', function () {
      sync();
      if (!ukIOS) { try { ov.showPicker(); } catch (x) {} }
    });
    ov.addEventListener('change', function () {
      if (!ov.value) return;
      el.value = ov.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (el.parentNode) el.parentNode.insertBefore(ov, el.nextSibling);
    ukPairs.push({ el: el, ov: ov });
    ukPlace();
    if (!ukTimer) {
      ukTimer = setInterval(ukPlace, 150);
      window.addEventListener('resize', ukPlace);
      window.addEventListener('scroll', ukPlace, true);
      document.addEventListener('touchstart', ukPlace, { capture: true, passive: true });
      document.addEventListener('focusin', ukPlace, true);
    }
  }
  function ukScan(root) {
    try {
      var list = (root || document).querySelectorAll ? (root || document).querySelectorAll('input[type="date"]') : [];
      for (var i = 0; i < list.length; i++) ukEnhance(list[i]);
      if (root && root.tagName === 'INPUT') ukEnhance(root);
    } catch (e) {}
  }
  function ukDateInputs() {
    if (ukOn) { ukScan(document); return; }
    ukOn = true;
    try {
      ukScan(document);
      document.addEventListener('DOMContentLoaded', function () { ukScan(document); });
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var a = muts[i].addedNodes;
          for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) ukScan(a[j]);
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  api.VERSION = '1.7.0';
  api.SECTIONS = { config: '1.2', sync: '1.13', utils: 'unversioned', contract: '1.3', bridge: '1.0', restore: '1.0', ui: '1.0' };
  api.localISO = localISO; api.safeSet = safeSet; api.writeFailure = writeFailure;
  api.fmtDate = fmtDate; api.fmtDateTime = fmtDateTime; api.parseDate = parseDate; api.ukDateInputs = ukDateInputs;
  return api;
})();
