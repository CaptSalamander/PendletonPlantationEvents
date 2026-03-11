// ============================================================
//  File:        bulletin-board-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation Community Bulletin Board.
//
//  How to use:
//    1. Go to Extensions → Apps Script in the HOA spreadsheet.
//    2. Create a new script file and paste this entire file.
//    3. Click "Deploy" → "New deployment" → "Web app".
//    4. Set "Execute as" = Me, "Who has access" = Anyone.
//    5. Copy the Web App URL and paste it into both
//       bulletin-board.html and post-to-board.html as SCRIPT_URL.
//
//  Flow:
//    doPost  — receives a new post submission, saves to the
//              "Bulletin Board" sheet (Approved = "N"), and
//              e-mails the organizer with a one-click approve link.
//    doGet   — two modes:
//              (a) ?action=approve&token=TOKEN  → approves the post
//                  and returns a confirmation HTML page.
//              (b) (no params)                 → returns all
//                  approved posts as JSON.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";
var SHEET_NAME         = "Bulletin Board";

// Shared HOA spreadsheet (same workbook as nominations + memories).
var SPREADSHEET_ID     = "17SlocYPigWSV3PL1e8d93WSTkz-Tzb01NeQQ9eIRKCs";

// Google Drive folder where bulletin board photos are saved.
var DRIVE_FOLDER_ID    = "1QomHI0yaJJvMsQVH7llYxRdZHkc3N3gt";

var HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "Phone",
  "Street Address",
  "Category",
  "Title",
  "Content",
  "Photo URLs",
  "Approved",
  "Token",
  "Show Phone",
  "Show Email",
];

// Column indices (0-based) — used when scanning rows.
var COL_APPROVED   = 9;   // Column J
var COL_TOKEN      = 10;  // Column K
var COL_SHOW_PHONE = 11;  // Column L
var COL_SHOW_EMAIL = 12;  // Column M


// ── doGet ────────────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action;
  var token  = e.parameter.token;

  // ── Branch A: One-click approval link ────────────────────
  if (action === "approve" && token) {
    return approvePost(token);
  }

  // ── Branch B: Return approved posts as JSON ───────────────
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      output.setContent(JSON.stringify({ posts: [] }));
      return output;
    }

    var rows  = sheet.getDataRange().getValues();
    var posts = [];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];

      // Only return approved posts.
      if (String(row[COL_APPROVED]).toUpperCase() !== "Y") continue;

      var timestamp  = row[0];   // Column A — Timestamp
      var name       = row[1];   // Column B — Name
      var emailRaw   = row[2];   // Column C — Email (shown only if showEmail = "Y")
      var phoneRaw   = row[3];   // Column D — Phone (shown only if showPhone = "Y")
      // row[4] Address   — kept private, not returned.
      var category   = row[5];   // Column F — Category
      var title      = row[6];   // Column G — Title
      var content    = row[7];   // Column H — Content
      var urlsRaw    = row[8];   // Column I — Photo URLs
      var showPhone  = String(row[COL_SHOW_PHONE]).toUpperCase() === "Y";
      var showEmail  = String(row[COL_SHOW_EMAIL]).toUpperCase() === "Y";

      // Extract Drive file IDs from stored share URLs.
      var photoIds = [];
      if (urlsRaw && urlsRaw !== "No photos") {
        urlsRaw.toString().split("\n").forEach(function (url) {
          var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match) photoIds.push(match[1]);
        });
      }

      posts.push({
        date:     timestamp ? new Date(timestamp).toISOString() : "",
        name:     name              || "",
        phone:    showPhone ? (phoneRaw || "") : "",
        email:    showEmail ? (emailRaw || "") : "",
        category: category          || "General / Community News",
        title:    title             || "",
        content:  content           || "",
        photoIds: photoIds,
      });
    }

    // Newest posts first.
    posts.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    output.setContent(JSON.stringify({ posts: posts }));

  } catch (err) {
    Logger.log("doGet error: " + err);
    output.setContent(JSON.stringify({ posts: [], error: err.toString() }));
  }

  return output;
}


// ── approvePost ──────────────────────────────────────────────
// Finds the row matching the token, sets Approved = "Y",
// and returns a styled HTML confirmation page.
function approvePost(token) {
  var approved = false;
  var postTitle = "";

  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (sheet) {
      var rows = sheet.getDataRange().getValues();

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][COL_TOKEN]) === String(token)) {
          // Set Approved = "Y" (row index is 1-based in Sheets API).
          sheet.getRange(i + 1, COL_APPROVED + 1).setValue("Y");
          postTitle = rows[i][6] || "Untitled Post";
          approved  = true;
          break;
        }
      }
    }
  } catch (err) {
    Logger.log("approvePost error: " + err);
  }

  var html = approved
    ? "<html><head><title>Post Approved</title>" +
      "<style>body{font-family:sans-serif;background:#fdf8ef;display:flex;align-items:center;" +
      "justify-content:center;min-height:100vh;margin:0;}" +
      ".card{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.1);" +
      "text-align:center;max-width:460px;}" +
      "h1{color:#2d6a2d;margin-bottom:12px;font-size:1.6rem;}" +
      "p{color:#555;line-height:1.6;}" +
      "a{color:#2d6a2d;}</style></head><body>" +
      "<div class='card'><div style='font-size:3rem;margin-bottom:16px'>✅</div>" +
      "<h1>Post Approved!</h1>" +
      "<p><strong>" + postTitle + "</strong><br><br>" +
      "This post will now appear on the <a href='https://pendletonplantation.com/bulletin-board.html'>Community Bulletin Board</a>.</p>" +
      "</div></body></html>"
    : "<html><head><title>Approval Failed</title>" +
      "<style>body{font-family:sans-serif;background:#fdf8ef;display:flex;align-items:center;" +
      "justify-content:center;min-height:100vh;margin:0;}" +
      ".card{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.1);" +
      "text-align:center;max-width:460px;}" +
      "h1{color:#8b3a2a;margin-bottom:12px;font-size:1.6rem;}" +
      "p{color:#555;line-height:1.6;}</style></head><body>" +
      "<div class='card'><div style='font-size:3rem;margin-bottom:16px'>⚠️</div>" +
      "<h1>Approval Link Invalid</h1>" +
      "<p>This link may have already been used or has expired.<br><br>" +
      "If you believe this is an error, check the Google Sheet directly.</p>" +
      "</div></body></html>";

  return HtmlService.createHtmlOutput(html);
}


// ── doPost ───────────────────────────────────────────────────
// Receives JSON from post-to-board.html with keys:
//   name, email, phone, address, category, title, content,
//   photos: [{ name, mimeType, base64 }, …]
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);

    // ── Generate approval token ───────────────────────────
    var token = Math.random().toString(36).substring(2) +
                Date.now().toString(36);

    // ── Upload photos to Drive ────────────────────────────
    var photoUrls = [];
    var folder    = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    if (data.photos && data.photos.length > 0) {
      // Sub-folder named after the category to stay organized.
      var catLabel = (data.category || "General").replace(/[\/\\:*?"<>|]/g, "-");
      var subFolder;
      var existing = folder.getFoldersByName("Bulletin Board - " + catLabel);
      subFolder = existing.hasNext()
        ? existing.next()
        : folder.createFolder("Bulletin Board - " + catLabel);

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

    // ── Get or create the Bulletin Board sheet ────────────
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
           .setFontWeight("bold")
           .setBackground("#8b3a2a")
           .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // ── Append the row (Approved = "N") ──────────────────
    sheet.appendRow([
      new Date(),
      data.name      || "",
      data.email     || "",
      data.phone     || "",
      data.address   || "",
      data.category  || "",
      data.title     || "",
      data.content   || "",
      photoUrls.length ? photoUrls.join("\n") : "No photos",
      "N",
      token,
      data.showPhone ? "Y" : "N",
      data.showEmail ? "Y" : "N",
    ]);

    // ── Notify organizer with approval link ───────────────
    // NOTE: After deploying, the SCRIPT_URL is fixed; update it
    // here if you redeploy with a new URL.
    var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzfoCjpqVPMxAuyAn6WuKFKoH-U9cqvSto0nvqWeuCQgRbqXo95XXCPPsnvRnICcg-TJw/exec";

    var approveLink = SCRIPT_URL + "?action=approve&token=" + token;

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
      "\n\n" +
      "══ APPROVE THIS POST ═════════════════\n" +
      "Click the link below to approve and publish this post:\n" +
      approveLink + "\n\n" +
      "View all posts in the spreadsheet:\n" +
      "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID;

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    output.setContent(JSON.stringify({ success: true }));

  } catch (err) {
    Logger.log("Bulletin board post error: " + err);
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }

  return output;
}
