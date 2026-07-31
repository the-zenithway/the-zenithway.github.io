"use strict";

function renderChange(change) {
  if (change.type === "deadline") {
    const rn = change.rightNow;
    if (rn.state === "your-move") {
      const due = rn.due ? ` (due ${rn.due})` : "";
      return `<li><strong>${change.courseName}</strong> — new task: ${rn.chapter} ${rn.unit}${due}</li>`;
    }
    return `<li><strong>${change.courseName}</strong> — status update: ${rn.chapter} ${rn.unit} (${rn.note || "waiting"})</li>`;
  }
  // feedback
  return `<li><strong>${change.courseName}</strong> — new feedback on ${change.entry.chapter} ${change.entry.unit}</li>`;
}

function renderDigestEmail(name, changes) {
  const items = changes.map(renderChange).join("\n");
  const subject = changes.length === 1 ? "Zenith update" : `Zenith update — ${changes.length} changes`;
  const html = `<p>Hi ${name},</p><p>Here's what's new on Zenith:</p><ul>${items}</ul>`;
  return { subject, html };
}

function renderSessionReminderEmail(name, { day, timeDescription } = {}) {
  const subject = "Zenith — weekly session reminder";
  const html = `<p>Hi ${name},</p><p>Reminder: this week's Zenith session is ${day ? `on ${day}` : "coming up"}${
    timeDescription ? ` (${timeDescription})` : ""
  }. See you there!</p>`;
  return { subject, html };
}

module.exports = { renderDigestEmail, renderSessionReminderEmail };
