"""Validate reviewed Calculus records, coverage, assets, and grading keys.

Use --require-complete for the final release check. This checks structure,
not mathematical truth; source review and worked solutions remain essential.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--require-complete', action='store_true')
args = parser.parse_args()
errors = []
counts = dict(total=0, reviewed=0, source_issues=0, figures=0)
unsupported = re.compile(r'\\begin\{(?:tikzpicture|tabular|enumerate|center|choices)\}')
for kind, expected in [('c', 745), ('t', 595)]:
    bank = json.loads((ROOT / f'data/calculus-{kind}-bank.json').read_text())
    total = sum(len(g['problems']) for g in bank.values())
    if total != expected:
        errors.append(f'{kind}: expected {expected} records, got {total}')
    counts['total'] += total
    for chapter, group in bank.items():
        seen = set()
        for p in group['problems']:
            label = f'{kind.upper()}{chapter} {p["id"]}'
            if p['id'] in seen:
                errors.append(f'{label}: duplicate ID')
            seen.add(p['id'])
            if p.get('review_status') != 'source-reviewed':
                if args.require_complete:
                    errors.append(f'{label}: not reviewed')
                continue
            counts['reviewed'] += 1
            for field in ['stem_tex', 'explanation_tex']:
                if not p.get(field, '').strip():
                    errors.append(f'{label}: empty {field}')
            values = [p.get('stem_tex', ''), p.get('explanation_tex', '')] + p.get('choices_tex', [])
            for value in values:
                if unsupported.search(value):
                    errors.append(f'{label}: unsupported document environment')
                if len(re.findall(r'(?<!\\)\$', value)) % 2:
                    errors.append(f'{label}: unmatched math delimiter')
            if group.get('type') != 'frq':
                choices = p.get('choices_tex', [])
                if len(choices) != 4 or not all(x.strip() for x in choices):
                    errors.append(f'{label}: requires four nonempty choices')
                if p.get('source_issue'):
                    counts['source_issues'] += 1
                    if p.get('correct') is not None or p['id'] in group.get('answer_key', {}):
                        errors.append(f'{label}: source-invalid question still graded')
                elif p.get('correct') not in ['A', 'B', 'C', 'D'] or group.get('answer_key', {}).get(p['id']) != p['correct']:
                    errors.append(f'{label}: inconsistent answer key')
            figure = p.get('figure')
            if figure:
                counts['figures'] += 1
                if not re.fullmatch(r'data/calculus-figures/[a-z0-9-]+\.(png|svg)', figure.get('src', '')):
                    errors.append(f'{label}: unsafe figure path')
                elif not (ROOT / figure['src']).is_file():
                    errors.append(f'{label}: missing figure file')
                if not figure.get('alt', '').strip():
                    errors.append(f'{label}: missing figure description')
print(json.dumps({'counts': counts, 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
