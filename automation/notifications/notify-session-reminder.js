#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { extractStudents } = require("./diff-data");
const { renderSessionReminderEmail } = require("./render-digest");
const { createTransport } = require("./mailer");

/**
 * Usage: node notify-session-reminder.js <data.js-path> [--dry-run]
 *
 * Emails every student with a non-empty `email` a fixed weekly session
 * reminder. Not data-driven — runs purely off the cron schedule in
 * .github/workflows/notify.yml.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dataPath = args.find((a) => !a.startsWith("--")) || path.join(__dirname, "../../js/data.js");

  const students = extractStudents(fs.readFileSync(dataPath, "utf8"));
  const recipients = students.filter((s) => s.email);

  if (recipients.length === 0) {
    console.log("No students have an email on file — nothing to send.");
    return;
  }

  const transport = dryRun ? null : createTransport();
  // SESSION_DAY / SESSION_TIME are optional env vars so the same script
  // works even before those are filled in on the workflow.
  const meta = { day: process.env.SESSION_DAY, timeDescription: process.env.SESSION_TIME };

  for (const student of recipients) {
    const { subject, html } = renderSessionReminderEmail(student.name, meta);
    if (dryRun) {
      console.log(`--- would email ${student.email} (${student.username}) ---`);
      console.log(`Subject: ${subject}`);
      console.log(html);
      continue;
    }
    await transport.sendMail({ from: process.env.GMAIL_USER, to: student.email, subject, html });
    console.log(`Sent session reminder to ${student.email} (${student.username}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
