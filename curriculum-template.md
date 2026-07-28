# Curriculum Template — Building a Subject Roadmap

This is the canonical structure for any course's `roadmap` array in
`js/data.js`. Follow it when building a new subject or extending an
existing one, so every course stays structurally consistent and keeps
both the **System** pillar (absolute clarity — the student always knows
what's next) and the **Active Engagement & Motivation** pillar (regular
testing and direct checking, not just information) intact. See
[philosophy.html](philosophy.html) for the full pillar framework.

Reference implementation: Bogue Kwon's AP Calculus BC roadmap in
`js/data.js` (88 rows) is the most complete example and should be copied
from, not reinvented, when building a new subject.

## Category legend

Each roadmap row has a `category`. Use these exact strings — the app's
color-coding and progression logic key off them:

| Category | Meaning | Pillar it serves |
|---|---|---|
| `I-information` | Orientation material for the whole exam/course — exam description, terminology, formula sheets. Lives at "Chapter 0", not a numbered chapter. | System |
| `B-book chapter` | The primary reading/lecture content for one chapter. | System |
| `L-Learning` | Same role as `B-book chapter`, used instead of it when the primary content is a lesson/video (e.g. Khan Academy) rather than a textbook chapter. Don't mix `B` and `L` within one subject — pick one per course. | System |
| `C-coursework` | Practice problems for the chapter. | Active Engagement |
| `S-solution manual` | Answer key/solutions for the matching `C` (or `M` mock). | System |
| `N-Notes Submission` | A required, checked submission of the student's own notes — this is what makes `L`/`B` content "checked," not just assigned. | Active Engagement |
| `R-Review` | A review pass before the chapter's test. | Active Engagement |
| `T-Test` | The actual per-chapter test — direct, graded checking. **Every subject must have this.** | Active Engagement |
| `F-Final Self Check` | A self-check/booklet the student uses to confirm understanding without a person grading it. Supplementary, not a substitute for `T`. | Active Engagement (lighter-weight) |
| `M-Mock` | Full-length mock exams, grouped under `"chapter": "Chapter M"` at the end of the roadmap, each paired with its own `S` and `R`. | Active Engagement |

**Known gap to close:** AP Biology currently has no `T-Test` category —
it only has `I` → `L` → `N` → `C` → `S` → `F`. Per the pillar
definitions, "we check, not just assign" isn't fully true for Biology
yet. Adding a `T-Test` row to every Biology chapter is the concrete next
step (tracked in `todo.md` under Active Engagement & Motivation).

## Per-chapter pattern

For a normal chapter (not Chapter 0 or the mock section), rows appear in
this order, one row per category that applies:

```
B2-<Chapter Name>                  category: B-book chapter       chapter: "Chapter 2"
C2-<Chapter Name> Problems         category: C-coursework         chapter: "Chapter 2"
S2-<Chapter Name> Solutions        category: S-solution manual    chapter: "Chapter 2"
R2-<Chapter Name> Review           category: R-Review             chapter: "Chapter 2"
T2-<Chapter Name> Test             category: T-Test               chapter: "Chapter 2"
```

Name prefix = category initial + chapter number (`B2`, `C2`, `S2`...).
This keeps names sortable and instantly identifiable in both the Table
and Curve roadmap views.

If the subject also requires a checked notes submission (Biology-style),
insert `N` right after the learning row:

```
L1-<Chapter Name> (source)         category: L-Learning
N1-<Chapter Name> Notes Submission category: N-Notes Submission
C1-<Chapter Name> Problems         category: C-coursework
S1-<Chapter Name> Solutions        category: S-solution manual
T1-<Chapter Name> Test             category: T-Test
F1-<Chapter Name> Final Self-Check category: F-Final Self Check
```

## Chapter 0 — orientation

Before Chapter 1, add `I-information` rows (no test, no lock
progression) covering: exam description, key terminology, exam booklet,
and any formula/notes references the student should have on hand from
day one. All `status: "Complete"` immediately — this is reference
material, not something to progress through.

## End of course — mocks

After the last content chapter, add a `"chapter": "Chapter M"` group:
one `M-Mock` row per full mock exam, each immediately followed by its
own `S-solution manual` and `R-Review` row (`M1`, `M1S`, `M1R`, `M2`,
`M2S`, `M2R`, ...). Calc BC currently ships 10 mocks this way — that's a
reasonable target for a full AP-length course; shorter courses can ship
fewer.

## Status vocabulary

Use exactly these values for `status`:

| Status | Meaning |
|---|---|
| `Complete` | Student has finished this row. |
| `Unlocked` | Available now — this is the active "next step." |
| `Locked` | Not yet available; unlocks after the prerequisite row(s) are done. |
| `Optional-Reading` | Available but not required to progress (e.g. supplementary book chapters, self-check booklets). |
| `Review` | Available specifically for review, distinct from a fresh `Unlocked` step. |

Only one (or a small cluster of) row(s) should be `Unlocked` at a time
per chapter — that's what makes `right-now.html` and the roadmap curve
unambiguous. Don't unlock an entire course at once.

## Building a new subject, step by step

1. **Copy the pattern above**, not an existing student's literal roadmap
   (per `PROGRESS.md`, every student owns their own roadmap data — don't
   have two students resolve the same array at runtime).
2. **Pick `B` or `L`** for the primary content type and stay consistent
   for the whole subject.
3. **Include `T-Test` every chapter, no exceptions** — this is the
   non-negotiable Active Engagement requirement, not optional polish.
4. **Draft the full chapter list and category rows in a spreadsheet or
   doc first** — this is the artifact a subject-lead teacher (even a
   non-technical one) can produce without touching `data.js` directly.
5. **Hand the draft to whoever maintains `data.js`/`zenith-cli`** for
   entry — until teacher-facing editing tooling ships (see `todo.md`,
   System pillar), a technical maintainer enters the data on the
   teacher's behalf. The teacher's job is to get the *content and
   sequencing* right; someone else handles the JSON mechanics.
6. **A second person (lead teacher or you) reviews the full roadmap
   before it goes live** for any student — this is the quality gate that
   keeps curriculum consistent as more teachers contribute. See
   `teacher-onboarding.md` for how this fits a new teacher's ramp-up.
