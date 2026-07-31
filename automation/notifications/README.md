# Email notifications

Two things trigger a student email, both run as GitHub Actions
(`.github/workflows/notify.yml`) — nothing runs on the live site itself:

1. **On every push to `main` that touches `js/data.js`** — diffs the
   `STUDENTS` array before/after the push and emails each affected student a
   digest of what changed for them: a new/changed deadline (`rightNow`) or
   new feedback. A student who's brand new this push, or a course that's
   brand new on a student this push, is skipped — only pre-existing
   students/courses get diffed, so adding someone doesn't email them their
   entire starting state as if it were "new."
2. **On a weekly schedule (cron)** — emails every student with a non-empty
   `email` a fixed session reminder. Not data-driven at all.

## How it works

- `diff-data.js` — runs `js/data.js`'s source through Node's `vm` module to
  pull `STUDENTS` back out. `js/data.js` isn't a CommonJS module (it's a
  plain `<script>` file the browser loads directly), so this reads it
  without needing to add `module.exports` to the site file.
- `compute-changes.js` — matches students/courses by `username`/`id` between
  the old and new `STUDENTS` arrays and returns, per student, the list of
  changes worth emailing about.
- `render-digest.js` — turns a change list into an email subject/HTML body.
- `mailer.js` — a `nodemailer` transport authenticated against Gmail's SMTP
  server (`smtp.gmail.com:465`) using `GMAIL_USER`/`GMAIL_APP_PASSWORD`.
- `notify-on-push.js` / `notify-session-reminder.js` — the two entry points
  the workflow calls.

## One-time setup

1. **Gmail App Password**: Google Account → Security → 2-Step Verification
   (must be on) → App Passwords → generate one. This is a 16-character
   credential separate from the real account password, and can be revoked
   anytime without affecting login.
2. **GitHub repo secrets**: Settings → Secrets and variables → Actions:
   - `GMAIL_USER` — the Gmail address itself.
   - `GMAIL_APP_PASSWORD` — the 16-character app password (no spaces).
3. **Fill in student emails** in `js/data.js` — each entry in `STUDENTS` has
   an `"email"` field, empty by default. A student with an empty email is
   silently skipped by both jobs (not an error).
4. **Set the weekly reminder time**: edit the `cron:` line and the
   `SESSION_DAY`/`SESSION_TIME` env vars in
   `.github/workflows/notify.yml` (currently placeholders — Sundays 13:00
   UTC / "Saturday"). Cron time is UTC; convert from your local time.

## Testing before relying on it

Run either script locally with `--dry-run` — prints what would be sent
without needing Gmail credentials at all:

```
cd automation/notifications
npm install
node notify-on-push.js /path/to/old-data.js ../../js/data.js --dry-run
node notify-session-reminder.js ../../js/data.js --dry-run
```

To test an actual send end-to-end without waiting for a real push or the
weekly cron, use the workflow's manual trigger: GitHub → Actions → "Zenith
notifications" → "Run workflow" → pick `notify-on-push` or
`weekly-session-reminder` from the dropdown.

## Status

Untested against a real GitHub Actions run and real Gmail send — logic
follows nodemailer's documented Gmail SMTP pattern, but the first real run
should be watched via the Actions tab, same caution as
`../submissions-compiler.gs`.
