/* AP-format mock exam runner: fixed question set, sections with their own timers, no going back to a
 * finished section, an untimed break between sections, free-response questions worked on paper.
 * On finish it writes one t_submit (kind MOCK) that the results view (ZPTest) scores and reviews. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, esc = UI.esc;

  // opts: {host, store, data, derive(), exam, mock, title, onDone(subId), onExit()}
  function mount(opts) {
    var host = opts.host, store = opts.store, data = opts.data, exam = opts.exam, mock = opts.mock;
    var key = 'zenith:zp:v1:' + store.username + ':' + store.course + ':active:mock:' + mock.id;
    var secs = exam.sections.filter(function (s) { return mock.sections[s.id]; });
    var att = null, timer = null;
    try { att = JSON.parse(localStorage.getItem(key)); } catch (e) { att = null; }
    function persist() { try { localStorage.setItem(key, JSON.stringify(att)); } catch (e) { /* blocked */ } }
    function clear() { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } att = null; }
    function q(id) { return data.byId[id]; }
    function sec() { return secs[att.si]; }
    function pidsOf(s) { return mock.sections[s.id]; }
    function flush() {
      if (!att || att.phase !== 'section' || sec().kind !== 'mcq') return;
      var pid = pidsOf(sec())[att.cursor]; att.ms[pid] = (att.ms[pid] || 0) + (Date.now() - att.qStart); att.qStart = Date.now();
    }

    /* ---------- rules ---------- */
    function rules() {
      clearInterval(timer);
      var total = secs.reduce(function (n, s) { return n + s.minutes; }, 0);
      host.innerHTML = '<section class="zp-panel"><p class="zp-eyebrow">' + esc(exam.name) + '</p><h2>' + esc(mock.name) + '</h2>' +
        '<table class="zp-table"><thead><tr><th>Section</th><th>Questions</th><th>Time</th></tr></thead><tbody>' + secs.map(function (s) {
          return '<tr><td>' + esc(s.name) + '</td><td>' + pidsOf(s).length + ' ' + (s.kind === 'mcq' ? 'multiple choice' : 'free response') + '</td><td>' + s.minutes + ' min</td></tr>'; }).join('') + '</tbody></table>' +
        '<p><b>Total ' + total + ' minutes.</b> Rules, like the real exam:</p><ul class="zp-signals">' +
        '<li>Each section has its own timer. When it ends, the section closes and you cannot go back.</li>' +
        '<li>There is no feedback until you finish everything.</li>' +
        '<li>Free-response questions are worked on paper. Have paper and a pencil ready.</li>' +
        '<li>Between sections you can take a break. The next timer starts only when you press start.</li></ul>' +
        (exam.notes || []).map(function (n) { return '<p class="zp-muted">' + esc(n) + '</p>'; }).join('') +
        ((exam.sections.some(function (s) { return !s.available; })) ? '<p class="zp-banner">Some sections of the real exam are not available for this course yet, so this mock is shorter.</p>' : '') +
        '<div class="zp-row">' + UI.btn('Start ' + esc(secs[0].name.split(':')[0]), 'begin', 'primary') + (opts.onExit ? UI.btn('Back', 'exit') : '') + '</div></section>';
    }
    function startSection(si) {
      var now = Date.now(), s = secs[si];
      att = att && att.ms ? att : { ms: {}, answers: {}, flags: {}, startedAt: now, usedSec: 0 };
      att.phase = 'section'; att.si = si; att.cursor = 0; att.qStart = now; att.sectionStart = now; att.deadline = now + s.minutes * 60000;
      persist(); render();
    }

    /* ---------- section ---------- */
    function sectionView() {
      var s = sec(), ids = pidsOf(s), left = Math.ceil((att.deadline - Date.now()) / 1000);
      var head = '<div class="zp-runbar"><div><span class="zp-eyebrow">' + esc(mock.name) + '</span><h2 style="margin:0">' + esc(s.name) + '</h2></div><span class="zp-timer" id="zp-timer" role="timer">' + UI.mmss(left) + '</span>' + UI.btn('End section', 'end', 'primary') + '</div>';
      if (s.kind === 'frq') {
        host.innerHTML = head + '<section class="zp-panel"><p class="zp-muted">Work on paper. You will compare with the solutions and score yourself at the end.</p>' +
          ids.map(function (id, i) { return '<article class="zp-card"><header><b>Question ' + (i + 1) + '</b></header>' + UI.stemHTML(q(id)) + '</article>'; }).join('') + '</section>';
      } else {
        var p = ids[att.cursor], Q = q(p), a = att.answers[p] || '';
        var map = ids.map(function (id, i) { return '<button type="button" class="zp-qdot' + (i === att.cursor ? ' cur' : '') + (att.answers[id] ? ' ans' : '') + (att.flags[id] ? ' flag' : '') + '" data-act="jump" data-i="' + i + '" aria-label="Question ' + (i + 1) + '">' + (i + 1) + '</button>'; }).join('');
        var n = ids.filter(function (id) { return att.answers[id]; }).length;
        host.innerHTML = head + '<div class="zp-runbody"><aside class="zp-panel"><p class="zp-label">' + n + ' / ' + ids.length + ' answered</p><div class="zp-qmap">' + map + '</div></aside>' +
          '<section class="zp-panel"><p class="zp-label">Question ' + (att.cursor + 1) + ' of ' + ids.length + (s.calculator === null ? ' <span class="zp-badge ' + (Q.calc === 'yes' ? 'warn' : '') + '">' + (Q.calc === 'yes' ? 'Calculator allowed' : 'No calculator') + '</span>' : '') + '</p>' + UI.stemHTML(Q) + UI.choicesHTML(Q, { selected: a }) +
          '<div class="zp-row">' + UI.btn('← Previous', 'prev', '', att.cursor === 0 ? 'disabled' : '') + UI.btn(att.flags[p] ? 'Unflag' : 'Flag for later', 'flag') +
          UI.btn('Next →', 'next', '', att.cursor === ids.length - 1 ? 'disabled' : '') + '</div></section></div>';
      }
      UI.renderMath(host);
      clearInterval(timer);
      function tick() {
        if (!att || att.phase !== 'section') { clearInterval(timer); return; }
        var l = Math.ceil((att.deadline - Date.now()) / 1000), el = document.getElementById('zp-timer');
        if (el) { el.textContent = UI.mmss(l); el.classList.toggle('low', l <= 300); }
        if (l <= 0) { clearInterval(timer); endSection(true); }
      }
      tick(); timer = setInterval(tick, 1000);
    }
    function endSection(auto) {
      if (!att || att.phase !== 'section') return;
      var s = sec();
      if (!auto && !confirm('End ' + s.name.split(':')[0] + '? You cannot come back to it.')) return;
      flush(); clearInterval(timer);
      att.usedSec += Math.round((Math.min(Date.now(), att.deadline) - att.sectionStart) / 1000);
      if (att.si < secs.length - 1) { att.phase = 'break'; persist(); render(); } else finish();
    }
    function breakView() {
      var done = secs[att.si], next = secs[att.si + 1];
      host.innerHTML = '<section class="zp-panel"><p class="zp-eyebrow">' + esc(mock.name) + '</p><h2>' + esc(done.name.split(':')[0]) + ' complete</h2>' +
        '<p>Take a break if you want one. The timer for <b>' + esc(next.name) + '</b> (' + next.minutes + ' min) starts only when you press the button.</p>' +
        '<div class="zp-row">' + UI.btn('Start ' + esc(next.name.split(':')[0]), 'next-section', 'primary') + '</div></section>';
    }

    /* ---------- finish ---------- */
    function finish() {
      var result = {}, chOf = {}, correct = 0, graded = 0, mcqPids = [], frqPids = [];
      secs.forEach(function (s) {
        pidsOf(s).forEach(function (id) {
          chOf[id] = q(id).chapter;
          if (s.kind === 'frq') { frqPids.push(id); return; }
          mcqPids.push(id);
          var g = root.ZenithPractice.grade(q(id), att.answers[id]); result[id] = g;
          if (g === 'correct') { correct++; graded++; } else if (g === 'incorrect' || g === 'unanswered') graded++;
        });
      });
      var sections = secs.map(function (s) { return { id: s.id, name: s.name, kind: s.kind, minutes: s.minutes, pids: pidsOf(s) }; });
      var sub = store.append('t_submit', { ch: '', kind: 'MOCK', attempt: ZP.uid(), mockId: mock.id, title: mock.name, pids: mcqPids, answers: att.answers, ms: att.ms, flags: att.flags,
        result: result, chOf: chOf, minutes: secs.reduce(function (n, s) { return n + s.minutes; }, 0), usedSec: att.usedSec, score: { correct: correct, total: graded },
        sections: sections, frqPids: frqPids, spec: { scoring: exam.scoring } });
      clear(); clearInterval(timer);
      if (opts.onDone) opts.onDone(sub.id);
    }

    function render() {
      clearInterval(timer);
      if (!att) rules();
      else if (att.phase === 'break') breakView();
      else if (att.phase === 'section') { if (Date.now() >= att.deadline) endSection(true); else sectionView(); }
      else rules();
    }
    host.onclick = function (e) {
      var c = e.target.closest('[data-choice]');
      if (c && att && att.phase === 'section' && sec().kind === 'mcq') {
        if (Date.now() >= att.deadline) return endSection(true);
        var pid = pidsOf(sec())[att.cursor]; att.answers[pid] = att.answers[pid] === c.dataset.choice ? '' : c.dataset.choice; persist(); return sectionView();
      }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = b.dataset.act;
      if (a === 'begin') { att = null; startSection(0); }
      else if (a === 'exit') { if (opts.onExit) opts.onExit(); }
      else if (a === 'next-section') startSection(att.si + 1);
      else if (a === 'end') endSection(false);
      else if (att && att.phase === 'section' && sec().kind === 'mcq' && ['prev', 'next', 'jump', 'flag'].indexOf(a) >= 0) {
        if (Date.now() >= att.deadline) return endSection(true);
        flush(); var ids = pidsOf(sec());
        if (a === 'prev') att.cursor = Math.max(0, att.cursor - 1);
        else if (a === 'next') att.cursor = Math.min(ids.length - 1, att.cursor + 1);
        else if (a === 'jump') att.cursor = +b.dataset.i;
        else { var p = ids[att.cursor]; att.flags[p] = !att.flags[p]; }
        persist(); sectionView();
      }
    };
    host.onchange = null;
    if (att && att.phase === 'section') att.qStart = Date.now();
    render();
    return { cleanup: function () { clearInterval(timer); } };
  }

  root.ZPMock = { mount: mount };
})(window);
