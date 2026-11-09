/* Loads a course's problem banks + chapter content and builds the `info` that ZP.derive() reads.
 * Reuses ZenithPractice.normalize (js/practice-core.js) so bank parsing stays in one place. */
(function (root) {
  'use strict';
  var CFG = root.ZP_CONFIG;
  var cache = {};

  function fetchJSON(url, optional) {
    return fetch(url).then(function (r) {
      if (!r.ok) { if (optional) return {}; throw new Error(url + ' (' + r.status + ')'); }
      return r.json();
    }).catch(function (e) { if (optional) return {}; throw e; });
  }

  function load(courseId) {
    if (cache[courseId]) return cache[courseId];
    var conf = CFG.COURSES[courseId];
    if (!conf) return Promise.reject(new Error('No problem banks for this course yet.'));
    var core = root.ZenithPractice;
    cache[courseId] = Promise.all([
      fetchJSON('data/' + conf.prefix + '-c-bank.json', true),
      fetchJSON('data/' + conf.prefix + '-t-bank.json', true),
      fetchJSON('data/chapter-content.json', true),
      conf.apFrq ? fetchJSON('data/' + conf.prefix + '-ap-frq-bank.json', true) : Promise.resolve({})
    ]).then(function (res) {
      var cBank = res[0] || {}, tBank = res[1] || {}, content = (res[2] || {})[courseId] || {}, apBank = res[3] || {};
      var problems = [], byId = {};
      [['C', cBank], ['T', tBank]].forEach(function (pair) {
        var kind = pair[0], bank = pair[1];
        var rawIndex = {};
        Object.keys(bank).forEach(function (ch) {
          ((bank[ch] && bank[ch].problems) || []).forEach(function (p, i) { rawIndex[ch + '|' + String(p.id || i + 1)] = p; });
        });
        core.normalize(bank, courseId, kind).forEach(function (q) {
          var raw = rawIndex[q.chapter + '|' + q.sourceId] || {};
          q.code = root.ZP.code(q.id);
          problems.push(q); byId[q.id] = q;
        });
      });
      // Calculator rule for every problem that has one: the source splits each C / T chapter into Part A (no calculator) and
      // Part B (calculator), which the id letter carries (1CA3 -> A, 4TB2 -> B). Sets and AP questions set it themselves.
      problems.forEach(function (q) {
        if (q.kind === 'C' || q.kind === 'T') { var m = /^\d+[CT]([AB])/.exec(q.id); if (m && courseId === 'ap-calculus-bc') q.calc = m[1] === 'B' ? 'yes' : 'no'; }
      });
      // AP free-response archive: one FRQ set tagged by year / calculator / AP unit, not a chapter. Id is apF<archive id>,
      // shown as the archive id (25FRQ1).
      var apRaw = {};
      Object.keys(apBank).forEach(function (k) { ((apBank[k] && apBank[k].problems) || []).forEach(function (p) { apRaw[String(p.id)] = p; }); });
      var apIds = [];
      core.normalize(apBank, courseId, 'F').forEach(function (q) {
        var raw = apRaw[q.sourceId] || {};
        q.code = q.sourceId;
        q.tags = { year: raw.year, number: raw.number, calculator: raw.calculator, units: raw.units || [] }; q.calc = raw.calculator;
        q.scoringUrl = raw.scoring_url || ''; q.samplesUrl = raw.samples_url || '';
        problems.push(q); byId[q.id] = q; if (!q.blocked) apIds.push(q.id);
      });
      // Banks that are not chapters (calc C11 / C12) become fixed sets instead of chapters.
      var setsCfg = (CFG.SETS || {})[courseId] || [], setChapters = {}, sets = [], setOf = {}, bySetCh = {};
      setsCfg.forEach(function (c) { setChapters[c.chapter] = 1; });
      problems.forEach(function (q) { if (q.kind === 'C' && setChapters[q.chapter] && !q.blocked) (bySetCh[q.chapter] = bySetCh[q.chapter] || []).push(q.id); });
      setsCfg.forEach(function (c) {
        var ids = bySetCh[c.chapter] || [];
        if (c.of) { var per = Math.ceil(ids.length / c.of); ids = ids.slice(c.part * per, (c.part + 1) * per); }
        if (c.prefix) ids = ids.filter(function (id) { return byId[id].sourceId.charAt(0) === c.prefix; });
        if (c.calc) ids.forEach(function (id) { byId[id].calc = c.calc; });
        ids.forEach(function (id) { setOf[id] = c.id; });
        if (ids.length) sets.push({ id: c.id, title: c.title, ids: ids, frq: !!c.frq, chapter: c.chapter, calc: c.calc || '' });
      });
      if (apIds.length) { sets.push({ id: 'APFRQ', title: 'AP free-response archive', ids: apIds, frq: true, chapter: 'ap', ap: true }); apIds.forEach(function (id) { setOf[id] = 'APFRQ'; }); }
      var chapters = {}, seen = {};
      problems.forEach(function (q) { if (q.kind !== 'F' && !setChapters[q.chapter]) seen[q.chapter] = 1; });
      Object.keys(content).forEach(function (ch) { if (/^\d+$/.test(ch) && !setChapters[ch]) seen[ch] = 1; });
      var order = Object.keys(seen).sort(function (a, b) { return a - b; });
      order.forEach(function (ch) {
        var cs = problems.filter(function (q) { return q.chapter === ch && q.kind === 'C' && !q.blocked; });
        var ts = problems.filter(function (q) { return q.chapter === ch && q.kind === 'T' && !q.blocked; });
        var title = (cBank[ch] && cBank[ch].title) || (tBank[ch] && tBank[ch].title) || 'Chapter ' + ch;
        var cc = content[ch] || {};
        chapters[ch] = {
          ch: ch, title: title,
          hasC: cs.length > 0, hasT: ts.length > 0,
          frq: !!(cBank[ch] && cBank[ch].type === 'frq'),
          cIds: cs.map(function (q) { return q.id; }), tIds: ts.map(function (q) { return q.id; }),
          examples: cc.examples || [], concepts: cc.concepts || [],
          exKeys: (cc.examples || []).map(function (e) { return e.key; }),
          conceptKeys: (cc.concepts || []).map(function (c) { return c.key; })
        };
      });
      problems.forEach(function (q) {
      });
      root.ZPBank = byId; // lets shared UI (copy buttons) find a problem by id
      var tags = {}; problems.forEach(function (q) { tags[q.id] = [q.calc || '', q.frq ? 1 : 0]; });
      return { courseId: courseId, problems: problems, byId: byId, info: { order: order, chapters: chapters, sets: sets, setOf: setOf, tags: tags, curriculum: (CFG.CURRICULUM || {})[courseId] || null } };
    });
    // Self-study students (data/student-tracks.json) have nothing required: info.selfStudy makes the curriculum's checkpoints and Chapter M optional.
    cache[courseId] = cache[courseId].then(function (d) {
      try { if (typeof isSelfStudy_ === 'function' && typeof getCurrentStudent === 'function' && getCurrentStudent()) return Promise.resolve(isSelfStudy_(getCurrentStudent())).then(function (v) { d.info.selfStudy = !!v; return d; }, function () { return d; }); } catch (e) { /* no track info: treat as class */ }
      return d;
    });
    cache[courseId].catch(function () { delete cache[courseId]; });
    return cache[courseId];
  }

  // The B-stage book link already on the student's roadmap (category "B-book chapter").
  function bookUrl(course, ch) {
    var items = (course && course.roadmap) || [];
    var hit = items.filter(function (it) { return it.chapter === 'Chapter ' + ch && /^B/i.test(it.category || '') && it.url; })[0];
    return hit ? hit.url : '';
  }

  root.ZPBanks = { load: load, bookUrl: bookUrl };
})(window);
