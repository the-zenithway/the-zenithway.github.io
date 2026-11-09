/* Profile: who you are on the platform, your statistics, and (later) your settings. Statistics come from js/zp-stats.js. */
(async function () {
  'use strict';
  requireLogin();
  var ctx = ZPUI.resolveContext(), main = document.getElementById('zp-main');
  ZPUI.guard(main);
  var lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', logout);
  if (!ctx) return;
  var ZP = window.ZP, UI = window.ZPUI, esc = UI.esc;
  if (!ctx.course) { main.innerHTML = UI.emptyState('Your profile starts with a course that has problem banks', 'Available for AP Calculus BC and AP Chemistry.', '<a class="zp-btn primary" href="portal.html">Back to courses</a>'); return; }
  var cid = encodeURIComponent(ctx.course.id), data, store, tab = (location.hash || '#stats').slice(1);
  if (['stats', 'settings'].indexOf(tab) < 0) tab = 'stats';
  try { data = await ZPBanks.load(ctx.course.id); } catch (e) { main.innerHTML = UI.emptyState('Could not load your data', esc(e.message)); return; }
  store = ZP.open(ctx.student.username, ctx.course.id); await store.load();
  var self = await isSelfStudy_(ctx.student);
  var mentors = self || typeof teachersForStudentCourse_ !== 'function' ? [] : teachersForStudentCourse_(ctx.student, ctx.course.id).map(function (t) { return t.name.replace(/\(.*\)/, '').trim(); });

  function head() {
    var D = ZP.derive(store.events(), data.info), st = ZP.stats(D, data.info), done = data.info.order.filter(function (c) { return D.stages[c].complete; }).length;
    return '<div class="zp-crumb"><span>' + esc(ctx.course.name) + '</span>' + UI.saveStatus(store) + '</div><h1>Profile</h1>' + UI.courseSwitcher(ctx, 'profile.html') +
      '<section class="zp-panel zp-who"><div><p class="zp-eyebrow">' + esc(self ? 'Self-study track' : 'Class') + '</p><h2>' + esc(ctx.student.name) + '</h2>' +
      '<p class="zp-muted">' + esc(ctx.student.username) + ' · ' + esc(ctx.course.name) + (mentors.length ? ' · mentor ' + esc(mentors.join(', ')) : '') + '</p></div>' +
      '<div class="zp-stats"><div><b>' + done + ' / ' + data.info.order.length + '</b><span>chapters complete</span></div><div><b>' + st.streak.current + '</b><span>day streak</span></div><div><b>' + st.overall.seen + '</b><span>problems answered</span></div></div></section>' +
      '<nav class="zp-tabs"><a href="#stats" data-tab="stats" class="' + (tab === 'stats' ? 'on' : '') + '">Statistics</a><a href="#settings" data-tab="settings" class="' + (tab === 'settings' ? 'on' : '') + '">Settings</a></nav>';
  }
  /* ---------- settings ---------- */
  var ZS = window.ZPSettings, capturing = '', capMsg = '', offMsg = '';
  var HAS_CALC = data.problems.some(function (q) { return q.calc; }), HAS_FRQ = data.problems.some(function (q) { return q.frq; });
  function sel(id, label, opts, val) {
    return '<label class="zp-field inline"><span>' + label + '</span><select data-b="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function settingsHTML() {
    var S = ZS.get(), B = S.browse;
    var themes = ZS.THEMES.map(function (t) {
      return '<button type="button" class="zp-themecard' + (S.theme === t[0] ? ' on' : '') + '" data-pick-theme="' + t[0] + '" aria-pressed="' + (S.theme === t[0]) + '"><span class="zp-swatch t-' + t[0] + '"><i></i></span><b>' + esc(t[1]) + '</b><span class="zp-muted">' + esc(t[2]) + '</span></button>';
    }).join('');
    var widths = ZS.WIDTHS.map(function (w) { return '<button type="button" class="zp-chip' + (S.width === w[0] ? ' on' : '') + '" data-pick-width="' + w[0] + '">' + esc(w[1]) + '</button>'; }).join('');
    var browse = (HAS_CALC ? sel('calc', 'Calculator', [['', 'Any'], ['no', 'No calculator'], ['yes', 'Calculator']], B.calc) : '') + (HAS_FRQ ? sel('type', 'Format', [['', 'Any'], ['mcq', 'Multiple choice'], ['frq', 'Free response']], B.type) : '') +
      sel('status', 'Status', [['', 'Any'], ['new', 'Not tried'], ['inbox', 'Needs an entry'], ['review', 'In review'], ['done', 'Done']], B.status) +
      sel('sort', 'Sort by', [['default', 'Default order'], ['status', 'Needs attention first']].concat(data.problems.some(function (q) { return q.kind === 'F'; }) ? [['apnew', 'AP year, newest'], ['apold', 'AP year, oldest']] : []), B.sort);
    var keys = ZS.ACTIONS.map(function (a) {
      var cur = ZS.binding(a.id), custom = cur !== a.def, cap = capturing === a.id;
      return '<tr><td>' + esc(a.label) + '</td><td>' + (cap ? '<span class="zp-keycap cap">Press a key…</span> <button type="button" class="zp-linkbtn" data-act="cancelkey">Cancel</button>' : '<kbd class="zp-keycap">' + esc(ZS.keyLabel(cur)) + '</kbd> <button type="button" class="zp-linkbtn" data-act="rebind" data-id="' + a.id + '">Change</button>') +
        (custom && !cap ? ' <button type="button" class="zp-linkbtn" data-act="resetkey" data-id="' + a.id + '">Reset (' + esc(ZS.keyLabel(a.def)) + ')</button>' : '') + '</td></tr>';
    }).join('');
    var offline = ZS.offlineSupported() ? '<label class="zp-check"><input type="checkbox" data-act="offline"' + (S.offline ? ' checked' : '') + '> Work offline</label>' +
      '<p class="zp-muted">Saves the platform (pages, problem banks, figures) in this browser so it keeps working without a connection. Anything you do offline is saved here and syncs when you are back online. When you are online you always get the newest version.</p>' +
      '<div class="zp-row"><button type="button" class="zp-btn" data-act="offupdate"' + (S.offline ? '' : ' disabled') + '>Update offline copy</button><span class="zp-muted" id="zp-offstat" role="status">' + esc(offMsg) + '</span></div>'
      : '<p class="zp-muted">This browser does not support offline mode. Try a current Chrome, Safari or Firefox over https.</p>';
    return '<section class="zp-panel"><h2>Appearance</h2><p class="zp-label">Theme</p><div class="zp-themes">' + themes + '</div><p class="zp-label">Content width</p><div class="zp-chips">' + widths + '</div>' +
      '<p class="zp-muted">How wide the course pages (chapters, practice, notebook, profile) grow on a big screen.</p></section>' +
      '<section class="zp-panel"><h2>Browse filters</h2><p class="zp-muted">Where Trainer > Browse starts. You can still change any filter once you are in.</p><div class="zp-row">' + browse + '</div>' +
      '<label class="zp-check"><input type="checkbox" data-b="remember"' + (B.remember ? ' checked' : '') + '> Remember the filters I used last time</label></section>' +
      '<section class="zp-panel"><h2>Keyboard shortcuts</h2><label class="zp-check"><input type="checkbox" data-act="keyson"' + (S.keysOn ? ' checked' : '') + '> Use keyboard shortcuts</label>' +
      '<div class="zp-tablewrap"><table class="zp-table"><tbody>' + keys + '</tbody></table></div>' + (capMsg ? '<p class="zp-formerr" role="alert">' + esc(capMsg) + '</p>' : '') +
      '<p class="zp-muted">Shortcuts work in problems and the Browse window, never while you are typing. Choosing, checking, showing the answer and flagging work in any problem; next, previous and close work in the Browse window (and next and previous in a chapter\'s problems).</p>' +
      '<div class="zp-row"><button type="button" class="zp-btn" data-act="resetkeys">Reset all shortcuts</button></div></section>' +
      '<section class="zp-panel"><h2>Offline mode</h2>' + offline + '</section>' +
      '<p class="zp-muted">Settings are saved in this browser for this account.</p>';
  }
  function offlineStatus() {
    var el = document.getElementById('zp-offstat'); if (!el || offMsg) return;
    if (ZS.get().offline) ZS.offlineCount().then(function (n) { var e2 = document.getElementById('zp-offstat'); if (e2 && !offMsg) e2.textContent = n ? n + ' files saved for offline use.' : ''; });
  }
  function onSettingsClick(e) {
    var th = e.target.closest('[data-pick-theme]'); if (th) { ZS.set({ theme: th.dataset.pickTheme }); return render(); }
    var w = e.target.closest('[data-pick-width]'); if (w) { ZS.set({ width: w.dataset.pickWidth }); return render(); }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'rebind') { capturing = b.dataset.id; capMsg = ''; render(); }
    else if (a === 'cancelkey') { capturing = ''; capMsg = ''; render(); }
    else if (a === 'resetkey') { var k = Object.assign({}, ZS.get().keys); delete k[b.dataset.id]; ZS.set({ keys: null }); ZS.set({ keys: k }); render(); }
    else if (a === 'resetkeys') { capturing = ''; capMsg = ''; ZS.set({ keys: null }); render(); }
    else if (a === 'offupdate') { offMsg = 'Saving the platform for offline use…'; render(); ZS.offlineUpdate().then(function (r) { offMsg = r && r.ok ? 'Saved ' + r.saved + ' files' + (r.failed && r.failed.length ? ' (' + r.failed.length + ' could not be saved)' : '') + '.' : 'Could not save for offline use.'; render(); }).catch(function (er) { offMsg = 'Could not save: ' + er.message; render(); }); }
  }
  function onSettingsChange(e) {
    var t = e.target;
    if (t.dataset.b) { var v = t.type === 'checkbox' ? t.checked : t.value, patch = {}; patch[t.dataset.b] = v; ZS.set({ browse: patch }); return; }
    if (t.dataset.act === 'keyson') { ZS.set({ keysOn: t.checked }); return; }
    if (t.dataset.act === 'offline') {
      if (t.checked) { offMsg = 'Saving the platform for offline use…'; render(); ZS.offlineEnable().then(function (r) { offMsg = r && r.ok ? 'Saved ' + r.saved + ' files' + (r.failed && r.failed.length ? ' (' + r.failed.length + ' could not be saved)' : '') + '. You can go offline.' : 'Could not save for offline use.'; render(); }).catch(function (er) { ZS.set({ offline: false }); offMsg = 'Could not turn on offline mode: ' + er.message; render(); }); }
      else { ZS.offlineDisable().then(function () { offMsg = 'Offline mode is off and the saved copy was removed.'; render(); }); }
    }
  }
  // Press-a-key capture for "Change". Esc cancels; a key another action uses is refused.
  document.addEventListener('keydown', function (e) {
    if (!capturing) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].indexOf(e.key) >= 0) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { capturing = ''; capMsg = ''; return render(); }
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key, clash = ZS.ACTIONS.filter(function (a) { return a.id !== capturing && (ZS.binding(a.id) || '').toLowerCase() === k.toLowerCase(); })[0];
    if (clash) { capMsg = '"' + ZS.keyLabel(k) + '" is already used for "' + clash.label + '". Pick another key.'; return render(); }
    var keys = Object.assign({}, ZS.get().keys); keys[capturing] = k; ZS.set({ keys: keys }); capturing = ''; capMsg = ''; render();
  }, true);

  function render() {
    var h = head();
    if (tab === 'settings') {
      main.innerHTML = h + settingsHTML(); offlineStatus();
    } else {
      var host = document.createElement('div');
      ZPStats.render(host, { D: ZP.derive(store.events(), data.info), info: data.info, head: '', course: ctx.course.id });
      main.innerHTML = h; main.appendChild(host);
    }
    UI.renderMath(main);
  }
  main.onclick = function (e) { var t = e.target.closest('[data-tab]'); if (t) { e.preventDefault(); tab = t.dataset.tab; history.replaceState(null, '', '#' + tab); return render(); } if (tab === 'settings') onSettingsClick(e); };
  main.onchange = function (e) { if (tab === 'settings') onSettingsChange(e); };
  store.onChange(function () { var el = document.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
  render();
})();
