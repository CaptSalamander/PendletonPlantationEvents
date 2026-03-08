// ============================================================
//  COMMUNITY EVENT SIGNUP — Google Apps Script
//  Paste this entire file into your Google Sheet's Apps Script
//  editor (Extensions → Apps Script), then deploy as a Web App.
// ============================================================

// ✏️  PUT YOUR EMAIL ADDRESS HERE to receive notification emails
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// ✏️  PUT YOUR EVENT NAME HERE (shows up in email subject lines)
var EVENT_NAME = "Easter Egg Hunt 2025";

// ── Donation items ─────────────────────────────────────────────
// Must match the labels in the HTML form exactly.
// Each item gets its own column in the spreadsheet.
var DONATION_ITEMS = [
  // Eggs & Filling
  "Plastic Eggs — any color",
  "Plastic Eggs — teal (allergy-friendly)",
  "Golden Eggs — special prize eggs",
  "Candy — individually wrapped, nut-free",
  "Bouncy Balls — small",
  "Mini Erasers — fun shapes",
  "Mini Play-Doh or putty containers",
  "Stickers — mini sheets",
  "Small Coins (nickels, dimes, quarters)",
  "Fake Tattoo / Fun Coupons (DIY)",
  "Temporary Tattoos — mini",
  "Storage bins to save eggs for next year",
  // Prizes
  "Golden Egg Prize Baskets — golden egg winners",
  "Prizes for Inside Baskets",
  "Ribbon for prize baskets",
  // Snack Table & Potluck
  "Juice boxes for kids",
  "Water bottles or water jug + cups",
  "Other beverage",
  "Main entree",
  "Side entree",
  "Dessert",
  "Easter candy for grown-ups",
  "Small plates",
  "Large plates",
  "Plastic cups",
  "Plastic eating utensils",
  "Paper towels / napkins",
  // Crafts
  "Sticker sheets for decorating",
  "Glitter glue sticks",
  "Crayons — boxes",
  "Washable markers — sets",
  "Drop cloth / disposable tablecloth",
  // Decor
  "Pastel balloons — latex",
  "Pastel streamers",
  "Tissue paper pom-poms",
  "Paper flower garland (DIY)",
  "Easter banner ('Happy Easter!' or custom)",
  "Plastic Easter lawn decorations",
  "Ribbon / raffia for baskets & decor",
  "Easter-themed tablecloth weights/clips",
  "Chalkboard or whiteboard + markers",
  "Easel to hold signs",
  "Balloon pump (hand or electric)",
  "Balloon weights",
  // Photo Booth
  "Photobooth backdrop",
  "Photobooth backdrop stand",
  "Easter basket prop (real or faux)",
  "Printable photo booth props (DIY)",
  "Other photo booth props (DIY)",
  "Popsicle sticks for props",
  "Tripod (for phone)",
  // Hunt Supplies
  "Baskets / Easter bags for kids",
  "Rope, twine, or pennant flags",
  "Wooden stakes / dowel rods for signs",
  "Zip ties or clips to attach rope",
  // Admin & Logistics
  "Folding tables — refreshments",
  "Folding tables — craft station",
  "Folding tables — check-in",
  "Folding tables — raffle/prize display",
  "Folding chairs",
  "Tablecloths — pastel/Easter themed",
  "Trash bags — large (39 gal)",
  "Recycling bags",
  "Hand sanitizer",
  "Pens / clipboards for sign-in",
  "Portable bluetooth speaker",
  "Extension cord (if music/PA)",
  "First aid kit",
  "Bug spray",
  "Sunscreen",
];

// Core columns that appear before the per-item donation columns
var CORE_HEADERS = [
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
  "Other Donation",
  "Notes",
  "Event",
];

var ALL_HEADERS = CORE_HEADERS.concat(DONATION_ITEMS);
var TOTAL_COLS  = ALL_HEADERS.length;  // 17 core + 70 donation = 87 columns


// ============================================================
//  doPost — runs every time the HTML form is submitted
// ============================================================
function doPost(e) {

  try {
    var params = e.parameter;

    var volunteerRoles = params.volunteer_roles || "None selected";

    // Parse "Label: qty, Label: qty, …" into a lookup map
    var donationMap = {};
    var donationStr = params.donation_items || "";
    if (donationStr && donationStr !== "None selected") {
      donationStr.split(",").forEach(function(d) {
        d = d.trim();
        if (!d) return;
        var colonIdx = d.lastIndexOf(":");
        if (colonIdx > -1) {
          var label = d.substring(0, colonIdx).trim();
          var qty   = parseInt(d.substring(colonIdx + 1).trim()) || 0;
          if (label && qty > 0) donationMap[label] = qty;
        }
      });
    }

    // Open or create the Signups sheet
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Signups");

    if (!sheet) {
      sheet = ss.insertSheet("Signups");
      sheet.appendRow(ALL_HEADERS);

      var headerRange = sheet.getRange(1, 1, 1, TOTAL_COLS);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f4c8c0");
      headerRange.setFontColor("#5a2a27");
      sheet.setFrozenRows(1);

      // Banding across 1000 rows covers all future signups
      sheet.getRange(1, 1, 1000, TOTAL_COLS)
           .applyRowBanding(SpreadsheetApp.BandingTheme.PINK, true, false);

      sheet.autoResizeColumns(1, TOTAL_COLS);
    }

    // Build row: core fields, then one qty value per donation item (0 if not pledged)
    var coreValues = [
      new Date(),
      params.first_name      || "",
      params.last_name       || "",
      params.email           || "",
      params.phone           || "",
      params.address         || "",
      params.attending       || "",
      params.num_adults      || "",
      params.num_children    || "",
      params.children_0_3    || "0",
      params.children_4_8    || "0",
      params.children_9_plus || "0",
      params.potluck_item    || "",
      volunteerRoles,
      params.other_donation  || "",
      params.notes           || "",
      params.event           || EVENT_NAME,
    ];

    var donationValues = DONATION_ITEMS.map(function(item) {
      return donationMap[item] || 0;
    });

    sheet.appendRow(coreValues.concat(donationValues));
    sheet.autoResizeColumns(1, TOTAL_COLS);

    // ── Notification email ─────────────────────────────────────
    var subject = "New Sign-Up: " + EVENT_NAME + " — "
                + (params.first_name || "") + " "
                + (params.last_name  || "");

    var donationLines = Object.keys(donationMap).map(function(k) {
      return "  " + k + ": " + donationMap[k];
    }).join("\n") || "  None selected";

    var body =
      "You have a new sign-up for " + EVENT_NAME + "!\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "NAME:       " + (params.first_name || "") + " " + (params.last_name || "") + "\n" +
      "EMAIL:      " + (params.email        || "—") + "\n" +
      "PHONE:      " + (params.phone        || "—") + "\n" +
      "ADDRESS:    " + (params.address      || "—") + "\n\n" +
      "ATTENDING?  " + (params.attending    || "—") + "\n" +
      "ADULTS:     " + (params.num_adults   || "0") + "\n" +
      "CHILDREN:   " + (params.num_children || "0") +
        "  (Ages 0–3: " + (params.children_0_3    || "0") +
        "  |  Ages 4–8: " + (params.children_4_8  || "0") +
        "  |  Ages 9+: "  + (params.children_9_plus || "0") + ")\n" +
      "POTLUCK:    " + (params.potluck_item  || "—") + "\n\n" +
      "VOLUNTEERING FOR:\n  " + volunteerRoles.replace(/,/g, "\n  ") + "\n\n" +
      "DONATING:\n" + donationLines + "\n\n" +
      "OTHER DONATION: " + (params.other_donation || "—") + "\n\n" +
      "NOTES:\n" + (params.notes || "—") + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "View all responses in your Google Sheet.";

    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
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

    // Map header name → column index
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

      // Volunteer roles (still comma-separated in one column)
      var vols = String(row[col["Volunteer Roles"]] || "");
      if (vols && vols !== "None selected") {
        vols.split(",").forEach(function(v) {
          v = v.trim();
          if (v) volunteerCounts[v] = (volunteerCounts[v] || 0) + 1;
        });
      }

      // Donation counts — read from individual item columns
      DONATION_ITEMS.forEach(function(item) {
        var qty = Number(row[col[item]] || 0) || 0;
        if (qty > 0) donationCounts[item] = (donationCounts[item] || 0) + qty;
      });
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
