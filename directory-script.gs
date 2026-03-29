// ============================================================
//  File:        directory-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation Resident Business Directory.
//
//  Role:
//    • Receive a business listing submission from directory.html.
//    • Send an admin notification email with listing details.
//    • No photo upload or Google Sheets interaction — data is
//      stored in Supabase (business_directory table) by the
//      browser client before this script is called.
//
//  How to use:
//    1. Open script editor (Extensions → Apps Script in any sheet).
//    2. Paste this file, replacing any existing code.
//    3. Deploy → New deployment → Web app.
//       Execute as: Me   |   Who has access: Anyone
//    4. Paste the Web App URL into directory.html as DIRECTORY_SCRIPT_URL.
//    5. Redeploy (Manage deployments → New version) after any change.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// Notification email — receives a copy of every new listing submission.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";


// ── doPost ───────────────────────────────────────────────────
// Receives JSON from directory.html (Content-Type: text/plain) with keys:
//   action, owner_name, business_name, category, description,
//   phone, email, website
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'directorySubmit') {
      sendAdminNotification(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
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
    .createTextOutput('directory-script.gs is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}


// ── sendAdminNotification ────────────────────────────────────
function sendAdminNotification(data) {
  var subject = '📋 New Directory Listing: ' + (data.business_name || '(no name)');

  var rows = [
    ['Business Name', data.business_name || '—'],
    ['Owner',         data.owner_name    || '—'],
    ['Category',      data.category      || '—'],
    ['Description',   data.description   || '—'],
    ['Phone',         data.phone         || '—'],
    ['Email',         data.email         || '—'],
    ['Website',       data.website       || '—'],
  ];

  var tableRows = rows.map(function(r) {
    return '<tr><td style="padding:6px 12px;font-weight:600;color:#2c3d2e;white-space:nowrap;width:140px;">'
      + r[0] + '</td><td style="padding:6px 12px;color:#333;">' + r[1] + '</td></tr>';
  }).join('');

  var html = [
    '<div style="font-family:\'DM Sans\',Arial,sans-serif;max-width:580px;margin:0 auto;background:#f5f0e8;border-radius:12px;overflow:hidden;">',

    // Header banner
    '<div style="background:#2c3d2e;padding:28px 32px;text-align:center;">',
    '<p style="margin:0;color:#c9a84c;font-size:0.8rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Pendleton Plantation</p>',
    '<h1 style="margin:8px 0 0;color:#f5f0e8;font-family:Georgia,serif;font-size:1.6rem;font-weight:700;">New Directory Listing</h1>',
    '</div>',

    // Gold accent bar
    '<div style="height:4px;background:linear-gradient(90deg,#c9a84c,#e0c270,#c9a84c);"></div>',

    // Body
    '<div style="padding:28px 32px;">',
    '<p style="margin:0 0 20px;color:#333;font-size:0.95rem;line-height:1.6;">',
    'A new business listing has been submitted and is awaiting your approval in the admin portal.',
    '</p>',

    // Summary card
    '<div style="background:#fff;border-radius:10px;border-left:4px solid #c9a84c;overflow:hidden;margin-bottom:24px;">',
    '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;">',
    tableRows,
    '</table>',
    '</div>',

    '<p style="margin:0;color:#555;font-size:0.85rem;line-height:1.6;">',
    'To approve or edit this listing, visit the <strong>Admin → Directory</strong> panel.',
    '</p>',
    '</div>',

    // Footer
    '<div style="background:#2c3d2e;padding:16px 32px;text-align:center;">',
    '<p style="margin:0;color:#8a9a7a;font-size:0.75rem;">',
    'Pendleton Plantation HOA &nbsp;·&nbsp; Business Directory<br />',
    'This is an automated notification.',
    '</p>',
    '</div>',

    '</div>',
  ].join('');

  MailApp.sendEmail({
    to:       NOTIFICATION_EMAIL,
    subject:  subject,
    htmlBody: html,
    name:     'Pendleton Plantation HOA',
  });
}
