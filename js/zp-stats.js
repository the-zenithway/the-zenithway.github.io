/* Statistics: the streak and heatmap, accuracy by chapter and week, habits, calibration, review queue, practice history, mocks and tests.
 * Everything is derived from the student's event log (ZP.stats). Shown on the Profile page (profile.html). */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc;

  // main: element to fill; o: {D, info, head (html placed first)}
  function render(main, o) {
    var D = o.D, info = o.info, head = o.head || '', cid = encodeURIComponent(o.course || '');
  function pct(x) { return x == null ? '–' : Math.round(100 * x) + '%'; }
  function bar(x, cls) { return '<span class="zp-bar"><span class="zp-bar-fill ' + (cls || '') + '" style="width:' + (x == null ? 0 : Math.round(100 * x)) + '%"></span></span>'; }
  function statsView() {
    var st = ZP.stats(D, info), o = st.overall, q = st.queue;
    var tiles = [[o.seen, 'problems answered'], [pct(o.pct), 'accuracy'], [pct(o.hintPct), 'opened the answer'], [q.due, 'reviews due'], [pct(q.avgRetention), 'estimated retention'], [st.sessions.length, 'tests and mocks']];
    var setRows = Object.keys(st.bySet || {}).map(function (id) { var r = st.bySet[id]; if (!r.tried) return ''; return '<tr><td>' + esc(r.id) + ' · ' + esc(r.title) + '</td><td>' + r.tried + ' / ' + r.total + '</td><td>' + bar(r.pct, r.pct != null && r.pct < 0.6 ? 'low' : '') + ' ' + pct(r.pct) + '</td><td>–</td><td>–</td></tr>'; }).join('');
    var rows = st.order.map(function (c) {
      var r = st.byChapter[c]; if (!r.seen) return '';
      var weak = st.weak.indexOf(c) >= 0 && st.weak.indexOf(c) < 3;
      return '<tr><td>Ch ' + esc(c) + ' · ' + esc(r.title) + (weak ? ' <span class="zp-badge warn">weakest</span>' : '') + '</td><td>' + r.seen + '</td><td>' + bar(r.pct, r.pct != null && r.pct < 0.6 ? 'low' : '') + ' ' + pct(r.pct) + '</td><td>' + pct(r.hintPct) + '</td><td>' + (r.avgSec == null ? '–' : r.avgSec + 's') + '</td></tr>';
    }).join('') + setRows;
    var miss = [['Careless', st.miss.careless || 0], ['Actual', st.miss.actual || 0]];
    var maxMiss = Math.max(1, Math.max.apply(null, miss.map(function (m) { return m[1]; })));
    function acc(r) { return r && r.n ? Math.round(100 * r.right / r.n) + '% (' + r.right + ' / ' + r.n + ')' : '–'; }
    var DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    var forecast = UI.barsHTML(st.forecast.map(function (f, i) { var p = f.day.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return { label: i === 0 ? 'now' : DOW[d.getDay()] + ' ' + (+p[2]), n: f.n, tip: f.day + ': ' + f.n + ' due' }; }));
    var trend = UI.sparkHTML(st.trend.map(function (b, i) { return { label: i === st.trend.length - 1 ? 'this week' : (st.trend.length - 1 - i) + ' wk ago', v: b.pct }; }));
    var hist = st.history.slice(0, 20).map(function (h) { return '<tr><td>' + esc(h.day) + '</td><td>' + esc(h.what) + '</td><td>' + h.n + '</td><td>' + Math.round(100 * h.right / h.n) + '%</td><td>' + (h.ms ? Math.round(h.ms / h.n / 1000) + 's' : '–') + '</td></tr>'; }).join('');
    var mk = st.mocks.map(function (m) {
      var f = m.frqN ? m.frqPts + ' / ' + (m.frqN * m.frqMax) + (m.frqScored < m.frqN ? ' (' + m.frqScored + ' of ' + m.frqN + ' scored)' : '') : '–';
      return '<tr><td>' + UI.fmtDate(m.t) + '</td><td>' + esc(m.title) + '</td><td>' + (m.total ? m.correct + ' / ' + m.total : '–') + '</td><td>' + f + '</td><td>' + UI.mmss(m.usedSec) + ' of ' + m.minutes + ':00</td></tr>';
    }).join('');
    var tests = st.sessions.filter(function (s) { return s.kind !== 'MOCK'; }).slice(-10).reverse().map(function (s) {
      var f = s.total ? s.correct / s.total : 0, label = s.kind === 'TEST' ? 'Test' : 'Ch ' + s.ch + ' test';
      return '<tr><td>' + UI.fmtDate(s.t) + '</td><td>' + label + '</td><td>' + bar(f, f < 0.6 ? 'low' : '') + ' ' + s.correct + '/' + s.total + '</td></tr>';
    }).join('');
    // Habits: when you do your best work, how sure you were versus how right, speed, and how often a miss turns into a win.
    function habitsHTML() {
      var hrs = st.hours, active = hrs.reduce(function (a, h) { return a + h.n; }, 0); if (active < 10) return '';
      var hourBars = UI.barsHTML(hrs.map(function (h, i) { return { label: i % 3 === 0 ? String(i) : '', n: h.n, tip: i + ':00 · ' + h.n + ' answered, ' + (h.n ? Math.round(100 * h.right / h.n) : 0) + '% right' }; }));
      var DN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], dowBars = UI.barsHTML(st.dow.map(function (d, i) { return { label: DN[i], n: d.n, tip: DN[i] + ' · ' + d.n + ' answered, ' + (d.n ? Math.round(100 * d.right / d.n) : 0) + '% right' }; }));
      var cal = ['sure', 'ok', 'guess'].filter(function (k) { return st.calib[k]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + acc(st.calib[k]) + '</td></tr>'; }).join('');
      var weeks = UI.sparkHTML(st.studyWeeks.map(function (w, i) { return { label: i === st.studyWeeks.length - 1 ? 'this week' : (st.studyWeeks.length - 1 - i) + ' wk ago', v: Math.min(1, w.min / 300) }; }));
      var mix = st.order.filter(function (c) { return st.mixByCh[c]; }).map(function (c) { var m = st.mixByCh[c]; return '<tr><td>Ch ' + esc(c) + '</td><td>' + m.careless + ' careless</td><td>' + m.actual + ' actual</td></tr>'; }).join('');
      return '<div class="zp-twocol"><section class="zp-panel"><h2>When you work well</h2>' + hourBars + '<p class="zp-muted">Questions answered by hour of the day. Hover a bar for your accuracy at that hour.</p>' + dowBars + '</section>' +
        '<section class="zp-panel"><h2>Habits</h2><table class="zp-table"><tbody>' +
        '<tr><td>Study time, last 4 weeks (minutes)</td><td>' + st.studyWeeks.slice(-4).map(function (w) { return w.min; }).join(' · ') + '</td></tr>' +
        '<tr><td>Missed first, right later</td><td>' + (st.recover.missedFirst ? st.recover.gotLater + ' of ' + st.recover.missedFirst + ' (' + pct(st.recover.gotLater / st.recover.missedFirst) + ')' : '–') + '</td></tr>' +
        '<tr><td>Seconds per question (no calculator / calculator)</td><td>' + (st.speed.no == null ? '–' : st.speed.no + 's') + ' / ' + (st.speed.yes == null ? '–' : st.speed.yes + 's') + '</td></tr></tbody></table>' +
        '<p class="zp-muted">AP pace is about 120 seconds without a calculator and 180 with one. Recovering missed problems is what the review queue is for.</p></section></div>' +
        '<div class="zp-twocol"><section class="zp-panel"><h2>Do you know what you know?</h2>' + (cal ? '<table class="zp-table"><tbody>' + cal + '</tbody></table><p class="zp-muted">First-try accuracy by how sure you said you were. If "sure" is not clearly above "guess", slow down and check before you commit.</p>' : '<p class="zp-muted">Mark how sure you are when you answer and this fills in.</p>') + '</section>' +
        '<section class="zp-panel"><h2>Where slips and gaps happen</h2>' + (mix ? '<table class="zp-table"><tbody>' + mix + '</tbody></table><p class="zp-muted">Careless slips need checking habits; actual gaps need the idea. The chapter with the most of each tells you what to do.</p>' : '<p class="zp-muted">Appears as you write entries.</p>') + '</section></div>';
    }
    main.innerHTML = head +
      '<section class="zp-panel"><h2>Your streak</h2>' + UI.streakHTML(st) + UI.heatmapHTML(D.activity, 26) + '<p class="zp-muted">Every answer, redo, card review and entry fills a square. The darker the square, the more you did.</p></section>' +
      (o.seen ? '<div class="zp-stats">' + tiles.map(function (t) { return '<div><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('') + '</div>' : UI.emptyState('No stats yet', 'They appear as you answer problems, take tests, and review.', '<a class="zp-btn primary" href="practice.html?course=' + cid + '">Start practicing</a>')) +
      (o.seen ? '<div class="zp-twocol"><section class="zp-panel"><h2>Reviews due, next 14 days</h2>' + forecast + '<p class="zp-muted">Anything overdue counts under "now". Keep it near zero and the queue stays small.</p></section>' +
        '<section class="zp-panel"><h2>Accuracy, week by week</h2>' + trend + '<p class="zp-muted">First-try accuracy on practice, chapter problems, tests and mocks over the last 10 weeks. The dotted line is 50%.</p></section></div>' +
      '<section class="zp-panel"><h2>By chapter</h2><div class="zp-tablewrap"><table class="zp-table"><thead><tr><th>Chapter</th><th>Answered</th><th>Accuracy</th><th>Opened answer</th><th>Avg time</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="zp-muted">Accuracy counts your first try on practice problems plus every question on tests and mocks. "Weakest" needs at least 5 answers. Use <i>Bias toward weak topics</i> in Practice to work on them.</p></section>' +
      '<div class="zp-twocol"><section class="zp-panel"><h2>Calculator and free response</h2><table class="zp-table"><tbody><tr><td>No calculator</td><td>' + acc(st.byCalc.no) + '</td></tr><tr><td>Calculator</td><td>' + acc(st.byCalc.yes) + '</td></tr><tr><td>Multiple choice</td><td>' + acc(st.byType.mcq) + '</td></tr><tr><td>Free response</td><td>' + acc(st.byType.frq) + '</td></tr></tbody></table><p class="zp-muted">First-try accuracy. A big gap between calculator and no-calculator shows what to practise.</p></section>' +
      '<section class="zp-panel"><h2>Careless or actual</h2>' + miss.map(function (m) { return '<div class="zp-misrow"><span>' + esc(m[0]) + '</span>' + bar(m[1] / maxMiss, '') + '<b>' + m[1] + '</b></div>'; }).join('') +
      '<p class="zp-muted">Careless means you knew it and slipped; Actual means you did not see the idea. Mostly careless: slow down and check. Mostly actual: study the ideas in the Idea Notebook.</p></section></div>' +
      (o.seen ? habitsHTML() : '') +
      '<section class="zp-panel"><h2>Review queue</h2><div class="zp-stats"><div><b>' + q.total + '</b><span>entries</span></div><div><b>' + q.needsNote + '</b><span>to write</span></div><div><b>' + q.shaky + '</b><span>still shaky</span></div><div><b>' + q.resolved + '</b><span>resolved</span></div></div>' +
      '<p class="zp-muted">Spaced with FSRS, aiming for about 90% recall when each one comes back (80% for careless ones).</p></section>' +
      '<section class="zp-panel"><h2>Recent practice</h2>' + (hist ? '<div class="zp-tablewrap"><table class="zp-table"><thead><tr><th>Day</th><th>What</th><th>Questions</th><th>Right</th><th>Avg time</th></tr></thead><tbody>' + hist + '</tbody></table></div>' : '<p class="zp-muted">Nothing yet.</p>') + '</section>' +
      '<section class="zp-panel"><h2>Mocks</h2>' + (mk ? '<div class="zp-tablewrap"><table class="zp-table"><thead><tr><th>Date</th><th>Mock</th><th>Multiple choice</th><th>Free response</th><th>Time used</th></tr></thead><tbody>' + mk + '</tbody></table></div>' : '<p class="zp-muted">No mocks taken yet.</p>') + '</section>' +
      (tests ? '<section class="zp-panel"><h2>Tests</h2><table class="zp-table"><tbody>' + tests + '</tbody></table></section>' : '') +
      '<details class="zp-panel"><summary><b>What we keep track of</b></summary><ul class="zp-signals"><li>Every answer: the problem, your choice, right or wrong, time spent, whether you opened the answer, how sure you were, and where you did it (chapter, practice, review, test, mock).</li><li>Free-response scores you give yourself in mocks and tests.</li><li>Your flags, entries (Careless or Actual), concept and example cards, and each review you grade.</li><li>Tests and mocks: the questions, your answers, time per question, and section times.</li><li>Nothing is shared outside Zenith. Your teacher sees a summary of this, not your private notes unless you share them.</li></ul></details>' : '');
    main.onclick = null; main.onchange = null; main.oninput = null;
  }
    statsView();
  }

  root.ZPStats = { render: render };
})(window);
