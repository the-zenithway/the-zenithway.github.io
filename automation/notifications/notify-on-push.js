#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { loadData } = require("./diff-data");
const { computeChanges, computeNewStudents, computeParentRecipients } = require("./compute-changes");
const { renderDigestEmail, renderParentDigestEmail, renderWelcomeEmail } = require("./render-digest");
const { createTransport } = require("./mailer");

/**
 * Usage: node notify-on-push.js <old-data.js-path> <new-data.js-path> [--dry-run]
 *
 * Reads STUDENTS/PARENTS before/after a push and sends three kinds of email:
 *  - a per-student digest of what changed for them (deadline, feedback,
 *    roadmap status, cheat sheet)
 *  - a welcome email for any brand-new student (not a "change", so not part
 *    of the digest)
 *  - a copy of a student's digest to any parent linked to them
 * --dry-run prints what would be sent instead of actually sending (no Gmail
 * credentials needed).
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [oldPath, newPath] = args.filter((a) => !a.startsWith("--"));

  if (!oldPath || !newPath) {
    console.error("Usage: node notify-on-push.js <old-data.js> <new-data.js> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const oldData = loadData(fs.readFileSync(oldPath, "utf8"));
  const newData = loadData(fs.readFileSync(newPath, "utf8"));

  const digests = computeChanges(oldData.students, newData.students);
  const newStudents = computeNewStudents(oldData.students, newData.students);
  const parentRecipients = computeParentRecipients(newData.parents, digests);

  if (digests.length === 0 && newStudents.length === 0 && parentRecipients.length === 0) {
    console.log("No student-facing changes detected — nothing to send.");
    return;
  }

  const transport = dryRun ? null : createTransport();

  async function send(to, subject, html, label) {
    if (dryRun) {
      console.log(`--- would email ${to} (${label}) ---`);
      console.log(`Subject: ${subject}`);
      console.log(html);
      return;
    }
    await transport.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
    console.log(`Sent to ${to} (${label}).`);
  }

  for (const digest of digests) {
    const { subject, html } = renderDigestEmail(digest.name, digest.changes);
    await send(digest.email, subject, html, `${digest.username}: ${digest.changes.length} change(s)`);
  }

  for (const student of newStudents) {
    const { subject, html } = renderWelcomeEmail(student.name);
    await send(student.email, subject, html, `${student.username}: welcome`);
  }

  for (const { parentName, parentEmail, studentDigest } of parentRecipients) {
    const { subject, html } = renderParentDigestEmail(parentName, studentDigest.name, studentDigest.changes);
    await send(parentEmail, subject, html, `parent of ${studentDigest.username}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
