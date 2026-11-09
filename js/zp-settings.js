/* Student settings (Profile > Settings), kept in this browser per account (localStorage "zenith:settings:<username>").
 *   theme     dark | light | midnight | paper | auto        (js/layout.js applies it before first paint; apply() keeps it live)
 *   width     narrow | default | wide | full               content width of the course platform pages
 *   browse    default filters for Trainer > Browse (calculator, format, status, sort) and "remember my filters"
 *   keysOn    keyboard shortcuts on / off
 *   keys      { actionId: key } overrides of the defaults in ACTIONS below
 *   offline   service worker (sw.js) keeps the site and the problem banks available without a connection
 * Pages ask ZPSettings.keyMatch(event, actionId) instead of hard-coding a key, so rebinding works everywhere. */
(function (root) {
  'use strict';
  var THEMES = [['dark', 'Dark', 'The default'], ['light', 'Light', 'Bright, high contrast'], ['midnight', 'Midnight', 'True black for OLED screens'], ['paper', 'Paper', 'Warm and easy on the eyes'], ['auto', 'Match my device', 'Light or dark with your system']];
  var WIDTHS = [['narrow', 'Narrow', '880px'], ['default', 'Default', '1120px'], ['wide', 'Wide', '1400px'], ['full', 'Full width', '100%']];
  // scope: where the action works. Choosing and checking work in any problem runner; next / previous / close work in the Browse window.
  var ACTIONS = [
    { id: 'copyQuestion', label: 'Copy the question', def: 'c' }, { id: 'copyId', label: 'Copy the problem ID', def: 'i' },
    { id: 'chooseA', label: 'Choose answer A', def: '1' }, { id: 'chooseB', label: 'Choose answer B', def: '2' }, { id: 'chooseC', label: 'Choose answer C', def: '3' }, { id: 'chooseD', label: 'Choose answer D', def: '4' },
    { id: 'check', label: 'Check answer', def: 'Enter' }, { id: 'reveal', label: 'Show the answer and solution', def: 's' }, { id: 'flag', label: 'Flag for review', def: 'f' },
    { id: 'next', label: 'Next problem', def: 'ArrowRight' }, { id: 'prev', label: 'Previous problem', def: 'ArrowLeft' }, { id: 'close', label: 'Close the problem window', def: 'Escape' }
  ];
  function defaults() { return { theme: 'dark', width: 'default', browse: { calc: '', type: '', status: '', sort: 'default', remember: false }, keysOn: true, keys: {}, offline: false }; }

  function user() { try { return localStorage.getItem('loggedInUsername') || ''; } catch (e) { return ''; } }
  function skey() { return 'zenith:settings:' + user(); }
  function get() {
    var d = defaults(), s = {};
    try { s = JSON.parse(localStorage.getItem(skey()) || '{}') || {}; } catch (e) { s = {}; }
    Object.keys(d).forEach(function (k) { if (s[k] !== undefined && k !== 'browse' && k !== 'keys') d[k] = s[k]; });
    Object.keys(d.browse).forEach(function (k) { if (s.browse && s.browse[k] !== undefined) d.browse[k] = s.browse[k]; });
    if (s.keys && typeof s.keys === 'object') d.keys = s.keys;
    return d;
  }
  function set(patch) {
    var cur = get();
    Object.keys(patch).forEach(function (k) { if ((k === 'browse' || k === 'keys') && patch[k]) cur[k] = Object.assign({}, cur[k], patch[k]); else cur[k] = patch[k]; });
    if (patch.keys === null) cur.keys = {};
    try { localStorage.setItem(skey(), JSON.stringify(cur)); } catch (e) { /* storage blocked */ }
    apply(); return cur;
  }
  function resolvedTheme(t) { return t === 'auto' ? (root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t; }
  function apply() {
    if (typeof document === 'undefined') return;
    var s = get(), el = document.documentElement, th = resolvedTheme(s.theme);
    if (th && th !== 'dark') el.setAttribute('data-theme', th); else el.removeAttribute('data-theme');
    var w = WIDTHS.filter(function (x) { return x[0] === s.width; })[0];
    if (w && w[0] !== 'default') el.style.setProperty('--zp-width', w[2]); else el.style.removeProperty('--zp-width');
  }
  if (root.matchMedia) { try { root.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (get().theme === 'auto') apply(); }); } catch (e) { /* old browser */ } }

  /* ---------- keyboard ---------- */
  function binding(id) { var a = ACTIONS.filter(function (x) { return x.id === id; })[0]; var s = get(); return s.keys[id] || (a && a.def) || ''; }
  function norm(k) { return k && k.length === 1 ? k.toLowerCase() : k; }
  // True when this keydown is the key the student chose for the action. Modifier combos never match (they belong to the browser).
  function keyMatch(e, id) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    var s = get(); if (!s.keysOn && id !== 'close') return false;
    return norm(e.key) === norm(binding(id));
  }
  function keyLabel(k) { return { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', ' ': 'Space' }[k] || (k && k.length === 1 ? k.toUpperCase() : k || ''); }
  function typingTarget(t) { return !!t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable); }

  /* ---------- Browse defaults ---------- */
  function browseKey() { var c = ''; try { c = localStorage.getItem('activeCourseId') || ''; } catch (e) { /* ignore */ } return 'zenith:browse:' + user() + ':' + c; }
  function rememberBrowse(S) { if (!get().browse.remember) return; try { localStorage.setItem(browseKey(), JSON.stringify({ f: S.f, sort: S.sort, yfrom: S.yfrom, yto: S.yto })); } catch (e) { /* ignore */ } }
  function recalledBrowse() { try { return JSON.parse(localStorage.getItem(browseKey())); } catch (e) { return null; } }

  /* ---------- offline mode ---------- */
  var SW_URL = 'sw.js';
  function offlineSupported() { return !!(navigator.serviceWorker && root.caches); }
  function swReady() { return navigator.serviceWorker.register(SW_URL).then(function () { return navigator.serviceWorker.ready; }); }
  function ask(sw, msg) {
    return new Promise(function (resolve) { var ch = new MessageChannel(); ch.port1.onmessage = function (e) { resolve(e.data); }; sw.postMessage(msg, [ch.port2]); setTimeout(function () { resolve({ ok: false, error: 'timeout' }); }, 120000); });
  }
  function offlineUpdate() {
    return swReady().then(function (reg) {
      return fetch('data/offline-manifest.json', { cache: 'reload' }).then(function (r) { return r.json(); }).then(function (m) { return ask(reg.active, { type: 'precache', urls: m.urls }); });
    });
  }
  function offlineEnable() { return offlineUpdate().then(function (res) { set({ offline: true }); return res; }); }
  function offlineDisable() {
    set({ offline: false });
    if (!offlineSupported()) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations().then(function (regs) { return Promise.all(regs.map(function (r) { return r.unregister(); })); })
      .then(function () { return caches.keys(); }).then(function (keys) { return Promise.all(keys.filter(function (k) { return /^zenith-/.test(k); }).map(function (k) { return caches.delete(k); })); });
  }
  function offlineCount() {
    if (!offlineSupported()) return Promise.resolve(0);
    return caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return /^zenith-/.test(k); }).map(function (k) { return caches.open(k).then(function (c) { return c.keys(); }).then(function (l) { return l.length; }); })); })
      .then(function (ns) { return ns.reduce(function (a, b) { return a + b; }, 0); });
  }

  root.ZPSettings = { THEMES: THEMES, WIDTHS: WIDTHS, ACTIONS: ACTIONS, defaults: defaults, get: get, set: set, apply: apply, binding: binding, keyMatch: keyMatch, keyLabel: keyLabel, typingTarget: typingTarget,
    rememberBrowse: rememberBrowse, recalledBrowse: recalledBrowse, offlineSupported: offlineSupported, offlineEnable: offlineEnable, offlineDisable: offlineDisable, offlineUpdate: offlineUpdate, offlineCount: offlineCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZPSettings;
})(typeof window === 'undefined' ? globalThis : window);
