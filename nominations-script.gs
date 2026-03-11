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
