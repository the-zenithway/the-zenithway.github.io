/* Shared UI helpers for the course platform pages. */
(function (root) {
  'use strict';
  var CFG = root.ZP_CONFIG, ZP = root.ZP;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function renderMath(el) {
    if (!root.renderMathInElement) { setTimeout(function () { if (root.renderMathInElement) renderMath(el); }, 300); return; }
    try {
      root.renderMathInElement(el, { throwOnError: false, delimiters: [
        { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }] });
    } catch (e) { /* leave plain text */ }
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(ms) { var d = new Date(ms); return MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function fmtISO(iso) { var p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]); }
  function ago(ms) {
    var d = Math.floor((Date.now() - ms) / ZP.DAY);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
  function btn(label, action, cls, attrs) { return '<button type="button" class="zp-btn ' + (cls || '') + '" data-act="' + action + '" ' + (attrs || '') + '>' + label + '</button>'; }

  /* ---- who / which course ---- */
  function resolveContext() {
    var student = getCurrentStudent();
    if (!student) return null;
    var params = new URLSearchParams(location.search);
    var enrolled = (student.courses || []).filter(function (c) { return CFG.COURSES[c.id]; });
    var want = params.get('course') || localStorage.getItem('activeCourseId');
    var course = enrolled.filter(function (c) { return c.id === want; })[0] || enrolled[0] || null;
    return { student: student, course: course, enrolled: enrolled, params: params };
  }
  function courseSwitcher(ctx, page) {
    if (ctx.enrolled.length < 2) return '';
    return '<div class="zp-switch">' + ctx.enrolled.map(function (c) {
      return '<a class="' + (c.id === ctx.course.id ? 'on' : '') + '" href="' + page + '?course=' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a>';
    }).join('') + '</div>';
  }
  function saveStatus(store) {
    if (store.status.localOnlyFailed) return '<span class="zp-sync bad">Browser storage is blocked — work will not be saved.</span>';
    if (!store.status.remote) return '<span class="zp-sync">Saved in this browser only</span>';
    if (store.status.error) return '<span class="zp-sync bad">Offline — ' + store.status.pending + ' change(s) waiting to sync</span>';
    return '<span class="zp-sync ok">' + (store.status.pending ? 'Saved · syncs within 5 min' : 'Synced') + ' <button type="button" class="zp-linkbtn" data-sync-now data-u="' + esc(store.username) + '" data-c="' + esc(store.course) + '">Sync now</button></span>';
  }
  // If a page script throws, say so on the page instead of leaving it blank.
  function guard(el) {
    var shown = false;
    function show(msg) {
      if (shown || !el) return; shown = true;
      el.insertAdjacentHTML('afterbegin', '<div class="zp-empty"><h2>Something went wrong loading this page</h2><p>' + esc(msg) + '</p><p class="zp-muted">Try a hard refresh (Cmd+Shift+R) so you have the latest files. If it keeps happening, send me this message.</p></div>');
    }
    root.addEventListener('error', function (e) { show(e.message || 'Script error'); });
    root.addEventListener('unhandledrejection', function (e) { show((e.reason && e.reason.message) || String(e.reason)); });
  }
  function emptyState(title, body, link) {
    return '<div class="zp-empty"><h2>' + esc(title) + '</h2><p>' + body + '</p>' + (link || '') + '</div>';
  }

  /* ---- problems ---- */
  function stemHTML(q) {
    return '<div class="zp-stem">' + esc(q.stem || '[Blank problem — source content missing]') + '</div>' +
      (q.figure ? '<figure class="zp-fig"><img src="' + esc(q.figure.src) + '" alt="' + esc(q.figure.alt) + '"></figure>' : '');
  }
  // opts: {selected, correct (letter, to mark), reveal (bool), locked}
  function choicesHTML(q, opts) {
    opts = opts || {};
    return '<div class="zp-choices" role="group" aria-label="Answer choices">' + q.choices.map(function (c, i) {
      var L = String.fromCharCode(65 + i), cls = 'zp-choice';
      if (opts.selected === L) cls += ' sel';
      if (opts.reveal && opts.correct === L) cls += ' right';
      if ((opts.reveal || opts.markWrong) && opts.selected === L && opts.correct !== L) cls += ' wrong';
      return '<button type="button" class="' + cls + '" data-choice="' + L + '"' + (opts.locked ? ' disabled' : '') + '><b>' + L + '</b><span>' + esc(c) + '</span></button>';
    }).join('') + '</div>';
  }
  function solutionHTML(q) {
    return '<div class="zp-solution"><p class="zp-label">' + (q.correct ? 'Answer ' + esc(q.correct) : 'Solution') + '</p><div class="zp-stem">' + esc(q.solution || 'No written solution in the bank yet.') + '</div>' +
      (q.sourceCorrection ? '<p class="zp-muted">Source correction: ' + esc(q.sourceCorrection) + '</p>' : '') +
      (q.scoringUrl ? '<p><a class="zp-link" href="' + esc(q.scoringUrl) + '" target="_blank" rel="noopener">Official scoring guidelines (PDF) ↗</a>' + (q.samplesUrl ? ' · <a class="zp-link" href="' + esc(q.samplesUrl) + '" target="_blank" rel="noopener">Sample student responses ↗</a>' : '') + '</p>' : '') + '</div>';
  }
  function shortStem(q, n) { var s = (q.stem || '').replace(/\s+/g, ' ').trim(); return s.length > (n || 90) ? s.slice(0, n || 90) + '…' : s; }

  /* ---- Entry form: Careless or Actual (sets the review schedule), then ONE idea note ---- */
  var ETYPE = { careless: 'Careless', actual: 'Actual' };
  // What kind of idea note it is. Only changes the hint; all of them are one free-text entry.
  var NKINDS = [['rule', 'Habit · When I see … I will …', 'e.g. When I see 0/0 in a limit, I will factor or use L\'Hôpital before anything else.'],
    ['idea', 'Main idea', 'The one idea or move to remember from this problem.'], ['other', 'Anything else', 'What went wrong, what to do next time, steps, a similar problem, whatever helps.']];
  function minChars(track) { return track === 'actual' ? ZP.req().actualChars : ZP.req().carelessChars; }
  function entryFormHTML(pid, note, own) {
    note = note || {};
    var track = ZP.entryComplete(note) || ZP.noteValid(note) ? ZP.trackOf(note) : (note.track || '');
    var kind = note.nkind || (ZP.len(note.signal) > 4 && !note.nkind ? 'rule' : ZP.len(note.idea) > 2 && !note.nkind ? 'idea' : 'other');
    return '<div class="zp-entryform" data-pid="' + esc(pid) + '" data-track="' + esc(track) + '" data-miss="' + esc(note.miss || '') + '" data-nkind="' + esc(kind) + '">' +
      '<input type="hidden" data-nf="approach" value="' + esc(note.approach || '') + '">' +
      '<p class="zp-label">What was it?</p><div class="zp-seg" role="group" aria-label="Careless or Actual">' + CFG.ENTRY_TYPES.map(function (t) {
        return '<button type="button" class="zp-segbtn' + (track === t.key ? ' on' : '') + '" data-etype="' + t.key + '"><b>' + esc(t.label) + '</b><span>' + esc(t.hint) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="zp-muted" data-etype-note></p>' +
      '<div data-fieldwrap' + (track ? '' : ' hidden') + '>' +
      '<p class="zp-label">Idea note <em class="zp-muted">(one entry: pick what kind it is)</em></p><div class="zp-chips">' + NKINDS.map(function (k) {
        return '<button type="button" class="zp-chip' + (kind === k[0] ? ' on' : '') + '" data-nkind="' + k[0] + '">' + esc(k[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="zp-field"><span data-label="text"></span><textarea data-nf="text" maxlength="1200" rows="4" placeholder="">' + esc(ZP.noteBody(note)) + '</textarea><em class="zp-count" data-count="text"></em></label>' +
      '<label class="zp-chip' + (own ? ' on' : '') + '" title="Adds this note to your review queue as its own card, separate from redoing the problem"><input type="checkbox" data-nf="own" ' + (own ? 'checked' : '') + ' hidden>Also review this note on its own in the review queue</label></div>' +
      '<p class="zp-formerr" hidden></p></div>';
  }
  // Show the right hint and the live character count for the chosen type and kind.
  function syncEntryForm(form) {
    var track = form.dataset.track || '', kind = form.dataset.nkind || 'other';
    form.querySelectorAll('[data-etype]').forEach(function (b) { b.classList.toggle('on', b.dataset.etype === track); });
    form.querySelectorAll('[data-nkind]').forEach(function (b) { if (b.tagName === 'BUTTON') b.classList.toggle('on', b.dataset.nkind === kind); });
    var wrap = form.querySelector('[data-fieldwrap]'); if (wrap) wrap.hidden = !track;
    var k = NKINDS.filter(function (x) { return x[0] === kind; })[0] || NKINDS[2];
    var ta = form.querySelector('[data-nf="text"]'); if (ta) ta.placeholder = k[2];
    var lab = form.querySelector('[data-label="text"]'); if (lab) lab.innerHTML = esc(k[1]) + ' <em>(required, at least ' + minChars(track) + ' characters)</em>';
    var note = form.querySelector('[data-etype-note]');
    if (note) note.textContent = track === 'actual' ? 'Goes to your Idea Notebook and the review queue (the problem comes back, and you can also review the note itself). Write it well: this is what you will study.' : track === 'careless' ? 'The problem goes to the review queue. A short note is enough.' : 'Pick one to continue.';
    var c = form.querySelector('[data-count="text"]');
    if (ta && c) { var n = ta.value.trim().length, need = minChars(track); c.textContent = track ? n + ' / ' + need : ''; c.classList.toggle('ok', n >= need); }
  }
  // After saving a problem's note: keep its own review card in step with the checkbox (card_flag kind 'idea', key n-<pid>).
  function applyOwn(store, D, pid, ch, own) {
    var id = 'i:' + (ch || '') + ':n-' + pid;
    if (own !== !!(D.cardOn && D.cardOn[id])) store.append('card_flag', { kind: 'idea', ch: ch || '', key: 'n-' + pid, on: own });
  }
  function ownOf(D, pid, ch) { return !!(D.cardOn && D.cardOn['i:' + (ch || '') + ':n-' + pid]); }
  // The sections of a note, for read-only display (Study view, notebook).
  function noteSections(n) {
    n = n || {};
    if (n.nkind) return [[{ rule: 'Habit · When I see … I will …', idea: 'Main idea' }[n.nkind] || 'Idea note', n.text]].filter(function (x) { return x[1] && String(x[1]).trim(); });
    return [['Main idea', n.idea], ['Missed / next time', n.stuck], ['More', n.text],
      ['What I tried first', n.approach], ['When I see … I try …', n.signal]].filter(function (x) { return x[1] && String(x[1]).trim(); });
  }
  // The ID chip copies itself when clicked (unless it sits inside a button or link, where the click belongs to that).
  function codeBadge(q) { var c = (q && q.code) || ''; return '<span class="zp-code" data-copy-id="' + esc(c) + '" title="Problem ID: click to copy (or press I)">' + esc(c) + '</span>'; }
  var PST = { review: ['Review', 'warn'], done: ['Done', 'ok'] };
  function statusBadge(D, pid) {
    var st = D.pstatus && D.pstatus[pid];
    if (!st) return '<span class="zp-badge">New</span>';
    var b = PST[st];
    return '<span class="zp-badge ' + b[1] + '">' + b[0] + (D.mastered && D.mastered[pid] ? ' · mastered' : '') + '</span>';
  }
  // Pick Careless / Actual; counts update as you type. Call once per host.
  function bindEntryForms(host) {
    if (host.__zpEntryBound) return;
    host.__zpEntryBound = true;
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.zp-entryform [data-etype]'), kb = e.target.closest('.zp-entryform button[data-nkind]');
      if (kb) { var f2 = kb.closest('.zp-entryform'); f2.dataset.nkind = kb.dataset.nkind; syncEntryForm(f2); return; }
      if (!b) return;
      var form = b.closest('.zp-entryform'); form.dataset.track = b.dataset.etype; syncEntryForm(form);
    });
    host.addEventListener('input', function (e) { var form = e.target.closest && e.target.closest('.zp-entryform'); if (form) syncEntryForm(form); });
    // The hidden checkbox behind a chip ("Also review this note on its own") needs its look kept in step, or the button seems dead.
    host.addEventListener('change', function (e) { var t = e.target; if (t && t.matches && t.matches('.zp-entryform [data-nf="own"]')) { var lab = t.closest('label'); if (lab) lab.classList.toggle('on', t.checked); } });
    host.querySelectorAll('.zp-entryform').forEach(syncEntryForm);
  }
  // Call after (re)rendering a host so counts and visible boxes match the form state.
  function initEntryForms(host) { host.querySelectorAll('.zp-entryform').forEach(syncEntryForm); }
  // Returns {ok, data|error}; shows the error under the form.
  function readEntryForm(form, src) {
    var err = form.querySelector('.zp-formerr');
    function val(k) { var el = form.querySelector('[data-nf="' + k + '"]'); return el ? el.value.trim() : ''; }
    var track = form.dataset.track || '', own = !!(form.querySelector('[data-nf="own"]') || {}).checked;
    var data = { pid: form.dataset.pid, src: src, track: track, miss: form.dataset.miss || '', approach: val('approach'), nkind: form.dataset.nkind || 'other', text: val('text'), stuck: '', idea: '', signal: '' };
    var msg = '';
    if (!track) msg = 'Choose Careless or Actual first.';
    else if (!ZP.entryComplete(data)) msg = 'Write at least ' + minChars(track) + ' characters in your idea note.';
    err.hidden = !msg; err.textContent = msg;
    return msg ? { ok: false } : { ok: true, data: data, own: own };
  }

  /* ---- activity heatmap (GitHub / Anki style) and small charts ---- */
  // weeks columns, Sunday to Saturday rows, today in the last column. Level 0-4 by effort that day.
  function heatmapHTML(activity, weeks, now) {
    now = now || Date.now(); weeks = weeks || 26;
    var today = new Date(now); today.setHours(12, 0, 0, 0);
    var start = new Date(today); start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], cols = '', labels = '', lastMonth = -1, key = ZP.dayKey;
    function lvl(n) { return !n ? 0 : n < 5 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4; }
    for (var w = 0; w < weeks; w++) {
      var cells = '';
      for (var d = 0; d < 7; d++) {
        var day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
        if (day > today) { cells += '<i class="zp-hm future"></i>'; continue; }
        var k = key(day.getTime()), n = activity[k] || 0;
        cells += '<i class="zp-hm l' + lvl(n) + (k === key(today.getTime()) ? ' today' : '') + '" title="' + esc(MON[day.getMonth()] + ' ' + day.getDate() + ': ' + (n ? n + ' thing' + (n > 1 ? 's' : '') + ' done' : 'nothing yet')) + '"></i>';
      }
      var first = new Date(start); first.setDate(start.getDate() + w * 7);
      labels += '<span>' + (first.getMonth() !== lastMonth ? MON[first.getMonth()] : '') + '</span>'; lastMonth = first.getMonth();
      cols += '<div class="zp-hmcol">' + cells + '</div>';
    }
    return '<div class="zp-heat" role="img" aria-label="Activity over the last ' + weeks + ' weeks"><div class="zp-hmlabels">' + labels + '</div><div class="zp-hmgrid">' + cols + '</div>' +
      '<div class="zp-hmlegend"><span class="zp-muted">Less</span><i class="zp-hm l0"></i><i class="zp-hm l1"></i><i class="zp-hm l2"></i><i class="zp-hm l3"></i><i class="zp-hm l4"></i><span class="zp-muted">More</span></div></div>';
  }
  function streakHTML(st) {
    var s = st.streak, flame = s.current >= 3 ? '🔥 ' : '';
    return '<div class="zp-streak"><div><b>' + flame + s.current + '</b><span>day streak</span></div><div><b>' + s.longest + '</b><span>longest streak</span></div><div><b>' + s.activeDays + '</b><span>days practised</span></div><div><b>' + s.total + '</b><span>things done in total</span></div></div>' +
      (s.today ? '<p class="zp-muted">Today: ' + s.today + ' done. Keep the square green.</p>' : '<p class="zp-muted">' + (s.current ? 'Do one thing today to keep your ' + s.current + '-day streak.' : 'Do one thing today to start a streak.') + '</p>');
  }
  // vertical bars: [{label, n, tip}]
  function barsHTML(items, cls) {
    var max = Math.max(1, Math.max.apply(null, items.map(function (i) { return i.n; })));
    return '<div class="zp-bars ' + (cls || '') + '">' + items.map(function (i) { return '<div class="zp-barcol" title="' + esc(i.tip || (i.label + ': ' + i.n)) + '"><span class="zp-bartop">' + (i.n || '') + '</span><div class="zp-barfill" style="height:' + Math.round(100 * i.n / max) + '%"></div><span class="zp-barlab">' + esc(i.label) + '</span></div>'; }).join('') + '</div>';
  }
  // a line over time: [{label, v (0..1 or null)}]
  function sparkHTML(points) {
    var W = 320, H = 90, pad = 10, n = points.length, xs = function (i) { return pad + i * (W - 2 * pad) / Math.max(1, n - 1); }, ys = function (v) { return H - pad - v * (H - 2 * pad); };
    var path = '', dots = '', started = false;
    points.forEach(function (p, i) { if (p.v == null) { started = false; return; } path += (started ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(p.v).toFixed(1); started = true; dots += '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(p.v).toFixed(1) + '" r="3.5"><title>' + esc(p.label + ': ' + Math.round(100 * p.v) + '%') + '</title></circle>'; });
    if (!dots) return '<p class="zp-muted">Not enough answers yet to draw this.</p>';
    return '<svg class="zp-spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Accuracy over the last weeks"><line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + ys(.5) + '" y2="' + ys(.5) + '" class="grid"/><path d="' + path + '" fill="none"/>' + dots + '</svg>';
  }

  /* ---- copy a question (plain text, ready to paste into a chat or a doc) ---- */
  // Math stays as LaTeX ($...$), which chat assistants read fine. A figure cannot go into plain text, so it is flagged.
  function questionText(q) {
    var parts = [String(q.stem || '').trim()];
    if (q.figure) parts.push('[This problem has a figure that is not included in the copy.]');
    if (q.choices && q.choices.length) parts.push(q.choices.map(function (c, i) { return String.fromCharCode(65 + i) + '. ' + c; }).join('\n'));
    return parts.join('\n\n');
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* best effort */ }
    document.body.removeChild(ta); done();
  }
  function copyText(text, el) {
    function flash() {
      if (!el) return;
      var orig = el.dataset.zpLabel || el.innerHTML; el.dataset.zpLabel = orig;
      el.textContent = 'Copied!'; el.classList.add('copied');
      clearTimeout(el.__t); el.__t = setTimeout(function () { el.innerHTML = orig; el.classList.remove('copied'); delete el.dataset.zpLabel; }, 900);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(flash).catch(function () { fallbackCopy(text, flash); });
    else fallbackCopy(text, flash);
  }
  function copyBtn(pid, label) { return '<button type="button" class="zp-btn" data-copy-question="' + esc(pid) + '" title="Copy the question text (press C)">' + (label || 'Copy question') + ' <kbd class="zp-kbd">C</kbd></button>'; }
  // "Sync now": pull other devices' changes immediately; reload the page when something new arrived.
  document.addEventListener('click', function (e) {
    var sb = e.target.closest && e.target.closest('[data-sync-now]'); if (!sb) return;
    sb.textContent = 'Syncing…'; sb.disabled = true;
    ZP.syncNow(sb.dataset.u, sb.dataset.c).then(function (n) { if (n > 0) location.reload(); else { sb.textContent = 'Up to date'; setTimeout(function () { sb.textContent = 'Sync now'; sb.disabled = false; }, 2500); } });
  });
  // One set of listeners for every copy button and ID chip on any platform page.
  document.addEventListener('click', function (e) {
    var qb = e.target.closest('[data-copy-question]');
    if (qb) { var q = root.ZPBank && root.ZPBank[qb.dataset.copyQuestion]; if (q) { e.stopPropagation(); copyText(questionText(q), qb); } return; }
    var chip = e.target.closest('[data-copy-id]');
    if (chip && !chip.closest('button, a') && chip.dataset.copyId) { e.stopPropagation(); copyText(chip.dataset.copyId, chip); }
  });
  // C copies the question, I copies its ID (rebindable in Profile > Settings): the one nearest the top of the screen when several are showing.
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    // The keys come from Settings (default C and I); without the settings module the defaults apply.
    var S = root.ZPSettings, k = S ? (S.keyMatch(e, 'copyQuestion') ? 'c' : S.keyMatch(e, 'copyId') ? 'i' : '') : e.key.toLowerCase();
    if (k !== 'c' && k !== 'i') return;
    var t = e.target; if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    var list = Array.prototype.slice.call(document.querySelectorAll(k === 'c' ? '[data-copy-question]' : '[data-copy-id]')).filter(function (el) { return !el.closest('button, a') || k === 'c'; });
    var vis = list.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; }).filter(function (x) { return x.r.width && x.r.bottom > 0 && x.r.top < window.innerHeight; }).sort(function (a, b) { return Math.abs(a.r.top) - Math.abs(b.r.top); });
    if (!vis.length) return;
    e.preventDefault(); vis[0].el.click();
  });

  /* ---- per-question tools: history, flag for review, report ---- */
  // "Mentor Yong Joon" (name set in js/layout.js); plain "Mentor" if the name is not loaded.
  function mentorName() { return 'Mentor' + (window.ZENITH_MENTOR ? ' ' + window.ZENITH_MENTOR : ''); }
  var CTX = { chapter: 'Chapter', practice: 'Practice', review: 'Review', spaced: 'Review queue', warmup: 'Warm-up', test: 'Chapter test', customtest: 'Test', mock: 'Mock' };
  var REPORT_REASONS = [['key', 'Wrong answer key'], ['math', 'Math looks broken'], ['figure', 'Missing figure or choice'], ['typo', 'Typo or unclear'], ['solution', 'Solution is wrong'], ['other', 'Something else']];
  function historyHTML(D, pid) {
    var r = D.q && D.q[pid]; if (!r || !r.n) return '<span class="zp-muted">First time you see this one.</span>';
    var list = r.attempts.slice(-6).map(function (a) { return '<span class="zp-hist ' + (a.correct ? 'ok' : 'bad') + '" title="' + esc((CTX[a.ctx] || a.ctx) + ' · ' + fmtDate(a.t)) + '">' + (a.correct ? '✓' : '✗') + ' ' + esc(CTX[a.ctx] || a.ctx) + ' ' + fmtDate(a.t) + '</span>'; }).join('');
    return '<span class="zp-muted">Tried ' + r.n + (r.n === 1 ? ' time' : ' times') + ' (' + r.right + ' right):</span> ' + list;
  }
  function toolsHTML(D, pid, opts) {
    opts = opts || {};
    var en = D.entries && D.entries[pid], reported = D.reports && D.reports[pid];
    var pile = !en ? '<button type="button" class="zp-btn" data-qt="flag" data-pid="' + esc(pid) + '">Flag for review</button>'
      : en.forced ? '<span class="zp-badge warn">Test miss · always reviewed</span>'
      : '<span class="zp-badge warn">Flagged for review</span> <button type="button" class="zp-btn" data-qt="unflag" data-pid="' + esc(pid) + '">Don\'t review this</button>';
    return '<div class="zp-qtools"><div class="zp-qhist">' + historyHTML(D, pid) + '</div><div class="zp-row">' + copyBtn(pid) + ' ' + pile + '</div>' +
      '<details class="zp-report"' + (reported ? '' : '') + '><summary>' + (reported ? 'You reported this problem' : 'Report a problem with this question') + '</summary>' +
      '<div class="zp-chips">' + REPORT_REASONS.map(function (r) { return '<button type="button" class="zp-chip" data-qt="reason" data-r="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>' +
      '<label class="zp-field"><span>What is wrong? <em>(optional)</em></span><textarea data-qt-text rows="2" maxlength="400"></textarea></label>' +
      '<button type="button" class="zp-btn" data-qt="report" data-pid="' + esc(pid) + '">Send report</button> <span class="zp-muted" data-qt-msg></span></details></div>';
  }
  // opts: {store, derive(), chOf(pid), rerender()}; call once per host (latest opts win).
  function bindTools(host, opts) {
    host.__zpTools = opts;
    if (host.__zpToolsBound) return;
    host.__zpToolsBound = true;
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-qt]'); if (!b) return;
      var o = host.__zpTools, a = b.dataset.qt, pid = b.dataset.pid, ch = pid ? o.chOf(pid) : '';
      if (a === 'flag') { o.store.append('flag', { ch: ch, pid: pid, on: true }); o.rerender(); }
      else if (a === 'unflag') { o.store.append('flag', { ch: ch, pid: pid, on: false }); o.rerender(); }
      else if (a === 'reason') { b.classList.toggle('on'); }
      else if (a === 'report') {
        var box = b.closest('.zp-report'), why = Array.prototype.map.call(box.querySelectorAll('[data-qt="reason"].on'), function (x) { return x.dataset.r; });
        var text = box.querySelector('[data-qt-text]').value.trim(), msg = box.querySelector('[data-qt-msg]');
        if (!why.length && !text) { msg.textContent = 'Pick a reason or write a line.'; return; }
        o.store.append('report', { ch: ch, pid: pid, reasons: why, text: text });
        box.querySelector('summary').textContent = 'You reported this problem'; msg.textContent = 'Thanks, your teacher will see it.';
      }
    });
  }

  // What the mentor wrote about one piece of work (a test, a mock, an entry). ref is a submission id or 'entry:<pid>'.
  function mentorFeedbackHTML(D, ref) {
    var list = ((D && D.msgs) || []).filter(function (m) { return m.from === 'teacher' && m.ref === ref; });
    if (!list.length) return '';
    return '<section class="zp-panel zp-mfb"><p class="zp-eyebrow">From ' + mentorName() + '</p>' + list.map(function (m) {
      return '<div class="zp-mnote new"><p class="zp-muted">' + esc(fmtDate(m.t)) + '</p><p>' + esc(m.text).replace(/\n/g, '<br>') + '</p></div>';
    }).join('') + '</section>';
  }

  root.ZPUI = {
    mentorFeedbackHTML: mentorFeedbackHTML,
    mentorName: mentorName, esc: esc, renderMath: renderMath, fmtDate: fmtDate, fmtISO: fmtISO, ago: ago, mmss: mmss, btn: btn,
    heatmapHTML: heatmapHTML, streakHTML: streakHTML, barsHTML: barsHTML, sparkHTML: sparkHTML, guard: guard, copyBtn: copyBtn, copyText: copyText, questionText: questionText, resolveContext: resolveContext, courseSwitcher: courseSwitcher, saveStatus: saveStatus, emptyState: emptyState,
    stemHTML: stemHTML, choicesHTML: choicesHTML, solutionHTML: solutionHTML, shortStem: shortStem,
    entryFormHTML: entryFormHTML, bindEntryForms: bindEntryForms, initEntryForms: initEntryForms, readEntryForm: readEntryForm, ETYPE: ETYPE, NKINDS: NKINDS, applyOwn: applyOwn, ownOf: ownOf,
    toolsHTML: toolsHTML, bindTools: bindTools, noteSections: noteSections, codeBadge: codeBadge, statusBadge: statusBadge, historyHTML: historyHTML, REPORT_REASONS: REPORT_REASONS, CTX: CTX
  };
})(window);
