// ============================================================
//  File:        signup-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation event sign-up form (signup.html).
//
//  Role:
//    • Receives a fire-and-forget POST from signup.html after a
//      successful Supabase insert.
//    • Sends an admin notification email to the organizer.
//    • Sends a confirmation email to the registrant.
//
//  Payload (URL-encoded form data, action = "signupNotify"):
//    action, first_name, last_name, email, event, attending,
//    adults, children, roles, potluck, other_donation,
//    cash_donation, notes
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in any sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into signup.html as EMAIL_SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// Notification email — receives a copy of every sign-up.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";


// ── doPost ───────────────────────────────────────────────────
// Handles fire-and-forget sign-up notification calls.
// signup.html sends URL-encoded form data with mode: "no-cors"
// so no response is expected — but we return JSON anyway.
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var p = e.parameter;  // URL-encoded params

    if (p.action !== "signupNotify") {
      output.setContent(JSON.stringify({ success: false, error: "Unknown action" }));
      return output;
    }

    var notifyEmail = p.organizerEmail || NOTIFICATION_EMAIL;

    var firstName = p.first_name || "";
    var lastName  = p.last_name  || "";
    var fullName  = (firstName + " " + lastName).trim() || "A Neighbor";
    var email     = p.email  || "";
    var eventName = p.event  || "the upcoming event";

    // ── Send admin notification ──────────────────────────────
    var subject = "\u{1F389} New Sign-Up: " + fullName + " \u2014 " + eventName;
    var body =
      "A new neighbor has signed up!\n\n" +
      "══ REGISTRANT ══════════════════════════\n" +
      "Name:     " + fullName  + "\n" +
      "Email:    " + email     + "\n" +
      "Event:    " + eventName + "\n" +
      (p.attending ? "Attending: " + p.attending + "\n" : "") +
      (p.adults    ? "Adults:    " + p.adults    + "\n" : "") +
      (p.children  ? "Children:  " + p.children  + "\n" : "") +
      (p.roles     ? "Roles:     " + p.roles     + "\n" : "") +
      (p.potluck   ? "Potluck:   " + p.potluck   + "\n" : "") +
      (p.notes     ? "Notes:     " + p.notes     + "\n" : "") +
      "\n(Sign-up record saved to Supabase — view in admin portal.)";

    MailApp.sendEmail(notifyEmail, subject, body);

    // ── Send confirmation email to registrant ────────────────
    if (email) {
      try { sendConfirmationEmail(p, fullName, eventName); } catch (emailErr) {
        Logger.log("Confirmation email error: " + emailErr);
      }
    }

    output.setContent(JSON.stringify({ success: true }));

  } catch (err) {
    Logger.log("Sign-up notification error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}


// ── sendConfirmationEmail ────────────────────────────────────
// Sends a beautiful HTML confirmation email to the registrant.
function sendConfirmationEmail(p, fullName, eventName) {
  var to = p.email;
  if (!to) return;

  var attending  = (p.attending || "").toLowerCase().startsWith("yes");
  var roles      = p.roles    ? p.roles    : "";
  var potluck    = p.potluck  ? p.potluck  : "";
  var adults     = p.adults   ? p.adults   : "";
  var children   = p.children ? p.children : "";

  var subject = "\u{1F389} You\u2019re signed up! \u2014 " + eventName;

  // Build summary rows only for non-empty fields
  var rows = "";
  rows += '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">Event</td>' +
          '<td style="color:#2c3d2e;font-size:0.95rem;font-weight:bold;padding:3px 0;">' + eventName + '</td></tr>';
  if (attending && adults) {
    rows += '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Headcount</td>' +
            '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + adults + ' adult' + (adults !== "1" ? "s" : "") +
            (children && children !== "0" ? ", " + children + " child" + (children !== "1" ? "ren" : "") : "") + '</td></tr>';
  }
  if (roles) {
    rows += '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top;">Volunteering</td>' +
            '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + roles + '</td></tr>';
  }
  if (potluck) {
    rows += '<tr><td style="color:#7a6a50;font-size:0.85rem;padding:3px 16px 3px 0;white-space:nowrap;">Potluck</td>' +
            '<td style="color:#2c3d2e;font-size:0.95rem;padding:3px 0;">' + potluck + '</td></tr>';
  }

  var htmlBody =
    '<!DOCTYPE html>' +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>You\'re Signed Up!</title></head>' +
    '<body style="margin:0;padding:0;background:#f0ece3;font-family:Georgia,serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ece3;padding:32px 16px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#faf8f4;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">' +

    // Header
    '<tr><td style="background:#2c3d2e;padding:40px 48px 32px;text-align:center;">' +
      '<div style="color:#c9a84c;font-size:1.1rem;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:10px;">\u2746 &nbsp; Pendleton Plantation &nbsp; \u2746</div>' +
      '<div style="font-size:3.2rem;margin:12px 0;">\u{1F389}</div>' +
      '<h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:1.75rem;font-weight:400;margin:8px 0 0;letter-spacing:0.03em;">You\'re <em>In!</em></h1>' +
      '<div style="width:60px;height:2px;background:#c9a84c;margin:16px auto 0;"></div>' +
    '</td></tr>' +

    // Greeting
    '<tr><td style="padding:40px 48px 8px;">' +
      '<p style="font-size:1.05rem;color:#2c3d2e;margin:0 0 16px;">Dear <strong>' + fullName + '</strong>,</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'We\u2019re so excited to have you join us! Your sign-up has been confirmed.' +
      '</p>' +
    '</td></tr>' +

    // Summary card
    '<tr><td style="padding:8px 48px 8px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e8;border-left:4px solid #c9a84c;border-radius:0 4px 4px 0;padding:20px 24px;">' +
        '<tr><td>' +
          '<div style="font-size:0.72rem;color:#7a6a50;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Sign-Up Summary</div>' +
          '<table cellpadding="0" cellspacing="0" border="0">' + rows + '</table>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:24px 48px 8px;">' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0 0 12px;">' +
        'Keep an eye on the <a href="https://pendletonplantation.com/events.html" style="color:#2c3d2e;">Events page</a> for the latest details, timing updates, and any changes as we get closer.' +
      '</p>' +
      '<p style="font-size:1rem;color:#3a3a3a;line-height:1.7;margin:0;">' +
        'If you need to make any changes to your sign-up, please reply to this email.' +
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
