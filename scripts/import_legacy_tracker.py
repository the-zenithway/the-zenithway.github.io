#!/usr/bin/env python3
"""Turn a per-problem tracker CSV (what a student answered in the old roadmap's C units) into data/legacy-answers.json.

    python3 scripts/import_legacy_tracker.py <csv> <username> <course> [--cdates 1=<when the C unit was done>,...] [--rdates 1=<when the review was done>,...]

CSV columns: Unit (Ch1C), Problem (A1), Her answer (letter, or * when skipped), Correct (letter), Result (correct / wrong / blank), Follow-up.
Every row is checked against today's bank (data/calculus-c-bank.json: the problem must exist and the answer key must match), so a stale
tracker is refused instead of imported. scripts/migrate_legacy.cjs turns the JSON into answer / entry events in data/legacy-import.json."""
import csv, json, sys, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
csv_path, username, course = args[0], args[1], args[2]
rdates, cdates = {}, {}
if '--rdates' in sys.argv: rdates = dict(p.split('=', 1) for p in sys.argv[sys.argv.index('--rdates') + 1].split(','))
if '--cdates' in sys.argv: cdates = dict(p.split('=', 1) for p in sys.argv[sys.argv.index('--cdates') + 1].split(','))
bank = json.load(open(os.path.join(root, 'data', 'calculus-c-bank.json'), encoding='utf-8'))
units = {}
for r in csv.DictReader(open(csv_path, encoding='utf-8-sig')):
    ch = re.match(r'Ch(\d+)C', r['Unit']).group(1)
    ids = {str(p['id']): p for p in bank[ch]['problems']}
    p = ids.get(r['Problem'])
    if not p: sys.exit('Not in the bank: ' + r['Unit'] + ' ' + r['Problem'])
    if p.get('correct') != r['Correct']: sys.exit('Answer key differs from the bank: %s %s (%s vs %s)' % (r['Unit'], r['Problem'], r['Correct'], p.get('correct')))
    units.setdefault(ch, []).append({'id': r['Problem'], 'answer': '' if r['Her answer'] in ('*', '') else r['Her answer'], 'result': r['Result']})
out = {}
path = os.path.join(root, 'data', 'legacy-answers.json')
if os.path.exists(path): out = json.load(open(path, encoding='utf-8'))
out[username + '|' + course] = {'source': os.path.basename(csv_path), 'cdates': cdates, 'rdates': rdates, 'units': units}
json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(path, 'a').write('\n')
print({ch: len(v) for ch, v in units.items()}, 'problems;', sum(1 for v in units.values() for p in v if p['result'] != 'correct'), 'to review')
