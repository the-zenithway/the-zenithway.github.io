# Course platform redesign

Status (2026-11-03): **skeleton built, uncommitted, nothing deployed.** The pages
below work end to end in a browser against the real Calc BC / Chem banks, saving to
this browser only. Making it multi-device (and visible to teachers) needs the
student-data script deployed (see "Storage").

The chapter, not the tool, is the unit of learning. Chapters 1-10 run six stages:
Book (B), Problems (C), Review (R), Test (T), Review of the test (R), then Close (a 개념노트). The warm-up at the start of the next chapter and
the spaced queue sit alongside.

## Site map (as built)

```
Roadmap page  (roadmap.html, per course)
 ├─ Today strip          derived next action + warm-up + due reviews + on-track label
 └─ ONE view at a time   Chapters (default) · Table · Curve · Cards · Orbit · Periodic · Cell · Code
     Chapters = chapter list with B C R T N stage dots. Every other view is just another way
     to look at the chapters; their chapter nodes/popovers/rows link to the chapter hub.
     └─ Chapter hub      chapter.html?course=&ch=   stepper, done-criteria per stage
          ├─ #b  Book       example cards (tap + line) + concept cards, then Submit B
          ├─ #c  Problems   runner with a "Show the answer" button (shared with Practice)
          ├─ #r  Review     cold redo -> solution -> 발상노트, per miss
          ├─ #t  Test       timed, per-question time, tiered review, one rule
          └─ #x  Close      개념노트: revise concepts + chapter summary, close chapter
Practice hub     practice.html   three strict categories, one page
 ├─ Practice   untimed, instant feedback, the answer one tap away, any problems you choose
 ├─ Test       timed, no feedback until submit, then review; topics/length you choose
 └─ Mock       fixed AP-format exam: sections, own timers, MCQ + free response, composite estimate
Notebook         notebook.html   발상노트 feed · 개념노트 · Stats · Review queue (FSRS)
Calendar         calendar.html   month view + long-term plan (Gantt)
Teacher          teacher-attention.html   needs-attention list + copyable digest
Public header    Catalog (catalog.html is viewable without login)
```

## Decisions

| Area | Decision |
|---|---|
| Right Now | Replaced by the derived **Today** strip. `right-now.html` still exists but is out of the nav. |
| Feedback | By direct chat. The site gives the teacher a per-student **digest** and a one-tap "feedback sent". `feedback.html` is out of the nav. |
| Cheat sheet | Not a feature. Students write a **개념노트** per chapter; "Compile my study guide" prints them all (plus their "when I see -> I try" lines). `cheatsheet.html` is out of the nav. |
| 오답노트 / 발상노트 | One entry type. A wrong answer / heavy hints / lucky guess / test miss creates an entry; it moves needs-note -> written -> redone -> resolved. |
| T review | Its own stage, R (test): every miss needs a Careless or Actual entry (see "C, R and R (test)"). One optional next-time rule per test. |
| Submit | Kept for now (paper work photos, courses without the platform). Photo limit raised to 20 with a thumbnail tray. Retire for Calc/Chem once paper work is attached in Review. |
| Catalog | Public top header only (removed from the portal bar). |
| Long-term plan | Teacher edits, student/parent view. Auto-generated from start date, exam date, pace; every milestone editable. |

## Rules the code implements (js/zp-store.js, tested in scripts/test_platform.cjs)

- **Today** picks, in order: warm-up (new chapter untouched, last test misses
  waiting) -> due reviews -> the current chapter's next stage -> next chapter.
- **Spaced review is FSRS-5**, the same implementation and weights as the SAT site. The note starts
  the card (about 3 days out). Each redo is graded Again / Hard / Good / Easy and the interval is shown
  on the button. A wrong answer only offers Again. A card whose next interval reaches 30 days is
  "resolved". Day granularity. Settings in `js/zp-config.js`.
- **Stage done-criteria (see "C, R and R (test)" for R / V):** B submitted (no other requirement); C every problem attempted; R every flagged problem has an entry; T submitted;
  R (test) every test miss has an entry; Close needs a 100+ character summary.
- **Soft locks:** T is locked until R is done, Close until the rest is done. The UI explains
  and lets the student continue anyway.
- First attempt on a problem always counts; retries never erase a miss.
- Chapters without a bank skip that stage (chemistry has no C bank, so no C/R; calculus
  ch 11-12 have no T).

## Chapters, sets, and the one question record

- Chapters are 1-10 (calc) and 1-10 (chem). Calc 11 and 12 are **not chapters**: C11 is split into two fixed MCQ
  sets (C11A, C11B) and each C12 problem is an individually openable free-response item. They live in Practice
  > Fixed sets (config: `SETS` in `js/zp-config.js`).
- **Every attempt, from anywhere** (chapter C, Practice, review redo, spaced review, chapter test, custom test,
  mock) lands in one record per question (`D.q[pid].attempts`, each tagged with its context). Chapter progress,
  the review pile, history lines and stats all read it. Practice and the chapters do not have separate statuses.
- Banks in use: calc C (ch 1-12, 745), calc T (ch 1-10, 595), chem T (ch 1-10, 300). Chem C is empty.
- AP FRQ archive: `data/calculus-ap-frq-bank.json`, 162 BC free-response questions 1998-2025 (id `25FRQ1`), tagged year /
  calculator / AP units. Loaded as the `APFRQ` set (`js/zp-banks.js`); Practice has a browse-by-unit/calculator/year section
  and a "From" pool. Solutions are the official scoring guidelines (external links).

## Problem status: one rigid label per problem (kyj-sat style)

Every problem has exactly one status, derived from its attempts, flags and entries:

| Status | Meaning |
|---|---|
| **New** | Never attempted (no record yet) |
| **Review** | In your pile or on the review schedule. Needs handling, or is coming back via FSRS |
| **Done** | Attempted and nothing to review, OR it was reviewed and resolved (badge: "mastered") |

The attempt log underneath is the data; the status is only the label. Tracked per attempt: time, context
(chapter / practice / review / spaced / warm-up / chapter test / custom test / mock), answer, right or wrong,
time spent, hints used, confidence. Per problem: the flag, the entry (Careless / Actual), reports, and the FSRS card
(stability, difficulty, due date, lapses).

How the status moves:
- New -> first try right and clean -> **Done**
- New -> first try wrong (pre-flagged; you may unflag a practice/chapter miss), or you flag it -> **Review**
- Review -> entry written (Careless or Actual) -> still **Review**, now scheduled by FSRS
- Review -> a few on-time successes (next interval reaches 30 days) -> **Done** (mastered)
- Review -> unflagged before an entry is written -> back to New/Done (the only way out; there is no skip)
- Done -> a fresh wrong attempt later -> **Review** again
- **Retries:** an immediate "try again" (within ~12 hours) is recorded but does NOT count as remembering it. A
  fresh attempt 12+ hours later, from anywhere (Practice, a test, a mock), counts as a review: right = Good,
  wrong = Again. So "wrong in the chapter, right in Practice three days later" is handled and scheduled, not lost.

## Three surfaces, three jobs

- **Inbox** (Notebook, plus R and R (test) per chapter): flagged problems that still need an entry. **Browse** = all your entries, editable.
- **Review queue** (FSRS): scheduled redos. Grade Again / Hard / Good / Easy, see the next interval.
- **Study** (Notebook): read-only study cards, problem left and your note right, filter and search, print or
  save as PDF. Where finished notes pay off.

Problem IDs: `C1A3` (chapter problem), `T4B12` (chapter test problem), `C11-A7` (hyphen when the chapter has two
digits, so it never clashes with the set C11A). Shown on every problem, searchable in Practice > Find a problem.

## C, R and R (test): what the student does (built 2026-11-03)

Stages become: **B -> C -> R -> T -> R (test) -> Close**. This replaced the earlier rules (auto-add on hints and guesses, a "skip" button, "handled" as optional). The review
queue itself is plain FSRS; this section covers what happens before a problem enters it. Logic lives in
`js/zp-store.js` (derive), the shared screen in `js/zp-write.js`, tests in `scripts/test_platform.cjs`.

**One decision per problem: Careless or Actual.** One two-way choice, no second button anywhere.

| Choice | Meaning | Entry the student must write | Goes to |
|---|---|---|---|
| **Careless** | I knew how; I slipped (arithmetic, misread, time) | short: what went wrong + what I will do next time | Review queue only |
| **Actual** | I did not see the idea / could not apply it | full: what I missed, the main idea, "when I see ... I try ...", next time | 발상노트 AND review queue |

### C (solve) - fast, no writing
- Untimed runner as built (answer, instant feedback, "Show the answer and solution" when stuck). Nothing interrupts the flow.
- The student **chooses which problems to review**: a "Review this" flag on any problem, right or wrong. Wrong
  answers are pre-flagged (one tap to unflag if it was a one-off they do not care about); a right answer the
  student guessed or learned from can be flagged too. Unflagged = never enters review.
- C is done when every problem has been attempted (flags are not required).

### R (write the entries) - one screen, every flagged problem
- Lists the chapter's flagged problems. For each, in order: see the problem and the solution, pick **Careless or
  Actual**, write the entry (fields above). A problem is finished only when it has a type and a valid entry:
  **every flagged problem needs an entry, there is no skip** (unflagging in C or here is the only way out).
- Careless entry: 1 field, at least about 15 characters. Actual entry: 3 fields, more depth ("what I missed" and
  "main idea" both required, at least about 30 characters each; the "when I see" line and free box optional).
- When finished, the problem enters the review queue (Careless or Actual). R is done when every flagged problem is.
- The cold redo is no longer part of R: the review queue's first FSRS review is the redo.

### Chapter test (T) and R (test)
- T stays one-shot, timed. It is **only** taking the test: submit, see the score and time analysis.
- **R (test)** is the same screen as R, scoped to the test: it lists **every miss** (wrong or unanswered; these are
  the real signal, so they are pre-flagged and cannot be unflagged) plus any right answer the student wants to
  flag. Same rule: Careless or Actual, an entry for each. The "one next-time rule per test" stays optional.
- Test misses cost the same as any other: Careless is one sentence, only Actual is real work.

### Practice, custom tests and mocks
- Same component. Flagged / missed problems show up in Notebook > **Inbox** until each
  has a type and an entry. R, R (test) and Inbox are the same screen with different scopes (a chapter's C
  problems / one test / everything pending).

### After the entry (the part FSRS owns)
- Queue card = redo cold, grade (a wrong answer is Again). **Actual** cards show the 발상노트 after you answer;
  **Careless** cards show the one-line entry. Starting parameters: Careless retention 0.8 and resolved after
  one clean redo; Actual retention 0.9 and resolved at a 30-day interval. Daily budget caps the queue (default
  15 minutes; MCQ about 1.5 min, FRQ about 10).
- **A careless problem that is wrong on its redo is not careless.** The card asks once: "still wrong - is this an
  idea gap?" Yes converts it to Actual and requires the fuller entry.
- Notebook > Study shows Actual entries only (Careless ones are in the feed under a filter). Study = fast idea
  recall (problem left, your note right, printable); the queue = solving cold on a schedule.

### AP FRQs
`data/calculus-ap-frq-bank.json` (162 problems, tagged by year, calculator and AP unit). Self-scored Got it /
Partly / Missed against the official scoring guidelines; Partly and Missed are pre-flagged, then the same
Careless / Actual entry. Heavy cards (about 10 min) count against the daily budget accordingly.

## Cards in the review queue (built 2026-11-04, simplified 2026-11-05)

Book-stage cards have one decision: **Add to review queue** (or not). No self-rating chips, no required boxes.
- **Example card**: just its name (as listed in the book, or one you add) and the review button. In the queue: "work it
  again from the book", then grade Again / Hard / Good / Easy.
- **Concept card**: its name, a free text box for your own-words explanation (never required), and the review button.
  In the queue: say it first (optional), then "Show what I wrote", then grade.
- Same FSRS schedule as Actual problems (retention 0.9, resolves at 30 days), about 1 minute each in the daily budget.
- **Rename / delete**: inline, no browser dialogs. Rename turns the title into a text box. Delete is immediate with an Undo
  bar; deleted cards leave the Book page, Close page and queue and can be restored from "Deleted cards".
- **Book has no gate.** The student adds what they want and presses "Submit Book" when they have finished reading.
- **Examples do not go into the Concepts Notebook.** It is concepts in your own words; an example is evidence you practised
  one. If an example taught you something reusable, write it into that concept's card.
- Rule of thumb: automatic where the signal is clear (a wrong answer is pre-flagged), one tap where it is a judgement call
  (cards, right answers you want to keep). Nothing asks the student to decide twice.

## Names (applied 2026-11-04)

One noun per thing, one verb per place. Notebook tabs, in order: **Browse · Inbox · Idea Notebook · Concepts Notebook ·
Review queue · Stats**.

| Word | Means | Where |
|---|---|---|
| **Flag** | the "review this" mark on a problem or a card | on problems and Book cards |
| **Entry** | what you write for a flagged problem: **Careless** (one box) or **Actual** (missed + main idea) | written in R, R (test), Inbox |
| **Browse** | the Notebook home: status tiles (Inbox, Review queue, Idea Notebook, Concepts Notebook) and every entry as a card, grouped by chapter, with search and filters. Tap a card to open, edit, redo | tab "Browse" (`view=browse`) |
| **Inbox** | flagged problems that still need an entry, across ALL chapters (R and R (test) show the same items for one chapter) | tab "Inbox" (`view=inbox`) |
| **Idea Notebook** | your **Actual** entries as study cards: problem on one side, idea on the other, printable (Careless ones behind "Include careless") | tab "Idea Notebook" (`view=study`) |
| **Concepts Notebook** | your chapter concept cards and summary in your own words (written in Book, finished in Close) | tab "Concepts Notebook" (`view=concepts`) |
| **Review queue** | what FSRS says is due today: Careless + Actual problems, flagged concept and example cards | tab "Review queue" (`view=redo`) |
| **Stats** | numbers only | tab "Stats" |

Old links keep working: `view=notes` opens Browse, `view=write` opens Inbox. A problem with no entry yet shows the badge
"Needs entry". The Korean names 발상노트 / 개념노트 are no longer used in the UI.

## Convenience (ported from kyj-sat)

- **Copy question**: a button on every problem (runner, Inbox, Browse, Idea Notebook cards, review queue). Copies the stem and
  choices as plain text with math left as LaTeX ($...$), ready to paste into a chat; a problem with a figure notes that the
  figure is not included. Not shown during a timed test or mock.
- **Click an ID chip** (like C1A3) to copy the ID. Chips inside a button or link keep their normal click.
- **Keyboard**: `C` copies the question, `I` copies the ID, for the one nearest the top of the screen. Ignored while typing in a box.
- Cards (concept / example) are unique by name within a chapter.

## Notes from the 2026-11-05 pass

**Source audit** (`node scripts/audit_sources.cjs <path to katex>`): 1,802 problems (calc C 745, T 595, AP FRQ 162, chem T 300) and
9 generated mocks. 14,932 math spans all compile, no unmatched `$`, no duplicate ids, every MCQ has a usable key, every figure file
exists, every mock only uses real problems with the right counts and calculator rule. One thing to fix in the source: **C8CB2** has two
identical choices (A and B). Banks are Codex's, so it is reported, not edited.

**Chapter test length** (at AP pace: 2 min per no-calculator, 3 min per calculator question; `js/zp-config.js`):
T1 40 q / 85 min, T2 42 / 100, **T3 101 / 240**, **T4 93 / 230**, T5 79 / 160, T6 54 / 125, T7 56 / 130, T8 31 / 85, T9 52 / 120,
T10 47 / 105. The test screen now suggests this pace and warns above 90 minutes. A 4-hour "chapter test" is not realistic: recommended
fix is a fixed seeded sample of about 40 questions per chapter test (the rest stay as practice). Not applied; it changes what "T" means.

**Hints**: removed (2026-11-08). The runner has one button, "Show the answer and solution". Opening it before answering, or after a miss, records the problem as missed (it is flagged for review as before); looking at the solution after getting it right records nothing. Old hint events (levels 1-3) stay in the logs but are ignored; level 4 now means "opened the answer". The generated hints code in js/zp-banks.js and the hint cooldown setting are gone.

**LaTeX / font**: problem text is back on the site's own font with KaTeX scaled to 1.08em (was serif STIX). One variable,
`--zp-problem-font` in `css/platform.css`, switches it. I could not reproduce a specific "LaTeX issue": all 14,932 spans compile, so if
something still looks wrong, send the problem id.

**Header**: the yellow count circles on Announcements / Updates are hidden (CSS in `css/style.css`). "Courses" in the nav now opens the
selected course's roadmap, not the course chooser (the roadmap still has "All courses" for switching).

**Stats** (Notebook > Stats): streak (current / longest / days practised), a 26-week activity heatmap (also a compact one on Browse),
reviews-due forecast for 14 days, weekly accuracy line, accuracy by chapter / calculator / free response, careless vs actual, recent
practice by day, mock history, test history, and a "what we keep track of" list. All derived from the event log.

**Calendar**: "My agenda" (student only, `js/zp-agenda.js`): own to-dos, events and planned mocks (events in the student's log, so they
sync), merged with the long-term plan's chapter dates and the reviews due for the next three weeks.

**View as student** (teachers and admins): `?viewas=<username>` on any student page, linked from Needs Attention rows and each
student's page. Read-only: no events are saved, every non-GET request is blocked, a red banner says so, Exit goes back.

**Sync (commit-based, like kyj-sat)**: pages never wait for the network. Changes are saved in the browser, pushed in one batch to the Apps Script at most every `SYNC_PUSH_MINUTES` (5; about 3 s after the first change after a quiet spell; a last push on tab close), which commits them to the `student-data` branch (`data/cloud/<user>__<course>.json`). Reads come straight from GitHub (`CLOUD_RAW_URL`) every `SYNC_PULL_MINUTES` (5) and when a page opens after that long; "Sync now" does both on demand. Merging is a union by event id.
has to deploy `automation/zenith-student-data.gs` (steps are in its header). Until then data is per browser.

### Decisions still open (need your input)

- **Managed vs self-study students.** Proposal: the platform is identical; what differs is the human layer. *Managed* (in a class):
  teacher sees them in Needs Attention, digests and feedback, the plan is teacher-built, Today shows "on track". *Self-study*: no
  teacher feed; the plan is auto-generated and editable by the student (needs a student edit mode), Today shows streak + due reviews,
  and the digest becomes a weekly summary the student can copy to a mentor if they want. Detection already exists (class membership
  in `js/data.js`, `formerStudentUsernames`).
- **Submit page.** Proposal: fold it in as "Attach photos" on a chapter stage (B / C / R / T): a photo tray on each stage page writes
  a `photo` event (stage, chapter, optional problem id, note) and stores the images through the same GitHub writer as today, so teacher
  review keeps working and the submission log becomes a per-stage record. Keep `submit.html` until that exists.
- **Zenith course next to the existing ones.** Courses without banks (CS A, Bio, ...) keep the old roadmap pages; the platform pages
  only light up for courses listed in `ZP_CONFIG.COURSES`. Adding a course = a prefix + banks + `chapter-content.json` entry.
- **Teacher / admin dashboards in parallel**: view-as is done; per-student platform summary on the teacher roster, the plan editor for
  self-study students, and an admin "all students" activity heatmap are the next pieces.

## Mentor layer: student and teacher, rebuilt (2026-11-05, second pass)

The old teacher loop was Submit -> feedback by chat -> unlock the next unit. The platform now records the work itself, so the loop
is: the student works (everything is logged) -> the teacher sees it, comments, assigns and schedules -> the student's Right Now changes.
No unlocking, no grading queue, no Submit form. Everything below is an event in the student's own log (`js/zp-store.js`); mentor
events carry `by` so a student's streak and "last active" are never moved by the teacher.

### What the teacher actually does (cleaned list, and where it lives)

| Job | Where | How it reaches the student |
|---|---|---|
| Individual feedback on mocks, FRQs, tests, Actual entries | Student page > Work (feedback queue) | A `feedback` message about that exact piece of work; shows on the test result / entry and in Mentor |
| Spot patterns in mistakes | Student page > Overview (weak chapters, missed again and again, careless vs actual by chapter, calibration, hours, hints, speed) | Private notes (Overview) keep the pattern; advice goes out through Talk |
| Hands-on advice, direction | Student page > Talk (Advice) | Mentor thread + "From your mentor" on Right Now |
| Accountability, short-term pushes ("grind this chapter until Friday 6pm") | Student page > Assign > Chapter sprint | A required task at the top of Right Now, with a countdown |
| Custom practice set | Assign > Custom practice set (paste codes like C5A12, or "fill with 10 from their weak spots") | Required or suggested task; "Open" runs the set; finishes itself when every problem is tried |
| Change what counts as enough | Assign > Requirements (careless / actual entry length, concept words, summary words, daily review minutes) | Per student, immediate; the notebook shows the new minimum and a word counter |
| Long-term plan | Student page > Plan & calendar (same plan editor as the calendar page) | Plan status on Right Now and the roadmap |
| Calendar: sessions, mocks, to-dos | Plan & calendar > quick add (time, length, reminders, optional email the day before) | On their Right Now with a banner for the two days before; on their agenda |
| Answer a proposed session | Desk queue or Plan & calendar (Accept puts it on the calendar) | Reply in Mentor + calendar item |
| Remind, nudge, motivate, share a resource | Student page > Talk (Nudge, Motivation, Advice, Resource with link, templates, photos) | Mentor thread + Right Now |
| See exactly what the student sees | "View as" buttons: Right Now, Practice, Notebook, Mentor, Roadmap (read-only, nothing saves) | |
| Who needs me first | Mentor Desk > Progress queue | |

### Pages

- `right-now.html` (nav: **Now**): ranked list, below. Courses without a bank keep the old hand-set card.
- `mentor.html` (nav: **Mentor**, replaces Submit and Feedback): optional line to the teacher. Message, photo of work, progress
  update, question, or propose a session. Photos upload through `uploadPhotos` in `automation/zenith-data-writer.gs` (redeploy it);
  with no endpoint they stay in the message in this browser. Old Submit and Feedback URLs redirect here.
- `teacher.html` **Mentor Desk**: tiles, Progress queue (proposed sessions, debriefs, new messages with inline reply, tests and mocks
  without feedback, overdue required tasks, Actual entries without a comment, stalled students, reported problems), Students table
  (where they are, plan status, 14-day activity, accuracy, reviews due, last active, waiting), Class tools (requests, email schedule,
  announcements: unchanged). `teacher-attention.html` and `teacher-overview.html` redirect here.
- `teacher-student.html?student=&course=`: Overview / Work / Assign / Plan & calendar / Talk (js/zp-tstudent.js).
- Removed: `cheatsheet.html` and everything that rendered or edited it; the header Updates and Announcements buttons for students
  (their content is on Right Now); the old roadmap-unlock / right-now editor / metrics forms.

### How Right Now decides (ZP.rightNow in js/zp-store.js, printed on the page)

| Tier | What | Why it sits there |
|---|---|---|
| 1 Required | Mentor tasks marked required. Overdue first, then soonest deadline, then undated | A mentor only forces something for a reason |
| 2 Reviews | Reviews that have come due, within the daily minutes budget | Spaced reviews decay if postponed |
| 3 Inbox | Entries waiting to be written | The entry is what starts a review |
| 4 Calendar | Student's own to-dos / mocks / events dated today or earlier | They set it, but it does not outrank 1-3 |
| 5 Suggested | Mentor tasks that are not required | Worth doing, no penalty for choosing 1-4 first |
| 6 Plan | Warm-up, or the next stage of the current chapter, or a mock when every chapter is done | The default when nothing above needs them |

Within a tier the earlier deadline wins. The top item is the big card with a "why this is first" line; the rest are listed under
"Then". Above the card: reminders for events in the next two days (highlighted inside 24 hours), unread mentor messages, answered
proposals, and "behind plan". Marking a task done records it for the mentor immediately and offers a one-line report to Mentor (tied to the task); the mentor sees a "Task done" item with that report in the progress queue and on the student's Assign tab. A task finishes by itself (practice set: every problem tried since it was assigned; chapter task: that
stage is done) or by "Mark done". Nothing on the page is hand-edited daily.

### Data added (all in the student's log; see the header of js/zp-store.js)

`msg`, `msg_read`, `prop_reply`, `task`, `task_done`, `criteria`, `cal_item` (now with time, length, reminders, author), `cal_done`,
`tnote` (teacher-private), `legacy_done`. The student-data script's EVENT_TYPES list has them: redeploy it.

### Moving bogue and seohu over

`scripts/migrate_legacy.cjs` writes `data/legacy-import.json`; the store merges it by event id on first load (and the teacher
views merge it too), so it is safe to run twice. Carried over: stages Complete in the old roadmap (as `legacy_done`, shown as done
without question data, labelled "old roadmap"), the teacher's written feedback (into Mentor), bogue's 9 cheat-sheet entries
(into the Concepts Notebook as cards), the current Right Now (as a required task), what each student wrote when submitting plus
photo links (as progress notes in Mentor), and seohu's motivation check-ins / responsiveness / chapter scores (as private teacher
notes). **Not** carried over: question-by-question answers (the old answer lists no longer line up with the revised banks: 38 vs 42,
93 vs 101 letters; grading them would invent stats) and the hand-entered metrics (bogue's are placeholders; they are replaced by
stats derived from real work). To delete instead of keep: remove a user's key from `data/legacy-import.json`.

### LaTeX in notes

`js/zp-tex.js`: click any note box (entries, concept cards, summaries, rules, free-response answers, messages, feedback) and a row of
symbol buttons appears above it, a typeset preview below. The buttons put the right LaTeX at the cursor and add the `$...$` if you
are outside a pair. Word counters show for boxes with a minimum.

### Optional T and N for students moving over (2026-11-08)

A `legacy_done` event can list `optional` stages (T, V, X). Those never block the chapter, the chapter counts as complete, and the
student can still do them any time (doing one marks it done). This applies only to transitioning students whose migration lists it
(`AUTO_TRANSITION` in scripts/migrate_legacy.cjs: bogue; `TRANSITION` is empty now, seohu is carried exactly as js/data.js has her). Everyone else keeps B, C, R, T, V, X in order.

### Open decisions

- Managed vs self-study: decided 2026-11-08. Self-study students (data/student-tracks.json, or on no class roster) have no Now, Mentor or Calendar; everything else (chapters, practice, notebook, stats, review queue) is the same. Earlier note: nothing in the platform differed. Former students show in the Students table marked "self-study" and are
  excluded from the progress queue (except their messages). Needs your call on whether self-study students get tasks, a plan and a mentor at all.
- Email ping when a student writes in Mentor (needs a mail hook in the student-data script; today the teacher sees it on the desk).
- A chapter-test length cap (40 questions) is still open from the last pass.

## Settings (2026-11-08)

Profile > Settings, stored per account in this browser (`zenith:settings:<username>`, module js/zp-settings.js; js/layout.js applies theme and
width before the page paints). Theme: Dark (default), Light, Midnight, Paper, Match my device (CSS variables under `:root[data-theme=...]` in
css/style.css). Content width: `--zp-width` on the course pages. Browse filters: default calculator / format / status / sort, and "remember last
filters" (per course). Keyboard: every shortcut is an action id in `ZPSettings.ACTIONS`; pages ask `ZPSettings.keyMatch(event, id)`, so
rebinding works everywhere; turning shortcuts off keeps Esc closing windows. Offline mode registers `sw.js` (network first, falls back to the saved
copy); "Update offline copy" saves everything in data/offline-manifest.json. Work done offline is saved locally and syncs later as before.

## Reports

Any question can be reported (wrong key, math looks broken, missing figure, typo, wrong solution). Teachers see
them grouped by question in Needs Attention, can copy the list for fixing the banks, and mark them fixed.

## Hints

The answer and solution unlock only by going through the hints, one at a time (idea, first move, worked
step, then the answer). There is **no timer by default.** A teacher can add one per course with
`platform: { hintCooldownSec: 20 }` on the course object in `js/data.js`.

## Problem sources (2026-11-05)

| Source | Count | Notes |
|---|---|---|
| Calc BC chapter problems C1-C10 | 595 | MCQ, `data/calculus-c-bank.json` |
| Calc BC chapter tests T1-T10 | 595 | MCQ, `data/calculus-t-bank.json` |
| C11A + C11B (misc MCQ) | 59 + 52 | Part A = no calculator, Part B = calculator (as in the source) |
| C12A + C12B (misc free response) | 21 + 18 | Part A = calculator, Part B = no calculator (reversed vs C11) |
| AP free-response archive 1998-2025 | 162 | `data/calculus-ap-frq-bank.json`, tagged year / calculator / unit |
| Chem T1-T10 | 300 | MCQ; chem C bank empty |
| Generated full mocks 1-4 (calc) / 1-5 (chem) | | built from the banks by `scripts/build_mock_exams.cjs` |
| Published mocks M1-M3 (calc) | | **PDF only** in `zenith-resources/AP Calculus BC/Mock Exams` (no LaTeX; math is images). Not on the site |
| ~~M4-M10~~ | | were 2025/2018/2024/2019/2023/2021/2022 AP FRQ + scoring PDFs, identical text to the archive. Moved to the Trash |

**One status per problem, whatever its source.** Every attempt (chapter, practice, review, test, mock, and self-scored FRQs in
a mock or test) lands in one record keyed by problem id, so Browse, Inbox, Notebook and Stats agree. A self-scored FRQ counts
as right at 75% of the points or more; lower is a (forced) miss that goes to the Inbox.

## Practice hub tabs

- **Browse** (first tab, default, `js/zp-browse.js`; modelled on the SAT site): facet sidebar with live counts (source, chapter,
  type, calculator, status, AP unit, AP year, my sets), search (ID with exact match first, or words), sort, a card per problem with
  a checkbox. **Click a card to open it in a popup** (the runner in a dialog: answer, hints, flag, copy, prev/next through the
  filtered list, Esc closes). **Select** problems (the selection survives searching and filtering), then: Practice, Timed test
  (minutes box), Flag for review, **Save as set** (listed under "My sets", stored in this browser), Copy IDs.
- **Calculator tags**: every Calc BC problem carries one. Chapter C/T problems and C11: Part A (id letter A) is no calculator,
  Part B calculator; C12 is the reverse; the AP archive uses its own label. Derived in `js/zp-banks.js` (banks untouched).
  The generated full mocks follow it: Part A draws no-calculator problems, Part B calculator ones.
- **Mock**: *Full-length mocks* (generated, one shot each) and *Past AP free-response exams* (one per year 1998-2025: Part A
  calculator + Part B no calculator, real timing: 2008+ is 2 + 4 questions in 30 + 60 min, 1998-2007 is 3 + 3 in 45 + 45).
  Self-scored 0-9 against the linked official scoring guidelines.
- **Practice** and **Test**: to be redesigned next.

## Practice / Test / Mock

- **Setup (Practice and Test)** mirrors the SAT site: source (chapter problems / test problems), type
  (MCQ / FRQ), chapters, filter (all / not tried / missed / needed hints / due for review), count, shuffle,
  "bias toward weak topics" (weighted by your per-chapter accuracy), minutes (Test), and saved setups.
- **Mock** has no setup on purpose. `data/mock-exams.json` is generated by `scripts/build_mock_exams.cjs`
  (seeded, balanced across chapters, no repeats between mocks). Calc BC: 30 + 15 MCQ and 2 + 4 FRQ with the
  real section times. Chemistry: MCQ only until an FRQ bank exists. FRQs are self-scored 0-9 against the
  written solution; the composite is 50% MCQ + 50% FRQ against placeholder bands in the JSON.
- Everything logs to the same event stream, so any practice feeds the notebook, review queue and stats.
- Entry sources in the notebook: Problems (C), Chapter test (T), Test (U), Mock (M).

## Stats

`ZP.stats()` (pure, tested) derives per-chapter accuracy / hint rate / time, weakest chapters, miss
reasons, queue health with estimated FSRS retention, and test/mock history. Shown in Notebook > Stats and
used by "bias toward weak". No extra storage: it is all computed from the event log.

## Storage

Everything is an append-only event (`js/zp-store.js`). Status, queue, notebook, Today
and teacher views are derived from the log. Today it lives in `localStorage`, per
browser. To make it multi-device and teacher-visible, deploy
`automation/zenith-student-data.gs` (steps in its header) and set `DATA_URL` in
`js/zp-config.js`. Until then: teachers only see data saved in their own browser, and
plans are not visible to students on other devices. Same trust model as the rest of the
site (no per-user auth); see the script header.

## Content still to author / generate

- `data/chapter-content.json`: per-chapter example list and 5-8 concept cards (optional;
  with none, students add their own).
- Hint text: banks may carry a `hints` array (3 strings per problem). Without it the
  ladder falls back to generic scaffolds, and level 4 shows the bank solution.
- Chemistry C bank (still `{}`) and a way to turn FRQ chapters into a real rubric flow.

## 발상노트 (idea notes) and the review queue

A miss gets one entry: Careless / Actual (sets the problem's review schedule) plus one 발상노트 (`nkind` rule / idea / other, `text`). A note can also be its own review card (`card_flag` kind `idea`, key `n-<pid>`), and stand-alone notes are `idea` events (kind idea cards, key = the note's key). Cards are graded Again / Hard / Good / Easy like concept cards. The queue shows what fits the daily budget; "Review more" adds 15 minutes at a time (`extra` in the URL) and "Review ahead" (`ahead=1`) adds upcoming reviews soonest-first.

## Core curriculum (Calculus BC)

Configured in `CURRICULUM` (js/zp-config.js); derived in `ZP.derive` as `D.curriculum` (rows, next, Chapter M progress).

1. Chapters 1-10: B Book, C Problems, R Review, N Concepts Notebook. The chapter test T (and its review V) is optional. If a student takes it anyway, V is owed.
2. Checkpoints CP1-CP4 (chapters 1-2, 3-4, 5-8, 9-10): 40 multiple-choice problems each, 80 minutes straight, about two thirds no-calculator (each question says which). Sampled from the T bank, fixed (`checkpoints` in data/mock-exams.json), no AP estimate. Each appears right after its last chapter, is due once its chapters are complete, and is optional (never blocking) for a student whose chapters were all finished in the old roadmap.
3. Chapter M (exam block), in order: C11A, C11B (done when every problem has been tried), Full mock 1, 2023 AP FRQ exam, Full mock 2, 2024 AP FRQ exam, Full mock 3, 2025 AP FRQ exam (done when taken).
4. Everything else is optional: the rest of the T bank, C12, other AP FRQ years, Mock 4, Browse, and the teacher's custom sets (assignable as required or suggested tasks).

Where things are taken: links from the course view carry `ret` (the page to return to). Practice opens only that run, with "← Course", and Back or finishing returns there. The three required full mocks are takable only from the course view for class-track students (hidden in Practice > Mock); self-study students can take them in either place. Anyone can build a custom mock in Practice > Mock (sections, sources, scope, chapter weights); it is saved in this browser and taken like any other mock.

Trainer (practice.html) has four tabs. Browse lists every problem with filters. Practice, Test and Mock each have a builder (type, calculator, chapters, scope, AP year / unit); a practice set in progress is resumed, tests and mocks keep deletable records. Fixed sets and the AP archive panels are gone from Train (their problems are reachable from Chapter M, the builders and the Mock tab's past AP exams).

Today, Right Now and the chapter list all point at `D.curriculum.next`. Courses without a `CURRICULUM` entry (Chemistry) are unchanged.

## Not done / follow-ups

- Existing roadmap statuses in `js/data.js` are still hand-set; the chapter path shows
  the derived ones next to them. Reconciling (or hiding the old Table/Curve/... views
  for banked courses) is a decision.
- Retire `right-now.html`, `feedback.html`, `cheatsheet.html`, `submit.html` and their
  `data.js` fields once you are happy; nothing was deleted.
- `practice.html` (Practice Lab, from the other session) still exists as a standalone
  tool and overlaps with the C/T workspaces. Decide whether to fold it in.
- Hint unlock timing (20s between levels), mock duration (1.5 min/question) and AP
  estimate thresholds are placeholders in `js/zp-config.js`.
