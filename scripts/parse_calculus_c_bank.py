# Regenerates data/calculus-c-bank.json from the Cn_*_Problems.tex /
# Sn_*_Solutions.tex source files. See data/test-banks.README.md for the
# output schema and known limitations (some choices/explanations come out
# blank where the original PDF had an embedded image/equation that the
# .tex source never captured as text).
#
# Usage: python3 scripts/parse_calculus_c_bank.py
# (paths are hardcoded below since the source lives outside this repo)

import re, json, sys, unicodedata

BASE = "/Users/kyj/Documents/zenith-resources/AP Calculus BC"

CHAPTERS = [
    (1,  "Functions", "1_ Functions", "C1_Functions_Problems.tex", "S1_Functions_Solutions.tex", "mcq"),
    (2,  "Limits and Continuity", "2_ Limits and Continuity", "C2_Limits_and_Continuity_Problems.tex", "S2_Limits_and_Continuity_Solutions.tex", "mcq"),
    (3,  "Differentiation", "3_ Differentiation", "C3_Differentiation_Problems.tex", "S3_Differentiation_Solutions.tex", "mcq"),
    (4,  "Application of Differential Calculus", "4_ Application of Differential Calculus", "C4_Applications_of_Differential_Calculus_Problems.tex", "S4_Applications_of_Differential_Calculus_Solutions.tex", "mcq"),
    (5,  "Antidifferentiation", "5_ Antidifferentiation", "C5_Antidifferentiation_Problems.tex", "S5_Antidifferentiation_Solutions.tex", "mcq"),
    (6,  "Definite Integrals", "6_ Definite Integrals", "C6_Definite_Integrals_Problems.tex", "S6_Definite_Integrals_Solutions.tex", "mcq"),
    (7,  "Application of Integration to Geometry", "7_ Application of Integration to Geometry", "C7_Application_of_Integration_to_Geometry_Problems.tex", "S7_Application_of_Integration_to_Geometry_Solutions.tex", "mcq"),
    (8,  "Further Applications of Integration", "8_ Further Applications of Integration", "C8_Further_Application_of_Integration_Problems.tex", "S8_Further_Apllications_of_Integration_Solutions.tex", "mcq"),
    (9,  "Differential Equations", "9_ Differential Equations", "C9_Differential_Equations_Problems.tex", "S9_Differential_Equations_Solution.tex", "mcq"),
    (10, "Sequences and Series", "10_ Sequences and Series", "C10_Sequences_and_Sries_Problems.tex", "S10_Sequences_and_Series_Solution.tex", "mcq"),
    (11, "Miscellaneous Multiple Choice Questions", "11_ Miscellaneous Multiple Choice Questions", "C11_Misc_MCQ_Problems.tex", "S11_Misc_MCQ_Solutions.tex", "mcq"),
    (12, "Miscellaneous Free Response Questions", "12_ Miscellaneous Free Response Questions", "C12_Misc_MCQ_Problems.tex", "S12_Misc_FRQ_Solutions.tex", "frq"),
]

def clean(text):
    text = unicodedata.normalize("NFKC", text)
    # collapse whitespace/newlines
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r' *\n *', ' ', text)
    text = text.strip()
    # normalize common unicode math glyphs to readable ascii-ish
    repl = {
        '–': '-', '—': '-',   # en/em dash -> hyphen
        '−': '-',                   # minus sign
        '≠': '!=', '≤': '<=', '≥': '>=',
        '⋅': '*',
    }
    for a, b in repl.items():
        text = text.replace(a, b)
    return text.strip()

ID_RE = re.compile(r'^\s*([AB]\d{1,2})\.\s?(.*)$')
CHOICE_RE = re.compile(r'^\s*\(([A-D])\)\s?(.*)$')
PART_RE = re.compile(r'^\s*PART [AB]\.', re.IGNORECASE)

def parse_mcq_problems(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    problems = {}
    order = []
    cur_id = None
    cur_stem_lines = []
    cur_choices = {}
    cur_choice_letter = None

    def flush():
        nonlocal cur_id, cur_stem_lines, cur_choices, cur_choice_letter
        if cur_id:
            stem = clean(''.join(cur_stem_lines))
            choices = []
            for L in ['A', 'B', 'C', 'D']:
                choices.append(clean(cur_choices.get(L, '')))
            problems[cur_id] = {'stem': stem, 'choices': choices}
            order.append(cur_id)
        cur_id = None
        cur_stem_lines = []
        cur_choices = {}
        cur_choice_letter = None

    for line in lines:
        m_id = ID_RE.match(line)
        if m_id and not CHOICE_RE.match(line):
            flush()
            cur_id = m_id.group(1)
            cur_stem_lines = [m_id.group(2) + '\n']
            continue
        m_ch = CHOICE_RE.match(line)
        if m_ch and cur_id:
            cur_choice_letter = m_ch.group(1)
            cur_choices[cur_choice_letter] = m_ch.group(2) + '\n'
            continue
        if cur_id:
            if cur_choice_letter:
                cur_choices[cur_choice_letter] += line
            else:
                cur_stem_lines.append(line)
    flush()
    return problems, order

def parse_mcq_solutions(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    ANSWER_RE = re.compile(r'^\s*([AB]\d{1,2})\.\s*\(([A-D])\)\s?(.*)$')
    ID_ONLY_RE = re.compile(r'^\s*([AB]\d{1,2})\.\s?(.*)$')

    answers = {}
    explanations = {}
    cur_id = None
    cur_lines = []

    def flush():
        nonlocal cur_id, cur_lines
        if cur_id:
            explanations[cur_id] = clean(''.join(cur_lines))
        cur_id = None
        cur_lines = []

    for line in lines:
        m = ANSWER_RE.match(line)
        if m:
            flush()
            cur_id = m.group(1)
            answers[cur_id] = m.group(2)
            cur_lines = [m.group(3) + '\n']
            continue
        m2 = ID_ONLY_RE.match(line)
        if m2:
            flush()
            cur_id = m2.group(1)
            cur_lines = [m2.group(2) + '\n']
            continue
        if cur_id:
            cur_lines.append(line)
    flush()
    return answers, explanations

def parse_frq_problems(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    ID_RE_FRQ = re.compile(r'^\s*([AB]\d{1,2})\.\s?(.*)$')
    problems = {}
    order = []
    cur_id = None
    cur_lines = []
    def flush():
        nonlocal cur_id, cur_lines
        if cur_id:
            problems[cur_id] = clean(''.join(cur_lines))
            order.append(cur_id)
        cur_id = None
        cur_lines = []
    for line in lines:
        m = ID_RE_FRQ.match(line)
        if m:
            flush()
            cur_id = m.group(1)
            cur_lines = [m.group(2) + '\n']
            continue
        if cur_id:
            cur_lines.append(line)
    flush()
    return problems, order

def parse_frq_solutions(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    ID_RE_FRQ = re.compile(r'^\s*([AB]\d{1,2})\.\s?(.*)$')
    explanations = {}
    cur_id = None
    cur_lines = []
    def flush():
        nonlocal cur_id, cur_lines
        if cur_id:
            explanations[cur_id] = clean(''.join(cur_lines))
        cur_id = None
        cur_lines = []
    for line in lines:
        m = ID_RE_FRQ.match(line)
        if m:
            flush()
            cur_id = m.group(1)
            cur_lines = [m.group(2) + '\n']
            continue
        if cur_id:
            cur_lines.append(line)
    flush()
    return explanations

bank = {}
stats = []

for num, title, folder, cfile, sfile, ctype in CHAPTERS:
    cpath = f"{BASE}/{folder}/{cfile}"
    spath = f"{BASE}/{folder}/{sfile}"
    chapter_entry = {"title": title, "type": ctype}

    if ctype == "mcq":
        problems, order = parse_mcq_problems(cpath)
        answers, explanations = parse_mcq_solutions(spath)
        plist = []
        missing_choice_ids = []
        no_answer_ids = []
        for pid in order:
            p = problems[pid]
            choices = p['choices']
            if any(c == '' for c in choices):
                missing_choice_ids.append(pid)
            correct = answers.get(pid)
            if not correct:
                no_answer_ids.append(pid)
            entry = {
                "id": pid,
                "stem": p['stem'],
                "choices": choices,
                "correct": correct,
            }
            if pid in explanations and explanations[pid]:
                entry["explanation"] = explanations[pid]
            plist.append(entry)
        chapter_entry["problems"] = plist
        chapter_entry["answer_key"] = {pid: answers[pid] for pid in order if pid in answers}
        stats.append((num, len(order), len(missing_choice_ids), len(no_answer_ids)))
    else:
        problems, order = parse_frq_problems(cpath)
        explanations = parse_frq_solutions(spath)
        plist = []
        for pid in order:
            entry = {"id": pid, "stem": problems[pid]}
            if pid in explanations and explanations[pid]:
                entry["explanation"] = explanations[pid]
            plist.append(entry)
        chapter_entry["problems"] = plist
        stats.append((num, len(order), 0, 0))

    bank[str(num)] = chapter_entry

with open("/Users/kyj/Documents/zenith-website/data/calculus-c-bank.json", "w", encoding="utf-8") as f:
    json.dump(bank, f, ensure_ascii=False, indent=2)

print("chapter, num_problems, missing_choices, no_answer")
for row in stats:
    print(row)
