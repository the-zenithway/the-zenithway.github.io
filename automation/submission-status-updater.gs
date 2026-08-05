/**
 * Zenith — Submission status updater
 * ------------------------------------
 * Standalone Apps Script Web App (NOT bound to the intake Form — this
 * is a separate script/deployment from submissions-compiler.gs) that
 * backs the "Mark complete" button in teacher.html's grading queue.
 * It does exactly one thing: given an existing submission id, flips
 * that entry's "status" field to "Complete" in
 * data/submissions-log.json and commits the change. It cannot create,
 * delete, or otherwise modify an entry, and it cannot set any status
 * value other than "Complete" — kept deliberately narrow because
 * SUBMISSION_STATUS_UPDATE_URL (js/data.js) that points at this
 * endpoint is visible to anyone who views the site's page source, same
 * as everything else in js/data.js (see the NOT SECURE note at the
 * top of that file). A narrow endpoint means the worst case of that
 * exposure is someone marking a real submission complete early, not
 * data loss or arbitrary writes.
 *
 * This file is a reference copy for version history — the version
 * that actually runs lives inside its own Apps Script project (step 2
 * below), not here. Copy it in by hand; nothing auto-syncs.
 *
 * ---------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------
 * 1. script.google.com -> New project. Paste this whole file in,
 *    replacing whatever is in Code.gs. (This is a separate Apps
 *    Script project from submissions-compiler.gs's — that one is
 *    bound to the Form, this one is standalone.)
 *
 * 2. Project Settings (gear icon, left sidebar) -> Script Properties
 *    -> add each of these (same meaning as in submissions-compiler.gs
 *    — a second personal access token scoped the same way is fine, or
 *    reuse the same one if it's still valid):
 *      GITHUB_TOKEN   Fine-grained PAT scoped to ONLY this repo, with
 *                     "Contents: Read and write" permission.
 *      GITHUB_OWNER   the-zenithway
 *      GITHUB_REPO    the-zenithway.github.io
 *      GITHUB_BRANCH  main
 *      LOG_PATH       data/submissions-log.json
 *
 * 3. Deploy -> New deployment -> type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    ("Anyone" sounds alarming, but Apps Script Web Apps don't support
 *    a lighter-weight auth model that a static-site fetch() could use
 *    anyway — this is the same tradeoff submissions-compiler.gs's
 *    Form trigger already accepts. The narrow doPost_ below is what
 *    actually bounds the risk, not deployment access.)
 *    Copy the resulting /exec URL.
 *
 * 4. Paste that URL into SUBMISSION_STATUS_UPDATE_URL in js/data.js
 *    and commit. The "Mark complete" button on teacher.html will
 *    start working as soon as that's live.
 *
 * 5. Click a real "Mark complete" button once and check main on
 *    GitHub for a commit updating that entry's status.
 *
 * ---------------------------------------------------------------
 * WHAT COUNTS AS "DONE" HERE
 * ---------------------------------------------------------------
 * Untested against a real deployment — I can't run Apps Script myself
 * to verify this end-to-end. The GitHub Contents API read/PUT/retry
 * pattern is copied straight from commitNewEntry_ in
 * submissions-compiler.gs, which IS confirmed working (see that
 * file's header) — only the "find and mutate one entry" part here is
 * new. If step 5 throws, send the exact error text.
 */

// The client sends Content-Type: text/plain (not application/json) on
// purpose — Apps Script Web Apps don't implement doOptions, so a
// preflighted request (which application/json triggers) fails before
// it ever reaches doPost. text/plain is CORS-safelisted, so the
// browser sends the POST directly; e.postData.contents is still
// parsed as JSON here regardless of the declared content type.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var id = body.id;
    if (!id || typeof id !== "string") {
      return jsonResponse_({ ok: false, error: "Missing or invalid id" });
    }

    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("GITHUB_TOKEN");
    var owner = props.getProperty("GITHUB_OWNER");
    var repo = props.getProperty("GITHUB_REPO");
    var branch = props.getProperty("GITHUB_BRANCH") || "main";
    var path = props.getProperty("LOG_PATH") || "data/submissions-log.json";

    if (!token || !owner || !repo) {
      throw new Error("Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO script property — see setup steps at the top of this file.");
    }

    markComplete_(owner, repo, branch, path, token, id);
    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Reads the current log, finds the entry with this id, sets its
// status to "Complete" (only "Complete" — this function has no other
// value it can write), and commits back to GITHUB_BRANCH. Retries a
// couple of times on a 409, same as commitNewEntry_ in
// submissions-compiler.gs, since a real Form submission could land in
// the same window as a teacher clicking "Mark complete".
function markComplete_(owner, repo, branch, path, token, id, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var current = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString());

  var entry = current.find(function (e) { return e.id === id; });
  if (!entry) throw new Error("No submission with id " + id + " found in " + path);
  entry.status = "Complete";

  var newContent = Utilities.base64Encode(JSON.stringify(current, null, 2), Utilities.Charset.UTF_8);
  var putResp = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
    {
      method: "put",
      headers: headers,
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: "Mark submission " + id + " complete (teacher dashboard)",
        content: newContent,
        sha: file.sha,
        branch: branch
      })
    }
  );

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    markComplete_(owner, repo, branch, path, token, id, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}
