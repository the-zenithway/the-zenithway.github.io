/* Interactive tour, in the spirit of the KYJ-SAT site's: the page is dimmed, the thing being explained is ringed, and a card explains it.
 * Unlike that single-page app, Zenith is several pages, so the tour carries on across them: its position lives in sessionStorage and each
 * page picks it up where the last one left it.
 *
 *   ZTour.start('main')     the full walk-through of how solving works on the Calculus platform (about 3 minutes)
 *   ZTour.help()            a short tour of the page you are on (the "?" key and the header's Tour button do this on a page with one)
 *
 * The tour never answers, checks or flags anything for you: it only opens pages and highlights what is already there, so it writes nothing to
 * your progress. The one thing it changes is the Roadmap's view (Chapters / Curve), and it puts that back when it ends.
 * A step: {title, body (text or fn), selector, url (fn(course) -> string | Promise<string>; omit to stay on this page), before(), when()}. */
(function (root) {
  'use strict';
  var STATE_KEY = 'zenith:tour', SEEN_KEY = 'zenith:tour:seen:v1', CALC = 'ap-calculus-bc';
  var doc = root.document, tour = null, ui = null, resizeFn = null, keyFn = null, token = 0;

  /* ---------- who is looking ---------- */
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } return null; }
  // The tour's position lives in sessionStorage: it follows the student from page to page but never survives closing the tab.
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* blocked */ } return null; }
  function isStudent() { return ls('loggedInRole') === 'student'; }
  function me() { try { return typeof getCurrentStudent === 'function' ? getCurrentStudent() : null; } catch (e) { return null; } }
  function hasCalc() { var s = me(); return !!(s && (s.courses || []).some(function (c) { return c.id === CALC; })); }
  function onMentor() { return !!doc.querySelector('.portal-nav a[href="mentor.html"]'); } // self-study students have no Mentor link

  /* ---------- pages ---------- */
  function file() { return (root.location.pathname.split('/').pop() || 'index.html'); }
  function parts(url) { var m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url); return { file: m[1] || file(), search: m[2] || '', hash: m[3] || '' }; }
  function waitFor(sel, ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() { var el = sel ? doc.querySelector(sel) : null; if (!sel || el) return resolve(el); if (Date.now() - t0 > ms) return resolve(null); setTimeout(poll, 120); })();
    });
  }
  // The first Chapter 1 multiple-choice problem, so the "solving" steps have a real problem to ring. Needs the bank loader, which every
  // platform page the earlier steps run on already has.
  function sampleProblem(course) {
    if (!root.ZPBanks) return Promise.resolve('');
    return root.ZPBanks.load(course).then(function (d) {
      var q = d.problems.filter(function (p) { return p.kind === 'C' && !p.frq && !p.blocked && p.chapter === (d.info.order[0] || '1') && p.choices && p.choices.length; })[0];
      return q ? q.id : '';
    }).catch(function () { return ''; });
  }
  function roadmapView(view) {
    var btn = doc.querySelector('#roadmap-view-switch [data-view="' + view + '"]'); if (!btn) return;
    if (tour && tour.view0 === undefined) { var cur = doc.querySelector('#roadmap-view-switch .active'); tour.view0 = cur ? cur.getAttribute('data-view') : ''; save(); }
    if (!btn.classList.contains('active')) btn.click();
  }

  /* ---------- the steps ---------- */
  var K = '<kbd>', k = '</kbd>';
  var S = {
    welcome: { title: 'How solving works on Zenith', body: 'This is a 3-minute walk through the AP Calculus BC platform: <b>pick the next step on your Roadmap</b>, <b>solve</b> problems in the Trainer, <b>write down what each mistake taught you</b> (your 발상노트), and let the <b>review queue</b> bring those problems back at the right moment. Nothing you see here is recorded. Press ' + K + 'Esc' + k + ' any time to leave, and start it again from <b>Tour</b> in the header.' },
    nav: { title: 'Your four places', selector: '.portal-nav', body: '<b>Roadmap</b> is where you decide what to do next. <b>Trainer</b> is for practice, tests and mocks. <b>Notebook</b> holds your entries and your review queue. <b>Profile</b> has your stats and settings.' + '' },
    today: { title: 'Today: the next step', url: function (c) { return 'roadmap.html?course=' + c; }, selector: '#zp-today', body: 'This strip always points at the <b>one thing to do next</b>. It is worked out from what you have already done, so there is nothing to set up. Press <b>Go</b> and it takes you straight there.' },
    chapters: { title: 'Every chapter, step by step', selector: '#zp-chapter-path', before: function () { roadmapView('chapters'); },
      body: 'Each chapter runs in the same order: <b>B</b> Book (read it), <b>C</b> Problems (solve), <b>R</b> Review (write your entries), <b>T</b> Test (optional), <b>N</b> Concepts Notebook. A <b>★</b> is a cumulative checkpoint after a group of chapters, and <b>Chapter M</b> at the end holds the full mocks and past AP free-response exams.' },
    dots: { title: 'Read the dots', selector: '.zp-prow.cur .zp-dots', before: function () { roadmapView('chapters'); },
      body: 'Filled dots are done, a ringed dot is what is next, and a dashed one is optional. A chapter counts as complete once <b>B, C and R</b> are done. Click a chapter to open its steps.' },
    curve: { title: 'The Curve', selector: '#roadmap-curve-canvas', before: function () { roadmapView('curve'); },
      body: 'The same path as a picture: one gem per chapter (and ★ checkpoint), coloured by how far you are. Click a gem to open that chapter. Switch between <b>Chapters</b> and <b>Curve</b> whenever you like.' },
    hub: { title: 'Inside a chapter', url: function (c) { return 'chapter.html?course=' + c + '&ch=1#hub'; }, selector: '.zp-stages > *:first-child',
      body: 'A chapter lists its steps, each a card like this one with what it is for and when it is done. <b>Book</b>: read, then keep the examples and concepts you want. <b>Problems</b>: solve the set. <b>Review</b>: for every problem you flagged, write what happened. The test and the Concepts Notebook round the chapter off.' },
    stem: { title: '1. Read the problem', url: function (c) { return sampleProblem(c).then(function (pid) { return 'practice.html?course=' + c + (pid ? '&q=' + encodeURIComponent(pid) : '') + '#browse'; }); }, selector: '.zp-stem',
      body: 'This is a real Chapter 1 problem. Solving is <b>untimed and quiet</b>: no pop-ups and no hints. The tour will not answer it for you, and nothing is recorded until <i>you</i> check an answer.' },
    choices: { title: '2. Choose an answer', selector: '.zp-choices', body: 'Click a choice, or press ' + K + 'A' + k + ' ' + K + 'B' + k + ' ' + K + 'C' + k + ' ' + K + 'D' + k + ' (you can change the keys in Profile › Settings). Nothing is recorded yet, so change your mind freely.' },
    conf: { title: '3. Say how sure you are', selector: '.zp-conf', body: '<b>Sure</b>, <b>Not sure</b> or <b>Guessing</b>. Be honest: a lucky guess and real knowledge look the same on a score, but your stats and your review queue treat them very differently.' },
    check: { title: '4. Check answer', selector: '[data-act="check"]', body: 'This locks in your <b>first try</b>, and only the first try counts. After a miss, <b>Try again</b> is practice that is not recorded. A wrong answer is flagged for review for you.' },
    reveal: { title: 'Stuck? Open the solution', selector: '[data-act="reveal"]', body: 'There are no hints on purpose. This button opens the <b>full answer and worked solution</b>. Opening it before you answer, or after a miss, counts as a miss; opening it after you got it right records nothing. Either way you can write an entry about it.' },
    tools: { title: 'Flag it, copy it, report it', selector: '.zp-qtools', body: '<b>Flag for review</b> puts a problem in your review pile even if you got it right, and <b>Don\'t review this</b> takes it out. <b>Copy question</b> gives you the problem as LaTeX. If a problem looks broken, report it here.' },
    entry: { title: '5. Write your 발상노트 entry', body: 'After you check, <b>Write my entry now</b> appears. One entry per problem: was the mistake <b>Careless</b> (you knew it) or <b>Actual</b> (you did not)? Then say what happened: the habit to change (행동양식), the main idea you missed, or something else. You can also give it its own review card. Prefer to move on? Write it later in the chapter\'s Review step or under <b>Notebook › Inbox</b>.' },
    inbox: { title: 'Your Notebook', url: function (c) { return 'notebook.html?course=' + c + '&view=inbox'; }, selector: '.zp-tabs',
      body: '<b>Browse</b> lists every entry. <b>Inbox</b> holds problems waiting for an entry. <b>Idea Notebook</b> keeps the ideas you wrote, and you can add stand-alone ones. <b>Concepts Notebook</b> is the chapter summary you build in step N.' },
    queue: { title: 'The review queue', url: function (c) { return 'notebook.html?course=' + c + '&view=redo'; }, selector: '.zp-tabs a[href*="view=redo"]',
      body: 'This is what makes mistakes stick. Flagged problems come back on a <b>spaced schedule</b>: the ones you struggle with return soon, the ones you know return later. Do what is due each day, use <b>Review more</b> to get ahead, and <b>warm-ups</b> before a chapter refresh the last one.' },
    trainer: { title: 'The Trainer', url: function (c) { return 'practice.html?course=' + c + '#browse'; }, selector: '.zp-tabs',
      body: '<b>Browse</b> finds any problem. <b>Practice</b> builds your own set (multiple choice or free response, calculator or not, by chapter and topic). <b>Test</b> is timed practice. <b>Mock</b> runs full mock exams and lets you build your own, like the real exam.' },
    tests: { title: 'Tests, checkpoints and mocks', body: 'A <b>chapter test</b> is timed and taken once, with no feedback until you submit; afterwards you write an entry for every miss, just like Review. Each <b>★ checkpoint</b> is 40 problems in 80 minutes, straight through. <b>Chapter M</b> has three full mocks and the 2023, 2024 and 2025 AP free-response exams. Your results are kept in records you can delete, and your per-problem progress stays.' },
    frq: { title: 'Free-response problems', body: function () {
      return onMentor() ? 'For free response, type your answer (LaTeX works) and attach photos of your work, then <b>ask your mentor for feedback</b>. The mentor\'s score is final and comes back in your Mentor thread. An AP free-response question is worth 9 points, and 75% or more counts as right.'
        : 'For free response you work on paper, open the solution, and <b>score yourself</b> (Got it, Partly or Missed). An AP free-response question is worth 9 points, and 75% or more counts as right. A problem you have not scored is never counted as wrong.'; } },
    mentor: { title: 'Your mentor', selector: '.portal-nav a[href="mentor.html"]', when: function () { return onMentor(); }, body: 'If you have a mentor, <b>Mentor</b> is where you message them, send photos of your work, ask for feedback and propose sessions. <b>Now</b> shows what they want from you this week.' },
    settings: { title: 'Make it yours', url: function () { return 'profile.html#settings'; }, selector: '.zp-tabs a[data-tab="settings"]', body: 'In <b>Profile › Settings</b> you can change the theme, the problem font and width, and every <b>keyboard shortcut</b> used while solving. <b>Statistics</b> shows your accuracy by chapter, your streak and what to work on.' },
    finish: { title: 'That is the loop', finish: true, body: 'Roadmap tells you what is next → solve in the Trainer → write what each mistake taught you → the queue brings it back. When you are lost, open <b>Today</b> on the Roadmap. Press ' + K + '?' + k + ' on any page, or use <b>Tour</b> in the header, to replay this or get a short tour of the page you are on.' },
    // For a student who has not added Calculus yet
    catalogA: { title: 'Pick your courses', url: function () { return 'catalog.html'; }, selector: '#catalog-selfstudy', body: 'Self-study courses are open to everyone: add one and it appears in your portal at once. <b>AP Calculus BC</b> is the one built on the platform this tour is about. Add it, then start the tour again from <b>Tour</b> in the header.' },
    catalogB: { title: 'Mentorship classes', selector: '#catalog-grid', body: 'These are classes with a mentor, chosen by an admin, so they are locked for now.' }
  };
  function local(step) { var c = Object.assign({}, step); delete c.url; return c; }
  function L() { return Array.prototype.slice.call(arguments).map(function (n) { return local(S[n]); }); }
  function H() { return Array.prototype.slice.call(arguments).map(function (n) { return S[n]; }); }
  var TOURS = {
    main: H('welcome', 'nav', 'today', 'chapters', 'dots', 'curve', 'hub', 'stem', 'choices', 'conf', 'check', 'reveal', 'tools', 'entry', 'inbox', 'queue', 'trainer', 'tests', 'frq', 'mentor', 'settings', 'finish'),
    start: H('welcome', 'catalogA', 'catalogB').concat([{ title: 'Then come back', finish: true, body: 'Once AP Calculus BC is in your portal, use <b>Tour</b> in the header (or press ' + K + '?' + k + ') to see how solving works, step by step.' }]),
    portal: [{ title: 'Your courses', selector: '.course-app-grid', body: 'Each tile is a course you are in. Open one to see its Roadmap.' }, { title: 'Add a course', selector: '.course-folder-more a', body: 'Self-study courses are open to everyone: add one from the catalog and it shows here at once.' }, S.finish].map(function (x) { return x === S.finish ? Object.assign({}, S.finish, { body: 'Want the full picture of how solving works on the Calculus platform? Use <b>Tour</b> in the header and pick the full walk-through.' }) : x; }),
    catalog: L('catalogA', 'catalogB', 'finish'),
    roadmap: L('today', 'chapters', 'dots', 'curve', 'finish'),
    chapter: L('hub', 'finish'),
    runner: L('stem', 'choices', 'conf', 'check', 'reveal', 'tools', 'entry', 'finish'),
    trainer: L('trainer', 'tests', 'frq', 'finish'),
    notebook: L('inbox', 'queue', 'finish'),
    profile: L('settings', 'finish')
  };
  // The page-sized tours end with their own closing card.
  ['roadmap', 'chapter', 'runner', 'trainer', 'notebook', 'profile', 'catalog'].forEach(function (key) {
    TOURS[key] = TOURS[key].map(function (st) { return st.finish ? { title: 'That is this page', finish: true, body: 'Use <b>Tour</b> in the header, or press ' + K + '?' + k + ', to replay this or open the full walk-through of how solving works.' } : st; });
  });
  var LABEL = { roadmap: 'this Roadmap', chapter: 'this chapter page', runner: 'solving a problem', trainer: 'the Trainer', notebook: 'the Notebook', profile: 'your Profile', catalog: 'the catalog', portal: 'your courses' };

  function pageKey() {
    var f = file();
    if (doc.querySelector('.zp-runbody')) return 'runner';
    return { 'portal.html': 'portal', 'catalog.html': 'catalog', 'roadmap.html': 'roadmap', 'chapter.html': 'chapter', 'practice.html': 'trainer', 'notebook.html': 'notebook', 'profile.html': 'profile' }[f] || '';
  }

  /* ---------- state across pages ---------- */
  function save() { if (tour) ss(STATE_KEY, JSON.stringify({ key: tour.key, i: tour.i, course: tour.course, view0: tour.view0 })); }

  /* ---------- drawing ---------- */
  function mountUI() {
    if (ui) return ui;
    var r = doc.createElement('div'); r.className = 'zt-root'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', 'Tour');
    r.innerHTML = '<div class="zt-overlay"></div><div class="zt-ring zt-hidden"></div><div class="zt-card"></div>';
    doc.body.appendChild(r);
    ui = { root: r, ring: r.querySelector('.zt-ring'), card: r.querySelector('.zt-card') };
    return ui;
  }
  function union(sel) {
    if (!sel) return null;
    var top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    Array.prototype.slice.call(doc.querySelectorAll(sel)).forEach(function (el) {
      var b = el.getBoundingClientRect(); if (!b.width && !b.height) return;
      top = Math.min(top, b.top); left = Math.min(left, b.left); right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom);
    });
    return isFinite(top) ? { top: top, left: left, width: right - left, height: bottom - top } : null;
  }
  function place(step) {
    if (!ui) return;
    var rect = union(step.selector), card = ui.card, ring = ui.ring, pad = 8, m = 14;
    if (!rect) { ring.classList.add('zt-hidden'); ring.style.top = ring.style.left = ring.style.width = ring.style.height = ''; card.classList.add('zt-centered'); card.style.top = ''; card.style.left = ''; return; }
    ring.classList.remove('zt-hidden'); card.classList.remove('zt-centered');
    ring.style.top = (rect.top - pad) + 'px'; ring.style.left = (rect.left - pad) + 'px'; ring.style.width = (rect.width + pad * 2) + 'px'; ring.style.height = (rect.height + pad * 2) + 'px';
    var tw = card.offsetWidth || 360, th = card.offsetHeight || 180, vw = root.innerWidth, vh = root.innerHeight;
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, hi)); }
    var below = vh - (rect.top + rect.height) - pad, above = rect.top - pad, right = vw - (rect.left + rect.width) - pad, leftSpace = rect.left - pad, top, left;
    if (below >= th + m) { top = rect.top + rect.height + pad + m; left = clamp(rect.left + rect.width / 2 - tw / 2, m, vw - tw - m); }
    else if (above >= th + m) { top = rect.top - pad - m - th; left = clamp(rect.left + rect.width / 2 - tw / 2, m, vw - tw - m); }
    else if (right >= tw + m) { left = rect.left + rect.width + pad + m; top = clamp(rect.top + rect.height / 2 - th / 2, m, vh - th - m); }
    else if (leftSpace >= tw + m) { left = rect.left - pad - m - tw; top = clamp(rect.top + rect.height / 2 - th / 2, m, vh - th - m); }
    else { top = clamp(rect.top + rect.height + pad + m, m, vh - th - m); left = clamp(rect.left + rect.width / 2 - tw / 2, m, vw - tw - m); }
    card.style.top = top + 'px'; card.style.left = left + 'px';
  }
  function draw(step) {
    var steps = tour.steps, total = steps.length, last = tour.i === total - 1, body = typeof step.body === 'function' ? step.body() : step.body;
    mountUI().card.innerHTML = '<div class="zt-eyebrow"><span class="zt-count">Step ' + (tour.i + 1) + ' of ' + total + '</span><button type="button" class="zt-skip" data-zt="skip">Skip tour</button></div>' +
      '<div class="zt-bar">' + steps.map(function (s, n) { return '<span class="' + (n <= tour.i ? 'on' : '') + '"></span>'; }).join('') + '</div>' +
      '<p class="zt-title">' + step.title + '</p><p class="zt-body">' + body + '</p>' +
      '<div class="zt-actions"><button type="button" class="zt-btn" data-zt="back"' + (tour.i === 0 ? ' disabled' : '') + '>Back</button><button type="button" class="zt-btn zt-primary" data-zt="next">' + (last ? 'Finish' : 'Next') + '</button></div>';
    ui.card.querySelector('[data-zt="next"]').focus({ preventScroll: true });
    var el = step.selector ? doc.querySelector(step.selector) : null; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    place(step);
  }

  /* ---------- moving between steps ---------- */
  // dir: +1 or -1, so a step that does not apply (no mentor, say) is skipped in the direction the student was going.
  function go(i, dir) {
    if (!tour || i < 0 || i >= tour.steps.length) { if (i >= (tour ? tour.steps.length : 0)) end(); return; }
    var step = tour.steps[i], mine = ++token; tour.i = i; save();
    if (step.when && !step.when()) return go(i + dir, dir || 1);
    Promise.resolve(step.url ? step.url(tour.course) : '').then(function (target) {
      if (mine !== token) return;
      if (target) {
        var t = parts(target), now = parts(root.location.pathname.split('/').pop() + root.location.search + root.location.hash);
        if (t.file !== now.file || t.search !== now.search) { save(); root.location.href = target; return; }
        if (t.hash && t.hash !== now.hash) root.location.hash = t.hash;
      }
      if (step.before) { try { step.before(); } catch (e) { /* a step's setup must never break the tour */ } }
      waitFor(step.selector, 6000).then(function () { if (mine === token && tour) draw(step); });
    });
  }
  function start(key, opts) {
    opts = opts || {};
    if (!TOURS[key]) key = 'main';
    if (key === 'main' && !hasCalc()) key = 'start';
    if (tour) end(true);
    var calc = hasCalc() ? CALC : '';
    tour = { key: key, i: 0, steps: TOURS[key].slice(), course: opts.course || calc, view0: undefined };
    // The roadmap's course comes from the page when the tour starts there (a student on the Chemistry roadmap still gets the Calculus tour).
    mountUI(); wire(); go(opts.at || 0, 1);
  }
  function resume() {
    var raw = ss(STATE_KEY); if (!raw) return;
    var s; try { s = JSON.parse(raw); } catch (e) { return ss(STATE_KEY, null); }
    if (!TOURS[s.key]) return ss(STATE_KEY, null);
    tour = { key: s.key, i: s.i, steps: TOURS[s.key].slice(), course: s.course, view0: s.view0 };
    var step = tour.steps[tour.i]; if (!step) { tour = null; return ss(STATE_KEY, null); }
    // Pick up on the page the step belongs to; if the student wandered elsewhere on their own, the tour just ends.
    var want = step.url ? Promise.resolve(step.url(tour.course)).catch(function () { return ''; }) : Promise.resolve('');
    want.then(function (target) {
      if (target && parts(target).file !== file()) { tour = null; return ss(STATE_KEY, null); }
      mountUI(); wire(); go(tour.i, 1);
    });
  }
  function end(quiet) {
    token++;
    if (tour && tour.view0 !== undefined && tour.view0 && tour.course) { ls('roadmapView:' + tour.course, tour.view0); var b = doc.querySelector('#roadmap-view-switch [data-view="' + tour.view0 + '"]'); if (b && !b.classList.contains('active')) b.click(); }
    tour = null; ss(STATE_KEY, null); if (!quiet) ls(SEEN_KEY, '1');
    if (ui) { ui.root.remove(); ui = null; }
    if (resizeFn) { root.removeEventListener('resize', resizeFn); root.removeEventListener('scroll', resizeFn, true); resizeFn = null; }
    if (keyFn) { doc.removeEventListener('keydown', keyFn, true); keyFn = null; }
  }
  function wire() {
    if (resizeFn) return;
    resizeFn = function () { if (tour) place(tour.steps[tour.i]); };
    root.addEventListener('resize', resizeFn); root.addEventListener('scroll', resizeFn, true);
    keyFn = function (e) {
      if (!tour) return;
      if (e.key === 'Escape') { e.preventDefault(); end(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (tour.i === tour.steps.length - 1) end(); else go(tour.i + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(tour.i - 1, -1); }
      else if (e.key !== 'Tab') e.stopPropagation(); // while the tour is open, no key reaches the page behind it (the problem runner has one-key shortcuts)
    };
    doc.addEventListener('keydown', keyFn, true);
    ui.root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-zt]'); if (!b || !tour) return;
      if (b.dataset.zt === 'skip') end();
      else if (b.dataset.zt === 'back') go(tour.i - 1, -1);
      else if (tour.i === tour.steps.length - 1) end(); else go(tour.i + 1, 1);
    });
  }

  /* ---------- launch points ---------- */
  function help() { var key = pageKey(); start(key && TOURS[key] ? key : 'main'); }
  // A small choice from the header's Tour button: this page, or the whole walk-through.
  function chooser(btn) {
    var key = pageKey(), old = doc.getElementById('zt-menu'); if (old) { old.remove(); return; }
    var m = doc.createElement('div'); m.id = 'zt-menu'; m.className = 'zt-card'; m.style.cssText = 'top:' + (btn.getBoundingClientRect().bottom + 8) + 'px;right:16px;left:auto;width:min(300px,92vw);z-index:2900;pointer-events:auto';
    m.innerHTML = '<p class="zt-title">Take a tour</p><div style="display:grid;gap:8px">' +
      '<button type="button" class="zt-btn zt-primary" data-m="main">How solving works (3 min)</button>' + (key && TOURS[key] ? '<button type="button" class="zt-btn" data-m="page">Just ' + (LABEL[key] || 'this page') + '</button>' : '') + '</div>';
    doc.body.appendChild(m);
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; m.remove(); start(b.dataset.m === 'main' ? 'main' : key); });
    setTimeout(function () { doc.addEventListener('click', function off(ev) { if (!m.contains(ev.target) && ev.target !== btn) { m.remove(); doc.removeEventListener('click', off); } }); }, 0);
  }
  function addHeaderButton() {
    var bar = doc.querySelector('.portal-actions'); if (!bar || doc.getElementById('zt-launch') || !isStudent()) return;
    var a = doc.createElement('a'); a.href = '#'; a.id = 'zt-launch'; a.className = 'portal-link'; a.textContent = 'Tour'; a.title = 'Take a tour (press ?)';
    a.addEventListener('click', function (e) { e.preventDefault(); if (tour) return; chooser(a); });
    bar.insertBefore(a, bar.firstChild);
  }
  // First visit: a quiet invitation at the top of the Roadmap and the course list, never a pop-up.
  function invite() {
    if (!isStudent() || ls(SEEN_KEY) || tour) return;
    var f = file(); if (f !== 'roadmap.html' && f !== 'portal.html' && f !== 'catalog.html') return;
    var main = doc.querySelector('main'); if (!main || doc.getElementById('zt-invite')) return;
    var box = doc.createElement('div'); box.id = 'zt-invite'; box.className = 'zt-invite';
    box.innerHTML = '<span><b>New here?</b> Take the 3-minute tour of how solving works on the Calculus platform.</span><button type="button" class="zt-btn zt-primary">Start the tour</button><button type="button" class="zt-btn">Not now</button>';
    box.querySelector('.zt-primary').addEventListener('click', function () { box.remove(); start('main'); });
    box.querySelectorAll('.zt-btn')[1].addEventListener('click', function () { ls(SEEN_KEY, '1'); box.remove(); });
    main.insertBefore(box, main.firstChild);
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key !== '?' || tour || e.ctrlKey || e.metaKey || e.altKey || !isStudent()) return;
    var t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    e.preventDefault(); help();
  });

  root.ZTour = { start: start, help: help, end: end, pageKey: pageKey, TOURS: TOURS };
  function boot() { addHeaderButton(); resume(); if (!tour) setTimeout(invite, 600); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
