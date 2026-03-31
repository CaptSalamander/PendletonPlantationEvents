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
// Handles every form submission from nominations.html AND
// "Mark Received" calls from the admin panel.
//
// Submission (action omitted or "submit"):
//   nominator_name, nominator_email, nominator_phone, nominator_address,
//   nominee_name, nominee_address,
//   award_category, custom_award, reasons,
//   photos: [{ name, mimeType, base64 }, …]
//
// Mark Received (action: "mark_received"):
//   nominator_name, nominator_email, nominee_name, award_category, custom_award
//
// Returns: { success: true, photoUrls: [...] }  (submit)
//          { success: true }                     (mark_received)
//       or { success: false, error: "..." }
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);
    var notifyEmail = data.organizerEmail || NOTIFICATION_EMAIL;

    // ── Mark Received: send confirmation email to nominator ──
    if (data.action === "mark_received") {
      sendReceivedEmail(data);
      output.setContent(JSON.stringify({ success: true }));
      return output;
    }

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

    MailApp.sendEmail(notifyEmail, subject, body);

    // ── Auto-send confirmation email to nominator ────────────
    if (data.nominator_email) {
      try { sendReceivedEmail(data); } catch (emailErr) {
        Logger.log("Confirmation email error: " + emailErr);
      }
    }

    output.setContent(JSON.stringify({ success: true, photoUrls: photoUrls }));

  } catch (err) {
    Logger.log("Nomination submission error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}


// ── sendReceivedEmail ────────────────────────────────────────
// Sends a beautifully formatted HTML confirmation email to the
// nominator letting them know their submission was received.
function sendReceivedEmail(data) {
  var to = data.nominator_email;
  if (!to) throw new Error("No nominator email provided");

  var nominatorName = data.nominator_name || "Neighbor";
  var nomineeName   = data.nominee_name   || "your nominee";
  var award         = data.award_category || "Neighborhood Award";
  if (award === "Other — Suggest My Own" && data.custom_award) {
    award = data.custom_award;
  }

  var subject = "\u2728 Your Nomination Has Been Received \u2014 Pendleton Plantation";

  var htmlBody =
    '<!DOCTYPE html>' +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Nomination Received</title></head>' +
    '<body style="margin:0;padding:0;background:#f0ece3;font-family:Georgia,serif;">' +

    // Outer wrapper
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ece3;padding:32px 16px;">' +
    '<tr><td align="center">' +

    // Card
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#faf8f4;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">' +

    // ── HEADER BANNER ────────────────────────────────────────
    '<tr><td style="background:#2c3d2e;padding:40px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:1.1rem;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:10px;">✦ &nbsp; Pendleton Plantation &nbsp; ✦</div>' +
      '<div style="font-size:3.2rem;margin:12px 0;">🏆</div>' +
      '<h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:1.75rem;font-weight:400;margin:8px 0 0;letter-spacing:0.03em;">Nomination <em>Received</em></h1>' +
      '<div style="width:60px;height:2px;background:#c9a84c;margin:16px auto 0;"></div>' +
    '</td></tr>' +

    // ── GREETING ─────────────────────────────────────────────
    '<tr><td style="padding:40px 48px 8px;">' +
      '<p style="font-size:1.05rem;color:#2c3d2e;margin:0 0 16px;">Dear <strong>' + nominatorName + '</strong>,</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Thank you so much for taking the time to recognize a neighbor! We are delighted to let you know that your nomination has been officially received and is now under review by our community committee.' +
      '</p>' +
    '</td></tr>' +

    // ── NOMINATION SUMMARY CARD ───────────────────────────────
    '<tr><td style="padding:8px 48px 8px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-left:4px solid #c9a84c;border-radius:0 4px 4px 0;padding:20px 24px;">' +
        '<tr><td>' +
          '<div style="font-size:0.72rem;color:#7a6a50;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Nomination Summary</div>' +
          '<table cellpadding="0" cellspacing="0" border="0">' +
            '<tr>' +
              '<td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">Nominee</td>' +
              '<td style="color:#2c3d2e;font-size:0.95rem;font-weight:bold;padding:3px 0;">' + nomineeName + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">Award</td>' +
              '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + award + '</td>' +
            '</tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // ── BODY COPY ─────────────────────────────────────────────
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Our committee will carefully consider all nominations as part of our award deliberation process. You\'ll hear from us when a decision has been made.' +
      '</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0;">' +
        'It is neighbors like you who make Pendleton Plantation such a wonderful community. We truly appreciate your thoughtfulness in celebrating the people who make our neighborhood special.' +
      '</p>' +
    '</td></tr>' +

    // ── WARM SIGN-OFF ─────────────────────────────────────────
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0;">With warm regards,</p>' +
      '<p style="font-family:Georgia,serif;font-size:1.15rem;color:#2c3d2e;font-style:italic;margin:4px 0 0;">The Pendleton Plantation Committee</p>' +
    '</td></tr>' +

    // ── DIVIDER ───────────────────────────────────────────────
    '<tr><td style="padding:24px 48px 0;">' +
      '<div style="height:1px;background:rgba(201,168,76,0.25);"></div>' +
    '</td></tr>' +

    // ── FOOTER ────────────────────────────────────────────────
    '<tr><td style="padding:20px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">✦ &nbsp; Pendleton Plantation &nbsp; ✦</div>' +
      '<p style="font-size:0.78rem;color:#9a8a70;margin:0;">Easley, South Carolina &nbsp;&bull;&nbsp; Community Events Hub</p>' +
      '<p style="font-size:0.75rem;color:#b8a88a;margin:8px 0 0;">Questions? Reply to this email or visit <a href="https://pendletonplantation.com" style="color:#c9a84c;text-decoration:none;">pendletonplantation.com</a></p>' +
    '</td></tr>' +

    '</table>' + // end card
    '</td></tr>' +
    '</table>' + // end outer wrapper
    '</body></html>';

  MailApp.sendEmail({
    to:       to,
    subject:  subject,
    htmlBody: htmlBody,
    name:     "Pendleton Plantation"
  });
}
