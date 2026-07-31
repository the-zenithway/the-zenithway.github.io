#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { extractStudents } = require("./diff-data");
const { computeChanges } = require("./compute-changes");
const { renderDigestEmail } = require("./render-digest");
const { createTransport } = require("./mailer");

/**
 * Usage: node notify-on-push.js <old-data.js-path> <new-data.js-path> [--dry-run]
 *
 * Reads the STUDENTS array before/after a push, works out what changed per
 * student, and emails each affected student a digest. --dry-run prints what
 * would be sent instead of actually sending (no Gmail credentials needed).
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

  const oldStudents = extractStudents(fs.readFileSync(oldPath, "utf8"));
  const newStudents = extractStudents(fs.readFileSync(newPath, "utf8"));
  const digests = computeChanges(oldStudents, newStudents);

  if (digests.length === 0) {
    console.log("No student-facing changes detected — nothing to send.");
    return;
  }

  const transport = dryRun ? null : createTransport();

  for (const digest of digests) {
    const { subject, html } = renderDigestEmail(digest.name, digest.changes);
    if (dryRun) {
      console.log(`--- would email ${digest.email} (${digest.username}) ---`);
      console.log(`Subject: ${subject}`);
      console.log(html);
      continue;
    }
    await transport.sendMail({ from: process.env.GMAIL_USER, to: digest.email, subject, html });
    console.log(`Sent to ${digest.email} (${digest.username}): ${digest.changes.length} change(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
