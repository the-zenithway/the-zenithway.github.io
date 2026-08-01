"use strict";

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Roadmap items have no id — matched by `name`, which is unique within one
// course's roadmap array in practice (e.g. "B2-Limits and Continuity").
function computeRoadmapChanges(oldCourse, course) {
  const changes = [];
  const oldItemsByName = new Map((oldCourse.roadmap || []).map((item) => [item.name, item]));

  for (const item of course.roadmap || []) {
    const oldItem = oldItemsByName.get(item.name);
    if (!oldItem || oldItem.status === item.status) continue;
    changes.push({ type: "roadmap", courseName: course.name, courseId: course.id, item });
  }

  return changes;
}

// Per the header comment in js/data.js, cheatSheet entries are appended
// oldest-first (the opposite order from feedback's newest-at-top), so new
// entries are the LAST `addedCount`, not the first.
function computeCheatSheetChanges(oldCourse, course) {
  const oldCheatSheet = oldCourse.cheatSheet || [];
  const newCheatSheet = course.cheatSheet || [];
  const addedCount = newCheatSheet.length - oldCheatSheet.length;
  if (addedCount <= 0) return [];

  return newCheatSheet
    .slice(newCheatSheet.length - addedCount)
    .map((entry) => ({ type: "cheatSheet", courseName: course.name, courseId: course.id, entry }));
}

function computeFeedbackChanges(oldCourse, course) {
  const oldFeedback = oldCourse.feedback || [];
  const newFeedback = course.feedback || [];
  const addedCount = newFeedback.length - oldFeedback.length;
  if (addedCount <= 0) return [];

  // New entries are prepended (added to the top), so the newest
  // `addedCount` entries are the ones that just landed.
  return newFeedback
    .slice(0, addedCount)
    .map((entry) => ({ type: "feedback", courseName: course.name, courseId: course.id, entry }));
}

/**
 * Compares the STUDENTS array before/after a push and returns, per student,
 * the list of changes worth surfacing to them. A student who didn't exist in
 * the old data at all is skipped here — that's a welcome email, handled
 * separately by computeNewStudents. Same idea per-course: a course that's
 * new on this student this push is skipped, only pre-existing courses are
 * diffed.
 *
 * Deliberately does not filter on `student.email` — this is the shared
 * "what changed" logic for both the email digest (notify-on-push.js, which
 * filters to emailable students itself before sending) and the portal's
 * changelog events feed (build-changelog-events.js, which needs every
 * student regardless of whether they have an email on file).
 */
function computeChanges(oldStudents, newStudents) {
  const oldByUsername = new Map(oldStudents.map((s) => [s.username, s]));
  const results = [];

  for (const student of newStudents) {
    const oldStudent = oldByUsername.get(student.username);
    if (!oldStudent) continue;

    const changes = [];
    const oldCoursesById = new Map((oldStudent.courses || []).map((c) => [c.id, c]));

    for (const course of student.courses || []) {
      const oldCourse = oldCoursesById.get(course.id);
      if (!oldCourse) continue;

      if (course.rightNow && !sameJson(course.rightNow, oldCourse.rightNow)) {
        changes.push({ type: "deadline", courseName: course.name, courseId: course.id, rightNow: course.rightNow });
      }

      changes.push(...computeFeedbackChanges(oldCourse, course));
      changes.push(...computeRoadmapChanges(oldCourse, course));
      changes.push(...computeCheatSheetChanges(oldCourse, course));
    }

    if (changes.length > 0) {
      results.push({ username: student.username, name: student.name, email: student.email, changes });
    }
  }

  return results;
}

// A student present in the new data but not the old — a genuinely new
// enrollment, not a "change" to an existing one. Handled separately from
// computeChanges so it gets its own welcome email instead of being read as
// (and spamming) their entire starting state.
function computeNewStudents(oldStudents, newStudents) {
  const oldUsernames = new Set(oldStudents.map((s) => s.username));
  return newStudents.filter((s) => !oldUsernames.has(s.username) && s.email);
}

// Parents (js/data.js's PARENTS array) whose linkedStudents includes a
// student that has changes this push, so they can get a copy of the same
// digest. `parents` is the raw PARENTS array — the notifications scripts
// pass it in since it's a separate top-level const from STUDENTS.
function computeParentRecipients(parents, studentDigests) {
  const digestsByUsername = new Map(studentDigests.map((d) => [d.username, d]));
  const results = [];

  for (const parent of parents || []) {
    if (!parent.email) continue;
    for (const username of parent.linkedStudents || []) {
      const digest = digestsByUsername.get(username);
      if (digest) {
        results.push({ parentName: parent.name, parentEmail: parent.email, studentDigest: digest });
      }
    }
  }

  return results;
}

module.exports = { computeChanges, computeNewStudents, computeParentRecipients };
