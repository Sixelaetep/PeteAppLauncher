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
  FF_PROXY_KEY: zarsor-0tUsma-vamboj,

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
