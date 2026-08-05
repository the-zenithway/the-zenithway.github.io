# CLAUDE.md

Project context for Claude Code sessions working in this repo. See
[README.md](README.md) for the general architecture/file-structure overview.

## Checking student test submissions / giving feedback

When asked to check a student's submitted answers (e.g. `T1.A, T2.B, ...`,
submitted through the form linked from `submit.html` and logged in
`data/submissions-log.json`) or to give feedback on a chapter, the actual
problem statements and correct answers are **not** in this repo's page code —
they live in four data banks under `data/`, one per subject × chapter-type:

- **`data/calculus-t-bank.json`** — filled. AP Calculus BC T1-T10 parallel
  tests.
- **`data/chemistry-t-bank.json`** — filled. AP Chemistry T1-T10 tests.
- **`data/calculus-c-bank.json`** — filled. AP Calculus BC C1-C12 coursework
  (C1-C11 multiple-choice, C12 free-response) — different shape from the
  T-banks, see below.
- **`data/chemistry-c-bank.json`** — placeholder (`{}`), not yet built.
  Explicitly deferred — do not build without being asked.

Full shape and grading workflow: see `data/test-banks.README.md`. Short
version — each **T-bank** is keyed by chapter number (`"1"`-`"10"`), each
chapter has `answer_key` (id -> correct letter, for instant comparison
against a student's submitted letters) and `problems` (id, `stem_tex`,
`choices_tex`, `correct`, plus `explanation_tex` for chemistry only). Diff
the student's letters against `answer_key` first to find what's wrong, then
pull the matching `problems` entry for each miss to write feedback on why.
Calculus has no pre-written explanation — reason it out from `stem_tex`
directly.

`calculus-c-bank.json` is keyed `"1"`-`"12"`, each chapter tagged `type:
"mcq"` or `"frq"` — chapter 12 is free-response and has no `choices` /
`correct` / `answer_key`. Field names are `stem`/`choices`/`explanation`
(no `_tex` suffix — this bank is cleaned plain text, not LaTeX, since its
`.tex` source isn't real LaTeX either). Many problems have a blank string
somewhere in `choices` where the original PDF had an inline image the text
extraction couldn't capture — see the README's "Known limitation" section
before trusting a blank choice as ground truth.

Course id strings match `js/data.js`'s `STUDENTS[].courses[].id`
(`ap-calculus-bc`, `ap-chemistry`).

Banks are generated from the `.tex` source under
`/Users/kyj/Documents/zenith-resources/`, not hand-maintained here — if the
source chapters change, regenerate rather than hand-editing the JSON
(`scripts/parse_calculus_c_bank.py` for the calc C-bank).
