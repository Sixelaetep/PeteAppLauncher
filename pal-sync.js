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

  // ── Session (PAL_SESSION / PAL_UNLOCKED, with origin guard) ──────────
  // Call once at startup. onSession fires every time a session arrives
  // (including re-auth after expiry). onNoSession fires once if nothing
  // arrives within noSessionMs (default 3000) — apps use this to show a
  // "not connected" banner, same as every app already does.
  function initSession(opts) {
    opts = opts || {};
    if (!_listenerAttached) {
      _listenerAttached = true;
      window.addEventListener('message', function (e) {
        if (e.origin !== window.location.origin) return;
        if (e.data && (e.data.type === 'PAL_SESSION' || e.data.type === 'PAL_UNLOCKED')) {
          _token  = e.data.access_token || null;
          _userId = e.data.user_id || null;
          if (_token && _userId) {
            _sessionCallbacks.forEach(function (fn) { fn(_token, _userId); });
          }
        }
      });
    }
    if (opts.onSession) _sessionCallbacks.push(opts.onSession);
    if (opts.onNoSession) {
      setTimeout(function () {
        if (!_token) opts.onNoSession();
      }, opts.noSessionMs || 3000);
    }
  }

  function hasSession() { return !!(_token && _userId); }
  function getUserId()  { return _userId; }

  // ── Low-level REST wrapper ────────────────────────────────────────
  async function sbFetch(path, method, body) {
    method = method || 'GET';
    const headers = {
      'apikey':        window.PAL_CONFIG.SB_KEY,
      'Authorization': 'Bearer ' + _token,
      'Content-Type':  'application/json',
      'Prefer':        method === 'PATCH' ? 'return=representation'
                       : method === 'DELETE' ? 'return=minimal' : ''
    };
    const opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(window.PAL_CONFIG.SB_URL + '/rest/v1' + path, opts);
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
    async function upsert(id, data) {
      if (!hasSession()) return;
      const recordKey = prefix + id;
      const row = { user_id: _userId, record_key: recordKey, data: data, updated_at: new Date().toISOString() };
      const patch = await sbFetch(
        '/' + tableName + '?user_id=eq.' + _userId + '&record_key=eq.' + encodeURIComponent(recordKey),
        'PATCH', row
      );
      if (patch.ok) {
        const body = await patch.json();
        if (Array.isArray(body) && body.length === 0) {
          const post = await sbFetch('/' + tableName, 'POST', row);
          if (!post.ok) throw new Error('POST failed: ' + (await post.text()));
        }
      } else {
        throw new Error('PATCH failed: ' + (await patch.text()));
      }
    }

    // Soft-delete: upsert the same record with _deleted:true baked into
    // its data, rather than a hard DELETE. Keeps the row visible to other
    // devices so their next pull removes it locally too, instead of
    // silently vanishing (the exact bug this library exists to prevent).
    async function tombstone(id, currentData) {
      const dead = Object.assign({}, currentData, { _deleted: true, updated_at: new Date().toISOString() });
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
    async function pull(localRecords, idField, updatedAtField) {
      idField = idField || 'id';
      updatedAtField = updatedAtField || 'updated_at';
      if (!hasSession()) return { merged: localRecords, pushedCount: 0, rows: [], skipped: true };

      const res = await sbFetch('/' + tableName + '?user_id=eq.' + _userId + '&select=record_key,data,updated_at');
      if (!res.ok) throw new Error(res.status + ' ' + (await res.text()));
      const allRows = await res.json();
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
        if (!local || (remote[updatedAtField] || '') > (local[updatedAtField] || '')) {
          localMap[remote[idField]] = remote;
        }
      });

      // Derived from each row's own data[idField], not the raw record_key —
      // safe regardless of whether this instance uses a prefix.
      const cloudIds  = new Set(rows.map(function (r) { return r.data && r.data[idField]; }).filter(Boolean));
      const localOnly = Object.values(localMap).filter(function (r) { return !r._deleted && !cloudIds.has(r[idField]); });
      for (const r of localOnly) await upsert(r[idField], r);

      const merged = Object.values(localMap).filter(function (r) { return !r._deleted; });
      return { merged: merged, pushedCount: localOnly.length, rows: allRows, skipped: false };
    }

    return { upsert: upsert, tombstone: tombstone, pull: pull };
  }

  return {
    initSession: initSession,
    hasSession:  hasSession,
    getUserId:   getUserId,
    sbFetch:     sbFetch,
    table:       table
  };
})();
