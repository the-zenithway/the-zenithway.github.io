"use strict";

const vm = require("vm");

/**
 * js/data.js is a plain browser <script> file (no module.exports) — it
 * declares `const STUDENTS = [...]`, `const PARENTS = [...]`, etc. at top
 * level for the page to read directly. To read it from Node without
 * changing that, run its source in a throwaway VM context and pull the
 * values back out afterward.
 *
 * `const` declarations are lexical bindings, not properties on the context
 * object, so vm.runInContext can't read them back out on its own —
 * appending the extraction into the *same* script keeps it in scope.
 *
 * TEACHERS/CLASSES are read the same way, guarded with `typeof ... !==
 * "undefined"` since older callers only ever needed STUDENTS/PARENTS —
 * added for send-scheduled-notifications.js, which needs CLASSES to
 * resolve a scheduled notification's classId into student emails, and
 * TEACHERS only incidentally (the creating teacher's name is already
 * snapshotted onto each scheduled-notification entry, so this is a
 * fallback, not the primary source).
 */
function loadData(sourceText) {
  const script = `${sourceText}
;this.__STUDENTS__ = STUDENTS;
this.__PARENTS__ = typeof PARENTS !== "undefined" ? PARENTS : [];
this.__TEACHERS__ = typeof TEACHERS !== "undefined" ? TEACHERS : [];
this.__CLASSES__ = typeof CLASSES !== "undefined" ? CLASSES : [];`;
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: "data.js" });
  return {
    students: sandbox.__STUDENTS__ || [],
    parents: sandbox.__PARENTS__ || [],
    teachers: sandbox.__TEACHERS__ || [],
    classes: sandbox.__CLASSES__ || []
  };
}

function extractStudents(sourceText) {
  return loadData(sourceText).students;
}

module.exports = { loadData, extractStudents };
