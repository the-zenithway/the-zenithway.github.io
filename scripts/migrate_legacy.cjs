// Carries the old roadmap's progress into the new platform's event log.
//   node scripts/migrate_legacy.cjs            writes data/legacy-import.json
//
// The store (js/zp-store.js) merges that file into each student's log by event id the first time it loads, so it is safe to
// run again and safe to load twice. What is carried over, and what deliberately is not:
//   carried   stage progress (B / C / R / T Complete in the old roadmap) as `legacy_done`; the teacher's written feedback as
//             mentor messages; cheat-sheet entries as Concepts Notebook cards; the current "Right Now" as a required task;
//             what the student wrote when they submitted (and any photo link) as progress notes; the teacher's own judgments
//             (motivation check-ins, responsiveness) as private notes.
//   not       question-by-question answers. The old chapter answer lists do not line up with today's banks (the banks were
//             revised and re-split), so grading them would invent wrong stats. The hand-entered "metrics" (topic mastery,
//             chapter scores, predicted AP score) are placeholders or stale and are replaced by stats derived from real work.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const CALC = 'ap-calculus-bc', CHEM = 'ap-chemistry', TEACHER = 'kyjteach', YEAR = 2026;
// Which of each student's courses are carried over. Everything comes from js/data.js and data/submissions-log.json exactly as they are in the repo
// (so the result always matches what is on GitHub). Seohu's Chemistry was 100% complete in the old roadmap.
const COURSES_OF = { bogue: [CALC], seohu: [CALC, CHEM] };
const WHO = Object.keys(COURSES_OF);
// Students moving over from the old roadmap who had not done the test (T) or the Concepts Notebook (N): for the listed chapters the
// chapter counts as complete (B, C and R done) and T, the test review and N stay as optional review. Bogue uses AUTO_TRANSITION below.
const TRANSITION = {}; // seohu is carried exactly as in js/data.js (an earlier override that closed her chapters 1-4 was removed: ch 4 Review was still open there)
// Students whose own old-roadmap progress is carried exactly as it was, with the rule applied automatically: every chapter whose Book and
// Problems (B and C) were done counts as complete, and whatever else was not done in the old roadmap (Review, Test, test review, Notebook) stays
// as optional review. Bogue: B and C done for 1-6, 9 and 10, so his current chapter is 7, as his Right Now says. His Right Now task stays required.
const AUTO_TRANSITION = ['bogue'];

// Per-problem answers from the old roadmap's C units (data/legacy-answers.json, made by scripts/import_legacy_tracker.py from a tracker that was
// checked against today's bank). `reviewedThrough`: the student finished the Review (R) step for chapters up to this one in the old roadmap, so
// those chapters are closed through R and every problem she missed counts as reviewed once, with good recall (see "answers" below).
const REVIEWED_THROUGH = { seohu: 4 };
const ANSWERS = fs.existsSync(path.join(root, 'data', 'legacy-answers.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data', 'legacy-answers.json'), 'utf8')) : {};

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8') + ';this.STUDENTS=STUDENTS;', ctx);
const subs = JSON.parse(fs.readFileSync(path.join(root, 'data', 'submissions-log.json'), 'utf8'));

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function dateOf(label, fallback) {
  const m = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2})$/.exec(String(label || '').trim());
  return m && MON[m[1]] != null ? new Date(YEAR, MON[m[1]], +m[2], 12).getTime() : fallback;
}
// Teacher feedback was written as small HTML; the mentor thread is plain text with $math$.
function plain(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(em|i)>/gi, '').replace(/<\/?(strong|b)>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\\\/g, '\\').replace(/\n{3,}/g, '\n\n').trim();
}
// An answer-key paste ("c,b,d,a..." / "A1. (C)" / "1B 2C 3C") is mostly single letters and numbered labels.
function looksLikeLetters(s) {
  const toks = String(s).split(/[\s,;]+/).filter(Boolean);
  if (toks.length < 6) return false;
  const ok = toks.filter(t => /^([AB]-)?\(?[A-Ea-e]\)?[.,]?$/.test(t) || /^[AB]?\d{1,3}[.:)\-]*\(?[A-Ea-e]?\)?[.,]?$/.test(t)).length;
  return ok / toks.length >= 0.8;
}
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

const out = {}, report = {};
for (const username of WHO) for (const COURSE of COURSES_OF[username]) {
  const stu = ctx.STUDENTS.find(s => s.username === username), course = stu && (stu.courses || []).find(c => c.id === COURSE);
  if (!course) continue;
  // Event ids are unique across courses (the student-data sheet dedupes by id): calculus keeps its original ids, other courses get a prefix.
  const evs = [], key = (n) => ('leg:' + username + ':' + (COURSE === CALC ? '' : COURSE.replace(/^ap-/, '').slice(0, 4) + ':') + n).slice(0, 40);
  let n = 0;
  const base = Date.parse('2026-11-04T12:00:00Z');

  // 1. stages finished in the old roadmap
  const byCh = {};
  (course.roadmap || []).forEach(it => {
    // Calculus: B (book) C (problems) R (review) T (test) S (solutions). Chemistry: L (lesson) N (notes) C (problems) T (test) S (solutions);
    // L is the platform's Book, and N has no stage of its own (it only counts toward closing the chapter).
    const m = /^([BCRTLN])(\d+)[-\s]/.exec(it.name || ''); if (!m) return;
    const ch = m[2]; if (+ch === 0 || +ch > 10) return; // 11-12 are fixed sets now; 0 is the intro; M is mocks
    (byCh[ch] = byCh[ch] || {})[m[1] === 'L' ? 'B' : m[1]] = it.status;
  });
  const doneStages = {};
  Object.keys(byCh).sort((a, b) => a - b).forEach(ch => {
    const st = byCh[ch], done = Object.keys(st).filter(k => st[k] === 'Complete' && k !== 'N');
    // T is absent in chapters without a test; X (close) only when everything that exists is complete.
    const present = Object.keys(st).filter(k => k !== 'S');
    const all = present.length && present.every(k => st[k] === 'Complete');
    const stages = done.concat(all ? ['X'] : []);
    if (!stages.length) return;
    doneStages[ch] = stages;
    evs.push({ id: key('done' + ch), t: base - (20 - +ch) * 6e4, type: 'legacy_done', ch, stages, legacy: true });
  });

  if (COURSE === CALC && AUTO_TRANSITION.indexOf(username) >= 0) evs.forEach(e => {
    if (e.type !== 'legacy_done' || e.stages.indexOf('B') < 0 || e.stages.indexOf('C') < 0) return;
    const opt = ['R', 'T', 'V', 'X'].filter(k => e.stages.indexOf(k) < 0 && !(k === 'V' && e.stages.indexOf('T') >= 0));
    if (opt.length) { e.optional = opt; doneStages[e.ch] = e.stages.concat(['(' + opt.join(', ') + ' optional)']); }
  });

  // Reviewed through chapter N in the old roadmap: the Review (R) stage counts as done for chapters 1..N, even where the old roadmap still showed it open.
  if (COURSE === CALC && REVIEWED_THROUGH[username]) {
    for (let n = 1; n <= REVIEWED_THROUGH[username]; n++) {
      const ch = String(n), ev = evs.find(e => e.type === 'legacy_done' && e.ch === ch);
      if (ev) { if (ev.stages.indexOf('R') < 0) ev.stages.splice(Math.min(ev.stages.length, 2), 0, 'R'); doneStages[ch] = ev.stages.slice(); }
      else { evs.push({ id: key('done' + ch), t: base - (20 - n) * 6e4, type: 'legacy_done', ch, stages: ['B', 'C', 'R'], legacy: true }); doneStages[ch] = ['B', 'C', 'R']; }
    }
  }

  (COURSE === CALC ? TRANSITION[username] || [] : []).forEach(ch => {
    for (let i = evs.length - 1; i >= 0; i--) if (evs[i].type === 'legacy_done' && evs[i].ch === ch) evs.splice(i, 1);
    evs.push({ id: key('done' + ch), t: base - (20 - +ch) * 6e4, type: 'legacy_done', ch, stages: ['B', 'C', 'R'], optional: ['T', 'V', 'X'], legacy: true });
    doneStages[ch] = ['B', 'C', 'R', '(T, V, X optional)'];
  });

  // 1b. what she answered in each C unit, and a reviewed-once entry for every problem she missed. The answers are real (checked against the bank). The
  //     entries are placeholders: her write-ups were on paper, so the note only says the review happened. An entry with a note starts its review
  //     card (graded Good at the time of the review), which is what puts the problem in the review queue, as if she had reviewed it once with good recall.
  const ans = ANSWERS[username + '|' + COURSE];
  if (ans) {
    const stats = { answered: 0, toReview: 0 };
    Object.keys(ans.units).sort((x, y) => x - y).forEach(ch => {
      const tC = Date.parse(ans.cdates[ch]), tR = Date.parse((ans.rdates || {})[ch]), reviewed = REVIEWED_THROUGH[username] >= +ch; // no review date = not reviewed in the old roadmap: the misses stay as entries still to write
      ans.units[ch].forEach((p, i) => {
        const pid = ch + 'C' + p.id;
        evs.push({ id: key('a' + pid), t: tC + i * 1000, type: 'c_answer', ch, pid, answer: p.answer, correct: p.result === 'correct', conf: '', ms: 0, ctx: 'chapter', sess: 'leg:' + ch, legacy: true });
        stats.answered++;
        if (p.result !== 'correct' && reviewed) {
          evs.push({ id: key('n' + pid), t: tR + i * 1000, type: 'note', ch, pid, src: 'R', legacy: true, text: 'Reviewed in the old roadmap (R' + ch + '). The written notes were on paper and were not carried over.' });
          stats.toReview++;
        }
      });
    });
    report[username + '|' + COURSE + ' answers'] = stats;
    // The "Resolve the mistakes in chapter 4C" task from the old Right Now is finished once chapter 4's Review is.
    if (REVIEWED_THROUGH[username] >= 4 && ans.rdates && ans.rdates['4'] && course.rightNow && /^Chapter 4$/.test(course.rightNow.chapter) && course.rightNow.unit === 'R')
      evs.push({ id: key('rndone'), t: Date.parse(ans.rdates['4']) + 1e5, type: 'task_done', key: 'legacy-now', legacy: true });
  }

  // 2. the teacher's written feedback
  (course.feedback || []).forEach((f, i) => {
    const head = [f.chapter, f.unit].filter(Boolean).join(' · ');
    evs.push({ id: key('fb' + i), t: dateOf(f.date, base) + i, type: 'msg', from: 'teacher', kind: 'feedback', by: TEACHER, legacy: true, text: (head ? head + '\n\n' : '') + plain(f.content) });
  });

  // 3. cheat sheet -> Concepts Notebook cards
  (course.cheatSheet || []).forEach((c, i) => {
    const ch = (/^[A-Za-z]?(\d+)/.exec(String(c.source || '')) || [])[1] || '1';
    evs.push({ id: key('cs' + i), t: base - 3e5 + i, type: 'concept', ch, key: 'old' + (i + 1), name: clean(c.topic) || 'Pattern ' + (i + 1), text: plain(c.pattern) + (c.source ? '\n(from ' + c.source + ')' : ''), legacy: true });
  });

  // 4. the current Right Now -> tasks
  const rn = course.rightNow;
  if (rn && rn.state === 'your-move') evs.push({ id: key('rn'), t: base, type: 'task', key: 'legacy-now', by: TEACHER, legacy: true, forced: !TRANSITION[username], kind: 'free', title: [rn.chapter, rn.unit].filter(Boolean).join(' · ') || 'From your mentor', instr: rn.instruction + (rn.due ? '\n\nDue: ' + rn.due : '') });
  else if (rn && rn.state === 'waiting') evs.push({ id: key('rnw'), t: base, type: 'msg', from: 'teacher', kind: 'message', by: TEACHER, legacy: true, text: [rn.chapter, rn.unit].filter(Boolean).join(' · ') + ': ' + rn.note });
  if (course.rightNowNext) evs.push({ id: key('rnn'), t: base - 1, type: 'task', key: 'legacy-next', by: TEACHER, legacy: true, forced: false, kind: 'free', title: [course.rightNowNext.chapter, course.rightNowNext.unit].filter(Boolean).join(' · ') || 'Up next', instr: course.rightNowNext.instruction });

  // 5. every submission record, as a "submission" entry in Mentor (nothing is dropped: the date, chapter and unit, status, what the student
  //    wrote, the answers they typed, any photo or Drive links, and the OCR text of old form uploads)
  subs.filter(s => s.username === username && s.courseId === COURSE).sort((a, b) => a.receivedAt < b.receivedAt ? -1 : 1).forEach(s => {
    const a = s.answers || {}, ans = String(a.answer || '').trim(), rem = clean(a['feedback-and-remarks']), letters = looksLikeLetters(ans);
    const files = [].concat(s.photoUrls || [], s.photoUrl || []).filter(Boolean).map(u => ({ url: u }));
    const drive = [].concat(a['Upload the relevant files here'] || []).filter(Boolean).map(id => 'https://drive.google.com/file/d/' + id + '/view');
    const sub = { chapter: s.chapter, unit: s.unit || '', status: s.status || '' };
    if (ans && letters) sub.answers = ans.slice(0, 6000);
    if (drive.length) sub.drive = drive;
    if (s.ocrText && String(s.ocrText).trim()) sub.ocr = String(s.ocrText).replace(/\n{2,}/g, '\n').trim().slice(0, 2000);
    evs.push({ id: key('sub' + (++n)), t: Date.parse(s.receivedAt), type: 'msg', from: 'student', kind: 'submission', legacy: true, text: [ans && !letters ? ans : '', rem].filter(Boolean).join('\n\n'), files, sub });
  });

  // 6. the teacher's own judgments, private
  const mt = course.metrics || {}, notes = [];
  if ((mt.motivation || []).length) notes.push('Motivation check-ins (old dashboard): ' + mt.motivation.map(x => x.date + ' ' + x.score).join(', '));
  if (mt.responsiveness && mt.responsiveness.score != null) notes.push('Responsiveness: ' + mt.responsiveness.score + '/100 as of ' + (mt.responsiveness.asOf || '?') + (mt.responsiveness.note ? ' (' + mt.responsiveness.note + ')' : ''));
  if (username === 'seohu' && COURSE === CALC && (mt.chapterScores || []).length) notes.push('Hand-entered chapter scores (C/T): ' + mt.chapterScores.map(x => x.chapter + ' ' + (x.cScore == null ? '-' : x.cScore) + '/' + (x.tScore == null ? '-' : x.tScore)).join('; '));
  notes.forEach((t, i) => evs.push({ id: key('tn' + i), t: base - 5e5 + i, type: 'tnote', by: TEACHER, legacy: true, tag: 'old dashboard', text: t }));

  evs.sort((x, y) => x.t - y.t);
  out[username + '|' + COURSE] = evs;
  report[username + '|' + COURSE] = { events: evs.length, stagesDone: doneStages, feedback: (course.feedback || []).length, cards: (course.cheatSheet || []).length, notes: notes.length };
}
fs.writeFileSync(path.join(root, 'data', 'legacy-import.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
