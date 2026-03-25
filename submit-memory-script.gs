// ============================================================
//  File:        submit-memory-script.gs
//  Purpose:     Google Apps Script backend for the Submit a
//               Memory photo-upload page (submit-memory.html).
//
//  Role (post-Supabase migration):
//    • Upload supporting photos to Google Drive (in a sub-folder
//      named after the event so they stay organised).
//    • Return the Drive share URLs in the response.
//    • Send a notification email to the organizer.
//    • Data is now stored in Supabase (memories table) by the
//      browser client — this script no longer writes to any sheet.
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in any sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into submit-memory.html as SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// Notification email — receives a copy of every memory submission.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// Google Drive folder where photos are saved.
// Folder URL: https://drive.google.com/drive/folders/1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt
var DRIVE_FOLDER_ID = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";


// ── doPost ───────────────────────────────────────────────────
// Receives JSON from submit-memory.html with these keys:
//   uploader_name, email, event_name, caption,
//   photos: [{ name, mimeType, base64 }, …]
//
// Returns: { success: true, photoUrls: [...] }
//       or { success: false, error: "..." }
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data   = JSON.parse(e.postData.contents);
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    // ── Upload photos to Drive ───────────────────────────────
    // Photos go into a sub-folder named after the event so they
    // stay organised and are easy to find in Drive.
    var photoUrls = [];

    if (data.photos && data.photos.length > 0) {
      var eventLabel = (data.event_name || "Memory").replace(/[\/\\:*?"<>|]/g, "-");
      var existing   = folder.getFoldersByName(eventLabel);
      var subFolder  = existing.hasNext() ? existing.next() : folder.createFolder(eventLabel);

      data.photos.forEach(function (photo) {
        try {
          var decoded = Utilities.base64Decode(photo.base64);
          var blob    = Utilities.newBlob(decoded, photo.mimeType, photo.name);
          var file    = subFolder.createFile(blob);
          // Anyone with the link can view — needed for gallery display.
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls.push(file.getUrl());
        } catch (photoErr) {
          Logger.log("Photo upload error: " + photoErr);
        }
      });
    }

    // ── Send notification email ──────────────────────────────
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
      "══ CAPTION / MESSAGE ═══════════════════\n" +
      (data.caption || "(none)") + "\n\n" +
      "══ PHOTOS ══════════════════════════════\n" +
      (photoUrls.length
        ? photoUrls.map(function (u, i) { return "Photo " + (i + 1) + ": " + u; }).join("\n")
        : "No photos uploaded") +
      "\n\n(Memory record saved to Supabase — view in admin portal.)";

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Memory submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}
