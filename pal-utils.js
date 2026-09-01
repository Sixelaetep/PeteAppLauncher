/**
 * pal-utils.js
 * ─────────────────────────────────────────────────────────────
 * Shared PURE, STATELESS utility functions used across the PAD suite.
 * Loaded via <script src="pal-utils.js?v=X.X"></script> — same
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
