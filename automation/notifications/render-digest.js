"use strict";

const { links } = require("./site-links");

const ROADMAP_STATUS_LABELS = {
  Unlocked: "unlocked",
  Complete: "marked complete",
  Locked: "locked",
  "Optional-Reading": "marked optional reading"
};

function renderChange(change) {
  switch (change.type) {
    case "deadline": {
      const rn = change.rightNow;
      const url = links.rightNow(change.courseId);
      if (rn.state === "your-move") {
        const due = rn.due ? ` (due ${rn.due})` : "";
        return `<li><strong>${change.courseName}</strong> — new task: ${rn.chapter} ${rn.unit}${due}. <a href="${url}">View it</a></li>`;
      }
      return `<li><strong>${change.courseName}</strong> — status update: ${rn.chapter} ${rn.unit} (${rn.note || "waiting"}). <a href="${url}">View it</a></li>`;
    }
    case "feedback": {
      const url = links.feedback(change.courseId);
      return `<li><strong>${change.courseName}</strong> — new feedback on ${change.entry.chapter} ${change.entry.unit}. <a href="${url}">Read it</a></li>`;
    }
    case "roadmap": {
      const url = links.roadmap(change.courseId);
      const label = ROADMAP_STATUS_LABELS[change.item.status] || change.item.status;
      return `<li><strong>${change.courseName}</strong> — ${change.item.chapter} (${change.item.name}) ${label}. <a href="${url}">See your roadmap</a></li>`;
    }
    case "cheatSheet": {
      const url = links.cheatSheet(change.courseId);
      return `<li><strong>${change.courseName}</strong> — new cheat sheet entry: "${change.entry.topic}". <a href="${url}">Check it out</a></li>`;
    }
    default:
      return "";
  }
}

function renderDigestEmail(name, changes) {
  const items = changes.map(renderChange).join("\n");
  const subject = changes.length === 1 ? "Zenith update" : `Zenith update — ${changes.length} changes`;
  const html = `<p>Hi ${name},</p><p>Here's what's new on Zenith:</p><ul>${items}</ul>`;
  return { subject, html };
}

function renderParentDigestEmail(parentName, studentName, changes) {
  const items = changes.map(renderChange).join("\n");
  const subject = `Zenith update for ${studentName}`;
  const html =
    `<p>Hi ${parentName},</p>` +
    `<p>Here's what's new for ${studentName} on Zenith:</p><ul>${items}</ul>` +
    `<p><a href="${links.parent()}">View the full parent dashboard</a></p>`;
  return { subject, html };
}

function renderSessionReminderEmail(name, { day, timeDescription } = {}) {
  const subject = "Zenith — weekly session reminder";
  const html =
    `<p>Hi ${name},</p>` +
    `<p>Reminder: this week's Zenith session is ${day ? `on ${day}` : "coming up"}${
      timeDescription ? ` (${timeDescription})` : ""
    }. See you there!</p>` +
    `<p><a href="${links.calendar()}">View the calendar</a></p>`;
  return { subject, html };
}

// A teacher-authored notification, scheduled from teacher.html for a
// specific class, sent by send-scheduled-notifications.js once its
// sendAt has passed. `message` is plain text as the teacher typed it
// (not HTML) — escaped and line-broken here rather than trusted raw,
// since unlike this file's other templates it's free-form input from
// a form, not developer-authored copy.
function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderScheduledNotificationEmail(studentName, { teacherName, subject, message }) {
  const fullSubject = "Zenith — " + subject;
  const html =
    `<p>Hi ${studentName},</p>` +
    `<p>${escapeHtml_(message).replace(/\n/g, "<br>")}</p>` +
    `<p>— ${teacherName}</p>` +
    `<p><a href="${links.calendar()}">View the calendar</a></p>`;
  return { subject: fullSubject, html };
}

function renderWelcomeEmail(name) {
  const subject = "Welcome to Zenith";
  const html =
    `<p>Hi ${name},</p>` +
    `<p>You're all set up on Zenith. Log in any time to see your current task, feedback, and roadmap.</p>` +
    `<p><a href="${links.portal()}">Go to your portal</a></p>`;
  return { subject, html };
}

function renderContentChange(change) {
  switch (change.type) {
    case "blog":
      return `<li>New blog post: <strong>${change.post.title}</strong>. <a href="${links.blogPost(change.post.slug)}">Read it</a></li>`;
    case "resource":
      return `<li>New resource added: <strong>${change.item.title}</strong>. <a href="${links.resources()}">See it on the Resources page</a></li>`;
    case "philosophy":
      return `<li>The Philosophy page was updated. <a href="${links.philosophy()}">Read it</a></li>`;
    default:
      return "";
  }
}

function renderContentUpdateEmail(changes) {
  const items = changes.map(renderContentChange).join("\n");
  const subject = changes.length === 1 ? "Zenith — new content" : `Zenith — ${changes.length} new updates`;
  const html = `<p>Hi,</p><p>Some things are new on Zenith:</p><ul>${items}</ul>`;
  return { subject, html };
}

module.exports = {
  renderDigestEmail,
  renderParentDigestEmail,
  renderSessionReminderEmail,
  renderScheduledNotificationEmail,
  renderWelcomeEmail,
  renderContentUpdateEmail
};
