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
- **`data/calculus-c-bank.json`** / **`data/chemistry-c-bank.json`** —
  placeholders (`{}`), not yet built.

Full shape and grading workflow: see `data/test-banks.README.md`. Short
version — each filled bank is keyed by chapter number (`"1"`-`"10"`), each
chapter has `answer_key` (id -> correct letter, for instant comparison
against a student's submitted letters) and `problems` (id, `stem_tex`,
`choices_tex`, `correct`, plus `explanation_tex` for chemistry only). Diff
the student's letters against `answer_key` first to find what's wrong, then
pull the matching `problems` entry for each miss to write feedback on why.
Calculus has no pre-written explanation — reason it out from `stem_tex`
directly.

Course id strings match `js/data.js`'s `STUDENTS[].courses[].id`
(`ap-calculus-bc`, `ap-chemistry`).

Banks are generated from the `.tex` source under
`/Users/kyj/Documents/Zenith Resources/`, not hand-maintained here — if the
source chapters change, regenerate rather than hand-editing the JSON.
