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

## How it works

- `submissions-compiler.gs` is a Google Apps Script bound to the
  intake Form. On every submission (`onFormSubmit` trigger) it:
  1. Reads every question/answer pair generically (no question titles
     hardcoded, so it keeps working if the form changes).
  2. For any file-upload answer, copies the file through Google
     Drive's OCR (`Drive.Files.copy(..., {ocr: true})`) into a
     temporary Doc, reads the extracted text out, then deletes the
     temp Doc.
  3. Reads the current `data/submissions-log.json` from the
     `submissions-log` branch via the GitHub Contents API, appends
     the new entry, and writes it back (retrying once or twice on a
     409 if two submissions land at nearly the same time).
- The log lives on a separate `submissions-log` branch, never on
  `main` — a bug in the script can never touch the live site.
- `submissions-compiler.gs` in this repo is a **reference copy** for
  version history. The script that actually runs lives inside the
  Apps Script editor attached to the Form; paste updates in by hand.

## Log entry shape

```json
{
  "id": "sub_1706562345000_a1b2c3",
  "receivedAt": "2026-01-29T18:45:12.000Z",
  "status": "pending",
  "answers": { "Student name": "...", "Which chapter?": "...", "...": "..." },
  "ocrText": "extracted text from any uploaded image, or null",
  "formResponseId": "..."
}
```

`status` starts as `"pending"`. What values come after that (e.g.
`"reviewed"`, `"feedback-written"`) and who/what sets them is future
work — not decided yet, since nothing downstream reads this field.

## One-time setup

See the header comment in [`submissions-compiler.gs`](submissions-compiler.gs)
for the exact steps: creating the `submissions-log` branch, pasting
the script into the Form's Apps Script editor, enabling the Drive
Advanced Service, setting five Script Properties (`GITHUB_TOKEN`,
`GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `LOG_PATH`), and adding
the `onFormSubmit` trigger.

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
