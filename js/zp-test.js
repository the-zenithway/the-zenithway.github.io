/* Timed test runner + results + miss review. Used by the chapter T stage and by Mocks.
 * T = one chapter's T problems; MOCK = a cumulative set drawn across chapters. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc;

  // Suggested minutes for a set of problems: AP pace when the problems carry a calculator tag (2 min no calculator, 3 min calculator),
  // otherwise MIN_PER_QUESTION each. Always a multiple of 5.
  function paceMinutes(pids, byId) {
    var m = 0;
    (pids || []).forEach(function (id) { var q = byId && byId[id]; m += q && q.calc === 'yes' ? CFG.PACE_CALC_MIN : q && q.calc === 'no' ? CFG.PACE_NOCALC_MIN : CFG.MIN_PER_QUESTION; });
    return Math.max(5, roundTo5(m));
  }
  function roundTo5(n) { return Math.max(5, Math.round(n / 5) * 5); }
  function apEstimate(correct, total) {
    if (!total) return null;
    var pct = correct / total, t = CFG.AP_ESTIMATE;
    for (var i = 0; i < t.length; i++) if (pct >= t[i][0]) return t[i][1];
    return 1;
  }


  // Sectioned mock (AP format): per-section breakdown, FRQ self-scoring, and a composite estimate.
  function composite(s, D) {
    var sc = (s.spec && s.spec.scoring) || null; if (!sc || sc.noEstimate) return null; // a partial test (a checkpoint) gets no AP estimate
    var nF = (s.frqPids || []).length, scored = {}, pts = 0, got = 0;
    ((D.frqScores[s.id]) ? Object.keys(D.frqScores[s.id]) : []).forEach(function (pid) { scored[pid] = 1; pts += +D.frqScores[s.id][pid] || 0; got++; });
    var mcq = s.score.total ? s.score.correct / s.score.total : 0;
    var frqDone = !nF || got >= nF, pct;
    if (!nF) pct = mcq; else if (frqDone) pct = sc.mcqWeight * mcq + sc.frqWeight * (pts / (nF * sc.frqMaxEach)); else pct = mcq;
    var est = 1; for (var i = 0; i < sc.bands.length; i++) { if (pct >= sc.bands[i][0]) { est = sc.bands[i][1]; break; } }
    return { pct: pct, est: est, complete: frqDone, scored: got, nF: nF, pts: pts, mcq: mcq };
  }
  function sc0(s) { return (s.spec && s.spec.scoring) || {}; }
  function compositeHTML(s, D) {
    var c = composite(s, D); if (!c) return '';
    return '<p id="zp-composite"><b>Rough AP estimate: ' + c.est + '</b> <span class="zp-muted">' + Math.round(100 * c.pct) + '% composite' +
      (c.complete ? '' : (sc0(s).mcqWeight ? ' (multiple choice only; score your free-response questions below for the full estimate)' : ' (score all your free-response questions below for the estimate)')) + '. Cut scores change every year, so treat this as a direction.</span></p>';
  }
  function sectionRows(s, D) {
    return s.sections.map(function (sec) {
      if (sec.kind === 'mcq') {
        var c = sec.pids.filter(function (id) { return s.result[id] === 'correct'; }).length;
        return '<tr><td>' + esc(sec.name) + '</td><td>' + c + ' / ' + sec.pids.length + '</td><td>' + sec.minutes + ' min</td></tr>';
      }
      var sc = D.frqScores[s.id] || {}, n = sec.pids.filter(function (id) { return sc[id] !== undefined; }).length;
      return '<tr><td>' + esc(sec.name) + '</td><td>' + n + ' / ' + sec.pids.length + ' scored</td><td>' + sec.minutes + ' min</td></tr>';
    }).join('');
  }
  function mockExtras(s, D, byId) {
    if (!s.sections) return '';
    var rows = sectionRows(s, D);
    var max = (s.spec && s.spec.scoring && s.spec.scoring.frqMaxEach) || 9;
    var frq = (s.frqPids || []).map(function (id, i) {
      var Q = byId[id], v = (D.frqScores[s.id] || {})[id], by = D.frqScoreBy && D.frqScoreBy[s.id + '|' + id], ask = D.frqAsk && D.frqAsk[s.id + '|' + id];
      // Three states, never "wrong": not scored yet, self-scored, mentor-scored (final). Only a score ever becomes right or wrong.
      var badge = by ? '<span class="zp-badge ok">Scored by ' + esc(UI.mentorName()) + '</span>' : ask && ask.status === 'waiting' ? '<span class="zp-badge warn">With ' + esc(UI.mentorName()) + '</span>' : v === undefined ? '<span class="zp-badge">Not scored yet</span>' : '<span class="zp-badge">Self-scored</span>';
      return '<article class="zp-card"><header><b>Free response ' + (i + 1) + '</b> ' + badge + '<span class="zp-muted">' + esc(UI.shortStem(Q, 80)) + '</span></header>' +
        '<div class="zp-row"><button type="button" class="zp-btn" data-copy-question="' + esc(id) + '" title="Copies the question with its LaTeX, ready to paste">Copy question (LaTeX)</button></div>' +
        '<details><summary>Problem and solution</summary>' + UI.stemHTML(Q) + UI.solutionHTML(Q) + '</details>' +
        (root.ZPFrqAns ? root.ZPFrqAns.panelHTML(D, { aid: s.id, pid: id, ch: (s.chOf || {})[id] || '', where: s.title || 'a mock' }) : '') +
        '<label class="zp-field inline"><span>' + (by ? 'Final score from ' + esc(UI.mentorName()) : 'Your score') + ' (0 to ' + max + ')</span><input type="number" min="0" max="' + max + '" step="1" data-frq="' + esc(id) + '" value="' + (v === undefined ? '' : esc(v)) + '"' + (by ? ' disabled' : '') + '></label></article>';
    }).join('');
    return '<section class="zp-panel"><h2>Sections</h2><table class="zp-table"><thead><tr><th>Section</th><th>Result</th><th>Time</th></tr></thead><tbody id="zp-secrows">' + rows + '</tbody></table>' + compositeHTML(s, D) + '</section>' +
      (frq ? '<section class="zp-panel"><h2>Score your free response</h2><p>Compare your paper work with the solution and give yourself the points a grader would. Be strict; the estimate is only as honest as these scores.</p>' + (D.info && D.info.selfStudy ? '' : '<p class="zp-muted">Want it graded? Attach a photo or type your answer under a question and ask ' + esc(UI.mentorName()) + ' for feedback. Their score replaces yours and is final. Until a question has a score it is not counted at all, right or wrong.</p>') + frq + '</section>' : '');
  }

  // opts: {host, store, data, derive(), kind, ch, pids, title, banner, defaultMinutes, onChange(), openSub, minutes, mockId, sections, frqPids, spec, sessionKey, onAgain}
  function mount(opts) {
    var host = opts.host, store = opts.store, data = opts.data, kind = opts.kind, ch = opts.ch || '';
    var sessionKey = opts.sessionKey || (kind === 'MOCK' ? 'MOCK' : kind === 'TEST' ? 'TEST' : 'T' + ch);
    var activeKey = 'zenith:zp:v1:' + store.username + ':' + store.course + ':active:' + sessionKey;
    var LABEL = kind === 'MOCK' ? 'Mock' : kind === 'TEST' ? 'Test' : 'Chapter ' + ch + ' test';
    var att = null, timer = null, mode = 'start', sub = null;
    try { att = JSON.parse(localStorage.getItem(activeKey)); } catch (e) { att = null; }
    if (att && (!att.pids || !att.pids.length)) att = null;

    function persist() { try { localStorage.setItem(activeKey, JSON.stringify(att)); } catch (e) { /* storage blocked */ } }
    function clearActive() { try { localStorage.removeItem(activeKey); } catch (e) { /* ignore */ } att = null; }
    function q(pid) { return data.byId[pid]; }
    function changed() { if (opts.onChange) opts.onChange(); }
    function flushTime() {
      if (!att) return;
      var pid = att.pids[att.cursor];
      att.ms[pid] = (att.ms[pid] || 0) + (Date.now() - att.qStart);
      att.qStart = Date.now();
    }
    function latestSub() {
      if (opts.openSub) return store.events().filter(function (e) { return e.id === opts.openSub; })[0] || null;
      var D = opts.derive();
      if (kind === 'TEST') return D.customTests[D.customTests.length - 1] || null;
      if (kind === 'MOCK') { var ms = opts.mockId ? D.mocks.filter(function (m) { return m.mockId === opts.mockId; }) : D.mocks; return ms[ms.length - 1] || null; }
      var l = D.tests[ch] || []; return l[l.length - 1] || null;
    }

    /* ---------- start ---------- */
    function startView() {
      var last = latestSub(), n = opts.pids.length;
      if (kind === 'T' && last) {
        host.innerHTML = '<section class="zp-panel"><p class="zp-eyebrow">' + esc(LABEL) + '</p><h2>' + esc(opts.title) + '</h2><p>You have already taken this test: <b>' + last.score.correct + ' / ' + last.score.total +
          '</b>. A chapter test is one shot, so the review is where the learning happens. Review it, then use the Trainer or a custom Test for fresh sets.</p>' +
          '<div class="zp-row">' + UI.btn('See results and review', 'results', 'primary') + '<a class="zp-btn" href="practice.html?course=' + encodeURIComponent(store.course) + '#practice">Go to the Trainer</a></div></section>';
        return;
      }
      var mins = opts.defaultMinutes || paceMinutes(opts.pids, data.byId), longWarn = mins > (CFG.LONG_TEST_MIN || 90);
      host.innerHTML = '<section class="zp-panel">' +
        '<p class="zp-eyebrow">' + esc(LABEL) + '</p><h2>' + esc(opts.title) + '</h2>' +
        (opts.banner || '') +
        '<p>' + n + ' multiple-choice problems. No feedback until you submit. Your answer is saved as you go, and the timer keeps running if you leave the page.</p>' +
        '<label class="zp-field inline"><span>Time (minutes)</span><input type="number" id="zp-minutes" min="5" max="240" value="' + mins + '"></label>' +
        '<p class="zp-muted">Suggested ' + paceMinutes(opts.pids, data.byId) + ' min, at AP pace (2 min per no-calculator question, 3 per calculator question). Keep your work on paper.</p>' +
        (longWarn ? '<p class="zp-banner">This is a long sitting (' + n + ' questions). You can lower the minutes, but a test this size is easier to take in two sittings with a custom Test from Browse.</p>' : '') +
        '<div class="zp-row">' + UI.btn('Start timed ' + (kind === 'MOCK' ? 'mock' : 'test'), 'start', 'primary') +
        (last ? UI.btn('See last results · ' + last.score.correct + '/' + last.score.total, 'results') : '') + '</div></section>';
    }
    function begin(minutesOverride) {
      var m = typeof minutesOverride === 'number' ? minutesOverride : +document.getElementById('zp-minutes').value;
      if (!(m >= 5 && m <= 240)) { var inp = document.getElementById('zp-minutes'); if (inp) inp.reportValidity(); return; }
      if (kind === 'T' && latestSub()) { mode = 'start'; return render(); } // one shot per chapter test
      var now = Date.now();
      att = { aid: ZP.uid(), ch: ch, kind: kind, pids: opts.pids.slice(), answers: {}, flags: {}, ms: {}, cursor: 0, startedAt: now, minutes: m, deadline: now + m * 60000, qStart: now };
      persist(); mode = 'run'; render();
    }

    /* ---------- run ---------- */
    function runView() {
      var p = att.pids[att.cursor], Q = q(p), a = att.answers[p] || '';
      var map = att.pids.map(function (id, i) {
        return '<button type="button" class="zp-qdot' + (i === att.cursor ? ' cur' : '') + (att.answers[id] ? ' ans' : '') + (att.flags[id] ? ' flag' : '') + '" data-act="jump" data-i="' + i + '" aria-label="Question ' + (i + 1) + '">' + (i + 1) + '</button>';
      }).join('');
      var answered = att.pids.filter(function (id) { return att.answers[id]; }).length;
      host.innerHTML = '<div class="zp-run">' +
        '<div class="zp-runbar"><span class="zp-eyebrow">' + esc(LABEL) + '</span>' +
        '<span class="zp-timer" id="zp-timer" role="timer">--:--</span>' + UI.btn('Submit', 'submit', 'primary') + '</div>' +
        '<div class="zp-runbody"><aside class="zp-panel"><p class="zp-label">' + answered + ' / ' + att.pids.length + ' answered</p><div class="zp-qmap">' + map + '</div><p class="zp-muted">Dot = flagged for later.</p></aside>' +
        '<section class="zp-panel"><p class="zp-label">Question ' + (att.cursor + 1) + ' of ' + att.pids.length + '</p>' + UI.stemHTML(Q) + UI.choicesHTML(Q, { selected: a }) +
        '<div class="zp-row">' + UI.btn('← Previous', 'prev', '', att.cursor === 0 ? 'disabled' : '') + UI.btn(att.flags[p] ? 'Unflag' : 'Flag for later', 'flag') +
        UI.btn('Next →', 'next', '', att.cursor === att.pids.length - 1 ? 'disabled' : '') + '</div></section></div></div>';
      UI.renderMath(host); tick();
    }
    function tick() {
      clearInterval(timer);
      var el = document.getElementById('zp-timer'); if (!el || !att) return;
      function upd() {
        if (!att) { clearInterval(timer); return; }
        var left = Math.ceil((att.deadline - Date.now()) / 1000);
        var t = document.getElementById('zp-timer'); if (t) { t.textContent = UI.mmss(left); t.classList.toggle('low', left <= 300); }
        if (left <= 0) { clearInterval(timer); submit(true); }
      }
      upd(); timer = setInterval(upd, 1000);
    }
    function submit(auto) {
      if (!att) return;
      var left = att.pids.filter(function (id) { return !att.answers[id]; }).length;
      if (!auto && !confirm(left ? left + ' unanswered. Submit now?' : 'Submit your test?')) return;
      flushTime(); clearInterval(timer);
      var result = {}, chOf = {}, correct = 0, graded = 0;
      att.pids.forEach(function (id) {
        var g = root.ZenithPractice.grade(q(id), att.answers[id]);
        result[id] = g; chOf[id] = q(id).chapter;
        if (g === 'correct') { correct++; graded++; } else if (g === 'incorrect' || g === 'unanswered') graded++;
      });
      var used = Math.min(att.minutes * 60, Math.round((Date.now() - att.startedAt) / 1000));
      sub = store.append('t_submit', { ch: ch, kind: kind, attempt: att.aid, mockId: opts.mockId || '', title: opts.title || '', sections: opts.sections || null, frqPids: opts.frqPids || null, spec: opts.spec || null, pids: att.pids, answers: att.answers, ms: att.ms, flags: att.flags,
        result: result, chOf: chOf, minutes: att.minutes, usedSec: used, score: { correct: correct, total: graded } });
      clearActive(); mode = 'result'; changed(); render();
    }

    /* ---------- results + review ---------- */
    // Misses (and, in a mock, free-response questions scored below 75%) are written up on the shared entry screen:
    // R (test) for a chapter test, Notebook > Inbox otherwise.
    function reviewBoxHTML(s, D, href) {
      var list = s.pids.filter(function (id) { return s.result[id] === 'incorrect' || s.result[id] === 'unanswered'; });
      (s.frqPids || []).forEach(function (id) { if (D.entries[id] && list.indexOf(id) < 0) list.push(id); });
      var written = list.filter(function (id) { var en = D.entries[id]; return en && en.complete; }).length;
      var frqPending = (s.frqPids || []).length && !(s.frqPids || []).every(function (id) { return (D.frqScores[s.id] || {})[id] !== undefined; });
      if (list.length) return '<p>' + list.length + ' miss' + (list.length > 1 ? 'es' : '') + ' to write up (' + written + ' done). For each one you pick <b>Careless</b> or <b>Actual</b> and write what happened.</p>' +
        '<p class="zp-muted">' + list.map(function (id) { var en = D.entries[id]; return UI.codeBadge(q(id)) + ' ' + (en && en.complete ? '✓' : '○'); }).join(' &nbsp; ') + '</p>' +
        '<div class="zp-row"><a class="zp-btn primary" href="' + esc(href) + '">' + (written === list.length ? 'Open the review' : 'Write your entries →') + '</a></div>';
      return (frqPending ? '<p class="zp-muted">Score your free-response questions above. Any scored below 75% come here to be written up.</p>' : '<p>No misses. Nothing to write up.</p>') +
        (opts.reviewHref ? '<div class="zp-row"><a class="zp-btn primary" href="' + esc(href) + '">Continue →</a></div>' : '');
    }
    function resultView() {
      var s = sub || latestSub(); if (!s) { mode = 'start'; return render(); }
      sub = s;
      var D = opts.derive(), pct = s.score.total ? Math.round(100 * s.score.correct / s.score.total) : 0;
      var misses = s.pids.filter(function (id) { return s.result[id] === 'incorrect' || s.result[id] === 'unanswered'; });
      var secs = s.pids.map(function (id) { return Math.round((s.ms[id] || 0) / 1000); });
      var total = secs.reduce(function (x, y) { return x + y; }, 0), avg = s.pids.length ? Math.round(total / s.pids.length) : 0;
      var slow = s.pids.map(function (id, i) { return { n: i + 1, sec: secs[i], bad: misses.indexOf(id) >= 0 }; })
        .filter(function (x) { return x.sec > CFG.OVERTIME_SEC; }).sort(function (a, b) { return b.sec - a.sec; }).slice(0, 6);
      // accuracy by thirds shows fatigue / pacing problems
      var th = [0, 1, 2].map(function (k) {
        var lo = Math.floor(s.pids.length * k / 3), hi = Math.floor(s.pids.length * (k + 1) / 3), c = 0, g = 0;
        s.pids.slice(lo, hi).forEach(function (id) { var r = s.result[id]; if (r === 'correct') { c++; g++; } else if (r === 'incorrect' || r === 'unanswered') g++; });
        return g ? Math.round(100 * c / g) + '%' : '–';
      });
      var est = kind === 'MOCK' && !s.spec ? apEstimate(s.score.correct, s.score.total) : null;
      // Misses are written up on the shared entry screen (R (test) for a chapter test, Notebook › Inbox otherwise).
      var href = opts.reviewHref || ('notebook.html?course=' + encodeURIComponent(opts.courseId || '') + '&view=inbox');
      var reviewBox = reviewBoxHTML(s, D, href);
      host.innerHTML = UI.mentorFeedbackHTML(D, s.id) + '<section class="zp-panel zp-score"><p class="zp-eyebrow">' + esc(LABEL) + ' results' + '</p>' +
        (!s.score.total && (s.frqPids || []).length ? '<h2>Free-response exam</h2>' : '<h2>' + s.score.correct + ' / ' + s.score.total + ' <small>' + pct + '%</small></h2>') +
        (est ? '<p><b>Rough AP estimate: ' + est + '</b> <span class="zp-muted">from multiple-choice accuracy only. A direction, not a prediction.</span></p>' : '') +
        '<div class="zp-stats"><div><b>' + UI.mmss(s.usedSec || total) + '</b><span>of ' + s.minutes + ':00 used</span></div><div><b>' + avg + 's</b><span>average per question</span></div>' +
        '<div><b>' + th.join(' · ') + '</b><span>accuracy: first · middle · last third</span></div></div>' +
        (slow.length ? '<p class="zp-label">Slowest questions (over ' + CFG.OVERTIME_SEC + 's)</p><p>' + slow.map(function (x) { return '#' + x.n + ' (' + x.sec + 's' + (x.bad ? ', missed' : '') + ')'; }).join(' · ') + '</p>' : '') +
        '<div class="zp-row">' + (kind === 'TEST' ? UI.btn('Build another test', 'again') : '') + (kind === 'MOCK' && !(D.info && D.info.selfStudy) ? UI.btn(D.debrief[s.id] ? 'Debrief requested ✓' : 'Request a debrief with my teacher', 'debrief', '', D.debrief[s.id] ? 'disabled' : '') : '') + '</div></section>' +
        mockExtras(s, D, data.byId) + '<section class="zp-panel" id="zp-reviewbox"><h2>Review your misses</h2>' + reviewBox + '</section>';
      UI.renderMath(host);
    }
    function render() {
      clearInterval(timer);
      if (att && mode !== 'result') mode = 'run';
      if (mode === 'run' && att) runView();
      else if (mode === 'result') resultView();
      else startView();
    }

    host.onclick = function (e) {
      var c = e.target.closest('[data-choice]');
      if (c && mode === 'run' && att) {
        var pid = att.pids[att.cursor]; att.answers[pid] = att.answers[pid] === c.dataset.choice ? '' : c.dataset.choice;
        if (Date.now() >= att.deadline) return submit(true);
        persist(); return runView();
      }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var act = b.dataset.act;
      if (act === 'start') begin();
      else if (act === 'results') { mode = 'result'; sub = null; render(); }
      else if (act === 'again') {
        if (kind === 'MOCK' && opts.onAgain) return opts.onAgain();
        sub = null; mode = 'start'; opts.openSub = null; render();
      }
      else if (att && ['prev', 'next', 'jump', 'flag', 'submit'].indexOf(act) >= 0) {
        if (Date.now() >= att.deadline) return submit(true);
        if (act === 'submit') return submit(false);
        flushTime();
        if (act === 'prev') att.cursor = Math.max(0, att.cursor - 1);
        else if (act === 'next') att.cursor = Math.min(att.pids.length - 1, att.cursor + 1);
        else if (act === 'jump') att.cursor = +b.dataset.i;
        else if (act === 'flag') { var p = att.pids[att.cursor]; att.flags[p] = !att.flags[p]; }
        persist(); runView();
      } else if (act === 'debrief') {
        store.append('debrief_req', { aid: sub.id });
        store.append('msg', { from: 'student', kind: 'debrief', text: 'Requested a debrief for ' + (sub.title || 'this mock') + ' (' + sub.score.correct + ' / ' + sub.score.total + ' multiple choice).', ref: 'debrief:' + sub.id, refLabel: sub.title || 'Mock' });
        changed(); render();
      }
    };
    host.onchange = function (e) {
      var inp = e.target.closest && e.target.closest('[data-frq]'); if (!inp || !sub) return;
      var max = (sub.spec && sub.spec.scoring && sub.spec.scoring.frqMaxEach) || 9, v = Math.max(0, Math.min(max, Math.round(+inp.value || 0)));
      inp.value = v; store.append('frq_score', { aid: sub.id, pid: inp.dataset.frq, score: v });
      var dd = opts.derive(), el = document.getElementById('zp-composite'); if (el) el.outerHTML = compositeHTML(sub, dd);
      var tb = document.getElementById('zp-secrows'); if (tb && sub.sections) tb.innerHTML = sectionRows(sub, dd);
      var rb = document.getElementById('zp-reviewbox');
      if (rb) { rb.innerHTML = '<h2>Review your misses</h2>' + reviewBoxHTML(sub, dd, opts.reviewHref || ('notebook.html?course=' + encodeURIComponent(opts.courseId || '') + '&view=inbox')); UI.renderMath(rb); }
      changed();
    };
    host.oninput = null;
    if (root.ZPFrqAns) root.ZPFrqAns.bind(host, { store: store, derive: opts.derive, onChange: function () { changed(); render(); } });
    if (opts.openSub) { mode = 'result'; }
    if (opts.minutes && !att && mode === 'start') { begin(opts.minutes); return { render: render }; }
    render();
    return { render: render };
  }

  root.ZPTest = { mount: mount, apEstimate: apEstimate, roundTo5: roundTo5, paceMinutes: paceMinutes };
})(window);
