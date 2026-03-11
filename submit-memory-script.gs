// ============================================================
//  File:        submit-memory-script.gs
//  Purpose:     Google Apps Script backend for the Submit a
//               Memory photo-upload page (submit-memory.html).
//
//  How to use:
//    1. Create a new Google Sheet (or use any existing one).
//    2. Go to Extensions → Apps Script.
//    3. Paste this entire file into the editor.
//    4. Click "Deploy" → "New deployment" → "Web app".
//    5. Set "Execute as" = Me, "Who has access" = Anyone.
//    6. Copy the Web App URL and paste it into submit-memory.html
//       as the value of SCRIPT_URL.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";
var SHEET_NAME         = "Memory Submissions";

// Google Spreadsheet ID — update this if you want submissions
// saved to a different sheet than the nominations sheet.
var SPREADSHEET_ID     = "17SlocYPigWSV3PL1e8d93WSTkz-Tzb01NeQQ9eIRKCs";

// Google Drive folder where photos are saved.
var DRIVE_FOLDER_ID    = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";

var HEADERS = [
  "Timestamp",
  "Uploader Name",
  "Email",
  "Event Name",
  "Caption / Message",
  "Photo URLs",
];


// ── doPost ───────────────────────────────────────────────────
// Receives JSON from submit-memory.html with these keys:
//   uploader_name, email, event_name, caption,
//   photos: [{ name, mimeType, base64 }, …]
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);

    // ── Upload photos to Drive ───────────────────────────
    var photoUrls = [];
    var folder    = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    if (data.photos && data.photos.length > 0) {
      // Create a sub-folder named after the event so photos stay organised.
      var eventLabel   = (data.event_name || "Memory").replace(/[\/\\:*?"<>|]/g, "-");
      var subFolder;
      var existing = folder.getFoldersByName(eventLabel);
      subFolder = existing.hasNext() ? existing.next() : folder.createFolder(eventLabel);

      data.photos.forEach(function (photo) {
        try {
          var decoded = Utilities.base64Decode(photo.base64);
          var blob    = Utilities.newBlob(decoded, photo.mimeType, photo.name);
          var file    = subFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls.push(file.getUrl());
        } catch (photoErr) {
          Logger.log("Photo upload error: " + photoErr);
        }
      });
    }

    // ── Get or create the Memory Submissions sheet ───────
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
           .setFontWeight("bold")
           .setBackground("#5a7a5a")
           .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // ── Append the row ───────────────────────────────────
    sheet.appendRow([
      new Date(),
      data.uploader_name || "",
      data.email         || "",
      data.event_name    || "",
      data.caption       || "",
      photoUrls.length ? photoUrls.join("\n") : "No photos",
    ]);

    // ── Notify organizer ─────────────────────────────────
    var subject =
      "📸 New Memory Submission: " + (data.event_name || "Neighborhood Event") +
      " from " + (data.uploader_name || "a neighbor");

    var body =
      "A neighbor has submitted photos for the Memories gallery!\n\n" +
      "══ SUBMITTED BY ════════════════════════\n" +
      "Name:  " + (data.uploader_name || "—") + "\n" +
      "Email: " + (data.email         || "—") + "\n\n" +
      "══ EVENT ═══════════════════════════════\n" +
      (data.event_name || "—") + "\n\n" +
      "══ CAPTION / MESSAGE ════════════════════\n" +
      (data.caption || "(none)") + "\n\n" +
      "══ PHOTOS ═══════════════════════════════\n" +
      (photoUrls.length
        ? photoUrls.map(function (u, i) { return "Photo " + (i + 1) + ": " + u; }).join("\n")
        : "No photos uploaded") +
      "\n\n" +
      "View all submissions:\n" +
      "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID;

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true }));

  } catch (err) {
    Logger.log("Memory submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}
