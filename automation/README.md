# Submission compiler

> **Related:** [`submission-status-updater.gs`](submission-status-updater.gs) is a
> separate, standalone Web App that lets teacher.html's "Mark complete"
> button flip one entry's `status` to `"Complete"` without hand-editing
> the log — see the header comment in that file for setup. It shares
> this doc's log-entry shape and GitHub-commit pattern but is its own
> deployment, not part of the Form-bound script below.
>
> **Also related:** [`zenith-data-writer.gs`](zenith-data-writer.gs) is
> a third, separate standalone Web App — it backs every write control
> on teacher-student.html (unlock a roadmap item, add feedback, add a
> cheat sheet entry, update Right Now, log a metrics data point). It's
> the first thing in this repo that writes to `js/data.js` itself
> rather than `data/submissions-log.json`; see that file's header
> comment for how it handles `js/data.js` not being valid JSON, and for
> setup steps.

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
`sendConfirmationEmail_` in `submissions-compiler.gs`. That's the only
overlap with [`notifications/`](notifications/), which is the separate,
GitHub-Actions-driven side handling deadline/feedback/roadmap emails and
the weekly session reminder.

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
with "course" (case-insensitive), against the `COURSE_IDS` map inside
`submissions-compiler.gs` — `null` if it doesn't match (e.g. the map is
out of date, or the dropdown's exact text changed) or no such question
was found at all; the entry still gets logged either way, just
unresolved. `username` comes from whichever question title starts with
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

`COURSE_IDS` inside the script maps each course's exact "Course"
dropdown text to a `courseId`. It's a plain object literal in the
script, not read from `js/data.js` (Apps Script can't reach into this
repo's JS at runtime) — so it needs a new entry by hand whenever a
course is added or renamed on the Form.

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
