/* Notebook: Browse (home), Inbox, Idea Notebook, Concepts Notebook, Review queue (FSRS). Statistics live on the Profile page. */
(async function () {
  'use strict';
  requireLogin();
  var ctx = ZPUI.resolveContext();
  var main = document.getElementById('zp-main');
  ZPUI.guard(main);
  var lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', logout);
  if (!ctx) return;
  var ZP = window.ZP, UI = window.ZPUI, CFG = window.ZP_CONFIG, esc = UI.esc;
  if (!ctx.course) { main.innerHTML = UI.emptyState('Your notebook starts with a course that has problem banks', 'Available for AP Calculus BC and AP Chemistry.', '<a class="zp-btn primary" href="portal.html">Back to courses</a>'); return; }
  var cid = encodeURIComponent(ctx.course.id);
  var data;
  try { data = await ZPBanks.load(ctx.course.id); } catch (e) { main.innerHTML = UI.emptyState('Could not load the problem banks', esc(e.message)); return; }
  var store = ZP.open(ctx.student.username, ctx.course.id); await store.load();
  var info = data.info, D;
  function derive() { D = ZP.derive(store.events(), info); return D; }
  derive();
  var view = ({ write: 'inbox', notes: 'browse' })[ctx.params.get('view')] || ctx.params.get('view') || 'browse';
  var filt = { ch: '', track: '', src: '', status: '', q: '', order: 'chapter' };

  var SRC = { C: 'Chapter problems', S: 'Practice sets', T: 'Chapter test', U: 'Test', M: 'Mock', P: 'Practice' };
  var STATUS = { 'to-write': 'Needs entry', written: 'Scheduled', shaky: 'Shaky', redone: 'Reviewed again', resolved: 'Resolved' };
  function costOf(pid) { var Q = data.byId[pid]; return !Q ? (CFG.MIN_PER_CARD || 1) : Q.frq ? (CFG.MIN_PER_FRQ || 10) : CFG.MIN_PER_QUESTION; }
  function entryTime(e) {
    if (D.noteFirst[e.pid]) return D.noteFirst[e.pid];
    var p = D.prob[e.pid]; if (p && p.first) return p.first.t;
    var subs = [].concat.apply([], Object.keys(D.tests).map(function (k) { return D.tests[k]; })).concat(D.mocks);
    var s = subs.filter(function (x) { return x.pids.indexOf(e.pid) >= 0; }).pop();
    return s ? s.t : 0;
  }

  function fmtDays(d) { return d < 30 ? d + 'd' : d < 365 ? (d / 30 < 10 ? (d / 30).toFixed(1) : Math.round(d / 30)) + 'mo' : (d / 365).toFixed(1) + 'y'; }

  function tabs() {
    var due = ZP.dueEntries(D).length, pend = Object.keys(D.entries).filter(function (k) { return D.entries[k].pending; }).length;
    var base = 'notebook.html?course=' + cid + '&view=';
    return '<div class="zp-crumb"><span>' + esc(ctx.course.name) + '</span>' + UI.saveStatus(store) + '</div><h1>Notebook</h1>' + UI.courseSwitcher(ctx, 'notebook.html') +
      '<nav class="zp-tabs"><a class="' + (view === 'browse' ? 'on' : '') + '" href="' + base + 'browse">Browse</a>' +
      '<a class="' + (view === 'inbox' ? 'on' : '') + '" href="' + base + 'inbox">Inbox' + (pend ? ' <span class="zp-badge warn">' + pend + '</span>' : '') + '</a>' +
      '<a class="' + (view === 'study' ? 'on' : '') + '" href="' + base + 'study">Idea Notebook</a>' +
      '<a class="' + (view === 'concepts' ? 'on' : '') + '" href="' + base + 'concepts">Concepts Notebook</a>' +
      '<a class="' + (view === 'redo' ? 'on' : '') + '" href="' + base + 'redo">Review queue' + (due ? ' <span class="zp-badge warn">' + due + '</span>' : '') + '</a></nav>';
  }

  /* ---------- Browse: entries home ---------- */
  function chLabel(e) {
    if (info.chapters[e.ch]) return 'Ch ' + e.ch;
    var sid = info.setOf && info.setOf[e.pid], set = sid && (info.sets || []).filter(function (x) { return x.id === sid; })[0];
    return set ? set.id : (e.ch ? 'Ch ' + e.ch : '');
  }
  var editing = {}, expanded = {};
  // Shortens text for a card; never cuts inside a $...$ formula (it would show a raw dollar sign).
  function snip(t, n) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t;
    var c = t.slice(0, n), d = (c.match(/\$/g) || []).length;
    if (d % 2) c = c.slice(0, c.lastIndexOf('$'));
    return c.trim() + '…';
  }
  // Browse: the home screen of the notebook. Where things stand at the top, then every entry as a card, grouped by
  // chapter. Tap a card to open it: full entry, the problem and solution, edit, redo.
  function browseView() {
    derive();
    var all = Object.keys(D.entries).map(function (k) { var e = D.entries[k]; e.t = entryTime(e); return e; });
    var pend = all.filter(function (e) { return e.pending; }).length, act = all.filter(function (e) { return e.track === 'actual'; }).length, car = all.filter(function (e) { return e.track === 'careless'; }).length;
    var qd = ZP.dailyQueue(D, Date.now(), costOf), shaky = all.filter(function (e) { return e.status === 'shaky'; }).length;
    var base = 'notebook.html?course=' + cid + '&view=';
    // Inbox and Review queue are nudges: an accent tile with a count badge and a call to action. When they are empty they go quiet.
    function nudge(href, n, label, sub, cta) {
      return '<a class="zp-tile nudge' + (n ? ' on' : '') + '" href="' + base + href + '">' + (n ? '<i class="zp-nudgedot" aria-hidden="true">' + n + '</i>' : '') + '<span>' + label + '</span><em>' + sub + '</em>' + (n ? '<strong>' + cta + ' →</strong>' : '') + '</a>';
    }
    function gathered(href, n, label, sub) { return '<a class="zp-tile" href="' + base + href + '"><b>' + n + '</b><span>' + label + '</span><em>' + sub + '</em></a>'; }
    var conceptCount = 0; info.order.forEach(function (c) { conceptCount += D.stages[c] ? D.stages[c].B.cpTot : 0; });
    var tiles = '<div class="zp-tiles">' +
      nudge('inbox', pend, 'Inbox', pend ? pend + ' problem' + (pend === 1 ? '' : 's') + ' waiting for your entry' : 'All caught up', 'Write them up') +
      nudge('redo', qd.all.length, 'Review queue', qd.all.length ? qd.all.length + ' due · about ' + qd.minutes + ' min today' : 'Nothing due, nice work', 'Start reviewing') +
      gathered('study', act, 'Idea Notebook', act === 1 ? 'idea you\'ve collected' : 'ideas you\'ve collected') +
      gathered('concepts', conceptCount, 'Concepts Notebook', conceptCount === 1 ? 'concept you\'ve gathered' : 'concepts you\'ve gathered') + '</div>';

    var heat = '<section class="zp-panel zp-hmpanel"><div class="zp-hmhead"><h2>Activity</h2><a class="zp-linkbtn" href="profile.html?course=' + cid + '">See all stats</a></div>' + UI.heatmapHTML(D.activity, 20) + '</section>';
    var rows = all.filter(function (e) {
      if (filt.ch && e.ch !== filt.ch && !(info.setOf && info.setOf[e.pid] === filt.ch)) return false;
      if (filt.track && e.track !== filt.track) return false;
      if (filt.src && e.srcs.indexOf(filt.src) < 0) return false;
      if (filt.status && e.status !== filt.status) return false;
      if (filt.q) {
        var Qh = data.byId[e.pid], hay = [Qh ? Qh.stem + ' ' + Qh.code : '', e.note ? [e.note.approach, e.note.stuck, e.note.idea, e.note.signal, e.note.text].join(' ') : ''].join(' ').toLowerCase();
        if (hay.indexOf(filt.q.toLowerCase()) < 0 && ZP.normCode(Qh ? Qh.code : '').indexOf(ZP.normCode(filt.q)) < 0) return false;
      }
      return true;
    });
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }
    var chOpts = info.order.map(function (c) { return opt(c, c + ' · ' + info.chapters[c].title, filt.ch); }).concat((info.sets || []).map(function (x) { return opt(x.id, x.id + ' · ' + x.title, filt.ch); })).join('');
    var filters = '<div class="zp-filters">' +
      '<label>Search<input type="text" data-f="q" value="' + esc(filt.q) + '" placeholder="ID like C1A3, or words"></label>' +
      '<label>Chapter or set<select data-f="ch">' + opt('', 'All', filt.ch) + chOpts + '</select></label>' +
      '<label>Type<select data-f="track">' + opt('', 'All', filt.track) + CFG.ENTRY_TYPES.map(function (m) { return opt(m.key, m.label, filt.track); }).join('') + '</select></label>' +
      '<label>From<select data-f="src">' + opt('', 'All', filt.src) + Object.keys(SRC).map(function (k) { return opt(k, SRC[k], filt.src); }).join('') + '</select></label>' +
      '<label>Status<select data-f="status">' + opt('', 'All', filt.status) + Object.keys(STATUS).map(function (k) { return opt(k, STATUS[k], filt.status); }).join('') + '</select></label>' +
      '<label>Group<select data-f="order">' + opt('chapter', 'By chapter', filt.order) + opt('new', 'Newest first', filt.order) + opt('old', 'Oldest first', filt.order) + '</select></label></div>';

    function card(e) {
      var Q = data.byId[e.pid], n = e.note, isOpen = !!expanded[e.pid], edit = !!editing[e.pid];
      var gist = n ? (n.nkind ? n.text : e.track === 'careless' ? n.stuck : (n.idea || n.stuck || n.text)) : '';
      var top = '<span class="zp-code">' + esc(Q ? Q.code : e.pid) + '</span>' + (e.track ? '<span class="zp-badge ' + (e.track === 'actual' ? 'ok' : '') + '">' + esc(UI.ETYPE[e.track]) + '</span>' : '<span class="zp-badge warn">Needs entry</span>') +
        (e.status === 'resolved' ? '<span class="zp-badge ok">Resolved</span>' : e.due && e.due <= Date.now() ? '<span class="zp-badge warn">Due</span>' : e.due ? '<span class="zp-badge">Next ' + UI.fmtDate(e.due) + '</span>' : '');
      var head = '<button type="button" class="zp-brhead" data-act="expand" data-pid="' + esc(e.pid) + '" aria-expanded="' + isOpen + '"><span class="zp-brtop">' + top + '</span>' +
        '<span class="zp-brstem">' + esc(snip(Q ? Q.stem : e.pid, 110)) + '</span>' + (gist ? '<span class="zp-bridea">' + esc(snip(gist, 130)) + '</span>' : '') + '</button>';
      var body = '';
      if (isOpen) {
        var secs = UI.noteSections(n), fields = secs.length ? '<dl>' + secs.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>' : '<p class="zp-muted">No entry yet.</p>';
        body = '<div class="zp-brbody"><p class="zp-muted">' + esc(chLabel(e)) + ' · ' + esc(SRC[e.src] || '') + (e.t ? ' · ' + UI.fmtDate(e.t) : '') + ' · ' + esc(STATUS[e.status] || '') + '</p>' + fields +
          '<details><summary class="zp-muted">Problem and solution</summary>' + (Q ? UI.stemHTML(Q) + (Q.choices.length ? UI.choicesHTML(Q, { correct: Q.correct, reveal: true, locked: true }) : '') + UI.solutionHTML(Q) : '') + '</details>' +
          '<div class="zp-row"><button type="button" class="zp-btn" data-act="edit" data-pid="' + esc(e.pid) + '">' + (edit ? 'Close editor' : n ? 'Edit entry' : 'Write the entry') + '</button>' +
          (e.complete ? '<a class="zp-btn" href="notebook.html?course=' + cid + '&view=redo&pid=' + encodeURIComponent(e.pid) + '">Redo now</a>' : '') + '</div>' +
          (edit ? '<div class="zp-panel">' + UI.entryFormHTML(e.pid, n, UI.ownOf(D, e.pid, e.ch)) + '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="nb-save" data-pid="' + esc(e.pid) + '">Save entry</button></div></div>' : '') +
          UI.toolsHTML(D, e.pid) + '</div>';
      }
      return '<article class="zp-brcard' + (isOpen ? ' open' : '') + '">' + head + body + '</article>';
    }
    var shown = 0, CAP = 90, html = '';
    function sortFlat(list) { return list.slice().sort(function (a, b) { return filt.order === 'old' ? a.t - b.t : b.t - a.t; }); }
    if (filt.order === 'chapter') {
      var groups = {}, keys = [];
      rows.forEach(function (e) { var g = (info.setOf && info.setOf[e.pid]) || e.ch || '?'; if (!groups[g]) { groups[g] = []; keys.push(g); } groups[g].push(e); });
      var rank = function (g) { var i = info.order.indexOf(g); return i >= 0 ? i : 100 + (info.sets || []).map(function (x) { return x.id; }).indexOf(g); };
      keys.sort(function (a, b) { return rank(a) - rank(b); });
      keys.forEach(function (g) {
        var list = groups[g].sort(function (a, b) { return a.pid.localeCompare(b.pid, undefined, { numeric: true }); });
        var title = info.chapters[g] ? 'Chapter ' + g + ' · ' + info.chapters[g].title : ((info.sets || []).filter(function (x) { return x.id === g; })[0] || { id: g, title: '' }).id + ((info.sets || []).filter(function (x) { return x.id === g; })[0] ? ' · ' + (info.sets || []).filter(function (x) { return x.id === g; })[0].title : '');
        var cut = list.slice(0, Math.max(0, CAP - shown)); shown += cut.length;
        if (cut.length) html += '<section class="zp-brgroup"><h2>' + esc(title) + ' <span class="zp-muted">' + list.length + '</span></h2><div class="zp-brgrid">' + cut.map(card).join('') + '</div></section>';
      });
    } else {
      var flat = sortFlat(rows).slice(0, CAP); shown = flat.length; html = '<div class="zp-brgrid">' + flat.map(card).join('') + '</div>';
    }
    var summary = '<p class="zp-muted">' + all.length + ' entr' + (all.length === 1 ? 'y' : 'ies') + ' · ' + act + ' Actual · ' + car + ' Careless' + (shaky ? ' · ' + shaky + ' still shaky' : '') + (rows.length !== all.length ? ' · ' + rows.length + ' match' : '') + '</p>';
    main.innerHTML = tabs() + tiles + heat + filters + summary +
      (html || UI.emptyState(all.length ? 'Nothing matches those filters' : 'No entries yet', all.length ? 'Try clearing a filter.' : 'Wrong answers are flagged for you, and you can flag any problem yourself. Each flagged problem gets an entry, and the entries live here.',
        '<a class="zp-btn primary" href="practice.html?course=' + cid + '">Go practice</a>')) + (rows.length > shown ? '<p class="zp-muted">Showing ' + shown + ' of ' + rows.length + '. Use the search and filters to narrow it down.</p>' : '');
    UI.renderMath(main);
    main.onchange = function (ev) { var f = ev.target.dataset.f; if (f) { filt[f] = ev.target.value; browseView(); } };
    main.oninput = function (ev) { if (ev.target.dataset.f === 'q') { filt.q = ev.target.value; clearTimeout(main.__t); main.__t = setTimeout(function () { browseView(); var i = main.querySelector('[data-f=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } };
    main.onclick = function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var pid = b.dataset.pid;
      if (b.dataset.act === 'expand') { expanded[pid] = !expanded[pid]; browseView(); }
      else if (b.dataset.act === 'edit') { editing[pid] = !editing[pid]; browseView(); }
      else if (b.dataset.act === 'nb-save') {
        var form = b.closest('.zp-panel').querySelector('.zp-entryform'), r = UI.readEntryForm(form, D.entries[pid].src); if (!r.ok) return;
        r.data.ch = D.entries[pid].ch; store.append('note', r.data); UI.applyOwn(store, D, pid, r.data.ch, r.own); editing[pid] = false; browseView();
      }
    };
    UI.bindEntryForms(main); UI.initEntryForms(main);
    UI.bindTools(main, { store: store, derive: derive, chOf: function (id) { return data.byId[id] ? data.byId[id].chapter : ''; }, rerender: browseView });
  }

  /* ---------- Inbox: the shared entry screen, everything waiting ---------- */
  function writeView() {
    derive();
    main.innerHTML = tabs() + '<div id="zp-wmount"></div>';
    ZPWrite.mount({ host: document.getElementById('zp-wmount'), store: store, data: data, derive: derive, pid: ctx.params.get('pid') || '',
      scope: function (pid) { var en = D.entries[pid]; return !!(en && en.pending); },
      pendingOnly: true, title: 'Inbox', intro: 'Every problem you flagged, or missed on a test, needs an entry. Pick <b>Careless</b> or <b>Actual</b> and write what happened. Chapter reviews (R) use this same screen for one chapter.',
      emptyTitle: 'Nothing waiting', emptyBody: 'Every flagged problem has an entry. <a href="notebook.html?course=' + cid + '&view=browse">Browse your entries</a>, or <a href="practice.html?course=' + cid + '">go practice</a>.',
      onChange: function () { var t = document.querySelector('.zp-tabs'); if (t) { derive(); var tmp = document.createElement('div'); tmp.innerHTML = tabs(); t.outerHTML = tmp.querySelector('.zp-tabs').outerHTML; } } });
  }

  /* ---------- Idea Notebook: Actual entries as study cards, printable ---------- */
  var sf = { ch: '', careless: false, q: '', sol: false, order: 'problem' };
  var ied = {}, newKind = 'rule';
  var KIND_LABEL = { rule: '행동양식', idea: '핵심 아이디어', other: '발상노트' };
  // Stand-alone 발상노트 (not tied to one problem): a 행동양식 ("when I see ..."), a main idea, anything. Each can join the review queue by itself.
  function ideaPanelHTML() {
    var q = sf.q.toLowerCase();
    var ideas = Object.keys(D.ideas).map(function (k) { return D.ideas[k]; }).filter(function (x) { return !x.deleted && (!sf.ch || x.ch === sf.ch) && (!q || String(x.text).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return b.t - a.t; });
    var k0 = UI.NKINDS.filter(function (k) { return k[0] === newKind; })[0] || UI.NKINDS[0];
    var chOpts2 = '<option value="">No chapter</option>' + info.order.map(function (c) { return '<option value="' + esc(c) + '">Ch ' + esc(c) + ' · ' + esc(info.chapters[c].title) + '</option>'; }).join('');
    var form = '<details class="zp-panel zp-noprint"><summary><b>+ New 발상노트</b> <span class="zp-muted">an idea or a 행동양식 that is not tied to one problem</span></summary>' +
      '<div class="zp-chips" id="zp-ikinds">' + UI.NKINDS.map(function (k) { return '<button type="button" class="zp-chip' + (newKind === k[0] ? ' on' : '') + '" data-act="ikind" data-k="' + k[0] + '">' + esc(k[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="zp-field"><span>Your note</span><textarea id="zp-newidea" rows="3" maxlength="1200" placeholder="' + esc(k0[2]) + '"></textarea></label>' +
      '<div class="zp-filters"><label>Chapter <em>(optional)</em><select id="zp-newidea-ch">' + chOpts2 + '</select></label><label class="zp-fopt"><input type="checkbox" id="zp-newidea-q" checked><span>Add it to my review queue</span></label></div>' +
      '<p class="zp-formerr" id="zp-newidea-err" hidden></p><div class="zp-row"><button type="button" class="zp-btn primary" data-act="inew">Save note</button></div></details>';
    var list = ideas.map(function (x) {
      var id = 'i:' + (x.ch || '') + ':' + x.key, on = !!D.cardOn[id];
      if (ied[x.key]) return '<article class="zp-panel zp-ideanote"><textarea data-iedit="' + esc(x.key) + '" rows="3" maxlength="1200">' + esc(x.text) + '</textarea><div class="zp-row"><button type="button" class="zp-btn primary" data-act="isave" data-key="' + esc(x.key) + '">Save</button><button type="button" class="zp-btn" data-act="icancel" data-key="' + esc(x.key) + '">Cancel</button></div></article>';
      return '<article class="zp-panel zp-ideanote"><p class="zp-label"><span class="zp-badge">' + esc(KIND_LABEL[x.nkind] || '발상노트') + '</span> ' + (x.ch ? 'Ch ' + esc(x.ch) : '') + '</p><p class="zp-concept">' + esc(x.text) + '</p>' +
        '<div class="zp-row zp-noprint"><button type="button" class="zp-chip' + (on ? ' on' : '') + '" data-act="iq" data-key="' + esc(x.key) + '" data-ch="' + esc(x.ch || '') + '">' + (on ? '✓ In my review queue' : 'Add to review queue') + '</button>' +
        '<button type="button" class="zp-btn" data-act="iedit" data-key="' + esc(x.key) + '">Edit</button><button type="button" class="zp-btn" data-act="idel" data-key="' + esc(x.key) + '">Delete</button></div></article>';
    }).join('');
    return { html: form + (list ? '<h2>My 발상노트</h2>' + list : ''), n: ideas.length };
  }
  function studyView() {
    derive();
    var list = Object.keys(D.entries).map(function (k) { var e = D.entries[k]; e.t = entryTime(e); return e; }).filter(function (e) {
      if (!e.complete || (e.track === 'careless' && !sf.careless)) return false;
      if (sf.ch && e.ch !== sf.ch && !(info.setOf && info.setOf[e.pid] === sf.ch)) return false;
      if (sf.q) { var Q = data.byId[e.pid], hay = ((Q ? Q.stem + ' ' + Q.code : '') + ' ' + UI.noteSections(e.note).map(function (x) { return x[1]; }).join(' ')).toLowerCase(); if (hay.indexOf(sf.q.toLowerCase()) < 0 && ZP.normCode(Q ? Q.code : '').indexOf(ZP.normCode(sf.q)) < 0) return false; }
      return true;
    }).sort(function (a, b) { return sf.order === 'new' ? b.t - a.t : a.pid.localeCompare(b.pid, undefined, { numeric: true }); });
    function opt(v, l, cur) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }
    var chOpts = info.order.map(function (c) { return opt(c, c + ' · ' + info.chapters[c].title, sf.ch); }).concat((info.sets || []).map(function (x) { return opt(x.id, x.id + ' · ' + x.title, sf.ch); })).join('');
    var filters = '<div class="zp-filters zp-noprint"><label>Chapter or set<select data-sf="ch">' + opt('', 'All', sf.ch) + chOpts + '</select></label>' +
      '<label>Search<input type="text" data-sf="q" value="' + esc(sf.q) + '" placeholder="ID like C1A3, or words"></label>' +
      '<label>Order<select data-sf="order">' + opt('problem', 'By problem', sf.order) + opt('new', 'Newest first', sf.order) + '</select></label>' +
      '<label class="zp-chip' + (sf.sol ? ' on' : '') + '"><input type="checkbox" data-sf="sol" ' + (sf.sol ? 'checked' : '') + ' hidden>Show solutions</label>' +
      '<label class="zp-chip' + (sf.careless ? ' on' : '') + '"><input type="checkbox" data-sf="careless" ' + (sf.careless ? 'checked' : '') + ' hidden>Include careless</label></div>';
    var IP = ideaPanelHTML();
    var cards = list.map(function (e) {
      var Q = data.byId[e.pid], t = e.track ? { label: UI.ETYPE[e.track] } : null; if (!Q) return '';
      var secs = UI.noteSections(e.note);
      return '<article class="zp-studycard"><div class="zp-study-q"><div class="zp-study-top">' + UI.codeBadge(Q) + '<span class="zp-muted">' + esc(chLabel(e)) + '</span>' + UI.statusBadge(D, e.pid) + '<span class="zp-noprint">' + UI.copyBtn(e.pid, 'Copy') + '</span></div>' +
        UI.stemHTML(Q) + (Q.choices.length ? UI.choicesHTML(Q, { correct: Q.correct, reveal: true, locked: true }) : '') + (sf.sol ? UI.solutionHTML(Q) : (Q.correct ? '<p class="zp-muted">Answer: ' + esc(Q.correct) + '</p>' : '')) + '</div>' +
        '<div class="zp-study-n">' + (t ? '<span class="zp-badge">' + esc(t.label) + '</span>' : '') +
        secs.map(function (f) { return '<p class="zp-label">' + f[0] + '</p><p class="zp-concept">' + esc(f[1]) + '</p>'; }).join('') + '<div class="zp-noprint"><button type="button" class="zp-chip' + (UI.ownOf(D, e.pid, e.ch) ? ' on' : '') + '" data-act="nq" data-pid="' + esc(e.pid) + '" data-ch="' + esc(e.ch || '') + '">' + (UI.ownOf(D, e.pid, e.ch) ? '✓ This note is in my review queue' : 'Add this note to my review queue') + '</button></div></div></article>';
    }).join('');
    main.innerHTML = tabs() + '<div class="zp-row zp-noprint"><button type="button" class="zp-btn primary" data-act="print"' + (list.length ? '' : ' disabled') + '>Print / save as PDF</button><span class="zp-muted">' + list.length + (list.length === 1 ? ' entry' : ' entries') + '. Problem on the left, your note on the right. Use your browser\'s "Save as PDF" in the print dialog.</span></div>' + filters +
      IP.html + (list.length ? '<h2>From my problems</h2>' : '') + (cards || (IP.n ? '' : UI.emptyState('No notes to study yet', 'Your Actual entries show up here as study cards: the problem on one side, the idea on the other.', '<a class="zp-btn primary" href="notebook.html?course=' + cid + '&view=browse">Browse your entries</a>')));
    UI.renderMath(main);
    main.onchange = function (ev) { var f = ev.target.dataset.sf; if (!f) return; sf[f] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; studyView(); if (f === 'q') { var i = main.querySelector('[data-sf=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
    main.oninput = function (ev) { if (ev.target.dataset.sf === 'q') { sf.q = ev.target.value; clearTimeout(main.__t); main.__t = setTimeout(studyView, 250); } };
    main.onclick = function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return; var a = b.dataset.act, key = b.dataset.key;
      if (a === 'print') {
        document.body.classList.add('zp-print-study');
        window.addEventListener('afterprint', function done() { document.body.classList.remove('zp-print-study'); window.removeEventListener('afterprint', done); });
        return window.print();
      }
      if (a === 'ikind') { newKind = b.dataset.k; main.querySelectorAll('#zp-ikinds .zp-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.k === newKind); }); var ta = document.getElementById('zp-newidea'); if (ta) ta.placeholder = (UI.NKINDS.filter(function (k) { return k[0] === newKind; })[0] || UI.NKINDS[0])[2]; return; }
      if (a === 'inew') {
        var txt = (document.getElementById('zp-newidea').value || '').trim(), err = document.getElementById('zp-newidea-err');
        if (txt.length < 3) { err.hidden = false; err.textContent = 'Write something first.'; return; }
        var ch = document.getElementById('zp-newidea-ch').value, k = ZP.uid();
        store.append('idea', { key: k, text: txt, nkind: newKind, ch: ch });
        if (document.getElementById('zp-newidea-q').checked) store.append('card_flag', { kind: 'idea', ch: ch, key: k, on: true });
        return studyView();
      }
      if (a === 'iq') { derive(); store.append('card_flag', { kind: 'idea', ch: b.dataset.ch, key: key, on: !D.cardOn['i:' + b.dataset.ch + ':' + key] }); return studyView(); }
      if (a === 'nq') { derive(); UI.applyOwn(store, D, b.dataset.pid, b.dataset.ch, !UI.ownOf(D, b.dataset.pid, b.dataset.ch)); return studyView(); }
      if (a === 'iedit') { ied[key] = true; return studyView(); }
      if (a === 'icancel') { delete ied[key]; return studyView(); }
      if (a === 'isave') { var old = D.ideas[key], el = main.querySelector('[data-iedit="' + key + '"]'), v = (el && el.value || '').trim(); if (old && v.length >= 3) { store.append('idea', { key: key, text: v, nkind: old.nkind, ch: old.ch || '' }); delete ied[key]; } return studyView(); }
      if (a === 'idel') { var o2 = D.ideas[key]; if (o2 && confirm('Delete this 발상노트? It also leaves your review queue.')) { store.append('idea', { key: key, text: o2.text, nkind: o2.nkind, ch: o2.ch || '', deleted: true }); return studyView(); } }
    };
  }

  /* ---------- Concepts Notebook ---------- */
  function conceptsView() {
    derive();
    var chWith = info.order.filter(function (c) { return D.cnotes[c]; });
    var cur = ctx.params.get('ch') || chWith[chWith.length - 1] || info.order[0];
    var nav = '<div class="zp-chlist">' + info.order.map(function (c) {
      return '<a class="' + (c === cur ? 'on ' : '') + (D.cnotes[c] ? 'has' : '') + '" href="notebook.html?course=' + cid + '&view=concepts&ch=' + encodeURIComponent(c) + '">Ch ' + esc(c) + ' · ' + esc(info.chapters[c].title) + '</a>';
    }).join('') + '</div>';
    var cn = D.cnotes[cur], page, list = ZP.conceptList(D, info, cur).filter(function (it) { return it.text || it.images.length; });
    if (cn || list.length) {
      page = '<div class="zp-panel"><p class="zp-eyebrow">Chapter ' + esc(cur) + ' · ' + esc(info.chapters[cur].title) + (D.closed[cur] ? ' · closed' : '') + '</p>' +
        (cn ? '<h2>Summary</h2><p class="zp-concept">' + esc(cn.summary) + '</p>' : '') +
        (list.length ? '<h2>Concepts</h2><p class="zp-muted">Use ↑ ↓ to put them in the order you want to read them. Rename them and add photos on the chapter\'s Close page.</p>' + list.map(function (it) {
          return '<div class="zp-cn" data-cp="' + esc(it.key) + '"><div class="zp-cnhead"><h3>' + esc(it.name) + '</h3><span class="zp-ord"><button type="button" class="zp-linkbtn" data-act="cup" data-key="' + esc(it.key) + '" aria-label="Move up">↑</button><button type="button" class="zp-linkbtn" data-act="cdown" data-key="' + esc(it.key) + '" aria-label="Move down">↓</button></span></div>' +
            (it.text ? '<p class="zp-concept">' + esc(it.text) + '</p>' : '') + ZPPhotos.thumbsHTML(it.images) + '</div>';
        }).join('') : '') +
        '<div class="zp-row"><a class="zp-btn" href="chapter.html?course=' + cid + '&ch=' + encodeURIComponent(cur) + '#x">Edit</a></div></div>';
    } else {
      page = UI.emptyState('Chapter ' + cur + ' has no Concepts Notebook entry yet', 'You write it at the end of a chapter, in your own words, after practice has shown you the gaps.', '<a class="zp-btn primary" href="chapter.html?course=' + cid + '&ch=' + encodeURIComponent(cur) + '#x">Write it</a>');
    }
    main.innerHTML = tabs() + '<div class="zp-row"><button type="button" class="zp-btn" data-act="compile"' + (chWith.length ? '' : ' disabled') + '>Compile my study guide (print / PDF)</button><span class="zp-muted">All your Concepts Notebook plus your "when I see" lines, in one printable page.</span></div>' +
      '<div class="zp-split"><aside class="zp-panel">' + nav + '</aside><section>' + page + '</section></div>';
    UI.renderMath(main);
    ZPPhotos.bind(main, { images: function (card) { var it = list.filter(function (x) { return x.key === card.dataset.cp; })[0]; return it ? it.images : []; }, save: function () { /* read-only here */ } });
    main.onclick = function (ev) {
      if (ev.target.closest('[data-act="compile"]')) return compile();
      var mv = ev.target.closest('[data-act="cup"], [data-act="cdown"]'); if (!mv) return;
      var all = ZP.conceptList(D, info, cur).map(function (x) { return x.key; }), vis = list.map(function (x) { return x.key; }), i = vis.indexOf(mv.dataset.key), j = i + (mv.dataset.act === 'cup' ? -1 : 1);
      if (i < 0 || j < 0 || j >= vis.length) return;
      var x = all.indexOf(vis[i]), y = all.indexOf(vis[j]), t = all[x]; all[x] = all[y]; all[y] = t;
      store.append('concept_order', { ch: cur, keys: all }); conceptsView();
    };
    main.onchange = null; main.oninput = null;
  }
  function compile() {
    derive();
    var html = '<h1>' + esc(ctx.course.name) + ' — my study guide</h1><p>' + esc(ctx.student.name) + '</p>';
    info.order.forEach(function (c) {
      var cn = D.cnotes[c], cl = ZP.conceptList(D, info, c).filter(function (it) { return it.text || it.images.length; }); if (!cn && !cl.length) return;
      cn = cn || { summary: '' };
      var sig = Object.keys(D.entries).map(function (k) { return D.entries[k]; }).filter(function (e) { return e.ch === c && e.note && (e.note.nkind === 'rule' ? ZP.len(e.note.text) > 4 : ZP.len(e.note.signal) > 4); }).map(function (e) { return { text: e.note.nkind === 'rule' ? e.note.text : e.note.signal }; })
        .concat(Object.keys(D.ideas).map(function (k) { return D.ideas[k]; }).filter(function (x) { return !x.deleted && x.nkind === 'rule' && x.ch === c && ZP.len(x.text) > 4; }).map(function (x) { return { text: x.text }; }));
      html += '<h2>Chapter ' + esc(c) + ' · ' + esc(info.chapters[c].title) + '</h2><p>' + esc(cn.summary).replace(/\n/g, '<br>') + '</p>' +
        cl.map(function (s) { return '<h3>' + esc(s.name) + '</h3>' + (s.text ? '<p>' + esc(s.text).replace(/\n/g, '<br>') + '</p>' : '') + ZPPhotos.thumbsHTML(s.images); }).join('') +
        (sig.length ? '<h3>When I see … I try …</h3><ul>' + sig.map(function (e) { return '<li>' + esc(e.text) + '</li>'; }).join('') + '</ul>' : '');
    });
    var box = document.getElementById('zp-print'); box.innerHTML = html;
    document.body.classList.add('zp-printing');
    window.addEventListener('afterprint', function done() { document.body.classList.remove('zp-printing'); window.removeEventListener('afterprint', done); });
    window.print();
  }

  /* ---------- Stats ---------- */
  // Statistics moved to the Profile page (js/zp-stats.js, profile.html); old links land there.
  function statsView() { location.replace('profile.html?course=' + cid); }

  /* ---------- redo queue ---------- */
  function redoView() {
    derive();
    var mode = ctx.params.get('mode') || '', wch = ctx.params.get('ch') || D.current;
    var queue, title, qinfo = null;
    // "Review more": extra minutes on top of today's budget (more of what is due), and "review ahead": pull not-yet-due reviews forward.
    var extraMin = Math.max(0, +(ctx.params.get('extra') || 0)), aheadOn = ctx.params.get('ahead') === '1';
    function moreHref(addMin, ahead) { return 'notebook.html?course=' + cid + '&view=redo&extra=' + (extraMin + addMin) + (ahead || aheadOn ? '&ahead=1' : ''); }
    function moreButtons() {
      derive(); var base = ZP.req().dailyReviewMin + extraMin, now = Date.now();
      var dq = ZP.dailyQueue(D, now, costOf, base), dqa = ZP.dailyQueue(D, now, costOf, base + 15, { ahead: true });
      if (dq.all.length) return '<a class="zp-btn primary" href="' + moreHref(15, false) + '">Review more (+15 min) · ' + dq.all.length + ' still due</a>';
      if (dqa.ahead) return '<a class="zp-btn" href="' + moreHref(15, true) + '" title="Reviews that are not due yet, soonest first">Review ahead of schedule (+15 min)</a>';
      return '';
    }
    if (ctx.params.get('pid') && D.entries[ctx.params.get('pid')]) { queue = [D.entries[ctx.params.get('pid')]]; title = 'Redo'; }
    else if (mode === 'warmup') { queue = ZP.warmupEntries(D, wch).entries; title = 'Warm-up'; }
    else { qinfo = ZP.dailyQueue(D, Date.now(), costOf, ZP.req().dailyReviewMin + extraMin, { ahead: aheadOn }); queue = qinfo.items; title = 'Review queue'; }
    var src = mode === 'warmup' ? 'warmup' : 'spaced';
    var i = 0, st = {}, correct = 0, done = false;
    // After answering, the entry comes back: the idea for Actual cards, the one-liner for Careless ones.
    function entryRecall(e, note) {
      if (!note) return '';
      var secs = e.track === 'careless' ? [['What went wrong / next time', note.stuck]] : UI.noteSections(note);
      secs = secs.filter(function (x) { return x[1] && String(x[1]).trim(); });
      return secs.length ? '<div class="zp-panel"><p class="zp-label">What you wrote</p><dl class="zp-entry">' + secs.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl></div>' : '';
    }
    // A concept or example card: recall it, reveal what you wrote, and grade yourself.
    function renderCard(e) {
      var u = st[e.pid] || (st[e.pid] = { shown: false, text: '' });
      var kindLabel = e.kind === 'concept' ? 'Concept' : e.kind === 'idea' ? '발상노트' : 'Example';
      var ask = e.kind === 'idea'
        ? '<p class="zp-label">' + (e.trigger ? 'You see this. What do you do?' : 'Recall this idea note.') + '</p><h2 class="zp-cardtitle">' + esc(e.trigger || e.title) + '</h2>' + (e.from && data.byId[e.from] ? '<p class="zp-muted">From ' + UI.codeBadge(data.byId[e.from]) + '</p>' : '') + '<label class="zp-field"><span>Say it or write it first <em>(optional)</em></span><textarea id="zp-crecall" rows="3"></textarea></label>'
        : e.kind === 'concept'
        ? '<p class="zp-label">Explain it in your own words, and say when you would use it.</p><h2 class="zp-cardtitle">' + esc(e.title) + '</h2>' + (e.prompt ? '<p class="zp-muted">' + esc(e.prompt) + '</p>' : '') + '<label class="zp-field"><span>Say it or write it first <em>(optional)</em></span><textarea id="zp-crecall" rows="3">' + esc(u.text) + '</textarea></label>'
        : '<p class="zp-label">Work this example again from the book, without looking at the solution.</p><h2 class="zp-cardtitle">' + esc(e.title) + '</h2>' + (e.prompt ? '<div class="zp-stem">' + esc(e.prompt) + '</div>' : '');
      var body;
      if (!u.shown) body = ask + '<div class="zp-row">' + UI.btn(e.kind === 'concept' ? 'Show what I wrote' : e.kind === 'idea' ? 'Show my 발상노트' : 'Show my note', 'cshow', 'primary') + '</div>';
      else {
        var pv = ZP.FSRS.preview(e.card, Date.now(), e.ret), GN = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
        body = '<h2 class="zp-cardtitle">' + esc(e.title) + '</h2>' + (u.text ? '<p class="zp-muted">You said: ' + esc(u.text) + '</p>' : '') +
          (e.body ? '<div class="zp-panel"><p class="zp-label">' + (e.kind === 'concept' ? 'What you wrote' : e.kind === 'idea' ? 'Your 발상노트' : 'Your note') + '</p><p class="zp-concept">' + esc(e.body) + '</p>' + (e.images && e.images.length ? '<div data-cp="' + esc(e.id) + '">' + ZPPhotos.thumbsHTML(e.images) + '</div>' : '') + '</div>' : '<p class="zp-muted">' + (e.kind === 'concept' ? 'You have not written anything for this concept yet. Say it out loud, then open the book to check.' : 'Check your work against the solution in the book.') + '</p>') +
          '<p class="zp-label">How well did you remember it? This sets when you see it next.</p><div class="zp-row">' + [1, 2, 3, 4].map(function (g) { return UI.btn(GN[g] + ' · ' + fmtDays(pv[g]), 'cgrade', g === 3 ? 'primary' : '', 'data-g="' + g + '"'); }).join('') + '</div>';
      }
      main.innerHTML = tabs() + '<section class="zp-panel"><p class="zp-eyebrow">' + title + ' · ' + (i + 1) + ' of ' + queue.length + ' · <span class="zp-badge">' + kindLabel + '</span>' + (e.ch ? ' Ch ' + esc(e.ch) : '') + (e.early ? ' <span class="zp-badge">ahead of schedule</span>' : '') + '</p>' + body + '</section>';
      UI.renderMath(main);
      ZPPhotos.bind(main, { images: function () { return e.images || []; }, save: function () { /* read-only */ } });
    }
    // A "careless" problem that is wrong again was probably not careless.
    function upgradePanel(e, note) {
      var seed = { track: 'actual', nkind: 'other', text: note ? ZP.noteBody(note) : '', approach: note && note.approach || '' };
      return '<div class="zp-panel"><p class="zp-label">Still wrong. Was it really careless?</p><p class="zp-muted">If you missed the idea, make it Actual: write the main idea and it moves to your Idea Notebook with the fuller schedule.</p>' +
        UI.entryFormHTML(e.pid, seed) + '<div class="zp-row">' + UI.btn('Make it Actual', 'upgrade', '', 'data-pid="' + esc(e.pid) + '"') + '</div></div>';
    }
    function render() {
      if (!queue.length) {
        var next = Object.keys(D.entries).map(function (k) { return D.entries[k]; }).filter(function (e) { return e.due; }).sort(function (a, b) { return a.due - b.due; })[0];
        main.innerHTML = tabs() + UI.emptyState('Nothing due', (next ? 'Your next redo is due ' + UI.fmtDate(next.due) + '.' : 'Redos appear here a few days after you write an entry.')) + '<div class="zp-row">' + moreButtons() + '</div>';
        return;
      }
      if (done) {
        main.innerHTML = tabs() + '<section class="zp-panel"><h2>' + title + ' complete</h2><p>' + correct + ' of ' + queue.length + ' right this time.</p><p class="zp-muted">Easy and Good answers push the next review further out. Again brings it back tomorrow, and it is worth another look at the entry.</p>' + (qinfo && qinfo.all.length > queue.length - qinfo.ahead ? '<p class="zp-muted">' + (qinfo.all.length - (queue.length - qinfo.ahead)) + ' more are due. They roll over to your next session (today\'s budget is about ' + qinfo.budget + ' minutes).</p>' : '') + '<div class="zp-row">' + (qinfo ? moreButtons() : '') + '<a class="zp-btn primary" href="roadmap.html?course=' + cid + '">Back to the roadmap</a><a class="zp-btn" href="notebook.html?course=' + cid + '&view=browse">Open notes</a></div></section>';
        return;
      }
      var e = queue[i];
      if (e.isCard) return renderCard(e);
      var Q = data.byId[e.pid], u = st[e.pid] || (st[e.pid] = { sel: '', text: '', shown: false, ok: null });
      var note = D.notes[e.pid];
      var body;
      if (!u.shown) {
        body = (Q.frq ? '<label class="zp-field"><span>Your answer (work on paper)</span><textarea id="zp-rd" rows="4">' + esc(u.text) + '</textarea></label>' : UI.choicesHTML(Q, { selected: u.sel })) +
          '<div class="zp-row">' + UI.btn(Q.frq ? 'Reveal solution' : 'Check', 'check', 'primary', Q.frq || u.sel ? '' : 'disabled') + '</div>';
      } else {
        var base = e.card || ZP.FSRS.grade(ZP.FSRS.blank(), 3, Date.now(), e.ret), pv = ZP.FSRS.preview(base, Date.now(), e.ret);
        var GN = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
        var grades = u.ok === null ? '' : '<p class="zp-label">' + (u.ok ? 'How did it feel? This sets when you see it next.' : 'It comes back soon.') + '</p><div class="zp-row">' +
          (u.ok ? [2, 3, 4] : [1]).map(function (g) { return UI.btn(GN[g] + ' · ' + fmtDays(pv[g]), 'grade', g === 3 || g === 1 ? 'primary' : '', 'data-g="' + g + '"'); }).join('') + '</div>';
        body = (Q.frq ? '' : UI.choicesHTML(Q, { selected: u.sel, correct: Q.correct, reveal: true, locked: true })) +
          (Q.frq ? '<p class="zp-label">How did you do?</p><div class="zp-chips"><button type="button" class="zp-chip' + (u.ok === true ? ' on' : '') + '" data-act="rate" data-r="got">Got it</button><button type="button" class="zp-chip' + (u.ok === false ? ' on' : '') + '" data-act="rate" data-r="no">Missed</button></div>' :
            '<div class="zp-result ' + (u.ok ? 'good' : 'bad') + '"><b>' + (u.ok ? 'Right.' : 'Not this time.') + '</b></div>') +
          UI.solutionHTML(Q) +
          entryRecall(e, note) + (u.ok === false && e.track === 'careless' ? upgradePanel(e, note) : '') + grades;
      }
      var budget = qinfo && i === 0 && !u.shown ? '<p class="zp-muted">' + qinfo.all.length + ' due · showing ' + queue.length + ' (about ' + qinfo.minutes + ' min of your ' + qinfo.budget + '-minute budget). The rest rolls over. ' + (qinfo.all.length > queue.length - qinfo.ahead ? '<a class="zp-link" href="' + moreHref(15, false) + '">Review more (+15 min)</a>' : '') + '</p>' : '';
      main.innerHTML = tabs() + '<section class="zp-panel"><p class="zp-eyebrow">' + title + ' · ' + (i + 1) + ' of ' + queue.length + ' · ' + UI.codeBadge(Q) + ' ' + (e.track ? '<span class="zp-badge ' + (e.track === 'actual' ? 'ok' : '') + '">' + esc(UI.ETYPE[e.track]) + '</span>' : '') + '</p>' + budget + UI.stemHTML(Q) + '<div class="zp-row zp-noprint">' + UI.copyBtn(e.pid) + '</div>' + body + '</section>';
      UI.renderMath(main); UI.initEntryForms(main);
    }
    main.onclick = function (ev) {
      var e = queue[i], Q = e && data.byId[e.pid], u = e && st[e.pid];
      var cb = ev.target.closest('[data-act="cshow"], [data-act="cgrade"]');
      if (cb && e && e.isCard) {
        if (cb.dataset.act === 'cshow') { u.text = (document.getElementById('zp-crecall') || {}).value || ''; u.shown = true; return render(); }
        var g = +cb.dataset.g; if (g >= 3) correct++;
        store.append('card_redo', { ch: e.ch, kind: e.kind, key: e.key, grade: g });
        if (i === queue.length - 1) { done = true; derive(); } else i++;
        return render();
      }
      var c = ev.target.closest('[data-choice]');
      if (c && u && !u.shown) { u.sel = c.dataset.choice; return render(); }
      var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = b.dataset.act;
      if (a === 'check') {
        if (Q.frq) { u.text = (document.getElementById('zp-rd') || {}).value || ''; u.shown = true; return render(); }
        u.ok = u.sel === Q.correct; u.shown = true; render();
      } else if (a === 'rate') {
        u.ok = b.dataset.r === 'got'; render();
      } else if (a === 'upgrade') {
        var form = main.querySelector('.zp-entryform'), r = UI.readEntryForm(form, e.src); if (!r.ok) return;
        r.data.ch = e.ch; r.data.track = 'actual'; store.append('note', r.data); UI.applyOwn(store, D, e.pid, e.ch, r.own); derive();
        queue[i] = D.entries[e.pid] || e; st[e.pid].upgraded = true; render();
      } else if (a === 'grade') {
        if (u.ok) correct++;
        store.append('redo', { ch: e.ch, pid: e.pid, answer: Q.frq ? u.text : u.sel, correct: u.ok, grade: +b.dataset.g, src: src });
        if (i === queue.length - 1) { done = true; derive(); } else i++;
        render();
      }
    };
    main.onchange = null; main.oninput = null;
    UI.bindEntryForms(main);
    render();
  }

  if (view === 'inbox') writeView(); else if (view === 'concepts') conceptsView(); else if (view === 'study') studyView(); else if (view === 'redo') redoView(); else if (view === 'stats') statsView(); else browseView();
  store.onChange(function () { var el = document.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
})();
