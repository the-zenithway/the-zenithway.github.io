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
 *    The Form needs these questions, titled exactly (no branching
 *    required — a flat form, since students just enter their own
 *    username directly instead of picking a name off a roster):
 *      "Course"                    dropdown, e.g. "AP Calculus BC" /
 *                                   "AP Biology" — must match COURSE_IDS
 *                                   below exactly
 *      "Username"                  short answer — the student's exact
 *                                   Zenith username (a dropdown is
 *                                   safer than free text if you want to
 *                                   rule out typos, but isn't required)
 *      "Chapter"                   short answer or dropdown, e.g. "5"
 *                                   (normalized to "Chapter 5" below)
 *      "Unit(for Chapters 1~12)"   the roadmap category letter, e.g.
 *                                   "B"/"C"/"T"/"R"/"S"
 *      "Feedback & Remarks"        short/long answer, optional
 *      a file-upload question      any title — detected by type, OCR'd
 *                                   automatically
 *    "Course" is resolved to a courseId via COURSE_IDS below — update
 *    that map by hand whenever a course is added or renamed.
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
      sendConfirmationEmail_(owner, repo, branch, token, entry);
    } catch (mailErr) {
      MailApp.sendEmail(Session.getActiveUser().getEmail(),
        "Zenith submission confirmation email failed (submission itself was logged fine)",
        "Submission " + entry.id + " for username \"" + entry.username + "\" was logged, but the confirmation email to the student could not be sent:\n\n" + mailErr);
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

// Maps the Form's "Course" dropdown answer to the exact course id used
// in js/data.js. Update by hand whenever a course is added, renamed,
// or its dropdown label changes.
var COURSE_IDS = {
  "AP Calculus BC": "ap-calculus-bc",
  "AP Biology": "ap-biology"
};

// "Chapter" comes in as a bare number ("5") — normalize it to match
// the "Chapter 5" format used in js/data.js's roadmap items. Leaves
// already-prefixed or unrecognized values alone.
function normalizeChapter_(raw) {
  if (!raw) return null;
  raw = String(raw).trim();
  return /^chapter\b/i.test(raw) ? raw : "Chapter " + raw;
}

// Reads every question/answer pair generically — nothing here is
// hardcoded to specific question titles, so it keeps working if the
// form's questions change. Any file-upload answer gets OCR'd via
// Drive and its text folded in alongside the raw answers.
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
        var text = ocrDriveFile_(fileId);
        if (text) ocrText += (ocrText ? "\n\n---\n\n" : "") + text;
      });
    } else {
      answers[title] = itemResponse.getResponse();
    }
  });

  return {
    id: "sub_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
    receivedAt: new Date().toISOString(),
    status: "pending",
    courseId: COURSE_IDS[answers["Course"]] || null,
    username: answers["Username"] ? String(answers["Username"]).trim() : null,
    chapter: normalizeChapter_(answers["Chapter"]),
    unit: answers["Unit(for Chapters 1~12)"] || null,
    answers: answers,
    ocrText: ocrText || null,
    formResponseId: response.getId()
  };
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
// email -> portal (true as of when this was written); if that ever changes,
// update the regex below to match.
function sendConfirmationEmail_(owner, repo, branch, token, entry) {
  if (!entry.username) return;

  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/js/data.js?ref=" + branch;
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

// Fetches the current log file from GitHub, appends the new entry,
// and commits it back to GITHUB_BRANCH (never main). Retries a couple
// of times on a 409 — the file changed between the read and the
// write, which can happen if two submissions land close together.
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
