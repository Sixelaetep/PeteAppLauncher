/*
 * pal-gcal.js — PGC-002 (v5.0, GCAL-AUTH-001: new OPT-IN authMode:'explicit'. In that mode this library NEVER starts a Google sign-in or opens an authentication window by itself — no tap/key listeners, no timers, no lifecycle (visibilitychange) renewals, no renewal from an API call. A stored token is restored while it is valid; when it has expired the library only reports it (onAuthRequired, getAuthState) and signIn() — called from a deliberate tap — is the only thing that starts authentication. A failed or blocked sign-in is reported once and never retried. Added: getAuthState(), diagnostics(), onAuthRequired callback; init() is now idempotent (no second token client, one lifecycle listener). Default mode is unchanged ('quiet' = v4.1 behaviour), so existing apps behave exactly as before; v4.1, R36.1: an automatic renewal never fires without a tap — Google's renewal opens a small window and the browser's popup blocker asks 'allow pop-ups?' when that happens on its own, so a renewal now waits for the next tap or key press and runs inside it; requestTokenRefresh does nothing while the token is still good. v4, R36: fewer sign-in prompts — the token is kept across reloads until it expires, automatic renewals use prompt 'none' so they never show a screen, a manual sign-in only shows the consent screen the first time, an expired token is renewed quietly before an API call and when the app comes back to the foreground, and a renewal that fails is reported through onAuthError; optional init option loginHint. All additive; v3 callers behave as before; v2: updateEvent gains optional expectEtag, GIG-102;
 * v3: listEvents gains singleEvents/showDeleted/updatedMin options and listInstances is added, GIG-115 —
 * all optional, defaults unchanged, so existing callers behave exactly as before)
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
  const TOK_KEY = 'palgcal_tok_v1';      // v4: { t: access token, e: expiry ms } — kept so a reload inside the hour needs no sign-in
  const CONSENT_KEY = 'palgcal_consented_v1'; // v4: set after the first successful sign-in
  const EXPIRY_MARGIN_MS = 2 * 60 * 1000;
  let _loginHint = null;
  let _pending = [];                     // v4: callers waiting on a quiet renewal
  let _silentTimer = null;

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

  // v5.0 (GCAL-AUTH-001) — opt-in explicit mode. Everything below is inert unless init({authMode:'explicit'}).
  const LIB_VERSION = '5.0';
  let _authMode = 'quiet';            // 'quiet' = v4.1 behaviour (default) | 'explicit' = never authenticate unprompted
  let _onAuthRequired = function () {};
  let _expiryTimer = null;            // explicit mode: marks the token expired; it never renews
  let _signInInFlight = false;        // explicit mode: one authentication window at a time
  let _signInTimer = null;
  let _lastError = '';
  let _initFailed = false;
  let _tcCfgKey = '';                 // clientId|hint the current token client was built with (init() is idempotent)
  let _initTimer = null;
  let _requiredNotified = false;      // onAuthRequired fires once per loss of a usable token
  let _boot = { storedPresent: false, storedValidSec: 0, storageError: '' };   // what storage held at load (diagnostics)

  // ── Init ──────────────────────────────────────────────────────────────

  function init(opts) {
    opts = opts || {};
    _clientId = opts.clientId;
    if (opts.authMode === 'explicit' || opts.authMode === 'quiet') {
      _authMode = opts.authMode;
      if (_authMode === 'explicit') _disarmGesture();   // a tap trap armed by an earlier quiet-mode init must not survive
    }
    if (opts.onAuthRequired) _onAuthRequired = opts.onAuthRequired;
    if (opts.onAuthChange) _onAuthChange = opts.onAuthChange;
    if (opts.onTokenRefreshed) _onTokenRefreshed = opts.onTokenRefreshed;
    if (opts.onAuthError) _onAuthError = opts.onAuthError;
    // Distinct from onAuthError: this fires only if Google's own sign-in
    // script never becomes available at all (blocked by a content
    // blocker/extension, stale cache, or a genuine network failure) —
    // not a sign-in attempt that was made and rejected. Without this,
    // the retry loop below would wait forever in total silence.
    if (opts.onInitFailed) _onInitFailed = opts.onInitFailed;

    if (opts.loginHint) _loginHint = opts.loginHint;
    _restoreToken();
    if (!_visBound) {
      _visBound = true;
      try { document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        if (_authMode === 'explicit') { _checkExpiry(); return; }   // v5.0: report an expired token, never try to renew it
        if (!_tokenClient) return;
        if (!_accessToken && !_hadToken()) return;     // never signed in on this device: nothing to renew
        if (!hasToken() || (_tokenExpiresAt - Date.now()) < EXPIRY_MARGIN_MS) _renewQuietly();
      }); } catch (e) {}
    }
    _initAttempts = 0;
    _tryInit();
  }
  let _visBound = false;

  function _hadToken() { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (e) { return false; } }
  function _saveToken() { try { localStorage.setItem(TOK_KEY, JSON.stringify({ t: _accessToken, e: _tokenExpiresAt })); localStorage.setItem(CONSENT_KEY, '1'); } catch (e) {} }
  function _clearToken() { try { localStorage.removeItem(TOK_KEY); } catch (e) {} }
  function _restoreToken() {
    if (_accessToken) return;
    try {
      const o = JSON.parse(localStorage.getItem(TOK_KEY) || 'null');
      _boot = { storedPresent: !!o, storedValidSec: (o && o.e) ? Math.floor((o.e - Date.now()) / 1000) : 0, storageError: '' };
      if (o && o.t && o.e && o.e - Date.now() > 60 * 1000) {
        _accessToken = o.t; _tokenExpiresAt = o.e;
        _requiredNotified = false;
        _scheduleAutoRefresh(Math.floor((o.e - Date.now()) / 1000));
        setTimeout(function () { _onAuthChange(true); }, 0);   // after init() returns, so the caller's callbacks are in place
      } else if (o) { _clearToken(); }                          // an expired token is never kept
    } catch (e) { _boot.storageError = String((e && e.name) || e); }
    // v5.0 (explicit): connected before on this device but nothing usable now — report it once, never try to fix it.
    if (_authMode === 'explicit' && !_accessToken && _hadToken()) setTimeout(function () { _notifyRequired('expired'); }, 0);
  }

  // v5.0 (explicit mode only) — expiry is REPORTED, never renewed.
  function _notifyRequired(reason) {
    if (_authMode !== 'explicit' || _requiredNotified || !_hadToken()) return;
    _requiredNotified = true;
    try { _onAuthRequired(reason || 'expired'); } catch (e) {}
  }
  function _expire(reason) {
    clearTimeout(_expiryTimer);
    const had = !!_accessToken;
    _accessToken = null; _tokenExpiresAt = null;
    _clearToken();                                // an expired token is never persisted
    if (had) _onAuthChange(false);
    _notifyRequired(reason);
  }
  function _checkExpiry() {
    if (!_accessToken || !_tokenExpiresAt) return;
    if (Date.now() >= _tokenExpiresAt) _expire('expired');
    else _scheduleExpiry(Math.ceil((_tokenExpiresAt - Date.now()) / 1000));
  }
  function _scheduleExpiry(sec) {
    if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
    clearTimeout(_expiryTimer);
    _expiryTimer = setTimeout(_checkExpiry, Math.max(sec * 1000, 1000) + 250);
  }
  function _signInDone() { _signInInFlight = false; clearTimeout(_signInTimer); }

  // v4: ask for a token without showing anything. prompt 'none' makes Google answer
  // with an error instead of a sign-in or consent screen. Resolves true/false.
  // v4.1: Google still opens a small window for the request, and a browser blocks (or asks about)
  // a window opened without a tap. So the request is only made inside a tap or key press: now if
  // one is in progress, otherwise on the next one. A caller that cannot wait gets false after 8 s.
  let _armed = false;
  function _gestureActive() { try { return !!(navigator.userActivation && navigator.userActivation.isActive); } catch (e) { return false; } }
  function _fireQuiet() {
    clearTimeout(_silentTimer);
    _silentTimer = setTimeout(function () { _settle(false); }, 8000);
    try { _tokenClient.requestAccessToken({ prompt: 'none' }); } catch (e) { _settle(false); }
  }
  function _onGesture() {
    document.removeEventListener('pointerdown', _onGesture, true);
    document.removeEventListener('keydown', _onGesture, true);
    _armed = false;
    if (!_tokenClient || hasToken() && (_tokenExpiresAt - Date.now()) > EXPIRY_MARGIN_MS) return;
    _fireQuiet();
  }
  function _armGesture() {
    if (_armed) return;
    _armed = true;
    document.addEventListener('pointerdown', _onGesture, true);
    document.addEventListener('keydown', _onGesture, true);
  }
  function _disarmGesture() {
    try { document.removeEventListener('pointerdown', _onGesture, true); document.removeEventListener('keydown', _onGesture, true); } catch (e) {}
    _armed = false;
  }
  function _renewQuietly() {
    if (_authMode === 'explicit') return Promise.resolve(false);   // v5.0: never opens an authentication window unprompted
    return new Promise(function (resolve) {
      if (!_tokenClient) { resolve(false); return; }
      _pending.push(resolve);
      if (_gestureActive()) { _fireQuiet(); return; }
      _armGesture();
      if (_pending.length === 1) { clearTimeout(_silentTimer); _silentTimer = setTimeout(function () { _settle(false); }, 8000); }
    });
  }
  function _settle(ok) {
    clearTimeout(_silentTimer);
    const list = _pending; _pending = [];
    list.forEach(function (f) { try { f(ok); } catch (e) {} });
  }

  function _tryInit() {
    clearTimeout(_initTimer);                      // v5.0: one polling chain, however often init() is called
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      const key = _clientId + '|' + (_loginHint || '');
      if (_tokenClient && key === _tcCfgKey) { _initFailed = false; return; }   // v5.0: init() is idempotent — one token client
      const cfg = {
        client_id: _clientId,
        scope: SCOPE,
        callback: _onTokenResponse,
        error_callback: function (err) {          // v4: popup blocked / closed — was silently ignored before
          _settle(false);
          _signInDone();
          _lastError = (err && err.type) || 'popup-error';
          _onAuthError(_lastError);                // reported once; v5.0 explicit mode never retries it
        }
      };
      if (_loginHint) cfg.hint = _loginHint;
      _tokenClient = google.accounts.oauth2.initTokenClient(cfg);
      _tcCfgKey = key; _initFailed = false;
      return;
    }
    _initAttempts++;
    if (_initAttempts > INIT_MAX_ATTEMPTS) {
      _initFailed = true;
      _onInitFailed('Google sign-in script never loaded (accounts.google.com/gsi/client) — check for a content blocker/extension, or try a hard refresh.');
      return;
    }
    _initTimer = setTimeout(_tryInit, 300);
  }

  function _onTokenResponse(resp) {
    _signInDone();
    if (resp.error) {
      _settle(false);
      _lastError = resp.error;
      _onAuthError(resp.error);
      return;
    }
    _lastError = ''; _requiredNotified = false;
    _accessToken = resp.access_token;
    const expiresIn = parseInt(resp.expires_in, 10) || 3600;
    _tokenExpiresAt = Date.now() + expiresIn * 1000;
    _scheduleAutoRefresh(expiresIn);
    _saveToken();
    _settle(true);
    _onAuthChange(true);
    _onTokenRefreshed(_tokenExpiresAt);
  }

  function _scheduleAutoRefresh(expiresInSec) {
    if (_authMode === 'explicit') { _scheduleExpiry(expiresInSec); return; }   // v5.0: mark expiry, do not renew
    if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
    const refreshInMs = Math.max((expiresInSec - 300) * 1000, 5000); // 5 min before expiry
    _autoRefreshTimer = setTimeout(function () {
      // prompt: '' = silent refresh attempt, no popup if the browser
      // session is still valid. In Testing mode (Auth Platform), Google
      // caps this at ~7 days before a real re-login is required — that
      // surfaces here as _onAuthError if the silent attempt fails.
      _renewQuietly();   // v4: prompt 'none' — never a screen from a timer
    }, refreshInMs);
  }

  // ── Auth state ────────────────────────────────────────────────────────

  function signIn() {
    if (!_tokenClient) { _lastError = 'not-initialised'; _onAuthError('not-initialised'); return; }
    if (_authMode === 'explicit') {
      // v5.0: the ONLY thing that starts authentication. Call it directly from a tap handler.
      if (_signInInFlight) return;                 // a double tap opens one window, not two
      _signInInFlight = true; _lastError = '';
      clearTimeout(_signInTimer);
      _signInTimer = setTimeout(_signInDone, 90 * 1000);   // never stay "in flight" if a window closes without a callback
      const o = { prompt: _hadToken() ? '' : 'consent' };
      if (_loginHint) o.hint = _loginHint;
      try { _tokenClient.requestAccessToken(o); }
      catch (e) { _signInDone(); _lastError = 'popup-error'; _onAuthError('popup-error'); }
      return;
    }
    // v4: the consent screen is only needed the first time; after that Google can sign in without it.
    _tokenClient.requestAccessToken({ prompt: _hadToken() ? '' : 'consent' });
  }

  function signOut() {
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken, function () {});
    }
    _accessToken = null;
    _tokenExpiresAt = null;
    _clearToken();
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}   // signing out fully: ask for consent again next time
    if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
    clearTimeout(_expiryTimer); _signInDone(); _requiredNotified = false;
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
    if (_authMode === 'explicit') { _checkExpiry(); return; }   // v5.0: never starts authentication; use signIn() from a tap
    if (!_tokenClient) { _onAuthError('not-initialised'); return; }
    if (hasToken() && (_tokenExpiresAt - Date.now()) > EXPIRY_MARGIN_MS) return;   // v4.1: still good, nothing to do
    _renewQuietly();   // v4: prompt 'none' — quiet, no screen
  }

  // ── Low-level fetch wrapper ──────────────────────────────────────────

  async function _apiFetch(path, method, body) {
    if (!hasToken() && _hadToken()) { await _renewQuietly(); }   // v4: one quiet attempt before giving up
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
      _clearToken();
      clearTimeout(_expiryTimer);
      _onAuthChange(false);
      _notifyRequired('rejected');                  // v5.0 (explicit mode only): report, never retry
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

  // v5.0 — what the UI needs to show: connected / expired (was connected here before, needs a tap) /
  // disconnected (never connected on this device) / unavailable (Google's script did not load).
  function getAuthState() {
    let state;
    if (hasToken()) state = 'connected';
    else if (_initFailed) state = 'unavailable';
    else if (_hadToken()) state = 'expired';
    else state = 'disconnected';
    return { state: state, mode: _authMode, expiresAt: _tokenExpiresAt || null, lastError: _lastError, ready: !!_tokenClient, inFlight: _signInInFlight };
  }
  // v5.0 — facts about THIS device/context, for the sync log. Nothing here talks to Google.
  function diagnostics() {
    const d = { lib: LIB_VERSION, mode: _authMode, state: getAuthState().state };
    try { d.embedded = window.parent !== window; } catch (e) { d.embedded = 'unknown'; }
    try { d.standalone = (window.navigator.standalone === true) || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) {}
    try { localStorage.setItem('palgcal_probe', '1'); d.localStorage = localStorage.getItem('palgcal_probe') === '1' ? 'ok' : 'read-failed'; localStorage.removeItem('palgcal_probe'); }
    catch (e) { d.localStorage = 'blocked:' + ((e && e.name) || 'error'); }
    d.gisLoaded = !!(window.google && window.google.accounts && window.google.accounts.oauth2);
    d.tokenClient = !!_tokenClient;
    d.initFailed = _initFailed;
    d.consentFlag = _hadToken();
    d.atLoad = { storedToken: _boot.storedPresent, storedValidSec: _boot.storedValidSec, storageError: _boot.storageError };
    d.tokenValidSec = hasToken() ? Math.floor((_tokenExpiresAt - Date.now()) / 1000) : 0;
    d.quietTapTrapArmed = _armed;
    d.userActivationApi = !!(typeof navigator !== 'undefined' && navigator.userActivation);
    d.lastError = _lastError || '';
    return d;
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
  //
  // opts (all optional, added v3):
  //   singleEvents (default true)  false = return recurring MASTERS (with their `recurrence` lines)
  //                                plus any individually changed/cancelled instances as separate
  //                                events (they carry recurringEventId + originalStartTime), instead
  //                                of one expanded event per occurrence.
  //   showDeleted  (default false) true = also return cancelled events (needed to see a single
  //                                occurrence cancelled in Google).
  //   updatedMin   ISO time: only events changed since then.
  // orderBy=startTime is only valid when singleEvents is true, so it is sent only then.
  async function listEvents(calendarId, timeMinISO, timeMaxISO, opts) {
    opts = opts || {};
    const expand = opts.singleEvents !== false;
    let all = [];
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        singleEvents: expand ? 'true' : 'false',   // default: expand recurring events into instances
        maxResults: String(opts.pageSize || 250)
      });
      if (expand) params.set('orderBy', 'startTime');
      if (opts.showDeleted) params.set('showDeleted', 'true');
      if (opts.updatedMin) params.set('updatedMin', opts.updatedMin);
      if (pageToken) params.set('pageToken', pageToken);

      const data = await _apiFetch(
        '/calendars/' + encodeURIComponent(calendarId) + '/events?' + params.toString()
      );
      all = all.concat(data.items || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return all;
  }

  // Every instance of ONE recurring event within [timeMinISO, timeMaxISO), paginated into a flat
  // array (added v3). Each carries its own id, its start, and originalStartTime (the slot it
  // occupies in the series even if it was moved). showDeleted:true also returns cancelled ones.
  async function listInstances(calendarId, masterEventId, timeMinISO, timeMaxISO, opts) {
    opts = opts || {};
    let all = [];
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        maxResults: String(opts.pageSize || 250)
      });
      if (opts.showDeleted) params.set('showDeleted', 'true');
      if (pageToken) params.set('pageToken', pageToken);
      const data = await _apiFetch(
        '/calendars/' + encodeURIComponent(calendarId) + '/events/' + encodeURIComponent(masterEventId) + '/instances?' + params.toString()
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
    getAuthState: getAuthState,
    diagnostics: diagnostics,
    version: LIB_VERSION,
    errorHint: errorHint,
    withAppMeta: withAppMeta,
    readAppMeta: readAppMeta,
    listEvents: listEvents,
    listInstances: listInstances,
    createEvent: createEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    getEvent: getEvent
  };

})();
