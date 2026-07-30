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
 * This file is a reference copy for version history — the version
 * that actually runs lives inside the Apps Script editor (step 2
 * below), not here. Copy it in by hand; nothing auto-syncs.
 *
 * ---------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------
 * 1. On GitHub, create a branch called "submissions-log" off main
 *    (once — this script only ever commits to that branch, never to
 *    main, so a bad run can never touch the live site). Make sure
 *    data/submissions-log.json exists on that branch (this repo
 *    already has one, seeded as an empty array).
 *
 * 2. Open the Google Form -> the three-dot menu (top right) ->
 *    "Script editor" (or, from the linked response Sheet:
 *    Extensions -> Apps Script). Paste this whole file in, replacing
 *    whatever is in Code.gs.
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
 *      GITHUB_BRANCH  submissions-log
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
 *    has a file-upload question, to test OCR too) and check the
 *    submissions-log branch on GitHub for a new entry.
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
 */

function onFormSubmit(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("GITHUB_TOKEN");
    var owner = props.getProperty("GITHUB_OWNER");
    var repo = props.getProperty("GITHUB_REPO");
    var branch = props.getProperty("GITHUB_BRANCH") || "submissions-log";
    var path = props.getProperty("LOG_PATH") || "data/submissions-log.json";

    if (!token || !owner || !repo) {
      throw new Error("Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO script property — see setup steps at the top of this file.");
    }

    var entry = buildEntryFromResponse_(e.response);
    commitNewEntry_(owner, repo, branch, path, token, entry);
  } catch (err) {
    // A silently-failed trigger is worse than a noisy one — email
    // whoever owns this script so a missed submission doesn't go
    // unnoticed.
    MailApp.sendEmail(Session.getActiveUser().getEmail(),
      "Zenith submission compiler failed",
      "A form submission could not be logged:\n\n" + err);
  }
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
