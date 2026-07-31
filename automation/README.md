# Submission compiler

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
  1. Reads every question/answer pair generically (no question titles
     hardcoded, so it keeps working if the form changes).
  2. For any file-upload answer, copies the file through Google
     Drive's OCR (`Drive.Files.copy(..., {ocr: true})`) into a
     temporary Doc, reads the extracted text out, then deletes the
     temp Doc.
  3. Reads the current `data/submissions-log.json` from `main` via
     the GitHub Contents API, appends the new entry, and writes it
     back (retrying once or twice on a 409 if two submissions land at
     nearly the same time).
- The log commits straight to `main`. It's just a data file — nothing
  links to it or serves it as a page — so there's no risk to the live
  site from it living there.
- `submissions-compiler.gs` in this repo is a **reference copy** for
  version history. The script that actually runs lives inside the
  Apps Script editor attached to the Form; paste updates in by hand.

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

`courseId` is resolved from the Form's "Course" dropdown answer
against the `COURSE_IDS` map inside `submissions-compiler.gs` — `null`
if it doesn't match (e.g. the map is out of date); the entry still
gets logged either way, just unresolved. `username` is copied directly
from the Form's "Username" answer (students enter their own — no
lookup table to maintain). `chapter` is normalized from the Form's
bare-number "Chapter" answer (`"5"` → `"Chapter 5"`) to match the
format used in `js/data.js`'s roadmap items. `unit` is the roadmap
category letter (`B`/`C`/`T`/`R`/`S`/etc.), copied straight through.

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

Written but **not yet tested against the real Form** — I can't execute
Apps Script myself. The GitHub Contents API and Drive OCR calls follow
documented patterns, but the first real test run should be watched
closely. If `onFormSubmit` throws, the script emails whoever owns it
with the error instead of failing silently.
