#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { loadData } = require("./diff-data");
const { computeBlogChanges, computeResourceChanges, computePhilosophyChanges } = require("./diff-content");
const { renderContentUpdateEmail } = require("./render-digest");
const { createTransport } = require("./mailer");

/**
 * Usage: node notify-content-updates.js <data.js-path> \
 *          <old-blog-data.js> <new-blog-data.js> \
 *          <old-resources.html> <new-resources.html> \
 *          <old-philosophy.html> <new-philosophy.html> [--dry-run]
 *
 * Broadcast, not personalized — one email, same content, to every student
 * and every parent with a non-empty email — for content that isn't
 * per-student data: new blog posts, new resources.html entries, and any
 * change to philosophy.html. A no-op (nothing sent) if none of those three
 * files actually changed in this push.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [dataPath, oldBlogPath, newBlogPath, oldResourcesPath, newResourcesPath, oldPhilosophyPath, newPhilosophyPath] =
    positional;

  if (!dataPath || !newPhilosophyPath) {
    console.error(
      "Usage: node notify-content-updates.js <data.js> <old-blog-data.js> <new-blog-data.js> <old-resources.html> <new-resources.html> <old-philosophy.html> <new-philosophy.html> [--dry-run]"
    );
    process.exitCode = 1;
    return;
  }

  const read = (p) => fs.readFileSync(p, "utf8");

  const changes = [
    ...computeBlogChanges(read(oldBlogPath), read(newBlogPath)),
    ...computeResourceChanges(read(oldResourcesPath), read(newResourcesPath)),
    ...computePhilosophyChanges(read(oldPhilosophyPath), read(newPhilosophyPath))
  ];

  if (changes.length === 0) {
    console.log("No content changes detected — nothing to send.");
    return;
  }

  const { students, parents } = loadData(read(dataPath));
  const recipients = [...students, ...parents].map((p) => p.email).filter(Boolean);

  if (recipients.length === 0) {
    console.log("No recipients have an email on file — nothing to send.");
    return;
  }

  const { subject, html } = renderContentUpdateEmail(changes);
  const transport = dryRun ? null : createTransport();

  for (const email of recipients) {
    if (dryRun) {
      console.log(`--- would email ${email} ---`);
      console.log(`Subject: ${subject}`);
      console.log(html);
      continue;
    }
    await transport.sendMail({ from: process.env.GMAIL_USER, to: email, subject, html });
    console.log(`Sent to ${email}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
