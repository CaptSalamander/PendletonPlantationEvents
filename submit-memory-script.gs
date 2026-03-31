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
    var data        = JSON.parse(e.postData.contents);
    var notifyEmail = data.organizerEmail || NOTIFICATION_EMAIL;
    var folder      = DriveApp.getFolderById(DRIVE_FOLDER_ID);

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

    MailApp.sendEmail(notifyEmail, subject, body);

    // ── Auto-send confirmation email to uploader ─────────────
    if (data.email) {
      try { sendConfirmationEmail(data, photoUrls.length); } catch (emailErr) {
        Logger.log("Confirmation email error: " + emailErr);
      }
    }

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Memory submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}


// ── sendConfirmationEmail ────────────────────────────────────
// Sends an HTML confirmation email to the photo uploader.
function sendConfirmationEmail(data, photoCount) {
  var to = data.email;
  if (!to) return;

  var uploaderName = data.uploader_name || "Neighbor";
  var eventName    = data.event_name    || "a neighborhood event";
  var photoWord    = photoCount === 1 ? "photo" : "photos";
  var photoLabel   = photoCount > 0 ? photoCount + " " + photoWord : "your submission";

  var subject = "\u{1F4F8} Memory Submission Received \u2014 Pendleton Plantation";

  var htmlBody =
    '<!DOCTYPE html>' +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Memory Received</title></head>' +
    '<body style="margin:0;padding:0;background:#f0ece3;font-family:Georgia,serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ece3;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#faf8f4;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">' +

    // Header
    '<tr><td style="background:#2c3d2e;padding:40px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:1.1rem;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:10px;">\u2746 &nbsp; Pendleton Plantation &nbsp; \u2746</div>' +
      '<div style="font-size:3.2rem;margin:12px 0;">\u{1F4F8}</div>' +
      '<h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:1.75rem;font-weight:400;margin:8px 0 0;letter-spacing:0.03em;">Photos <em>Received</em></h1>' +
      '<div style="width:60px;height:2px;background:#c9a84c;margin:16px auto 0;"></div>' +
    '</td></tr>' +

    // Greeting
    '<tr><td style="padding:40px 48px 8px;">' +
      '<p style="font-size:1.05rem;color:#2c3d2e;margin:0 0 16px;">Dear <strong>' + uploaderName + '</strong>,</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Thank you for sharing your memories with the Pendleton Plantation community! We received ' + photoLabel + ' from <strong>' + eventName + '</strong>.' +
      '</p>' +
    '</td></tr>' +

    // Summary card
    '<tr><td style="padding:8px 48px 8px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-left:4px solid #c9a84c;border-radius:0 4px 4px 0;padding:20px 24px;">' +
        '<tr><td>' +
          '<div style="font-size:0.72rem;color:#7a6a50;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Submission Summary</div>' +
          '<table cellpadding="0" cellspacing="0" border="0">' +
            '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Event</td>' +
                '<td style="color:#2c3d2e;font-size:0.95rem;font-weight:bold;padding:3px 0;">' + eventName + '</td></tr>' +
            '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Photos</td>' +
                '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + (photoCount > 0 ? photoCount : "Text submission") + '</td></tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Your photos are currently under review by the HOA. Once approved, they will appear in the <a href="https://pendletonplantation.com/memories.html" style="color:#2c3d2e;">Community Memories</a> gallery for everyone to enjoy.' +
      '</p>' +
    '</td></tr>' +

    // Warm sign-off
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0;">With warm regards,</p>' +
      '<p style="font-family:Georgia,serif;font-size:1.15rem;color:#2c3d2e;font-style:italic;margin:4px 0 0;">The Pendleton Plantation Committee</p>' +
    '</td></tr>' +

    // Divider + Footer
    '<tr><td style="padding:24px 48px 0;"><div style="height:1px;background:rgba(201,168,76,0.25);"></div></td></tr>' +
    '<tr><td style="padding:20px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">\u2746 &nbsp; Pendleton Plantation &nbsp; \u2746</div>' +
      '<p style="font-size:0.78rem;color:#9a8a70;margin:0;">Easley, South Carolina &nbsp;&bull;&nbsp; Community Events Hub</p>' +
      '<p style="font-size:0.75rem;color:#b8a88a;margin:8px 0 0;">Questions? Reply to this email or visit <a href="https://pendletonplantation.com" style="color:#c9a84c;text-decoration:none;">pendletonplantation.com</a></p>' +
    '</td></tr>' +

    '</table></td></tr></table></body></html>';

  MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, name: "Pendleton Plantation" });
}
