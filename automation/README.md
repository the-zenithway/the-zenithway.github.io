# Submission compiler

> **Also related:** [`zenith-student-data.gs`](zenith-student-data.gs) is the
> storage backend for the course platform (chapter hub, notebook, mocks, plans).
> It stores student events in a Google Sheet rather than committing to the repo.
> Setup steps are in that file's header; until `DATA_URL` in `js/zp-config.js` is
> set, the platform saves in the browser only. See [`../redesign-structure.md`](../redesign-structure.md).

> **Related:** [`zenith-data-writer.gs`](zenith-data-writer.gs) is a
> separate, standalone Web App that backs every write control on the
> teacher dashboard — marking a submission Complete (teacher.html) and
> unlocking a roadmap item / adding feedback / adding a cheat sheet
> entry / updating Right Now / logging a metrics data point
> (teacher-student.html). It writes to this doc's `data/submissions-
> log.json` for the first of those, and to `js/data.js` for the rest —
> see that file's header comment for setup and for how it handles
> `js/data.js` not being valid JSON. It used to be two separate
> standalone scripts (one just for "mark complete") until they were
> merged on 2026-08-05 — Google doesn't require standalone Web Apps to
> be split up the way a Form-bound trigger script does, so there was no
> reason to keep deploying two. As of the same day it also supports
> batching: teacher-student.html can stage several changes and apply
> them as one `applyBatch` request, which lands as a single commit
> (unless the batch mixes a `js/data.js` change with `markSubmissionComplete`,
> which still needs two commits — one per file).

Compiles every Google Form submission (the intake form students use to
turn in work) into one status-tracked log, `data/submissions-log.json`,
so it can be worked through as a list instead of checking the Form's
response Sheet and Drive uploads separately.

This does **not** write feedback, cheat sheet entries, or roadmap
status. It only compiles: each submission becomes one entry with
`status: "pending"`, and any file upload gets OCR'd so the extracted
text sits right next to the rest of the answer. Writing feedback etc.
from that log is future work, not part of this.

It does also send the student a short "we got it" confirmation email
right after logging (looked up by username against `js/data.js`'s
`STUDENTS`, skipped if that student has no email on file) — see
`sendConfirmationEmail_` in `submissions-compiler.gs`. That's one of
two overlaps with [`notifications/`](notifications/), which is the
separate, GitHub-Actions-driven side handling deadline/feedback/
roadmap emails and the weekly session reminder — the other is
`notifyTeachers_`, added 2026-08-05, which emails every `TEACHERS`
entry in `js/data.js` that has an email on file (optionally scoped to
specific courses via that entry's `courses` list) right after logging
a submission, so a teacher doesn't have to keep checking the dashboard
to notice new work waiting.

## How it works

- `submissions-compiler.gs` is a Google Apps Script bound to the
  intake Form. On every submission (`onFormSubmit` trigger) it:
  1. Reads every question/answer pair generically, then pulls out
     `course`/`username`/`chapter`/`unit` by matching a question's
     title against a case-insensitive **prefix** (`findAnswerByPrefix_`)
     rather than an exact string — the Form's question titles have
     drifted more than once already (see "Known gaps" below), and an
     exact match silently produces `null` the moment a title's casing
     changes, which happened for real on 2026-07-31.
  2. For any file-upload answer, copies the file through Google
     Drive's OCR (`Drive.Files.copy(..., {ocr: true})`) into a
     temporary Doc, reads the extracted text out, then deletes the
     temp Doc.
  3. Reads the current `data/submissions-log.json` from `main` via
     the GitHub Contents API, appends the new entry, and writes it
     back (retrying once or twice on a 409 if two submissions land at
     nearly the same time).
- The log commits straight to `main`. It's just a data file — nothing
  links to it or serves it as a page, but `submit.html` does `fetch()`
  it directly (relative URL), and a relative fetch can only ever see
  whatever's on `main` (that's all GitHub Pages serves) — so `main` is
  the only branch this can ever commit to for the Submit page to work.
  An earlier revision briefly committed to a separate `submissions-log`
  branch for extra safety; that was reverted (2026-07-31) specifically
  because it silently broke the Submit page, which could never see it.
- `submissions-compiler.gs` in this repo is a **reference copy** for
  version history. The script that actually runs lives inside the
  Apps Script editor attached to the Form; paste updates in by hand.

## Known gaps (found via real submissions, now fixed going forward)

Four real submissions came in before the prefix-matching fix above, with
the Form's question titles in three different stylings across them
(`"Username"`/`"Course"`/`"Chapter"`/`"Unit(for Chapters 1~12)"`, then a
plainer pass, then lowercase `"username"`/`"chapter"`/`"unit"`). The
oldest of the four has no `course`/`username`-shaped question at all —
apparently a stray response from a different, unrelated form — and is
left with `courseId`/`username` as `null` rather than guessed. The other
three were backfilled by hand (2026-07-31) with the same prefix-matching
logic the script now uses, so they show up correctly on the Submit page
retroactively.

## Log entry shape

```json
{
  "id": "sub_1706562345000_a1b2c3",
  "receivedAt": "2026-01-29T18:45:12.000Z",
  "status": "pending",
  "courseId": "ap-calculus-bc",
  "username": "bogue",
  "chapter": "Chapter 5",
  "unit": "B",
  "answers": { "Course": "AP Calculus BC", "Username": "bogue", "Chapter": "5", "Unit(for Chapters 1~12)": "B", "...": "..." },
  "ocrText": "extracted text from any uploaded image, or null",
  "formResponseId": "..."
}
```

`status` starts as `"pending"`. What values come after that (e.g.
`"reviewed"`, `"feedback-written"`) and who/what sets them is future
work — not decided yet, since nothing downstream reads this field.

`courseId` is resolved from whichever answer's question title starts
with "course" (case-insensitive), copied straight through as the
`courseId` — the Form's "Course" dropdown option **values** are the
course's exact slug id (e.g. `"ap-calculus-bc"`), matching
`STUDENTS[].courses[].id` in `js/data.js`, so no separate lookup table
is needed. (Earlier versions of this script mapped a display-name
answer like `"AP Calculus BC"` through a hand-maintained `COURSE_IDS`
table — that table went stale at least once, silently producing
`courseId: null` for a whole course. Switching the dropdown's values
to slugs removed the table and that failure mode entirely; see
[`js/app.js`](../js/app.js)'s `submissionCourseId()` for the
client-side counterpart, which resolves a submission's course from
`answers.course` directly rather than trusting the log's `courseId`
field at all.) `courseId` is `null` only if no "course"-prefixed
question was found at all — the entry still gets logged either way,
just unresolved. `username` comes from whichever question title starts with
"username". `chapter` comes from whichever starts with "chapter",
normalized from a bare number (`"5"` → `"Chapter 5"`) to match the
format used in `js/data.js`'s roadmap items. `unit` comes from whichever
starts with "unit" — the roadmap category letter (`B`/`C`/`T`/`R`/`S`/
etc.), copied straight through.

## One-time setup

See the header comment in [`submissions-compiler.gs`](submissions-compiler.gs)
for the exact steps: making sure `data/submissions-log.json` exists on
`main`, adding the Form's questions (Course, Username, Chapter, Unit,
Feedback & Remarks, file upload — no branching needed), pasting the
script into the Form's Apps Script editor, enabling the Drive Advanced
Service, setting five Script Properties (`GITHUB_TOKEN`, `GITHUB_OWNER`,
`GITHUB_REPO`, `GITHUB_BRANCH`, `LOG_PATH`), and adding the
`onFormSubmit` trigger.

Teacher notification (`notifyTeachers_`) needs no new Script
Properties — it reuses `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO`
already set up above. It only needs an email on file: fill in
`TEACHERS[].email` in `js/data.js` and commit — no redeploy needed on
the Apps Script side beyond having pasted the current version of the
file in already.

The Form's "Course" dropdown must use each course's exact slug id
(from `js/data.js`'s `STUDENTS[].courses[].id`, e.g. `ap-calculus-bc`,
`ap-chemistry`, `ap-biology`, `ap-computer-science-a`) as each
option's **value** — the option's visible label can still read
however you want ("AP Calculus BC"), only the underlying value has to
be the slug. Adding a new course means adding a new dropdown option
with that course's id as its value; no script change needed.

The GitHub token should be a fine-grained personal access token scoped
to only this repo, with Contents read/write — not a classic all-repo
token. It's stored in Apps Script's Script Properties, never in this
file or anywhere in the repo.

## Status

Confirmed working against the real Form as of 2026-07-31 — four real
submissions have logged successfully, `commitNewEntry_`'s GitHub Contents
API write and the OCR path have both run for real. The prefix-matching
field extraction and `sendConfirmationEmail_` (the "we got it" email) are
the newest pieces and haven't each had a dedicated real-submission test
yet — watch their next real runs. If `onFormSubmit` throws, the script
emails whoever owns it with the error instead of failing silently.


## Mentor layer (2026-11-05)

- `zenith-student-data.gs`: EVENT_TYPES now include `msg`, `msg_read`, `prop_reply`, `task`, `task_done`, `criteria`, `cal_done`, `tnote`,
  `legacy_done`. **Redeploy** (Deploy > Manage deployments > edit > new version) or student and teacher writes of those types are rejected
  ("bad event") and stay queued in the browser.
- `zenith-data-writer.gs`: new action `uploadPhotos` (`{action:"uploadPhotos", payload:{photos:[{dataBase64,mimeType,filename}]}}` ->
  `{ok, urls}`) used by mentor.html and the teacher's Talk tab. Same GitHub upload as Submit photos. **Redeploy** to enable it.
- Events are capped at 40,000 characters, so photos are never stored inside an event when DATA_URL is set: they are uploaded and the
  event holds the URLs. Without DATA_URL (local testing) the compressed photo stays inside the message in that browser only.
- The old Submit pipeline (`submissions-compiler.gs`, data/submissions-log.json) is no longer fed by the site. Existing entries remain for
  history; `scripts/migrate_legacy.cjs` carried bogue's and seohu's over.

- Concept cards: new event type `concept_order` (the student's sequence of concept cards) and an optional `images` list on `concept` events. Redeploy zenith-student-data.gs for `concept_order`; photos use the same `uploadPhotos` action as Mentor.


## Mentor-layer email notifications (zenith-student-data.gs)

Sent by the student-data script itself, as events are saved (no GitHub Action involved). Recipients come from `js/data.js`
(read from the public repo; no token): `STUDENTS[].email`, `TEACHERS[].email`, and the `CLASSES` rosters decide who is whose mentor.
An empty email means no emails. Self-study students (see `data/student-tracks.json`) have no mentor and are never emailed about it.

| Event | Email goes to | Link |
|---|---|---|
| Student message (message, photo, question, progress, submission) | the mentor(s) of that student | student page > Talk |
| FRQ feedback request | mentor | student page > Work |
| Mock debrief request | mentor | student page > Work |
| Session proposal | mentor | student page > Plan |
| Task marked done with no report | mentor | student page > Talk |
| Mentor message / feedback / nudge | the student | Mentor page |
| New task (required or suggested) | the student | Right Now |
| Calendar item added by the mentor | the student | Calendar |
| Proposed session accepted / declined | the student | Calendar |

The same kind of email about the same thing goes out at most once per 10 minutes (`NOTIFY_WINDOW_SEC`), so a burst of messages is one
email. Set the Script property `NOTIFY_OFF` to `1` to turn all of it off. After pasting the new version, redeploy the Web app
(Manage deployments > edit > New version); the first save triggers a one-time authorization prompt for sending mail and reading the repo file.


## Student data: commit-based sync (zenith-student-data.gs)

Replaces the old Google Sheet store. The script holds a GitHub token and commits students' event logs to a dedicated branch, like kyj-sat's kyj-cloud.
Setup is in the comment at the top of the file; the short version: paste the new file into the Apps Script project, set `GITHUB_TOKEN`,
`GITHUB_OWNER`, `GITHUB_REPO` (same values as `zenith-data-writer.gs`) in Script properties, redeploy as a new version (same /exec URL), and make sure
`DATA_URL` and `CLOUD_RAW_URL` in `js/zp-config.js` are set. `SHEET_ID` is no longer used. The first push creates the `student-data` branch from `main`.
