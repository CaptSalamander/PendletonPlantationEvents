// ============================================================
//  File:        nominations-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation Neighbor Nomination form.
//
//  Role (post-Supabase migration):
//    • Upload supporting photos to Google Drive.
//    • Return the Drive share URLs in the response.
//    • Send a notification email to the organizer.
//    • Data is now stored in Supabase (award_nominations +
//      winner_prep tables) by the browser client — this script
//      no longer writes to any Google Sheet.
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in the sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into nominations.html as SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// Notification email — receives a copy of every nomination.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// Google Drive folder where supporting photos are saved.
// Folder URL: https://drive.google.com/drive/folders/1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt
var DRIVE_FOLDER_ID = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";


// ── doPost ───────────────────────────────────────────────────
// Handles every form submission from nominations.html.
// Expects a JSON body (Content-Type: text/plain) with keys:
//   nominator_name, nominator_email, nominator_phone, nominator_address,
//   nominee_name, nominee_address,
//   award_category, custom_award, reasons,
//   photos: [{ name, mimeType, base64 }, …]
//
// Returns: { success: true, photoUrls: [...] }
//       or { success: false, error: "..." }
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);

    // ── Upload photos to Drive, collect share URLs ───────
    var photoUrls = [];
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    if (data.photos && data.photos.length > 0) {
      data.photos.forEach(function(photo) {
        try {
          var decoded = Utilities.base64Decode(photo.base64);
          var blob    = Utilities.newBlob(decoded, photo.mimeType, photo.name);
          var file    = folder.createFile(blob);
          // Anyone with the link can view — needed for admin review
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls.push(file.getUrl());
        } catch (photoErr) {
          // A bad photo should not block the rest of the submission
          Logger.log("Photo upload error for '" + photo.name + "': " + photoErr);
        }
      });
    }

    // ── Send notification email ──────────────────────────
    var awardLabel = data.award_category || "an award";
    if (data.award_category === "Other — Suggest My Own" && data.custom_award) {
      awardLabel = data.custom_award + " (custom suggestion)";
    }

    var subject = "✨ New Nomination: " + awardLabel + " → " + (data.nominee_name || "Unknown");

    var body =
      "A new neighbor nomination has been submitted on the Pendleton Plantation website!\n\n" +
      "══ NOMINATOR ═══════════════════════════\n" +
      "Name:    " + (data.nominator_name    || "—") + "\n" +
      "Phone:   " + (data.nominator_phone   || "—") + "\n" +
      "Email:   " + (data.nominator_email   || "—") + "\n" +
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
        ? photoUrls.map(function(u, i) { return "Photo " + (i + 1) + ": " + u; }).join("\n")
        : "No photos submitted") +
      "\n\n(Nomination record saved to Supabase — view in admin portal.)";

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Nomination submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}
