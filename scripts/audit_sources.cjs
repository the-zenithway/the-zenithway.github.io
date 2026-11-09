// Audits every problem source the platform loads: banks (calc C / T, chem T, AP FRQ archive) and the generated mocks.
//   node scripts/audit_sources.cjs [path/to/katex]      (KaTeX 0.16.9: `npm i katex@0.16.9` somewhere, then pass its path or set NODE_PATH)
// Checks: every math span compiles, dollar signs balance, ids are unique, MCQ choices/answer key are usable, figure files exist,
// FRQs have a solution or a scoring link, and each mock only uses problems that exist (no repeats, right counts, calculator rule).
// Exits 1 if anything is wrong. Warnings (things worth a look but not broken) do not fail the run.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const katex = require(process.argv[2] ? path.resolve(process.argv[2]) : 'katex');
const core = require(path.join(root, 'js', 'practice-core.js'));
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')); } catch (e) { return {}; } };

const errors = [], warnings = [], summary = {};
const err = (id, msg) => errors.push(id + ': ' + msg);
const warn = (id, msg) => warnings.push(id + ': ' + msg);

const SOURCES = [
  { name: 'calculus C', file: 'calculus-c-bank.json', course: 'ap-calculus-bc', kind: 'C' },
  { name: 'calculus T', file: 'calculus-t-bank.json', course: 'ap-calculus-bc', kind: 'T' },
  { name: 'chemistry T', file: 'chemistry-t-bank.json', course: 'ap-chemistry', kind: 'T' },
  { name: 'calculus AP FRQ', file: 'calculus-ap-frq-bank.json', course: 'ap-calculus-bc', kind: 'F' }
];
const byCourse = {}; // course -> id -> problem
const MATH = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$((?:\\.|[^$])*)\$/g;
let spans = 0;

function checkText(id, field, text) {
  if (!text) return;
  const stripped = text.replace(MATH, ' ');
  if ((stripped.match(/(?<!\\)\$/g) || []).length) err(id, field + ' has an unmatched $');
  for (const m of text.matchAll(MATH)) {
    spans++;
    try { katex.renderToString(m[1] ?? m[2] ?? m[3] ?? m[4], { throwOnError: true, strict: 'ignore', trust: false }); }
    catch (e) { err(id, field + ' math does not compile: ' + e.message.split('\n')[0].slice(0, 120)); }
  }
}

for (const src of SOURCES) {
  const bank = read(src.file);
  if (!Object.keys(bank).length) { summary[src.name] = 0; continue; }
  const list = core.normalize(bank, src.course, src.kind);
  summary[src.name] = list.length;
  const seen = new Set(), seenN = new Set();
  const raw = {}; Object.keys(bank).forEach(ch => (bank[ch].problems || []).forEach((p, i) => { raw[ch + '|' + String(p.id || i + 1)] = p; }));
  for (const q of list) {
    const id = src.name + ' ' + q.id;
    if (seen.has(q.id)) err(id, 'duplicate id'); seen.add(q.id);
    (byCourse[src.course] = byCourse[src.course] || {})[q.id] = q;
    if (q.blocked) err(id, 'blocked by the normaliser: ' + (q.issues || []).join('; '));
    if (!q.stem) err(id, 'blank stem');
    checkText(id, 'stem', q.stem); checkText(id, 'solution', q.solution);
    if (!q.frq) {
      if (!q.choices.length) err(id, 'no choices');
      q.choices.forEach((c, i) => { if (!c) err(id, 'blank choice ' + String.fromCharCode(65 + i)); checkText(id, 'choice ' + String.fromCharCode(65 + i), c); });
      if (!/^[A-Z]$/.test(q.correct) || !q.choices[q.correct.charCodeAt(0) - 65]) err(id, 'answer key does not match a choice');
      if (new Set(q.choices.map(c => c.replace(/\s+/g, ''))).size < q.choices.length) warn(id, 'two choices look identical');
    } else if (!q.solution) warn(id, 'free response with no solution text');
    if (q.figure && !fs.existsSync(path.join(root, q.figure.src))) err(id, 'figure file missing: ' + q.figure.src);
    if (!q.figure && /\b(figure|diagram|graph) (above|below|shown)|shown (above|below)|in the figure/i.test(q.stem) && !/table/i.test(q.stem)) warn(id, 'mentions a figure but has none');
    if (q.stem.length > 3000) warn(id, 'very long stem (' + q.stem.length + ' chars)');
  }
}

// mocks
const mocks = read('mock-exams.json');
for (const course of Object.keys(mocks).filter(k => !k.startsWith('_'))) {
  const spec = mocks[course], pool = byCourse[course] || {};
  const calcOf = id => { const m = /^\d+[CT]([AB])/.exec(id); if (!m || course !== 'ap-calculus-bc') return 'any'; const b = m[1] === 'B'; return /^12C/.test(id) ? (b ? 'no' : 'yes') : (b ? 'yes' : 'no'); };
  const used = new Set();
  for (const m of spec.mocks || []) {
    for (const s of spec.sections) {
      const ids = m.sections[s.id]; if (!ids) { if (s.available !== false) err(course + ' ' + m.id, 'section ' + s.id + ' missing'); continue; }
      if (ids.length !== s.count) err(course + ' ' + m.id, 'section ' + s.id + ' has ' + ids.length + ' questions, expected ' + s.count);
      if (new Set(ids).size !== ids.length) err(course + ' ' + m.id, 'section ' + s.id + ' repeats a question');
      ids.forEach(id => {
        if (!pool[id]) err(course + ' ' + m.id, id + ' is not in any bank');
        if (used.has(id)) warn(course + ' ' + m.id, id + ' also appears in an earlier mock'); used.add(id);
        if (course === 'ap-calculus-bc' && s.calculator !== undefined && calcOf(id) !== (s.calculator ? 'yes' : 'no')) err(course + ' ' + m.id, id + ' is ' + calcOf(id) + '-calculator but sits in section ' + s.id);
      });
    }
  }
  summary['mocks ' + course] = (spec.mocks || []).length;
}

console.log(JSON.stringify({ summary, mathSpansChecked: spans, errors: errors.length, warnings: warnings.length }, null, 1));
if (errors.length) { console.log('\nERRORS'); errors.slice(0, 60).forEach(e => console.log(' - ' + e)); if (errors.length > 60) console.log(' ... ' + (errors.length - 60) + ' more'); }
if (warnings.length) { console.log('\nWARNINGS'); warnings.slice(0, 40).forEach(e => console.log(' - ' + e)); if (warnings.length > 40) console.log(' ... ' + (warnings.length - 40) + ' more'); }
process.exitCode = errors.length ? 1 : 0;
