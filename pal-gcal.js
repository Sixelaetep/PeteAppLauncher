/*
 * pal-gcal.js — PGC-002 (v2: updateEvent gains optional expectEtag, GIG-102)
 * ─────────────────────────────────────────────────────────────────────────
 * Shared Google Calendar access layer. Separate from pal-shared.js on
 * purpose: pal-shared.js is loaded by every app in the suite, and this is
 * unproven-at-scale (one consumer so far: PeteGCal). If this needs a
 * breaking change later, nothing else is put at risk.
 *
 * Scope requested: https://www.googleapis.com/auth/calendar.events
 * (read/write events on any calendar the signed-in account has
 * edit-or-above access to — including a calendar shared with that
 * account, not just its own primary). No calendar-settings or
 * calendar-list scope requested; not needed for anything PeteGCal does.
 *
 * Load order: include the Google Identity Services script before this
 * file in the consuming app's <head>:
 *   <script src="https://accounts.google.com/gsi/client" async defer></script>
 *   <script src="pal-gcal.js?v=1"></script>
 *
 * Usage sketch (full flow documented per-function below):
 *   PalGCal.init({
 *     clientId: '...',
 *     onAuthChange: function (signedIn) { ... },
 *     onTokenRefreshed: function (expiresAt) { ... },
 *     onAuthError: function (reason) { ... }
 *   });
 *   PalGCal.signIn();
 *   const events = await PalGCal.listEvents('primary', minISO, maxISO);
 *   const created = await PalGCal.createEvent('primary', {
 *     summary: 'Gig at the Barrowlands',
 *     start: { dateTime: startISO }, end: { dateTime: endISO }
 *   }, { type: 'gig', venue: 'The Barrowlands' });
 */
window.PalGCal = (function () {

  const API_BASE = 'https://www.googleapis.com/calendar/v3';
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const META_NAMESPACE = 'petegcal'; // extendedProperties.private key prefix

  let _clientId = null;
  let _tokenClient = null;
  let _accessToken = null;
  let _tokenExpiresAt = null;
  let _autoRefreshTimer = null;

  let _onAuthChange = function () {};
  let _onTokenRefreshed = function () {};
  let _onAuthError = function () {};
  let _onInitFailed = function () {};
  let _initAttempts = 0;
  const INIT_MAX_ATTEMPTS = 20; // ~6s at 300ms apart, then give up loudly

  // ── Init ──────────────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    _clientId = opts.clientId;
    if (opts.onAuthChange) _onAuthChange = opts.onAuthChange;
    if (opts.onTokenRefreshed) _onTokenRefreshed = opts.onTokenRefreshed;
    if (opts.onAuthError) _onAuthError = opts.onAuthError;
    // Distinct from onAuthError: this fires only if Google's own sign-in
    // script never becomes available at all (blocked by a content
    // blocker/extension, stale cache, or a genuine network failure) —
    // not a sign-in attempt that was made and rejected. Without this,
    // the retry loop below would wait forever in total silence.
    if (opts.onInitFailed) _onInitFailed = opts.onInitFailed;

    _initAttempts = 0;
    _tryInit();
  }

  function _tryInit() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: _clientId,
        scope: SCOPE,
        callback: _onTokenResponse
      });
      return;
    }
    _initAttempts++;
    if (_initAttempts > INIT_MAX_ATTEMPTS) {
      _onInitFailed('Google sign-in script never loaded (accounts.google.com/gsi/client) — check for a content blocker/extension, or try a hard refresh.');
      return;
    }
    setTimeout(_tryInit, 300);
  }

  function _onTokenResponse(resp) {
    if (resp.error) {
      _onAuthError(resp.error);
      return;
    }
    _accessToken = resp.access_token;
    const expiresIn = parseInt(resp.expires_in, 10) || 3600;
    _tokenExpiresAt = Date.now() + expiresIn * 1000;
    _scheduleAutoRefresh(expiresIn);
    _onAuthChange(true);
    _onTokenRefreshed(_tokenExpiresAt);
  }

  function _scheduleAutoRefresh(expiresInSec) {
    if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
    const refreshInMs = Math.max((expiresInSec - 300) * 1000, 5000); // 5 min before expiry
    _autoRefreshTimer = setTimeout(function () {
      // prompt: '' = silent refresh attempt, no popup if the browser
      // session is still valid. In Testing mode (Auth Platform), Google
      // caps this at ~7 days before a real re-login is required — that
      // surfaces here as _onAuthError if the silent attempt fails.
      _tokenClient.requestAccessToken({ prompt: '' });
    }, refreshInMs);
  }

  // ── Auth state ────────────────────────────────────────────────────────

  function signIn() {
    if (!_tokenClient) { _onAuthError('not-initialised'); return; }
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken, function () {});
    }
    _accessToken = null;
    _tokenExpiresAt = null;
    if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
    _onAuthChange(false);
  }

  function hasToken() {
    return !!(_accessToken && _tokenExpiresAt && Date.now() < _tokenExpiresAt);
  }

  function getTokenExpiry() {
    return _tokenExpiresAt;
  }

  // Force a token refresh attempt right now (silent — no popup unless the
  // browser session itself has gone). Exposed for a UI "Reconnect" button.
  function requestTokenRefresh() {
    if (!_tokenClient) { _onAuthError('not-initialised'); return; }
    _tokenClient.requestAccessToken({ prompt: '' });
  }

  // ── Low-level fetch wrapper ──────────────────────────────────────────

  async function _apiFetch(path, method, body) {
    if (!hasToken()) {
      throw _err('no-token', 'No valid access token. Call signIn() first.');
    }
    const resp = await fetch(API_BASE + path, {
      method: method || 'GET',
      headers: Object.assign(
        { 'Authorization': 'Bearer ' + _accessToken },
        body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: body ? JSON.stringify(body) : undefined
    });

    if (resp.status === 401) {
      // Token expired/revoked server-side ahead of our own clock's
      // expectation. Clear local state and let the caller prompt re-auth
      // rather than silently retry — avoids a loop against a dead token.
      _accessToken = null;
      _tokenExpiresAt = null;
      _onAuthChange(false);
      throw _err('unauthorized', 'Google rejected the token — sign-in required again.');
    }

    const data = await resp.json().catch(function () { return null; });

    if (!resp.ok) {
      throw _err(
        'api-error',
        (data && data.error && data.error.message) || ('Request failed (' + resp.status + ')'),
        resp.status,
        data
      );
    }
    return data;
  }

  function _err(code, message, status, data) {
    const e = new Error(message);
    e.code = code;
    if (status) e.status = status;
    if (data) e.data = data;
    return e;
  }

  // Same spirit as PalSync.errorHint — a short, human string for a UI to
  // show without every caller re-deriving it from status codes.
  function errorHint(err) {
    if (!err) return '';
    if (err.code === 'no-token' || err.code === 'unauthorized') return 'Sign-in needed';
    if (err.status === 403) return 'Permission denied on this calendar';
    if (err.status === 404) return 'Event or calendar not found';
    if (err.status === 429) return 'Rate limited — try again shortly';
    if (err.status >= 500) return 'Google Calendar is having issues — try again shortly';
    return err.message || 'Something went wrong';
  }

  // ── extendedProperties helpers ───────────────────────────────────────
  // App-only metadata (type, venue, trip-provenance) rides inside
  // extendedProperties.private under one namespaced key, so it survives
  // alongside the real event and never collides with anything another
  // tool might store in extendedProperties.

  // Call before createEvent/updateEvent to attach app metadata onto the
  // event body you're about to send.
  function withAppMeta(eventBody, meta) {
    const body = Object.assign({}, eventBody);
    const existing = (body.extendedProperties && body.extendedProperties.private) || {};
    body.extendedProperties = {
      private: Object.assign({}, existing, { [META_NAMESPACE]: JSON.stringify(meta || {}) })
    };
    return body;
  }

  // Call on a fetched event to read app metadata back out. Returns {} for
  // an event that's never been touched by PeteGCal (e.g. a native
  // Calendar entry never enriched) — callers treat that as "untyped /
  // defaults", not an error.
  function readAppMeta(event) {
    try {
      const raw = event && event.extendedProperties && event.extendedProperties.private
        && event.extendedProperties.private[META_NAMESPACE];
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // ── Event CRUD ────────────────────────────────────────────────────────

  // Fetches every event in [timeMinISO, timeMaxISO) on the given calendar,
  // paginating internally — callers get one flat array back, no manual
  // nextPageToken handling. No filtering: every event on the calendar in
  // range comes back, per the "full mirror, no exclusions" design.
  async function listEvents(calendarId, timeMinISO, timeMaxISO, opts) {
    opts = opts || {};
    let all = [];
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        singleEvents: 'true',   // expand recurring events into instances
        orderBy: 'startTime',
        maxResults: String(opts.pageSize || 250)
      });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await _apiFetch(
        '/calendars/' + encodeURIComponent(calendarId) + '/events?' + params.toString()
      );
      all = all.concat(data.items || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return all;
  }

  // meta (optional): app metadata object to attach via extendedProperties
  // before sending, e.g. { type: 'gig', venue: 'The Barrowlands', origin: 'app' }.
  async function createEvent(calendarId, eventBody, meta) {
    const body = meta ? withAppMeta(eventBody, meta) : eventBody;
    return _apiFetch('/calendars/' + encodeURIComponent(calendarId) + '/events', 'POST', body);
  }

  // patchBody: only the fields being changed. meta (optional): if given,
  // merges into whatever app metadata the event already has rather than
  // replacing it wholesale — so enriching just the venue on a native
  // Calendar event doesn't require re-sending a type you didn't touch.
  //
  // opts (optional, added v2): { expectEtag } — if given, the event is fetched
  // first (reusing the fetch the meta merge already needs, so no extra call
  // when meta is also passed) and the update is refused with an error whose
  // code is 'etag-mismatch' (status 412, e.data = the event as it currently
  // is in Google) if its etag differs. This is how a caller avoids silently
  // overwriting an edit made in Google since its last sync. Callers that do
  // not pass opts behave exactly as before.
  async function updateEvent(calendarId, eventId, patchBody, meta, opts) {
    opts = opts || {};
    let body = patchBody;
    if (meta || opts.expectEtag) {
      // Merge against existing meta: fetch-then-merge, since PATCH bodies
      // for extendedProperties replace the whole private map, not just
      // the one key.
      const current = await _apiFetch(
        '/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(eventId)
      );
      if (opts.expectEtag && current && current.etag && current.etag !== opts.expectEtag) {
        throw _err('etag-mismatch', 'Event changed in Google Calendar since the last sync', 412, current);
      }
      if (meta) {
        const existingMeta = readAppMeta(current);
        body = withAppMeta(patchBody, Object.assign({}, existingMeta, meta));
      }
    }
    return _apiFetch(
      '/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(eventId),
      'PATCH',
      body
    );
  }

  // Always a real delete against Google Calendar — per the house rule
  // that "delete" in the app means delete the real event, regardless of
  // whether it originated in the app or was created natively.
  async function deleteEvent(calendarId, eventId) {
    return _apiFetch(
      '/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(eventId),
      'DELETE'
    );
  }

  async function getEvent(calendarId, eventId) {
    return _apiFetch(
      '/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(eventId)
    );
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    hasToken: hasToken,
    getTokenExpiry: getTokenExpiry,
    requestTokenRefresh: requestTokenRefresh,
    errorHint: errorHint,
    withAppMeta: withAppMeta,
    readAppMeta: readAppMeta,
    listEvents: listEvents,
    createEvent: createEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    getEvent: getEvent
  };

})();
