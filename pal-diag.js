/* pal-diag.js - P Apps Device check (Suite Programme, WP0.2)
 * Loaded on demand by the launcher (Pete only). Read-only apart from one bounded
 * storage-headroom probe that writes a scratch key and ALWAYS removes it again.
 * Produces a copyable plain-text report, format "device-check/1".
 * No network calls except a same-origin fetch of manifest.json. No secrets are
 * reported: no tokens, no keys, no email, no record contents.
 */
(function () {
  'use strict';
  if (window.PalDiag) return;

  var VERSION = '1.4.0';
  var PROBE_KEY = '__pal_diag_probe';
  var PROBE_CAP = 2500000;     // characters; never write more than this
  var COARSE = 250000, FINE = 10000;

  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  function kb(n) { return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* -- probe: how much more localStorage can this origin write? -- */
  function probeHeadroom() {
    var out = { ok: false, headroomChars: 0, capped: false, note: '' };
    var ls;
    try { ls = window.localStorage; } catch (e) { out.note = 'localStorage unavailable'; return out; }
    try { ls.removeItem(PROBE_KEY); } catch (e) {}       // stale probe from an interrupted run
    var written = 0, chunk = 'x'.repeat(COARSE);
    try {
      var acc = '';
      // coarse phase
      while (written + COARSE <= PROBE_CAP) {
        try { ls.setItem(PROBE_KEY, acc + chunk); acc += chunk; written += COARSE; }
        catch (e) { break; }
      }
      // fine phase
      if (written + COARSE <= PROBE_CAP || written === 0) {
        var small = 'x'.repeat(FINE);
        while (written + FINE <= PROBE_CAP) {
          try { ls.setItem(PROBE_KEY, acc + small); acc += small; written += FINE; }
          catch (e) { break; }
        }
      }
      out.capped = written + FINE > PROBE_CAP && written >= PROBE_CAP - COARSE;
      out.headroomChars = written;
      out.ok = true;
    } finally {
      try { ls.removeItem(PROBE_KEY); } catch (e) {}
    }
    out.cleaned = safe(function () { return ls.getItem(PROBE_KEY) === null; }, false);
    return out;
  }

  function storageInventory() {
    var ls = window.localStorage, groups = {}, rows = [], total = 0, n = 0;
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i); if (k === PROBE_KEY) continue;
      var v = ls.getItem(k) || '', size = (k.length + v.length);   // characters, key + value
      total += size; n++;
      rows.push([k, size]);
      var g = k.indexOf('pal_x_') === 0 ? 'pal_x_*' : (/^sb-|supabase/i.test(k) ? 'auth' : (k.split(/[_:-]/)[0] || k));
      groups[g] = (groups[g] || 0) + size;
    }
    rows.sort(function (a, b) { return b[1] - a[1]; });
    return { keys: n, chars: total, top: rows.slice(0, 8), groups: groups };
  }

  // 1.0.1: contracts carry `built` (ISO string); 1.0.0 looked for `updatedAt`, which does not exist, so age always showed '-'
  function ageOf(o) {
    var b = o && (o.built || o.updatedAt), t = typeof b === 'number' ? b : Date.parse(b);
    if (!b || isNaN(t)) return '-';
    var m = Math.round((Date.now() - t) / 60000);
    return m < 120 ? m + ' min' : (m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d');
  }

  function contracts() {
    var ls = window.localStorage, out = [];
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i); if (k.indexOf('pal_x_') !== 0) continue;
      var raw = ls.getItem(k) || '', o = safe(function () { return JSON.parse(raw); }, null);
      var isFeed = k.indexOf('pal_x_f_') === 0, cid = isFeed ? '' : k.slice(6);
      var meta = '', issues = [];
      if (o && !isFeed) {   // 1.2.0: check the contract against its own rules (additive v1.2 fields are optional)
        if (o.v !== 1) issues.push('v is not 1');
        if (o.appId !== cid) issues.push('appId does not match the key');
        if (!o.userId) issues.push('no userId');
        var bt = Date.parse(o.built);
        if (isNaN(bt)) issues.push('no valid built time'); else if (Date.now() - bt > 7 * 864e5) issues.push('STALE (over 7 days)');
        var pct = Math.round(raw.length * 2 / 1024 / 48 * 100);   // 1.4.0: share of the 48 KB limit the library puts on a stored contract
        if (pct > 100) issues.push('over 48 KB');
        else if (pct >= 80) issues.push('NEAR THE 48 KB LIMIT (' + pct + '%): above it the library silently keeps the older copy');
        meta = [o.app ? 'app ' + o.app : '', o.schema ? 'schema ' + o.schema : '', o.lib ? 'lib ' + o.lib : '',
                o.caps ? 'caps ' + Object.keys(o.caps).length : ''].filter(Boolean).join(', ');
      }
      out.push({
        key: k, bytes: raw.length, pct: (!isFeed && o) ? Math.round(raw.length * 2 / 1024 / 48 * 100) : null, feed: isFeed, meta: meta, issues: issues,
        v: o && (o.v || o.version || o.schema) || '?',
        uid: o && o.userId ? String(o.userId).slice(0, 8) : '-',
        age: ageOf(o)
      });
    }
    return out;
  }

  // 1.0.1: also looks one and two levels inside each app frame. Claims, Vault and Horizon are not top-level frames: they are
  // nested lazy iframes inside Fortnight / On Budget, so 1.0.0 always reported them 'not loaded'. A nested frame appears as
  // 'parent > child' once the parent app has opened it.
  function describeFrame(f, name) {
    var row = { app: name, state: 'not loaded', title: '', lib: '' };
    var d = safe(function () { return f.contentDocument; }, null);
    if (d && d.body && f.getAttribute('src') && safe(function () { return f.contentWindow.location.href; }, '') !== 'about:blank') {
      row.state = 'loaded';
      row.title = safe(function () { return d.title; }, '');
      var s = safe(function () { return d.querySelector('script[src*="pal-shared.js"]'); }, null);
      row.lib = s ? (s.getAttribute('src').split('?v=')[1] || 'untagged') : 'none';
      row.has_PalSync = !!safe(function () { return f.contentWindow.PalSync; }, null);
      // 1.1.0: what the frame actually loaded (PalShared.VERSION, bundle semver) and the app version found in its title
      row.libVersion = safe(function () { return f.contentWindow.PalShared && f.contentWindow.PalShared.VERSION || ''; }, '');
      var tm = /v?(\d+\.\d+(?:\.\d+)?)\s*$/.exec(row.title || '');
      row.titleVersion = tm ? tm[1] : '';
    }
    return { row: row, doc: row.state === 'loaded' ? d : null };
  }
  function scanFrames(doc, prefix, depth, out) {
    var frames = safe(function () { return doc.querySelectorAll(depth === 0 ? 'iframe.app-frame' : 'iframe'); }, []);
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], id = (f.id || '').replace('frame-', '') || f.getAttribute('title') || (f.getAttribute('data-src') || f.getAttribute('src') || '').split('/').pop() || ('frame' + i);
      var r = describeFrame(f, prefix ? prefix + ' > ' + id : id);
      if (depth > 0 && r.row.state !== 'loaded') continue;   // unopened nested frames are not interesting
      out.push(r.row);
      if (r.doc && depth < 2) scanFrames(r.doc, r.row.app, depth + 1, out);
    }
  }
  function frameVersions() {
    var out = [];
    scanFrames(document, '', 0, out);
    return out;
  }

  function fetchManifest() {
    return fetch('manifest.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return { error: 'HTTP ' + r.status };
      return r.json();
    }).catch(function (e) { return { error: String(e && e.message || e) }; });
  }

  function collect(ctx) {
    ctx = ctx || {};
    var R = [];   // [section, [lines]]
    function sec(name, lines) { R.push([name, lines]); }
    var now = new Date();

    sec('Report', [
      'format: device-check/1',
      'diag: pal-diag.js ' + VERSION,
      'launcher: ' + (ctx.launcherVersion || '?'),
      'user: ' + (ctx.userName || '?') + (ctx.isPete ? ' (Pete)' : ''),
      'generated: ' + now.toISOString()
    ]);

    var standalone = safe(function () { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }, false);
    var probeEl = document.createElement('div');
    probeEl.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
    document.body.appendChild(probeEl);
    var cs = getComputedStyle(probeEl);
    var safeArea = cs.paddingTop + ' / ' + cs.paddingRight + ' / ' + cs.paddingBottom + ' / ' + cs.paddingLeft;
    probeEl.remove();
    var vp = document.querySelector('meta[name="viewport"]');
    sec('Device', [
      'userAgent: ' + navigator.userAgent,
      'standalone (home-screen): ' + standalone,
      'viewport: ' + innerWidth + 'x' + innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x, ' + safe(function () { return screen.orientation.type; }, 'orientation ?'),
      'safe-area top/right/bottom/left: ' + safeArea,
      'viewport meta: ' + (vp ? vp.getAttribute('content') : 'none'),
      'online: ' + navigator.onLine + ', connection: ' + safe(function () { return navigator.connection.effectiveType; }, 'n/a'),
      'visibility: ' + document.visibilityState,
      'language: ' + navigator.language
    ]);

    var tz = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, '?');
    var utcISO = now.toISOString().slice(0, 10), locISO = localISO(now);
    sec('Time and date', [
      'timezone: ' + tz + ', UTC offset now: ' + (-now.getTimezoneOffset()) + ' min',
      'local date: ' + locISO + ', UTC date: ' + utcISO + (locISO !== utcISO ? '   << DIFFER (UTC-date defects would show now)' : '   (same)')
    ]);

    var inv = safe(function () { return storageInventory(); }, null);
    var lines = [];
    if (inv) {
      lines.push('localStorage: ' + inv.keys + ' keys, ' + kb(inv.chars) + ' chars (key+value)');
      lines.push('by group: ' + Object.keys(inv.groups).sort(function (a, b) { return inv.groups[b] - inv.groups[a]; })
        .slice(0, 8).map(function (g) { return g + ' ' + kb(inv.groups[g]); }).join(', '));
      lines.push('largest keys: ' + inv.top.map(function (r) { return r[0] + ' ' + kb(r[1]); }).join(', '));
    } else lines.push('localStorage: unavailable');
    var pr = probeHeadroom();
    if (pr.ok) {
      lines.push('write headroom: >= ' + kb(pr.headroomChars) + ' chars' + (pr.capped ? ' (probe cap reached; real headroom is at least this)' : ' (writes failed beyond this)'));
      lines.push('probe key removed: ' + pr.cleaned);
      if (inv && !pr.capped) lines.push('estimated quota: ~' + kb(inv.chars + pr.headroomChars) + ' chars; headroom ' + Math.round(100 * pr.headroomChars / (inv.chars + pr.headroomChars)) + '%   (gate: < 30% pulls a fix into Phase 1)');
    } else lines.push('write headroom: not measured (' + pr.note + ')');
    sec('localStorage', lines);

    var ct = safe(contracts, []);
    sec('Contracts (pal_x_*)', ct.length ? ct.map(function (c) {
      return c.key + ': ' + kb(c.bytes) + (c.pct != null ? ' (' + c.pct + '% of the 48 KB limit)' : '') + ', v' + c.v + ', user ' + c.uid + ', age ' + c.age +
        (c.meta ? ' | ' + c.meta : (c.feed ? '' : ' | no app/schema/lib yet')) + (c.issues && c.issues.length ? ' | ISSUE: ' + c.issues.join('; ') : '');
    }) : ['none stored']);

    // 1.2.0: cloud copy of the contracts (pal-shared 1.5.0 / launcher v11.67)
    var cl = safe(function () { return window.PalContract && window.PalContract.cloudStatus ? window.PalContract.cloudStatus() : null; }, null);
    var cloudLines = [];
    function tm(t) { return t ? new Date(t).toISOString().slice(11, 16) + ' UTC (' + Math.round((Date.now() - t) / 60000) + ' min ago)' : 'never'; }
    if (!cl) cloudLines.push('this pal-shared.js has no cloud contracts (older than 1.5.0)');
    else {
      var pl = cl.pull, ph = cl.push, localN = ct.filter(function (c) { return !c.feed; }).length;
      cloudLines.push('pull: ' + (pl.at ? (pl.ok ? 'ok' : 'FAILED (' + (pl.error || '?') + ')') + ' at ' + tm(pl.at) + ', cloud rows ' + pl.rows + ', applied ' + (pl.applied.length ? pl.applied.join(',') : 'none') + ', kept local ' + pl.kept + ', rejected ' + pl.rejected : 'not run yet in this window'));
      cloudLines.push('push (from this window): sent ' + ph.pushed + ', skipped unchanged ' + ph.skipped + ', last ' + tm(ph.lastPushAt) + (ph.disabled ? ', DISABLED: ' + ph.disabled : '') + (ph.lastError ? ', last error: ' + ph.lastError : ''));
      if (pl.ok) cloudLines.push('local contracts ' + localN + ' vs cloud rows ' + pl.rows + (pl.rows < localN ? '   << some apps have not reached the cloud yet (they publish on their next save)' : ''));
      if (pl.error === 'table missing') cloudLines.push('the pal_contracts table does not exist yet: run the Batch A SQL in Supabase');
    }
    sec('Cloud contracts', cloudLines);

    var fv = safe(frameVersions, []);
    sec('App frames', fv.map(function (f) {
      return f.app + ': ' + f.state + (f.state === 'loaded' ? ' | "' + f.title + '" | pal-shared tag ?v=' + f.lib + ' | PalShared ' + (f.libVersion || 'not loaded') + ' | PalSync ' + f.has_PalSync : '');
    }));

    // 1.1.0: version verdict. Tag mismatch = the page asked for a different cache-bust tag than its own version (stale or hand-edited).
    // Library skew = frames running different PalShared builds (a cached older pal-shared.js in one app).
    var vl = [], loaded = fv.filter(function (f) { return f.state === 'loaded'; }), libs = {}, bad = 0;
    loaded.forEach(function (f) {
      if (f.titleVersion && f.lib && f.lib !== 'none' && f.lib !== 'untagged' && f.lib !== f.titleVersion) { bad++; vl.push('MISMATCH ' + f.app + ': title says ' + f.titleVersion + ' but pal-shared tag is ?v=' + f.lib); }
      if (f.libVersion) (libs[f.libVersion] = libs[f.libVersion] || []).push(f.app);
    });
    var lk = Object.keys(libs);
    if (lk.length > 1) { bad++; vl.push('LIBRARY SKEW: ' + lk.map(function (k) { return 'PalShared ' + k + ' in ' + libs[k].join(', '); }).join('; ')); }
    vl.unshift(loaded.length ? (bad ? 'RESULT: ' + bad + ' issue(s) - ' : 'RESULT: OK - ') + loaded.length + ' frame(s) loaded' + (lk.length === 1 ? ', all on PalShared ' + lk[0] : '') + (loaded.length < 10 ? ' (frames that are not open yet are not checked)' : '') : 'RESULT: no app frames loaded yet - open apps, then run again');
    sec('Version check', vl);

    return { R: R, standalone: standalone };
  }

  function asyncSections(R) {
    var jobs = [];
    // storage manager + IndexedDB
    jobs.push(Promise.resolve().then(function () {
      var L = [];
      var p = [];
      if (navigator.storage && navigator.storage.estimate) p.push(navigator.storage.estimate().then(function (e) { L.push('origin usage: ' + kb(e.usage || 0) + ' of quota ' + kb(e.quota || 0)); }).catch(function () { L.push('storage.estimate failed'); }));
      else L.push('storage.estimate: n/a');
      if (navigator.storage && navigator.storage.persisted) p.push(navigator.storage.persisted().then(function (b) { L.push('persistent storage granted: ' + b); }).catch(function () {}));
      if (indexedDB && indexedDB.databases) p.push(indexedDB.databases().then(function (d) { L.push('IndexedDB: ' + (d.length ? d.map(function (x) { return x.name + ' v' + x.version; }).join(', ') : 'none')); }).catch(function () { L.push('IndexedDB list failed'); }));
      else L.push('IndexedDB list: n/a');
      return Promise.all(p).then(function () { R.push(['Origin storage', L]); });
    }));
    // 1.3.0: fonts - are they served from this site (fonts/pal-fonts.css) and loaded, and has anything gone to an outside font host?
    jobs.push(Promise.resolve().then(function () {
      var L = [];
      var res = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
      var own = res.filter(function (e) { return /\/fonts\/[^\/]+\.(woff2|css)(\?|$)/.test(e.name); });
      var ext = res.filter(function (e) { return /fonts\.(googleapis|gstatic)\.com/.test(e.name); });
      L.push('font files fetched from this site (this page load): ' + own.length + (own.length ? ' (' + own.map(function (e) { return e.name.split('/').pop().split('?')[0]; }).join(', ') + ')' : ' (none: cached, or not requested)'));
      L.push('requests to Google font hosts: ' + ext.length + (ext.length ? '  <-- UNEXPECTED' : ' (expected 0)'));
      if (document.fonts && document.fonts.forEach) {
        var faces = [];
        document.fonts.forEach(function (f) { faces.push(f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.status); });
        L.push('font faces: ' + (faces.length ? faces.join('; ') : 'none registered'));
      }
      var chk = function (q) { try { return document.fonts.check(q); } catch (e) { return 'n/a'; } };
      L.push('DM Sans usable: ' + chk('16px "DM Sans"') + '; Bricolage Grotesque usable: ' + chk('16px "Bricolage Grotesque"'));
      R.push(['Fonts', L]);
    }));
    // service workers
    jobs.push(Promise.resolve().then(function () {
      if (!(navigator.serviceWorker && navigator.serviceWorker.getRegistrations)) { R.push(['Service workers', ['n/a']]); return; }
      return navigator.serviceWorker.getRegistrations().then(function (r) {
        R.push(['Service workers', [r.length ? r.map(function (g) { return g.scope; }).join(', ') : 'none (expected)', 'controller: ' + (navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : 'none')]]);
      }).catch(function () { R.push(['Service workers', ['query failed']]); });
    }));
    // manifest
    jobs.push(fetchManifest().then(function (m) {
      var L = [];
      if (m.error) L.push('manifest.json: ' + m.error);
      else {
        L.push('name/short_name: ' + m.name + ' / ' + m.short_name);
        L.push('start_url: ' + m.start_url + ', scope: ' + (m.scope || 'none') + ', id: ' + (m.id || 'none'));
        L.push('display: ' + m.display + ', orientation: ' + (m.orientation || 'none'));
        L.push('background/theme: ' + m.background_color + ' / ' + m.theme_color);
        L.push('icons: ' + (m.icons || []).map(function (i) { return i.sizes + ' ' + (i.purpose || 'any'); }).join('; '));
      }
      var link = document.querySelector('link[rel="manifest"]');
      L.push('<link rel=manifest>: ' + (link ? link.getAttribute('href') : 'MISSING'));
      L.push('apple-touch-icon: ' + (document.querySelector('link[rel="apple-touch-icon"]') ? 'present' : 'absent'));
      var tc = document.querySelector('meta[name="theme-color"]');
      L.push('meta theme-color: ' + (tc ? tc.getAttribute('content') : 'absent'));
      R.push(['Manifest and install', L]);
    }));
    return Promise.all(jobs);
  }

  function toText(R) {
    return R.map(function (s) { return '## ' + s[0] + '\n' + s[1].join('\n'); }).join('\n\n') + '\n';
  }

  /* -- UI: one modal sheet, nothing persists -- */
  function show(text) {
    var old = document.getElementById('palDiagSheet'); if (old) old.remove();
    var wrap = document.createElement('div'); wrap.id = 'palDiagSheet';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Device check');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:20001;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;font-family:var(--f,system-ui,sans-serif)';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--surface,#1b1a22);color:var(--ink,#f5f2ea);width:100%;max-width:720px;max-height:88vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box';
    var h = document.createElement('div'); h.style.cssText = 'font:700 16px var(--fd,inherit);margin-bottom:8px'; h.textContent = 'Device check';
    var pre = document.createElement('pre');
    pre.style.cssText = 'flex:1;overflow:auto;margin:0 0 12px;font:12px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;background:rgba(127,127,127,.12);border-radius:12px;padding:10px;-webkit-user-select:text;user-select:text';
    pre.textContent = text;
    var bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px';
    function btn(label, primary, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'flex:1;min-height:44px;border-radius:12px;border:1px solid var(--sep,#444);font:700 14px var(--f,inherit);cursor:pointer;' +
        (primary ? 'background:var(--acc,#CBF55C);color:var(--accTx,#14130A);border-color:transparent' : 'background:transparent;color:inherit');
      b.addEventListener('click', fn); return b;
    }
    var copy = btn('Copy report', true, function () {
      function done(ok) { copy.textContent = ok ? 'Copied \u2713' : 'Select the text and copy'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
      else fallback();
      function fallback() {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
        done(ok);
      }
    });
    var close = btn('Close', false, function () { wrap.remove(); document.removeEventListener('keydown', onKey); });
    function onKey(e) { if (e.key === 'Escape') close.click(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close.click(); });
    bar.appendChild(copy); bar.appendChild(close);
    box.appendChild(h); box.appendChild(pre); box.appendChild(bar); wrap.appendChild(box);
    document.body.appendChild(wrap);
    close.focus();
  }

  var running = false;
  function run(ctx) {
    if (running) return Promise.resolve();
    running = true;
    show('Running device check...');
    var c;
    try { c = collect(ctx); } catch (e) { running = false; show('Device check failed: ' + (e && e.message || e)); return Promise.resolve(); }
    return asyncSections(c.R).then(function () {
      // keep section order stable regardless of async completion order
      var order = ['Report', 'Device', 'Time and date', 'localStorage', 'Origin storage', 'Contracts (pal_x_*)', 'Cloud contracts', 'App frames', 'Version check', 'Fonts', 'Service workers', 'Manifest and install'];
      c.R.sort(function (a, b) { return order.indexOf(a[0]) - order.indexOf(b[0]); });
      show(toText(c.R));
    }).catch(function (e) { show('Device check failed: ' + (e && e.message || e)); })
      .then(function () { running = false; });
  }

  window.PalDiag = { VERSION: VERSION, run: run, _collect: collect, _probe: probeHeadroom, _text: toText };
})();
