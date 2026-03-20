// ============================================================
//  File:        google-apps-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation community event sign-up system.
//
//  How to use:
//    1. Open your Google Sheet.
//    2. Go to Extensions → Apps Script.
//    3. Paste this entire file into the editor, replacing any
//       existing code.
//    4. Click "Deploy" → "New deployment" → "Web app".
//    5. Set "Execute as" = Me, "Who has access" = Anyone.
//    6. Copy the Web App URL and paste it into:
//         - signup-page-easter.html  (EVENT.scriptUrl)
//         - dashboard.html           (SCRIPT_URL)
//
//  Functions:
//    doPost(e) — Handles form submissions. Saves each sign-up
//                as a new row in the "Signups" sheet and sends
//                a notification email to the organizer.
//    doGet(e)  — Returns a JSON summary of all sign-up data
//                for the dashboard page to consume.
// ============================================================


// ── CONFIGURATION ───────────────────────────────────────────
// ✏️  PUT YOUR EMAIL ADDRESS HERE to receive a notification
//     email every time someone submits the sign-up form.
var NOTIFICATION_EMAIL = "mandyvaliquette00@gmail.com";

// ✏️  PUT YOUR EVENT NAME HERE. This label is stored in the
//     spreadsheet and used in notification email subject lines.
var EVENT_NAME = "Easter Egg Hunt 2025";

// ✏️  PUT YOUR SHARED GOOGLE SPREADSHEET ID HERE.
// This is the same sheet used by nominations-script.gs.
// Find it in the sheet URL:
//   https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
// The Signups tab will be created automatically on first submission.
var SPREADSHEET_ID = "17SlocYPigWSV3PL1e8d93WSTkz-Tzb01NeQQ9eIRKCs";


// ── DONATION ITEMS ───────────────────────────────────────────
// The full list of donation items tracked by the spreadsheet.
// Each item gets its own dedicated column in the "Signups" sheet.
// Labels must match the donation item labels in the HTML form
// (signup-page-easter.html) exactly — including punctuation and
// spacing — so the dashboard can look them up by name.
var DONATION_ITEMS = [
  // ── Eggs & Filling ──────────────────────────────────────
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
  // ── Prizes ──────────────────────────────────────────────
  "Golden Egg Prize Baskets — golden egg winners",
  "Prizes for Inside Baskets",
  "Ribbon for prize baskets",
  // ── Snack Table & Potluck ───────────────────────────────
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
  // ── Crafts ──────────────────────────────────────────────
  "Sticker sheets for decorating",
  "Glitter glue sticks",
  "Crayons — boxes",
  "Washable markers — sets",
  "Drop cloth / disposable tablecloth",
  // ── Decor ───────────────────────────────────────────────
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
  // ── Photo Booth ─────────────────────────────────────────
  "Photobooth backdrop",
  "Photobooth backdrop stand",
  "Easter basket prop (real or faux)",
  "Printable photo booth props (DIY)",
  "Other photo booth props (DIY)",
  "Popsicle sticks for props",
  "Tripod (for phone)",
  // ── Hunt Supplies ────────────────────────────────────────
  "Baskets / Easter bags for kids",
  "Rope, twine, or pennant flags",
  "Wooden stakes / dowel rods for signs",
  "Zip ties or clips to attach rope",
  // ── Admin & Logistics ────────────────────────────────────
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


// ── SPREADSHEET COLUMN HEADERS ───────────────────────────────
// These are the "core" columns that appear before the individual
// per-donation-item columns. They capture the standard fields
// from the form (name, contact info, attendance, etc.).
var CORE_HEADERS = [
  "Timestamp",       // Date/time the form was submitted.
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Address",
  "Attending?",      // "Yes, we'll be there!" or "No, but I still want to help".
  "# Adults",        // Number of adults attending.
  "# Children",      // Total children across all age brackets.
  "Ages 0-3",        // Children in the 0–3 age bracket.
  "Ages 4-8",        // Children in the 4–8 age bracket.
  "Ages 9+",         // Children age 9 and older.
  "Potluck Item",    // Food/dish they plan to bring.
  "Volunteer Roles", // Comma-separated list of selected volunteer roles.
  "Other Donation",  // Free-text field for donations not in the list.
  "Notes",           // Any questions, comments, or special notes.
  "Heard About",     // How they heard about the event.
  "Special Skills",  // Special skills or resources offered.
  "Opt-In: Events",  // Opted in to future event updates ("Yes" / "No").
  "Opt-In: Newsletter", // Opted in to the neighborhood newsletter ("Yes" / "No").
  "Cash Donation",   // Cash or prize donation offer (free-text).
  "Event",           // Event name — stored so data can be filtered if sheets are shared.
];

// Combine the core columns with one column per donation item.
// The total should be 22 core columns + the number of donation items.
var ALL_HEADERS = CORE_HEADERS.concat(DONATION_ITEMS);
var TOTAL_COLS  = ALL_HEADERS.length;  // 22 core + 70 donation = 92 columns total


// ============================================================
//  doPost — Handles form submissions
//  Called automatically by Google Apps Script every time the
//  HTML form sends a POST request to the web app URL.
// ============================================================
function doPost(e) {

  try {
    // Read all form field values from the POST request parameters.
    var params = e.parameter;

    // Get the volunteer roles as a single comma-separated string.
    // Defaults to "None selected" if nothing was checked.
    var volunteerRoles = params.volunteer_roles || "None selected";

    // ── Parse donation items ─────────────────────────────────
    // The form sends donation data as a single string in the format:
    //   "Item Label: qty, Item Label: qty, …"
    // Parse this into a key-value map { "Label": qty } for easy lookup.
    var donationMap = {};
    var donationStr = params.donation_items || "";

    if (donationStr && donationStr !== "None selected") {
      // Split the string at each comma to get individual "Label: qty" pairs.
      donationStr.split(",").forEach(function(d) {
        d = d.trim();
        if (!d) return;   // Skip empty segments from trailing commas.

        // Find the last colon to separate the label from the quantity.
        // "Last" colon is used in case the label itself contains a colon.
        var colonIdx = d.lastIndexOf(":");
        if (colonIdx > -1) {
          var label = d.substring(0, colonIdx).trim();
          var qty   = parseInt(d.substring(colonIdx + 1).trim()) || 0;

          // Only add to the map if both a valid label and positive quantity exist.
          if (label && qty > 0) donationMap[label] = qty;
        }
      });
    }

    // ── Get or create the Signups sheet ─────────────────────
    // Open the active spreadsheet (the one this script is attached to).
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Signups");

    // If the "Signups" sheet doesn't exist yet, create it and add headers.
    if (!sheet) {
      // Insert a new sheet named "Signups".
      sheet = ss.insertSheet("Signups");

      // Write all column headers in the first row.
      sheet.appendRow(ALL_HEADERS);

      // Style the header row: bold text, pink background, dark red text.
      var headerRange = sheet.getRange(1, 1, 1, TOTAL_COLS);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f4c8c0");
      headerRange.setFontColor("#5a2a27");

      // Freeze the header row so it stays visible when scrolling.
      sheet.setFrozenRows(1);

      // Apply alternating row banding (pink theme) across 1000 rows
      // so future sign-ups are visually easy to read.
      sheet.getRange(1, 1, 1000, TOTAL_COLS)
           .applyRowBanding(SpreadsheetApp.BandingTheme.PINK, true, false);

      // Auto-resize all columns so headers fit without manual adjustment.
      sheet.autoResizeColumns(1, TOTAL_COLS);
    }

    // ── Build the new data row ───────────────────────────────
    // Start with the core field values in the defined column order.
    var coreValues = [
      new Date(),                          // Timestamp: current date/time.
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
      params.other_donation    || "",
      params.notes             || "",
      params.heard_about       || "",
      params.special_skills    || "",
      params.opt_in_events     || "No",
      params.opt_in_newsletter || "No",
      params.cash_donation     || "",
      params.event             || EVENT_NAME,  // Fall back to the configured event name.
    ];

    // Build the donation columns: one value per item in DONATION_ITEMS order.
    // Each value is the pledged quantity (0 if not in the donationMap).
    var donationValues = DONATION_ITEMS.map(function(item) {
      return donationMap[item] || 0;
    });

    // Append the combined row (core values + donation quantities) to the sheet.
    sheet.appendRow(coreValues.concat(donationValues));

    // Auto-resize columns again to accommodate any new long values.
    sheet.autoResizeColumns(1, TOTAL_COLS);


    // ── Send notification email ──────────────────────────────
    // Build a readable plain-text email and send it to the organizer
    // so they know someone just signed up.

    // Subject line includes the event name and the submitter's name.
    var subject = "New Sign-Up: " + EVENT_NAME + " — "
                + (params.first_name || "") + " "
                + (params.last_name  || "");

    // Format the donated items as a multi-line list for the email body.
    var donationLines = Object.keys(donationMap).map(function(k) {
      return "  " + k + ": " + donationMap[k];
    }).join("\n") || "  None selected";

    // Build the full email body with all relevant sign-up details.
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
      "HEARD ABOUT:     " + (params.heard_about       || "—") + "\n" +
      "SPECIAL SKILLS:  " + (params.special_skills    || "—") + "\n" +
      "OPT-IN EVENTS:   " + (params.opt_in_events     || "No") + "\n" +
      "OPT-IN NEWSLETTER: " + (params.opt_in_newsletter || "No") + "\n" +
      "CASH DONATION:   " + (params.cash_donation     || "—") + "\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "View all responses in your Google Sheet.";

    // Send the notification email using the Apps Script MailApp service.
    MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);

    // Return a success JSON response to the form's fetch() call.
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // If anything went wrong, return an error JSON response.
    // The form page will display a "Something went wrong" message to the user.
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
//  doGet — Returns a JSON summary for the dashboard, or a
//  single-person lookup when ?action=lookup&name=... is passed.
// ============================================================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // ── Lookup mode: find one person's sign-up by name ──────
  if (params.action === "lookup") {
    return handleLookup(params.name || "");
  }


  // Define a default "empty" response object returned when there are
  // no sign-ups yet or if the sheet does not exist.
  var empty = {
    totalSignups:    0,
    attendingCount:  0,
    totalAdults:     0,
    totalChildren:   0,
    ages_0_3:        0,
    ages_4_8:        0,
    ages_9_plus:     0,
    volunteerCounts: {},   // Map of { "Role Name": count }
    volunteerDetails:{},   // Map of { "Role Name": [{ name, email, phone }] }
    donationCounts:  {},   // Map of { "Item Label": total pledged }
    potluckItems:    [],   // Array of potluck item strings
    attendees:       [],   // Array of { name, attending, adults, children, roles }
    lastUpdated:     new Date().toISOString()
  };

  try {
    // Open the active spreadsheet and look for the "Signups" sheet.
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Signups");

    // If the sheet doesn't exist or only has a header row (no sign-ups),
    // return the empty response object.
    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify(empty))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Read all data from the sheet, including the header row.
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];       // First row is the header row.
    var rows    = data.slice(1); // All remaining rows are data rows.

    // Build a lookup map from header name to column index (0-based).
    // This allows us to reference columns by name instead of hard-coded index.
    var col = {};
    headers.forEach(function(h, i) { col[h] = i; });

    // Initialize aggregation counters.
    var totalSignups    = rows.length;   // Total number of sign-up rows.
    var attendingCount  = 0;             // Count of people attending the event.
    var totalAdults     = 0;             // Sum of all adult counts.
    var totalChildren   = 0;             // Sum of all children counts.
    var ages_0_3        = 0;             // Sum of children aged 0–3.
    var ages_4_8        = 0;             // Sum of children aged 4–8.
    var ages_9_plus     = 0;             // Sum of children aged 9+.
    var volunteerCounts = {};            // Accumulates volunteer counts per role.
    var volunteerDetails= {};            // Accumulates { name, email, phone } per role.
    var donationCounts  = {};            // Accumulates pledged quantities per item.
    var potluckItems    = [];            // List of all potluck items submitted.
    var attendees       = [];            // One entry per sign-up row for the Attendees tab.

    // ── Process each sign-up row ─────────────────────────────
    rows.forEach(function(row) {

      // ── Attendance ────────────────────────────────────────
      // Check if the "Attending?" value starts with "Yes" to count the person.
      var att = String(row[col["Attending?"]] || "");
      if (att.indexOf("Yes") === 0) attendingCount++;

      // ── Headcounts ────────────────────────────────────────
      // Add the adults and children values for this row to the running totals.
      // Convert to Number first, defaulting to 0 if the cell is empty or NaN.
      totalAdults   += Number(row[col["# Adults"]]   || 0) || 0;
      totalChildren += Number(row[col["# Children"]] || 0) || 0;

      // ── Age brackets ──────────────────────────────────────
      ages_0_3    += Number(row[col["Ages 0-3"]] || 0) || 0;
      ages_4_8    += Number(row[col["Ages 4-8"]] || 0) || 0;
      ages_9_plus += Number(row[col["Ages 9+"]]  || 0) || 0;

      // ── Potluck items ─────────────────────────────────────
      // Read the potluck item text from this row and add it to the list
      // if it is not blank.
      var p = String(row[col["Potluck Item"]] || "").trim();
      if (p) potluckItems.push(p);

      // ── Volunteer role counts ─────────────────────────────
      // The volunteer roles column is a comma-separated string.
      // Split it and increment the count for each role name found.
      var vols = String(row[col["Volunteer Roles"]] || "");
      if (vols && vols !== "None selected") {
        var volName  = (String(row[col["First Name"]] || "") + " " + String(row[col["Last Name"]] || "")).trim();
        var volEmail = String(row[col["Email"]] || "").trim();
        var volPhone = String(row[col["Phone"]] || "").trim();
        vols.split(",").forEach(function(v) {
          v = v.trim();
          if (!v) return;
          volunteerCounts[v] = (volunteerCounts[v] || 0) + 1;
          if (!volunteerDetails[v]) volunteerDetails[v] = [];
          volunteerDetails[v].push({ name: volName, email: volEmail, phone: volPhone });
        });
      }

      // ── Attendee list entry ───────────────────────────────
      var attFirst = String(row[col["First Name"]] || "").trim();
      var attLast  = String(row[col["Last Name"]]  || "").trim();
      var attRoles = String(row[col["Volunteer Roles"]] || "")
        .split(",")
        .map(function(r) { return r.trim(); })
        .filter(function(r) { return r && r !== "None selected"; });
      attendees.push({
        name:      (attFirst + " " + attLast).trim(),
        attending: String(row[col["Attending?"]] || ""),
        adults:    Number(row[col["# Adults"]]   || 0) || 0,
        children:  Number(row[col["# Children"]] || 0) || 0,
        roles:     attRoles
      });

      // ── Donation item counts ──────────────────────────────
      // Each donation item has its own column. Read the quantity value
      // from each column and add it to the running total for that item.
      DONATION_ITEMS.forEach(function(item) {
        var qty = Number(row[col[item]] || 0) || 0;
        if (qty > 0) donationCounts[item] = (donationCounts[item] || 0) + qty;
      });
    });

    // ── Build and return the JSON response ───────────────────
    // Return all the aggregated summary data for the dashboard to display.
    return ContentService
      .createTextOutput(JSON.stringify({
        totalSignups:     totalSignups,
        attendingCount:   attendingCount,
        totalAdults:      totalAdults,
        totalChildren:    totalChildren,
        ages_0_3:         ages_0_3,
        ages_4_8:         ages_4_8,
        ages_9_plus:      ages_9_plus,
        volunteerCounts:  volunteerCounts,
        volunteerDetails: volunteerDetails,
        donationCounts:   donationCounts,
        potluckItems:     potluckItems,
        attendees:        attendees,
        lastUpdated:      new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // If something went wrong reading the sheet, attach the error message
    // to the empty response so the dashboard can show it to the user.
    empty.error = err.toString();
    return ContentService
      .createTextOutput(JSON.stringify(empty))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
//  handleLookup — Finds sign-up rows matching a name search.
//  Called by doGet when ?action=lookup&name=... is present.
//  Returns only the fields needed to confirm a sign-up;
//  email, phone, and address are intentionally omitted.
// ============================================================
function handleLookup(searchName) {
  try {
    var query = searchName.trim().toLowerCase();

    if (!query) {
      return ContentService
        .createTextOutput(JSON.stringify({ results: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Signups");

    if (!sheet || sheet.getLastRow() <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({ results: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);

    var col = {};
    headers.forEach(function(h, i) { col[h] = i; });

    var results = [];

    rows.forEach(function(row) {
      var firstName = String(row[col["First Name"]] || "").trim();
      var lastName  = String(row[col["Last Name"]]  || "").trim();
      var fullName  = (firstName + " " + lastName).trim();

      // Match if the search query appears anywhere in the full name (case-insensitive).
      if (fullName.toLowerCase().indexOf(query) === -1) return;

      // Collect non-zero donation pledges for this person.
      var donations = [];
      DONATION_ITEMS.forEach(function(item) {
        var qty = Number(row[col[item]] || 0) || 0;
        if (qty > 0) donations.push({ item: item, qty: qty });
      });

      var roles = String(row[col["Volunteer Roles"]] || "")
        .split(",")
        .map(function(r) { return r.trim(); })
        .filter(function(r) { return r && r !== "None selected"; });

      results.push({
        name:          fullName,
        attending:     String(row[col["Attending?"]]   || ""),
        adults:        Number(row[col["# Adults"]]     || 0) || 0,
        children:      Number(row[col["# Children"]]   || 0) || 0,
        roles:         roles,
        potluck:       String(row[col["Potluck Item"]] || "").trim(),
        donations:     donations,
        otherDonation: String(row[col["Other Donation"]] || "").trim(),
        cash:          String(row[col["Cash Donation"]]  || "").trim(),
        notes:         String(row[col["Notes"]]          || "").trim(),
      });
    });

    return ContentService
      .createTextOutput(JSON.stringify({ results: results }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ results: [], error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
