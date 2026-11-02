/**
 * pal-search.js v1 — Universal Search overlay for the P Apps launcher.
 * Loaded on demand by index.html (first Cmd/Ctrl+K or tap on the search button); the launcher works without it.
 * Reads the optional search lists apps publish through PalContract.publishSearch (IndexedDB), via host.load() — it never loads an app,
 * never stores anything, and only sees lists the launcher has already checked belong to the signed-in user.
 *
 * host = {
 *   load():  Promise<{ <appId>: { rows, total, built } }>,   // already filtered to this user and this user's apps
 *   meta:    { <appId>: { label, icon, color } },
 *   open(appId, open):                          // launcher opens the app (and the record, if the app supports PAL_OPEN)
 * }
 * Result record (from the app): { id, t: title, s: detail line, k: kind, d: 'YYYY-MM-DD', open }.
 */
(function () {
  'use strict';
  if (window.PalSearch) return;

  var PER_GROUP = 5;
  var CSS = [
    '#psRoot{position:fixed;inset:0;z-index:9999;display:flex;justify-content:center;align-items:flex-start;padding:10vh 12px 12px;background:rgba(0,0,0,.5)}',
    '#psRoot[hidden]{display:none}',
    '#psBox{width:100%;max-width:640px;max-height:78vh;display:flex;flex-direction:column;background:var(--surface,#16161a);color:var(--ink,#f2f2f2);border:1px solid var(--sep,#333);border-radius:18px;overflow:hidden;font-family:var(--f,system-ui,sans-serif)}',
    '#psHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--sep,#333)}',
    '#psInput{flex:1;min-width:0;min-height:44px;background:transparent;border:0;outline:0;color:inherit;font:500 17px var(--f,system-ui,sans-serif)}',
    '#psInput::placeholder{color:var(--ink3,#888)}',
    '#psClose{min-width:44px;min-height:44px;background:none;border:0;border-radius:10px;color:var(--ink3,#888);font:600 13px var(--f,system-ui,sans-serif);cursor:pointer}',
    '#psClose:hover,#psClose:focus-visible{background:var(--surface2,#222);color:var(--ink,#f2f2f2)}',
    '#psList{overflow-y:auto;padding:4px 6px 8px;overscroll-behavior:contain}',
    '.ps-grp{font:700 11px var(--f,system-ui,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--ink3,#888);padding:10px 10px 4px}',
    '.ps-row{display:flex;align-items:center;gap:12px;padding:9px 10px;min-height:52px;border-radius:12px;cursor:pointer}',
    '.ps-row[aria-selected="true"]{background:var(--surface2,#222)}',
    '.ps-ic{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:14px;flex:none}',
    '.ps-tx{flex:1;min-width:0;display:flex;flex-direction:column}',
    '.ps-t{font:600 14px/1.25 var(--f,system-ui,sans-serif);overflow-wrap:anywhere}',
    '.ps-s{font:400 12px/1.3 var(--f,system-ui,sans-serif);color:var(--ink3,#888);margin-top:1px;overflow-wrap:anywhere}',
    '.ps-r{flex:none;text-align:right;font:500 11.5px var(--f,system-ui,sans-serif);color:var(--ink3,#888);max-width:34%}',
    '.ps-r b{display:block;font-weight:600;color:var(--ink2,#bbb)}',
    '.ps-t mark,.ps-s mark{background:rgba(242,193,78,.35);color:inherit;border-radius:3px}',
    '.ps-more{display:block;width:100%;text-align:left;padding:8px 10px;background:none;border:0;color:var(--ink3,#888);font:500 12.5px var(--f,system-ui,sans-serif);cursor:pointer;border-radius:10px;min-height:40px}',
    '.ps-more:hover,.ps-more:focus-visible{background:var(--surface2,#222);color:var(--ink,#f2f2f2)}',
    '.ps-note{padding:8px 12px;font:400 12.5px/1.5 var(--f,system-ui,sans-serif);color:var(--ink3,#888)}',
    '#psFoot{padding:8px 14px;border-top:1px solid var(--sep,#333);font:400 11.5px var(--f,system-ui,sans-serif);color:var(--ink3,#888)}',
    '@media (max-width:600px){#psRoot{padding:0}#psBox{max-width:none;max-height:none;height:100%;border-radius:0;border:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}'
  ].join('\n');

  var host = null, root, input, list, foot, built = false, prevFocus = null;
  var data = { rows: [], info: [] }, flat = [], active = -1, expanded = {}, uid = 0, openSeq = 0;

  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function fmtDate(d) {
    if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return '';
    var x = new Date(d.slice(0, 10) + 'T00:00:00');
    return isNaN(x.getTime()) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function build() {
    if (built) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = mk('div'); root.id = 'psRoot'; root.hidden = true;
    var box = mk('div'); box.id = 'psBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Search P Apps');
    var head = mk('div'); head.id = 'psHead';
    input = mk('input'); input.id = 'psInput'; input.type = 'search'; input.placeholder = 'Search gigs, books, films, claims, exercises, bills…';
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', 'psList');
    input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-label', 'Search P Apps'); input.autocomplete = 'off'; input.spellcheck = false;
    var close = mk('button', null, 'Esc'); close.id = 'psClose'; close.type = 'button'; close.setAttribute('aria-label', 'Close search');
    head.appendChild(input); head.appendChild(close);
    list = mk('div'); list.id = 'psList'; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Search results');
    foot = mk('div'); foot.id = 'psFoot';
    box.appendChild(head); box.appendChild(list); box.appendChild(foot); root.appendChild(box); document.body.appendChild(root);

    close.addEventListener('click', closeIt);
    root.addEventListener('mousedown', function (e) { if (e.target === root) closeIt(); });
    input.addEventListener('input', function () { expanded = {}; render(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeIt(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); if (active >= 0 && flat[active]) choose(flat[active]); }
      else if (e.key === 'Tab') {   // keep focus inside the dialog: input <-> close button
        e.preventDefault(); (document.activeElement === input ? close : input).focus();
      }
    });
    built = true;
  }

  function load(map) {
    var rows = [], info = [];
    Object.keys(map || {}).forEach(function (app) {
      var c = map[app], l = c && c.rows;
      if (!Array.isArray(l)) return;
      info.push({ app: app, n: l.length, total: c.total || l.length, built: c.built });
      l.forEach(function (r) {
        if (!r || !r.t) return;
        rows.push({ app: app, id: r.id, t: String(r.t), s: String(r.s || ''), k: String(r.k || ''), d: String(r.d || ''), open: r.open,
                    ht: norm(r.t), h: norm(r.t + ' ' + (r.s || '')) });
      });
    });
    data = { rows: rows, info: info };
  }

  function score(r, toks, q) {
    var total = 0;
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i], p = r.ht.indexOf(tk);
      if (p === 0) total += 100;
      else if (p > 0 && r.ht.charAt(p - 1) === ' ') total += 70;
      else if (p > 0) total += 45;
      else if (r.h.indexOf(tk) >= 0) total += 20;
      else return -1;
    }
    if (r.ht === q) total += 100;
    return total;
  }

  function hl(parent, text, re) {
    if (!re) { parent.textContent = text; return; }
    text.split(re).forEach(function (part, i) {
      if (i % 2 === 1) parent.appendChild(mk('mark', null, part)); else if (part) parent.appendChild(document.createTextNode(part));
    });
  }

  function label(app) { return (host.meta[app] && host.meta[app].label) || app; }

  function render() {
    list.textContent = ''; flat = []; active = -1;
    var q = norm(input.value).trim(), toks = q ? q.split(/\s+/) : [];
    if (!toks.length) { renderEmpty(); return; }
    var groups = {};
    data.rows.forEach(function (r) { var sc = score(r, toks, q); if (sc >= 0) (groups[r.app] = groups[r.app] || []).push({ r: r, sc: sc }); });
    var apps = Object.keys(groups);
    if (!apps.length) {
      list.appendChild(mk('div', 'ps-note', 'No matches for “' + input.value.trim() + '”.'));
      list.appendChild(mk('div', 'ps-note', 'Searched ' + data.rows.length + ' records in ' + data.info.map(function (i) { return label(i.app); }).join(', ') + '.' + truncNote()));
      foot.textContent = 'Esc to close'; input.setAttribute('aria-activedescendant', ''); return;
    }
    apps.forEach(function (a) { groups[a].sort(function (x, y) { return y.sc - x.sc || (y.r.d || '').localeCompare(x.r.d || ''); }); });
    apps.sort(function (a, b) { return groups[b][0].sc - groups[a][0].sc || label(a).localeCompare(label(b)); });
    var re = new RegExp('(' + toks.map(esc).join('|') + ')', 'i');
    apps.forEach(function (a) {
      var g = groups[a], show = expanded[a] ? g : g.slice(0, PER_GROUP), m = host.meta[a] || {};
      list.appendChild(mk('div', 'ps-grp', label(a) + ' · ' + g.length));
      show.forEach(function (x) { addRow(x.r, m, re); });
      if (g.length > PER_GROUP) {
        var more = mk('button', 'ps-more', expanded[a] ? 'Show fewer' : 'Show all ' + g.length + ' in ' + label(a)); more.type = 'button'; more.tabIndex = -1;
        more.addEventListener('click', function () { expanded[a] = !expanded[a]; var keep = input.value; render(); input.focus(); input.value = keep; });
        list.appendChild(more);
      }
    });
    if (flat.length) setActive(0);
    foot.textContent = '↑↓ to move · Enter to open · Esc to close' + (truncNote() ? ' · some apps show only their most recent records' : '');
  }

  function addRow(r, m, re) {
    var row = mk('div', 'ps-row'); row.id = 'ps-o' + (uid++); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', 'false');
    var ic = mk('span', 'ps-ic', m.icon || '•'); ic.style.background = m.color || '#555'; ic.setAttribute('aria-hidden', 'true');
    var tx = mk('span', 'ps-tx'), t = mk('span', 'ps-t'), s = mk('span', 'ps-s');
    hl(t, r.t, re); tx.appendChild(t); if (r.s) { hl(s, r.s, re); tx.appendChild(s); }
    row.appendChild(ic); row.appendChild(tx);
    var d = fmtDate(r.d), right = mk('span', 'ps-r');
    if (d) right.appendChild(mk('b', null, d));
    if (r.k) right.appendChild(document.createTextNode(r.k));
    if (d || r.k) row.appendChild(right);
    var idx = flat.length; flat.push(r);
    row.addEventListener('mousemove', function () { if (active !== idx) setActive(idx, true); });
    row.addEventListener('click', function () { choose(r); });
    list.appendChild(row);
  }

  function truncNote() {
    var cut = data.info.filter(function (i) { return i.total > i.n; });
    return cut.length ? ' ' + cut.map(function (i) { return label(i.app) + ': ' + i.n + ' of ' + i.total; }).join(', ') + ' searchable.' : '';
  }

  function renderEmpty() {
    if (!data.info.length) {
      list.appendChild(mk('div', 'ps-note', 'Nothing to search yet. Search lists come from updated apps: open Gigs & Trips, Reading, Film & TV, Claims, Gym or On Budget once, then try again.'));
    } else {
      list.appendChild(mk('div', 'ps-note', 'Type to search across:'));
      data.info.forEach(function (i) {
        var m = host.meta[i.app] || {}, line = (m.icon || '') + ' ' + label(i.app) + ' — ' + i.n + (i.total > i.n ? ' of ' + i.total : '') + ' records';
        var t = Date.parse(i.built); if (t && Date.now() - t > 2 * 86400000) line += ' (as of ' + new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ')';
        list.appendChild(mk('div', 'ps-note', line));
      });
      list.appendChild(mk('div', 'ps-note', 'Each list is as fresh as the last time that app ran on this device.'));
    }
    foot.textContent = 'Esc to close'; input.setAttribute('aria-activedescendant', '');
  }

  function setActive(i, noScroll) {
    var rows = list.querySelectorAll('.ps-row');
    if (active >= 0 && rows[active]) rows[active].setAttribute('aria-selected', 'false');
    active = i;
    if (rows[i]) { rows[i].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', rows[i].id); if (!noScroll) rows[i].scrollIntoView({ block: 'nearest' }); }
  }
  function move(d) { if (!flat.length) return; setActive((active + d + flat.length) % flat.length); }
  function choose(r) { var h = host; closeIt(); try { h.open(r.app, r.open); } catch (e) {} }
  function closeIt() {
    if (!built || root.hidden) return;
    root.hidden = true;
    var p = prevFocus; prevFocus = null;
    try { if (p && p.focus) p.focus(); } catch (e) {}
  }
  function openIt(h) {
    host = h; build();
    prevFocus = document.activeElement; input.value = ''; expanded = {}; data = { rows: [], info: [] };
    root.hidden = false; list.textContent = ''; list.appendChild(mk('div', 'ps-note', 'Loading\u2026')); foot.textContent = ''; input.focus();
    var mine = ++openSeq;
    Promise.resolve(h.load()).catch(function () { return {}; }).then(function (map) {
      if (mine !== openSeq || root.hidden) return;   // closed, or reopened, while loading
      load(map); render();
    });
  }

  window.PalSearch = {
    version: 1,
    open: openIt,
    close: closeIt,
    toggle: function (h) { if (built && !root.hidden) closeIt(); else openIt(h); },
    isOpen: function () { return !!built && !root.hidden; },
    _search: function (q) { var t = norm(q).trim().split(/\s+/); return data.rows.filter(function (r) { return score(r, t, norm(q).trim()) >= 0; }); }
  };
})();
