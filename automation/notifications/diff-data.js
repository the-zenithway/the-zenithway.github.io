"use strict";

const vm = require("vm");

/**
 * js/data.js is a plain browser <script> file (no module.exports) — it
 * declares `const STUDENTS = [...]` etc. at top level for the page to read
 * directly. To read it from Node without changing that, run its source in a
 * throwaway VM context and pull STUDENTS back out afterward.
 */
function extractStudents(sourceText) {
  // `const STUDENTS = [...]` is a lexical binding, not a property on the
  // context object — vm.runInContext can't read it back out afterward.
  // Appending the extraction into the *same* script keeps it in scope.
  const script = `${sourceText}\n;this.__STUDENTS__ = STUDENTS;`;
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: "data.js" });
  return sandbox.__STUDENTS__ || [];
}

module.exports = { extractStudents };
