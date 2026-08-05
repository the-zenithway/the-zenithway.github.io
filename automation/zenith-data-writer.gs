/**
 * Zenith — Teacher dashboard data writer
 * -----------------------------------------
 * Standalone Apps Script Web App (a separate deployment from the
 * Form-bound submissions-compiler.gs — that one has to stay separate,
 * see the note below) that backs every "write" control on the teacher
 * dashboard: marking a submission Complete, unlocking a roadmap item,
 * adding a feedback entry, adding a cheat sheet entry, updating a
 * course's Right Now task, and logging a metrics data point. It
 * writes to two different files depending on the action — see
 * "TWO TARGET FILES" below.
 *
 * This used to be two separate standalone scripts (this one, plus a
 * submission-status-updater.gs that only handled marking a submission
 * Complete) — merged into one on 2026-08-05 since there was no longer
 * anything left of Google's own constraints keeping them apart: a
 * Form-bound trigger script (submissions-compiler.gs) genuinely has to
 * live inside that Form's own container-bound Apps Script project,
 * but two standalone Web Apps have no such requirement, so having two
 * of them was just extra deployment work for no benefit. If you
 * already deployed the old submission-status-updater.gs separately,
 * you can delete that deployment — everything it did now lives here
 * under the `markSubmissionComplete` action.
 *
 * This endpoint is deliberately narrow rather than deployment-access-
 * restricted: TEACHER_DATA_WRITE_URL (js/data.js) is visible to
 * anyone who views page source — same as everything else in that file
 * (see its "NOT SECURE" header comment). What actually bounds the
 * risk is that every action below is a single, specific, whitelisted
 * mutation (flip one roadmap item's status, mark one submission
 * Complete, append one feedback/cheat-sheet/metrics entry, replace
 * one course's rightNow) — never an arbitrary field write, never a
 * delete, never touching TEACHERS/PARENTS or any student's login
 * credentials. Batching (below) doesn't change this: a batch is just
 * a list of these same narrow actions, applied together.
 *
 * BATCHING: since 2026-08-05, teacher-student.html can stage several
 * changes (a roadmap unlock, a feedback entry, a Right Now update,
 * etc.) and send them as one `applyBatch` request instead of one
 * request per change — see doPost below. Every action here writes to
 * one of two files (js/data.js or data/submissions-log.json, see
 * "TWO TARGET FILES"); a batch whose actions all target the same file
 * becomes exactly ONE git commit, no matter how many actions it
 * contains. A batch that mixes both (i.e. includes
 * markSubmissionComplete alongside anything else) still produces two
 * commits, one per file — that's a hard limit of GitHub's Contents
 * API, not something worth working around, since markSubmissionComplete
 * lives on a different page (teacher.html) and isn't part of any
 * teacher-student.html batch in practice.
 *
 * This file is a reference copy for version history — the version
 * that actually runs lives inside its own Apps Script project (step 2
 * below), not here. Copy it in by hand; nothing auto-syncs.
 *
 * ---------------------------------------------------------------
 * TWO TARGET FILES
 * ---------------------------------------------------------------
 * `markSubmissionComplete` writes to data/submissions-log.json, a
 * plain JSON file — read/mutate/write there is a straightforward
 * JSON.parse/JSON.stringify, same as submissions-compiler.gs already
 * does.
 *
 * Every other action writes to js/data.js, which is a hand-authored
 * JavaScript file (`const STUDENTS = [...]`), NOT JSON — it can't be
 * read with a plain JSON.parse. findConstArraySpan_/readConstArray_/
 * spliceConstArray_ below solve that by locating exactly the `const
 * STUDENTS = [ ... ]` span in the raw file text (a bracket-depth
 * scanner that also tracks string-literal boundaries, so it finds the
 * true matching close, not just the first stray "]"), evaluating only
 * that span (safe here — this is trusted first-party code reading its
 * own repo's data, not arbitrary user input), mutating the resulting
 * plain object in memory, then re-serializing with JSON.stringify and
 * splicing it back into the original file text in place of the old
 * span. Everything outside that span — the header comment, the other
 * consts, TEACHERS, PARENTS — is left untouched byte-for-byte.
 *
 * Caveat worth knowing: any hand-written comment *inside* a STUDENTS
 * array entry (there are none as of this writing) would be lost the
 * next time this script writes, since JSON.stringify can't preserve
 * comments. Same tradeoff js/data.js's own header comment already
 * describes for zenith-cli.
 *
 * ---------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------
 * 1. script.google.com -> New project. Paste this whole file in,
 *    replacing whatever is in Code.gs. (Its own standalone project —
 *    not the same one as the Form-bound submissions-compiler.gs.)
 *
 * 2. Project Settings (gear icon) -> Script Properties -> add:
 *      GITHUB_TOKEN   Fine-grained PAT scoped to ONLY this repo, with
 *                     "Contents: Read and write" permission.
 *      GITHUB_OWNER   the-zenithway
 *      GITHUB_REPO    the-zenithway.github.io
 *      GITHUB_BRANCH  main
 *      DATA_PATH      js/data.js
 *      LOG_PATH       data/submissions-log.json
 *
 * 3. Deploy -> New deployment -> "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Copy the resulting /exec URL.
 *
 * 4. Paste that URL into TEACHER_DATA_WRITE_URL in js/data.js and
 *    commit. Both "Mark complete" (teacher.html) and every write
 *    control on teacher-student.html use this one URL.
 *
 * 5. Try one action for real (e.g. add a cheat sheet entry to a test
 *    student, and separately mark a real test submission Complete)
 *    and check main on GitHub for two commits, each updating exactly
 *    the one file/field that action touches and nothing else. Then
 *    try a real batch (stage a couple of changes on teacher-student.html
 *    and hit Apply) and confirm it's exactly ONE commit covering all
 *    of them.
 *
 * ---------------------------------------------------------------
 * WHAT COUNTS AS "DONE" HERE
 * ---------------------------------------------------------------
 * Untested against a real deployment — I can't run Apps Script
 * myself. The GitHub Contents API read/PUT/retry pattern is copied
 * directly from submissions-compiler.gs, which IS confirmed working.
 * findConstArraySpan_ has been verified independently (in Node, not
 * Apps Script) against the real js/data.js — round-tripped a real
 * mutation and syntax-checked the result — but that's not the same as
 * a real Apps Script + GitHub API run. The batching logic (doPost's
 * operations-list dispatch, commitStudentsMutation_/commitLogMutation_
 * taking a list of ops) is new as of 2026-08-05 and hasn't run for
 * real either. If step 5 throws or produces an unexpected diff, send
 * the exact error text or diff.
 */

// Every request becomes a list of { action, payload } operations — a
// single-action request (the shape every write control sent before
// batching existed) is just the N=1 case, via `applyBatch`:
//   { "action": "addFeedback", "payload": {...} }
//     -> operations = [{ action: "addFeedback", payload: {...} }]
//   { "action": "applyBatch", "payload": { "operations": [...] } }
//     -> operations = payload.operations as-is
// All ops targeting js/data.js ("students") are applied to ONE read
// of that file and committed in ONE write; same for any ops targeting
// data/submissions-log.json ("log"). A batch mixing both kinds still
// produces two commits — one per file — since GitHub's Contents API
// can't atomically commit to two different files in one call.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var operations = body.action === "applyBatch"
      ? ((body.payload && body.payload.operations) || [])
      : [{ action: body.action, payload: body.payload || {} }];

    if (operations.length === 0) throw new Error("No operations to apply");
    operations.forEach(function (op) {
      if (!ACTIONS[op.action]) throw new Error("Unknown action: " + op.action);
    });

    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("GITHUB_TOKEN");
    var owner = props.getProperty("GITHUB_OWNER");
    var repo = props.getProperty("GITHUB_REPO");
    var branch = props.getProperty("GITHUB_BRANCH") || "main";

    if (!token || !owner || !repo) {
      throw new Error("Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO script property — see setup steps at the top of this file.");
    }

    var studentsOps = operations.filter(function (op) { return ACTIONS[op.action].target !== "log"; });
    var logOps = operations.filter(function (op) { return ACTIONS[op.action].target === "log"; });

    if (studentsOps.length > 0) {
      var dataPath = props.getProperty("DATA_PATH") || "js/data.js";
      commitStudentsMutation_(owner, repo, branch, dataPath, token, studentsOps);
    }
    if (logOps.length > 0) {
      var logPath = props.getProperty("LOG_PATH") || "data/submissions-log.json";
      commitLogMutation_(owner, repo, branch, logPath, token, logOps);
    }
    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------
// Action handlers. Each has a `target` ("students" or "log") saying
// which file it mutates, and a `handler(data, payload)` that mutates
// `data` in place (the STUDENTS array for "students", the submissions
// log array for "log") and throws a descriptive error on any missing/
// invalid input. Kept deliberately narrow: one action, one specific
// mutation, nothing generic/arbitrary.
// ---------------------------------------------------------------

var ROADMAP_STATUSES_ = ["Locked", "Unlocked", "Complete", "Review", "Optional-Reading"];
var METRIC_ARRAY_TYPES_ = ["topicMastery", "chapterScores", "motivation", "mockScores", "timeToCompletion"];
var AP_SCORE_FIELDS_ = ["apPredictedScore", "apFinalScore"];

function findCourse_(students, username, courseId) {
  var student = students.find(function (s) { return s.username === username; });
  if (!student) throw new Error("No student with username " + username);
  var course = (student.courses || []).find(function (c) { return c.id === courseId; });
  if (!course) throw new Error("Student " + username + " is not enrolled in course " + courseId);
  return course;
}

var ACTIONS = {
  markSubmissionComplete: {
    target: "log",
    handler: function (log, payload) {
      if (!payload.id) throw new Error("markSubmissionComplete requires an id");
      var entry = log.find(function (e) { return e.id === payload.id; });
      if (!entry) throw new Error("No submission with id " + payload.id + " found in the log");
      entry.status = "Complete";
    }
  },

  updateRoadmapStatus: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (ROADMAP_STATUSES_.indexOf(payload.status) === -1) {
        throw new Error("Invalid status: " + payload.status);
      }
      var item = (course.roadmap || []).find(function (it) {
        return it.chapter === payload.chapter && it.name === payload.name;
      });
      if (!item) throw new Error("No roadmap item matching chapter \"" + payload.chapter + "\" / name \"" + payload.name + "\"");
      item.status = payload.status;
    }
  },

  addFeedback: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (!payload.date || !payload.chapter || !payload.unit || !payload.content) {
        throw new Error("addFeedback requires date, chapter, unit, and content");
      }
      if (!course.feedback) course.feedback = [];
      course.feedback.unshift({
        date: payload.date,
        chapter: payload.chapter,
        unit: payload.unit,
        content: payload.content
      });
    }
  },

  addCheatSheetEntry: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (!payload.topic || !payload.source || !payload.pattern) {
        throw new Error("addCheatSheetEntry requires topic, source, and pattern");
      }
      if (!course.cheatSheet) course.cheatSheet = [];
      course.cheatSheet.push({
        topic: payload.topic,
        source: payload.source,
        pattern: payload.pattern
      });
    }
  },

  updateRightNow: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      var rightNow = payload.rightNow;
      if (!rightNow || (rightNow.state !== "your-move" && rightNow.state !== "waiting")) {
        throw new Error("updateRightNow requires rightNow.state to be \"your-move\" or \"waiting\"");
      }
      if (!rightNow.chapter || !rightNow.unit) {
        throw new Error("updateRightNow requires rightNow.chapter and rightNow.unit");
      }
      if (rightNow.state === "your-move" && !rightNow.instruction) {
        throw new Error("updateRightNow requires rightNow.instruction when state is \"your-move\"");
      }
      if (rightNow.state === "waiting" && !rightNow.note) {
        throw new Error("updateRightNow requires rightNow.note when state is \"waiting\"");
      }
      course.rightNow = rightNow;
      if (payload.rightNowNext) course.rightNowNext = payload.rightNowNext;
      else delete course.rightNowNext;
    }
  },

  addMetricEntry: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (METRIC_ARRAY_TYPES_.indexOf(payload.metricType) === -1) {
        throw new Error("Invalid metricType: " + payload.metricType);
      }
      if (!payload.entry) throw new Error("addMetricEntry requires an entry");
      if (!course.metrics) course.metrics = {};
      if (!course.metrics[payload.metricType]) course.metrics[payload.metricType] = [];
      course.metrics[payload.metricType].push(payload.entry);
    }
  },

  setApScore: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (AP_SCORE_FIELDS_.indexOf(payload.field) === -1) {
        throw new Error("Invalid field: " + payload.field);
      }
      if (!payload.value) throw new Error("setApScore requires a value");
      if (!course.metrics) course.metrics = {};
      course.metrics[payload.field] = payload.value;
    }
  }
};

// ---------------------------------------------------------------
// js/data.js text <-> real object bridge
// ---------------------------------------------------------------

// Finds `const <constName> = [ ... ]` in raw source text and returns
// the exact character span of the array literal (including its own
// brackets), by walking the text tracking [ { } ] depth and skipping
// over string-literal contents (so a "]" inside a URL or feedback
// string doesn't get mistaken for the end of the array).
function findConstArraySpan_(source, constName) {
  var marker = "const " + constName + " = [";
  var markerStart = source.indexOf(marker);
  if (markerStart === -1) throw new Error("Could not find \"" + marker + "\" in the file");

  var literalStart = markerStart + marker.length - 1; // index of the "["
  var depth = 0;
  var inString = false;
  var stringChar = "";
  var i = literalStart;

  for (; i < source.length; i++) {
    var ch = source.charAt(i);
    var prevCh = i > 0 ? source.charAt(i - 1) : "";

    if (inString) {
      if (ch === stringChar && prevCh !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) { i++; break; } // i now points just past the matching "]"
    }
  }

  if (depth !== 0) throw new Error("Could not find the matching closing bracket for " + constName);
  return { literalStart: literalStart, literalEnd: i };
}

// Reads `const <constName> = [...]`'s current value as a real JS
// array. eval is safe here specifically because this is trusted
// first-party code reading its own repo's data file, not arbitrary
// user/network input.
function readConstArray_(source, constName) {
  var span = findConstArraySpan_(source, constName);
  var literalText = source.slice(span.literalStart, span.literalEnd);
  return eval("(" + literalText + ")");
}

// Replaces `const <constName> = [...]`'s array literal with
// JSON.stringify(newValue) — everything else in the file (comments,
// other consts) is left untouched.
function spliceConstArray_(source, constName, newValue) {
  var span = findConstArraySpan_(source, constName);
  var newLiteral = JSON.stringify(newValue, null, 2);
  return source.slice(0, span.literalStart) + newLiteral + source.slice(span.literalEnd);
}

// ---------------------------------------------------------------
// GitHub Contents API read/mutate/write, same GET -> mutate -> PUT
// (+409 retry) pattern as commitNewEntry_ in submissions-compiler.gs —
// one variant for js/data.js (splice-based, since it's not JSON), one
// for the plain-JSON submissions log. Both now take a LIST of ops
// (`ops`, each `{action, payload}`) rather than one — every op in the
// list is applied to the same single read before one write, which is
// what makes "5 roadmap changes = 1 commit" possible. A single-action
// request from doPost is just a 1-element list, so there's no
// separate "non-batch" code path to keep in sync.
//
// On a 409 retry, the whole function re-runs from a fresh GET and
// reapplies every op in `ops` again from scratch — safe and correct
// (not double-applied) because the previous attempt's PUT was
// rejected, so nothing from it was actually written.
// ---------------------------------------------------------------

// Builds a readable commit message: unchanged single-op format when
// there's only one, a summary listing every action name when there's
// more than one.
function commitMessageForOps_(ops) {
  if (ops.length === 1) {
    var op = ops[0], payload = op.payload;
    return "Teacher dashboard: " + op.action +
      (payload.username ? " for " + payload.username + (payload.courseId ? " / " + payload.courseId : "") : "") +
      (payload.id ? " (" + payload.id + ")" : "");
  }
  return "Teacher dashboard: " + ops.length + " changes (" +
    ops.map(function (op) { return op.action; }).join(", ") + ")";
}

function commitStudentsMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var students = readConstArray_(source, "STUDENTS");
  ops.forEach(function (op) { ACTIONS[op.action].handler(students, op.payload); }); // mutates `students` in place; throws on invalid payload
  var newSource = spliceConstArray_(source, "STUDENTS", students);
  var newContent = Utilities.base64Encode(newSource, Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitStudentsMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

function commitLogMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var log = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString());

  ops.forEach(function (op) { ACTIONS[op.action].handler(log, op.payload); }); // mutates `log` in place; throws on invalid payload
  var newContent = Utilities.base64Encode(JSON.stringify(log, null, 2), Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitLogMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

function commitFile_(owner, repo, branch, path, token, base64Content, sha, message) {
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };
  return UrlFetchApp.fetch(
    "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
    {
      method: "put",
      headers: headers,
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: message,
        content: base64Content,
        sha: sha,
        branch: branch
      })
    }
  );
}
