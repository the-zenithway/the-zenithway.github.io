/* Untimed problem runner: answer, get instant feedback, open the answer and solution when stuck, flag what to review.
 * Used by the chapter C workspace (one chapter's problems) and by the Practice hub (any chosen set).
 * Solving never asks for writing: wrong answers are pre-flagged and the student flags or unflags with one tap.
 * Entries (Careless / Actual + one 발상노트) can be written afterwards in R, R (test) or Notebook › Inbox, or on the spot with "Write my entry now". */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc;

  // opts: {host, store, data, derive(), ids[], head (html), title, backHref, ctx ('chapter'|'practice'), onChange(), onFinish()}
  function mount(opts) {
    var host = opts.host, store = opts.store, data = opts.data, ids = opts.ids, D = opts.derive(), CTXNAME = opts.ctx || 'practice';
    var i = opts.startPid ? ids.indexOf(opts.startPid) : ids.findIndex(function (id) { return !(D.prob[id] && D.prob[id].answered); });
    if (i < 0) i = 0;
    // One attempt per problem per time the runner is opened (a Browse window, or a chapter's Problems page): every answer logged from here
    // carries this session id, and the log counts the latest one per problem. Rating a free-response problem again replaces the rating;
    // multiple-choice records the first check only, and "Try again" is practice that is not recorded.
    var sess = ZP.uid(), ui = {}, timer = null;
    function st(pid) { return ui[pid] || (ui[pid] = { sel: '', conf: '', shownAt: Date.now(), checked: false, lastCorrect: null, text: '', rated: false, peek: false, logged: false, firstOk: null, writing: false, saved: false }); }
    function show(idx) { i = Math.max(0, Math.min(ids.length - 1, idx)); render(); }
    // Wrong answers are pre-flagged; the student keeps or drops the flag, and writes the entry later (R / Notebook).
    function flagNote(pid) {
      var en = D.entries[pid], where = CTXNAME === 'chapter' ? 'in the Review step' : 'under Notebook › Inbox';
      return en ? 'Flagged for review: you will say Careless or Actual and write what happened ' + where + '.' : 'Not flagged. Use "Flag for review" below if you want it back.';
    }
    function render() {
      clearInterval(timer); D = opts.derive();
      var pid = ids[i], Q = data.byId[pid], p = D.prob[pid] || { maxHint: 0 }, u = st(pid);
      // There are no hints: one button opens the answer and the solution. Opening it before answering (or after a miss) is recorded as a
      // miss; looking at the solution after getting it right is just looking and records nothing.
      var opened = p.maxHint >= 4, revealed = opened || u.peek;
      var answeredN = ids.filter(function (id) { return D.prob[id] && D.prob[id].answered; }).length;
      var dots = ids.map(function (id, n) {
        var pp = D.prob[id], cls = 'zp-qdot' + (n === i ? ' cur' : '');
        if (pp && pp.answered) cls += pp.first && pp.first.correct ? ' good' : ' bad';
        return '<button type="button" class="' + cls + '" data-act="jump" data-i="' + n + '" aria-label="Problem ' + (n + 1) + '">' + (n + 1) + '</button>';
      }).join('');
      var answerBlock;
      if (Q.frq) {
        // Class-track students hand in typed / LaTeX text and photos and can ask the mentor for feedback; self-study keeps the plain box.
        var fpanel = root.ZPFrqAns ? root.ZPFrqAns.panelHTML(D, { aid: '', pid: pid, ch: Q.chapter, textId: 'zp-frq', text: u.text }) : '';
        answerBlock = (fpanel || '<label class="zp-field"><span>Your answer (work on paper; summarize here)</span><textarea id="zp-frq" rows="4" maxlength="2000">' + esc(u.text) + '</textarea></label>') +
          (revealed ? UI.solutionHTML(Q) + '<p class="zp-label">How did you do?</p><div class="zp-chips">' + [['got', 'Got it'], ['part', 'Partly'], ['miss', 'Missed']].map(function (r) {
            return '<button type="button" class="zp-chip' + (u.rated === r[0] ? ' on' : '') + '" data-act="rate" data-r="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>' + (u.rated ? '<p class="zp-muted">' + flagNote(pid) + '</p>' : '') : '<p class="zp-muted">Press "Show the answer and solution" below when you are ready to self-check.</p>');
      } else {
        var done = u.checked || revealed;
        // The right letter stays hidden after a miss so "Try again" is a real retry.
        answerBlock = UI.choicesHTML(Q, { selected: u.sel, correct: Q.correct, reveal: revealed || (u.checked && u.lastCorrect), markWrong: u.checked && !u.lastCorrect, locked: done });
        if (revealed) {
          answerBlock += (opened ? '<p class="zp-muted">You opened the answer. ' + flagNote(pid) + '</p>' : '') + UI.solutionHTML(Q);
        } else {
          if (!u.checked) {
            answerBlock += '<div class="zp-conf"><span class="zp-label">How sure are you?</span><div class="zp-chips">' + [['sure', 'Sure'], ['unsure', 'Not sure'], ['guess', 'Guessing']].map(function (c) {
              return '<button type="button" class="zp-chip' + (u.conf === c[0] ? ' on' : '') + '" data-act="conf" data-c="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
          }
          answerBlock += '<div class="zp-row">' + (u.checked && !u.lastCorrect ? UI.btn('Try again', 'retry') : UI.btn('Check answer', 'check', 'primary', u.sel && !u.checked ? '' : 'disabled')) + '</div>';
          if (u.checked) {
            answerBlock += u.lastCorrect ? '<div class="zp-result good"><b>Correct.</b> <span class="zp-muted">' + (u.firstOk === false ? 'Your first try was recorded as a miss; retries are practice and are not recorded.' : 'Want to keep it? Use "Flag for review" below.') + '</span></div>'
              : '<div class="zp-result bad"><b>Not quite.</b> ' + flagNote(pid) + '</div>';
          }
        }
      }
      // Write the entry right here: once the answer is out (a checked multiple-choice answer, or an opened solution), right or wrong.
      var canWrite = Q.frq ? revealed : (u.checked || revealed), note = D.notes[pid], have = !!(note && ZP.entryComplete(note)), entryBlock = '';
      if (canWrite) {
        if (u.writing) entryBlock = '<div class="zp-panel zp-onspot"><h3>Your entry</h3>' + UI.entryFormHTML(pid, note, UI.ownOf(D, pid, Q.chapter)) +
          '<div class="zp-row">' + UI.btn(have ? 'Update entry' : 'Save entry', 'wsave', 'primary') + UI.btn('Close', 'wcancel') + '</div></div>';
        else entryBlock = '<div class="zp-row">' + UI.btn(have ? 'Edit my entry' : 'Write my entry now', 'wnow') + (u.saved ? '<span class="zp-muted">Entry saved. It will come back in your review queue.</span>' : have ? '<span class="zp-muted">You already wrote one.</span>' : '') + '</div>';
      }
      var last = i === ids.length - 1;
      host.innerHTML = (opts.head || '') + (opts.popup ? '' : '<div class="zp-runbar"><h1>' + esc(opts.title || 'Practice') + '</h1><span class="zp-prog">' + answeredN + ' / ' + ids.length + ' attempted</span></div>') +
        '<div class="zp-runbody' + (opts.popup ? ' single' : '') + '">' + (opts.popup ? '' : '<aside class="zp-panel"><div class="zp-qmap">' + dots + '</div><p class="zp-muted">Green = right first try. Red = missed or needed the answer.</p></aside>') +
        '<section class="zp-panel"><p class="zp-label">Problem ' + (i + 1) + ' of ' + ids.length + ' · ' + esc(opts.chLabel ? opts.chLabel(Q) : 'Ch ' + Q.chapter) + ' · ' + UI.codeBadge(Q) + ' ' + UI.statusBadge(D, pid) + (Q.issues.length ? ' · <span class="zp-badge warn">check source</span>' : '') + '</p>' + UI.stemHTML(Q) + answerBlock +
        (revealed ? '' : '<div class="zp-row"><button type="button" class="zp-btn" data-act="reveal">Show the answer and solution</button></div>') +
        entryBlock + UI.toolsHTML(D, pid) +
        '<div class="zp-row">' + UI.btn('← Previous', 'prev', '', i === 0 ? 'disabled' : '') +
        (last ? (opts.backHref ? '<a class="zp-btn primary" href="' + opts.backHref + '">Done</a>' : UI.btn(opts.popup ? 'Close' : 'Finish', 'finish', 'primary')) : UI.btn('Next →', 'next', 'primary')) + '</div></section></div>';
      UI.renderMath(host); UI.initEntryForms(host);
    }

    function logAnswer(pid, answer, correct) {
      var u = st(pid);
      store.append('c_answer', { ch: data.byId[pid].chapter, pid: pid, answer: answer, correct: correct, conf: u.conf, ms: Date.now() - u.shownAt, ctx: CTXNAME, sess: sess });
      u.shownAt = Date.now();
      if (opts.onChange) opts.onChange();
    }
    host.onclick = function (e) {
      var pid = ids[i], Q = data.byId[pid], u = st(pid), c = e.target.closest('[data-choice]');
      if (c && !c.disabled) { u.sel = c.dataset.choice; u.checked = false; return render(); }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = b.dataset.act;
      if (a === 'jump') show(+b.dataset.i);
      else if (a === 'prev') show(i - 1);
      else if (a === 'next') show(i + 1);
      else if (a === 'finish') { if (opts.onFinish) opts.onFinish(); }
      else if (a === 'wnow') { u.writing = true; u.saved = false; render(); var f0 = host.querySelector('.zp-onspot'); if (f0) f0.scrollIntoView({ block: 'nearest' }); }
      else if (a === 'wcancel') { u.writing = false; render(); }
      else if (a === 'wsave') {
        var form = host.querySelector('.zp-entryform'), r = UI.readEntryForm(form, CTXNAME === 'chapter' ? 'C' : 'P'); if (!r.ok) return;
        r.data.ch = Q.chapter; store.append('note', r.data); D = opts.derive(); UI.applyOwn(store, D, pid, Q.chapter, r.own);
        u.writing = false; u.saved = true; render(); if (opts.onChange) opts.onChange();
      }
      else if (a === 'conf') { u.conf = u.conf === b.dataset.c ? '' : b.dataset.c; render(); }
      else if (a === 'check') {
        var ok = u.sel === Q.correct; u.checked = true; u.lastCorrect = ok;
        if (!u.logged) { u.logged = true; u.firstOk = ok; logAnswer(pid, u.sel, ok); }
        render();
      }
      else if (a === 'retry') { u.sel = ''; u.checked = false; u.lastCorrect = null; u.shownAt = Date.now(); render(); }
      else if (a === 'reveal') {
        var answered = D.prob[pid] && D.prob[pid].answered;
        if (u.checked && u.lastCorrect) { u.peek = true; return render(); }
        store.append('c_hint', { ch: Q.chapter, pid: pid, level: 4 });
        if (!answered && !Q.frq && !u.logged) { u.logged = true; u.firstOk = false; logAnswer(pid, u.sel || '', false); }
        render();
      } else if (a === 'rate') {
        u.rated = b.dataset.r; u.text = (document.getElementById('zp-frq') || {}).value || u.text;
        logAnswer(pid, u.text, u.rated === 'got'); render();
      }
    };
    host.onchange = function (e) {
      var pid = ids[i];
      if (e.target.id === 'zp-frq') st(pid).text = e.target.value;
    };
    // Keyboard (keys come from Profile > Settings). Works anywhere except while typing. Next / previous / close in the Browse window
    // are handled by that window, so the runner only takes them when it is not inside one.
    function onKey(e) {
      var K = root.ZPSettings; if (!K || e.repeat || K.typingTarget(e.target) || document.querySelector('.zp-lightbox')) return;
      var Q = data.byId[ids[i]], hit = null;
      ['A', 'B', 'C', 'D'].forEach(function (L) { if (!hit && K.keyMatch(e, 'choose' + L)) hit = host.querySelector('[data-choice="' + L + '"]'); });
      // Enter on a focused answer choice means "check", not "pick it again"; on any other button or link it keeps its own meaning.
      var tg = e.target && e.target.closest ? e.target.closest('button, a') : null;
      if (!hit && K.keyMatch(e, 'check')) hit = !tg || tg.classList.contains('zp-choice') ? host.querySelector('[data-act="check"]') : null;
      if (!hit && K.keyMatch(e, 'reveal')) hit = host.querySelector('[data-act="reveal"]');
      if (!hit && K.keyMatch(e, 'flag')) hit = host.querySelector('[data-qt="flag"]');
      if (!hit && !opts.popup && K.keyMatch(e, 'next')) hit = host.querySelector('[data-act="next"]');
      if (!hit && !opts.popup && K.keyMatch(e, 'prev')) hit = host.querySelector('[data-act="prev"]');
      if (hit && !hit.disabled && Q) { e.preventDefault(); hit.click(); }
    }
    document.addEventListener('keydown', onKey);
    UI.bindEntryForms(host);
    if (root.ZPFrqAns) root.ZPFrqAns.bind(host, { store: store, derive: opts.derive, onChange: function () { render(); if (opts.onChange) opts.onChange(); } });
    UI.bindTools(host, { store: store, derive: opts.derive, chOf: function (id) { return data.byId[id] ? data.byId[id].chapter : ''; }, rerender: function () { render(); if (opts.onChange) opts.onChange(); } });
    render();
    return { cleanup: function () { clearInterval(timer); document.removeEventListener('keydown', onKey); } };
  }

  root.ZPRun = { mount: mount };
})(window);
