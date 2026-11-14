// Logic tests for js/zp-store.js (derive, Today, spaced review, plan). Run: node scripts/test_platform.cjs
const assert = require('assert');
const ZP = require('../js/zp-store.js');
const DAY = ZP.DAY;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

const info = {
  order: ['1', '2', '3'],
  chapters: {
    '1': { title: 'Functions', hasC: true, hasT: true, cIds: ['1CA1', '1CA2', '1CA3'], tIds: ['1TA1', '1TA2'], exKeys: ['e1'], conceptKeys: ['k1'] },
    '2': { title: 'Limits', hasC: true, hasT: true, cIds: ['2CA1'], tIds: ['2TA1'], exKeys: [], conceptKeys: [] },
    '3': { title: 'Misc', hasC: true, hasT: false, cIds: ['3CA1'], tIds: [], exKeys: [], conceptKeys: [] }
  }
};
let clock = 1_000_000_000_000, seq = 0;
const ev = (type, d = {}) => Object.assign({ id: 'e' + (++seq), t: (clock += 1000), type }, d);
const later = days => { clock += days * DAY; };
const note = (pid, track = 'actual', extra = {}) => ev('note', Object.assign({ ch: '1', pid, src: 'C', track },
  track === 'careless' ? { stuck: 'I dropped a negative sign in step two, so next time I will check signs' } :
    { stuck: 'I did not see that the limit needs factoring first, so next time I try factoring', idea: 'Factor out the common term to cancel the zero in the denominator', signal: 'when I see 0/0, I try factoring' }, extra));


test('fresh student: current chapter 1, first action is Start Book', () => {
  const D = ZP.derive([], info, clock);
  assert.strictEqual(D.current, '1');
  const T = ZP.today(D, null, clock);
  assert.strictEqual(T.action.kind, 'stage'); assert.strictEqual(T.action.stage, 'B');
});

test('B has no gate: it can be submitted any time, and cards (examples, concepts) only count as information', () => {
  let D = ZP.derive([], info, clock);
  assert.ok(D.stages['1'].B.ready); assert.ok(!D.stages['1'].B.done);
  const evs2 = [ev('ex', { ch: '1', key: 'e1', label: 'Example 1' }), ev('concept', { ch: '1', key: 'k1', name: 'Function', text: 'a function maps each input to one output' }), ev('b_submit', { ch: '1' })];
  D = ZP.derive(evs2, info, clock);
  assert.ok(D.stages['1'].B.done); assert.strictEqual(D.stages['1'].B.exTot, 1); assert.strictEqual(D.stages['1'].next, 'C');
});

let evs = [ev('ex', { ch: '1', key: 'e1', label: 'Example 1' }), ev('concept', { ch: '1', key: 'k1', text: 'a function maps each input to one output' }), ev('b_submit', { ch: '1' })];
test('C: a wrong answer is pre-flagged; a right one (even with hints or a guess) is not until the student flags it', () => {
  evs.push(ev('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: false, conf: 'sure', ms: 4000 }));
  evs.push(ev('c_answer', { ch: '1', pid: '1CA2', answer: 'B', correct: true, conf: 'guess', ms: 3000 }));
  evs.push(ev('c_hint', { ch: '1', pid: '1CA3', level: 3 }));
  evs.push(ev('c_answer', { ch: '1', pid: '1CA3', answer: 'C', correct: true, conf: 'sure', ms: 9000 }));
  let D = ZP.derive(evs, info, clock);
  assert.deepStrictEqual(Object.keys(D.entries), ['1CA1']);
  assert.deepStrictEqual(D.entries['1CA1'].reasons, ['wrong']);
  assert.ok(D.entries['1CA1'].pending); assert.strictEqual(D.entries['1CA1'].status, 'to-write');
  assert.ok(D.stages['1'].C.done);
  // the student flags the other two (any problem, right or wrong)
  evs.push(ev('flag', { ch: '1', pid: '1CA2', on: true }), ev('flag', { ch: '1', pid: '1CA3', on: true }));
  D = ZP.derive(evs, info, clock);
  assert.deepStrictEqual(Object.keys(D.entries).sort(), ['1CA1', '1CA2', '1CA3']);
  assert.deepStrictEqual(D.entries['1CA2'].reasons, ['flag']);
  assert.ok(!D.stages['1'].R.done);
  assert.ok(D.stages['1'].T.locked, 'T is soft-locked until R is done');
});

test('first attempt counts even if a retry is correct', () => {
  const D = ZP.derive(evs.concat(ev('c_answer', { ch: '1', pid: '1CA1', answer: 'B', correct: true, ms: 1000 })), info, clock);
  assert.strictEqual(D.prob['1CA1'].first.correct, false);
  assert.ok(D.entries['1CA1']);
});

test('R: every flagged problem needs a valid entry (Careless or Actual); a half-written one does not count; there is no skip', () => {
  const base = evs.slice();
  let D = ZP.derive(base, info, clock);
  assert.ok(!D.stages['1'].R.done); assert.strictEqual(D.stages['1'].R.total, 3); assert.strictEqual(D.stages['1'].R.pending, 3);
  // too short / wrong type for the boxes -> still pending
  D = ZP.derive(base.concat(ev('note', { ch: '1', pid: '1CA1', track: 'careless', stuck: 'oops' })), info, clock);
  assert.ok(D.entries['1CA1'].pending);
  D = ZP.derive(base.concat(ev('note', { ch: '1', pid: '1CA1', track: 'actual', stuck: 'x'.repeat(40), idea: 'short' })), info, clock);
  assert.ok(D.entries['1CA1'].pending, 'Actual needs the main idea at full length too');
  // a cold redo or an old-style skip no longer finishes anything
  D = ZP.derive(base.concat(ev('redo', { ch: '1', pid: '1CA1', answer: 'B', correct: true, src: 'R' })), info, clock);
  assert.ok(D.entries['1CA1'].pending);
  // Careless: one short box; Actual: missed + idea
  const n1 = note('1CA1', 'actual'), n2 = note('1CA2', 'careless'), n3 = note('1CA3', 'actual');
  D = ZP.derive(base.concat(n1, n2), info, clock);
  assert.ok(!D.stages['1'].R.done);
  D = ZP.derive(base.concat(n1, n2, n3), info, clock);
  assert.ok(D.stages['1'].R.done); assert.ok(!D.stages['1'].T.locked);
  assert.strictEqual(D.entries['1CA1'].track, 'actual'); assert.strictEqual(D.entries['1CA2'].track, 'careless');
  assert.strictEqual(D.entries['1CA1'].status, 'written');
  evs.push(n1, n2, n3);
});

test('a note needs only some text: category and "when I see" are optional', () => {
  assert.ok(ZP.noteValid({ idea: 'sign slip' }));
  assert.ok(ZP.noteValid({ stuck: 'no idea how to start' }));
  assert.ok(!ZP.noteValid({ miss: 'concept' }), 'a category alone is not a note');
  assert.ok(!ZP.noteValid(null));
});

test('flag works on a RIGHT answer; unflag drops a practice/chapter miss, until the next wrong attempt; a test miss cannot be unflagged', () => {
  const x = [ev('c_answer', { ch: '1', pid: '1CA1', answer: 'B', correct: true, conf: 'sure', ms: 3000 })];
  let D = ZP.derive(x, info, clock);
  assert.strictEqual(Object.keys(D.entries).length, 0, 'a clean right answer is not flagged');
  x.push(ev('flag', { ch: '1', pid: '1CA1', on: true }));
  D = ZP.derive(x, info, clock);
  assert.deepStrictEqual(D.entries['1CA1'].reasons, ['flag']); assert.strictEqual(D.entries['1CA1'].status, 'to-write');
  // unflag a pre-flagged miss
  x.push(ev('c_answer', { ch: '1', pid: '1CA2', answer: 'A', correct: false, ms: 1000 }));
  assert.ok(ZP.derive(x, info, clock).entries['1CA2']);
  x.push(ev('flag', { ch: '1', pid: '1CA2', on: false }));
  assert.ok(!ZP.derive(x, info, clock).entries['1CA2'], 'unflagged');
  // wrong again later -> flagged again
  x.push(ev('c_answer', { ch: '1', pid: '1CA2', answer: 'A', correct: false, ms: 1000 }));
  assert.ok(ZP.derive(x, info, clock).entries['1CA2']);
  // legacy review_skip / review_add behave as unflag / flag
  x.push(ev('review_skip', { ch: '1', pid: '1CA2' }));
  assert.ok(!ZP.derive(x, info, clock).entries['1CA2']);
  // a miss on a chapter test is always reviewed, even after an unflag
  x.push(ev('t_submit', { ch: '1', kind: 'T', aid: 'z', pids: ['1CA2'], answers: {}, ms: {}, result: { '1CA2': 'incorrect' }, chOf: {}, score: { correct: 0, total: 1 } }));
  x.push(ev('flag', { ch: '1', pid: '1CA2', on: false }));
  D = ZP.derive(x, info, clock);
  assert.ok(D.entries['1CA2'] && D.entries['1CA2'].forced);
});

test('one record per question: attempts from practice, chapter, review redo, test and mock all land together', () => {
  const x = [
    ev('c_answer', { ch: '1', pid: '1TA1', answer: 'A', correct: false, ctx: 'practice', ms: 2000 }),
    ev('redo', { ch: '1', pid: '1TA1', answer: 'B', correct: true, src: 'R' }),
    ev('t_submit', { ch: '1', kind: 'T', aid: 'a', pids: ['1TA1', '1TA2'], answers: { '1TA1': 'B' }, ms: { '1TA1': 5000 }, result: { '1TA1': 'correct', '1TA2': 'unanswered' }, chOf: {}, score: { correct: 1, total: 2 } }),
    ev('t_submit', { ch: '', kind: 'MOCK', aid: 'b', pids: ['1TA1'], answers: { '1TA1': 'B' }, ms: {}, result: { '1TA1': 'correct' }, chOf: { '1TA1': '1' }, score: { correct: 1, total: 1 } })
  ];
  const D = ZP.derive(x, info, clock), q = D.q['1TA1'];
  assert.strictEqual(q.n, 4);
  assert.deepStrictEqual(q.attempts.map(a => a.ctx), ['practice', 'review', 'test', 'mock']);
  assert.strictEqual(q.right, 3); assert.strictEqual(q.wrong, 1);
  assert.strictEqual(D.q['1TA2'].wrong, 1, 'an unanswered test question counts as a missed attempt');
  assert.ok(!D.q['1TA3']);
});

test('practice on a T-bank problem does not count toward the chapter R stage, but a chapter-test miss still counts for T', () => {
  const x = [ev('c_answer', { ch: '1', pid: '1TA1', answer: 'A', correct: false, ctx: 'practice', ms: 1000 })];
  let D = ZP.derive(x, info, clock);
  assert.strictEqual(D.entries['1TA1'].src, 'P');
  assert.strictEqual(D.stages['1'].R.entries, 0, 'a T-bank practice miss is not a chapter C review item');
  x.push(ev('t_submit', { ch: '1', kind: 'T', aid: 't', pids: ['1TA1', '1TA2'], answers: {}, ms: {}, result: { '1TA1': 'incorrect', '1TA2': 'correct' }, chOf: {}, score: { correct: 1, total: 2 } }));
  D = ZP.derive(x, info, clock);
  assert.deepStrictEqual(D.entries['1TA1'].srcs.sort(), ['P', 'T']);
  assert.strictEqual(D.entries['1TA1'].src, 'T');
  assert.strictEqual(D.stages['1'].V.total, 1);
});

test('any attempt on a chapter C problem counts toward the C stage, even from a mock', () => {
  const x = [ev('t_submit', { ch: '', kind: 'MOCK', aid: 'm', pids: ['1CA1'], answers: {}, ms: {}, result: { '1CA1': 'correct' }, chOf: { '1CA1': '1' }, score: { correct: 1, total: 1 } })];
  const D = ZP.derive(x, info, clock);
  assert.strictEqual(D.stages['1'].C.cur, 1);
});

test('FSRS: first redo 3 days after the note; a miss goes shaky and returns within 2 days; successes stretch out until resolved', () => {
  const pid = '1CA1';
  let D = ZP.derive(evs, info, clock);
  const startT = D.completeT[pid];
  assert.strictEqual(D.entries[pid].due, startT + 3 * DAY, 'stock FSRS first interval at 90% retention is 3 days');
  const due0 = D.entries[pid].due;
  assert.ok(!ZP.dueEntries(D, due0 - 1).some(e => e.pid === pid));
  assert.ok(ZP.dueEntries(D, due0 + 1).some(e => e.pid === pid));
  // wrong redo on the due date -> Again -> shaky, back in about a day
  const miss = Object.assign(ev('redo', { ch: '1', pid, answer: 'A', correct: false, src: 'spaced' }), { t: due0 });
  D = ZP.derive(evs.concat(miss), info, due0 + 1000);
  assert.strictEqual(D.entries[pid].status, 'shaky');
  assert.ok(D.entries[pid].due > due0 && D.entries[pid].due <= due0 + 2 * DAY);
  assert.strictEqual(D.entries[pid].lapses, 1);
  // keep passing on the due date: stability must grow, intervals must stretch, and it must resolve
  let all = evs.concat(miss), prevStab = D.entries[pid].stability, prevInt = 0, resolved = false;
  for (let i = 0; i < 8 && !resolved; i++) {
    const t = D.entries[pid].due;
    const ok = Object.assign(ev('redo', { ch: '1', pid, answer: 'B', correct: true, src: 'spaced' }), { t });
    all = all.concat(ok); D = ZP.derive(all, info, t + 1000);
    const en = D.entries[pid];
    if (en.status === 'resolved') { resolved = true; assert.strictEqual(en.due, null); break; }
    assert.strictEqual(en.status, 'redone');
    assert.ok(en.stability > prevStab, 'stability grows on success');
    assert.ok(en.card.lastIntervalDays >= prevInt, 'intervals do not shrink on success');
    prevStab = en.stability; prevInt = en.card.lastIntervalDays;
  }
  assert.ok(resolved, 'enough on-time successes resolve the card');
  evs.push(miss);
  evs.push(...all.slice(evs.length).filter(e => e.type === 'redo'));
});

test('FSRS: Hard < Good < Easy intervals, and Again is the shortest', () => {
  const card = ZP.FSRS.grade(ZP.FSRS.blank(), 3, 0);
  const p = ZP.FSRS.preview(card, 3 * DAY);
  assert.ok(p[1] <= p[2] && p[2] <= p[3] && p[3] < p[4], JSON.stringify(p));
});

test('T is only taking the test; R (test) needs an entry for every miss (misses are forced), and the next-time rule is optional', () => {
  const sub = ev('t_submit', { ch: '1', kind: 'T', aid: 'a1', pids: ['1TA1', '1TA2'], answers: { '1TA1': 'A' }, result: { '1TA1': 'incorrect', '1TA2': 'unanswered' }, chOf: {}, score: { correct: 0, total: 2 } });
  evs.push(sub);
  let D = ZP.derive(evs, info, clock);
  assert.strictEqual(D.entries['1TA1'].src, 'T'); assert.ok(D.entries['1TA1'].forced);
  assert.ok(D.stages['1'].T.done, 'submitting finishes T');
  assert.ok(!D.stages['1'].V.done); assert.strictEqual(D.stages['1'].V.pending, 2);
  evs.push(note('1TA1', 'careless', { src: 'T' }));
  D = ZP.derive(evs, info, clock);
  assert.ok(!D.stages['1'].V.done, 'one miss still has no entry');
  // unflagging a test miss does nothing
  D = ZP.derive(evs.concat(ev('flag', { ch: '1', pid: '1TA2', on: false })), info, clock);
  assert.strictEqual(D.stages['1'].V.pending, 1);
  evs.push(note('1TA2', 'actual', { src: 'T' }));
  D = ZP.derive(evs, info, clock);
  assert.ok(D.stages['1'].V.done);
  assert.strictEqual(D.stages['1'].next, 'X');
});

test('Close needs a Concepts Notebook summary; finishing moves the current chapter on and offers a warm-up', () => {
  let D = ZP.derive(evs, info, clock);
  assert.strictEqual(D.stages['1'].next, 'X');
  evs.push(ev('cnote', { ch: '1', summary: 'idea '.repeat(25), sections: [] }));
  D = ZP.derive(evs, info, clock);
  assert.ok(D.stages['1'].X.ready);
  evs.push(ev('close', { ch: '1' }));
  D = ZP.derive(evs, info, clock);
  assert.ok(D.stages['1'].complete);
  assert.strictEqual(D.current, '2');
  const T = ZP.today(D, null, clock);
  // chapter 1 T misses not yet redone -> warm-up before chapter 2
  assert.strictEqual(T.action.kind, 'warmup');
  assert.strictEqual(T.warmup.length, 2);
  assert.strictEqual(T.warmupFrom, '1');
});

test('chapter without a T bank (ch 3) skips T and still closes', () => {
  const D = ZP.derive([], info, clock);
  assert.deepStrictEqual(D.stages['3'].seq, ['B', 'C', 'R', 'X']);
  const D1 = ZP.derive([], info, clock);
  assert.deepStrictEqual(D1.stages['1'].seq, ['B', 'C', 'R', 'T', 'V', 'X']);
});

test('plan: generates chapter spans with overlap, mocks, exam, and warns on overrun', () => {
  const chapters = [1, 2, 3, 4, 5, 6].map(c => ({ ch: String(c), title: 'T' + c, hasT: true }));
  const { plan, warnings } = ZP.generatePlan(chapters, { start: '2026-11-09', exam: '2027-05-10', pace: 9, overlap: 2, mockEvery: 5 });
  const ch = plan.milestones.filter(m => m.type === 'chapter');
  assert.strictEqual(ch[0].start, '2026-11-09'); assert.strictEqual(ch[0].end, '2026-11-17');
  assert.strictEqual(ch[1].start, '2026-11-16', 'next chapter overlaps by 2 days');
  assert.ok(plan.milestones.some(m => m.id === 'mock1'));
  assert.ok(plan.milestones.some(m => m.type === 'exam' && m.start === '2027-05-10'));
  assert.deepStrictEqual(warnings, []);
  const tight = ZP.generatePlan(chapters, { start: '2027-04-20', exam: '2027-05-10', pace: 9 });
  assert.ok(tight.warnings.length === 1);
});

test('plan status: on track / behind / ahead', () => {
  const { plan } = ZP.generatePlan([{ ch: '1', title: 'F', hasT: true }], { start: '2026-11-09', pace: 9 });
  const d = iso => ZP.parseISO(iso) + 12 * 3600e3;
  assert.strictEqual(ZP.planStatus(plan, '1', false, d('2026-11-12')).state, 'on');
  assert.strictEqual(ZP.planStatus(plan, '1', false, d('2026-11-20')).state, 'behind');
  assert.strictEqual(ZP.planStatus(plan, '1', true, d('2026-11-12')).state, 'ahead');
});

test('stats: per-chapter accuracy, weak ranking, queue counts, sessions', () => {
  const info2 = { order: ['1', '2'], chapters: { '1': { title: 'F', hasC: true, hasT: true, cIds: [], tIds: [], exKeys: [], conceptKeys: [] }, '2': { title: 'L', hasC: true, hasT: false, cIds: [], tIds: [], exKeys: [], conceptKeys: [] } } };
  const e2 = [];
  const mk = (type, d) => { const x = ev(type, d); e2.push(x); return x; };
  for (let i = 0; i < 6; i++) mk('c_answer', { ch: '1', pid: '1CA' + i, answer: 'A', correct: i < 5, ms: 4000 });
  for (let i = 0; i < 6; i++) mk('c_answer', { ch: '2', pid: '2CA' + i, answer: 'A', correct: i < 2, ms: 8000 });
  mk('c_hint', { ch: '2', pid: '2CA0', level: 4 });
  const D = ZP.derive(e2, info2, clock), st = ZP.stats(D, info2, clock);
  assert.strictEqual(st.byChapter['1'].attempted, 6);
  assert.ok(Math.abs(st.byChapter['1'].pct - 5 / 6) < 1e-9);
  assert.strictEqual(st.byChapter['2'].avgSec, 8);
  assert.deepStrictEqual(st.weak, ['2', '1'], 'weakest chapter first');
  assert.strictEqual(st.byChapter['2'].hinted, 1);
  assert.strictEqual(st.queue.needsNote, st.queue.total);
  assert.strictEqual(st.overall.seen, 12);
});

test('custom test (TEST) and mock misses become entries tagged U / M and count in stats', () => {
  const info2 = { order: ['1'], chapters: { '1': { title: 'F', hasC: true, hasT: true, cIds: [], tIds: ['1TA1'], exKeys: [], conceptKeys: [] } } };
  const a = ev('t_submit', { ch: '', kind: 'TEST', aid: 'x', pids: ['1TA1', '1TA2'], answers: {}, ms: { '1TA1': 5000 }, result: { '1TA1': 'incorrect', '1TA2': 'correct' }, chOf: { '1TA1': '1', '1TA2': '1' }, score: { correct: 1, total: 2 }, minutes: 5, usedSec: 60 });
  const b = ev('t_submit', { ch: '', kind: 'MOCK', aid: 'y', pids: ['1TA3'], answers: {}, ms: {}, result: { '1TA3': 'unanswered' }, chOf: { '1TA3': '1' }, score: { correct: 0, total: 1 }, minutes: 5, usedSec: 60 });
  const D = ZP.derive([a, b], info2, clock);
  assert.strictEqual(D.entries['1TA1'].src, 'U'); assert.strictEqual(D.entries['1TA3'].src, 'M');
  assert.strictEqual(D.stages['1'].T.submitted, false, 'custom tests must not satisfy the chapter T stage');
  const st = ZP.stats(D, info2, clock);
  assert.strictEqual(st.byChapter['1'].testN, 3); assert.strictEqual(st.byChapter['1'].testRight, 1);
  assert.strictEqual(st.sessions.length, 2);
});

test('problem codes: 1CA3 -> C1A3, 4TB12 -> T4B12, 11CA7 -> C11-A7; search normalisation ignores case and separators', () => {
  assert.strictEqual(ZP.code('1CA3'), 'C1A3'); assert.strictEqual(ZP.code('4TB12'), 'T4B12'); assert.strictEqual(ZP.code('11CA7'), 'C11-A7');
  assert.strictEqual(ZP.normCode('c11 - a7'), ZP.normCode('C11-A7'));
});

test('retry rules: an immediate retry does not count; a right attempt a day+ later after the entry is a Good review; a later miss is Again', () => {
  const T0 = 5_000_000_000_000;
  const at = (type, d, t) => Object.assign(ev(type, d), { t });
  const wrong = at('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: false, ctx: 'chapter', ms: 1000 }, T0);
  const entry = Object.assign(note('1CA1', 'actual'), { t: T0 + 3600e3 });
  // immediate retry (10 min later) is recorded but changes nothing: still to write
  let D = ZP.derive([wrong, at('c_answer', { ch: '1', pid: '1CA1', answer: 'B', correct: true, ctx: 'chapter', ms: 1000 }, T0 + 600e3)], info, T0 + 700e3);
  assert.strictEqual(D.entries['1CA1'].status, 'to-write'); assert.strictEqual(D.pstatus['1CA1'], 'review');
  assert.strictEqual(D.q['1CA1'].n, 2, 'both attempts are still recorded');
  // entry written, then right again 2 days later in Practice -> counts as a Good review
  D = ZP.derive([wrong, entry, at('c_answer', { ch: '1', pid: '1CA1', answer: 'B', correct: true, ctx: 'practice', ms: 1000 }, T0 + 2 * DAY)], info, T0 + 2 * DAY + 1000);
  assert.strictEqual(D.entries['1CA1'].status, 'redone'); assert.ok(D.entries['1CA1'].due > T0 + 2 * DAY);
  // a later wrong attempt on a problem that already has its entry is an Again grade, not a second entry to write
  D = ZP.derive([wrong, entry, at('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: false, ctx: 'practice', ms: 1000 }, T0 + 2 * DAY)], info, T0 + 2 * DAY + 1000);
  assert.ok(!D.entries['1CA1'].pending); assert.strictEqual(D.entries['1CA1'].status, 'shaky');
  // a clean right answer is Done; a later miss on it flags it
  const clean = [at('c_answer', { ch: '1', pid: '1CA2', answer: 'B', correct: true, conf: 'sure', ctx: 'practice', ms: 1000 }, T0)];
  D = ZP.derive(clean, info, T0 + 1000); assert.strictEqual(D.pstatus['1CA2'], 'done'); assert.ok(!D.pstatus['1CA3']);
  D = ZP.derive(clean.concat(at('c_answer', { ch: '1', pid: '1CA2', answer: 'A', correct: false, ctx: 'mock', ms: 1000 }, T0 + 3 * DAY)), info, T0 + 3 * DAY + 1);
  assert.strictEqual(D.pstatus['1CA2'], 'review'); assert.ok(D.entries['1CA2'].pending);
});

test('Careless vs Actual: Careless resolves after one clean redo on a lighter schedule; Actual runs the full FSRS schedule; a wrong Careless redo is just Again', () => {
  const T0 = 6_000_000_000_000;
  const at = (type, d, t) => Object.assign(ev(type, d), { t });
  const mk = track => [at('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: false, ctx: 'chapter', ms: 1000 }, T0), Object.assign(note('1CA1', track), { t: T0 + 1000 })];
  const careless = ZP.derive(mk('careless'), info, T0 + 2000).entries['1CA1'], actual = ZP.derive(mk('actual'), info, T0 + 2000).entries['1CA1'];
  assert.ok(careless.due >= actual.due, 'lower target recall (0.8) schedules the first redo no sooner');
  assert.strictEqual(careless.ret, 0.8); assert.strictEqual(actual.ret, 0.9);
  const redoAt = (e, ok) => at('redo', { ch: '1', pid: '1CA1', answer: 'B', correct: ok, src: 'spaced' }, e.due);
  // clean redo: careless resolves, actual is only scheduled further out
  assert.strictEqual(ZP.derive(mk('careless').concat(redoAt(careless, true)), info, careless.due + 1).entries['1CA1'].status, 'resolved');
  assert.strictEqual(ZP.derive(mk('actual').concat(redoAt(actual, true)), info, actual.due + 1).entries['1CA1'].status, 'redone');
  // wrong careless redo: shaky, comes back, and upgrading to Actual (a new entry) switches the track
  let D = ZP.derive(mk('careless').concat(redoAt(careless, false)), info, careless.due + 1);
  assert.strictEqual(D.entries['1CA1'].status, 'shaky'); assert.strictEqual(D.entries['1CA1'].track, 'careless');
  D = ZP.derive(mk('careless').concat(redoAt(careless, false), Object.assign(note('1CA1', 'actual'), { t: careless.due + 500 })), info, careless.due + 1000);
  assert.strictEqual(D.entries['1CA1'].track, 'actual');
});

test('daily review queue: Actual first, then oldest due, filled up to the minute budget (an FRQ costs more); at least one always shows', () => {
  const T0 = 7_000_000_000_000, at = (type, d, t) => Object.assign(ev(type, d), { t });
  const pids = ['1CA1', '1CA2', '1CA3'], tracks = ['careless', 'actual', 'careless'];
  const x = [];
  pids.forEach((pid, i) => { x.push(at('c_answer', { ch: '1', pid, answer: 'A', correct: false, ctx: 'chapter', ms: 1000 }, T0 + i), Object.assign(note(pid, tracks[i]), { t: T0 + 10 + i })); });
  const D = ZP.derive(x, info, T0 + 30 * DAY), cost = pid => pid === '1CA2' ? 10 : 1.5;
  const q = ZP.dailyQueue(D, T0 + 30 * DAY, cost, 10);
  assert.deepStrictEqual(q.all.map(e => e.pid), ['1CA2', '1CA1', '1CA3'], 'Actual before Careless');
  assert.deepStrictEqual(q.items.map(e => e.pid), ['1CA2'], 'a 10 min FRQ-sized card uses the whole 10 min budget; the rest roll over');
  assert.strictEqual(ZP.dailyQueue(D, T0 + 30 * DAY, cost, 1).items.length, 1, 'always at least one');
});

test('cards: the only decision is the review button; a flagged card joins the queue; delete removes it; card_redo grades it on FSRS', () => {
  const T0 = 8_000_000_000_000, at = (type, d, t) => Object.assign(ev(type, d), { t });
  const concept = at('concept', { ch: '1', key: 'k1', name: 'Function', text: 'a function maps each input to exactly one output' }, T0);
  const example = at('ex', { ch: '1', key: 'e1', label: 'Example 1' }, T0);
  let D = ZP.derive([concept, example], info, T0 + 1000);
  assert.ok(!D.cards['k:1:k1'] && !D.cards['x:1:e1'], 'nothing is in the queue until the student adds it');
  const flag = at('card_flag', { ch: '1', kind: 'concept', key: 'k1', on: true }, T0 + 10);
  D = ZP.derive([concept, example, flag, at('card_flag', { ch: '1', kind: 'example', key: 'e1', on: true }, T0 + 11)], info, T0 + 1000);
  const c = D.cards['k:1:k1'];
  assert.ok(c && c.isCard && c.kind === 'concept' && c.title === 'Function'); assert.strictEqual(c.due, T0 + 10 + 3 * DAY);
  assert.ok(D.cards['x:1:e1'] && D.cards['x:1:e1'].kind === 'example');
  // no text needed: an empty concept card can still be reviewed
  assert.ok(ZP.derive([at('concept', { ch: '1', key: 'k1', name: 'Function', text: '' }, T0), flag], info, T0 + 1000).cards['k:1:k1']);
  // unflag removes it
  assert.ok(!ZP.derive([concept, flag, at('card_flag', { ch: '1', kind: 'concept', key: 'k1', on: false }, T0 + 20)], info, T0 + 1000).cards['k:1:k1']);
  // due, queue, grading
  const due = c.due;
  D = ZP.derive([concept, flag], info, due + 1);
  assert.deepStrictEqual(ZP.dueEntries(D, due + 1).map(e => e.pid), ['k:1:k1']);
  assert.strictEqual(ZP.dailyQueue(D, due + 1, () => 5, 15).items[0].isCard, true);
  D = ZP.derive([concept, flag, at('card_redo', { ch: '1', kind: 'concept', key: 'k1', grade: 3 }, due)], info, due + 1000);
  assert.strictEqual(D.cards['k:1:k1'].status, 'redone'); assert.ok(D.cards['k:1:k1'].due > due);
  // delete hides it everywhere; restore brings it back
  const body = { ch: '1', key: 'k1', name: 'Function', text: 'a function maps each input to exactly one output' };
  D = ZP.derive([concept, flag, at('concept', Object.assign({ deleted: true }, body), T0 + 20)], info, T0 + 1000);
  assert.ok(!D.cards['k:1:k1']); assert.strictEqual(D.stages['1'].B.cpTot, 0);
  D = ZP.derive([concept, flag, at('concept', Object.assign({ deleted: true }, body), T0 + 20), at('concept', Object.assign({ deleted: false }, body), T0 + 30)], info, T0 + 1000);
  assert.strictEqual(D.stages['1'].B.cpTot, 1);
});

test('a self-scored FRQ in a mock is an attempt: 75%+ is right, lower is a forced miss, a re-score replaces it', () => {
  const T0 = 9_000_000_000_000, at = (type, d, t) => Object.assign(ev(type, d), { t });
  const sub = at('t_submit', { ch: '', kind: 'MOCK', aid: 'm1', mockId: 'ap-2025', pids: [], frqPids: ['1CA1', '1CA2'], answers: {}, ms: {}, result: {}, chOf: { '1CA1': '1', '1CA2': '1' }, score: { correct: 0, total: 0 }, spec: { scoring: { frqMaxEach: 9 } } }, T0);
  let D = ZP.derive([sub], info, T0 + 10);
  assert.ok(!D.q['1CA1'], 'not scored yet: no attempt');
  const s1 = at('frq_score', { aid: sub.id, pid: '1CA1', score: 8 }, T0 + 20), s2 = at('frq_score', { aid: sub.id, pid: '1CA2', score: 4 }, T0 + 21);
  D = ZP.derive([sub, s1, s2], info, T0 + 30);
  assert.strictEqual(D.q['1CA1'].right, 1); assert.strictEqual(D.q['1CA2'].wrong, 1);
  assert.ok(D.entries['1CA2'] && D.entries['1CA2'].forced && D.entries['1CA2'].pending, 'a low FRQ score goes to the Inbox, unflaggable');
  assert.ok(!D.entries['1CA1']); assert.strictEqual(D.pstatus['1CA1'], 'done');
  D = ZP.derive([sub, s1, s2, at('frq_score', { aid: sub.id, pid: '1CA2', score: 9 }, T0 + 40)], info, T0 + 50);
  assert.strictEqual(D.q['1CA2'].n, 1); assert.strictEqual(D.q['1CA2'].right, 1); assert.strictEqual(D.q['1CA2'].wrong, 0);
  assert.ok(!D.entries['1CA2'], 're-scoring higher removes the miss');
});

test('activity: effort per local day, current / longest streak (yesterday keeps a streak alive), forecast and weekly trend', () => {
  const noon = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
  const NOW = noon(2026, 11, 10);
  const at = (type, d, t) => Object.assign(ev(type, d), { t });
  const x = [];
  [5, 6, 7, 8, 9].forEach(d => { x.push(at('c_answer', { ch: '1', pid: '1CA1', answer: 'B', correct: true, ctx: 'practice' }, noon(2026, 11, d))); });
  x.push(at('c_answer', { ch: '1', pid: '1CA2', answer: 'A', correct: false, ctx: 'practice' }, noon(2026, 11, 9)));
  x.push(at('c_answer', { ch: '1', pid: '1CA2', answer: 'B', correct: true, ctx: 'practice' }, noon(2026, 11, 1)));
  const D = ZP.derive(x, info, NOW), st = ZP.stats(D, info, NOW);
  assert.strictEqual(D.activity['2026-11-09'], 2); assert.strictEqual(st.streak.current, 5, 'today is empty but yesterday counts, so the streak is 5');
  assert.strictEqual(st.streak.longest, 5); assert.strictEqual(st.streak.activeDays, 6);
  assert.strictEqual(st.forecast.length, 14); assert.strictEqual(st.trend.length, 10);
  assert.ok(st.history.some(h => h.what === 'Practice' && h.n === 2));
  const D2 = ZP.derive(x.concat(at('c_answer', { ch: '1', pid: '1CA3', answer: 'B', correct: true, ctx: 'practice' }, NOW)), info, NOW);
  assert.strictEqual(ZP.stats(D2, info, NOW).streak.current, 6);
});


/* ---------- mentor layer ---------- */
const mk = (type, d, t) => Object.assign({ id: 'm' + (++seq), t, type }, d);
const NOW0 = new Date(2026, 10, 10, 12).getTime(), iso = ms => ZP.dayKey(ms);

test('per-student requirements: a criteria event changes what counts, null resets, values are clamped', () => {
  const base = [mk('concept', { ch: '1', key: 'k1', text: 'a function maps each input to one output' }, NOW0 - 5000)];
  let D = ZP.derive(base, info, NOW0);
  assert.strictEqual(D.stages['1'].B.cpOk, 1, 'default needs 3 words');
  D = ZP.derive(base.concat(mk('criteria', { set: { conceptWords: 100, carelessChars: 1, dailyReviewMin: 999, bogus: 5 } }, NOW0 - 4000)), info, NOW0);
  assert.strictEqual(D.stages['1'].B.cpOk, 0, 'now needs 100 words');
  assert.strictEqual(D.req.carelessChars, 5, 'clamped to the minimum'); assert.strictEqual(D.req.dailyReviewMin, 90, 'clamped to the maximum'); assert.ok(!('bogus' in D.req));
  assert.ok(!ZP.entryComplete({ track: 'careless', stuck: 'abcd' }) && ZP.entryComplete({ track: 'careless', stuck: 'abcde' }), 'entryComplete reads the derived requirement');
  D = ZP.derive(base.concat(mk('criteria', { set: { conceptWords: 100 } }, NOW0 - 4000), mk('criteria', { set: { conceptWords: null } }, NOW0 - 3000)), info, NOW0);
  assert.strictEqual(D.stages['1'].B.cpOk, 1, 'null resets to the default'); ZP.derive([], info, NOW0);
  assert.strictEqual(ZP.req().carelessChars, 15, 'defaults come back for the next student');
});

test('tasks: a practice set finishes when every problem has an attempt after it was assigned; stage tasks follow the stage; free tasks are marked; overdue is derived', () => {
  const old = mk('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: true, ctx: 'practice' }, NOW0 - 9 * DAY);
  const ev0 = [old, mk('task', { key: 'a', kind: 'practice', title: 'Set', pids: ['1CA1', '1CA2'], forced: true, due: iso(NOW0 + DAY), by: 't' }, NOW0 - 2 * DAY),
    mk('task', { key: 'b', kind: 'stage', title: 'Do B', ch: '1', stage: 'B', forced: false }, NOW0 - 2 * DAY), mk('task', { key: 'c', kind: 'free', title: 'Read', forced: true, due: iso(NOW0 - 3 * DAY) }, NOW0 - 6 * DAY)];
  let D = ZP.derive(ev0, info, NOW0), T = k => D.tasks.filter(t => t.key === k)[0];
  assert.strictEqual(T('a').cur, 0, 'the attempt from before the task does not count'); assert.ok(!T('a').done);
  assert.strictEqual(T('c').status, 'overdue'); assert.strictEqual(T('a').status, 'open');
  D = ZP.derive(ev0.concat(mk('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: true }, NOW0 - 1000), mk('c_answer', { ch: '1', pid: '1CA2', answer: 'B', correct: false }, NOW0 - 900)), info, NOW0);
  assert.ok(T('a').done, 'both tried after the assignment, right or wrong');
  D = ZP.derive(ev0.concat(mk('b_submit', { ch: '1' }, NOW0 - 500)), info, NOW0); assert.ok(T('b').done, 'stage B submitted');
  D = ZP.derive(ev0.concat(mk('task_done', { key: 'c' }, NOW0 - 400)), info, NOW0); assert.ok(T('c').done && T('c').doneBy === 'you');
  D = ZP.derive(ev0.concat(mk('task', { key: 'c', deleted: true }, NOW0 - 300)), info, NOW0); assert.ok(!T('c'), 'deleted tasks disappear');
  D = ZP.derive(ev0.concat(mk('task', { key: 'a', kind: 'practice', title: 'Set 2', pids: ['1CA1'], forced: true }, NOW0 - 100)), info, NOW0); assert.strictEqual(T('a').title, 'Set 2', 'latest per key wins');
});

test('Right Now ranks required tasks, then reviews, then the inbox, then the calendar, then suggestions, then the plan', () => {
  const x = [];
  // a Careless entry whose first review is due, and an unwritten miss in the inbox
  x.push(mk('c_answer', { ch: '1', pid: '1CA1', answer: 'A', correct: false, ctx: 'chapter' }, NOW0 - 20 * DAY));
  x.push(mk('note', { ch: '1', pid: '1CA1', src: 'C', track: 'careless', stuck: 'I dropped a negative sign in step two, so next time I will check signs' }, NOW0 - 19 * DAY));
  x.push(mk('c_answer', { ch: '1', pid: '1CA2', answer: 'A', correct: false, ctx: 'chapter' }, NOW0 - DAY));
  x.push(mk('cal_item', { key: 'cal1', date: iso(NOW0), title: 'My own to-do', kind: 'todo' }, NOW0 - DAY));
  x.push(mk('task', { key: 'sug', kind: 'free', title: 'Suggested read', forced: false, due: iso(NOW0 + 2 * DAY), by: 't' }, NOW0 - DAY));
  x.push(mk('task', { key: 'req2', kind: 'free', title: 'Required, due later', forced: true, due: iso(NOW0 + 3 * DAY), by: 't' }, NOW0 - DAY));
  x.push(mk('task', { key: 'req1', kind: 'free', title: 'Required, overdue', forced: true, due: iso(NOW0 - DAY), by: 't' }, NOW0 - 2 * DAY));
  const D = ZP.derive(x, info, NOW0), R = ZP.rightNow(D, { now: NOW0, course: 'c' });
  assert.deepStrictEqual(R.items.map(i => i.id), ['task:req1', 'task:req2', 'reviews', 'inbox', 'cal:cal1', 'task:sug', 'plan']);
  assert.strictEqual(R.top.title, 'Required, overdue'); assert.ok(/overdue/.test(R.top.why));
  assert.deepStrictEqual(R.items.map(i => i.tier), [1, 1, 2, 3, 4, 5, 6]);
  // finishing the top item promotes the next
  const D2 = ZP.derive(x.concat(mk('task_done', { key: 'req1' }, NOW0 - 10)), info, NOW0);
  assert.strictEqual(ZP.rightNow(D2, { now: NOW0, course: 'c' }).top.title, 'Required, due later');
  const clear = ZP.rightNow(ZP.derive([mk('close', { ch: '1' }, NOW0), mk('close', { ch: '2' }, NOW0), mk('close', { ch: '3' }, NOW0)], info, NOW0), { now: NOW0, course: 'c' });
  assert.ok(clear.top && clear.top.kind === 'plan' && /complete/i.test(clear.top.title), 'with nothing else the plan says every chapter is complete');
});

test('mentor messages: unread both ways, read markers, proposals and replies; mentor events are not student activity', () => {
  const m1 = mk('msg', { from: 'student', kind: 'question', text: 'help' }, NOW0 - 3000), p1 = mk('msg', { from: 'student', kind: 'proposal', text: '', prop: { title: 'Review', date: iso(NOW0 + DAY), time: '18:00', len: 60 } }, NOW0 - 2000);
  const t1 = mk('msg', { from: 'teacher', kind: 'nudge', text: 'go', by: 'kyjteach' }, NOW0 - 1000), leg = mk('msg', { from: 'teacher', kind: 'feedback', text: 'old', legacy: true, by: 'kyjteach' }, NOW0 - 9000);
  let D = ZP.derive([m1, p1, t1, leg], info, NOW0);
  assert.strictEqual(D.unread.teacher.length, 2); assert.strictEqual(D.unread.student.length, 1, 'imported messages are never unread');
  assert.strictEqual(D.props.length, 1); assert.strictEqual(D.props[0].status, 'pending');
  assert.strictEqual(D.lastT, NOW0 - 2000, 'the mentor nudge does not move the student\'s last-active time');
  D = ZP.derive([m1, p1, t1, mk('msg_read', { by: 'teacher', upTo: NOW0 - 1500 }, NOW0 - 500), mk('msg_read', { by: 'student', upTo: NOW0 }, NOW0 - 400), mk('prop_reply', { ref: p1.id, status: 'accepted', by: 'kyjteach' }, NOW0 - 300)], info, NOW0);
  assert.strictEqual(D.unread.teacher.length, 0); assert.strictEqual(D.unread.student.length, 0); assert.strictEqual(D.props[0].status, 'accepted');
});

test('calendar: ticking an item is its own event, so a mentor-made item keeps its author; reminders list events in the next two days', () => {
  const c = mk('cal_item', { key: 'k', date: iso(NOW0 + DAY), time: '18:00', title: 'Session', kind: 'event', remind: [1440, 60], by: 'kyjteach' }, NOW0 - 1000);
  let D = ZP.derive([c, mk('cal_done', { key: 'k', done: true }, NOW0 - 500)], info, NOW0);
  assert.ok(D.cal.k.done && D.cal.k.by === 'kyjteach');
  D = ZP.derive([c], info, NOW0); const R = ZP.rightNow(D, { now: NOW0, course: 'c' });
  assert.strictEqual(R.upcoming.length, 1); assert.strictEqual(R.upcoming[0].c.title, 'Session');
  D = ZP.derive([c, mk('cal_item', { key: 'k', date: iso(NOW0 + DAY), title: 'Session', kind: 'event', deleted: true }, NOW0 - 200)], info, NOW0); assert.strictEqual(ZP.rightNow(D, { now: NOW0, course: 'c' }).upcoming.length, 0);
});

test('old-roadmap progress: legacy_done marks stages done without data, V follows T, and the chapter flow moves on', () => {
  const D = ZP.derive([mk('legacy_done', { ch: '1', stages: ['B', 'C', 'R', 'T', 'X'], legacy: true }, NOW0 - 1000), mk('legacy_done', { ch: '2', stages: ['B', 'C'], legacy: true }, NOW0 - 900)], info, NOW0);
  assert.ok(D.stages['1'].complete && D.stages['1'].V.done, 'chapter 1 closed via the old roadmap');
  assert.strictEqual(D.current, '2'); assert.strictEqual(D.stages['2'].next, 'R', 'chapter 2 has B and C done, so Review is next');
  assert.ok(D.hasLegacy && D.stages['2'].B.legacy);
});

test('stats: habits, calibration and hint breakdown exist and add up', () => {
  const x = []; [0, 1, 2, 3].forEach(i => x.push(mk('c_answer', { ch: '1', pid: '1CA' + (i + 1), answer: 'A', correct: i % 2 === 0, conf: i < 2 ? 'sure' : 'guess', ms: 30000, ctx: 'practice' }, NOW0 - i * 3600000)));
  const st = ZP.stats(ZP.derive(x, info, NOW0), info, NOW0);
  assert.strictEqual(st.hours.reduce((a, h) => a + h.n, 0), 4); assert.strictEqual(st.dow.reduce((a, h) => a + h.n, 0), 4);
  assert.strictEqual(st.calib.sure.n, 2); assert.strictEqual(st.calib.guess.right, 1);
  assert.strictEqual(st.hintBy[0].n, 4); assert.strictEqual(st.recover.missedFirst, 2); assert.strictEqual(st.studyWeeks.length, 10);
  assert.strictEqual(st.mixByCh && typeof st.mixByCh, 'object');
});

test('legacy import file: valid events, unique short ids, types the server accepts, and nothing invented (answers only from the checked tracker)', () => {
  const fs = require('fs'), path = require('path');
  const imp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'legacy-import.json'), 'utf8'));
  const gs = fs.readFileSync(path.join(__dirname, '..', 'automation', 'zenith-student-data.gs'), 'utf8'), allowed = (gs.match(/EVENT_TYPES = \[([\s\S]*?)\];/)[1].match(/'([a-z_]+)'/g) || []).map(x => x.replace(/'/g, ''));
  const ids = new Set();
  Object.keys(imp).forEach(k => imp[k].forEach(e => {
    assert.ok(e.id && e.id.length <= 40 && !ids.has(e.id), 'unique id ' + e.id); ids.add(e.id);
    assert.ok(typeof e.t === 'number' && e.legacy === true, 'timestamped and marked legacy');
    assert.ok(allowed.includes(e.type), e.type + ' must be in EVENT_TYPES');
    assert.ok(!['redo', 't_submit'].includes(e.type), 'no invented redos or tests');
    assert.ok(e.type !== 'c_answer' || /^leg:(seohu|bogue):a/.test(e.id), 'answers only come from a checked tracker (data/legacy-answers.json)');
    assert.ok(JSON.stringify(e).length < 40000);
  }));
  assert.ok(imp['bogue|ap-calculus-bc'] && imp['seohu|ap-calculus-bc']);
});

test('every old submission record is in Mentor: one "submission" entry per record, with its chapter, unit, status and date', () => {
  const fs = require('fs'), path = require('path');
  const imp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'legacy-import.json'), 'utf8'));
  const log = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'submissions-log.json'), 'utf8'));
  ['bogue', 'seohu'].forEach(u => {
    const want = log.filter(r => r.username === u && r.courseId === 'ap-calculus-bc'), got = imp[u + '|ap-calculus-bc'].filter(e => e.kind === 'submission');
    assert.strictEqual(got.length, want.length, u + ' has every record');
    want.forEach(r => assert.ok(got.some(e => e.t === Date.parse(r.receivedAt) && e.sub.chapter === r.chapter && e.sub.unit === (r.unit || '') && e.sub.status === (r.status || '')), u + ' ' + r.id));
  });
});

test('a task the student marks done shows as done by the student, and their report (a message tied to the task) is findable', () => {
  const D = ZP.derive([mk('task', { key: 'q', kind: 'free', title: 'Read', forced: true, by: 't' }, NOW0 - 3000), mk('task_done', { key: 'q' }, NOW0 - 2000),
    mk('msg', { from: 'student', kind: 'progress', text: 'finished, #7 was hard', ref: 'task:q', refLabel: 'Done: Read' }, NOW0 - 1000)], info, NOW0);
  assert.strictEqual(D.tasks[0].doneBy, 'you'); assert.ok(D.tasks[0].done);
  assert.strictEqual(D.msgs.filter(m => m.ref === 'task:q').length, 1);
  assert.ok(!D.fb['task:q'], 'not acknowledged yet');
  assert.ok(ZP.derive([mk('fb_sent', { ref: 'task:q' }, NOW0)], info, NOW0).fb['task:q'], 'a teacher acknowledgement is recorded as fb_sent');
});

test('Review (R) after the old roadmap: Problems done there, no attempt data, so R needs a written entry or an explicit "nothing to review"', () => {
  const base = [mk('legacy_done', { ch: '1', stages: ['B', 'C'] }, NOW0 - 9000)];
  let D = ZP.derive(base, info, NOW0);
  assert.ok(D.stages['1'].C.done && D.stages['1'].C.legacy && !D.stages['1'].R.done && D.stages['1'].next === 'R', 'not done just because C is');
  D = ZP.derive(base.concat(mk('flag', { ch: '1', pid: '1CA2', on: true }, NOW0 - 8000)), info, NOW0);
  assert.strictEqual(D.stages['1'].R.pending, 1); assert.ok(!D.stages['1'].R.done, 'a flagged problem needs its entry');
  D = ZP.derive(base.concat(mk('flag', { ch: '1', pid: '1CA2', on: true }, NOW0 - 8000), note('1CA2', 'actual')), info, NOW0);
  assert.ok(D.stages['1'].R.done, 'flagged and written: done');
  D = ZP.derive(base.concat(mk('legacy_done', { ch: '1', stages: ['R'] }, NOW0 - 7000)), info, NOW0);
  assert.ok(D.stages['1'].R.done && D.stages['1'].next === 'T', 'explicit nothing-to-review: done');
});

test('optional stages: T, test review and Concepts Notebook can be optional review, the chapter still counts as complete, and the current chapter moves on', () => {
  const x = [mk('legacy_done', { ch: '1', stages: ['B', 'C', 'R'], optional: ['T', 'V', 'X'], legacy: true }, NOW0 - 9000)];
  let D = ZP.derive(x, info, NOW0), S = D.stages['1'];
  assert.ok(S.complete && S.hasOptional, 'complete without T, V or X'); assert.strictEqual(D.current, '2');
  assert.ok(S.T.optional && S.V.optional && S.X.optional && !S.T.done); assert.strictEqual(S.next, null);
  // doing the test later is allowed; the Notebook stays optional until it is done
  D = ZP.derive(x.concat(mk('t_submit', { ch: '1', kind: 'T', pids: ['1TA1'], answers: {}, ms: {}, flags: {}, result: { '1TA1': 'correct' }, chOf: { '1TA1': '1' }, minutes: 60, usedSec: 100, score: { correct: 1, total: 1 } }, NOW0 - 5000)), info, NOW0);
  assert.ok(D.stages['1'].T.done && !D.stages['1'].T.optional && D.stages['1'].complete && D.stages['1'].X.optional);
  // an ordinary chapter is untouched: still needs X to close
  D = ZP.derive([mk('legacy_done', { ch: '1', stages: ['B', 'C', 'R', 'T'] }, NOW0 - 9000)], info, NOW0);
  assert.ok(!D.stages['1'].complete && D.stages['1'].next === 'X' && !D.stages['1'].hasOptional);
});

test('settings: defaults, per-account storage, deep merge of browse and keys, key matching (modifiers never match, shortcuts off keeps Esc), rebinding', () => {
  const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  localStorage.setItem('loggedInUsername', 'ann');
  delete require.cache[require.resolve('../js/zp-settings.js')]; const S = require('../js/zp-settings.js');
  assert.deepStrictEqual(S.get(), S.defaults());
  S.set({ theme: 'light', browse: { calc: 'no' } }); S.set({ browse: { remember: true } });
  let g = S.get(); assert.strictEqual(g.theme, 'light'); assert.strictEqual(g.browse.calc, 'no'); assert.ok(g.browse.remember); assert.strictEqual(g.width, 'default');
  localStorage.setItem('loggedInUsername', 'bob'); assert.strictEqual(S.get().theme, 'dark', 'another account is unaffected'); localStorage.setItem('loggedInUsername', 'ann');
  const key = (k, extra) => Object.assign({ key: k }, extra || {});
  assert.ok(S.keyMatch(key('C'), 'copyQuestion') && S.keyMatch(key('c'), 'copyQuestion'), 'default C, any case');
  assert.ok(!S.keyMatch(key('c', { ctrlKey: true }), 'copyQuestion') && !S.keyMatch(key('c', { metaKey: true }), 'copyQuestion'));
  S.set({ keys: { copyQuestion: 'q' } }); assert.ok(S.keyMatch(key('q'), 'copyQuestion') && !S.keyMatch(key('c'), 'copyQuestion'));
  assert.strictEqual(S.binding('check'), 'Enter'); S.set({ keys: null }); assert.strictEqual(S.binding('copyQuestion'), 'c', 'reset');
  S.set({ keysOn: false }); assert.ok(!S.keyMatch(key('c'), 'copyQuestion') && S.keyMatch(key('Escape'), 'close'), 'off disables shortcuts except closing a window');
  assert.strictEqual(S.keyLabel('ArrowRight'), '→'); assert.strictEqual(S.keyLabel('c'), 'C');
  const ids = S.ACTIONS.map(a => a.id), defs = S.ACTIONS.map(a => a.def.toLowerCase()); assert.strictEqual(new Set(ids).size, ids.length); assert.strictEqual(new Set(defs).size, defs.length, 'no two defaults share a key');
  delete global.localStorage;
});

test('offline manifest lists the platform pages, scripts, banks and figures and no private logs', () => {
  const fs = require('fs'), path = require('path'), m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'offline-manifest.json'), 'utf8'));
  ['profile.html', 'chapter.html', 'js/zp-store.js', 'js/zp-settings.js', 'data/calculus-c-bank.json', 'data/chemistry-t-bank.json'].forEach(f => assert.ok(m.urls.includes(f), f));
  assert.ok(m.urls.some(u => /calculus-figures\//.test(u)));
  assert.ok(!m.urls.some(u => /submissions-log|requests-log|signup|scheduled/.test(u)), 'no private logs');
  m.urls.filter(u => !/^https?:/.test(u)).forEach(u => assert.ok(fs.existsSync(path.join(__dirname, '..', u)), u + ' exists'));
});

test('one attempt per problem per open: answers with the same session count once (latest wins), a new session is a new attempt', () => {
  const a = (pid, correct, sess, dt) => mk('c_answer', { ch: '1', pid, answer: correct ? 'Got it' : 'Partly', correct, ctx: 'practice', sess }, NOW0 - dt);
  // free response: Missed -> Partly -> Got it, all on the spot in one window
  let D = ZP.derive([a('1CA1', false, 's1', 3000), a('1CA1', false, 's1', 2000), a('1CA1', true, 's1', 1000)], info, NOW0);
  assert.strictEqual(D.q['1CA1'].n, 1); assert.strictEqual(D.prob['1CA1'].attempts, 1); assert.ok(D.q['1CA1'].first.correct, 'the final rating is the attempt');
  assert.ok(!D.entries['1CA1'], 'a final "Got it" leaves nothing flagged');
  D = ZP.derive([a('1CA1', true, 's1', 3000), a('1CA1', false, 's1', 1000)], info, NOW0);
  assert.strictEqual(D.q['1CA1'].n, 1); assert.ok(!D.q['1CA1'].first.correct && D.entries['1CA1'] && D.entries['1CA1'].pending, 'changing to a miss flags it');
  assert.strictEqual(D.activity[ZP.dayKey(NOW0)], 1, 'effort counts once too');
  // opened again later: a new session is a new attempt; a different problem in the same session is separate
  D = ZP.derive([a('1CA1', false, 's1', 5000), a('1CA1', true, 's2', 1000), a('1CA2', true, 's1', 500)], info, NOW0);
  assert.strictEqual(D.q['1CA1'].n, 2); assert.strictEqual(D.q['1CA2'].n, 1);
  // events with no session (older data) all count, as before
  D = ZP.derive([a('1CA1', false, undefined, 3000), a('1CA1', true, undefined, 1000)], info, NOW0); assert.strictEqual(D.q['1CA1'].n, 2);
});

test('curriculum: T is optional, a checkpoint follows its chapters (optional for old-roadmap students), Chapter M comes last and drives Today', () => {
  const cu = { tOptional: true, checkpoints: [{ id: 'cp1', title: 'Checkpoint 1', chapters: ['1', '2'], after: '2' }],
    exam: { id: 'M', title: 'Chapter M', items: [{ kind: 'set', id: 'C11A', title: 'C11A' }, { kind: 'mock', id: 'mock1', title: 'Full mock 1' }] } };
  const infoC = Object.assign({}, info, { sets: [{ id: 'C11A', title: 'C11A', ids: ['11A1', '11A2'] }], curriculum: cu });
  let D = ZP.derive([], infoC, NOW0);
  assert.ok(D.stages['1'].T.optional && D.stages['1'].V.optional && !D.stages['1'].T.done, 'the chapter test is optional');
  assert.strictEqual(D.stages['1'].next, 'B'); assert.deepStrictEqual(D.curriculum.rows.map(r => r.id), ['ch1', 'ch2', 'cp1', 'ch3', 'C11A', 'mock1']);
  assert.strictEqual(D.curriculum.next.id, 'ch1'); assert.ok(!D.curriculum.m.unlocked);
  // chapters 1-3 done in the old roadmap: the checkpoint over them is optional, so Chapter M is next
  const old = ['1', '2', '3'].map(c => mk('legacy_done', { ch: c, stages: ['B', 'C', 'R', 'X'], legacy: true }, NOW0 - 9000));
  D = ZP.derive(old, infoC, NOW0);
  assert.ok(D.curriculum.rows.filter(r => r.id === 'cp1')[0].optional); assert.strictEqual(D.current, null); assert.strictEqual(D.curriculum.next.id, 'C11A'); assert.ok(D.curriculum.m.unlocked);
  const T = ZP.today(D, null, NOW0); assert.strictEqual(T.action.kind, 'item'); assert.ok(/C11A/.test(T.action.label));
  assert.strictEqual(ZP.itemHref(T.action.item, 'ap-calculus-bc'), 'practice.html?course=ap-calculus-bc&ret=roadmap.html%3Fcourse%3Dap-calculus-bc#set:C11A', 'course links carry ret so Back returns to the course view');
  // taking a mock marks it done; the set stays next until every problem has been tried
  const taken = mk('t_submit', { ch: '', kind: 'MOCK', mockId: 'mock1', pids: [], answers: {}, ms: {}, flags: {}, result: {}, chOf: {}, minutes: 10, usedSec: 10, score: { correct: 0, total: 0 } }, NOW0 - 5000);
  D = ZP.derive(old.concat(taken), infoC, NOW0); assert.strictEqual(D.curriculum.m.done, 1); assert.strictEqual(D.curriculum.next.id, 'C11A');
  // a course without a curriculum is unchanged
  assert.strictEqual(ZP.derive([], info, NOW0).curriculum, null);
});

test('custom mock builder: sections follow the calculator rule, chapters share questions by weight (0 leaves one out), a thin scope tops up from the full pool, nothing repeats', () => {
  const CM = require('../js/zp-custom-mock.js');
  const problems = [];
  for (let ch = 1; ch <= 3; ch++) for (let i = 1; i <= 10; i++) { problems.push({ id: ch + 'TA' + i, kind: 'T', chapter: String(ch), calc: 'no' }); problems.push({ id: ch + 'TB' + i, kind: 'T', chapter: String(ch), calc: 'yes' }); }
  for (let i = 1; i <= 4; i++) problems.push({ id: 'F' + i, kind: 'F', chapter: 'ap', frq: true, calc: i % 2 ? 'yes' : 'no' });
  const exam = { scoring: { mcqWeight: 0.5, frqWeight: 0.5, frqMaxEach: 9, bands: [[0, 1]] }, sections: [
    { id: '1A', name: 'A', kind: 'mcq', count: 9, minutes: 30, calculator: false, available: true }, { id: '1B', name: 'B', kind: 'mcq', count: 6, minutes: 20, calculator: true, available: true },
    { id: '2A', name: 'F1', kind: 'frq', count: 2, minutes: 15, calculator: true, available: true }] };
  const info2 = { setOf: {}, chapters: {}, sets: [] }, D0 = ZP.derive([], info, NOW0);
  const cfg = CM.defaults(exam, { mcq: true, frq: true }); cfg.src = { T: true, S: false, C: false };
  let p = CM.plan({ cfg, data: { problems }, info: info2, D: D0, exam });
  const all = [].concat(...Object.values(p.sections));
  assert.strictEqual(new Set(all).size, all.length, 'no problem twice');
  assert.ok(p.sections['1A'].every(id => /TA/.test(id)) && p.sections['1B'].every(id => /TB/.test(id)), 'part A is no-calculator, part B calculator');
  assert.strictEqual(p.sections['1A'].length, 9); assert.ok(p.sections['2A'].every(id => problems.find(q => q.id === id).calc === 'yes') && p.sections['2A'].length === 2);
  const per = ch => p.sections['1A'].filter(id => id[0] === ch).length;
  assert.deepStrictEqual([per('1'), per('2'), per('3')], [3, 3, 3], 'even weights spread evenly');
  cfg.weights = { '1': 0, '2': 2, '3': 1 }; p = CM.plan({ cfg, data: { problems }, info: info2, D: D0, exam });
  assert.strictEqual(per('1'), 0, 'weight 0 leaves a chapter out'); assert.ok(per('2') > per('3'));
  // scope "not tried yet" runs thin: tried problems are used to top up, with a note
  const tried = problems.filter(q => q.id.startsWith('1TA') || q.id.startsWith('2TA') || /^3TA[1-5]$/.test(q.id)).map(q => ({ id: 'a' + q.id, t: NOW0 - 1000, type: 'c_answer', ch: q.chapter, pid: q.id, ctx: 'practice', correct: true, answer: 'A', sess: 's' + q.id }));
  cfg.weights = {}; cfg.scope = 'unseen'; p = CM.plan({ cfg, data: { problems }, info: info2, D: ZP.derive(tried, info, NOW0), exam });
  assert.strictEqual(p.sections['1A'].length, 9); assert.ok(p.notes.some(n => /already done/.test(n)));
  assert.strictEqual(CM.toMock(p, 'My mock', 'x1', exam).mock.id, 'cm-x1');
});

test('deleting a test / mock record removes it from the lists but keeps the per-problem progress; a required mock counts as not taken again', () => {
  const sub = mk('t_submit', { ch: '', kind: 'MOCK', mockId: 'mock1', title: 'Mock 1', pids: ['1CA1'], answers: { '1CA1': 'B' }, ms: {}, flags: {}, result: { '1CA1': 'incorrect' }, chOf: { '1CA1': '1' }, minutes: 10, usedSec: 10, score: { correct: 0, total: 1 } }, NOW0 - 5000);
  const tst = mk('t_submit', { ch: '', kind: 'TEST', pids: ['1CA2'], answers: {}, ms: {}, flags: {}, result: { '1CA2': 'correct' }, chOf: { '1CA2': '1' }, minutes: 10, usedSec: 10, score: { correct: 1, total: 1 } }, NOW0 - 4000);
  let D = ZP.derive([sub, tst], info, NOW0); assert.strictEqual(D.mocks.length, 1); assert.strictEqual(D.customTests.length, 1);
  D = ZP.derive([sub, tst, mk('rec_del', { ref: sub.id }, NOW0 - 1000), mk('rec_del', { ref: tst.id }, NOW0 - 900)], info, NOW0);
  assert.strictEqual(D.mocks.length, 0); assert.strictEqual(D.customTests.length, 0);
  assert.strictEqual(D.q['1CA1'].n, 1, 'the attempt on the problem stays'); assert.ok(D.entries['1CA1'], 'the forced entry for the miss stays'); assert.strictEqual(D.q['1CA2'].n, 1);
});

test('Idea note: one entry per problem (kind + single text), stand-alone idea notes, optional review cards of their own, review ahead', () => {
  const nt = (extra) => mk('note', Object.assign({ ch: '1', pid: '1CA1', src: 'C', track: 'actual', nkind: 'rule', text: 'When I see 0/0 in a limit, I will factor first.', stuck: '', idea: '', signal: '' }, extra), NOW0 - 20 * DAY);
  let D = ZP.derive([nt()], info, NOW0);
  assert.ok(ZP.entryComplete(D.notes['1CA1']), 'one text is enough for Actual when it is long enough');
  assert.ok(!ZP.entryComplete(Object.assign({}, D.notes['1CA1'], { text: 'short' })), 'too short still fails');
  assert.ok(ZP.entryComplete({ track: 'careless', nkind: 'other', text: 'dropped a minus sign here' }), 'careless needs less');
  assert.strictEqual(ZP.ideaTrigger('When I see 0/0 in a limit, I will factor first.'), 'When I see 0/0 in a limit');
  assert.strictEqual(ZP.ideaTrigger('Always check the endpoints'), '');
  assert.strictEqual(Object.keys(D.cards).length, 0, 'a note is not a card until it is added to the queue');
  // the problem's own note as a card
  const flag = mk('card_flag', { kind: 'idea', ch: '1', key: 'n-1CA1', on: true }, NOW0 - 19 * DAY);
  D = ZP.derive([nt(), flag], info, NOW0); const c = D.cards['i:1:n-1CA1'];
  assert.ok(c && c.kind === 'idea' && c.trigger === 'When I see 0/0 in a limit' && c.due, 'the note joins the review queue as an idea card'); assert.ok(D.cardOn['i:1:n-1CA1']);
  assert.ok(ZP.dueEntries(D, NOW0).some(e => e.id === 'i:1:n-1CA1'), 'and comes due');
  // stand-alone idea, redo moves it out, deleting removes it
  const idea = mk('idea', { key: 'k9', text: 'For a series, compare with a p-series first.', nkind: 'idea', ch: '' }, NOW0 - 10 * DAY), iflag = mk('card_flag', { kind: 'idea', ch: '', key: 'k9', on: true }, NOW0 - 10 * DAY);
  D = ZP.derive([idea, iflag], info, NOW0); assert.ok(D.cards['i::k9'] && D.cards['i::k9'].body.indexOf('p-series') > 0);
  const redo = mk('card_redo', { kind: 'idea', ch: '', key: 'k9', grade: 4 }, NOW0 - 1000);
  D = ZP.derive([idea, iflag, redo], info, NOW0); assert.strictEqual(D.cards['i::k9'].reviews, 1);
  D = ZP.derive([idea, iflag, mk('idea', { key: 'k9', text: 'x', deleted: true }, NOW0 - 500)], info, NOW0); assert.ok(!D.cards['i::k9'], 'a deleted note leaves the queue');
  // review more: a bigger budget shows more of what is due; review ahead adds not-yet-due items soonest first
  const many = []; for (let i = 0; i < 12; i++) many.push(mk('idea', { key: 'm' + i, text: 'idea number ' + i + ' goes here', nkind: 'idea', ch: '' }, NOW0 - 10 * DAY), mk('card_flag', { kind: 'idea', ch: '', key: 'm' + i, on: true }, NOW0 - 10 * DAY));
  D = ZP.derive(many, info, NOW0);
  const base = ZP.dailyQueue(D, NOW0, null, 5), more = ZP.dailyQueue(D, NOW0, null, 12);
  assert.ok(base.all.length >= 12 && base.items.length < more.items.length && more.items.length <= 12, 'a bigger budget lists more due reviews');
  const fresh = [mk('idea', { key: 'f1', text: 'a brand new idea for later', nkind: 'idea', ch: '' }, NOW0 - 3600e3), mk('card_flag', { kind: 'idea', ch: '', key: 'f1', on: true }, NOW0 - 3600e3)];
  D = ZP.derive(fresh, info, NOW0); assert.strictEqual(ZP.dailyQueue(D, NOW0, null, 15).items.length, 0);
  const ah = ZP.dailyQueue(D, NOW0, null, 15, { ahead: true }); assert.strictEqual(ah.ahead, 1); assert.ok(ah.items[0].early);
});

test('self-study: checkpoints and Chapter M are optional, so nothing is required and Today never points at them', () => {
  const cu = { tOptional: true, checkpoints: [{ id: 'cp1', title: 'Checkpoint 1', chapters: ['1', '2'], after: '2' }], exam: { id: 'M', title: 'Chapter M', items: [{ kind: 'mock', id: 'mock1', title: 'Full mock 1' }] } };
  const done = ['1', '2', '3'].map(c => mk('legacy_done', { ch: c, stages: ['B', 'C', 'R', 'X'] }, NOW0 - 9000));
  const infoS = Object.assign({}, info, { curriculum: cu, selfStudy: true });
  let D = ZP.derive(done, infoS, NOW0);
  assert.ok(D.curriculum.rows.filter(r => r.kind !== 'chapter').every(r => r.optional), 'every checkpoint and exam row is optional');
  assert.strictEqual(D.curriculum.next, null); assert.strictEqual(ZP.today(D, null, NOW0).action.kind, 'done');
  D = ZP.derive(done, Object.assign({}, infoS, { selfStudy: false }), NOW0); assert.strictEqual(D.curriculum.next.id, 'mock1', 'a class student is still pointed at Chapter M');
});

test('free-response feedback: an answer (LaTeX + photos) can be sent to the mentor, the mentor score is final and updates the problem, unscored FRQs are never counted wrong', () => {
  const sub = mk('t_submit', { ch: '', kind: 'MOCK', mockId: 'mock1', title: 'Mock 1', pids: ['1CA1'], answers: { '1CA1': 'A' }, ms: {}, flags: {}, result: { '1CA1': 'correct' }, chOf: { '1CA1': '1', '12CA1': '12' }, minutes: 10, usedSec: 10,
    score: { correct: 1, total: 1 }, frqPids: ['12CA1'], sections: [], spec: { scoring: { frqMaxEach: 9 } } }, NOW0 - 9000);
  let D = ZP.derive([sub], info, NOW0);
  assert.ok(!D.q['12CA1'], 'an unscored FRQ is not an attempt, so it can never count as wrong'); assert.deepStrictEqual(D.frqAsk, {});
  const ans = mk('frq_ans', { aid: sub.id, pid: '12CA1', ch: '12', text: 'Let $u=x^2$ ...', images: [{ url: 'x.jpg' }], ask: true }, NOW0 - 8000);
  D = ZP.derive([sub, ans], info, NOW0); const k = sub.id + '|12CA1';
  assert.strictEqual(D.frqAsk[k].status, 'waiting'); assert.strictEqual(D.frqAsk[k].images.length, 1); assert.strictEqual(D.frqAsk[k].ref, 'frq:' + sub.id + ':12CA1');
  // student self-scores 8/9, then the mentor scores 5/9 (final), then the student tries to change it
  const self = mk('frq_score', { aid: sub.id, pid: '12CA1', score: 8 }, NOW0 - 7000), ment = mk('frq_score', { aid: sub.id, pid: '12CA1', score: 5, max: 9, by: 'teacher' }, NOW0 - 6000), later = mk('frq_score', { aid: sub.id, pid: '12CA1', score: 9 }, NOW0 - 5000);
  D = ZP.derive([sub, ans, self], info, NOW0); assert.strictEqual(D.frqScores[sub.id]['12CA1'], 8); assert.ok(D.q['12CA1'].last.correct, '8/9 counts as right');
  D = ZP.derive([sub, ans, self, ment, later], info, NOW0);
  assert.strictEqual(D.frqScores[sub.id]['12CA1'], 5, 'mentor score wins over a later self-score'); assert.ok(!D.q['12CA1'].last.correct, '5/9 is below 75%'); assert.strictEqual(D.q['12CA1'].n, 1, 'one attempt, replaced not added');
  assert.strictEqual(D.frqAsk[k].status, 'answered'); assert.strictEqual(D.frqAsk[k].score, 5);
  // a practice FRQ: the mentor's score becomes the latest attempt
  const pa = mk('frq_ans', { aid: '', pid: '12CA2', ch: '12', text: 'x', images: [], ask: true }, NOW0 - 4000), pg = mk('frq_score', { aid: '', pid: '12CA2', ch: '12', score: 8, max: 9, by: 'teacher' }, NOW0 - 3000);
  D = ZP.derive([pa], info, NOW0); assert.strictEqual(D.frqAsk['|12CA2'].status, 'waiting');
  D = ZP.derive([pa, pg], info, NOW0); assert.ok(D.q['12CA2'].last.correct && D.q['12CA2'].last.by === 'teacher'); assert.strictEqual(D.frqAsk['|12CA2'].status, 'answered'); assert.strictEqual(ZP.frqRef('', '12CA2'), 'frq:p:12CA2');
});

test('email notifications (Apps Script): who is emailed about what, self-study gets none, bursts share a key', () => {
  const vm = require('vm'), fs = require('fs'), ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'automation', 'zenith-student-data.gs'), 'utf8'), ctx);
  const dir = { students: { ann: { name: 'Ann', email: 'ann@x.com' }, bob: { name: 'Bob', email: '' }, solo: { name: 'Solo', email: 'solo@x.com' } }, teachers: { t1: { name: 'T', email: 't@x.com' } }, classes: [{ courseId: 'c1', teachers: ['t1'], students: ['ann', 'bob'] }], selfStudy: { solo: 1 } };
  const plan = (u, evs) => ctx.notifyPlan_(u, 'c1', evs, dir);
  let p = plan('ann', [{ id: 'a', type: 'msg', from: 'student', kind: 'frqask', text: 'Asked for feedback on C12-A2 (practice).\n\nmy work', refLabel: 'C12-A2', ref: 'frq:p:12CA2', files: [{ url: 'x' }] }]);
  assert.strictEqual(p.length, 1); assert.strictEqual(p[0].to, 't@x.com'); assert.ok(/asked for feedback on C12-A2/.test(p[0].subject)); assert.ok(/teacher-student\.html\?student=ann&course=c1#work/.test(p[0].body) && /1 photo/.test(p[0].body));
  p = plan('ann', [{ id: 'b', type: 'msg', from: 'teacher', by: 't1', kind: 'feedback', text: 'Score: 5 / 9\nCheck the bounds', refLabel: 'C12-A2', ref: 'frq:p:12CA2' }]);
  assert.strictEqual(p.length, 1); assert.strictEqual(p[0].to, 'ann@x.com'); assert.ok(/Mentor feedback on C12-A2/.test(p[0].subject)); assert.ok(/mentor\.html\?course=c1/.test(p[0].body));
  assert.strictEqual(plan('bob', [{ id: 'c', type: 'msg', from: 'teacher', by: 't1', kind: 'message', text: 'hi' }]).length, 0, 'no email on file, no email');
  assert.strictEqual(plan('solo', [{ id: 'd', type: 'msg', from: 'student', kind: 'message', text: 'hi' }]).length, 0, 'self-study has no mentor');
  p = plan('ann', [{ id: 'e', type: 'task', by: 't1', key: 'k1', title: 'Redo ch 3', forced: true, due: '2026-11-20' }]); assert.ok(/^\[Zenith\] Required task: Redo ch 3/.test(p[0].subject) && /Due 2026-11-20/.test(p[0].body));
  p = plan('ann', [{ id: 'f', type: 'prop_reply', by: 't1', ref: 'm1', status: 'accepted' }, { id: 'g', type: 'cal_item', by: 't1', key: 'pm1', title: 'Session', date: '2026-11-21', kind: 'event' }]); assert.strictEqual(p.length, 1); assert.ok(/accepted/.test(p[0].subject), 'the accepted session is one email, not two');
  p = plan('ann', [{ id: 'h', type: 'msg', from: 'student', kind: 'progress', ref: 'task:k1', text: 'done' }, { id: 'i', type: 'task_done', key: 'k1' }]); assert.strictEqual(p.length, 1, 'a task report and its done marker are one email');
  p = plan('ann', [{ id: 'j', type: 'msg', from: 'student', kind: 'message', text: 'a' }, { id: 'k', type: 'msg', from: 'student', kind: 'message', text: 'b' }]); assert.strictEqual(p[0].key, p[1].key, 'a burst of messages shares a throttle key');
  const real = ctx.readConstArray_(fs.readFileSync(require('path').join(__dirname, '..', 'js', 'data.js'), 'utf8'), 'CLASSES'); assert.ok(real.length >= 1 && real[0].teacherUsernames, 'js/data.js can be parsed by the script');
});

test('commit-based storage (Apps Script): events are merged into one file per student and course on a data branch, deduped, sorted, safe against a concurrent commit', () => {
  const vm = require('vm'), fs = require('fs'), ctx = {}; vm.createContext(ctx);
  // A tiny fake of GitHub's contents / refs API and of the Apps Script services the file uses.
  const files = {}, branches = { main: 'sha-main' }; let shaN = 0, conflictOnce = false, puts = 0;
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) });
  const fetch = (url, o) => {
    const u = new URL(url), m = (o.method || 'get').toLowerCase(); let g;
    if ((g = /\/git\/ref\/heads\/(.+)$/.exec(u.pathname))) { const b = decodeURIComponent(g[1]); return branches[b] ? resp(200, { object: { sha: branches[b] } }) : resp(404, {}); }
    if (/\/git\/refs$/.test(u.pathname)) { const j = JSON.parse(o.payload); branches[j.ref.replace('refs/heads/', '')] = j.sha; return resp(201, {}); }
    if ((g = /\/contents\/(.+)$/.exec(u.pathname))) {
      const path = decodeURIComponent(g[1]);
      if (m === 'get') { const f = files[path]; return f ? resp(200, { sha: f.sha, content: Buffer.from(f.text).toString('base64') }) : resp(404, {}); }
      const j = JSON.parse(o.payload), f = files[path]; puts++;
      if (conflictOnce && f) { conflictOnce = false; files[path] = { text: Buffer.from(f.text + '', 'utf8').toString(), sha: 'sha' + (++shaN) }; return resp(409, {}); }
      if (f && j.sha !== f.sha) return resp(409, {});
      files[path] = { text: Buffer.from(j.content, 'base64').toString(), sha: 'sha' + (++shaN) }; return resp(f ? 200 : 201, {});
    }
    return resp(404, {});
  };
  const props = { GITHUB_TOKEN: 't', GITHUB_OWNER: 'o', GITHUB_REPO: 'r', NOTIFY_OFF: '1' }, cache = {};
  Object.assign(ctx, { UrlFetchApp: { fetch }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) }, CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    Utilities: { newBlob: s => ({ getBytes: () => Buffer.from(s), getDataAsString: () => String(s) }), base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => Buffer.from(s, 'base64'), DigestAlgorithm: {}, computeDigest: () => [] } });
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'automation', 'zenith-student-data.gs'), 'utf8'), ctx);
  const ev = (id, t, extra) => Object.assign({ id, t, type: 'c_answer', pid: '1CA1', correct: true }, extra);
  let r = ctx.append_({ username: 'ann', course: 'c1', events: [ev('a', 30), ev('b', 10)] });
  assert.strictEqual(r.added, 2); assert.ok(branches['student-data'] === 'sha-main', 'the data branch is created from main'); const path = 'data/cloud/ann__c1.json';
  let doc = JSON.parse(files[path].text); assert.deepStrictEqual(doc.events.map(e => e.id), ['b', 'a'], 'sorted by time'); assert.strictEqual(doc.username, 'ann'); assert.ok(files[path].text.split('\n').length >= 4, 'one event per line');
  r = ctx.append_({ username: 'ann', course: 'c1', events: [ev('a', 30), ev('c', 20)] }); assert.strictEqual(r.added, 1, 'a retried event is not stored twice'); assert.deepStrictEqual(JSON.parse(files[path].text).events.map(e => e.id), ['b', 'c', 'a']);
  const before = puts; r = ctx.append_({ username: 'ann', course: 'c1', events: [ev('a', 30)] }); assert.strictEqual(r.added, 0); assert.strictEqual(puts, before, 'nothing new means no commit');
  conflictOnce = true; r = ctx.append_({ username: 'ann', course: 'c1', events: [ev('d', 40)] }); assert.strictEqual(r.added, 1, 'a conflicting commit is retried'); assert.ok(JSON.parse(files[path].text).events.some(e => e.id === 'd'));
  assert.strictEqual(ctx.readEvents_('ann', 'c1').length, 4); assert.strictEqual(ctx.readEvents_('nobody', 'c1').length, 0);
  assert.throws(() => ctx.append_({ username: 'ann', course: 'c1', events: [{ id: 'x', t: 1, type: 'not_a_type' }] }), /bad event/);
  ctx.putDoc_({ key: 'plan:ann:c1', value: { milestones: [1] }, by: 'kyjteach' }); assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.readDoc_('plan:ann:c1'))), { milestones: [1] }); assert.ok(files['data/cloud/docs/plan__ann__c1.json'], 'docs live under docs/');
  assert.throws(() => ctx.putDoc_({ key: 'bad key', value: {} }), /bad key/);
});

test('instant student signup (data-writer script): the account is committed to js/data.js at once, listed as approved by auto, emailed, and bad or duplicate signups are refused', () => {
  const vm = require('vm'), fs = require('fs'), root = require('path').join(__dirname, '..'), ctx = {}; vm.createContext(ctx);
  const files = { 'js/data.js': { text: fs.readFileSync(root + '/js/data.js', 'utf8'), sha: 's1' }, 'data/signup-requests.json': { text: '[]', sha: 's1' } }; let shaN = 1; const mails = [], cache = {};
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) });
  const props = { GITHUB_TOKEN: 't', GITHUB_OWNER: 'o', GITHUB_REPO: 'r' };
  Object.assign(ctx, {
    UrlFetchApp: { fetch: (url, o) => {
      const path = decodeURIComponent((/\/contents\/([^?]+)/.exec(url) || [])[1] || '');
      if (!o || !o.method) { const f = files[path]; return f ? resp(200, { content: Buffer.from(f.text).toString('base64'), sha: f.sha }) : resp(404, {}); }
      const j = JSON.parse(o.payload); files[path] = { text: Buffer.from(j.content, 'base64').toString(), sha: 's' + (++shaN) }; return resp(200, {});
    } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { newBlob: s => ({ getDataAsString: () => String(s) }), base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: b => Buffer.from(b, 'base64'), sleep() {}, Charset: { UTF_8: 'utf8' } }
  });
  vm.runInContext(fs.readFileSync(root + '/automation/zenith-data-writer.gs', 'utf8'), ctx);
  const send = (ops) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'applyBatch', payload: { operations: ops } }) } }).text);
  const pair = (u, extra) => [{ action: 'createStudentAccount', payload: Object.assign({ instant: true, username: u, name: 'New Kid', email: 'kid@example.com', passwordHash: 'abc123' }, extra) },
    { action: 'submitSignup', payload: Object.assign({ auto: true, role: 'student', username: u, name: 'New Kid', email: 'kid@example.com', passwordHash: 'abc123', adminEmails: ['admin@example.com'] }, extra) }];
  let r = send(pair('newkid1')); assert.strictEqual(r.ok, true, JSON.stringify(r));
  const students = ctx.readConstArray_(files['js/data.js'].text, 'STUDENTS'), me = students.find(x => x.username === 'newkid1');
  assert.ok(me && me.email === 'kid@example.com' && me.passwordHash === 'abc123' && me.courses.length === 0, 'the account is in js/data.js');
  assert.ok(students.some(x => x.username === 'seohu') && students.length > 3, 'the existing students are untouched');
  const rows = JSON.parse(files['data/signup-requests.json'].text); assert.strictEqual(rows[0].status, 'Approved'); assert.strictEqual(rows[0].decidedBy, 'auto');
  assert.ok(mails.some(m => m.to === 'kid@example.com' && /ready/.test(m.subject)) && mails.some(m => m.to === 'admin@example.com' && /joined/.test(m.subject)), 'the student and the admins are emailed');
  assert.strictEqual(send(pair('NewKid1')).ok, false, 'a username that differs only by case is taken');
  assert.strictEqual(send(pair('seohu')).ok, false, 'an existing student name is taken');
  const teacher = ctx.readConstArray_(files['js/data.js'].text, 'TEACHERS')[0].username; assert.strictEqual(send(pair(teacher)).ok, false, 'a teacher name is taken too');
  assert.ok(/valid email/.test(send(pair('kid2', { email: 'nope' })).error), 'an email is required');
  assert.strictEqual(send([pair('kid3')[0]]).ok, false, 'an account without its signup record is refused');
  assert.strictEqual(send([pair('kid4')[1]]).ok, true, 'a teacher-style pending signup is untouched by this');
  assert.ok(/student/.test(send([Object.assign({}, pair('kid5')[1], { payload: Object.assign({}, pair('kid5')[1].payload, { role: 'teacher' }) })]).error), 'only students can be instant');
  props.INSTANT_SIGNUPS_PER_HOUR = '3'; cache.instant_signups_hour = '3'; assert.ok(/try again/.test(send(pair('kid6')).error), 'the hourly allowance is enforced'); cache.instant_signups_hour = '0';
  assert.strictEqual(send(pair('kid6')).ok, true);
});

test('instant signup (browser): the new account is kept on this device so login works before GitHub Pages publishes it, then the published copy wins', () => {
  const vm = require('vm'), fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const a = src.indexOf('// ---- Accounts created on this device'), b = src.indexOf('// ---- Sign up (signup.html) ----'); assert.ok(a > 0 && b > a);
  const store = {}, ctx = { STUDENTS: [{ username: 'old' }], TEACHERS: [], PARENTS: [], ADMINS: [], Date, JSON, Object, Array,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
  vm.createContext(ctx); vm.runInContext(src.slice(a, b) + ';this.api={remember:rememberLocalAccount_,add:addLocalAccountsToStudents_,list:localAccounts_};', ctx);
  ctx.api.remember({ username: 'kid', name: 'Kid', email: 'k@e.co', passwordHash: 'h' }); ctx.api.add();
  assert.ok(ctx.STUDENTS.some(x => x.username === 'kid' && x.passwordHash === 'h' && x.courses.length === 0), 'a page load adds the local account');
  ctx.STUDENTS.length = 1; ctx.STUDENTS.push({ username: 'kid', name: 'Kid' }); const n0 = ctx.STUDENTS.length; ctx.api.add();
  assert.strictEqual(ctx.STUDENTS.length, n0, 'once js/data.js has the account the local copy is not added again'); assert.strictEqual(ctx.api.list().length, 0, 'and it is forgotten');
  ctx.api.remember({ username: 'late', name: 'L', passwordHash: 'h' }); const l = JSON.parse(store['zenith:newAccounts:v1']); l[0].createdAt = Date.now() - 2 * 86400000; store['zenith:newAccounts:v1'] = JSON.stringify(l);
  ctx.STUDENTS.length = 1; ctx.api.add(); assert.ok(!ctx.STUDENTS.some(x => x.username === 'late'), 'an account older than a day is not resurrected');
});

test('self-study enrollment: the open courses match between the site and the script, adding is idempotent, leaving never touches a class enrollment', () => {
  const vm = require('vm'), fs = require('fs'), root = require('path').join(__dirname, '..'), w = {}; vm.createContext(w);
  vm.runInContext(fs.readFileSync(root + '/automation/zenith-data-writer.gs', 'utf8'), w);
  const d = {}; vm.createContext(d); vm.runInContext(fs.readFileSync(root + '/js/data.js', 'utf8') + ';this.L=SELF_STUDY_COURSES;', d);
  const open = d.L.filter(c => c.open); assert.ok(open.length >= 1);
  assert.strictEqual(JSON.stringify(Object.keys(w.SELF_STUDY_COURSES_).sort()), JSON.stringify(open.map(c => c.id).sort()), 'js/data.js and the script agree on which courses are open');
  open.forEach(c => { assert.strictEqual(w.SELF_STUDY_COURSES_[c.id].name, c.name); assert.strictEqual(w.SELF_STUDY_COURSES_[c.id].icon, c.icon); });
  const students = [{ username: 'ann', courses: [] }, { username: 'cal', courses: [{ id: 'ap-chemistry', name: 'AP Chemistry', icon: 'chemistry', roadmap: [{ x: 1 }] }] }];
  w.ACTIONS.enrollSelfStudy.handler(students, { username: 'ann', courseId: 'ap-calculus-bc' }); w.ACTIONS.enrollSelfStudy.handler(students, { username: 'ann', courseId: 'ap-calculus-bc' });
  assert.strictEqual(students[0].courses.length, 1, 'a repeat changes nothing'); assert.strictEqual(students[0].courses[0].selfStudy, true);
  assert.throws(() => w.ACTIONS.enrollSelfStudy.handler(students, { username: 'ann', courseId: 'ap-physics' }), /not open/, 'a course that is not on the list cannot be added');
  assert.throws(() => w.ACTIONS.enrollSelfStudy.handler(students, { username: 'nobody', courseId: 'ap-calculus-bc' }), /No such student/);
  w.ACTIONS.leaveSelfStudy.handler(students, { username: 'cal', courseId: 'ap-chemistry' }); assert.strictEqual(students[1].courses.length, 1, 'a class enrollment cannot be dropped this way');
  w.ACTIONS.leaveSelfStudy.handler(students, { username: 'ann', courseId: 'ap-calculus-bc' }); assert.strictEqual(students[0].courses.length, 0);
});

test('self-study enrollment (browser): a choice shows in the portal at once, is retried if the send failed, and is dropped once the published data has it', async () => {
  const vm = require('vm'), fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const code = src.slice(src.indexOf('// ---- Self-study courses (catalog.html, portal.html) ----'));
  const store = { loggedInRole: 'student', loggedInUsername: 'ann' }, posts = []; let reachable = false;
  const ctx = { STUDENTS: [{ username: 'ann', courses: [] }], SELF_STUDY_COURSES: [{ id: 'ap-calculus-bc', name: 'AP Calculus BC', icon: 'calculus', open: true }], ROLE_KEY: 'loggedInRole', SESSION_KEY: 'loggedInUsername',
    TEACHER_DATA_WRITE_URL: 'http://script/exec', JSON, Date, Promise, Object, Array, document: { getElementById: () => null }, courseIconHtml: () => '',
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: (u, o) => { posts.push(JSON.parse(o.body)); return reachable ? Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }) : Promise.reject(new Error('offline')); } };
  vm.createContext(ctx); vm.runInContext(code + ';this.api={set:setSelfStudy_,apply:applySelfStudyChoices_,retry:retryPendingSelfStudy_,store:selfStudyStore_};', ctx);
  const ids = () => JSON.stringify(ctx.STUDENTS[0].courses.map(c => c.id + (c.selfStudy ? '*' : '')));
  assert.strictEqual(await ctx.api.set('ap-calculus-bc', true), false, 'offline: not confirmed'); assert.strictEqual(ids(), '["ap-calculus-bc*"]', 'but it is in the portal already'); assert.strictEqual(ctx.api.store().ann[0].pending, true);
  ctx.STUDENTS[0].courses = []; ctx.api.apply(); assert.strictEqual(ids(), '["ap-calculus-bc*"]', 'a new page load still shows it');
  reachable = true; ctx.api.retry(); await new Promise(r => setTimeout(r, 5)); assert.strictEqual(posts[posts.length - 1].action, 'enrollSelfStudy'); assert.strictEqual(ctx.api.store().ann[0].pending, false, 'the retry went through');
  ctx.STUDENTS[0].courses = []; ctx.api.apply(); assert.strictEqual(ids(), '["ap-calculus-bc*"]', 'sent but not yet published: still shown');
  ctx.STUDENTS[0].courses = [{ id: 'ap-calculus-bc', selfStudy: true }]; ctx.api.apply(); assert.strictEqual(ctx.api.store().ann.length, 0, 'the published copy has it: the device copy is forgotten');
  assert.strictEqual(await ctx.api.set('ap-calculus-bc', false), true); assert.strictEqual(ids(), '[]', 'leaving removes it'); assert.strictEqual(posts[posts.length - 1].action, 'leaveSelfStudy');
  assert.strictEqual(await ctx.api.set('ap-physics', true), false, 'a course that is not on the list is ignored');
});

test('self-study roadmap: a self-study course gets the original roadmap with every item unlocked, and the original is left alone', () => {
  const vm = require('vm'), fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const code = src.slice(src.indexOf('function selfStudyRoadmap_'), src.indexOf('function postSelfStudy_'));
  const orig = [{ name: 'L1', status: 'Complete', url: 'u1' }, { name: 'T1', status: 'Locked' }];
  const ctx = { STUDENTS: [{ username: 'mentored', courses: [{ id: 'ap-chemistry', roadmap: orig }] }, { username: 'kid', courses: [{ id: 'ap-chemistry', selfStudy: true, roadmap: [] }, { id: 'ap-biology', selfStudy: true, roadmap: [] }] }], Object, Array };
  vm.createContext(ctx); vm.runInContext(code + ';this.fill=fillSelfStudyRoadmaps_;', ctx); ctx.fill();
  const kid = ctx.STUDENTS[1].courses; assert.strictEqual(kid[0].roadmap.length, 2); assert.ok(kid[0].roadmap.every(i => i.status === 'Unlocked')); assert.strictEqual(kid[0].roadmap[0].url, 'u1');
  assert.strictEqual(orig[0].status, 'Complete'); assert.strictEqual(orig[1].status, 'Locked'); assert.strictEqual(kid[1].roadmap.length, 0, 'a course with no original to copy stays empty');
  const d = {}; vm.createContext(d); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'js', 'data.js'), 'utf8') + ';this.S=STUDENTS;this.L=SELF_STUDY_COURSES;', d);
  d.L.filter(c => c.open).forEach(c => assert.ok(d.S.some(s => s.courses.some(x => x.id === c.id && !x.selfStudy && x.roadmap.length > 0)), c.id + ' has an original roadmap to copy'));
});

test('passwords: new accounts get a salted slow hash, old SHA-256 and plain passwords still log in, weak passwords are refused', async () => {
  const vm = require('vm'), fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const a = src.indexOf('function sha256Hex_'), b = src.indexOf('// Checks a username/password against STUDENTS first'); assert.ok(a > 0 && b > a);
  const l = src.indexOf('function login(username, password) {'), l2 = src.indexOf('// ---- Accounts created on this device');
  const store = {}, ctx = { crypto: globalThis.crypto, TextEncoder, Uint8Array, Array, Promise, Set, Object, parseInt, String, Number, JSON, Math,
    STUDENTS: [{ username: 'old', passwordHash: require('crypto').createHash('sha256').update('hunter2').digest('hex') }, { username: 'plain', password: 'letmein' }],
    TEACHERS: [{ username: 'tea', passwordHash: 'pbkdf2$not$valid' }], PARENTS: [], ADMINS: [], SESSION_KEY: 'u', ROLE_KEY: 'r', ACTIVE_COURSE_KEY: 'c',
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  vm.createContext(ctx); vm.runInContext(src.slice(a, b) + src.slice(l, l2) + ';this.api={hash:hashPassword_,match:passwordMatches_,login:login,problem:passwordProblem_,strength:passwordStrength_};', ctx);
  const h1 = await ctx.api.hash('correct horse battery staple 83'), h2 = await ctx.api.hash('correct horse battery staple 83');
  assert.ok(/^pbkdf2\$210000\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(h1), h1); assert.notStrictEqual(h1, h2, 'a fresh salt every time');
  assert.strictEqual(await ctx.api.match({ passwordHash: h1 }, 'correct horse battery staple 83'), true); assert.strictEqual(await ctx.api.match({ passwordHash: h1 }, 'correct horse battery staple 84'), false);
  const nodeCheck = require('crypto').pbkdf2Sync('correct horse battery staple 83', Buffer.from(h1.split('$')[2], 'hex'), 210000, 32, 'sha256').toString('hex'); assert.strictEqual(nodeCheck, h1.split('$')[3], 'a standard PBKDF2-SHA256 hash');
  ctx.STUDENTS.push({ username: 'new', passwordHash: h1 });
  assert.strictEqual(await ctx.api.login('new', 'correct horse battery staple 83'), true); assert.strictEqual(store.u, 'new'); assert.strictEqual(store.r, 'student');
  assert.strictEqual(await ctx.api.login('old', 'hunter2'), true, 'an old SHA-256 account still logs in'); assert.strictEqual(await ctx.api.login('plain', 'letmein'), true, 'an old plain-password account still logs in');
  assert.strictEqual(await ctx.api.login('old', 'wrong'), false); assert.strictEqual(await ctx.api.login('nobody', 'x'), false); assert.strictEqual(await ctx.api.login('tea', 'x'), false, 'a malformed hash never matches');
  const P = (pw, u, n) => ctx.api.problem(pw, u || 'zed', n || 'Zed Smith');
  ['short1!', 'password1234', '123456789012', 'aaaaaaaaaaaaaa', 'zedrocks12345', 'ilovezenith!!', 'qwertyuiop12', 'smith-is-great-1'].forEach(pw => assert.ok(P(pw), pw + ' should be refused'));
  ['plum-harbor-ladder-quartz-83', 'Tr0ub4dor&3-xylophone', 'blue pencil rides seven clouds'].forEach(pw => assert.strictEqual(P(pw), '', pw + ' should pass'));
  assert.ok(ctx.api.strength('plum-harbor-ladder-quartz-83') >= 3 && ctx.api.strength('abc') === 0);
});

test('Mentor Desk: every student who is on no class roster is on the self-study track automatically, minus anyone marked gone; those without a tracked course are listed apart', () => {
  const vm = require('vm'), fs = require('fs'), src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'zp-tdash.js'), 'utf8');
  const code = src.slice(src.indexOf('  function selfStudyUsers'), src.indexOf('  function roster(teacher, tracks)'));
  const ctx = { CLASSES: [{ studentUsernames: ['inclass'] }], CFG: { COURSES: { 'ap-calculus-bc': 1 } },
    STUDENTS: [{ username: 'inclass', courses: [] }, { username: 'listed', courses: [{ id: 'ap-calculus-bc' }] }, { username: 'newkid', courses: [{ id: 'ap-calculus-bc', selfStudy: true }] }, { username: 'nocourse', courses: [] }, { username: 'bioonly', courses: [{ id: 'ap-biology', name: 'AP Biology' }] }, { username: 'left', courses: [{ id: 'ap-calculus-bc' }] }],
    studentRec: u => ctx.STUDENTS.filter(s => s.username === u)[0], Object, Array };
  vm.createContext(ctx); vm.runInContext(code + ';this.api={users:selfStudyUsers,idle:idleSelfStudy};', ctx);
  const tracks = { selfStudy: ['listed'], gone: ['left'] };
  assert.strictEqual(JSON.stringify(ctx.api.users(tracks)), JSON.stringify(['listed', 'newkid', 'nocourse', 'bioonly']), 'listed first, then everyone on no roster; class students and gone ones are out');
  assert.strictEqual(JSON.stringify(ctx.api.idle(tracks).map(s => s.username)), JSON.stringify(['nocourse', 'bioonly']), 'no tracked course yet');
  assert.strictEqual(JSON.stringify(ctx.api.users({})), JSON.stringify(['listed', 'newkid', 'nocourse', 'bioonly', 'left']), 'with no tracks file it still works');
});

test('tour: every tour has complete steps and ends on a closing card, the full tour covers the solving loop in order, and it is on every platform page', () => {
  const vm = require('vm'), fs = require('fs'), root = require('path').join(__dirname, '..');
  const noop = () => {}, doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: () => ({ style: {}, addEventListener: noop }), body: { appendChild: noop } };
  const win = { document: doc, location: { pathname: '/roadmap.html', search: '', hash: '' }, addEventListener: noop, innerWidth: 1000, innerHeight: 800 }; win.window = win;
  const store = {}; const ctx = Object.assign(win, { localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } }, sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, setTimeout: noop, Promise, Object, Array, JSON, Date, Math, console });
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(root + '/js/tour.js', 'utf8'), ctx);
  const T = ctx.ZTour.TOURS; assert.ok(Object.keys(T).length >= 10);
  Object.keys(T).forEach(k => { const steps = T[k]; assert.ok(steps.length >= 2, k); steps.forEach((st, i) => { assert.ok(st.title && st.body, k + ' step ' + i + ' has a title and a body'); assert.strictEqual(!!st.finish, i === steps.length - 1, k + ': only the last step finishes'); }); });
  const order = T.main.map(st => st.title);
  const at = (t) => order.findIndex(x => x.indexOf(t) === 0);
  ['Today', 'Every chapter', 'Inside a chapter', '1. Read', '2. Choose', '3. Say', '4. Check', 'Stuck', '5. Write', 'The review queue', 'The Trainer', 'Free-response', 'That is the loop'].forEach(t => assert.ok(at(t) >= 0, 'the full tour has a step "' + t + '"'));
  assert.ok(at('1. Read') < at('2. Choose') && at('2. Choose') < at('4. Check') && at('4. Check') < at('5. Write') && at('5. Write') < at('The review queue'), 'the steps follow the order you solve in');
  assert.ok(T.main.filter(st => st.url).every(st => typeof st.url === 'function'), 'steps that change page give a url function');
  assert.ok(T.runner.every(st => !st.url) && T.roadmap.every(st => !st.url), 'page tours stay on their page');
  assert.ok(T.start.some(st => /catalog/.test(String(st.url))), 'a student with no Calculus course is sent to the catalog');
  ['roadmap', 'chapter', 'practice', 'notebook', 'profile', 'mentor', 'portal', 'catalog'].forEach(f => { const h = fs.readFileSync(root + '/' + f + '.html', 'utf8'); assert.ok(/js\/tour\.js/.test(h) && /css\/tour\.css/.test(h), f + '.html loads the tour'); });
  assert.ok(JSON.parse(fs.readFileSync(root + '/data/offline-manifest.json', 'utf8')).urls.some(u => /js\/tour\.js$/.test(u)), 'the offline manifest includes the tour');
});

test("seohu's old per-problem answers: every answer matches the bank, every miss is reviewed once (an entry with a note starts its Good card), Review is closed through chapter 4", () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const imp = JSON.parse(fs.readFileSync(root + '/data/legacy-import.json', 'utf8'))['seohu|ap-calculus-bc'], bank = JSON.parse(fs.readFileSync(root + '/data/calculus-c-bank.json', 'utf8'));
  const ans = imp.filter(e => e.type === 'c_answer'), notes = imp.filter(e => e.type === 'note');
  assert.strictEqual(ans.length, 276, 'every C problem of chapters 1-4');
  ans.forEach(e => { const q = bank[e.ch].problems.find(p => e.pid === e.ch + 'C' + p.id); assert.ok(q, e.pid + ' is in the bank'); assert.strictEqual(e.correct, e.answer === q.correct, e.pid + ' correctness matches the answer key'); assert.strictEqual(e.ctx, 'chapter'); });
  assert.strictEqual(notes.length, ans.filter(e => !e.correct).length, 'one entry per missed or skipped problem, none for the rest');
  notes.forEach(n => assert.ok(ans.some(a => a.pid === n.pid && !a.correct) && n.t > ans.find(a => a.pid === n.pid).t, n.pid + ': the review comes after the miss'));
  ['1', '2', '3', '4'].forEach(ch => assert.ok(imp.some(e => e.type === 'legacy_done' && e.ch === ch && e.stages.includes('R')), 'Review done for chapter ' + ch));
  assert.ok(imp.some(e => e.type === 'task_done' && e.key === 'legacy-now'), 'the "resolve the mistakes" task is finished');
  // Through the real derive: every miss is a completed entry with one Good card, nothing left to write.
  const infoB = { order: ['1', '2', '3', '4'], chapters: {} };
  ['1', '2', '3', '4'].forEach(ch => { infoB.chapters[ch] = { ch, title: 'Ch ' + ch, hasC: true, hasT: false, cIds: bank[ch].problems.map(p => ch + 'C' + p.id), tIds: [], exKeys: [], conceptKeys: [], examples: [], concepts: [] }; });
  const D = ZP.derive(imp, infoB, Date.parse('2026-11-13T00:00:00Z')), ent = Object.values(D.entries);
  assert.strictEqual(ent.length, 52); assert.ok(ent.every(e => e.complete && e.due && e.track === 'actual'), 'completed entries, each with a review card'); assert.strictEqual(ent.filter(e => !e.complete).length, 0, 'nothing to write');
  assert.strictEqual(D.taskDone['legacy-now'] && 1, 1);
});

test("bogue's old answer lists: only the parts that line up with the bank are imported, each matches the key, and his misses stay as entries still to write", () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const imp = JSON.parse(fs.readFileSync(root + '/data/legacy-import.json', 'utf8'))['bogue|ap-calculus-bc'], bank = JSON.parse(fs.readFileSync(root + '/data/calculus-c-bank.json', 'utf8'));
  const ans = imp.filter(e => e.type === 'c_answer'); assert.ok(ans.length > 250);
  const chs = new Set(ans.map(e => e.ch)); assert.strictEqual([...chs].sort().join(','), '10,4,5,6,9', 'only chapters whose lists could be lined up');
  assert.ok(!ans.some(e => e.ch === '6' && /^6CA/.test(e.pid)), 'chapter 6 set A (a shorter list than the bank) is not imported');
  assert.strictEqual(ans.filter(e => e.ch === '5').length, 69, 'chapter 5 stops where its list goes out of step');
  ans.forEach(e => { const q = bank[e.ch].problems.find(p => e.pid === e.ch + 'C' + p.id); assert.ok(q, e.pid); assert.strictEqual(e.correct, e.answer === q.correct, e.pid); });
  const hit = ans.filter(e => e.correct).length / ans.filter(e => e.answer).length; assert.ok(hit > 0.8 && hit < 1, 'a plausible score, not all right');
  assert.ok(!imp.some(e => e.type === 'note' && /^leg:bogue:n/.test(e.id)), 'no review is claimed: he did not do the Review step');
  const infoB = { order: ['4', '5', '6', '9', '10'], chapters: {} };
  infoB.order.forEach(ch => { infoB.chapters[ch] = { ch, title: 'Ch ' + ch, hasC: true, hasT: false, cIds: bank[ch].problems.map(p => ch + 'C' + p.id), tIds: [], exKeys: [], conceptKeys: [], examples: [], concepts: [] }; });
  const D = ZP.derive(imp, infoB, Date.parse('2026-11-14T00:00:00Z')), ent = Object.values(D.entries);
  assert.strictEqual(ent.length, ans.filter(e => !e.correct).length, 'every miss is an entry'); assert.ok(ent.every(e => !e.complete && !e.due), 'to write: no review card until he writes it');
});

console.log('\n' + n + ' tests passed');
