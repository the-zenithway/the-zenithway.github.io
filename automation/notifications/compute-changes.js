"use strict";

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compares the STUDENTS array before/after a push and returns, per student,
 * the list of changes worth emailing about. A student who didn't exist in
 * the old data at all is skipped entirely — a brand-new enrollment isn't a
 * "change" to notify about, it would just spam their whole starting state.
 * Same idea per-course: a course that's new on this student this push is
 * skipped, only pre-existing courses are diffed.
 */
function computeChanges(oldStudents, newStudents) {
  const oldByUsername = new Map(oldStudents.map((s) => [s.username, s]));
  const results = [];

  for (const student of newStudents) {
    const oldStudent = oldByUsername.get(student.username);
    if (!oldStudent) continue;
    if (!student.email) continue;

    const changes = [];
    const oldCoursesById = new Map((oldStudent.courses || []).map((c) => [c.id, c]));

    for (const course of student.courses || []) {
      const oldCourse = oldCoursesById.get(course.id);
      if (!oldCourse) continue;

      if (course.rightNow && !sameJson(course.rightNow, oldCourse.rightNow)) {
        changes.push({ type: "deadline", courseName: course.name, rightNow: course.rightNow });
      }

      const oldFeedback = oldCourse.feedback || [];
      const newFeedback = course.feedback || [];
      const addedCount = newFeedback.length - oldFeedback.length;
      if (addedCount > 0) {
        // New entries are prepended (added to the top), so the newest
        // `addedCount` entries are the ones that just landed.
        for (const entry of newFeedback.slice(0, addedCount)) {
          changes.push({ type: "feedback", courseName: course.name, entry });
        }
      }
    }

    if (changes.length > 0) {
      results.push({ username: student.username, name: student.name, email: student.email, changes });
    }
  }

  return results;
}

module.exports = { computeChanges };
