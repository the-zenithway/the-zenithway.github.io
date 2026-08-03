# calculus-t-bank.json / calculus-c-bank.json / chemistry-t-bank.json / chemistry-c-bank.json

Four separate databases, one per (subject × chapter-type):

- **`calculus-t-bank.json`** — filled. T1-T10 parallel tests for AP Calculus
  BC, parsed from the `Tn_*_Problems.tex` / `Tn_*_Answers.tex` files in each
  chapter folder under `/Users/kyj/Documents/Zenith Resources/AP Calculus BC/`.
- **`chemistry-t-bank.json`** — filled. T1-T10 tests for AP Chemistry, parsed
  from `Tn.tex` / `TSn.tex` in `/Users/kyj/Documents/Zenith Resources/AP Chemistry/`.
- **`calculus-c-bank.json`** / **`chemistry-c-bank.json`** — placeholders
  (`{}`), intentionally left blank. Not yet built from the C-chapter
  (primary coursework) source material.

## Shape

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

## Regenerating

Both t-banks are parsed straight from the `.tex` source (not the PDFs) —
regenerate by re-parsing `\noindent\prob{ID}. stem \begin{choices}...
\end{choices}` blocks and the `ID.\ LETTER\\` answer-key lines if the source
chapters change.
