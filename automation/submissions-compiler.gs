/**
 * Zenith — Submission compiler
 * ------------------------------
 * Apps Script bound to the intake Google Form (the same form linked
 * from SUBMISSION_FORM_URL in js/data.js). It does NOT write feedback,
 * cheat sheet entries, or roadmap status — that stays manual for now.
 * All it does is compile every incoming response into one
 * status-tracked JSON log, committed to this repo, so a mentor works
 * through one list instead of digging through Form responses, the
 * response Sheet, and Drive uploads separately.
 *
 * It also sends the student a short "we got it" confirmation email right
 * after logging, if their username matches an entry in js/data.js's
 * STUDENTS with a non-empty "email" — see sendConfirmationEmail_ below.
 * This is separate from and doesn't touch automation/notifications/ (the
 * GitHub Actions side, for deadline/feedback/roadmap emails on push).
 *
 * As of 2026-08-05, it ALSO emails the teacher(s) — see notifyTeachers_
 * below. Every TEACHERS entry in js/data.js with a non-empty "email"
 * gets notified on every submission, unless that entry has an optional
 * "courses" list, in which case only submissions for one of those
 * course ids notify them. See the TEACHERS comment in js/data.js.
 *
 * This file is a reference copy for version history — the version
 * that actually runs lives inside the Apps Script editor (step 2
 * below), not here. Copy it in by hand; nothing auto-syncs.
 *
 * ---------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------
 * 1. Make sure data/submissions-log.json exists on main (this repo
 *    already has one). The log commits straight to main — it's just
 *    a data file, nothing links to it or serves it as a page, so
 *    there's no risk to the live site from it living there.
 *
 * 2. Open the Google Form -> the three-dot menu (top right) ->
 *    "Script editor" (or, from the linked response Sheet:
 *    Extensions -> Apps Script). Paste this whole file in, replacing
 *    whatever is in Code.gs.
 *
 *    The Form needs a question for each of these, matched by a
 *    case-insensitive prefix (see findAnswerByPrefix_ below) rather
 *    than an exact title — this Form's question titles have drifted
 *    at least 3 times already ("Username"/"Course"/"Chapter"/
 *    "Unit(for Chapters 1~12)", then a simplified generic pass, then
 *    lowercase "username"/"chapter"/"unit"), so matching loosely
 *    (by what the title *starts with*, ignoring case) survives minor
 *    renames without silently going blank the way an exact match did
 *    on 2026-07-31 (a submission logged with username: null even
 *    though the raw answer clearly had "kyjv9981" in it):
 *      starts with "course"    dropdown, whose OPTION VALUES are now
 *                               the course's exact slug id — e.g.
 *                               "ap-calculus-bc", "ap-chemistry" —
 *                               matching STUDENTS[].courses[].id in
 *                               js/data.js exactly. As of 2026-08,
 *                               this is copied straight through as
 *                               courseId with no lookup table (see
 *                               buildEntryFromResponse_ below) — a
 *                               display-name dropdown ("AP Calculus
 *                               BC") used to need a separate COURSE_IDS
 *                               map here, which went stale at least
 *                               once (a missing "AP Chemistry" entry
 *                               silently logged courseId: null on four
 *                               real submissions in early August); a
 *                               slug-valued dropdown removes that
 *                               failure mode entirely, since there's
 *                               nothing left to keep in sync.
 *      starts with "username"   short answer — the student's exact
 *                               Zenith username
 *      starts with "chapter"    short answer or dropdown, e.g. "5"
 *                               (normalized to "Chapter 5" below)
 *      starts with "unit"       the roadmap category letter, e.g.
 *                               "B"/"C"/"T"/"R"/"S"
 *      a file-upload question   any title — detected by type, OCR'd
 *                               automatically
 *    If the Form's questions are renamed again beyond a shared prefix
 *    (not just a case change), update findAnswerByPrefix_'s callers
 *    below. If a new course's dropdown option is added, no code here
 *    needs to change — just make sure its value is that course's
 *    exact id from js/data.js.
 *
 * 3. Enable the Drive Advanced Service (needed for OCR): in the Apps
 *    Script editor, click "Services" (+ icon) in the left sidebar,
 *    find "Drive API", click Add.
 *
 * 4. Project Settings (gear icon, left sidebar) -> Script Properties
 *    -> add each of these. Never paste the token directly into this
 *    file — Script Properties keeps it out of the code and out of
 *    version history:
 *      GITHUB_TOKEN   A GitHub personal access token. Use a
 *                     fine-grained token scoped to ONLY this repo,
 *                     with "Contents: Read and write" permission —
 *                     not a classic all-repo token.
 *      GITHUB_OWNER   the-zenithway
 *      GITHUB_REPO    the-zenithway.github.io
 *      GITHUB_BRANCH  main
 *      LOG_PATH       data/submissions-log.json
 *
 * 5. Triggers (clock icon, left sidebar) -> Add Trigger:
 *      function to run:     onFormSubmit
 *      event source:        From form
 *      event type:          On form submit
 *    Save, and approve the permissions Google asks for (this is your
 *    own script acting on your own form/Drive/GitHub token — the
 *    permission prompt is normal).
 *
 * 6. Submit a test response to the form (attach an image if the form
 *    has a file-upload question, to test OCR too) and check main on
 *    GitHub for a new commit adding an entry to the log.
 *
 * 7. (One-time, optional) Every new photo upload is automatically
 *    made public-viewable by makeFilePublic_ (added 2026-08-05) so
 *    its thumbnail actually loads on the site instead of showing a
 *    broken image. Photos uploaded BEFORE that fix existed are still
 *    private — run backfillFileSharing_ once (pick it from the
 *    function dropdown in the Apps Script editor, click Run) to fix
 *    sharing on everything already in data/submissions-log.json.
 *
 * ---------------------------------------------------------------
 * WHAT COUNTS AS "DONE" HERE
 * ---------------------------------------------------------------
 * This is untested against your real form and your real Drive/GitHub
 * setup — I can't run Apps Script myself to verify it end-to-end. The
 * patterns here (namedValues iteration, Drive OCR via Files.copy,
 * GitHub Contents API) are all standard and documented, but if step 6
 * throws an error, send me the exact error text and I'll help fix it
 * — don't assume it's something you did wrong.
 *
 * sendConfirmationEmail_ (the submission-received email) is equally
 * untested against a real form submission — the regex-based email lookup
 * and MailApp.sendEmail call follow documented patterns, but watch the
 * first real test run (step 6) for it too, same caution as the rest of
 * this script.
 */

function onFormSubmit(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("GITHUB_TOKEN");
    var owner = props.getProperty("GITHUB_OWNER");
    var repo = props.getProperty("GITHUB_REPO");
    var branch = props.getProperty("GITHUB_BRANCH") || "main";
    var path = props.getProperty("LOG_PATH") || "data/submissions-log.json";

    if (!token || !owner || !repo) {
      throw new Error("Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO script property — see setup steps at the top of this file.");
    }

    var entry = buildEntryFromResponse_(e.response);
    commitNewEntry_(owner, repo, branch, path, token, entry);

    // Best-effort only — a failure here must never look like a failure to
    // log the submission itself (that already succeeded above), so it gets
    // its own try/catch instead of falling into the outer one.
    try {
      sendConfirmationEmail_(owner, repo, token, entry);
    } catch (mailErr) {
      MailApp.sendEmail(Session.getActiveUser().getEmail(),
        "Zenith submission confirmation email failed (submission itself was logged fine)",
        "Submission " + entry.id + " for username \"" + entry.username + "\" was logged, but the confirmation email to the student could not be sent:\n\n" + mailErr);
    }

    // Same best-effort isolation as the student confirmation email above.
    try {
      notifyTeachers_(owner, repo, token, entry);
    } catch (notifyErr) {
      MailApp.sendEmail(Session.getActiveUser().getEmail(),
        "Zenith teacher-notification email failed (submission itself was logged fine)",
        "Submission " + entry.id + " for username \"" + entry.username + "\" was logged, but notifying the teacher(s) failed:\n\n" + notifyErr);
    }
  } catch (err) {
    // A silently-failed trigger is worse than a noisy one — email
    // whoever owns this script so a missed submission doesn't go
    // unnoticed.
    MailApp.sendEmail(Session.getActiveUser().getEmail(),
      "Zenith submission compiler failed",
      "A form submission could not be logged:\n\n" + err);
  }
}

// "Chapter" comes in as a bare number ("5") — normalize it to match
// the "Chapter 5" format used in js/data.js's roadmap items. Leaves
// already-prefixed or unrecognized values alone.
function normalizeChapter_(raw) {
  if (!raw) return null;
  raw = String(raw).trim();
  return /^chapter\b/i.test(raw) ? raw : "Chapter " + raw;
}

// Finds an answer by matching the Form's question title against a
// case-insensitive prefix rather than an exact string — the Form's
// question titles have drifted more than once (see the setup comment
// at the top of this file), and a prefix match survives a case change
// or an added parenthetical without going silently blank.
function findAnswerByPrefix_(answers, prefix) {
  var lowerPrefix = prefix.toLowerCase();
  var key = Object.keys(answers).filter(function (k) {
    return k.toLowerCase().indexOf(lowerPrefix) === 0;
  })[0];
  return key ? answers[key] : null;
}

// Reads every question/answer pair generically — nothing here is
// hardcoded to an exact question title, so it keeps working if the
// form's questions are reworded (as long as the meaningful prefix —
// "course"/"username"/"chapter"/"unit" — stays put; see
// findAnswerByPrefix_). Any file-upload answer gets OCR'd via Drive
// and its text folded in alongside the raw answers.
function buildEntryFromResponse_(response) {
  var answers = {};
  var ocrText = "";

  response.getItemResponses().forEach(function (itemResponse) {
    var title = itemResponse.getItem().getTitle();
    var type = itemResponse.getItem().getType();

    if (type === FormApp.ItemType.FILE_UPLOAD) {
      var fileIds = itemResponse.getResponse(); // array of Drive file IDs
      answers[title] = fileIds;
      fileIds.forEach(function (fileId) {
        makeFilePublic_(fileId);
        var text = ocrDriveFile_(fileId);
        if (text) ocrText += (ocrText ? "\n\n---\n\n" : "") + text;
      });
    } else {
      answers[title] = itemResponse.getResponse();
    }
  });

  var courseAnswer = findAnswerByPrefix_(answers, "course");
  var usernameAnswer = findAnswerByPrefix_(answers, "username");
  var chapterAnswer = findAnswerByPrefix_(answers, "chapter");
  var unitAnswer = findAnswerByPrefix_(answers, "unit");

  return {
    id: "sub_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
    receivedAt: new Date().toISOString(),
    status: "pending",
    // Copied straight through — the Form's "Course" dropdown option
    // VALUES are the course's exact slug id (e.g. "ap-calculus-bc"),
    // so no lookup table is needed here anymore. If the Form ever
    // reverts to display-name values ("AP Calculus BC"), this would
    // need a name->id lookup again — see js/app.js's submissionCourseId()
    // client-side, which already tries an id match first and falls
    // back to a name match, so a wrong-shaped courseId here wouldn't
    // break the site either way; it just wouldn't be as clean.
    courseId: courseAnswer ? String(courseAnswer).trim() : null,
    username: usernameAnswer ? String(usernameAnswer).trim() : null,
    chapter: normalizeChapter_(chapterAnswer),
    unit: unitAnswer || null,
    answers: answers,
    ocrText: ocrText || null,
    formResponseId: response.getId()
  };
}

// Makes an uploaded photo viewable via its public thumbnail URL
// (https://drive.google.com/thumbnail?id=...), which is how
// submit.html/teacher.html/teacher-student.html render it. Without
// this, the thumbnail only loads for someone signed into a Google
// account that already has access to the file — almost never true
// for whoever's actually viewing the site — so it renders as a broken
// image. Safe to do: the file's id is already public the instant it
// lands in data/submissions-log.json (a plain JSON file the public
// site serves with no auth), so this doesn't expose anything that
// wasn't already discoverable, it just makes the already-discoverable
// link actually work. Uses the basic DriveApp service (built into
// every Apps Script project, no extra service to enable — unlike the
// Drive Advanced Service ocrDriveFile_ below needs). Non-fatal on
// failure (e.g. a Google Workspace admin policy blocking external
// sharing, if this Form's account is a school/org account rather than
// a personal one) — logs a warning but doesn't stop the submission
// from being recorded.
function makeFilePublic_(fileId) {
  try {
    DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    console.warn("Could not make file " + fileId + " public (sharing policy may block this): " + err);
  }
}

// One-off manual backfill for photos uploaded BEFORE makeFilePublic_
// existed — onFormSubmit only calls it for new uploads going forward,
// so anything already in data/submissions-log.json needs this run
// once by hand: in the Apps Script editor, pick backfillFileSharing_
// from the function dropdown (top toolbar) and click Run.
function backfillFileSharing_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");
  var branch = props.getProperty("GITHUB_BRANCH") || "main";
  var path = props.getProperty("LOG_PATH") || "data/submissions-log.json";

  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };
  var resp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " (HTTP " + resp.getResponseCode() + "): " + resp.getContentText());
  }
  var file = JSON.parse(resp.getContentText());
  var log = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString());

  var fixed = 0, failed = 0;
  log.forEach(function (entry) {
    var answers = entry.answers || {};
    Object.keys(answers).forEach(function (key) {
      if (!Array.isArray(answers[key])) return;
      answers[key].forEach(function (fileId) {
        try {
          DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          fixed++;
        } catch (err) {
          failed++;
          console.warn("Could not fix sharing for " + fileId + ": " + err);
        }
      });
    });
  });
  Logger.log("Backfill done: " + fixed + " fixed, " + failed + " failed.");
}

// Converts an uploaded image to a temporary Google Doc using Drive's
// built-in OCR, reads the extracted text back out, then deletes the
// temp Doc so it doesn't clutter Drive.
function ocrDriveFile_(fileId) {
  var resource = { title: "OCR-temp-" + fileId, mimeType: MimeType.GOOGLE_DOCS };
  var ocrDoc = Drive.Files.copy(resource, fileId, { ocr: true });
  var text = "";
  try {
    text = DocumentApp.openById(ocrDoc.id).getBody().getText();
  } finally {
    Drive.Files.remove(ocrDoc.id);
  }
  return text;
}

// Looks up a student's email straight out of js/data.js on GitHub (the
// single source of truth for it — this script has no roster of its own)
// and, if one is on file, sends a short "we got it" confirmation. Relies on
// STUDENTS entries keeping the field order username -> password -> name ->
// email (true as of when this was written); if that ever changes, update
// the regex below to match. Always reads js/data.js from "main" explicitly
// (not GITHUB_BRANCH) — that file only ever exists on main, regardless of
// which branch the submission log itself commits to.
function sendConfirmationEmail_(owner, repo, token, entry) {
  if (!entry.username) return;

  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/js/data.js?ref=main";
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };
  var resp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Could not read js/data.js (HTTP " + resp.getResponseCode() + "): " + resp.getContentText());
  }
  var file = JSON.parse(resp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var escapedUsername = entry.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var match = new RegExp('"username":\\s*"' + escapedUsername + '"[\\s\\S]*?"email":\\s*"([^"]*)"').exec(source);
  var email = match ? match[1] : null;
  if (!email) return; // no email on file for this student yet — nothing to send

  MailApp.sendEmail(email,
    "Zenith — submission received",
    "Got your submission for " + (entry.chapter || "your course") + (entry.unit ? " (" + entry.unit + ")" : "") + ". We'll take it from here — you'll get another email once feedback is written.");
}

// Notifies every teacher who should hear about this submission — each
// TEACHERS entry in js/data.js can optionally have a `courses` array
// (e.g. ["ap-calculus-bc", "ap-chemistry"]); a teacher with no
// `courses` field at all gets notified about every submission (the
// default for a single-teacher setup), while a teacher with a
// `courses` list only gets notified when entry.courseId is in it.
// Unlike sendConfirmationEmail_ above (a regex scrape, fine for one
// flat "username"/"email" pair), this needs to read each teacher's
// optional `courses` array, so it properly evaluates the TEACHERS
// array via the same bracket-depth scan zenith-data-writer.gs uses
// for STUDENTS — copied here rather than shared, since this is a
// separate Apps Script project with no shared-library setup.
function notifyTeachers_(owner, repo, token, entry) {
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/js/data.js?ref=main";
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };
  var resp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Could not read js/data.js (HTTP " + resp.getResponseCode() + "): " + resp.getContentText());
  }
  var file = JSON.parse(resp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var teachers = readConstArray_(source, "TEACHERS");
  var toNotify = teachers.filter(function (t) {
    if (!t.email) return false;
    if (!t.courses || t.courses.length === 0) return true; // no filter set = notify about everything
    return !!entry.courseId && t.courses.indexOf(entry.courseId) !== -1;
  });
  if (toNotify.length === 0) return;

  var chapterUnit = [entry.chapter, entry.unit].filter(Boolean).join(" · ") || "chapter/unit not recorded";
  var subject = "Zenith — new submission (" + (entry.username || "unknown student") + ", " + chapterUnit + ")";
  var body =
    (entry.username || "A student") + " just submitted " + chapterUnit +
    (entry.courseId ? " for " + entry.courseId : "") + ".\n\n" +
    "Review it on the Teacher Dashboard's grading queue.";

  toNotify.forEach(function (t) { MailApp.sendEmail(t.email, subject, body); });
}

// Finds `const <constName> = [ ... ]` in raw source text and returns
// the exact character span of the array literal (including its own
// brackets) — same bracket-depth scanner as
// automation/zenith-data-writer.gs's findConstArraySpan_, copied here
// for the same "separate Apps Script project" reason as
// notifyTeachers_ above.
function findConstArraySpan_(source, constName) {
  var marker = "const " + constName + " = [";
  var markerStart = source.indexOf(marker);
  if (markerStart === -1) throw new Error("Could not find \"" + marker + "\" in the file");

  var literalStart = markerStart + marker.length - 1;
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
      if (depth === 0) { i++; break; }
    }
  }

  if (depth !== 0) throw new Error("Could not find the matching closing bracket for " + constName);
  return { literalStart: literalStart, literalEnd: i };
}

function readConstArray_(source, constName) {
  var span = findConstArraySpan_(source, constName);
  var literalText = source.slice(span.literalStart, span.literalEnd);
  return eval("(" + literalText + ")");
}

// Fetches the current log file from GitHub, appends the new entry,
// and commits it back to GITHUB_BRANCH (main, by default and in
// practice — see the setup comment at the top). Retries a couple of
// times on a 409 — the file changed between the read and the write,
// which can happen if two submissions land close together.
function commitNewEntry_(owner, repo, branch, path, token, entry, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var current = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString());
  current.push(entry);

  var newContent = Utilities.base64Encode(JSON.stringify(current, null, 2), Utilities.Charset.UTF_8);
  var putResp = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
    {
      method: "put",
      headers: headers,
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: "Log submission " + entry.id + " (auto)",
        content: newContent,
        sha: file.sha,
        branch: branch
      })
    }
  );

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitNewEntry_(owner, repo, branch, path, token, entry, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}
