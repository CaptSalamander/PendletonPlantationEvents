// ============================================================
//  File:        bulletin-board-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation Community Bulletin Board.
//
//  Role (post-Supabase migration):
//    • Upload supporting photos to Google Drive (in a category
//      sub-folder so they stay organised).
//    • Return the Drive share URLs in the response.
//    • Send a notification email to the organizer.
//    • Data is now stored in Supabase (bulletin_posts table) by
//      the browser client — this script no longer writes to any
//      Google Sheet.
//    • Approval is now done in the admin portal (admin.html) via
//      Supabase, not via a one-click email link.
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in any sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into post-to-board.html as SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// Notification email — receives a copy of every post submission.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// Google Drive folder where photos are saved.
// Folder URL: https://drive.google.com/drive/folders/1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt
var DRIVE_FOLDER_ID = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";


// ── doPost ───────────────────────────────────────────────────
// Receives JSON from post-to-board.html with keys:
//   name, email, phone, address, category, title, content,
//   show_phone, show_email,
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
    // Photos go into a sub-folder named after the category so
    // they stay organised and are easy to find in Drive.
    var photoUrls = [];

    if (data.photos && data.photos.length > 0) {
      var catLabel = (data.category || "General").replace(/[\/\\:*?"<>|]/g, "-");
      var folderName = "Bulletin Board - " + catLabel;
      var existing   = folder.getFoldersByName(folderName);
      var subFolder  = existing.hasNext() ? existing.next() : folder.createFolder(folderName);

      data.photos.forEach(function (photo) {
        try {
          var decoded = Utilities.base64Decode(photo.base64);
          var blob    = Utilities.newBlob(decoded, photo.mimeType, photo.name);
          var file    = subFolder.createFile(blob);
          // Anyone with the link can view — needed for public gallery.
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls.push(file.getUrl());
        } catch (photoErr) {
          Logger.log("Photo upload error: " + photoErr);
        }
      });
    }

    // ── Send notification email ──────────────────────────────
    var subject =
      "📋 New Bulletin Board Post: [" + (data.category || "General") + "] " +
      (data.title || "Untitled") + " — from " + (data.name || "a neighbor");

    var body =
      "A neighbor has submitted a post to the Community Bulletin Board.\n\n" +
      "══ POSTED BY ════════════════════════\n" +
      "Name:    " + (data.name    || "—") + "\n" +
      "Email:   " + (data.email   || "—") + "\n" +
      "Phone:   " + (data.phone   || "—") + "\n" +
      "Address: " + (data.address || "—") + "\n\n" +
      "══ POST DETAILS ══════════════════════\n" +
      "Category: " + (data.category || "—") + "\n" +
      "Title:    " + (data.title    || "—") + "\n\n" +
      (data.content || "(no content)") + "\n\n" +
      "══ PHOTOS ════════════════════════════\n" +
      (photoUrls.length
        ? photoUrls.map(function (u, i) { return "Photo " + (i + 1) + ": " + u; }).join("\n")
        : "No photos uploaded") +
      "\n\n(Post record saved to Supabase — approve in admin portal.)";

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Bulletin board post error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}
