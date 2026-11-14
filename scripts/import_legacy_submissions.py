#!/usr/bin/env python3
"""Read the answer lists a student typed into the old roadmap's C-unit submissions (data/submissions-log.json) and write them to
data/legacy-answers.json, the same file scripts/import_legacy_tracker.py fills. Used when there is no hand-built tracker (bogue).

    python3 scripts/import_legacy_submissions.py

The old lists are typed by hand, so each one is only imported where it can be trusted. Every list is checked against today's bank:
  * it must line up with the bank's A / B sets (same length, or an explicit prefix that is known to line up),
  * and at least 80% of what it says must match the answer key (a list that matches far less is mislabelled or shifted).
USE below says, per chapter, which submission to read and which part of it to trust, with the reason. Anything not listed is not imported."""
import json, re, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USER, COURSE = 'bogue', 'ap-calculus-bc'
# chapter -> (label of the submission as typed, date prefix, which sets / how many problems to trust, why)
USE = {
    '4':  ('Chapter 3', '2026-10-26', {'A': 51, 'B': 42}, 'typed under "Chapter 3" but it is Chapter 4 (92% match, 51 + 42 answers = the bank); it is the corrected version of the 10-23 "Chapter 4" list, which has one answer too many'),
    '5':  ('Chapter 5', '2026-10-27', {'A': 69}, 'first 69 answers match the key exactly; the list has 80 answers for 79 problems and the tail is out of step, so the tail is not imported'),
    '6':  ('Chapter 6', '2026-10-28', {'B': 15}, 'the B list lines up (14 of 15); the A list has 34 answers for 39 problems (trivial ones skipped), so it cannot be lined up and is not imported'),
    '9':  ('Chapter 9', '2026-10-08', {'A': 36, 'B': 16}, 'lines up exactly (92% match)'),
    '10': ('Chapter 10', '2026-09-14', {'A': 38, 'B': 9}, 'numbered list, lines up exactly (90% match)'),
}
bank = json.load(open(os.path.join(root, 'data', 'calculus-c-bank.json'), encoding='utf-8'))
subs = [s for s in json.load(open(os.path.join(root, 'data', 'submissions-log.json'), encoding='utf-8')) if s.get('username') == USER and s.get('courseId') == COURSE and s.get('unit') == 'C']

def letter(x):
    x = x.strip().upper(); return x if x in ('A', 'B', 'C', 'D') else ''
def parse(text):
    """-> [set 1 letters, set 2 letters]; '' is an unanswered problem. Handles "1B\\n2C..." (numbered, restarting at 1) and "a,b,c\\n\\nb,c,d" lists."""
    t = text.strip()
    if re.match(r'^\d+\s*[A-Da-d]?\s*\n', t):
        sets, cur = [], {}
        for line in t.split('\n'):
            m = re.match(r'^(\d+)\s*([A-Da-d]?)\s*$', line.strip())
            if not m: continue
            n = int(m.group(1))
            if n == 1 and cur: sets.append(cur); cur = {}
            cur[n] = letter(m.group(2))
        sets.append(cur)
        return [[s.get(i, '') for i in range(1, max(s) + 1)] for s in sets]
    out = []
    for seg in [x for x in re.split(r'\n\s*\n', t) if x.strip()]:
        seg = re.sub(r'^[AB]\s*[-:]\s*', '', seg.strip())
        out.append([letter(x) for x in seg.replace('\n', ',').split(',')])
    return out

result, cdates, report = {}, {}, {}
for ch, (label, day, take, why) in USE.items():
    sub = [s for s in subs if s['chapter'] == label and s['receivedAt'].startswith(day) and (s.get('answers') or {}).get('answer')]
    if len(sub) != 1: sys.exit('Expected one submission for chapter %s, found %d' % (ch, len(sub)))
    sets = parse(str(sub[0]['answers']['answer']))
    names = ['A', 'B'] if len(sets) == 2 else ['A']
    probs, hit, said = [], 0, 0
    for name, letters in zip(names, sets):
        if name not in take: continue
        qs = [q for q in bank[ch]['problems'] if str(q['id']).startswith(name)]
        n = take[name]
        if n > len(letters) or n > len(qs): sys.exit('Chapter %s set %s: not enough answers (%d) or problems (%d) for %d' % (ch, name, len(letters), len(qs), n))
        for a, q in zip(letters[:n], qs[:n]):
            probs.append({'id': str(q['id']), 'answer': a, 'result': 'blank' if not a else 'correct' if a == q['correct'] else 'wrong'})
            if a: said += 1; hit += (a == q['correct'])
    if said == 0 or hit / said < 0.8: sys.exit('Chapter %s: only %d of %d match the key, refusing to import' % (ch, hit, said))
    result[ch] = probs; cdates[ch] = sub[0]['receivedAt'][:19] + 'Z'
    report[ch] = {'problems': len(probs), 'matched': '%d/%d' % (hit, said), 'blank': sum(1 for p in probs if p['result'] == 'blank'), 'why': why}
path = os.path.join(root, 'data', 'legacy-answers.json')
out = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
out[USER + '|' + COURSE] = {'source': 'submissions-log.json (answer lists typed in the old C-unit forms)', 'cdates': cdates, 'rdates': {}, 'units': result}
json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(path, 'a').write('\n')
print(json.dumps(report, indent=1, ensure_ascii=False))
