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

    // ── Auto-send confirmation email to poster ────────────────
    if (data.email) {
      try { sendConfirmationEmail(data); } catch (emailErr) {
        Logger.log("Confirmation email error: " + emailErr);
      }
    }

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Bulletin board post error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}


// ── sendConfirmationEmail ────────────────────────────────────
// Sends an HTML confirmation email to the bulletin board poster.
function sendConfirmationEmail(data) {
  var to = data.email;
  if (!to) return;

  var posterName = data.name     || "Neighbor";
  var postTitle  = data.title    || "Your Post";
  var category   = data.category || "General";

  var subject = "\u{1F4CB} Post Received \u2014 Pendleton Plantation";

  var htmlBody =
    '<!DOCTYPE html>' +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Post Received</title></head>' +
    '<body style="margin:0;padding:0;background:#f0ece3;font-family:Georgia,serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ece3;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#faf8f4;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">' +

    // Header
    '<tr><td style="background:#2c3d2e;padding:40px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:1.1rem;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:10px;">\u2746 &nbsp; Pendleton Plantation &nbsp; \u2746</div>' +
      '<div style="font-size:3.2rem;margin:12px 0;">\u{1F4CB}</div>' +
      '<h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:1.75rem;font-weight:400;margin:8px 0 0;letter-spacing:0.03em;">Post <em>Received</em></h1>' +
      '<div style="width:60px;height:2px;background:#c9a84c;margin:16px auto 0;"></div>' +
    '</td></tr>' +

    // Greeting
    '<tr><td style="padding:40px 48px 8px;">' +
      '<p style="font-size:1.05rem;color:#2c3d2e;margin:0 0 16px;">Dear <strong>' + posterName + '</strong>,</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Thank you for contributing to our community! Your post has been received and is awaiting review by the HOA before going live on the <a href="https://pendletonplantation.com/bulletin-board.html" style="color:#2c3d2e;">Community Bulletin Board</a>.' +
      '</p>' +
    '</td></tr>' +

    // Summary card
    '<tr><td style="padding:8px 48px 8px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-left:4px solid #c9a84c;border-radius:0 4px 4px 0;padding:20px 24px;">' +
        '<tr><td>' +
          '<div style="font-size:0.72rem;color:#7a6a50;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Post Summary</div>' +
          '<table cellpadding="0" cellspacing="0" border="0">' +
            '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Title</td>' +
                '<td style="color:#2c3d2e;font-size:0.95rem;font-weight:bold;padding:3px 0;">' + postTitle + '</td></tr>' +
            '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Category</td>' +
                '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + category + '</td></tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0;">' +
        'Once approved, your post will be visible to all Pendleton Plantation neighbors. We typically review posts within 1\u20132 business days.' +
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
