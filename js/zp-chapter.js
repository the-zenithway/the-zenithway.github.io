/* Chapter hub (stepper) and the B / C / R / T / Close workspaces. Route: chapter.html?course=&ch=#hub|b|c|r|t|x */
(async function () {
  'use strict';
  requireLogin();
  var ctx = ZPUI.resolveContext();
  var main = document.getElementById('zp-main');
  ZPUI.guard(main);
  var logout_ = document.getElementById('logout-btn'); if (logout_) logout_.addEventListener('click', logout);
  if (!ctx) return;
  var ZP = window.ZP, UI = window.ZPUI, CFG = window.ZP_CONFIG, esc = UI.esc;
  if (!ctx.course) { main.innerHTML = UI.emptyState('No problem banks for your courses yet', 'This part of the platform is available for AP Calculus BC and AP Chemistry.', '<a class="zp-btn primary" href="portal.html">Back to courses</a>'); return; }

  var data, store, D, ch, stageView, S;
  try { data = await ZPBanks.load(ctx.course.id); } catch (e) { main.innerHTML = UI.emptyState('Could not load the problem banks', esc(e.message)); return; }
  store = ZP.open(ctx.student.username, ctx.course.id);
  await store.load();
  var info = data.info;
  function derive() { D = ZP.derive(store.events(), info); return D; }
  derive();
  ch = ctx.params.get('ch');
  if (!info.chapters[ch]) ch = D.current || info.order[0];
  if (!ch) { main.innerHTML = UI.emptyState('No chapters yet', 'The banks for this course are empty.'); return; }
  var meta = info.chapters[ch];
  var KEY2HASH = { B: 'b', C: 'c', R: 'r', T: 't', V: 'rt', X: 'x' };
  var NAMES = ZP.STAGE_NAME;
  var BASE = 'chapter.html?course=' + encodeURIComponent(ctx.course.id) + '&ch=' + encodeURIComponent(ch);
  var cleanups = [];
  function onLeave(fn) { cleanups.push(fn); }
  function cleanup() { cleanups.splice(0).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }
  document.title = 'Chapter ' + ch + ' · ' + meta.title + ' — Zenith';

  function head(stage) {
    // Inside a stage the way back is the chapter page; the course page is one level further up.
    var up = 'roadmap.html?course=' + encodeURIComponent(ctx.course.id);
    return '<div class="zp-crumb">' + (stage ? '<a href="' + BASE + '#hub">← Chapter ' + esc(ch) + ' · ' + esc(meta.title) + '</a> <span>/</span> <a href="' + up + '">' + esc(ctx.course.name) + '</a>' : '<a href="' + up + '">← ' + esc(ctx.course.name) + ' roadmap</a>') + ' ' + UI.saveStatus(store) + '</div>';
  }
  function chapterPicker() {
    return '<label class="zp-chpick"><span class="zp-muted">Chapter</span><select id="zp-chsel">' + info.order.map(function (c) {
      var done = D.stages[c].complete;
      return '<option value="' + c + '"' + (c === ch ? ' selected' : '') + '>' + (done ? '✓ ' : '') + c + ' · ' + esc(info.chapters[c].title) + '</option>';
    }).join('') + '</select></label>';
  }

  /* ================= HUB ================= */
  var DONE_WHEN = {
    B: 'You have read the book chapter and submitted. Add the examples and concepts you want to keep.',
    C: 'Every problem attempted. Flag the ones you want to review (wrong answers are flagged for you).',
    R: 'Every flagged problem has an entry: Careless or Actual, and what happened.',
    T: 'The test submitted. One test per chapter, no retake.',
    V: 'Every test miss has an entry, the same way as in Review.',
    X: 'Your Concepts Notebook for the chapter written and the chapter closed.'
  };
  var MINUTES = { B: '30–60 min', C: '60–90 min', R: '20–40 min', T: 'about ' + ZPTest.paceMinutes(meta.tIds, data.byId) + ' min', V: '20–40 min', X: '20 min' };

  function progressText(k) {
    var s = S[k];
    if (k === 'B') return s.done ? 'Submitted' : s.total ? s.exTot + ' examples · ' + s.cpTot + ' concepts' : 'Not started';
    if (k === 'C') return s.cur + ' of ' + s.total + ' attempted';
    if (k === 'R') return s.entries ? s.cur + ' of ' + s.total + ' written' : S.C.done ? 'Nothing flagged' : 'Fills in as you work through C';
    if (k === 'T') return s.submitted ? 'Submitted · ' + s.score.correct + '/' + s.score.total : 'Not taken';
    if (k === 'V') return !s.submitted ? 'Opens after the test' : s.entries ? s.cur + ' of ' + s.total + ' written' : 'No misses';
    if (k === 'X') return s.done ? 'Closed' : s.ready ? 'Concepts Notebook written' : 'Not started';
    return '';
  }

  function hub() {
    cleanup(); derive(); S = D.stages[ch];
    var T = ZP.today(D, null);
    var w = ZP.warmupEntries(D, ch), due = ZP.dueEntries(D);
    var banners = '';
    if (w.entries.length && !S.complete) banners += '<div class="zp-banner"><div><b>Warm-up · 15 min</b><br><span class="zp-muted">Redo ' + w.entries.length + ' problem' + (w.entries.length > 1 ? 's' : '') + ' you missed on the Chapter ' + esc(w.prev) + ' test before you dive in.</span></div><a class="zp-btn primary" href="notebook.html?course=' + encodeURIComponent(ctx.course.id) + '&view=redo&mode=warmup&ch=' + encodeURIComponent(ch) + '">Start warm-up</a></div>';
    if (due.length) banners += '<div class="zp-banner"><div><b>' + due.length + ' review' + (due.length > 1 ? 's' : '') + ' due</b><br><span class="zp-muted">Spaced redos of problems you wrote notes on.</span></div><a class="zp-btn" href="notebook.html?course=' + encodeURIComponent(ctx.course.id) + '&view=redo">Open review queue</a></div>';
    var cards = S.seq.map(function (k, i) {
      var s = S[k], state = s.done ? 'done' : s.locked ? 'locked' : s.state;
      var cta = s.done || s.optional ? 'Open' : s.state === 'active' && s.started ? 'Continue' : 'Start';
      var lockNote = s.locked ? '<p class="zp-muted zp-lock">' + (k === 'T' ? 'Write your Review entries first so the test measures what you fixed. You can still start it.' : 'Finish the earlier stages first. You can still open it.') + '</p>' : '';
      return '<article class="zp-stage ' + state + '"><div class="zp-stage-n">' + (s.done ? '✓' : i + 1) + '</div><div class="zp-stage-body">' +
        '<h3>' + (k === 'X' ? 'Close · Concepts Notebook' : k === 'R' || k === 'V' ? 'Review' + (k === 'V' ? ' of the test' : '') : NAMES[k]) + ' <span class="zp-tag">' + MINUTES[k] + '</span>' + (s.optional ? ' <span class="zp-badge">Optional review</span>' : '') + '</h3>' +
        '<p>' + esc(ZP.stageGoal(k)) + '</p><p class="zp-muted">Done when: ' + esc(DONE_WHEN[k]) + '</p>' + lockNote + '</div>' +
        '<div class="zp-stage-side"><span class="zp-prog">' + esc(progressText(k)) + '</span>' + (k === 'C' ? '<a class="zp-link" href="practice.html?course=' + encodeURIComponent(ctx.course.id) + '&ch=' + encodeURIComponent(ch) + '&ret=' + encodeURIComponent('chapter.html?course=' + ctx.course.id + '&ch=' + ch + '#hub') + '#practice">More practice from this chapter</a>' : '') + '<a class="zp-btn ' + (s.state === 'active' && !s.done && !s.locked ? 'primary' : '') + '" href="' + BASE + '#' + KEY2HASH[k] + '">' + cta + '</a></div></article>';
    }).join('');
    var next = S.complete ? '' : '<p class="zp-next">Next: <b>' + esc(T.ch === ch ? T.action.label : 'finish Chapter ' + T.ch + ' first') + '</b></p>';
    main.innerHTML = head() + '<div class="zp-hubhead"><div><p class="zp-eyebrow">' + esc(ctx.course.name) + '</p><h1>Chapter ' + esc(ch) + ' · ' + esc(meta.title) + '</h1>' + next + '</div>' + chapterPicker() + '</div>' + banners +
      '<div class="zp-stages">' + cards + '</div>' +
      (S.complete && S.hasOptional ? '<div class="zp-banner ok"><div><b>Chapter ' + esc(ch) + ' is complete.</b><br><span class="zp-muted">The test and the Concepts Notebook are optional review for this chapter. Do them any time you want the practice.</span></div></div>' : S.complete ? '<div class="zp-banner ok"><div><b>Chapter ' + esc(ch) + ' is closed.</b><br><span class="zp-muted">Your Concepts Notebook lives in the Notebook.</span></div><a class="zp-btn" href="notebook.html?course=' + encodeURIComponent(ctx.course.id) + '&view=concepts&ch=' + encodeURIComponent(ch) + '">Open Concepts Notebook</a></div>' : '');
    var sel = document.getElementById('zp-chsel');
    sel.onchange = function () { location.href = 'chapter.html?course=' + encodeURIComponent(ctx.course.id) + '&ch=' + encodeURIComponent(sel.value) + '#hub'; };
  }

  /* ================= B ================= */
  var lastDeleted = null; // {kind, key, name}: shown as an Undo bar after a delete
  function bView() {
    cleanup(); derive(); S = D.stages[ch];
    var exEvents = D.ex[ch] || {}, cpEvents = D.concepts[ch] || {};
    var ownEx = Object.keys(exEvents).filter(function (k) { return meta.exKeys.indexOf(k) < 0; });
    var ownCp = Object.keys(cpEvents).filter(function (k) { return meta.conceptKeys.indexOf(k) < 0; });
    var book = ZPBanks.bookUrl(ctx.course, ch);
    function gone(map, k) { return !!(map[k] && map[k].deleted); }
    // Cards are unique by name within a chapter (ignoring case and extra spaces), so the same example or concept can't be added twice.
    function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
    function cardNames(kind) {
      var evMap = kind === 'example' ? exEvents : cpEvents, bank = kind === 'example' ? meta.examples : meta.concepts, out = [];
      bank.map(function (x) { return x.key; }).concat(Object.keys(evMap).filter(function (k) { return !bank.some(function (x) { return x.key === k; }); })).forEach(function (k) {
        var def = bank.filter(function (x) { return x.key === k; })[0] || {}, e = evMap[k] || {};
        out.push({ key: k, name: e.label || e.name || def.label || def.name || k, deleted: gone(evMap, k) });
      });
      return out;
    }
    function nameClash(kind, name, exceptKey) {
      var n = norm(name);
      return cardNames(kind).filter(function (c) { return c.key !== exceptKey && norm(c.name) === n; })[0] || null;
    }
    function clashMsg(c, kind) { return c.deleted ? '"' + c.name + '" is already in your Deleted cards. Restore it from there.' : 'You already have ' + (kind === 'example' ? 'an example' : 'a concept') + ' called "' + c.name + '".'; }
    // The only decision on a card: put it in the review queue (graded Again / Hard / Good / Easy on the FSRS schedule) or not.
    function reviewBtn(kind, key) {
      var on = !!D.cardOn[ZP.cardId(kind, ch, key)];
      return '<button type="button" class="zp-chip' + (on ? ' on' : '') + '" data-act="cflag" data-kind="' + kind + '" data-key="' + esc(key) + '">' + (on ? '✓ In review queue' : 'Add to review queue') + '</button>';
    }
    function tools(withOrder) { return '<span class="zp-cardtools">' + (withOrder ? '<span class="zp-ord"><button type="button" class="zp-linkbtn" data-act="cup" aria-label="Move up">↑</button><button type="button" class="zp-linkbtn" data-act="cdown" aria-label="Move down">↓</button></span>' : '') + '<button type="button" class="zp-linkbtn" data-act="rename">Rename</button><button type="button" class="zp-linkbtn" data-act="delete">Delete</button></span>'; }
    function exCard(key, label) {
      var e = exEvents[key] || {}, name = e.label || label;
      return '<article class="zp-card" data-ex="' + esc(key) + '" data-label="' + esc(name) + '"><header><b>' + esc(name) + '</b>' + tools() + '</header>' +
        '<label class="zp-field"><textarea data-line maxlength="400" rows="2" aria-label="Short note (optional)" placeholder="Short note, if you want one: how you solved it, or what to remember.">' + esc(e.line || '') + '</textarea></label>' +
        '<div class="zp-row">' + reviewBtn('example', key) + '</div></article>';
    }
    function cpCard(key, label, prompt) {
      var e = cpEvents[key] || {}, name = e.name || label;
      return '<article class="zp-card" data-cp="' + esc(key) + '" data-name="' + esc(name) + '"><header><b>' + esc(name) + '</b>' + tools(true) + '</header>' +
        '<label class="zp-field"><span class="zp-muted">' + esc(prompt || 'In your own words: what it is, and when you use it.') + '</span><textarea data-text maxlength="1600" rows="3" data-minwords="' + ZP.req().conceptWords + '">' + esc(e.text || '') + '</textarea></label>' + ZPPhotos.controlsHTML(e.images) +
        '<div class="zp-row">' + reviewBtn('concept', key) + '</div></article>';
    }
    function deletedList() {
      var items = [];
      meta.exKeys.concat(ownEx).forEach(function (k) { if (gone(exEvents, k)) items.push(['example', k, exEvents[k].label || k]); });
      meta.conceptKeys.concat(ownCp).forEach(function (k) { if (gone(cpEvents, k)) items.push(['concept', k, cpEvents[k].name || k]); });
      return items.length ? '<details class="zp-panel"><summary class="zp-muted">Deleted cards (' + items.length + ')</summary>' + items.map(function (i) {
        return '<div class="zp-rightrow"><span>' + (i[0] === 'concept' ? 'Concept' : 'Example') + ' · ' + esc(i[2]) + '</span><button type="button" class="zp-btn" data-act="restore" data-kind="' + i[0] + '" data-key="' + esc(i[1]) + '">Restore</button></div>'; }).join('') + '</details>' : '';
    }
    var exHTML = meta.examples.filter(function (x) { return !gone(exEvents, x.key); }).map(function (x) { return exCard(x.key, x.label); }).join('') + ownEx.filter(function (k) { return !gone(exEvents, k); }).map(function (k) { return exCard(k, exEvents[k].label || k); }).join('');
    var cpHTML = ZP.conceptList(D, info, ch).map(function (it) { return cpCard(it.key, it.name, it.prompt); }).join('');
    var undo = lastDeleted ? '<div class="zp-banner"><span>Deleted "' + esc(lastDeleted.name) + '".</span><button type="button" class="zp-btn" data-act="restore" data-kind="' + lastDeleted.kind + '" data-key="' + esc(lastDeleted.key) + '">Undo</button></div>' : '';
    main.innerHTML = head('B') + '<h1>Book · Chapter ' + esc(ch) + ' · ' + esc(meta.title) + '</h1>' + undo +
      '<div class="zp-row">' + (book ? '<a class="zp-btn primary" href="' + esc(book) + '" target="_blank" rel="noopener">Open the book chapter ↗</a>' : '<span class="zp-muted">No book link on your roadmap for this chapter.</span>') + '</div>' +
      '<section class="zp-panel"><h2>Examples</h2><p>The examples you worked in the book, with a short note if you like. Add any you want to see again to your review queue.</p>' +
      (exHTML || '<p class="zp-muted">No examples yet. Add the ones you worked through.</p>') +
      '<div class="zp-addrow"><input type="text" id="zp-addex" maxlength="60" placeholder="Add an example, e.g. Example 4 (p. 12)"><button type="button" class="zp-btn" data-act="add-ex">Add</button></div><p class="zp-formerr" id="zp-addex-err" hidden></p></section>' +
      '<section class="zp-panel"><h2>Concept cards</h2><p>Close the book. In your own words: what is the idea, and when do you use it? These become the draft of your Concepts Notebook. Add the ones you want to remember to your review queue.</p>' +
      (cpHTML || '<p class="zp-muted">No concept cards yet. Add the key ideas of the chapter (aim for 5 to 8).</p>') +
      '<div class="zp-addrow"><input type="text" id="zp-addcp" maxlength="60" placeholder="Add a concept, e.g. Chain rule"><button type="button" class="zp-btn" data-act="add-cp">Add</button></div><p class="zp-formerr" id="zp-addcp-err" hidden></p></section>' +
      deletedList() + '<section class="zp-panel" id="zp-bcheck"></section>';
    bCheck();
    UI.renderMath(main);
    ZPPhotos.bind(main, { images: function (card) { return (cpEvents[card.dataset.cp] || {}).images || []; }, save: function (card, imgs) { save(card, { images: imgs }); bView(); } });

    function exData(card, extra) { var old = exEvents[card.dataset.ex] || {}; return Object.assign({ ch: ch, key: card.dataset.ex, label: card.dataset.label, tap: old.tap || '', line: card.querySelector('[data-line]').value.trim() }, extra || {}); }
    function cpData(card, extra) { return Object.assign({ ch: ch, key: card.dataset.cp, name: card.dataset.name, text: card.querySelector('[data-text]').value.trim() }, extra || {}); }
    function save(card, extra) {
      if (card.dataset.ex !== undefined) store.append('ex', exData(card, extra)); else store.append('concept', cpData(card, extra));
      derive(); S = D.stages[ch]; bCheck();
    }
    function finishRename(cardEl, save_) {
      if (save_) {
        var v = (cardEl.querySelector('.zp-renamebox input') || {}).value || '';
        v = v.trim().slice(0, 60);
        var kd0 = cardEl.dataset.ex !== undefined ? 'example' : 'concept', clash = v && nameClash(kd0, v, cardEl.dataset.ex !== undefined ? cardEl.dataset.ex : cardEl.dataset.cp);
        if (clash) {
          var box = cardEl.querySelector('.zp-renamebox'), er = box.querySelector('.zp-formerr') || box.appendChild(Object.assign(document.createElement('span'), { className: 'zp-formerr' }));
          er.textContent = clashMsg(clash, kd0); return;
        }
        if (v) { if (cardEl.dataset.ex !== undefined) cardEl.dataset.label = v; else cardEl.dataset.name = v; save(cardEl); }
      }
      lastDeleted = null; bView();
    }
    main.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act, cardEl = b.closest('.zp-card');
      if (act === 'add-ex' || act === 'add-cp') {
        var isEx = act === 'add-ex', inp = document.getElementById(isEx ? 'zp-addex' : 'zp-addcp'), v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        var clash = nameClash(isEx ? 'example' : 'concept', v, '');
        if (clash) { var er = document.getElementById(isEx ? 'zp-addex-err' : 'zp-addcp-err'); er.textContent = clashMsg(clash, isEx ? 'example' : 'concept'); er.hidden = false; inp.focus(); return; }
        var key = 'u' + Date.now().toString(36);
        if (isEx) store.append('ex', { ch: ch, key: key, label: v, tap: '', line: '' }); else store.append('concept', { ch: ch, key: key, name: v, text: '' });
        lastDeleted = null; return bView();
      }
      if (act === 'rename' && cardEl) {
        // Inline, no browser dialog: the title turns into a text box.
        var isE = cardEl.dataset.ex !== undefined, cur = isE ? cardEl.dataset.label : cardEl.dataset.name, title = cardEl.querySelector('header b');
        title.outerHTML = '<span class="zp-renamebox"><input type="text" maxlength="60" value="' + esc(cur) + '" aria-label="New name"><button type="button" class="zp-btn primary" data-act="rename-save">Save</button><button type="button" class="zp-linkbtn" data-act="rename-cancel">Cancel</button></span>';
        var box = cardEl.querySelector('.zp-renamebox input'); box.focus(); box.select();
        return;
      }
      if ((act === 'cup' || act === 'cdown') && cardEl) { save(cardEl); ZP.moveConcept(store, derive(), info, ch, cardEl.dataset.cp, act === 'cup' ? -1 : 1); lastDeleted = null; return bView(); }
      if (act === 'rename-save' && cardEl) return finishRename(cardEl, true);
      if (act === 'rename-cancel' && cardEl) return finishRename(cardEl, false);
      if (act === 'delete' && cardEl) {
        // Immediate, with an Undo bar and a "Deleted cards" list to restore from.
        var nm = cardEl.dataset.label || cardEl.dataset.name, kd = cardEl.dataset.ex !== undefined ? 'example' : 'concept', ky = cardEl.dataset.ex !== undefined ? cardEl.dataset.ex : cardEl.dataset.cp;
        save(cardEl, { deleted: true }); lastDeleted = { kind: kd, key: ky, name: nm }; return bView();
      }
      if (act === 'restore') {
        var kind = b.dataset.kind, k = b.dataset.key, old = (kind === 'example' ? exEvents : cpEvents)[k] || {};
        if (kind === 'example') store.append('ex', { ch: ch, key: k, label: old.label || k, tap: old.tap || '', line: old.line || '', deleted: false }); else store.append('concept', { ch: ch, key: k, name: old.name || k, text: old.text || '', deleted: false });
        lastDeleted = null; return bView();
      }
      if (act === 'cflag') { if (cardEl) save(cardEl); var cid = ZP.cardId(b.dataset.kind, ch, b.dataset.key); store.append('card_flag', { ch: ch, kind: b.dataset.kind, key: b.dataset.key, on: !D.cardOn[cid] }); lastDeleted = null; return bView(); }
      if (act === 'submit-b') { store.append('b_submit', { ch: ch }); location.hash = '#hub'; hub(); }
    };
    main.onkeydown = function (e) {
      var box = e.target.closest && e.target.closest('.zp-renamebox'); if (!box) return;
      var cardEl = box.closest('.zp-card');
      if (e.key === 'Enter') { e.preventDefault(); finishRename(cardEl, true); } else if (e.key === 'Escape') finishRename(cardEl, false);
    };
    // Typing in a concept box saves quietly. No re-render, so a click on a button right after typing still lands.
    main.onchange = function (e) { var card = e.target.closest('.zp-card'); if (card && (e.target.matches('[data-text]') || e.target.matches('[data-line]'))) save(card); };
  }
  function bCheck() {
    var B = D.stages[ch].B, el = document.getElementById('zp-bcheck'); if (!el) return;
    el.innerHTML = '<h2>Done reading?</h2><p class="zp-muted">' + B.exTot + ' example' + (B.exTot === 1 ? '' : 's') + ' · ' + B.cpTot + ' concept card' + (B.cpTot === 1 ? '' : 's') + '. Submit when you have finished the book chapter.</p>' +
      '<div class="zp-row">' + UI.btn(B.done ? 'Submitted ✓ (edits still save)' : 'Submit Book', 'submit-b', 'primary', B.done ? 'disabled' : '') + '<a class="zp-btn" href="' + BASE + '#c">Go to problems →</a></div>';
  }

  /* ================= C ================= */
  function cView() {
    cleanup(); derive(); S = D.stages[ch];
    if (!meta.hasC) { main.innerHTML = head('C') + UI.emptyState('No chapter problems yet', 'The C problems for this chapter have not been added.', '<a class="zp-btn" href="' + BASE + '#hub">Back to chapter</a>'); return; }
    var r = ZPRun.mount({ host: main, store: store, data: data, derive: derive, ids: meta.cIds, head: head('C'), title: 'Problems · Chapter ' + ch, ctx: 'chapter',
      backHref: BASE + '#hub' });
    onLeave(r.cleanup);
  }

  /* ================= R / R (test) ================= */
  // Same screen for both: every flagged (or missed) problem in scope needs an entry, Careless or Actual.
  function writeView(stageKey) {
    cleanup(); derive(); S = D.stages[ch];
    var isTest = stageKey === 'V', ids = isTest ? meta.tIds : meta.cIds;
    var hash = isTest ? '#rt' : '#r';
    if (!ids.length || (isTest && !meta.hasT)) {
      main.innerHTML = head(stageKey) + UI.emptyState(isTest ? 'No test for this chapter' : 'No chapter problems yet', isTest ? 'Chapters without a T set go straight from Review to Close.' : 'The C problems for this chapter have not been added.', '<a class="zp-btn" href="' + BASE + '#hub">Back to chapter</a>');
      return;
    }
    var sub = isTest ? (D.tests[ch] || []).slice(-1)[0] : null;
    if (isTest && !sub) {
      main.innerHTML = head('V') + '<section class="zp-panel"><h1>Review of the test · Chapter ' + esc(ch) + '</h1><p>This opens after you take the chapter test. Every miss will be listed here, and you will write an entry for each one.</p><div class="zp-row"><a class="zp-btn primary" href="' + BASE + '#t">Go to the test</a></div></section>';
      return;
    }
    var host = document.createElement('div'), tail = document.createElement('div');
    main.innerHTML = head(stageKey); main.appendChild(host); main.appendChild(tail);
    function nextHTML() {
      derive(); S = D.stages[ch];
      if (!isTest && !S.R.done && S.C.legacy) return '<div class="zp-banner"><div><b>The Problems for this chapter were finished in the old roadmap.</b><br><span class="zp-muted">Review needs an entry for every problem you want to fix. Flag them in Practice, then Browse (select the problems and press Flag) and they appear here to write up. If there is nothing to review, mark it done.</span></div><button type="button" class="zp-btn" data-act="legacyR">Nothing to review: mark Review done</button></div>';
      if (isTest) return '<div class="zp-banner ok"><div><b>All test misses written up.</b><br><span class="zp-muted">They join your review queue and come back on the FSRS schedule.</span></div><a class="zp-btn primary" href="' + BASE + '#x">On to Close →</a></div>';
      return '<div class="zp-banner ok"><div><b>Review complete.</b><br><span class="zp-muted">Your entries join the review queue and come back on the FSRS schedule.</span></div><a class="zp-btn primary" href="' + BASE + '#t">On to the test →</a></div>';
    }
    function paintTail() {
      derive(); S = D.stages[ch];
      var rev = sub && D.tReviews[sub.id], rule = '';
      if (isTest) rule = '<section class="zp-panel"><label class="zp-field"><span>One rule for next time <em>(optional)</em></span><textarea id="zp-rule" maxlength="300" rows="2" placeholder="e.g. Skip anything I have not started after 90 seconds, and come back.">' + esc(rev && rev.rule || '') + '</textarea></label></section>';
      tail.innerHTML = rule;
      var ta = tail.querySelector('#zp-rule');
      if (ta) ta.onchange = function () { store.append('t_review', { ch: ch, aid: sub.id, rule: ta.value.trim() }); };
    }
    var inScope = {}; ids.forEach(function (id, i) { inScope[id] = i + 1; });
    var focus = ctx.params.get('pid') || '';
    ZPWrite.mount({
      host: host, store: store, data: data, derive: derive, src: isTest ? 'T' : 'C',
      scope: function (pid) { return !!inScope[pid]; }, order: function (pid) { return inScope[pid]; }, pid: focus,
      title: isTest ? 'Review of the test · Chapter ' + ch : 'Review · Chapter ' + ch,
      intro: isTest ? 'Every miss is listed (a test miss cannot be dropped). For each one pick <b>Careless</b> (you knew it, you slipped) or <b>Actual</b> (you did not see the idea) and write what happened.' :
        'Every problem you flagged is listed. For each one pick <b>Careless</b> (you knew it, you slipped) or <b>Actual</b> (you did not see the idea) and write what happened. Careless goes to your review queue; Actual also goes to your Idea Notebook.',
      emptyTitle: isTest ? 'No misses' : (S.C.done ? 'Nothing flagged' : 'Nothing flagged yet'),
      emptyBody: isTest ? 'You got everything right. You can still flag a problem below.' : (S.C.legacy ? 'No problems are flagged yet. Flag the ones you want to fix from the Trainer, then Browse.' : S.C.done ? 'You flagged nothing and got everything right. Nothing needed here.' : 'Wrong answers are flagged for you as you work through the C problems (' + S.C.cur + ' / ' + S.C.total + ' attempted so far). You can flag any problem yourself.'),
      addable: function (DD) { return ids.filter(function (id) { return DD.q[id] && !DD.entries[id] && (!isTest || (sub && sub.pids.indexOf(id) >= 0)); }); },
      addTitle: isTest ? 'Also flag a question you got right' : 'Also flag a problem you got right',
      doneHTML: nextHTML(),
      onChange: paintTail
    });
    paintTail();
    main.onclick = function (e) {
      if (!e.target.closest('[data-act="legacyR"]')) return;
      store.append('legacy_done', { ch: ch, stages: ['R'] }); derive(); location.hash = '#hub'; route();
    };
  }
  function rView() { writeView('R'); }
  function vView() { writeView('V'); }

  /* ================= T ================= */
  function tView() {
    cleanup(); derive(); S = D.stages[ch];
    if (!meta.hasT) { main.innerHTML = head('T') + UI.emptyState('No test for this chapter', 'Chapters without a T set go straight from Review to Close.', '<a class="zp-btn" href="' + BASE + '#hub">Back to chapter</a>'); return; }
    var anyway = false; try { anyway = sessionStorage.getItem('zp-anyway-' + ch) === '1'; } catch (e) { /* ignore */ }
    if (S.T.locked && !anyway && !S.T.submitted) {
      main.innerHTML = head('T') + '<section class="zp-panel"><h1>Test · Chapter ' + esc(ch) + '</h1><p><b>Review isn\'t finished yet.</b> The test is most useful once you have redone your misses and written your notes, so it measures what you fixed.</p><div class="zp-row"><a class="zp-btn primary" href="' + BASE + '#r">Back to Review</a>' + UI.btn('Take the test anyway', 'anyway') + '</div></section>';
      main.onclick = function (e) { if (e.target.closest('[data-act="anyway"]')) { try { sessionStorage.setItem('zp-anyway-' + ch, '1'); } catch (x) { /* ignore */ } tView(); } };
      return;
    }
    main.innerHTML = head('T') + '<div id="zp-tmount"></div>';
    ZPTest.mount({ host: document.getElementById('zp-tmount'), store: store, data: data, derive: derive, kind: 'T', ch: ch, pids: meta.tIds,
      title: 'Chapter ' + ch + ' · ' + meta.title, reviewHref: BASE + '#rt', onChange: function () { /* hub re-derives on open */ } });
  }

  /* ================= Close ================= */
  function xView() {
    cleanup(); derive(); S = D.stages[ch];
    var cn = D.cnotes[ch] || {}, cps = D.concepts[ch] || {};
    var list = ZP.conceptList(D, info, ch);
    function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
    var signals = Object.keys(D.entries).map(function (k) { return D.entries[k]; }).filter(function (e) { return e.ch === ch && e.note && ZP.len(e.note.signal) > 4; });
    var others = S.seq.filter(function (k) { return k !== 'X' && !S[k].done; });
    function secHTML() {
      return list.map(function (it) {
        return '<article class="zp-card" data-cp="' + esc(it.key) + '" data-name="' + esc(it.name) + '"><header><b>' + esc(it.name) + '</b><span class="zp-cardtools"><span class="zp-ord"><button type="button" class="zp-linkbtn" data-act="xup" aria-label="Move up">↑</button><button type="button" class="zp-linkbtn" data-act="xdown" aria-label="Move down">↓</button></span><button type="button" class="zp-linkbtn" data-act="xrename">Rename</button></span></header>' +
          '<label class="zp-field"><textarea data-text rows="3" maxlength="1600" data-minwords="' + ZP.req().conceptWords + '" aria-label="' + esc(it.name) + '">' + esc(it.text) + '</textarea></label>' + ZPPhotos.controlsHTML(it.images) + '</article>';
      }).join('') || '<p class="zp-muted">No concept cards were written in B. Use the summary below.</p>';
    }
    main.innerHTML = head('X') + '<h1>Close · Concepts Notebook · Chapter ' + esc(ch) + '</h1>' +
      '<p>Pull the whole chapter together in your own words. Revise each concept now that practice has shown you where the gaps were. This page collects into your Notebook, and all your chapters together become your own study guide.</p>' +
      (others.length ? '<p class="zp-banner">Not done yet: ' + others.map(function (k) { return NAMES[k]; }).join(', ') + '. You can still write this, but closing works best last.</p>' : '') +
      '<section class="zp-panel"><h2>Concepts, revised</h2><p class="zp-muted">Rename a concept, put them in the order you want to read them (↑ ↓), and add a photo or picture to any of them.</p>' + secHTML() + '</section>' +
      (signals.length ? '<section class="zp-panel"><h2>Signals from your Idea Notebook</h2><p class="zp-muted">Your own "when I see → I try" lines from this chapter.</p><ul class="zp-signals">' + signals.map(function (e) { return '<li>' + esc(e.note.signal) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="zp-panel"><h2>Chapter summary</h2><label class="zp-field"><span>The whole chapter in your own words <em>(at least ' + ZP.req().summaryWords + ' words)</em></span><textarea id="zp-summary" rows="8" maxlength="6000" data-minwords="' + ZP.req().summaryWords + '">' + esc(cn.summary || '') + '</textarea></label><p class="zp-muted" id="zp-count"></p>' +
      '<div class="zp-row">' + UI.btn('Save Concepts Notebook', 'save-x') + UI.btn(S.X.done ? 'Chapter closed ✓' : 'Close chapter', 'close', 'primary', S.X.done ? 'disabled' : '') + '</div><p class="zp-muted" id="zp-xstate"></p></section>';
    var ta = document.getElementById('zp-summary');
    function count() { document.getElementById('zp-count').textContent = ta.value.trim().length + ' characters'; }
    count(); ta.oninput = count;
    // Writes any concept text that changed (used before every action that re-draws the page, so nothing typed is lost).
    function saveTexts() {
      main.querySelectorAll('[data-cp]').forEach(function (lab) {
        var t = lab.querySelector('[data-text]').value.trim(), old = (cps[lab.dataset.cp] || {}).text || '';
        if (t !== old) store.append('concept', { ch: ch, key: lab.dataset.cp, name: lab.dataset.name, text: t });
      });
      derive(); S = D.stages[ch];
    }
    function xRename(cardEl, doSave) {
      if (doSave) {
        var v = ((cardEl.querySelector('.zp-renamebox input') || {}).value || '').trim().slice(0, 60);
        var clash = v && list.filter(function (it) { return it.key !== cardEl.dataset.cp && norm(it.name) === norm(v); })[0];
        if (clash) { var box = cardEl.querySelector('.zp-renamebox'), er = box.querySelector('.zp-formerr') || box.appendChild(Object.assign(document.createElement('span'), { className: 'zp-formerr' })); er.textContent = 'You already have a concept called "' + clash.name + '".'; return; }
        if (v) { saveTexts(); store.append('concept', { ch: ch, key: cardEl.dataset.cp, name: v, text: cardEl.querySelector('[data-text]').value.trim() }); }
      }
      xView();
    }
    ZPPhotos.bind(main, { images: function (card) { return (cps[card.dataset.cp] || {}).images || []; },
      save: function (card, imgs) { saveTexts(); store.append('concept', { ch: ch, key: card.dataset.cp, name: card.dataset.name, text: card.querySelector('[data-text]').value.trim(), images: imgs }); xView(); } });
    function saveAll() {
      main.querySelectorAll('[data-cp]').forEach(function (lab) {
        var t = lab.querySelector('[data-text]').value.trim(), old = (cps[lab.dataset.cp] || {}).text || '';
        if (t !== old) store.append('concept', { ch: ch, key: lab.dataset.cp, name: lab.dataset.name, text: t });
      });
      var sections = Array.prototype.map.call(main.querySelectorAll('[data-cp]'), function (lab) { return { key: lab.dataset.cp, name: lab.dataset.name, text: lab.querySelector('[data-text]').value.trim() }; });
      store.append('cnote', { ch: ch, summary: ta.value.trim(), sections: sections });
      derive(); S = D.stages[ch];
    }
    main.onkeydown = function (e) {
      var rb = e.target.closest && e.target.closest('.zp-renamebox'); if (!rb) return;
      if (e.key === 'Enter') { e.preventDefault(); xRename(rb.closest('.zp-card'), true); } else if (e.key === 'Escape') xRename(rb.closest('.zp-card'), false);
    };
    main.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var state = document.getElementById('zp-xstate'), cardEl = b.closest('.zp-card');
      if (b.dataset.act === 'xup' || b.dataset.act === 'xdown') { saveTexts(); ZP.moveConcept(store, D, info, ch, cardEl.dataset.cp, b.dataset.act === 'xup' ? -1 : 1); return xView(); }
      if (b.dataset.act === 'xrename') {
        var title = cardEl.querySelector('header b');
        title.outerHTML = '<span class="zp-renamebox"><input type="text" maxlength="60" value="' + esc(cardEl.dataset.name) + '" aria-label="New name"><button type="button" class="zp-btn primary" data-act="xrename-save">Save</button><button type="button" class="zp-linkbtn" data-act="xrename-cancel">Cancel</button></span>';
        var inp = cardEl.querySelector('.zp-renamebox input'); inp.focus(); inp.select(); return;
      }
      if (b.dataset.act === 'xrename-save') return xRename(cardEl, true);
      if (b.dataset.act === 'xrename-cancel') return xRename(cardEl, false);
      if (b.dataset.act === 'save-x') { saveAll(); state.textContent = 'Saved.'; }
      if (b.dataset.act === 'close') {
        if (ZP.words(ta.value) < ZP.req().summaryWords) { state.textContent = 'The summary needs at least ' + ZP.req().summaryWords + ' words (you have ' + ZP.words(ta.value) + ').'; ta.focus(); return; }
        if (others.length && !confirm('You haven\'t finished ' + others.map(function (k) { return NAMES[k]; }).join(', ') + '. Close the chapter anyway?')) return;
        saveAll(); store.append('close', { ch: ch }); location.hash = '#hub'; route();
      }
    };
    main.onchange = null;
  }

  /* ================= router ================= */
  function route() {
    var h = (location.hash || '#hub').slice(1);
    var views = { hub: hub, b: bView, c: cView, r: rView, t: tView, rt: vView, x: xView };
    window.scrollTo(0, 0);
    (views[h] || hub)();
  }
  window.addEventListener('hashchange', route);
  // Opening a stage straight from the course page or a link still puts the chapter page behind it, so the browser's Back button
  // lands on the chapter, not on the page where you pick a chapter.
  var first = (location.hash || '#hub').slice(1);
  if (first && first !== 'hub') { try { history.replaceState(null, '', BASE + '#hub'); history.pushState(null, '', BASE + '#' + first); } catch (e) { /* history blocked */ } }
  store.onChange(function () { var el = document.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
  route();
})();
