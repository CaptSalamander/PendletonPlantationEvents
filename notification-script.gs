// ============================================================
//  File:        notification-script.gs
//  Purpose:     Google Apps Script backend for opt-in community
//               notifications from the Pendleton Plantation admin
//               portal.
//
//  Role:
//    • Receive a notification payload from admin.html.
//    • Send an HTML email to the provided recipient list (BCC).
//    • Returns { success: true, sent: N } on success.
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in any sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into admin.html as NOTIFICATION_SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
//
//  Payload (JSON, Content-Type: text/plain):
//    {
//      action:     "sendNotification",
//      subject:    "Event Announcement: Easter Egg Hunt",
//      headline:   "Easter Egg Hunt 2026",
//      body_html:  "<p>Join us for…</p>",
//      recipients: ["a@example.com", "b@example.com"],
//      sender_name:"Pendleton Plantation HOA"
//    }
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
var FROM_NAME = "Pendleton Plantation HOA";


// ── doPost ───────────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'sendNotification') {
      var result = sendNotification(data);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, sent: result.sent }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ── doGet (health check) ─────────────────────────────────────
function doGet() {
  return ContentService
    .createTextOutput('notification-script.gs is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}


// ── sendNotification ─────────────────────────────────────────
function sendNotification(data) {
  var recipients = data.recipients || [];
  if (!recipients.length) return { sent: 0 };

  var subject      = data.subject       || 'Community Update — Pendleton Plantation';
  var headline     = data.headline      || subject;
  var bodyHtml     = data.body_html     || '';
  var senderName   = data.sender_name   || FROM_NAME;
  var replyEmail   = data.organizerEmail || 'mandyvaliquette00@gmail.com';

  var html = buildEmailHtml(headline, bodyHtml, replyEmail);

  // Send in BCC batches of 50 (MailApp daily quota is ~100 recipients)
  var BATCH = 50;
  var sent = 0;
  for (var i = 0; i < recipients.length; i += BATCH) {
    var batch = recipients.slice(i, i + BATCH);
    try {
      MailApp.sendEmail({
        to:       batch[0],          // required; first recipient in To:
        bcc:      batch.slice(1).join(','),
        subject:  subject,
        htmlBody: html,
        name:     senderName,
        replyTo:  replyEmail,
      });
      sent += batch.length;
    } catch (err) {
      Logger.log('Batch error: ' + err.message);
    }
  }
  return { sent: sent };
}


// ── buildEmailHtml ────────────────────────────────────────────
function buildEmailHtml(headline, bodyHtml, replyEmail) {
  replyEmail = replyEmail || 'mandyvaliquette00@gmail.com';
  return [
    '<div style="font-family:\'DM Sans\',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f0e8;border-radius:12px;overflow:hidden;">',

    // Header banner
    '<div style="background:#2c3d2e;padding:28px 32px;text-align:center;">',
    '<p style="margin:0;color:#c9a84c;font-size:0.8rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Pendleton Plantation</p>',
    '<h1 style="margin:8px 0 0;color:#f5f0e8;font-family:Georgia,serif;font-size:1.6rem;font-weight:700;">' + headline + '</h1>',
    '</div>',

    // Gold accent bar
    '<div style="height:4px;background:linear-gradient(90deg,#c9a84c,#e0c270,#c9a84c);"></div>',

    // Body
    '<div style="padding:28px 32px;color:#333;font-size:0.95rem;line-height:1.7;">',
    bodyHtml,
    '</div>',

    // Footer
    '<div style="background:#2c3d2e;padding:16px 32px;text-align:center;">',
    '<p style="margin:0;color:#8a9a7a;font-size:0.75rem;line-height:1.6;">',
    'Pendleton Plantation HOA &nbsp;·&nbsp; Community Newsletter<br />',
    'You are receiving this because you opted in to community notifications.<br />',
    'Questions? Contact <a href="mailto:' + replyEmail + '" style="color:#c9a84c;">' + replyEmail + '</a>',
    '</p>',
    '</div>',

    '</div>',
  ].join('');
}
