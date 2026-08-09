#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { loadData } = require("./diff-data");
const { renderScheduledNotificationEmail } = require("./render-digest");
const { createTransport } = require("./mailer");

/**
 * Usage: node send-scheduled-notifications.js [<data.js-path>] [<notifications-path>] [--dry-run]
 *
 * Polls data/scheduled-notifications.json (written by teacher.html's
 * "Schedule a notification" form via zenith-data-writer.gs's
 * scheduleNotification action) for "Pending" entries whose `sendAt`
 * has passed, emails every recipient in that entry's
 * `recipientUsernames` (resolved fresh against js/data.js's STUDENTS —
 * NOT from the entry's `recipientNames` snapshot, which is display-only
 * for teacher.html) who has a non-empty email, marks each sent entry
 * "Sent", and writes the file back. The GitHub Actions workflow that
 * runs this is responsible for committing that write — same division
 * of labor as build-changelog-events.js and its caller in
 * .github/workflows/notify.yml.
 *
 * Deliberately NOT done inside zenith-data-writer.gs (Apps Script):
 * that endpoint only ever runs in response to a live request from a
 * page, so it has no way to wake itself up later and check "is it
 * time yet." A scheduled cron job is the only piece of this stack
 * built for that — see the `send-scheduled-notifications` job in
 * .github/workflows/notify.yml, which runs this on a recurring
 * schedule (every 15 minutes as of 2026-08-10) rather than on a push.
 *
 * A notification stays "Pending" until this actually processes it —
 * if the cron job doesn't run for a while, a due notification sends
 * late rather than being silently dropped (`sendAt <= now`, not
 * `sendAt` within some narrow window).
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const dataPath = positional[0] || path.join(__dirname, "../../js/data.js");
  const notificationsPath = positional[1] || path.join(__dirname, "../../data/scheduled-notifications.json");

  const { students } = loadData(fs.readFileSync(dataPath, "utf8"));
  const notifications = JSON.parse(fs.readFileSync(notificationsPath, "utf8"));

  const now = new Date();
  const due = notifications.filter((n) => n.status === "Pending" && new Date(n.sendAt) <= now);

  if (due.length === 0) {
    console.log("Nothing due — no Pending scheduled notification has reached its sendAt yet.");
    return;
  }

  const transport = dryRun ? null : createTransport();

  for (const notif of due) {
    const wanted = notif.recipientUsernames || [];
    const recipients = students.filter((s) => wanted.indexOf(s.username) !== -1 && s.email);
    if (recipients.length < wanted.length) {
      console.log(`"${notif.subject}" (${notif.id}): ${wanted.length - recipients.length} of ${wanted.length} recipient(s) skipped (removed/renamed since scheduling, or no email on file).`);
    }

    for (const student of recipients) {
      const { subject, html } = renderScheduledNotificationEmail(student.name, {
        teacherName: notif.createdByName || "your teacher",
        subject: notif.subject,
        message: notif.message
      });
      if (dryRun) {
        console.log(`--- would email ${student.email} (${student.username}) ---`);
        console.log(`Subject: ${subject}`);
        console.log(html);
        continue;
      }
      await transport.sendMail({ from: process.env.GMAIL_USER, to: student.email, subject, html });
      console.log(`Sent "${notif.subject}" to ${student.email} (${student.username}).`);
    }

    notif.status = "Sent";
    notif.sentAt = now.toISOString();
    notif.recipientCount = recipients.length;
  }

  if (dryRun) {
    console.log(`\n[dry run] Would mark ${due.length} notification(s) Sent — not writing ${notificationsPath}.`);
    return;
  }

  fs.writeFileSync(notificationsPath, JSON.stringify(notifications, null, 2) + "\n");
  console.log(`Updated ${notificationsPath} — ${due.length} notification(s) marked Sent.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
