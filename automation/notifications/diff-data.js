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
 */
function loadData(sourceText) {
  const script = `${sourceText}\n;this.__STUDENTS__ = STUDENTS;\nthis.__PARENTS__ = typeof PARENTS !== "undefined" ? PARENTS : [];`;
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: "data.js" });
  return { students: sandbox.__STUDENTS__ || [], parents: sandbox.__PARENTS__ || [] };
}

function extractStudents(sourceText) {
  return loadData(sourceText).students;
}

module.exports = { loadData, extractStudents };
