#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { loadData } = require("./diff-data");
const { computeChanges } = require("./compute-changes");

/**
 * Usage: node build-changelog-events.js <old-data.js> <new-data.js> <events-json-path>
 *
 * Runs the same change-detection logic as the email digest (compute-changes.js)
 * and appends the result to a JSON file the portal's "Updates" button reads
 * directly (data/changelog-events.json), instead of the button doing its own
 * (weaker) diff against a localStorage snapshot. This is the single source of
 * truth for "what changed" — the email pipeline and the portal button both
 * read off of it now, so a future fix to the diff logic (e.g. the known gap
 * where editing existing feedback text is invisible, see TRIGGERS.md) fixes
 * both at once instead of needing to be duplicated.
 *
 * Unlike the email digest, this does NOT filter by student.email — every
 * student should see their own updates in the portal regardless of whether
 * they have an email on file for notifications.
 */

const MAX_EVENTS_PER_STUDENT = 30;

const COURSE_PAGE = {
  deadline: "right-now.html",
  feedback: "feedback.html",
  roadmap: "roadmap.html",
  cheatSheet: "cheatsheet.html"
};

const ROADMAP_STATUS_LABELS = {
  Unlocked: "unlocked",
  Complete: "marked complete",
  Locked: "locked",
  "Optional-Reading": "marked optional reading"
};

function courseUrl(type, courseId) {
  return `${COURSE_PAGE[type]}?course=${encodeURIComponent(courseId)}`;
}

function eventText(change) {
  switch (change.type) {
    case "deadline": {
      const rn = change.rightNow;
      if (rn.state === "your-move") {
        const due = rn.due ? ` (due ${rn.due})` : "";
        return `${change.courseName} — new task: ${rn.chapter} ${rn.unit}${due}`;
      }
      return `${change.courseName} — status update: ${rn.chapter} ${rn.unit} (${rn.note || "waiting"})`;
    }
    case "feedback":
      return `${change.courseName} — new feedback on ${change.entry.chapter} ${change.entry.unit}`;
    case "roadmap": {
      const label = ROADMAP_STATUS_LABELS[change.item.status] || change.item.status;
      return `${change.courseName} — ${change.item.chapter} (${change.item.name}) ${label}`;
    }
    case "cheatSheet":
      return `${change.courseName} — new cheat sheet entry: "${change.entry.topic}"`;
    default:
      return "";
  }
}

function main() {
  const [oldPath, newPath, eventsPath] = process.argv.slice(2);
  if (!oldPath || !newPath || !eventsPath) {
    console.error("Usage: node build-changelog-events.js <old-data.js> <new-data.js> <events-json-path>");
    process.exitCode = 1;
    return;
  }

  const oldData = loadData(fs.readFileSync(oldPath, "utf8"));
  const newData = loadData(fs.readFileSync(newPath, "utf8"));
  const digests = computeChanges(oldData.students, newData.students);

  if (digests.length === 0) {
    console.log("No changes detected — changelog events feed left untouched.");
    return;
  }

  const existing = fs.existsSync(eventsPath) ? JSON.parse(fs.readFileSync(eventsPath, "utf8")) : {};
  const timestamp = new Date().toISOString();

  for (const digest of digests) {
    const newEvents = digest.changes.map((change) => ({
      type: change.type,
      courseId: change.courseId,
      text: eventText(change),
      url: courseUrl(change.type, change.courseId),
      timestamp
    }));

    const priorEvents = existing[digest.username] || [];
    existing[digest.username] = newEvents.concat(priorEvents).slice(0, MAX_EVENTS_PER_STUDENT);
  }

  fs.writeFileSync(eventsPath, JSON.stringify(existing, null, 2) + "\n");
  console.log(`Wrote ${digests.length} student(s)' changes to ${eventsPath}.`);
}

main();
