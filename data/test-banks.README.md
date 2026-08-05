# calculus-t-bank.json / calculus-c-bank.json / chemistry-t-bank.json / chemistry-c-bank.json

Four separate databases, one per (subject × chapter-type):

- **`calculus-t-bank.json`** — filled. T1-T10 parallel tests for AP Calculus
  BC, parsed from the `Tn_*_Problems.tex` / `Tn_*_Answers.tex` files in each
  chapter folder under `/Users/kyj/Documents/zenith-resources/AP Calculus BC/`.
- **`chemistry-t-bank.json`** — filled. T1-T10 tests for AP Chemistry, parsed
  from `Tn.tex` / `TSn.tex` in `/Users/kyj/Documents/zenith-resources/AP Chemistry/`.
- **`calculus-c-bank.json`** — filled. C1-C12 coursework (chapters 1-11 are
  multiple-choice practice sets, chapter 12 is free-response) for AP
  Calculus BC, parsed from `Cn_*_Problems.tex` / `Sn_*_Solutions.tex` — see
  the dedicated section below, its shape differs from the T-banks.
- **`chemistry-c-bank.json`** — placeholder (`{}`), intentionally left
  blank. Not yet built — do not build without being asked; this was
  explicitly deferred.

## Shape (T-banks)

```json
{
  "1": {
    "title": "Functions",
    "problems": [
      {
        "id": "T1",
        "stem_tex": "If $f(x) = x^3 - 3x - 1$, then $f(-2) =$",
        "choices_tex": ["$-13$", "$-3$", "$-1$", "$7$"],
        "correct": "B",
        "explanation_tex": "..."   // chemistry only; calc has no worked explanation, just the letter
      },
      ...
    ],
    "answer_key": { "T1": "B", "T2": "D", ... }
  },
  "2": { ... },
  ...
  "10": { ... }
}
```

Chapter keys are strings `"1"`-`"10"`.

## How to grade a submission

Given a student's answers like `T1.A, T2.B, ...` for course `X` chapter `N`:

1. Load `answer_key` for that chapter from the matching bank
   (`calculus-t-bank.json` for `ap-calculus-bc`, `chemistry-t-bank.json` for
   `ap-chemistry`) — compare directly against the student's letters to find
   every wrong answer, no parsing needed for this step.
2. For each wrong answer, look up the same `id` in `problems` to get
   `stem_tex` + `choices_tex` (the actual question and choices) and, for
   chemistry, `explanation_tex` (why the correct choice is right). Use that
   to write feedback on *why* the student's choice was wrong.
3. For calculus, there's no pre-written explanation — work out the reasoning
   from `stem_tex` directly (these are self-contained AP Calc MC problems).

## Known edge case

`calculus-t-bank.json` chapter 4, problem `T45`: its answer choices are
LaTeX tables (`\begin{tabular}`), not the usual `\begin{choices}` list, so
`choices_tex` is `[]` for that one problem — the full choice content is
still present inside `stem_tex`, just not split out.

## Regenerating (T-banks)

Both t-banks are parsed straight from the `.tex` source (not the PDFs) —
regenerate by re-parsing `\noindent\prob{ID}. stem \begin{choices}...
\end{choices}` blocks and the `ID.\ LETTER\\` answer-key lines if the source
chapters change.

---

## calculus-c-bank.json (Coursework / chapter problems)

Different source, different shape from the T-banks. The `Cn_*_Problems.tex`
files are **not** real LaTeX (no `\prob{}` macros) — they're plain text
pulled from an older PDF, using literal `x3` instead of `x^3`, unicode
minus signs, etc. So unlike the T-banks, this data is **not** typeset in
LaTeX — it's cleaned plain text, still perfectly readable for grading, just
don't expect `$...$` delimiters here.

### Shape

```json
{
  "1": {
    "title": "Functions",
    "type": "mcq",
    "problems": [
      {
        "id": "A1",
        "stem": "If f(x) = x3 - 2x - 1, then f(-2) =",
        "choices": ["-13", "-5", "-1", "7"],
        "correct": "B",
        "explanation": "f(-2) = (-2)3 - 2(-2) - 1 = -5."
      },
      ...
    ],
    "answer_key": { "A1": "B", "A2": "D", ... }
  },
  ...
  "11": { "title": "Miscellaneous Multiple Choice Questions", "type": "mcq", ... },
  "12": {
    "title": "Miscellaneous Free Response Questions",
    "type": "frq",
    "problems": [
      { "id": "A1", "stem": "...(full multi-part question, (a)/(b)/(c)/(d) inline)...", "explanation": "...worked solution..." },
      ...
    ]
    // no answer_key, no choices/correct — free response, not multiple choice
  }
}
```

Chapter keys are strings `"1"`-`"12"`. Check `type` before assuming a
chapter has `choices`/`correct`/`answer_key` — chapter 12 is FRQ and has
neither. Problem `id`s are exactly what the source prints (`A1`..`A~n`
from "PART A", `B1`..`B~n` from "PART B" where a chapter has one), not
zero-padded or chapter-prefixed.

### Known limitation — blank choices/explanations

The source PDFs had inline images for some answer choices and diagrams
(graphs, tables, multi-line equation setups) that never made it into the
`.tex` text extraction. Where that happened, `choices` contains an empty
string `""` for that letter, or `explanation` reads as an abrupt sentence
fragment ("Solve the pair of equations Add to get A..." — the equations
were an image). This is common, not rare: roughly 15-60% of problems per
chapter have at least one blank choice (chapter 12/FRQ is unaffected — no
multiple-choice structure to lose). `stem` is far more reliable than
`choices`/`explanation` since it's mostly prose. If you hit a blank choice
while grading, fall back to reasoning from `stem` + `correct` alone, same
as the T-bank's table-based edge case.

### Regenerating

`scripts/parse_calculus_c_bank.py` — reads the `Cn_*_Problems.tex` /
`Sn_*_Solutions.tex` pairs from
`/Users/kyj/Documents/zenith-resources/AP Calculus BC/`, re-run with
`python3 scripts/parse_calculus_c_bank.py` if the source chapters change.
Problem-id line detection is regex-based (`^\s*([AB]\d{1,2})\.` for a
problem, `^\s*\(([A-D])\)` for a choice) — if a future chapter uses a
different labeling convention, the script will need updating, not just
re-running.

## chemistry-c-bank.json

Not built. Explicitly deferred — ask before building this one.
