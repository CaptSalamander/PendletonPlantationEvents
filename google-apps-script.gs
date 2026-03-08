// ============================================================
//  COMMUNITY EVENT SIGNUP — Google Apps Script
//  Paste this entire file into your Google Sheet's Apps Script
//  editor (Extensions → Apps Script), then deploy as a Web App.
// ============================================================

// ✏️  PUT YOUR EMAIL ADDRESS HERE to receive notification emails
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// ✏️  PUT YOUR EVENT NAME HERE (shows up in email subject lines)
var EVENT_NAME = "Easter Egg Hunt 2025";

// ============================================================
//  doPost — runs every time the HTML form is submitted
// ============================================================
function doPost(e) {

  try {
    // --- 1. Parse incoming form data ---
    var params = e.parameter;

    // Handle checkboxes (they come in as comma-separated string
    // because the HTML form joins them before sending)
    var volunteerRoles = params.volunteer_roles || "None selected";
    var donationItems  = params.donation_items  || "None selected";

    // --- 2. Open the active spreadsheet and find/create a sheet ---
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Signups");

    // If the "Signups" sheet doesn't exist yet, create it and add headers
    if (!sheet) {
      sheet = ss.insertSheet("Signups");
      sheet.appendRow([
        "Timestamp",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Address",
        "Attending?",
        "# Adults",
        "# Children",
        "Ages 0-3",
        "Ages 4-8",
        "Ages 9+",
        "Potluck Item",
        "Volunteer Roles",
        "Donations",
        "Other Donation",
        "Notes",
        "Event"
      ]);

      // Style the header row
      var headerRange = sheet.getRange(1, 1, 1, 18);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f4c8c0");
      sheet.setFrozenRows(1);
    }

    // --- 3. Append the new submission as a row ---
    sheet.appendRow([
      new Date(),                          // Timestamp
      params.first_name   || "",
      params.last_name    || "",
      params.email        || "",
      params.phone        || "",
      params.address      || "",
      params.attending    || "",
      params.num_adults   || "",
      params.num_children || "",
      params.children_0_3    || "0",
      params.children_4_8    || "0",
      params.children_9_plus || "0",
      params.potluck_item || "",
      volunteerRoles,
      donationItems,
      params.other_donation || "",
      params.notes          || "",
      params.event          || EVENT_NAME
    ]);

    // --- 4. Send a notification email ---
    var subject = "New Sign-Up: " + EVENT_NAME + " — "
                + (params.first_name || "") + " "
                + (params.last_name  || "");

    var body =
      "You have a new sign-up for " + EVENT_NAME + "!\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "NAME:       " + params.first_name + " " + params.last_name + "\n" +
      "EMAIL:      " + (params.email        || "—") + "\n" +
      "PHONE:      " + (params.phone        || "—") + "\n" +
      "ADDRESS:    " + (params.address      || "—") + "\n\n" +
      "ATTENDING?  " + (params.attending    || "—") + "\n" +
      "ADULTS:     " + (params.num_adults   || "0") + "\n" +
      "CHILDREN:   " + (params.num_children || "0") +
        "  (Ages 0–3: " + (params.children_0_3    || "0") +
        "  |  Ages 4–8: " + (params.children_4_8    || "0") +
        "  |  Ages 9+: "  + (params.children_9_plus || "0") + ")\n" +
      "POTLUCK:    " + (params.potluck_item || "—") + "\n\n" +
      "VOLUNTEERING FOR:\n  " + volunteerRoles.replace(/,/g, "\n  ") + "\n\n" +
      "DONATING:\n  "         + donationItems.replace(/,/g,  "\n  ") + "\n\n" +
      "OTHER DONATION: "  + (params.other_donation || "—") + "\n\n" +
      "NOTES:\n"             + (params.notes || "—") + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "View all responses in your Google Sheet.";

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    // --- 5. Return success to the HTML form ---
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {

    // Return error details (helpful for debugging)
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  doGet — returns signup summary as JSON for the dashboard
// ============================================================
function doGet(e) {

  var empty = {
    totalSignups:    0,
    attendingCount:  0,
    totalAdults:     0,
    totalChildren:   0,
    volunteerCounts: {},
    donationCounts:  {},
    potluckItems:    [],
    lastUpdated:     new Date().toISOString()
  };

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Signups");

    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify(empty))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);

    // Map header names → column index
    var col = {};
    headers.forEach(function(h, i) { col[h] = i; });

    var totalSignups    = rows.length;
    var attendingCount  = 0;
    var totalAdults     = 0;
    var totalChildren   = 0;
    var volunteerCounts = {};
    var donationCounts  = {};
    var potluckItems    = [];

    rows.forEach(function(row) {

      // Attendance
      var att = String(row[col["Attending?"]] || "");
      if (att.indexOf("Yes") === 0) attendingCount++;

      // Headcounts
      totalAdults   += Number(row[col["# Adults"]]   || 0) || 0;
      totalChildren += Number(row[col["# Children"]] || 0) || 0;

      // Potluck
      var p = String(row[col["Potluck Item"]] || "").trim();
      if (p) potluckItems.push(p);

      // Volunteer roles (comma-separated)
      var vols = String(row[col["Volunteer Roles"]] || "");
      if (vols && vols !== "None selected") {
        vols.split(",").forEach(function(v) {
          v = v.trim();
          if (v) volunteerCounts[v] = (volunteerCounts[v] || 0) + 1;
        });
      }

      // Donation items — format: "Label: qty, Label: qty" (qty may be absent for old checkbox rows)
      var don = String(row[col["Donations"]] || "");
      if (don && don !== "None selected") {
        don.split(",").forEach(function(d) {
          d = d.trim();
          if (!d) return;
          var colonIdx = d.lastIndexOf(":");
          var itemName = colonIdx > -1 ? d.substring(0, colonIdx).trim() : d;
          var qty      = colonIdx > -1 ? (parseInt(d.substring(colonIdx + 1).trim()) || 1) : 1;
          if (itemName) donationCounts[itemName] = (donationCounts[itemName] || 0) + qty;
        });
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        totalSignups:    totalSignups,
        attendingCount:  attendingCount,
        totalAdults:     totalAdults,
        totalChildren:   totalChildren,
        volunteerCounts: volunteerCounts,
        donationCounts:  donationCounts,
        potluckItems:    potluckItems,
        lastUpdated:     new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    empty.error = err.toString();
    return ContentService
      .createTextOutput(JSON.stringify(empty))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
