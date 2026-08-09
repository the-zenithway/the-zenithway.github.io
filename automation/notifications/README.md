# Email notifications

Runs entirely as GitHub Actions (`.github/workflows/notify.yml`) — nothing
runs on the live site itself. Three triggers:

1. **On every push to `main` that touches `js/data.js`** — diffs the
   `STUDENTS` array before/after the push and sends, per affected student, a
   digest of everything that changed for them:
   - a new/changed deadline (`rightNow`)
   - new feedback
   - a roadmap item's status changing (e.g. `Locked` → `Unlocked` →
     `Complete`)
   - a new cheat sheet entry

   A student who's brand new this push, or a course that's brand new on a
   student this push, is skipped from the digest — only pre-existing
   students/courses get diffed, so adding someone doesn't email them their
   entire starting state as if it were "new."
2. **A brand-new student** (present in the new data, not the old) gets a
   separate welcome email instead — see point 1's skip above.
3. **A linked parent** (`PARENTS[].linkedStudents` in `js/data.js`) gets a
   copy of their student's digest, if that parent has a non-empty `email`.
4. **On a weekly schedule (cron)** — emails every student with a non-empty
   `email` a fixed session reminder, with a link to the calendar. Not
   data-driven at all. (Currently switched off — no `schedule:` trigger is
   configured yet, since there are no IRL sessions running. See
   `.github/workflows/notify.yml` for how to turn it back on.)
5. **On every push touching `js/blog-data.js`, `resources.html`, or
   `philosophy.html`** — a broadcast, not personalized: one email, same
   content, to every student *and* every parent with a non-empty email,
   listing whatever's new (new blog posts, new resources.html entries by
   name, or "the Philosophy page changed"). A no-op if none of those three
   files actually changed in the push.
6. **On a 15-minute schedule (cron)** — a teacher-initiated equivalent of
   point 4, added 2026-08-10: teacher.html has a "Schedule a notification"
   form (check off any students across every class you teach, write a
   subject/message, pick a send time), which appends a "Pending" row to
   `data/scheduled-notifications.json` via `zenith-data-writer.gs`'s
   `scheduleNotification` action — that write is instant, but nothing is
   emailed yet at that point. This job polls that file for `Pending` rows
   whose `sendAt` has passed, emails every checked recipient (resolved
   fresh against `js/data.js`'s `STUDENTS`) with a non-empty email, marks
   each sent row `Sent`, and commits the updated file back — unlike point 4,
   this cron IS live (unconditional, since it's a no-op when nothing's due).

Every email links back to the relevant page on the live site
(`right-now.html?course=...`, `feedback.html?course=...`, etc.) — see
`site-links.js`.

## How it works

- `site-links.js` — the live site's base URL (`SITE_URL`, defaults to this
  repo's actual GitHub Pages origin) plus helpers building a link to each
  relevant page, given a course id.
- `diff-data.js` — runs `js/data.js`'s source through Node's `vm` module to
  pull `STUDENTS`/`PARENTS` back out. `js/data.js` isn't a CommonJS module
  (it's a plain `<script>` file the browser loads directly), so this reads
  it without needing to add `module.exports` to the site file.
- `diff-content.js` — same `vm` trick for `js/blog-data.js`'s `BLOG_POSTS`;
  regex-extracts `{href, title}` pairs out of `resources.html`'s hand-written
  `<a class="resource-item">` markup (no data file backs it); does a plain
  text comparison for `philosophy.html` (no itemizable structure there, so
  "changed at all" is the whole signal).
- `compute-changes.js` — matches students/courses/roadmap items/cheat sheet
  entries by `username`/`id`/`name` between the old and new data and returns
  the change list, new-student list, and parent-recipient list.
- `render-digest.js` — turns those (plus `diff-content.js`'s output) into
  subject/HTML bodies, including the links.
- `mailer.js` — a `nodemailer` transport authenticated against Gmail's SMTP
  server (`smtp.gmail.com:465`) using `GMAIL_USER`/`GMAIL_APP_PASSWORD`.
- `notify-on-push.js` / `notify-content-updates.js` / `notify-session-reminder.js` /
  `send-scheduled-notifications.js` — the entry points the workflow calls.

## One-time setup

1. **Gmail App Password**: on the sending account (e.g. a dedicated
   `zenithzenith0000@gmail.com`, not a personal account) — Security →
   2-Step Verification (must be on) → App Passwords → generate one. This is
   a 16-character credential separate from the real account password, and
   can be revoked anytime without affecting login.
2. **GitHub repo secrets**: Settings → Secrets and variables → Actions:
   - `GMAIL_USER` — the sending Gmail address itself.
   - `GMAIL_APP_PASSWORD` — its 16-character app password (no spaces).
3. **Fill in emails** in `js/data.js` — each `STUDENTS`/`PARENTS` entry has
   an `"email"` field, empty by default. Empty means silently skipped by
   every job (not an error).
4. **Set the weekly reminder time**: edit the `cron:` line and the
   `SESSION_DAY`/`SESSION_TIME` env vars in `.github/workflows/notify.yml`
   so they agree with each other. Cron time is UTC; convert from local time.

## Testing before relying on it

Run either script locally with `--dry-run` — prints what would be sent
without needing Gmail credentials at all:

```
cd automation/notifications
npm install
node notify-on-push.js /path/to/old-data.js ../../js/data.js --dry-run
node notify-content-updates.js ../../js/data.js \
  /path/to/old-blog-data.js ../../js/blog-data.js \
  /path/to/old-resources.html ../../resources.html \
  /path/to/old-philosophy.html ../../philosophy.html --dry-run
node notify-session-reminder.js ../../js/data.js --dry-run
node send-scheduled-notifications.js ../../js/data.js /path/to/test-notifications.json --dry-run
```

The last one needs a hand-built `data/scheduled-notifications.json`-shaped file with at least one `"status": "Pending"` entry whose `"sendAt"` is in the past and a `"recipientUsernames"` array containing at least one real `STUDENTS[].username` with a non-empty email — `--dry-run` prints what it would send without touching that file (a real run rewrites it, marking due entries `"Sent"`).

For a real send test without waiting for a push or a cron tick, either
run a script directly with `GMAIL_USER`/`GMAIL_APP_PASSWORD` set as env vars
in your own shell (never paste the app password into a file that gets
committed), or use the workflow's manual trigger: GitHub → Actions →
"Zenith notifications" → "Run workflow" → pick a job (`send-scheduled-
notifications` included).

## Status

The push-triggered digest (deadline/feedback/roadmap/cheat sheet/welcome/
parent-CC) has been dry-run tested locally against a hand-built before/after
pair of `js/data.js` covering every change type, and the session reminder
has had one real send confirmed end-to-end. `send-scheduled-notifications.js`
has been dry-run tested locally (correctly resolved a real `CLASSES` entry to
its student roster and skipped a not-yet-due entry) and had its file-rewrite
logic verified separately against a scratch copy, but not a real send — no
`GMAIL_USER`/`GMAIL_APP_PASSWORD` were available in that environment. None
of `notify-on-push`/`notify-content-updates`/`weekly-session-reminder`/
`send-scheduled-notifications` has been run through an actual GitHub Actions
job yet — watch the first real run of each via the Actions tab, same caution
as `../submissions-compiler.gs`. `send-scheduled-notifications` in
particular is worth watching closely the first time: confirm the cron
actually fires on schedule, and that a real scheduled notification arrives
and gets marked `Sent` (not silently stuck `Pending`, and not double-sent).
