/* gat-music.js v1.17 (v1.17: every gig shows where it was found (a Ticketmaster or JamBase tag); no more checking for tour dates when Music opens or from a button: the server checks a few artists each night and Coming up says when it last did; Diagnostics has a Connection test (one Ticketmaster and one JamBase request) and shows the JamBase usage; Check for new listening is unchanged; v1.16: the artist window on a phone has the same look and order as the computer's side panel (top card, Apple Music, switches, listening, tour dates, releases, Remove); v1.15: v1.15: the Artists page has the same order on a phone as on a computer: search, listening dashboard, folding Followed artists and Played, not followed; v1.14: v1.14: the side panel puts the main buttons (Apple Music, Tickets, Interested …) straight under the top card; Test JamBase moved into a folded Diagnostics group; Recommendations window says Refresh suggestions; v1.13: v1.13: on a computer the Artists page is search first, then a listening dashboard for Pete and Lex (top artists, plays a day / a month / by weekday), then folding sections for followed artists and played-not-followed; v1.12: v1.12: a side panel on a wide screen (tour date, release or artist details with play numbers), Export and Import of the artists list (JSON, matched against your list before anything is added), new artists are matched with Apple Music in the background; v1.11: v1.11: the Last.fm plays checked line shows today / the date (the server records only the day) and this device's own last check time when newer; v1.10: v1.10: clearer message when the daily manual-check limit is reached; Test JamBase no longer asks for the Scotland-wide list (JamBase rejects that filter); v1.09: the Music tab follows the look of the rest of Gigs & Trips (page heading, segmented tabs, a Next gig card, ticket-style rows, cards for Played not followed); Artists page: Check for new listening, rounded toggles, Test JamBase; JamBase source label; v1.08: opening a release in Apple Music removes it from the list (Undo; Show again under hidden); Played, not followed has Both / Pete / Lex buttons; v1.07: Check now renamed Check for new dates with a plain explanation; Coming up has All / Gigs / Releases filter chips; v1.06: Bought can be cancelled from the venue question without an error; v1.05: v1.05: the artist, add and recommendations windows have proper padding (text no longer touches the left edge on a computer) and evenly sized rows; v1.04: v1.04: Played, not followed gets an All played choice (one play is enough); v1.03: "The Levellers" matches the followed "Levellers" (a leading The is ignored when names are compared; plays under both spellings are added together); Check now is also on the Artists tab; v1.02: agenda() lists interested tour dates, on-sale dates and releases for Upcoming and the desktop timeline in the rest of Gigs & Trips, init() loads in the background, onChange() and focus(); v1.01: gig and release rows look different: pink date block and guitar tile for a gig, purple date block and disc tile for a release, as the gig tile in the rest of Gigs & Trips): the Music section of Gigs & Trips. Loaded on first use of the Music tab.
   Reads and writes the shared pal_music library (the same rows as music-tracker.html; field names are shared with the scheduled server function and must not be renamed).
   Trimmed on purpose: Coming up (tour dates and releases), Artists (follow switches, plays, played-not-followed, Add artist), and a Recommendations modal.
   New records (additive, ignored by the server and the old Music app): cstate_<concertId>.interested, rstate_rel_<collectionId> {interested, ni}.
   Needs from the host (window.GAT_HOST): token(), userId(), addGig(concert), gigFor(conId), openGig(id), showModal(html), closeModal(), toast(msg). */
(function () {
  'use strict';
  var VERSION = '1.17', TBL = 'pal_music', UI_KEY = 'gat_mus_ui', STALE_PULL_MS = 120000, REL_STALE_MS = 6 * 3600 * 1000;
  var H = function () { return window.GAT_HOST || {}; };

  // ── pure logic (copied from MusicCore in music-tracker.html; the rules must stay the same) ──
  // v1.03: a leading "The " is ignored when names are compared ("The Levellers" is "Levellers"), so a played artist matches the followed one.
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^\s*the\s+(?=\S)/, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ''); }
  // The server keys plays by the full name; merge entries that now share a key ("the levellers" + "levellers").
  function rekey(L) {
    if (!L || !L.artists) return L;
    var A = {}, out = Object.assign({}, L);
    Object.keys(L.artists).forEach(function (k) {
      var e = L.artists[k] || {}, nk = norm(typeof e.n === 'string' && e.n ? e.n : k), t = A[nk];
      if (!t) { A[nk] = Object.assign({}, e, { d: Object.assign({}, e.d || {}), mo: Object.assign({}, e.mo || {}) }); return; }
      if ((e.t || 0) > (t.t || 0) && typeof e.n === 'string') t.n = e.n;
      t.t = (t.t || 0) + (e.t || 0); if ((e.l || 0) > (t.l || 0)) t.l = e.l;
      Object.keys(e.d || {}).forEach(function (d) { t.d[d] = (Number(t.d[d]) || 0) + (Number(e.d[d]) || 0); });
      Object.keys(e.mo || {}).forEach(function (m) { t.mo[m] = (Number(t.mo[m]) || 0) + (Number(e.mo[m]) || 0); });
    });
    out.artists = A; return out;
  }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'artist'; }
  function classify(query, results) {
    if (!results || !results.length) return { level: 'none', pick: null };
    var q = norm(query), exact = results.filter(function (r) { return norm(r.artistName) === q; });
    if (!exact.length) return { level: 'low', pick: results[0] };
    if (exact.length === 1 && exact[0] === results[0]) return { level: 'high', pick: exact[0] };
    return { level: 'medium', pick: exact[0] };
  }
  function kindOf(name, n) { name = String(name || ''); if (/- single$/i.test(name)) return 'single'; if (/- ep$/i.test(name)) return 'ep'; return n === 1 ? 'single' : 'album'; }
  function artSize(url, n) { if (typeof url !== 'string' || !/^https:\/\//.test(url)) return ''; return url.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, '/' + n + 'x' + n + 'bb.jpg'); }
  function parseRelease(r, aid) {
    if (!r || r.wrapperType !== 'collection' || !r.collectionId || !r.releaseDate || !r.collectionName) return null;
    return { id: String(r.collectionId), aid: String(aid), name: String(r.collectionName), artistName: String(r.artistName || ''), date: String(r.releaseDate).slice(0, 10), kind: kindOf(r.collectionName, r.trackCount),
             art: typeof r.artworkUrl100 === 'string' ? r.artworkUrl100 : '', url: typeof r.collectionViewUrl === 'string' ? r.collectionViewUrl : '', tracks: r.trackCount || 0 };
  }
  function addDays(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function isFollowed(a) { return !!a && !a._deleted && a.following === true && !a.excluded; }
  function wantsReleases(a) { return isFollowed(a) && a.releases !== false; }
  function wantsGigs(a) { return isFollowed(a) && a.gigs !== false; }
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateLabel(iso) { var d = new Date(iso + 'T00:00:00Z'); return DOW[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function liveConcerts(concerts, artists, today) {
    var ids = {}; (artists || []).forEach(function (a) { if (wantsGigs(a)) ids[String(a.id)] = true; });
    return (concerts || []).filter(function (c) { return c && !c._deleted && c.id && ids[String(c.artistId)] && String(c.date) >= today; })
      .sort(function (x, y) { return String(x.date).localeCompare(String(y.date)) || String(x.id).localeCompare(String(y.id)); });
  }
  var NEW_REL_DAYS = 21;

  // ── state ──
  var state = { artists: [], cst: [], rst: [], recfb: [], concerts: [], recs: [], listBy: {}, conCheck: { fetched: {}, empty: {}, jbf: {} } };
  var rel = { fetchedAt: null, items: {}, fetched: {} };
  var sel = null, paneEl = null, matching = false, matchInfo = { done: 0, total: 0, ok: 0, dup: 0 }, imp = null, fileIn = null;
  var ui = { sub: 'coming', pWho: '', cFilter: 'all', aFilter: 'all', aQuery: '', lMin: 3, showHidden: false, dOpen: false, gView: 'days', fOpen: true, pOpen: true, showNot: false };
  var cinfo = { at: null, msg: '' };
  var busy = { con: false, rel: false, pull: false, follow: {} }, lastPull = 0, ready = false, root = null, lastErr = '';
  var _db = null, _tables = null, tokSet = '';

  // ── small helpers ──
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(iso) { try { if (window.PalShared && PalShared.fmtDate) return PalShared.fmtDate(iso) || iso; } catch (e) {} return iso; }
  function ago(iso) { var t = Date.parse(iso); if (!t) return 'never'; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; }
  function localDay(uts) { var d = new Date(uts * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var IS_MAC = /Macintosh/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1);
  function macify(u) { return IS_MAC ? u.replace(/^https:\/\//, 'music://') : u; }
  function artistUrl(a) { return macify(a.appleArtistId ? 'https://music.apple.com/gb/artist/' + slug(a.appleName || a.name) + '/' + a.appleArtistId : 'https://music.apple.com/gb/search?term=' + encodeURIComponent(a.name)); }
  function releaseUrl(r) { var u = r.url || ''; if (/^https:\/\/music\.apple\.com\//.test(u)) return macify(u.replace(/^(https:\/\/music\.apple\.com\/)[a-z]{2}\//, '$1gb/').replace(/\?.*$/, '')); return macify('https://music.apple.com/gb/search?term=' + encodeURIComponent(r.artistName + ' ' + r.name)); }
  function openLink(url) { if (!url) return; var a = document.createElement('a'); a.href = url; if (/^https:/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; } document.body.appendChild(a); a.click(); a.remove(); }
  function say(msg) { try { H().toast ? H().toast(msg) : null; } catch (e) {} }
  function sayErr(msg) { lastErr = msg; say(msg); }
  function undoToast(msg, fn) { try { if (window.PalUI && PalUI.toast) { PalUI.toast(msg, { action: { label: 'Undo', onClick: fn } }); return; } } catch (e) {} say(msg); }
  var hasApple = function (a) { return /^\d{1,12}$/.test(String(a.appleArtistId || '')); };
  var live = function () { return state.artists.filter(function (a) { return !a._deleted; }); };
  var followed = function () { return live().filter(isFollowed); };
  var byId = function (id) { return state.artists.find(function (a) { return a.id === id && !a._deleted; }); };
  function loadUi() { try { var o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if (o) { if (o.sub === 'artists' || o.sub === 'coming') ui.sub = o.sub; if (['all', 'following', 'not'].indexOf(o.aFilter) >= 0) ui.aFilter = o.aFilter; if (['all', 'gigs', 'releases'].indexOf(o.cFilter) >= 0) ui.cFilter = o.cFilter; if (o.pWho === 'pete' || o.pWho === 'lex') ui.pWho = o.pWho; if ([1, 2, 3, 5, 10].indexOf(o.lMin) >= 0) ui.lMin = o.lMin; if (['days', 'months', 'week'].indexOf(o.gView) >= 0) ui.gView = o.gView; if (o.fOpen === false) ui.fOpen = false; if (o.pOpen === false) ui.pOpen = false; if (o.showNot === true) ui.showNot = true; } } catch (e) {} }
  function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ sub: ui.sub, pWho: ui.pWho, cFilter: ui.cFilter, aFilter: ui.aFilter, lMin: ui.lMin, gView: ui.gView, fOpen: ui.fOpen, pOpen: ui.pOpen, showNot: ui.showNot })); } catch (e) {} }

  // ── local cache (IndexedDB gat_mus_db) so the tab opens at once and works offline ──
  function kvOpen() { return new Promise(function (res) { try { var r = indexedDB.open('gat_mus_db', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { _db = r.result; res(true); }; r.onerror = r.onblocked = function () { res(false); }; } catch (e) { res(false); } }); }
  function kvGet(k) { return new Promise(function (res) { if (!_db) return res(null); try { var q = _db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result == null ? null : q.result); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function kvSet(k, v) { return new Promise(function (res) { if (!_db) return res(false); try { var t = _db.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(JSON.stringify(v)), k); t.oncomplete = function () { res(true); }; t.onerror = t.onabort = function () { res(false); }; } catch (e) { res(false); } }); }
  var saveT = null, relT = null;
  var subs = [], hl = null;
  function emit() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { kvSet('state', state); emit(); }, 300); }
  function saveRel() { clearTimeout(relT); relT = setTimeout(function () { kvSet('rel', rel); emit(); }, 400); }

  // ── sync (PalSync shared mode; the same rows as music-tracker.html) ──
  function tables() {
    if (_tables) return _tables;
    var P = window.PalSync;
    _tables = { art: P.table(TBL, { prefix: 'artist_', shared: true }), cst: P.table(TBL, { prefix: 'cstate_', shared: true }), rst: P.table(TBL, { prefix: 'rstate_', shared: true }), fb: P.table(TBL, { prefix: 'recfb_', shared: true }) };
    return _tables;
  }
  function ensureSession() {
    var h = H(), tok = h.token && h.token(), uid = h.userId && h.userId();
    if (!tok || !uid || !window.PalSync) return false;
    if (!(PalSync.hasSession() && PalSync.getUserId() === uid && tokSet === tok)) { tokSet = tok; PalSync.setSession(tok, uid); }
    return true;
  }
  function push(tb, rec, what) {
    if (!ensureSession()) return;
    tables()[tb].upsert(rec.id, rec).catch(function (e) { sayErr(what + ' did not sync: ' + ((e && e.message) || 'error') + '. It is saved on this device.'); });
  }
  function pull(force) {
    if (!ensureSession()) return Promise.resolve(false);
    if (busy.pull) return Promise.resolve(false);
    if (!force && Date.now() - lastPull < STALE_PULL_MS) return Promise.resolve(false);
    busy.pull = true;
    var T = tables();
    return window.PalSync.fetchTableRows(TBL, { shared: true }).then(async function (rows) {
      var a = await T.art.pull(state.artists, 'id', 'updatedAt', rows); state.artists = a.merged;
      var c = await T.cst.pull(state.cst, 'id', 'updatedAt', rows); state.cst = c.merged;
      var r = await T.rst.pull(state.rst, 'id', 'updatedAt', rows); state.rst = r.merged;
      var f = await T.fb.pull(state.recfb, 'id', 'updatedAt', rows); state.recfb = f.merged;
      var live_ = function (p) { return rows.filter(function (x) { return x.record_key.indexOf(p) === 0 && x.data && x.data.id && !x.data._deleted; }).map(function (x) { return x.data; }); };
      state.recs = live_('rec_'); state.concerts = live_('concert_');
      var lb = {};
      rows.forEach(function (x) { var m = /^__listening(?:_([a-z0-9]+))?__$/.exec(String(x.record_key)); var d = x.data; if (m && d && !d._deleted && d.artists && typeof d.artists === 'object') lb[m[1] || 'pete'] = rekey(d); });
      state.listBy = lb;
      var cr = rows.find(function (x) { return x.record_key === '__concerts__'; });
      state.conCheck = (cr && cr.data && !cr.data._deleted && cr.data.fetched && typeof cr.data.fetched === 'object') ? { fetched: cr.data.fetched, empty: (cr.data.empty && typeof cr.data.empty === 'object') ? cr.data.empty : {}, jbf: (cr.data.jbf && typeof cr.data.jbf === 'object') ? cr.data.jbf : {}, jb: (cr.data.jb && typeof cr.data.jb === 'object') ? cr.data.jb : null, at: cr.data.updatedAt || '' } : { fetched: {}, empty: {}, jbf: {} };
      lastPull = Date.now(); save(); return true;
    }).catch(function (e) { sayErr('Could not load Music from the cloud: ' + ((e && e.message) || 'error')); return false; }).finally(function () { busy.pull = false; });
  }

  // ── listening (Pete's and Lex's Last.fm are separate rows; plays are added together) ──
  var WHO = { pete: 'Pete', lex: 'Lex' };
  function listeners() { return Object.keys(state.listBy); }
  function playsIn(key, days, who) {
    var from = addDays(today(), -(days - 1)), n = 0;
    (who ? [who] : listeners()).forEach(function (w) { var e = state.listBy[w] && state.listBy[w].artists[key]; if (e) Object.keys(e.d || {}).forEach(function (d) { if (d >= from) n += Number(e.d[d]) || 0; }); });
    return n;
  }
  function totalPlays(key, who) { var n = 0; (who ? [who] : listeners()).forEach(function (w) { var e = state.listBy[w] && state.listBy[w].artists[key]; if (e) n += Number(e.t) || 0; }); return n; }
  function lastPlayed(key, who) { var l = 0; (who ? [who] : listeners()).forEach(function (w) { var e = state.listBy[w] && state.listBy[w].artists[key]; if (e && e.l > l) l = e.l; }); return l; }
  function playedName(key, who) { var nm = ''; (who ? [who] : listeners()).forEach(function (w) { var e = state.listBy[w] && state.listBy[w].artists[key]; if (e && e.n && !nm) nm = e.n; }); return nm; }
  function allPlayedKeys(who) { var k = {}; (who ? [who] : listeners()).forEach(function (w) { Object.keys((state.listBy[w] || { artists: {} }).artists).forEach(function (x) { k[x] = 1; }); }); return Object.keys(k); }
  var fbMap = function () { var m = {}; state.recfb.forEach(function (x) { if (x && x.id && !x._deleted) { m[x.id] = x.state; if (x.n && /^rc_/.test(x.id)) m['rc_' + norm(x.n)] = x.state; } }); return m; };   // v1.03: also under the new key for names that start with "The"

  // ── Apple (iTunes: free, no key, allows browser requests) ──
  function itunes(path) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 10000);
    return fetch('https://itunes.apple.com/' + path, { signal: ctl.signal }).then(function (r) { if (!r.ok) throw new Error('Apple returned HTTP ' + r.status); return r.json(); }).finally(function () { clearTimeout(t); });
  }
  function searchArtists(q) { return itunes('search?term=' + encodeURIComponent(q) + '&entity=musicArtist&limit=8&country=GB').then(function (j) { return (j.results || []).filter(function (x) { return x && x.artistId && x.artistName; }); }); }
  function lookupAlbums(aid) { return itunes('lookup?id=' + encodeURIComponent(aid) + '&entity=album&limit=50&sort=recent').then(function (j) { return (j.results || []).map(function (r) { return parseRelease(r, aid); }).filter(Boolean); }); }
  function refreshReleases(o) {
    o = o || {};
    if (busy.rel) return Promise.resolve();
    var cutoff = Date.now() - REL_STALE_MS;
    var targets = (o.only || followed()).filter(wantsReleases).filter(hasApple);
    if (!o.only) targets = targets.filter(function (a) { var f = rel.fetched[String(a.appleArtistId)]; return !f || Date.parse(f) < cutoff; });
    if (!targets.length) return Promise.resolve();
    busy.rel = true; paint();
    var i = 0, ok = 0, fail = 0;
    function worker() {
      if (i >= targets.length) return Promise.resolve();
      var a = targets[i++], aid = String(a.appleArtistId);
      return lookupAlbums(aid).then(function (items) {
        Object.keys(rel.items).forEach(function (k) { if (rel.items[k].aid === aid) delete rel.items[k]; });
        items.forEach(function (r) { rel.items[r.id] = r; }); rel.fetched[aid] = new Date().toISOString(); ok++;
      }, function () { fail++; }).then(worker);
    }
    return Promise.all([worker(), worker(), worker()]).then(function () {
      if (ok) { rel.fetchedAt = new Date().toISOString(); saveRel(); }
      busy.rel = false; if (fail && !ok) sayErr('Could not reach Apple Music for releases'); paint();
    });
  }

  // ── server check (the scheduled function checks concerts and Last.fm; this asks it to do it now) ──
  function checkNow(silent) {
    if (busy.con) return Promise.resolve();
    if (!ensureSession()) { if (!silent) sayErr('Open Gigs & Trips through Pete’s Apps to check for concerts'); return Promise.resolve(); }
    var base = (window.PAL_CONFIG && PAL_CONFIG.SB_URL) || '';
    busy.con = true; paint();
    return fetch(base + '/functions/v1/swift-responder/refresh', { method: 'POST', headers: { authorization: 'Bearer ' + H().token(), 'content-type': 'application/json' }, body: '{}' })
      .then(function (res) {
        if (res.status === 429) return res.json().catch(function () { return {}; }).then(function (j) { cinfo.msg = j.error === 'daily-cap' ? 'You have used today’s manual checks. The automatic daily check still runs; try again tomorrow.' : 'Checked a few minutes ago. Showing what was found.'; });
        if (!res.ok) throw new Error(res.status === 403 ? 'this account is not set up for the scheduled check' : 'HTTP ' + res.status);
        cinfo.at = new Date().toISOString(); cinfo.msg = '';
      })
      .then(function () { return pull(true); })
      .then(function () { if (!silent) say(cinfo.msg || 'Music up to date'); })
      .catch(function (e) { cinfo.msg = 'Could not reach the check (' + ((e && e.message) || 'offline') + '). Showing what was found.'; if (!silent) sayErr(cinfo.msg); })
      .finally(function () { busy.con = false; try { localStorage.setItem('gat_mus_cinfo', JSON.stringify(cinfo)); } catch (e) {} paint(); });
  }

  // ── artists ──
  function touch(a) { a.updatedAt = new Date().toISOString(); save(); push('art', a, 'Artist ' + a.name); }
  function newId(aid) { return aid ? 'a' + aid : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function findByApple(aid) { return live().find(function (a) { return String(a.appleArtistId) === String(aid); }); }
  function addArtist(name, hit, level) {
    if (hit && findByApple(hit.artistId)) return { dup: findByApple(hit.artistId) };
    var prior = state.artists.find(function (a) { return a._deleted && hit && String(a.appleArtistId) === String(hit.artistId); }), now = new Date().toISOString();
    var a = prior || { id: newId(hit && hit.artistId), addedAt: now };
    Object.assign(a, { name: String(name).trim(), appleArtistId: hit ? String(hit.artistId) : '', appleName: hit ? hit.artistName : '', genre: hit ? (hit.primaryGenreName || '') : '', match: level, following: true, excluded: false, _deleted: false, updatedAt: now });
    if (!prior) state.artists.push(a);
    save(); push('art', a, 'Artist ' + a.name);
    return { artist: a };
  }
  function setFollow(a, on) { a.following = !!on; touch(a); if (on) refreshReleases({ only: [a] }); }
  function setWant(a, key, on) { if (on) delete a[key]; else a[key] = false; touch(a); if (key === 'releases' && on) refreshReleases({ only: [a] }); }
  function setTour(a, touring) { if (touring) { delete a.tour; delete a.tourNote; } else a.tour = 'ended'; touch(a); }
  var tourEnded = function (a) { return !!a && a.tour === 'ended'; };
  function followByName(name, recId) {
    if (busy.follow[name]) return Promise.resolve(); busy.follow[name] = 1; paint();
    var p;
    var ex = state.artists.find(function (a) { return norm(a.name) === norm(name); });
    if (ex) { ex._deleted = false; ex.excluded = false; ex.following = true; touch(ex); p = Promise.resolve(ex); }
    else p = searchArtists(name).then(function (hits) {
      var c = classify(name, hits), r;
      if ((c.level === 'high' || c.level === 'medium') && c.pick) { var dup = findByApple(c.pick.artistId); if (dup) { setFollow(dup, true); r = dup; } else r = addArtist(name, c.pick, c.level).artist; }
      else r = addArtist(name, null, c.level).artist;
      return r;
    });
    return p.then(function (a) { if (recId) setFb(recId, 'followed'); say('Following ' + name); refreshReleases({}); })
      .catch(function (e) { sayErr('Could not follow ' + name + ': ' + ((e && e.message) || 'error')); })
      .finally(function () { delete busy.follow[name]; paint(); });
  }
  function setFb(id, st, name) {
    var r = state.recfb.find(function (x) { return x.id === id; });
    if (!r) { r = { id: id }; state.recfb.push(r); }
    if (name) r.n = String(name).slice(0, 120);
    r.state = st; r._deleted = false; r.updatedAt = new Date().toISOString(); save(); push('fb', r, 'Suggestion feedback'); paint();
  }

  // ── concerts and releases: Interested / Not interested ──
  var cstMap = function () { var m = {}; state.cst.forEach(function (x) { if (x && x.id && !x._deleted) m[x.id] = { ni: x.ni === true, alert: x.alert === true, interested: x.interested === true }; }); return m; };
  var rstMap = function () { var m = {}; state.rst.forEach(function (x) { if (x && x.id && !x._deleted) m[x.id] = { ni: x.ni === true, interested: x.interested === true }; }); return m; };
  function setCst(id, patch) {
    var r = state.cst.find(function (x) { return x.id === id; });
    if (!r) { r = { id: id, ni: false, alert: false }; state.cst.push(r); }
    Object.assign(r, patch); r.updatedAt = new Date().toISOString(); save(); push('cst', r, 'Concert flag'); paint();
  }
  function setRst(id, patch) {
    var r = state.rst.find(function (x) { return x.id === id; });
    if (!r) { r = { id: id, ni: false, interested: false }; state.rst.push(r); }
    Object.assign(r, patch); r.updatedAt = new Date().toISOString(); save(); push('rst', r, 'Release flag'); paint();
  }
  var salePending = function (c) { return /^\d{4}-\d{2}-\d{2}$/.test(String(c.saleDay || '')) && c.saleDay >= today(); };
  var saleText = function (c) { return (c.saleDay === today() ? 'today' : dateLabel(c.saleDay)) + (c.saleTime ? ' ' + c.saleTime : ''); };
  function comingItems() {
    var t = today(), cs = cstMap(), rs = rstMap(), out = [];
    liveConcerts(state.concerts, state.artists, t).forEach(function (c) { var f = cs[c.id] || {}; out.push({ kind: 'con', id: c.id, date: c.date, c: c, hidden: !!f.ni, interested: !!f.interested, alert: !!f.alert }); });
    var aids = {}; followed().filter(wantsReleases).forEach(function (a) { if (hasApple(a)) aids[String(a.appleArtistId)] = true; });
    Object.keys(rel.items).forEach(function (k) {
      var r = rel.items[k]; if (!aids[r.aid] || r.date < addDays(t, -NEW_REL_DAYS)) return;
      var f = rs['rel_' + r.id] || {}; out.push({ kind: 'rel', id: 'rel_' + r.id, date: r.date, r: r, hidden: !!f.ni, interested: !!f.interested });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  }
  function act(kind, id) {
    var c = state.concerts.find(function (x) { return x.id === id; });
    if (kind === 'interested') { var on = !(cstMap()[id] || {}).interested; setCst(id, { interested: on, ni: false }); }
    else if (kind === 'notint') { setCst(id, { ni: true, interested: false, alert: false }); undoToast('Hidden', function () { setCst(id, { ni: false }); }); }
    else if (kind === 'restore') setCst(id, { ni: false });
    else if (kind === 'alert') { var al = !(cstMap()[id] || {}).alert; setCst(id, { alert: al }); say(al ? 'You will be alerted when tickets go on sale' : 'Alert removed'); }
    else if (kind === 'tickets' && c && /^https:\/\//.test(c.url || '')) window.open(c.url, '_blank', 'noopener');
    else if (kind === 'bought' && c) {
      if (busy['g' + id]) return; busy['g' + id] = true; paint();
      Promise.resolve(H().addGig({ id: c.id, tm: c.tm, artist: c.artist, name: c.name, date: c.date, time: c.time || '', venue: c.venue, city: c.city, url: c.url || '' }))
        .then(function (r) { setCst(id, { interested: true, ni: false }); say(r && r.existing ? 'Already in Gigs & Trips' : 'Added to Gigs & Trips'); })
        .catch(function (e) { if (e && e.message === 'CANCELLED') return; sayErr((e && e.message) || 'Could not add the gig'); })
        .finally(function () { delete busy['g' + id]; paint(); });
    }
    else if (kind === 'opengig') { var g = H().gigFor && H().gigFor(id); if (g) { H().closeModal && H().closeModal(); H().openGig(g); } }
    else if (kind === 'rinterested') { var rid = id, rs = rstMap(); setRst(rid, { interested: !(rs[rid] || {}).interested, ni: false }); }
    else if (kind === 'rnotint') { setRst(id, { ni: true, interested: false }); undoToast('Hidden', function () { setRst(id, { ni: false }); }); }
    else if (kind === 'rrestore') setRst(id, { ni: false });
    else if (kind === 'rapple') { var r = rel.items[String(id).replace(/^rel_/, '')]; if (r) { openLink(releaseUrl(r)); setRst(id, { ni: true, interested: false }); undoToast('Opened in Apple Music and removed from the list', function () { setRst(id, { ni: false }); }); } }
  }

  // ── rendering ──
  var CSS = '.gm{font-family:var(--f)}.gm .chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;align-items:center}.gm .chip{border:1px solid var(--bdr);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 14px;font:600 14px var(--f);min-height:44px;cursor:pointer}' +
    '.gm .chip.on{background:var(--lime);color:var(--limeTx);border-color:var(--lime)}.gm .chip.ghost{background:none}.gm .sp{flex:1}' +
    '.gm .row{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rsm);padding:12px;margin:0 0 10px}.gm .row.dim{opacity:.6}.gm .row.hl{outline:2px solid var(--lime);outline-offset:2px}' +
    '.gm .dt{flex:0 0 46px;text-align:center;border-radius:10px;background:var(--s2);padding:6px 0;line-height:1.1}.gm .dt b{display:block;font-size:20px}.gm .dt span{font-size:11px;color:var(--ink3);text-transform:uppercase}.gm .dt.gg{background:var(--cat-gig);color:#17151C}.gm .dt.gg span,.gm .dt.rl span{color:#17151C}.gm .dt.rl{background:#B79CFF;color:#17151C}.gm .tl{flex:0 0 38px;height:38px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:19px;background:var(--cat-gig)}.gm .tl.rl{background:#B79CFF}' +
    '.gm .rb{flex:1;min-width:0}.gm .rt{font-weight:700;font-size:16px}.gm .rs{font-size:13px;color:var(--ink3);margin-top:2px}.gm .bd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}' +
    '.gm .badge{font-size:11px;font-weight:700;border-radius:999px;padding:3px 8px;background:var(--s2);color:var(--ink2)}.gm .badge.src{background:transparent;border:1px solid var(--line,#8884);color:var(--ink2)}.gm .badge.sale{background:var(--gold-dim);color:var(--gold)}.gm .badge.int{background:var(--ok-dim);color:var(--ok)}.gm .badge.new{background:var(--lime);color:var(--limeTx)}' +
    '.gm .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.gm .btn{border:1px solid var(--bdr);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 12px;font:600 13px var(--f);min-height:44px;cursor:pointer}.gm .btn.pri{background:var(--ink);color:var(--surf);border-color:var(--ink)}.gm .btn.on{background:var(--ok-dim);color:var(--ok);border-color:var(--ok)}.gm .btn[disabled]{opacity:.5}' +
    '.gm h3{font:700 13px var(--f);text-transform:uppercase;letter-spacing:.04em;color:var(--ink3);margin:18px 0 8px}.gm .note{font-size:13px;color:var(--ink3);margin:6px 0}.gm .empty{text-align:center;color:var(--ink3);padding:28px 8px}' +
    '.gm input[type=search],.gm input[type=text]{width:100%;font-size:16px;padding:10px 12px;border:1px solid var(--bdr);border-radius:var(--rsm);background:var(--card);color:var(--ink);margin:0 0 10px;box-sizing:border-box}' +
    '.gm .av{flex:0 0 44px;height:44px;border-radius:10px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;position:relative}.gm .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.gm .nmb{flex:1;min-width:0;text-align:left;background:none;border:none;color:var(--ink);padding:0;cursor:pointer;font-family:var(--f)}.gm .nm{font-weight:700;font-size:16px}.gm .sw{display:flex;gap:2px;flex-wrap:wrap;margin-top:4px}' +
    '.gm .lsw{display:flex;flex-direction:column;align-items:center;font-size:10px;color:var(--ink3);min-width:44px;min-height:44px;justify-content:center;cursor:pointer}.gm .lsw.na{visibility:hidden}.gm .lsw input{width:22px;height:22px;margin:0}' +
    '.gmx .gm-sheet{padding:20px 22px 22px}.gmx .gm-sheet h2{margin:0 0 4px;font-size:20px}.gmx .kv{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;min-height:44px;box-sizing:border-box;border-bottom:1px solid var(--sep);font-size:14px}.gmx .kv span{color:var(--ink3)}.gmx .kv b{text-align:right}.gmx .kv .lsw{min-height:0}' +
    '.gm .row{display:flex;gap:0;align-items:stretch;background:var(--card);border:none;border-radius:22px;overflow:hidden;padding:0;margin:0 0 10px}' +
    '.gm .row>.dt{flex:0 0 64px;border-radius:0;padding:12px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:2px dashed rgba(14,13,18,.28)}.gm .dt b{font-family:var(--fd);font-size:28px;font-weight:800;line-height:1;letter-spacing:-.03em}.gm .dt span{font-size:11px;font-weight:700;letter-spacing:.08em;margin-top:2px}' +
    '.gm .row>.rb{padding:12px 12px 12px 14px}.gm .row>.tl{align-self:flex-start;margin:12px 12px 0 0}.gm .row>.av{align-self:flex-start;margin:12px 0 12px 12px}.gm .rt{letter-spacing:-.01em}' +
    '.gm .row.art .nmb{display:block;width:100%;padding:0}.gm .sw{gap:6px;margin-top:8px}.gm .lsw{flex-direction:row;gap:6px;border:1px solid var(--bdr);border-radius:999px;padding:0 12px;min-height:36px;min-width:0;font-size:12px;font-weight:600;color:var(--ink2)}.gm .lsw input{width:16px;height:16px}.gm .lsw.na{display:none}' +
    '.gm .hero{cursor:default;margin:2px 0 14px}.gm .hero-open{text-decoration:none;white-space:nowrap}.gm .hero-foot{flex-wrap:wrap}' +
    '.gm .stat{display:flex;align-items:center;gap:4px 10px;flex-wrap:wrap;font-size:13px;color:var(--ink3);margin:0 2px 10px}.gm .stat .note{margin:0}.gm .lnk{background:none;border:none;color:var(--ink);font:600 13px var(--f);text-decoration:underline;cursor:pointer;padding:6px 0;min-height:36px}' +
    '.gm .card{background:var(--card);border-radius:22px;padding:14px 14px 4px;margin:0 0 14px}.gm .card h3{margin:0 0 8px}.gm .card .row{background:var(--s2)}.gm .card .row>.rb{padding:10px 12px}' +
    '.gm .dash-sec{margin-top:14px}.gm .acts2{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.gm .tools{font-size:13px;color:var(--ink3)}.gm .tools .btn{margin-top:6px}' +
    '.gmx .jbrow{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--sep);font-size:14px}.gmx .jbrow b{font-weight:700}.gmx .jbd{font-size:12px;color:var(--ink3);margin:0 0 6px}' +
    '.gm .secbtn{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--sep);padding:12px 4px;margin-top:18px;min-height:44px;font:700 16px var(--f);color:var(--ink);cursor:pointer}.gm .secbtn .cnt{color:var(--ink3);font-weight:600;font-size:13px}.gm .secbtn .chev{width:16px;display:inline-block}.gm .secbody{padding-top:10px}' +
    '.gm .dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:0 0 14px}.gm .dgrid .card{margin:0}.gm .tb{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;padding:5px 0;font:600 13px var(--f);color:var(--ink);text-align:left;cursor:pointer}.gm .tb .tn{flex:0 0 38%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gm .tb .tbar{flex:1;height:8px;border-radius:4px;background:var(--s2);overflow:hidden}.gm .tb .tbar i{display:block;height:100%;border-radius:4px}.gm .tb .tc{flex:0 0 34px;text-align:right;color:var(--ink3)}.gm .tb.nf .tn{color:var(--ink3)}' +
    '.gm .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin:4px 0 6px}.gm .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}.gm .gsvg{width:100%;height:auto;display:block}' +
    '.gm .row[data-sel]{cursor:pointer}.gm .row.sel{outline:2px solid var(--ink);outline-offset:-2px}' +
    '#detailPane .pane-poster.rel,#modal .pane-poster.rel{background:#B79CFF;color:#17151C}#detailPane .pane-actions,#modal .pane-actions{flex-wrap:wrap}#detailPane .pane-btn[aria-pressed=true],#modal .pane-btn[aria-pressed=true]{background:var(--ok-dim);color:var(--ok);border-color:var(--ok)}#detailPane .pane-btn[disabled],#modal .pane-btn[disabled]{opacity:.5}' +
    '#detailPane .pane-h,#modal .pane-h{font:700 13px var(--f);text-transform:uppercase;letter-spacing:.04em;color:var(--ink3);margin:18px 4px 8px}#detailPane .pane-row input[type=checkbox],#modal .pane-row input[type=checkbox]{width:22px;height:22px;margin:0}' +
    '#detailPane .pbars,#modal .pbars{display:flex;align-items:flex-end;gap:4px;height:64px;padding:12px 16px 4px}#detailPane .pbars i,#modal .pbars i{flex:1;background:var(--lime);border-radius:3px 3px 0 0;min-height:2px}#detailPane .pcap,#modal .pcap{display:flex;justify-content:space-between;font-size:11px;color:var(--ink3);padding:0 16px 12px}#detailPane .pmini,#modal .pmini{width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--sep);padding:10px 16px;font:600 14px var(--f);color:var(--ink);cursor:pointer;min-height:44px}' +
    '.gmx .imp-l{font-size:13px;margin:6px 0;line-height:1.5}.gmx .imp-l b{font-weight:700}' +
    '@media(max-width:420px){.gm .row>.rb{padding:10px}}';
  function ensureCss() { if (document.getElementById('gm-css')) return; var s = document.createElement('style'); s.id = 'gm-css'; s.textContent = CSS; document.head.appendChild(s); }
  function chip(label, on, a) { return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-m="' + a + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>'; }
  function avatar(a) {
    var best = null; Object.keys(rel.items).forEach(function (k) { var r = rel.items[k]; if (hasApple(a) && r.aid === String(a.appleArtistId) && r.art && (!best || r.date > best.date)) best = r; });
    var u = best ? artSize(best.art, 100) : '';
    return '<div class="av">' + E((a.name.trim()[0] || '?').toUpperCase()) + (u ? '<img src="' + E(u) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</div>';
  }
  function conActs(it) {
    var c = it.c, link = H().gigFor && H().gigFor(c.id), pend = salePending(c);
    if (it.hidden) return '<button class="btn" data-m="restore:' + E(c.id) + '">Show again</button>';
    return (c.url ? '<button class="btn pri" data-m="tickets:' + E(c.id) + '">Tickets</button>' : '') +
      '<button class="btn' + (it.interested ? ' on' : '') + '" data-m="interested:' + E(c.id) + '" aria-pressed="' + (it.interested ? 'true' : 'false') + '">' + (it.interested ? 'Interested ✓' : 'Interested') + '</button>' +
      (link ? '<button class="btn" data-m="opengig:' + E(c.id) + '">Open gig</button>' : '<button class="btn" data-m="bought:' + E(c.id) + '"' + (busy['g' + c.id] ? ' disabled' : '') + '>' + (busy['g' + c.id] ? 'Adding…' : 'Bought') + '</button>') +
      (pend ? '<button class="btn' + (it.alert ? ' on' : '') + '" data-m="alert:' + E(c.id) + '" aria-pressed="' + (it.alert ? 'true' : 'false') + '">' + (it.alert ? 'Alert on' : 'Alert me') + '</button>' : '') +
      '<button class="btn" data-m="notint:' + E(c.id) + '">Not interested</button>';
  }
  function srcName(c) { return c && c.src === 'jambase' ? 'JamBase' : 'Ticketmaster'; }
  function itemRow(it) {
    var d = new Date(it.date + 'T00:00:00Z'), mon = dateLabel(it.date).split(' ')[2];
    if (it.kind === 'con') {
      var c = it.c, link = H().gigFor && H().gigFor(c.id), off = /^(postponed|rescheduled|offsale)$/.test(String(c.status || ''));
      return '<div class="row' + (it.hidden ? ' dim' : '') + (hl === c.id ? ' hl' : '') + (selIs('gig', c.id) ? ' sel' : '') + '" id="gm-' + E(c.id) + '" data-item="' + E(c.id) + '" data-sel="gig:' + E(c.id) + '" data-kind="gig"><div class="dt gg"><b>' + d.getUTCDate() + '</b><span>' + E(mon) + '</span></div><div class="rb"><div class="rt">' + E(c.artist) + '</div>' +
        '<div class="rs">' + E(c.venue) + ', ' + E(c.city) + ' · ' + E(dateLabel(c.date).split(' ')[0]) + (c.time ? ' ' + E(c.time) : '') + '</div><div class="bd"><span class="badge">Gig</span>' +
        (link ? '<span class="badge int">In Gigs &amp; Trips</span>' : it.interested ? '<span class="badge int">Interested</span>' : '') + '<span class="badge src">' + srcName(c) + '</span>' + (off ? '<span class="badge">' + E(c.status) + '</span>' : '') +
        (salePending(c) ? '<span class="badge sale">On sale ' + E(saleText(c)) + '</span>' : '') + '</div><div class="acts">' + conActs(it) + '</div></div><div class="tl" aria-hidden="true">🎸</div></div>';
    }
    var r = it.r, t = today(), isNew = r.date <= t;
    return '<div class="row' + (it.hidden ? ' dim' : '') + (hl === it.id ? ' hl' : '') + (selIs('rel', it.id) ? ' sel' : '') + '" id="gm-' + E(it.id) + '" data-sel="rel:' + E(it.id) + '" data-kind="release"><div class="dt rl"><b>' + d.getUTCDate() + '</b><span>' + E(mon) + '</span></div><div class="rb"><div class="rt">' + E(r.artistName) + ': ' + E(r.name) + '</div>' +
      '<div class="rs">' + (r.kind === 'single' ? 'Single' : r.kind === 'ep' ? 'EP' : 'Album') + ' · ' + (isNew ? 'out ' + E(fmtDate(r.date)) : 'due ' + E(fmtDate(r.date))) + '</div><div class="bd"><span class="badge">Release</span>' + (isNew ? '<span class="badge new">New</span>' : '<span class="badge">Upcoming</span>') + (it.interested ? '<span class="badge int">Interested</span>' : '') + '</div>' +
      '<div class="acts">' + (it.hidden ? '<button class="btn" data-m="rrestore:' + E(it.id) + '">Show again</button>' :
        '<button class="btn pri" data-m="rapple:' + E(it.id) + '">Apple Music</button><button class="btn' + (it.interested ? ' on' : '') + '" data-m="rinterested:' + E(it.id) + '" aria-pressed="' + (it.interested ? 'true' : 'false') + '">' + (it.interested ? 'Interested ✓' : 'Interested') + '</button><button class="btn" data-m="rnotint:' + E(it.id) + '">Not interested</button>') + '</div></div><div class="tl rl" aria-hidden="true">💿</div></div>';
  }
  function checkBtn(label) { return '<button type="button" class="lnk" data-m="check"' + (busy.con ? ' disabled' : '') + '>' + (busy.con ? 'Checking…' : label || 'Check for new listening') + '</button>'; }
  function seg(items) { return '<div class="agenda-filter">' + items.map(function (x) { return '<button type="button" class="' + (x[1] ? 'on' : '') + '" data-m="' + x[2] + '" aria-pressed="' + (x[1] ? 'true' : 'false') + '">' + x[0] + '</button>'; }).join('') + '</div>'; }
  function head() { return '<div class="dash-hdr"><h2>Music</h2><p>' + (ui.sub === 'artists' ? 'Who you follow and what you play' : 'Tour dates and releases for the artists you follow') + '</p></div>' + seg([['Coming up', ui.sub !== 'artists', 'sub:coming'], ['Artists', ui.sub === 'artists', 'sub:artists']]); }
  function heroHtml(c, it) {
    var t = today(), dl = dateLabel(c.date).split(' '), n = Math.round((Date.parse(c.date + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 864e5);
    var chips = [it.interested ? 'Interested ✓' : '', salePending(c) ? 'On sale ' + saleText(c) : '', srcName(c)].filter(Boolean);
    return '<div class="hero"><div class="hero-top"><span class="hero-k">NEXT GIG</span><span class="hero-pill">' + (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days') + '</span></div>' +
      '<div class="hero-date"><div class="hero-num">' + E(dl[1]) + '</div><div class="hero-mon">' + E(dl[2].toUpperCase()) + '<br>' + E(dl[0].toUpperCase()) + '</div></div>' +
      '<div class="hero-title">' + E(c.artist) + '</div><div class="hero-sub">' + E([c.venue + (c.city ? ', ' + c.city : ''), c.time].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="hero-perf"></div><div class="hero-foot"><div class="hero-chips">' + chips.map(function (x) { return '<span class="hero-chip">' + E(x) + '</span>'; }).join('') + '</div>' + (c.url ? '<button type="button" class="hero-open" data-m="tickets:' + E(c.id) + '">Tickets ›</button>' : '') + '</div></div>';
  }
  function renderComing() {
    if (!ready) return '<div class="empty">Loading Music…</div>';
    var allItems = comingItems(), items = allItems.filter(function (i) { return ui.cFilter === 'all' || (ui.cFilter === 'gigs' ? i.kind === 'con' : i.kind === 'rel'); }), shown = items.filter(function (i) { return !i.hidden; }), hid = items.filter(function (i) { return i.hidden; }), n = shown.filter(function (i) { return i.kind === 'con'; }).length;
    var cat = (state.conCheck && state.conCheck.at) || '', nTm = shown.filter(function (i) { return i.kind === 'con' && i.c.src !== 'jambase'; }).length, nJb = n - nTm;
    var status = (cat ? 'Tour dates checked ' + ago(cat) + ' (overnight).' : 'Tour dates are checked overnight.') + (n ? ' ' + n + ' date' + (n === 1 ? '' : 's') + ' in Scotland: ' + nTm + ' Ticketmaster' + (nJb ? ' · ' + nJb + ' JamBase' : '') + '.' : '');
    var nG = allItems.filter(function (i) { return i.kind === 'con' && !i.hidden; }).length, nR = allItems.filter(function (i) { return i.kind === 'rel' && !i.hidden; }).length;
    var h = head() + seg([['All ' + (nG + nR), ui.cFilter === 'all', 'cfilter:all'], ['Gigs ' + nG, ui.cFilter === 'gigs', 'cfilter:gigs'], ['Releases ' + nR, ui.cFilter === 'releases', 'cfilter:releases']]);
    var nextCon = shown.filter(function (i) { return i.kind === 'con' && i.date >= today(); })[0];
    if (nextCon) h += heroHtml(nextCon.c, nextCon);
    h += '<div class="stat"><span role="status">' + E(status) + '</span></div><div class="note">A few of the artists you follow are checked each night, so every artist is looked at every week or two. Each date shows whether Ticketmaster or JamBase found it.</div>';
    if (!followed().length) return h + '<div class="empty">Follow some artists and their Scottish dates and new releases appear here.<div class="acts" style="justify-content:center"><button class="btn pri" data-m="sub:artists">Go to Artists</button></div></div>';
    if (!shown.length) h += '<div class="empty">' + (ui.cFilter === 'gigs' ? 'No Scottish tour dates for the artists you follow right now.' : ui.cFilter === 'releases' ? 'No new releases for the artists you follow right now.' : 'No Scottish dates or new releases for the artists you follow right now.') + '</div>';
    var month = '';
    shown.forEach(function (it) { var m = it.date.slice(0, 7); if (m !== month) { month = m; var d = new Date(it.date + 'T00:00:00Z'); h += '<div class="dash-sec">' + E(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCFullYear()) + '</div>'; } h += itemRow(it); });
    if (hid.length) h += '<button type="button" class="chip ghost" data-m="togglehidden">' + (ui.showHidden ? 'Hide' : 'Show') + ' ' + hid.length + ' you are not interested in</button>' + (ui.showHidden ? hid.map(itemRow).join('') : '');
    return h;
  }
  function playLine(a) {
    var k = norm(a.name), t = totalPlays(k); if (!listeners().length) return '';
    return t ? t + ' play' + (t === 1 ? '' : 's') + (playsIn(k, 30) ? ' · ' + playsIn(k, 30) + ' in 30 days' : '') : 'no plays yet';
  }
  function playedNotFollowed() {
    var fb = fbMap(), mine = {}; state.artists.forEach(function (a) { if (!a._deleted) mine[norm(a.name)] = a; });
    var who = listeners().indexOf(ui.pWho) >= 0 ? ui.pWho : '';
    return allPlayedKeys(who).map(function (k) { return { k: k, n: playsIn(k, 30, who), l: lastPlayed(k, who), name: playedName(k, who) || k }; })
      .filter(function (x) { return x.n >= ui.lMin && !(mine[x.k] && isFollowed(mine[x.k])) && fb['rc_' + x.k] !== 'ignored'; })
      .sort(function (a, b) { return (b.l || 0) - (a.l || 0) || b.n - a.n || a.name.localeCompare(b.name); }).slice(0, 15);
  }
  function listenAge() {
    // The server records the day Last.fm was polled (a date, no time), so a date alone is shown as "today" / the date; this device's own last successful check has a time and wins when it is newer.
    var best = 0, day = '';
    listeners().forEach(function (w) { var p = String((state.listBy[w] && state.listBy[w].polledAt) || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(p)) { if (p > day) day = p; } else { var v = Date.parse(p); if (v > best) best = v; } });
    var ca = Date.parse(cinfo.at) || 0, dayMs = day ? Date.parse(day + 'T00:00:00Z') : 0, t = Math.max(best, ca);
    if (t && t >= dayMs) return ago(new Date(t).toISOString());
    if (day) return day === today() ? 'today' : fmtDate(day);
    return '';
  }
  function artRow(a) {
      var fol = isFollowed(a), sw = function (key, label, on, show) { return '<label class="lsw' + (show ? '' : ' na') + '"><input type="checkbox" data-sw="' + key + '" data-id="' + E(a.id) + '" aria-label="' + label + ' for ' + E(a.name) + '"' + (on ? ' checked' : '') + (show ? '' : ' tabindex="-1" aria-hidden="true"') + '>' + label + '</label>'; };
      var pl = playLine(a);
      return '<div class="row art' + (fol ? '' : ' dim') + (selIs('art', a.id) ? ' sel' : '') + '" data-sel="art:' + E(a.id) + '">' + avatar(a) + '<div class="rb"><button type="button" class="nmb" data-m="artist:' + E(a.id) + '"><div class="nm">' + E(a.name) + '</div><div class="rs">' + E(pl) + (pl && (fol && a.gigs !== false && tourEnded(a)) ? ' · ' : '') + (fol && a.gigs !== false && tourEnded(a) ? 'Not touring' : '') + (!hasApple(a) ? (pl ? ' · ' : '') + 'No Apple match' : '') + '</div></button>' +
        '<div class="sw">' + sw('follow', 'Follow', fol, true) + sw('releases', 'Releases', fol && a.releases !== false, fol) + sw('gigs', 'Tour', fol && a.gigs !== false, fol) + sw('tour', 'Touring', !tourEnded(a), fol && a.gigs !== false) + '</div></div></div>';
  }
  function pnfBody(pnf) {
    return pnf.length ? pnf.map(function (x) {
      return '<div class="row"><div class="rb"><div class="rt">' + E(x.name) + '</div><div class="rs">' + x.n + ' plays in 30 days · last ' + E(ago(new Date(x.l * 1000).toISOString())) + '</div><div class="acts"><button class="btn pri" data-m="followname:' + E(x.name) + '"' + (busy.follow[x.name] ? ' disabled' : '') + '>' + (busy.follow[x.name] ? 'Adding…' : 'Follow') + '</button><button class="btn" data-m="ignorename:' + E(x.name) + '">Ignore</button></div></div></div>';
    }).join('') : '<div class="note" style="padding-bottom:10px">' + (ui.aQuery ? 'Nobody played matches the search.' : ui.lMin === 1 ? 'Everyone played in the last 30 days is already followed.' : 'Nobody played ' + ui.lMin + ' or more times in 30 days is missing from your follows.') + '</div>';
  }
  function pnfSegs() {
    return (listeners().length > 1 ? seg([['Both', !ui.pWho, 'pwho:']].concat(listeners().map(function (w) { return [E(WHO[w] || w), ui.pWho === w, 'pwho:' + w]; }))) : '') + seg([1, 2, 3, 5, 10].map(function (n) { return [n === 1 ? 'All played' : n + '+ plays', ui.lMin === n, 'lmin:' + n]; }));
  }
  // ── listening dashboard (v1.13, computer only) ──
  var WCOL = { pete: 'var(--lime)', lex: '#B79CFF' }, colOf = function (w) { return WCOL[w] || 'var(--ink3)'; };
  function dayTotals(w) { var m = {}, L = state.listBy[w]; if (!L) return m; Object.keys(L.artists).forEach(function (k) { var d = L.artists[k].d || {}; Object.keys(d).forEach(function (x) { m[x] = (m[x] || 0) + (Number(d[x]) || 0); }); }); return m; }
  function monthTotals(w) { var m = {}, L = state.listBy[w]; if (!L) return m; Object.keys(L.artists).forEach(function (k) { var e = L.artists[k]; Object.keys(e.mo || {}).forEach(function (x) { m[x] = (m[x] || 0) + (Number(e.mo[x]) || 0); }); Object.keys(e.d || {}).forEach(function (x) { var mm = x.slice(0, 7); m[mm] = (m[mm] || 0) + (Number(e.d[x]) || 0); }); }); return m; }
  function niceMax(v) { if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  var MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function chartData(view, who) {
    var labels = [], vals = {}, tick = 1, t = today(), i, d;
    if (view === 'months') {
      var d0 = new Date(), keys = []; for (i = 11; i >= 0; i--) { d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
      labels = keys.map(function (k) { return MONS[Number(k.slice(5)) - 1]; }); who.forEach(function (w) { var m = monthTotals(w); vals[w] = keys.map(function (k) { return m[k] || 0; }); });
    } else if (view === 'week') {
      labels = DOWS.slice(); who.forEach(function (w) { var m = dayTotals(w), v = [0, 0, 0, 0, 0, 0, 0]; Object.keys(m).forEach(function (x) { var wd = (new Date(x + 'T00:00:00Z').getUTCDay() + 6) % 7; v[wd] += m[x]; }); vals[w] = v; });
    } else {
      var days = []; for (i = 29; i >= 0; i--) days.push(addDays(t, -i)); tick = 5;
      labels = days.map(function (x) { return Number(x.slice(8)) + ' ' + MONS[Number(x.slice(5, 7)) - 1]; }); who.forEach(function (w) { var m = dayTotals(w); vals[w] = days.map(function (x) { return m[x] || 0; }); });
    }
    return { labels: labels, vals: vals, tick: tick };
  }
  function chartHtml(view, who) {
    var C = chartData(view, who), mxv = 0; who.forEach(function (w) { C.vals[w].forEach(function (v) { if (v > mxv) mxv = v; }); });
    if (!mxv) return '<div class="note" style="padding:10px 0">No plays recorded for this view yet.</div>';
    var sm = window.innerWidth < 700, fs = sm ? 16 : 11, W = 640, H = sm ? 230 : 200, pl = sm ? 44 : 36, pr = 8, pt = 12, pb = sm ? 32 : 26, iw = W - pl - pr, ih = H - pt - pb, n = C.labels.length, mx = niceMax(mxv), gw = iw / n, bw = Math.max(2, (gw * 0.8) / who.length), s = '', y, i;
    var desc = who.map(function (w) { return (WHO[w] || w) + ' ' + C.vals[w].reduce(function (a, b) { return a + b; }, 0) + ' plays'; }).join(', ');
    s += '<svg class="gsvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Plays ' + (view === 'months' ? 'a month, last 12 months' : view === 'week' ? 'by day of the week' : 'a day, last 30 days') + ': ' + E(desc) + '">';
    [0, 0.5, 1].forEach(function (f) { y = pt + ih - f * ih; s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--sep)" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" style="fill:var(--ink3);font:' + fs + 'px var(--f)">' + Math.round(mx * f) + '</text>'; });
    for (i = 0; i < n; i++) {
      who.forEach(function (w, j) {
        var v = C.vals[w][i], h = v / mx * ih, x = pl + i * gw + gw * 0.1 + j * bw;
        s += '<rect x="' + x.toFixed(1) + '" y="' + (pt + ih - h).toFixed(1) + '" width="' + (bw - 1).toFixed(1) + '" height="' + Math.max(v ? 1.5 : 0, h).toFixed(1) + '" rx="2" style="fill:' + colOf(w) + '"><title>' + E((WHO[w] || w) + ', ' + C.labels[i] + ': ' + v + (v === 1 ? ' play' : ' plays')) + '</title></rect>';
      });
      if (i % (sm && C.tick === 5 ? 10 : C.tick) === 0) s += '<text x="' + (pl + i * gw + gw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" style="fill:var(--ink3);font:' + fs + 'px var(--f)">' + E(C.labels[i]) + '</text>';
    }
    return s + '</svg>';
  }
  function topCard(w) {
    var L = state.listBy[w] || { artists: {} }, mine = {}; state.artists.forEach(function (a) { if (!a._deleted) mine[norm(a.name)] = a; });
    var list = Object.keys(L.artists).map(function (k) { return { k: k, n: playsIn(k, 30, w) }; }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }), tot = 0, fol = 0;
    list.forEach(function (x) { tot += x.n; var a = mine[x.k]; if (a && isFollowed(a)) fol += x.n; });
    var top = list.slice(0, 8), mx = top.length ? top[0].n : 1;
    return '<div class="card"><h3>' + E(WHO[w] || w) + ': top artists, 30 days</h3>' +
      (list.length ? '<div class="note" style="margin-top:0">' + tot + ' plays · ' + list.length + ' artist' + (list.length === 1 ? '' : 's') + ' · ' + Math.round(fol / tot * 100) + '% from artists you follow</div>' +
        top.map(function (x) {
          var a = mine[x.k], f = a && isFollowed(a), nm = playedName(x.k, w) || x.k, inner = '<span class="tn" title="' + E(nm) + '">' + E(nm) + '</span><span class="tbar"><i style="width:' + Math.max(4, Math.round(x.n / mx * 100)) + '%;background:' + colOf(w) + '"></i></span><span class="tc">' + x.n + '</span>';
          return a ? '<button type="button" class="tb' + (f ? '' : ' nf') + '" data-m="artist:' + E(a.id) + '">' + inner + '</button>' : '<div class="tb nf" style="cursor:default">' + inner + '</div>';
        }).join('') + '<div style="height:8px"></div>' : '<div class="note">No plays in the last 30 days.</div>') + '</div>';
  }
  function dashboardHtml() {
    var who = listeners(); if (!who.length) return '';
    var views = [['Plays a day', 'days'], ['Plays a month', 'months'], ['By weekday', 'week']];
    return '<div class="dgrid">' + who.map(topCard).join('') + '</div>' +
      '<div class="card"><h3>Listening habits</h3>' + seg(views.map(function (v) { return [v[0], ui.gView === v[1], 'gview:' + v[1]]; })) +
      '<div class="legend">' + who.map(function (w) { return '<span><i style="background:' + colOf(w) + '"></i>' + E(WHO[w] || w) + '</span>'; }).join('') + '</div>' + chartHtml(ui.gView, who) +
      '<div class="note">' + (ui.gView === 'week' ? 'Plays by day of the week, from the days Last.fm has recorded recently.' : ui.gView === 'months' ? 'Plays a month for the last 12 months (history starts when tracking began).' : 'Plays a day for the last 30 days.') + '</div></div>';
  }
  function secHead(key, title, count, open) { return '<button type="button" class="secbtn" data-m="sec:' + key + '" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="chev" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>' + title + ' <span class="cnt">' + count + '</span></button>'; }
  function jbUsageHtml() {
    var j = state.conCheck && state.conCheck.jb, q = j && j.q;
    if (!q || q.used == null) return '<div class="note">JamBase usage is recorded after the first overnight check.</div>';
    return '<div class="note">JamBase says ' + E(String(q.used)) + ' of ' + E(q.quota == null ? 'no set limit' : String(q.quota)) + ' requests used' + (q.periodEnd ? ' this period (ends ' + E(String(q.periodEnd).slice(0, 10)) + ')' : '') + ', as of ' + E(ago(q.at || state.conCheck.at || '')) + '. The overnight check plans to stay under 600.</div>';
  }
  function toolsHtml() {
    return '<div class="card tools" style="margin-top:18px"><h3>Export and import</h3>Export your artists to a JSON file, or import a list of acts (a JSON file, or a text file with one name per line). Names are checked against your list first, so you see the duplicates before anything is added.<div><button type="button" class="btn" data-m="exportart">Export artists</button> <button type="button" class="btn" data-m="importart">Import artists</button></div></div>' +
      secHead('d', 'Diagnostics', '', ui.dOpen) + (ui.dOpen ? '<div class="card tools secbody"><h3>Connection test</h3>Tour dates come from Ticketmaster and JamBase, checked by the server overnight. This asks each of them for one event, to show the connections and keys are working. It costs one Ticketmaster request and one JamBase request.<div><button type="button" class="btn" data-m="conntest"' + (busy.jb ? ' disabled' : '') + '>' + (busy.jb ? 'Testing…' : 'Test connection') + '</button></div>' + jbUsageHtml() + '</div>' : '');
  }
  function renderArtists() {
    if (!ready) return '<div class="empty">Loading Music…</div>';
    var all = live(), q = norm(ui.aQuery), la = listenAge();
    var h = head() + '<input type="search" id="gmq" placeholder="Search artists" value="' + E(ui.aQuery) + '" autocomplete="off" autocorrect="off" aria-label="Search artists">' +
      '<div class="acts2"><button type="button" class="chip pri on" data-m="addartist">+ Add artist</button><button type="button" class="chip" data-m="recs">Recommendations' + (visibleRecs().length ? ' (' + visibleRecs().length + ')' : '') + '</button></div>' +
      '<div class="stat"><span role="status">' + (listeners().length ? 'Last.fm plays ' + (la ? 'checked ' + E(la) : 'not checked yet') + '.' : 'No Last.fm plays yet.') + (cinfo.msg ? ' ' + E(cinfo.msg) : '') + '</span>' + checkBtn('Check for new listening') + '</div>' +
      (pendingMatch().length ? '<div class="note">' + (matching ? 'Matching new artists with Apple Music: ' + matchInfo.done + ' of ' + matchInfo.total + '…' : pendingMatch().length + ' new artist' + (pendingMatch().length === 1 ? ' is' : 's are') + ' waiting to be matched with Apple Music.') + (matching ? '' : ' <button type="button" class="lnk" data-m="matchnow">Match now</button>') + '</div>' : '');
    h += dashboardHtml();
    var notFol = all.filter(function (a) { return !isFollowed(a); }).length, fol = all.filter(isFollowed);
    var rows = all.filter(function (a) { return (!q || norm(a.name).indexOf(q) >= 0) && (isFollowed(a) || ui.showNot); }).sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); });
    h += secHead('f', 'Followed artists', q ? rows.length + ' of ' + fol.length : fol.length, ui.fOpen);
    if (ui.fOpen) {
      h += '<div class="secbody">' + (notFol ? '<div class="chips"><button type="button" class="chip ghost' + (ui.showNot ? ' on' : '') + '" data-m="shownot" aria-pressed="' + (ui.showNot ? 'true' : 'false') + '">' + (ui.showNot ? 'Hide' : 'Also show') + ' ' + notFol + ' not following</button></div>' : '');
      h += !all.length ? '<div class="empty">No artists yet. Add one to start.</div>' : rows.length ? rows.map(artRow).join('') : '<div class="empty">No artists match.</div>';
      h += '</div>';
    }
    if (listeners().length) {
      var pnf = playedNotFollowed().filter(function (x) { return !q || norm(x.name).indexOf(q) >= 0; });
      h += secHead('p', 'Played, not followed', pnf.length, ui.pOpen);
      if (ui.pOpen) h += '<div class="secbody">' + pnfSegs() + pnfBody(pnf) + '</div>';
    }
    return h + toolsHtml();
  }
  // ── desktop side panel (v1.12): the host shows it to the right of the list on a wide screen ──
  function paneOn() { return !!(document.body && document.body.classList.contains('pane') && H().tab && H().tab() === 'music'); }
  function selIs(k, id) { return !!sel && sel.k === k && sel.id === id; }
  function selectItem(k, id) { sel = { k: k, id: id }; paint(); }
  function pane(el) {
    paneEl = el;
    if (el && !el._gm) { el._gm = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
    return boot().then(function () { paintPane(); });
  }
  function pRow(l, v) { return v === '' || v == null ? '' : '<div class="pane-row"><b>' + l + '</b><span>' + v + '</span></div>'; }
  function pBtn(m, label, o) { o = o || {}; return '<button type="button" class="pane-btn' + (o.pri ? ' pri' : '') + '" style="flex:1 1 44%" data-m="' + m + '"' + (o.dis ? ' disabled' : '') + (o.on ? ' aria-pressed="true"' : '') + '>' + label + '</button>'; }
  function poster(kind, pill, dt, title, sub, chips, cls) {
    var dl = dt ? dateLabel(dt).split(' ') : null;
    return '<div class="pane-poster' + (cls ? ' ' + cls : '') + '"><div class="hero-top"><span class="hero-k">' + E(kind) + '</span>' + (pill ? '<span class="hero-pill">' + E(pill) + '</span>' : '') + '</div>' +
      (dl ? '<div class="hero-date"><div class="hero-num">' + E(dl[1]) + '</div><div class="hero-mon">' + E(dl[2].toUpperCase()) + '<br>' + E(dl[0].toUpperCase()) + '</div></div>' : '') +
      '<div class="hero-title">' + E(title) + '</div>' + (sub ? '<div class="hero-sub">' + E(sub) + '</div>' : '') +
      (chips.length ? '<div class="hero-chips" style="margin-top:14px">' + chips.map(function (x) { return '<span class="hero-chip">' + E(x) + '</span>'; }).join('') + '</div>' : '') + '</div>';
  }
  function daysPill(dt) { var n = Math.round((Date.parse(dt + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 864e5); return n < 0 ? 'Out now' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; }
  function itemById(id) { return comingItems().find(function (x) { return x.id === id; }); }
  function resolveSel() {
    if (sel) {
      if (sel.k === 'art' && byId(sel.id)) return sel;
      if ((sel.k === 'gig' || sel.k === 'rel') && itemById(sel.id)) return sel;
    }
    if (ui.sub === 'artists') return null;
    var its = comingItems().filter(function (i) { return !i.hidden; }), g = its.filter(function (i) { return i.kind === 'con' && i.date >= today(); })[0] || its[0];
    return g ? { k: g.kind === 'con' ? 'gig' : 'rel', id: g.id } : null;
  }
  function playsBlock(a) {
    var k = norm(a.name), who = listeners(); if (!who.length) return '';
    var per = who.length > 1 ? who.map(function (w) { return pRow('Plays, ' + E(WHO[w] || w), totalPlays(k, w) + ' (' + playsIn(k, 30, w) + ' in 30 days)'); }).join('') : '', lp = lastPlayed(k);
    var months = {}; who.forEach(function (w) { var e = state.listBy[w] && state.listBy[w].artists[k]; if (!e) return; Object.keys(e.mo || {}).forEach(function (m) { months[m] = (months[m] || 0) + (Number(e.mo[m]) || 0); }); Object.keys(e.d || {}).forEach(function (d) { var m = d.slice(0, 7); months[m] = (months[m] || 0) + (Number(e.d[d]) || 0); }); });
    var keys = [], d0 = new Date(), i; for (i = 11; i >= 0; i--) { var d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
    var mx = Math.max.apply(null, keys.map(function (m) { return months[m] || 0; }).concat([1]));
    var bars = keys.some(function (m) { return months[m]; }) ? '<div class="pbars" aria-hidden="true">' + keys.map(function (m) { return '<i title="' + m + ': ' + (months[m] || 0) + '" style="height:' + Math.max(3, Math.round(((months[m] || 0) / mx) * 100)) + '%"></i>'; }).join('') + '</div><div class="pcap"><span>' + keys[0] + '</span><span>plays a month</span><span>' + keys[11] + '</span></div>' : '';
    return '<div class="pane-h">Listening</div><div class="pane-card">' + pRow('Plays in total', totalPlays(k)) + pRow('Last 7 days', playsIn(k, 7)) + pRow('Last 30 days', playsIn(k, 30)) + per + pRow('Last played', lp ? E(fmtDate(localDay(lp))) : '') + bars + '</div>';
  }
  function gigPane(it) {
    var c = it.c, id = E(c.id), link = H().gigFor && H().gigFor(c.id), pend = salePending(c), a = byId(c.artistId), off = /^(postponed|rescheduled|offsale)$/.test(String(c.status || ''));
    var chips = [it.interested ? 'Interested ✓' : '', link ? 'In Gigs & Trips' : '', pend ? 'On sale ' + saleText(c) : '', srcName(c)].filter(Boolean);
    var acts = it.hidden ? pBtn('restore:' + id, 'Show again') : (c.url ? pBtn('tickets:' + id, 'Tickets', { pri: true }) : '') + pBtn('interested:' + id, it.interested ? 'Interested ✓' : 'Interested', { on: it.interested }) +
      (link ? pBtn('opengig:' + id, 'Open gig') : pBtn('bought:' + id, busy['g' + c.id] ? 'Adding…' : 'Bought', { dis: busy['g' + c.id] })) + (pend ? pBtn('alert:' + id, it.alert ? 'Alert on' : 'Alert me', { on: it.alert }) : '') + pBtn('notint:' + id, 'Not interested');
    return poster('TOUR DATE', daysPill(c.date), c.date, c.artist, [c.venue, c.city].filter(Boolean).join(', '), chips) +
      '<div class="pane-actions" style="margin-bottom:12px">' + acts + '</div>' +
      '<div class="pane-card">' + pRow('Date', E(fmtDate(c.date))) + pRow('Time', E(c.time || '')) + pRow('Venue', E(c.venue)) + pRow('City', E(c.city)) + pRow('Tickets on sale', pend ? E(saleText(c)) : '') + pRow('Status', off ? E(c.status) : '') +
      pRow('Event', c.name && norm(c.name) !== norm(c.artist) ? E(c.name) : '') + pRow('Found by', srcName(c)) + (listeners().length ? pRow('Plays of ' + E(c.artist), totalPlays(norm(c.artist)) + ' (' + playsIn(norm(c.artist), 30) + ' in 30 days)') : '') + '</div>' +
      (a ? '<div class="pane-actions">' + pBtn('artist:' + E(a.id), 'Artist details') + '</div>' : '');
  }
  function relPane(it) {
    var r = it.r, id = E(it.id), a = followed().find(function (x) { return hasApple(x) && String(x.appleArtistId) === r.aid; }), u = artSize(r.art, 400), kind = r.kind === 'single' ? 'Single' : r.kind === 'ep' ? 'EP' : 'Album';
    var acts = it.hidden ? pBtn('rrestore:' + id, 'Show again') : pBtn('rapple:' + id, 'Apple Music', { pri: true }) + pBtn('rinterested:' + id, it.interested ? 'Interested ✓' : 'Interested', { on: it.interested }) + pBtn('rnotint:' + id, 'Not interested');
    return poster('RELEASE', daysPill(r.date), r.date, r.name, r.artistName + ' · ' + kind, [kind, it.interested ? 'Interested ✓' : ''].filter(Boolean), 'rel') +
      '<div class="pane-actions" style="margin-bottom:12px">' + acts + '</div>' +
      (u ? '<div class="pane-card"><img src="' + E(u) + '" alt="" style="width:100%;display:block" onerror="this.parentNode.remove()"></div>' : '') +
      '<div class="pane-card">' + pRow('Release date', E(fmtDate(r.date))) + pRow('Type', kind) + pRow('Tracks', r.tracks ? r.tracks : '') + pRow('Artist', E(r.artistName)) + (listeners().length ? pRow('Plays of ' + E(r.artistName), totalPlays(norm(r.artistName)) + ' (' + playsIn(norm(r.artistName), 30) + ' in 30 days)') : '') + '</div>' +
      (a ? '<div class="pane-actions">' + pBtn('artist:' + E(a.id), 'Artist details') + '</div>' : '');
  }
  function artistPane(a) {
    var k = norm(a.name), fol = isFollowed(a), cc = state.conCheck || {}, f = cc.fetched && cc.fetched[a.id], n = (cc.empty && cc.empty[a.id]) || 0, id = E(a.id), t = today();
    var sw = function (key, label, on) { return '<div class="pane-row"><b>' + label + '</b><span><input type="checkbox" data-sw="' + key + '" data-id="' + id + '" aria-label="' + label + '"' + (on ? ' checked' : '') + '></span></div>'; };
    var chips = [fol ? 'Following' : 'Not following', fol && a.gigs !== false && tourEnded(a) ? 'No longer touring' : '', hasApple(a) ? 'Apple Music' : a.pm ? 'Matching…' : 'No Apple Music match', a.match === 'medium' ? 'Check match' : ''].filter(Boolean);
    var cons = liveConcerts(state.concerts, state.artists, t).filter(function (c) { return String(c.artistId) === String(a.id); }).slice(0, 6);
    var rels = Object.keys(rel.items).map(function (x) { return rel.items[x]; }).filter(function (r) { return hasApple(a) && r.aid === String(a.appleArtistId); }).sort(function (x, y) { return y.date.localeCompare(x.date); }).slice(0, 4);
    return poster('ARTIST', '', '', a.name, a.genre || (hasApple(a) ? 'Apple Music' : ''), chips) +
      '<div class="pane-actions" style="margin-bottom:12px"><button type="button" class="pane-btn pri" data-m="aapple:' + id + '">Apple Music</button></div>' +
      '<div class="pane-card">' + sw('follow', 'Following', fol) + (fol ? sw('releases', 'New releases', a.releases !== false) + sw('gigs', 'Tour dates', a.gigs !== false) + (a.gigs !== false ? sw('tour', 'Still touring', !tourEnded(a)) : '') : '') + '</div>' +
      playsBlock(a) +
      (fol && a.gigs !== false ? '<div class="pane-h">Tour dates</div><div class="pane-card">' + (cons.length ? cons.map(function (c) { return '<button type="button" class="pmini" data-m="gotogig:' + E(c.id) + '">' + E(dateLabel(c.date)) + ' · ' + E(c.venue) + ', ' + E(c.city) + '</button>'; }).join('') : pRow('Scottish dates', tourEnded(a) ? 'Not checked (no longer touring)' : 'None found')) +
        pRow('Last checked', tourEnded(a) ? '' : f ? E(fmtDate(f)) + (n >= 6 ? ', nothing found in ' + n + ' checks' : '') : 'not checked yet') + '</div>' : '') +
      (rels.length ? '<div class="pane-h">Recent releases</div><div class="pane-card">' + rels.map(function (r) { return pRow(E(r.name), E(fmtDate(r.date))); }).join('') + '</div>' : '') +
      '<div class="pane-actions"><button type="button" class="pane-btn" data-m="aremove:' + id + '">Remove artist</button></div>';
  }
  function overviewPane() {
    var who = listeners(), keys = who.length ? allPlayedKeys('') : [];
    var per = who.map(function (w) { var n = 0; Object.keys((state.listBy[w] || { artists: {} }).artists).forEach(function (k) { n += playsIn(k, 30, w); }); return pRow('Plays, ' + E(WHO[w] || w) + ', 30 days', n); }).join('');
    return poster('MUSIC', '', '', 'Your artists', 'Choose an artist to see its details here', []) +
      '<div class="pane-card">' + pRow('Following', followed().length) + pRow('Not following', live().length - followed().length) + pRow('Artists played, 30 days', keys.filter(function (k) { return playsIn(k, 30) > 0; }).length) + per + '</div>';
  }
  function paintPane() {
    if (!paneEl || !paneEl.isConnected || !paneOn()) return;
    var s = resolveSel(), h = '';
    if (!ready) h = '<div class="pane-empty">Loading Music…</div>';
    else if (!s) h = ui.sub === 'artists' ? overviewPane() : '<div class="pane-empty">Select a tour date or release to see it here.</div>';
    else if (s.k === 'art') h = artistPane(byId(s.id));
    else { var it = itemById(s.id); h = it ? (it.kind === 'con' ? gigPane(it) : relPane(it)) : '<div class="pane-empty">Select a tour date or release to see it here.</div>'; }
    var top = paneEl.scrollTop; paneEl.innerHTML = h; paneEl.scrollTop = top;
  }

  // ── export and import of the artists list (v1.12) ──
  function saveFile(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  function exportArtists() {
    var rows = live().slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); }).map(function (a) {
      var k = norm(a.name); return { name: a.name, following: isFollowed(a), releases: a.releases !== false, gigs: a.gigs !== false, tour: tourEnded(a) ? 'ended' : 'active', tourNote: a.tourNote || '', genre: a.genre || '', appleArtistId: a.appleArtistId || '', plays: totalPlays(k), plays30: playsIn(k, 30) };
    });
    saveFile('music-artists.json', JSON.stringify({ format: 'music-artists/1', app: 'gigs-and-trips-music', version: VERSION, exportedAt: new Date().toISOString(),
      howTo: 'To add acts, add entries to artists (just a name is enough) and import the file in Music > Artists > Import artists. Names already in your list are recognised and not added twice. Optional per artist: releases (false = no new releases), gigs (false = no tour dates), tour ("ended" = no longer touring), tourNote.', artists: rows }, null, 2));
    say('Exported ' + rows.length + ' artist' + (rows.length === 1 ? '' : 's'));
  }
  function pickImport() {
    if (!fileIn) { fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'application/json,.json,text/plain,.txt,.csv'; fileIn.style.display = 'none'; document.body.appendChild(fileIn); fileIn.addEventListener('change', function () { var f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (f) readImport(f); }); }
    fileIn.value = ''; fileIn.click();
  }
  function readImport(file) {
    if (file.size > 2000000) { sayErr('That file is too big to be an artists list'); return; }
    var rd = new FileReader();
    rd.onload = function () { try { imp = planImport(parseImport(String(rd.result || ''))); showImport(); } catch (e) { imp = null; sayErr('Import failed: ' + ((e && e.message) || e)); } };
    rd.onerror = function () { sayErr('Could not read that file'); };
    rd.readAsText(file);
  }
  // Accepts: this app's export, the old Music Tracker review file, { artists: [...] }, a list of names or of { name } objects, or a text file with one name a line.
  function parseImport(text) {
    var j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
    var list;
    if (j === null || typeof j !== 'object') list = text.split(/\r?\n/).map(function (x) { return x.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim(); }).filter(Boolean);
    else if (Array.isArray(j)) list = j; else if (Array.isArray(j.artists)) list = j.artists; else if (Array.isArray(j.acts)) list = j.acts; else throw new Error('No list of artists found in that file');
    var out = [], bad = 0;
    list.forEach(function (it) {
      var nm = typeof it === 'string' ? it : it && typeof it === 'object' ? (it.name || it.artist || it.artistName) : '';
      if (typeof nm !== 'string' || !nm.trim() || nm.length > 120) { bad++; return; }
      var f = {}; if (it && typeof it === 'object') {
        if (typeof it.following === 'boolean') f.following = it.following; if (typeof it.releases === 'boolean') f.releases = it.releases;
        var g = typeof it.gigs === 'boolean' ? it.gigs : typeof it.tourDates === 'boolean' ? it.tourDates : undefined; if (g !== undefined) f.gigs = g;
        if (it.tour === 'ended' || it.tour === 'active') f.tour = it.tour; if (typeof it.tourNote === 'string') f.tourNote = it.tourNote.slice(0, 200);
      }
      out.push({ name: nm.trim().replace(/\s+/g, ' '), f: f });
    });
    if (!out.length) throw new Error('No artist names found in that file');
    return { items: out, bad: bad };
  }
  function flagDiff(a, f) {
    return (f.releases !== undefined && (a.releases !== false) !== f.releases) || (f.gigs !== undefined && (a.gigs !== false) !== f.gigs) || (f.tour !== undefined && tourEnded(a) !== (f.tour === 'ended')) || (f.tourNote !== undefined && tourEnded(a) && (a.tourNote || '') !== f.tourNote);
  }
  function applyFlags(a, f) {
    if (f.releases !== undefined) { if (f.releases) delete a.releases; else a.releases = false; }
    if (f.gigs !== undefined) { if (f.gigs) delete a.gigs; else a.gigs = false; }
    if (f.tour === 'ended') { a.tour = 'ended'; if (f.tourNote) a.tourNote = f.tourNote; } else if (f.tour === 'active') { delete a.tour; delete a.tourNote; } else if (f.tourNote !== undefined && tourEnded(a)) a.tourNote = f.tourNote;
  }
  function planImport(P) {
    var seen = {}, p = { add: [], have: [], refollow: [], restore: [], change: [], same: [], dupInFile: [], skipped: [], bad: P.bad };
    P.items.forEach(function (it) {
      var k = norm(it.name); if (!k) { p.bad++; return; }
      if (seen[k]) { p.dupInFile.push(it.name); return; } seen[k] = 1;
      var ex = state.artists.filter(function (a) { return norm(a.name) === k || (a.appleName && norm(a.appleName) === k); }), a = ex.find(function (x) { return !x._deleted; }) || ex[0];
      if (!a) { if (it.f.following === false) p.skipped.push(it.name); else p.add.push(it); return; }
      if (a._deleted) { if (it.f.following === false) p.skipped.push(it.name); else p.restore.push({ a: a, it: it }); return; }
      if (!isFollowed(a)) { if (it.f.following === false) p.same.push(a.name); else p.refollow.push({ a: a, it: it }); return; }
      if (flagDiff(a, it.f)) p.change.push({ a: a, it: it }); else p.have.push(a.name);
    });
    return p;
  }
  function names(list, f) { var n = list.map(f || function (x) { return x; }); return E(n.slice(0, 40).join(', ')) + (n.length > 40 ? ' and ' + (n.length - 40) + ' more' : ''); }
  function showImport() {
    var p = imp; if (!p) return;
    var total = p.add.length + p.refollow.length + p.restore.length + p.change.length, line = function (label, list, f) { return list.length ? '<div class="imp-l"><b>' + label + ' (' + list.length + ')</b><br>' + names(list, f) + '</div>' : ''; };
    var nm = function (x) { return x.a.name; };
    modal('import', '<div class="gm-sheet"><h2>Import artists</h2><div class="note">' + (total ? total + ' change' + (total === 1 ? '' : 's') + ' ready. Nothing is added until you press Apply.' : 'Nothing to add or change: everything in the file is already in your list.') + '</div>' +
      line('New, will be added and followed', p.add, function (x) { return x.name; }) + line('Not following now, will be followed', p.refollow, nm) + line('Removed earlier, will come back', p.restore, nm) + line('Already in your list, settings will change', p.change, nm) +
      line('Already followed, no change', p.have) + line('Repeated in the file, counted once', p.dupInFile) + line('Marked not followed in the file, skipped', p.skipped) +
      (p.bad ? '<div class="imp-l"><b>' + p.bad + ' line' + (p.bad === 1 ? '' : 's') + ' could not be read</b> and were skipped.</div>' : '') +
      (p.add.length ? '<div class="note">New artists are added straight away, then matched with Apple Music in the background (about 3 seconds each, so ' + p.add.length + ' takes about ' + Math.max(1, Math.round(p.add.length * 3.2 / 60)) + ' min). The same artist found twice is merged. Tour dates are looked up by name by the daily check.</div>' : '') +
      '<div class="acts">' + (total ? '<button class="btn pri" data-m="applyimport">Apply ' + total + ' change' + (total === 1 ? '' : 's') + '</button>' : '') + '<button class="btn" data-m="cancelimport">' + (total ? 'Cancel' : 'Close') + '</button></div></div>');
  }
  function pushMany(list) {
    if (!ensureSession() || !list.length) return Promise.resolve();
    var fail = 0, i = 0;
    function next() { if (i >= list.length) return Promise.resolve(); var a = list[i++]; return tables().art.upsert(a.id, a).catch(function () { fail++; }).then(next); }
    return next().then(function () { if (fail) sayErr(fail + ' artist' + (fail === 1 ? '' : 's') + ' did not sync. They are saved on this device.'); });
  }
  function applyImport() {
    var p = imp; if (!p) return; imp = null; H().closeModal();
    var now = new Date().toISOString(), changed = [], ids = {}; state.artists.forEach(function (a) { ids[a.id] = 1; });
    p.add.forEach(function (it, i) {
      var id = newId('') + i.toString(36); while (ids[id]) id += 'x'; ids[id] = 1;
      var a = { id: id, addedAt: now, name: it.name, appleArtistId: '', appleName: '', genre: '', match: 'none', following: true, excluded: false, _deleted: false, updatedAt: now, pm: true };
      applyFlags(a, it.f); state.artists.push(a); changed.push(a);
    });
    p.refollow.concat(p.restore).forEach(function (e) { var a = e.a; a._deleted = false; a.excluded = false; a.following = true; applyFlags(a, e.it.f); a.updatedAt = now; changed.push(a); });
    p.change.forEach(function (e) { applyFlags(e.a, e.it.f); e.a.updatedAt = now; changed.push(e.a); });
    save(); paint();
    say('Imported: ' + p.add.length + ' added' + (changed.length > p.add.length ? ', ' + (changed.length - p.add.length) + ' updated' : ''));
    return pushMany(changed).then(function () { refreshReleases({}); return matchPending(); });
  }
  // New artists from an import have no Apple Music id yet: match them one at a time, gently (the iTunes search allows roughly 20 a minute).
  function pendingMatch() { return live().filter(function (a) { return a.pm === true; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function matchPending() {
    if (matching) return Promise.resolve(); var todo = pendingMatch(); if (!todo.length) return Promise.resolve();
    matching = true; matchInfo = { done: 0, total: todo.length, ok: 0, dup: 0 }; paint();
    var i = 0, stopped = false;
    function one() {
      if (i >= todo.length || stopped) return Promise.resolve();
      var a = todo[i++]; if (a._deleted || a.pm !== true) return one();
      return searchArtists(a.name).then(function (hits) {
        var c = classify(a.name, hits);
        if ((c.level === 'high' || c.level === 'medium') && c.pick) {
          var dup = findByApple(c.pick.artistId);
          if (dup && dup !== a) { a._deleted = true; delete a.pm; matchInfo.dup++; if (!isFollowed(dup)) { dup.following = true; dup.excluded = false; touch(dup); } }
          else { Object.assign(a, { appleArtistId: String(c.pick.artistId), appleName: c.pick.artistName, genre: c.pick.primaryGenreName || '', match: c.level }); delete a.pm; matchInfo.ok++; }
        } else { a.match = c.level || 'none'; delete a.pm; }
        touch(a); matchInfo.done++; paint(); return sleep(3200).then(one);
      }, function (e) { stopped = true; sayErr('Apple Music matching paused (' + ((e && e.message) || 'error') + '). It continues the next time Music opens, or press Match now.'); });
    }
    return one().then(function () {
      matching = false; paint();
      if (!stopped) { say('Apple Music matching done: ' + matchInfo.ok + ' matched' + (matchInfo.dup ? ', ' + matchInfo.dup + ' already in your list' : '') + ', ' + (matchInfo.done - matchInfo.ok - matchInfo.dup) + ' left as added by name'); if (matchInfo.ok) refreshReleases({}); }
    });
  }

  // ── Connection test (one Ticketmaster + one JamBase request, via the server) ──
  var jbRes = null, connAt = 0;
  function connTest() {
    if (busy.jb) return;
    if (Date.now() - connAt < 30000) { say('Tested a moment ago'); return; }
    if (!ensureSession()) { sayErr('Open Gigs & Trips through Pete’s Apps to run the test'); return; }
    var base = (window.PAL_CONFIG && PAL_CONFIG.SB_URL) || '';
    busy.jb = 1; connAt = Date.now(); paint();
    fetch(base + '/functions/v1/swift-responder/test-connection', { method: 'POST', headers: { authorization: 'Bearer ' + H().token(), 'content-type': 'application/json' }, body: '{}' })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { res: res, j: j }; }); })
      .then(function (r) {
        if (r.res.status === 429) { say('Tested a moment ago'); return; }
        if (!r.res.ok) throw new Error(r.res.status === 404 ? 'the server has not been updated to v0.11.0 yet' : r.res.status === 403 ? 'this account is not allowed to run it' : (r.j && r.j.error) || 'HTTP ' + r.res.status);
        jbRes = r.j; openConn();
      })
      .catch(function (e) { sayErr('Connection test failed: ' + ((e && e.message) || 'offline')); })
      .finally(function () { busy.jb = 0; paint(); });
  }
  function openConn() {
    var j = jbRes || {}, tm = j.ticketmaster || {}, jb = j.jambase || {}, q = jb.quota, h = '<div class="gm-sheet"><h2>Connection test</h2>';
    function line(name, r) { return '<div class="jbrow"><span>' + name + '</span><span>' + (r.ok ? 'OK' : 'Problem') + (r.status ? ' · HTTP ' + E(String(r.status)) : '') + (r.ms != null ? ' · ' + E(String(r.ms)) + ' ms' : '') + '</span></div>' + (r.ok ? '' : '<div class="jbd">' + E(String(r.error || 'no answer')) + '</div>'); }
    h += '<div class="note">' + (j.ok ? 'Both connections are working.' : 'At least one connection has a problem.') + '</div>' + line('Ticketmaster', tm) + line('JamBase', jb);
    if (q) h += '<div class="note">JamBase says ' + E(String(q.used)) + ' of ' + E(q.quota == null ? 'no set limit' : String(q.quota)) + ' requests used' + (q.periodEnd ? ' this period (ends ' + E(String(q.periodEnd).slice(0, 10)) + ')' : '') + '.</div>';
    else if (jb.quotaError) h += '<div class="note">Usage could not be read (' + E(String(jb.quotaError)) + ').</div>';
    h += '<div class="note">Requests made by this test: Ticketmaster ' + E(String((j.calls || {}).ticketmaster || 0)) + ', JamBase ' + E(String((j.calls || {}).jambase || 0)) + '.</div>';
    h += '<div class="acts"><button class="btn pri" data-m="conncopy">Copy result</button><button class="btn" data-m="closemodal">Close</button></div></div>';
    modal('jb', h);
  }
  function connCopy() {
    var t = JSON.stringify(jbRes || {}, null, 1);
    try { navigator.clipboard.writeText(t).then(function () { say('Copied'); }, function () { say('Could not copy'); }); } catch (e) { say('Could not copy'); }
  }
  function paint() {
    if (!root || !root.isConnected) return;
    var keep = document.activeElement && document.activeElement.id === 'gmq' ? document.activeElement.selectionStart : null;
    root.innerHTML = '<div class="gm">' + (ready ? '' : head()) + (ui.sub === 'artists' ? renderArtists() : renderComing()) + '<div style="height:90px"></div></div>';
    if (keep != null) { var q = document.getElementById('gmq'); if (q) { q.focus(); try { q.setSelectionRange(keep, keep); } catch (e) {} } }
    var mo = document.getElementById('modal'); if (mo && mo.dataset.gm === 'recs' && mo.querySelector('.gm-sheet') && document.getElementById('movl').classList.contains('on')) openRecs(true);
    paintPane();
  }

  // ── modals: artist details, add artist, recommendations ──
  function modal(kind, html) { H().showModal('<div class="gm gm-sheet-wrap">' + html + '</div>'); var m = document.getElementById('modal'); m.dataset.gm = kind; m.classList.add('gmx'); }
  function openArtist(id) {
    var a = byId(id); if (!a) return;
    modal('artist', '<div class="gm-sheet">' + artistPane(a) + '<div class="pane-actions" style="margin-top:10px"><button type="button" class="pane-btn" data-m="closemodal">Close</button></div></div>');
  }
  function openAdd() {
    modal('add', '<div class="gm-sheet"><h2>Add artist</h2><input type="text" id="gmadd" placeholder="Artist name" autocomplete="off" autocorrect="off" aria-label="Artist name"><div class="acts"><button class="btn pri" data-m="dosearch">Search Apple Music</button><button class="btn" data-m="closemodal">Close</button></div><div id="gmres"></div></div>');
    setTimeout(function () { var i = document.getElementById('gmadd'); if (i) i.focus(); }, 50);
  }
  var lastHits = [];
  function doSearch() {
    var q = (document.getElementById('gmadd') || {}).value || ''; q = q.trim(); var out = document.getElementById('gmres'); if (!q || !out) return;
    out.innerHTML = '<div class="note">Searching…</div>';
    searchArtists(q).then(function (hits) {
      lastHits = hits;
      out.innerHTML = (hits.length ? hits.map(function (h, i) { return '<div class="row"><div class="rb"><div class="rt">' + E(h.artistName) + '</div><div class="rs">' + E(h.primaryGenreName || '') + '</div></div><button class="btn pri" data-m="pick:' + i + '">Follow</button></div>'; }).join('') : '<div class="note">No match on Apple Music.</div>') +
        '<div class="acts"><button class="btn" data-m="addplain:' + E(q) + '">Add “' + E(q) + '” without a match</button></div>';
    }).catch(function (e) { out.innerHTML = '<div class="note">Could not search: ' + E((e && e.message) || 'error') + '</div>'; });
  }
  var REC_GONE = ['followed', 'known', 'dismissed', 'ignored'];
  function visibleRecs() { var fb = fbMap(), have = new Set(state.artists.filter(function (a) { return !a._deleted; }).map(function (a) { return norm(a.name); })); return state.recs.filter(function (r) { return r && r.name && REC_GONE.indexOf(fb[r.id]) < 0 && !have.has(norm(r.name)); }).sort(function (a, b) { return (b.score || 0) - (a.score || 0); }); }
  function recReason(r) {
    var sd = Array.isArray(r.seeds) ? r.seeds : []; if (!sd.length) return 'Suggested by Last.fm';
    var t = 'Last.fm lists them as similar to ' + sd[0].n, more = (r.nSeeds || sd.length) - 1; if (more > 0) t += ' and ' + more + ' other' + (more === 1 ? '' : 's') + ' you follow or play';
    var pl = playsIn(norm(sd[0].n), 30); if (pl > 0) t += '. ' + pl + (pl === 1 ? ' play' : ' plays') + ' of ' + sd[0].n + ' in the last 30 days'; return t;
  }
  function openRecs(refreshOnly) {
    var recs = visibleRecs(), who = listeners().map(function (w) { return WHO[w] || w; });
    var h = '<div class="gm-sheet"><h2>Recommendations</h2><div class="note">' + (who.length ? 'Based on what ' + E(who.join(' and ')) + ' follow and play (Last.fm). ' : 'Based on the artists you follow. ') + (recs.length ? recs.length + ' suggestion' + (recs.length === 1 ? '' : 's') + '.' : '') + '</div><div class="acts"><button class="btn" data-m="check"' + (busy.con ? ' disabled' : '') + '>' + (busy.con ? 'Checking…' : 'Refresh suggestions') + '</button><button class="btn" data-m="closemodal">Close</button></div>';
    h += recs.length ? recs.map(function (r) {
      return '<div class="row"><div class="rb"><div class="rt">' + E(r.name) + '</div><div class="rs">' + E(recReason(r)) + '</div><div class="acts"><button class="btn pri" data-m="recfollow:' + E(r.id) + '"' + (busy.follow[r.name] ? ' disabled' : '') + '>' + (busy.follow[r.name] ? 'Adding…' : 'Follow') + '</button><button class="btn" data-m="recapple:' + E(r.id) + '">Apple Music</button><button class="btn" data-m="recknown:' + E(r.id) + '">Already know</button><button class="btn" data-m="recno:' + E(r.id) + '">Not for me</button></div></div></div>';
    }).join('') : '<div class="empty">No suggestions yet.<div class="note">They are worked out by the server’s daily check from Last.fm’s similar-artist lists. Refresh suggestions (above) updates them.</div></div>';
    h += '</div>';
    if (refreshOnly) { var m = document.getElementById('modal'); if (m) m.innerHTML = '<div class="gm gm-sheet-wrap">' + h + '</div>'; } else modal('recs', h);
  }

  // ── events ──
  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-m]');
    if (!b) { var rw = e.target.closest && e.target.closest('[data-sel]'); if (rw && paneOn() && !(e.target.closest && e.target.closest('input,label,a,button'))) { var sp = rw.getAttribute('data-sel'), ci = sp.indexOf(':'); selectItem(sp.slice(0, ci), sp.slice(ci + 1)); } return; }
    if (b.disabled) return;
    var s = b.getAttribute('data-m'), i = s.indexOf(':'), k = i < 0 ? s : s.slice(0, i), v = i < 0 ? '' : s.slice(i + 1);
    if (k === 'sub') { ui.sub = v; sel = null; saveUi(); paint(); }
    else if (k === 'gview') { ui.gView = v; saveUi(); paint(); }
    else if (k === 'sec') { if (v === 'f') ui.fOpen = !ui.fOpen; else if (v === 'd') ui.dOpen = !ui.dOpen; else ui.pOpen = !ui.pOpen; saveUi(); paint(); }
    else if (k === 'shownot') { ui.showNot = !ui.showNot; saveUi(); paint(); }
    else if (k === 'exportart') exportArtists();
    else if (k === 'importart') pickImport();
    else if (k === 'applyimport') applyImport();
    else if (k === 'cancelimport') { imp = null; H().closeModal(); }
    else if (k === 'matchnow') matchPending();
    else if (k === 'check') checkNow(false);
    else if (k === 'conntest') connTest();
    else if (k === 'conncopy') connCopy();
    else if (k === 'togglehidden') { ui.showHidden = !ui.showHidden; paint(); }
    else if (k === 'afilter') { ui.aFilter = v; saveUi(); paint(); }
    else if (k === 'cfilter') { ui.cFilter = v; saveUi(); paint(); }
    else if (k === 'pwho') { ui.pWho = v; saveUi(); paint(); }
    else if (k === 'lmin') { ui.lMin = Number(v); saveUi(); paint(); }
    else if (k === 'gotogig') { ui.sub = 'coming'; saveUi(); selectItem('gig', v); }
    else if (k === 'artist') { if (paneOn()) selectItem('art', v); else openArtist(v); }
    else if (k === 'addartist') openAdd();
    else if (k === 'dosearch') doSearch();
    else if (k === 'recs') openRecs();
    else if (k === 'closemodal') H().closeModal();
    else if (k === 'followname') followByName(v);
    else if (k === 'ignorename') { var key = norm(v); setFb('rc_' + key, 'ignored', v); undoToast(v + ' ignored', function () { setFb('rc_' + key, 'new', v); }); }
    else if (k === 'recfollow') { var r = state.recs.find(function (x) { return x.id === v; }); if (r) followByName(r.name, v); }
    else if (k === 'recapple') { var r2 = state.recs.find(function (x) { return x.id === v; }); if (r2) openLink(macify('https://music.apple.com/gb/search?term=' + encodeURIComponent(r2.name))); }
    else if (k === 'recknown' || k === 'recno') { var r3 = state.recs.find(function (x) { return x.id === v; }); setFb(v, k === 'recknown' ? 'known' : 'dismissed'); if (r3) undoToast(r3.name + ' hidden', function () { setFb(v, 'new'); }); }
    else if (k === 'pick') { var hit = lastHits[Number(v)]; if (hit) { var res = addArtist(hit.artistName, hit, 'manual'); H().closeModal(); say(res.dup ? hit.artistName + ' is already added' : 'Following ' + hit.artistName); if (res.artist) refreshReleases({ only: [res.artist] }); paint(); } }
    else if (k === 'addplain') { addArtist(v, null, 'none'); H().closeModal(); say('Added ' + v + ' (no Apple Music match)'); paint(); }
    else if (k === 'aapple') { var a = byId(v); if (a) openLink(artistUrl(a)); }
    else if (k === 'aremove') { var ar = byId(v); if (ar) { ar._deleted = true; touch(ar); H().closeModal(); undoToast(ar.name + ' removed', function () { ar._deleted = false; touch(ar); paint(); }); paint(); } }
    else act(k, v);
  }
  function onChange(e) {
    var el = e.target; if (!el || !el.getAttribute || !el.getAttribute('data-sw')) return;
    var a = byId(el.getAttribute('data-id')); if (!a) return; var k = el.getAttribute('data-sw'), on = el.checked;
    if (k === 'follow') setFollow(a, on); else if (k === 'tour') setTour(a, on); else setWant(a, k, on);
    paint(); var m = document.getElementById('modal'); if (m && m.dataset.gm === 'artist' && m.querySelector('.gm-sheet') && document.getElementById('movl').classList.contains('on')) openArtist(a.id);
  }
  function onInput(e) { if (e.target && e.target.id === 'gmq') { ui.aQuery = e.target.value; paint(); } }
  function onKey(e) { if (e.key === 'Enter' && e.target && e.target.id === 'gmadd') doSearch(); }
  var wired = false;
  function wire() {
    if (wired) return; wired = true;
    var m = document.getElementById('modal');
    [document.getElementById('appInner'), m].forEach(function (el) { if (!el) return; el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); el.addEventListener('keydown', onKey); });
  }

  // ── for the rest of Gigs & Trips: interested items in Upcoming and the desktop timeline ──
  function agenda() {
    var t = today(), cs = cstMap(), rs = rstMap(), out = [], gf = H().gigFor || function () { return ''; };
    liveConcerts(state.concerts, state.artists, t).forEach(function (c) {
      var f = cs[c.id] || {}; if (f.ni || gf(c.id)) return;       // hidden, or already a gig (Bought)
      if (f.interested) out.push({ id: c.id, kind: 'con', date: c.date, time: c.time || '', title: c.artist, sub: [c.time, c.venue + ', ' + c.city].filter(Boolean).join(' · '), tag: 'Tour date' });
      if ((f.interested || f.alert) && salePending(c)) out.push({ id: 'sale_' + c.id, focus: c.id, kind: 'sale', date: c.saleDay, time: c.saleTime || '', title: c.artist + ': tickets on sale', sub: c.venue + ', ' + c.city, tag: 'On sale' });
    });
    var aids = {}; followed().filter(wantsReleases).forEach(function (a) { if (hasApple(a)) aids[String(a.appleArtistId)] = true; });
    Object.keys(rel.items).forEach(function (k) {
      var r = rel.items[k], f = rs['rel_' + r.id]; if (!f || !f.interested || f.ni || !aids[r.aid] || r.date < addDays(t, -7)) return;
      out.push({ id: 'rel_' + r.id, focus: 'rel_' + r.id, kind: 'rel', date: r.date, time: '', title: r.artistName + ': ' + r.name, sub: (r.kind === 'single' ? 'Single' : r.kind === 'ep' ? 'EP' : 'Album') + (r.date <= t ? ' · out now' : ''), tag: 'Release' });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  }
  function focus(id) {
    ui.sub = 'coming'; saveUi(); var it = comingItems().find(function (x) { return x.id === id; }); if (it && it.hidden) ui.showHidden = true;
    hl = id; paint();
    setTimeout(function () { var el = document.getElementById('gm-' + id); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }, 150);
    setTimeout(function () { hl = null; paint(); }, 4000);
  }
  function init() { return boot().then(function () { emit(); return pull(false); }).then(function (c) { if (c) emit(); }); }

  // ── public ──
  var booted = null;
  function boot() {
    if (booted) return booted;
    loadUi(); ensureCss();
    try { var ci = JSON.parse(localStorage.getItem('gat_mus_cinfo') || 'null'); if (ci) cinfo = { at: ci.at || null, msg: ci.msg || '' }; } catch (e) {}
    booted = kvOpen().then(function () { return Promise.all([kvGet('state'), kvGet('rel')]); }).then(function (v) {
      var s = v[0]; if (s && typeof s === 'object') ['artists', 'cst', 'rst', 'recfb', 'concerts', 'recs'].forEach(function (k) { if (Array.isArray(s[k])) state[k] = s[k]; });
      if (s && s.listBy && typeof s.listBy === 'object') { state.listBy = {}; Object.keys(s.listBy).forEach(function (w) { state.listBy[w] = rekey(s.listBy[w]); }); } if (s && s.conCheck) state.conCheck = s.conCheck;
      if (v[1] && v[1].items) rel = { fetchedAt: v[1].fetchedAt || null, items: v[1].items, fetched: v[1].fetched || {} };
      if (state.artists.length) ready = true;
    });
    return booted;
  }
  function render(container) {
    root = container; wire();
    return boot().then(function () {
      paint();
      return pull(false).then(function (changed) {
        ready = true; paint();
        refreshReleases({}).then(function () { return null; });
        if (pendingMatch().length && ensureSession()) matchPending();
      });
    });
  }
  window.GatMusic = {
    version: VERSION, pane: pane, render: render, pull: pull, paint: paint, init: init, agenda: agenda, focus: focus, onChange: function (f) { subs.push(f); }, _state: function () { return { state: state, rel: rel, ui: ui, busy: busy, ready: ready }; },
    // for the rest of Gigs & Trips (next stage): interested items for Upcoming and the timeline
    core: { norm: norm, slug: slug, classify: classify, parseRelease: parseRelease, liveConcerts: liveConcerts }
  };
})();
