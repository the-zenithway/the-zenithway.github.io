#!/usr/bin/env python3
"""Build data/calculus-ap-frq-bank.json (+ figure PNGs) from the APFRQs archive.

Source: /Users/kyj/Documents/zenith-resources/apfrqs-archive (the transcribed LaTeX in
calculus-bc-latex/ plus the problem index). 162 AP Calculus BC free-response questions,
1998-2025 (no 2020). Re-run this script instead of hand-editing the output.

Each problem keeps its archive id (25FRQ1 = 2025, printed question 1), its unit tags
(from apfrqs.com "By topic", not independently checked) and a calculator flag. There is no
worked solution in the archive; scoring_url points at the year's official scoring guidelines.

    python3 scripts/build_ap_frq_bank.py [--archive PATH]
"""
import argparse, csv, json, os, re, subprocess, sys, tempfile
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_ARCHIVE = '/Users/kyj/Documents/zenith-resources/apfrqs-archive'
UNIT_TITLES = {
    1: 'Limits and Continuity', 2: 'Differentiation: Definition and Fundamental Properties',
    3: 'Differentiation: Composite, Implicit, and Inverse Functions', 4: 'Contextual Applications of Differentiation',
    5: 'Analytical Applications of Differentiation', 6: 'Integration and Accumulation of Change',
    7: 'Differential Equations', 8: 'Applications of Integration',
    9: 'Parametric Equations, Polar Coordinates, and Vector-Valued Functions', 10: 'Infinite Sequences and Series',
}


def cell_to_math(cell):
    """tabular cell (text mode with $..$ math) -> math-mode cell for a KaTeX array."""
    parts = cell.strip().split('$')
    out = []
    for i, seg in enumerate(parts):
        if i % 2:                       # inside $..$
            out.append(seg)
        elif seg.strip():
            t = seg.strip()
            out.append(t if re.fullmatch(r'[-+0-9.,]+', t) else r'\text{' + t + '}')
    return ' '.join(out)


def table_to_array(m):
    spec, body = m.group(1), m.group(2)
    rows = []
    for row in re.split(r'\\\\', body):
        row = row.strip()
        if not row:
            continue
        lead = ''
        while row.startswith('\\hline'):
            lead += '\\hline '
            row = row[len('\\hline'):].strip()
        trail = ''
        while row.endswith('\\hline'):
            trail += ' \\hline'
            row = row[:-len('\\hline')].strip()
        # "\hline" can sit between header and first data row inside one split piece
        pieces = re.split(r'\\hline', row)
        if len(pieces) > 1:
            rows.append(lead + ' & '.join(cell_to_math(c) for c in pieces[0].split('&')) + ' \\\\ \\hline')
            for p in pieces[1:]:
                p = p.strip()
                if p:
                    rows.append(' & '.join(cell_to_math(c) for c in p.split('&')) + trail.replace(' \\hline', ''))
            continue
        rows.append(lead + ' & '.join(cell_to_math(c) for c in row.split('&')) + trail)
    return '$$\\begin{array}{' + spec + '}' + ' \\\\ '.join(rows) + '\\end{array}$$'


def tex_to_stem(tex):
    """problem .tex -> (stem string, [figure basenames])."""
    lines = [l for l in tex.split('\n') if not l.lstrip().startswith('%')]
    s = '\n'.join(lines)
    figs = re.findall(r'\\includegraphics(?:\[[^\]]*\])?\{figures/([^}]+)\.pdf\}', s)
    s = re.sub(r'\\begin\{center\}\s*\\includegraphics[^\n]*?\\end\{center\}', '', s)
    s = re.sub(r'\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}', '', s)
    s = re.sub(r'\\begin\{center\}(.*?)\\end\{center\}', r'\1', s, flags=re.S)
    s = re.sub(r'\\begin\{tabular\}\{([^}]*)\}(.*?)\\end\{tabular\}', table_to_array, s, flags=re.S)
    s = s.replace('\\$', '$\\$$')  # literal dollar in prose: render as math-mode \$ so $ delimiters stay unambiguous
    # lists: explicit labels (a)/(i); bare \item inside label=\Alph* lists get a), b), ...
    out, stack = [], []
    for raw in s.split('\n'):
        line = raw.rstrip()
        m = re.match(r'\\begin\{enumerate\}(\[[^\]]*\])?\s*$', line.strip())
        if m:
            stack.append(0); out.append(''); continue
        if line.strip() == '\\end{enumerate}':
            if stack:
                stack.pop()
            out.append(''); continue
        m = re.match(r'\\item(?:\[([^\]]*)\])?\s*(.*)$', line.strip())
        if m:
            if stack:
                stack[-1] += 1
            label = m.group(1)
            if label is None:
                label = chr(96 + (stack[-1] if stack else 1)) + ')'
            label = label.strip()
            if not label.startswith('('):
                label = '(' + label.rstrip(')') + ')'
            indent = '    ' if len(stack) > 1 else ''
            out.append('')
            out.append(indent + label + ' ' + m.group(2))
            continue
        out.append(line)
    # hard-wrapped paragraphs -> one line each; blank line = paragraph break
    paras, cur = [], []
    for l in out:
        if l.strip() == '':
            if cur:
                paras.append(' '.join(cur)); cur = []
        elif re.match(r'\s*\(([a-z]|i{1,3}|iv)\)\s', l):
            if cur:
                paras.append(' '.join(cur))
            cur = [l.strip()] if not l.startswith('    ') else [l.strip()]
            if l.startswith('    '):
                cur[0] = '    ' + cur[0]
        else:
            cur.append(l.strip())
    if cur:
        paras.append(' '.join(cur))
    return '\n\n'.join(p for p in paras if p).strip(), figs


def make_figure(pdfs, dest):
    """Rasterise one or more cropped figure PDFs (stacked vertically) to a single PNG."""
    from PIL import Image
    ims = []
    with tempfile.TemporaryDirectory() as td:
        for i, pdf in enumerate(pdfs):
            base = os.path.join(td, 'f%d' % i)
            subprocess.run(['pdftoppm', '-r', '170', '-png', '-singlefile', pdf, base], check=True)
            ims.append(Image.open(base + '.png').convert('RGB'))
        if len(ims) == 1:
            out = ims[0]
        else:
            w = max(i.width for i in ims); h = sum(i.height for i in ims) + 24 * (len(ims) - 1)
            out = Image.new('RGB', (w, h), 'white'); y = 0
            for i in ims:
                out.paste(i, ((w - i.width) // 2, y)); y += i.height + 24
        out.save(dest, optimize=True)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--archive', default=DEFAULT_ARCHIVE)
    a = ap.parse_args()
    arch = a.archive
    idx = json.load(open(os.path.join(arch, 'calculus-bc-problems.json')))
    links = {}
    for r in csv.DictReader(open(os.path.join(arch, 'calculus-bc-resource-links.csv'))):
        links.setdefault(r['problem_id'], {})[r['resource_name']] = r['source_url']
    figdir = os.path.join(ROOT, 'data', 'calculus-figures')
    os.makedirs(figdir, exist_ok=True)
    problems, issues = [], []
    for it in idx:
        pid = it['problem_id']
        tex = open(os.path.join(arch, 'calculus-bc-latex', 'problems', pid + '.tex')).read()
        stem, figs = tex_to_stem(tex)
        units = [int(u) for u in it['unit_numbers'].split(';') if u]
        yr, qn = it['year'], it['question_number']
        t = (it.get('source_question_type') or '').lower().replace('-', ' ')
        if t.startswith('no'):
            calc = 'no'
        elif t.startswith('calc'):
            calc = 'yes'
        else:  # label missing in the index: Part A (calculator) was Q1-3 through 2007, Q1-2 since 2008
            calc = 'yes' if qn <= (3 if yr <= 2007 else 2) else 'no'
        p = {'id': pid, 'stem_tex': stem, 'review_status': 'source-reviewed',
             'explanation_tex': 'No worked solution here. Open the official scoring guidelines for this year (link below) and score yourself against them.',
             'year': yr, 'number': qn, 'calculator': calc, 'units': units}
        if figs:
            name = 'apfrq-' + pid.lower() + '.png'
            make_figure([os.path.join(arch, 'calculus-bc-latex', 'figures', f + '.pdf') for f in figs], os.path.join(figdir, name))
            p['figure'] = {'src': 'data/calculus-figures/' + name, 'alt': 'Figure for %d AP Calculus BC free-response question %d' % (yr, qn)}
        elif re.search(r'\b(shown|graph|figure|diagram) (above|below)|given above|above figure', stem, re.I):
            issues.append(pid + ': mentions a figure but none was attached')
        res = links.get(pid, {})
        if res.get('Scoring Guidelines.pdf'):
            p['scoring_url'] = res['Scoring Guidelines.pdf']
        if res.get('Sample Responses Q%d.pdf' % qn):
            p['samples_url'] = res['Sample Responses Q%d.pdf' % qn]
        if '\\' in re.sub(r'\\(?:[a-zA-Z]+|[%{}\\,;!\[\]()| $])', '', stem):
            issues.append(pid + ': stray backslash left in stem')
        if re.search(r'\\(?:begin|end)\{(?:enumerate|tabular|center)\}|\\item|\\includegraphics', stem):
            issues.append(pid + ': unconverted LaTeX structure')
        problems.append(p)
    bank = {'ap': {'title': 'AP Calculus BC free-response archive (1998-2025)', 'type': 'frq', 'source': 'apfrqs.com / College Board',
                   'unit_titles': {str(k): v for k, v in UNIT_TITLES.items()}, 'problems': problems}}
    out = os.path.join(ROOT, 'data', 'calculus-ap-frq-bank.json')
    json.dump(bank, open(out, 'w'), indent=1, ensure_ascii=False)
    print('wrote', out, len(problems), 'problems;', sum(1 for p in problems if 'figure' in p), 'with figures')
    for i in issues:
        print('ISSUE', i)
    return 1 if issues else 0


if __name__ == '__main__':
    sys.exit(main())
