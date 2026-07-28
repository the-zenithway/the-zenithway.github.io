# Teacher Onboarding Checklist

Purpose: as Zenith adds teachers, this checklist is what keeps the
teaching approach consistent with the actual philosophy instead of
drifting into "generic tutoring" as the group grows. Every new teacher
goes through all of this before running a session solo.

## 1. Understand why Zenith is different

- [ ] Read [philosophy.html](philosophy.html) in full — the three
  pillars (Absolute Clarity / Active Engagement & Motivation / Advice &
  Direction) are the actual product, not marketing copy. A teacher who
  doesn't internalize this will default to "just cover the material,"
  which is exactly what Zenith is built to be more than.
- [ ] Talk through, with a lead, what "we check, not just assign" and
  "encouragement over pressure" mean concretely in a session — these
  are behaviors, not slogans.

## 2. Understand the System

- [ ] Read [curriculum-template.md](curriculum-template.md) — the
  category/status vocabulary (`B`/`L`, `C`, `S`, `N`, `R`, `T`, `F`,
  `M`; `Locked`/`Unlocked`/`Complete`/...) that every student's roadmap
  is built from.
- [ ] Get walked through one real student's Portal (roadmap, Now,
  Feedback, Cheat Sheet) by a lead, so the teacher sees how their
  session work shows up on the student-facing side.
- [ ] Understand the current data-entry reality: this is a static site
  with no teacher-facing editing UI yet. A teacher drafts roadmap/
  feedback content; a technical maintainer enters it into `data.js`.
  This isn't the long-term plan (see `todo.md`, System pillar) but it's
  how things work today — don't hand a new teacher a GitHub login and
  expect them to edit JSON.

## 3. Shadow before leading

- [ ] Shadow at least one full IRL/Zoom session run by a lead teacher.
- [ ] Shadow or read through one full feedback write-up (Feedback +
  Cheat Sheet entries) for a real student, to calibrate tone — direct
  and specific about mistakes, but never discouraging. Compare against
  Bogue's `발상노트`-derived feedback entries in `js/data.js` as the
  reference tone.

## 4. First contribution, reviewed

- [ ] Draft one chapter's worth of roadmap rows for a course (new or
  existing) following `curriculum-template.md`, or write one real
  feedback entry for an actual student session.
- [ ] A lead reviews it before it goes live for any student — this is
  the quality gate, not a formality. Nothing a new teacher produces
  reaches a student unreviewed on the first pass.

## 5. Sign-off

- [ ] Lead confirms the new teacher is ready to run sessions and enter
  content independently (drafts still routed through a maintainer for
  `data.js` entry per step 2, until that tooling changes).
- [ ] Add the teacher to the relevant community channel(s) (Discord/
  Instagram — see `todo.md`, Admin) so they're plugged into the same
  loop as everyone else, not siloed to their own students.

## Ongoing, not one-time

Onboarding gets someone started; it doesn't keep the philosophy alive by
itself. Revisit the pillar definitions as a team periodically (they're
recorded in project memory and `philosophy.html`) so they stay a living
standard, not a one-time orientation packet everyone forgets.
