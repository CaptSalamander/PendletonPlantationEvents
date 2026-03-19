// ============================================================
//  File:        nominations-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation Neighbor Nomination form.
//
//  How to use:
//    1. Open the Google Sheet linked below.
//    2. Go to Extensions → Apps Script.
//    3. Paste this entire file into the editor, replacing any
//       existing code.
//    4. Click "Deploy" → "New deployment" → "Web app".
//    5. Set "Execute as" = Me, "Who has access" = Anyone.
//    6. Copy the Web App URL and paste it into nominations.html
//       as the value of SCRIPT_URL (inside the <script> block).
//    7. Every time you change this script, click
//       "Deploy" → "Manage deployments" → edit → "New version"
//       to push the update live.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// ✏️  Your notification email — you'll get one every time a
//     nomination is submitted.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// The name of the sheet tab where nominations are stored.
// The script creates this tab automatically on first run.
var SHEET_NAME = "Nominations";

// The name of the sheet tab used to stage winner data.
// Each nomination row here matches the Winners sheet column layout
// so you can copy a row straight to Winners when choosing a winner.
var WINNER_PREP_SHEET_NAME = "Winner Prep";

// The Google Spreadsheet ID (from the URL of the sheet).
var SPREADSHEET_ID = "17SlocYPigWSV3PL1e8d93WSTkz-Tzb01NeQQ9eIRKCs";

// The Google Drive folder ID where submitted photos are saved.
// Taken from the folder URL:
//   https://drive.google.com/drive/folders/1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt
var DRIVE_FOLDER_ID = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";

// Column headers for the nominations sheet.
// Must stay in sync with the appendRow() call below.
var HEADERS = [
  "Timestamp",
  "Nominator Name",
  "Nominator Phone",
  "Nominator Email",
  "Nominator Address",
  "Nominee Name",
  "Nominee Address",
  "Award Category",
  "Custom Award Suggestion",
  "Reasons for Nomination",
  "Photo URLs",
];

// Column headers for the Winner Prep sheet.
// Mirrors the Winners sheet exactly (icon through quote3) plus
// two admin-only columns at the end.
var WINNER_PREP_HEADERS = [
  "icon",
  "badge",
  "bannerColor",
  "award",
  "period",
  "year",
  "winner",
  "photoId",
  "prize",
  "blurb",
  "quote1",
  "quote2",
  "quote3",
  "— Nomination Timestamp —",
  "— Nominator —",
  "— Full Reasons Text —",
];


// ── doPost ───────────────────────────────────────────────────
// Handles every form submission from nominations.html.
// Expects a JSON body (Content-Type: text/plain) with these keys:
//   nominator_name, phone, email, nominator_address,
//   nominee_name, nominee_address,
//   award_category, custom_award, reasons,
//   photos: [{ name, mimeType, base64 }, …]
//
// Steps:
//   1. Parse the JSON body.
//   2. Decode and upload each photo to Drive; collect share URLs.
//   3. Append one row to the Nominations sheet (create it if new).
//   4. Send a notification email to the organizer.
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // ── Parse incoming JSON ──────────────────────────────
    var data = JSON.parse(e.postData.contents);

    // ── Upload photos to Drive ───────────────────────────
    var photoUrls = [];
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    if (data.photos && data.photos.length > 0) {
      data.photos.forEach(function (photo) {
        try {
          // Decode the base64 string and create a Drive file.
          var decoded = Utilities.base64Decode(photo.base64);
          var blob    = Utilities.newBlob(decoded, photo.mimeType, photo.name);
          var file    = folder.createFile(blob);

          // Make the file viewable by anyone with the link so it
          // can be shared with the board / in the notification email.
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls.push(file.getUrl());
        } catch (photoErr) {
          // A bad photo should not block the whole submission.
          Logger.log("Photo upload error for '" + photo.name + "': " + photoErr);
        }
      });
    }

    // ── Get or create the Nominations sheet ─────────────
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      // First submission ever — create the tab and write headers.
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
           .setFontWeight("bold")
           .setBackground("#2d5016")
           .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // ── Append the nomination row ────────────────────────
    sheet.appendRow([
      new Date(),                                              // Timestamp
      data.nominator_name   || "",                            // Nominator Name
      data.phone            || "",                            // Nominator Phone
      data.email            || "",                            // Nominator Email
      data.nominator_address || "",                           // Nominator Address
      data.nominee_name     || "",                            // Nominee Name
      data.nominee_address  || "",                            // Nominee Address
      data.award_category   || "",                            // Award Category
      data.custom_award     || "",                            // Custom Award Suggestion
      data.reasons          || "",                            // Reasons
      photoUrls.length ? photoUrls.join("\n") : "No photos", // Photo URLs
    ]);

    // ── Write to Winner Prep sheet ───────────────────────
    appendToWinnerPrep(ss, data, new Date());

    // ── Send notification email to the organizer ─────────
    var awardLabel = data.award_category || "an award";
    if (data.award_category === "Other — Suggest My Own" && data.custom_award) {
      awardLabel = data.custom_award + " (custom suggestion)";
    }

    var subject = "✨ New Nomination: " + awardLabel + " → " + (data.nominee_name || "Unknown");

    var body =
      "A new neighbor nomination has been submitted on the Pendleton Plantation website!\n\n" +
      "══ NOMINATOR ═══════════════════════════\n" +
      "Name:    " + (data.nominator_name    || "—") + "\n" +
      "Phone:   " + (data.phone             || "—") + "\n" +
      "Email:   " + (data.email             || "—") + "\n" +
      "Address: " + (data.nominator_address || "—") + "\n\n" +
      "══ NOMINEE ═════════════════════════════\n" +
      "Name:    " + (data.nominee_name    || "—") + "\n" +
      "Address: " + (data.nominee_address || "—") + "\n\n" +
      "══ AWARD ═══════════════════════════════\n" +
      "Category: " + (data.award_category || "—") + "\n" +
      (data.custom_award ? "Custom Suggestion: " + data.custom_award + "\n" : "") +
      "\n══ REASONS ═════════════════════════════\n" +
      (data.reasons || "—") + "\n\n" +
      "══ PHOTOS ══════════════════════════════\n" +
      (photoUrls.length
        ? photoUrls.map(function (u, i) { return "Photo " + (i + 1) + ": " + u; }).join("\n")
        : "No photos submitted") +
      "\n\n" +
      "View all nominations in the spreadsheet:\n" +
      "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID;

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true }));

  } catch (err) {
    Logger.log("Nomination submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}


// ── appendToWinnerPrep ───────────────────────────────────────
// Creates (or appends to) the "Winner Prep" sheet.
// Splits the reasons text into a blurb and up to three quotes
// so the row is ready to copy straight into the Winners sheet.
function appendToWinnerPrep(ss, data, timestamp) {
  try {
    var sheet = ss.getSheetByName(WINNER_PREP_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(WINNER_PREP_SHEET_NAME);
      sheet.appendRow(WINNER_PREP_HEADERS);

      var headerRange = sheet.getRange(1, 1, 1, WINNER_PREP_HEADERS.length);
      headerRange.setFontWeight("bold")
                 .setBackground("#1a4a6e")
                 .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      // Highlight the admin-only columns differently
      var adminStart = WINNER_PREP_HEADERS.indexOf("— Nomination Timestamp —") + 1;
      sheet.getRange(1, adminStart, 1, 3)
           .setBackground("#3a3a3a")
           .setFontColor("#cccccc");

      // Set column widths for readability
      sheet.setColumnWidth(10, 400);  // blurb
      sheet.setColumnWidth(11, 300);  // quote1
      sheet.setColumnWidth(12, 300);  // quote2
      sheet.setColumnWidth(13, 300);  // quote3
      sheet.setColumnWidth(16, 500);  // full reasons
    }

    var parts = splitReasonsText(data.reasons || "");
    var awardCategory = data.award_category || "";
    if (awardCategory === "Other — Suggest My Own" && data.custom_award) {
      awardCategory = data.custom_award;
    }

    sheet.appendRow([
      "",                                  // icon       — fill in
      "",                                  // badge      — fill in (filename only)
      "",                                  // bannerColor — fill in
      awardCategory,                       // award
      "",                                  // period     — fill in when announcing
      "",                                  // year       — fill in when announcing
      data.nominee_name  || "",            // winner
      "",                                  // photoId    — fill in when uploading winner photo
      "",                                  // prize      — fill in
      parts.blurb,                         // blurb      — auto-extracted
      parts.quote1,                        // quote1     — auto-extracted
      parts.quote2,                        // quote2     — auto-extracted
      parts.quote3,                        // quote3     — auto-extracted
      timestamp,                           // nomination timestamp
      data.nominator_name || "",           // who nominated them
      data.reasons        || "",           // full original text
    ]);

    // Highlight the new row lightly so new entries stand out
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 1, 1, 13)
         .setBackground("#f0f7ff");

  } catch (err) {
    Logger.log("Winner Prep sheet error: " + err);
  }
}


// ── splitReasonsText ─────────────────────────────────────────
// Splits a free-form nomination reasons string into:
//   blurb  — first 1–2 sentences, trimmed to ~350 chars
//   quote1 — 3rd sentence (or empty)
//   quote2 — 4th sentence (or empty)
//   quote3 — 5th sentence (or empty)
//
// The blurb is meant to be a polished write-up; the quotes are
// the most vivid individual sentences from the submission.
function splitReasonsText(text) {
  var trimmed = text.trim();
  if (!trimmed) return { blurb: "", quote1: "", quote2: "", quote3: "" };

  // Split into sentences on . ! ? followed by whitespace or end-of-string.
  // Keep the punctuation attached to each sentence.
  var sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 0; });

  if (sentences.length === 0) {
    return { blurb: trimmed, quote1: "", quote2: "", quote3: "" };
  }

  // Blurb = first 1 or 2 sentences, capped at ~350 characters.
  var blurb = sentences[0];
  if (sentences.length > 1 && (blurb + " " + sentences[1]).length <= 350) {
    blurb = blurb + " " + sentences[1];
  }

  // For quotes, pick the 3 most vivid remaining sentences
  // (longest = most detail, which tends to be most quote-worthy).
  var remaining = sentences.slice(blurb === sentences[0] ? 1 : 2);
  remaining.sort(function(a, b) { return b.length - a.length; });

  return {
    blurb:  blurb,
    quote1: remaining[0] || "",
    quote2: remaining[1] || "",
    quote3: remaining[2] || "",
  };
}
