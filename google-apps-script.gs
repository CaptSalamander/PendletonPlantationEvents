// ============================================================
//  File:        google-apps-script.gs
//  Purpose:     Google Apps Script backend for the Pendleton
//               Plantation community website.
//               Handles event sign-ups, dashboard data,
//               event management, awards, announcements,
//               memories, bulletin board, links, documents,
//               and admin CRUD operations.
//
//  How to use:
//    1. Open your Google Sheet.
//    2. Go to Extensions → Apps Script.
//    3. Paste this entire file, replacing any existing code.
//    4. Click "Deploy" → "New deployment" → "Web app".
//    5. Set "Execute as" = Me, "Who has access" = Anyone.
//    6. Copy the Web App URL into signup.html, dashboard.html,
//       index.html, awards.html, links.html, documents.html,
//       and admin.html (SCRIPT_URL constant in each file).
// ============================================================


// ── CONFIGURATION ────────────────────────────────────────────
var SPREADSHEET_ID = "17SlocYPigWSV3PL1e8d93WSTkz-Tzb01NeQQ9eIRKCs";


// ── SHEET NAME CONSTANTS ─────────────────────────────────────
var SHEET_SIGNUPS         = "Signups";
var SHEET_EVENTS          = "Events";
var SHEET_VOL_ROLES       = "EventVolunteerRoles";
var SHEET_DONATION_ITEMS  = "EventDonationItems";
var SHEET_AWARD_CONTESTS  = "AwardContests";
var SHEET_ANNOUNCEMENTS   = "Announcements";
var SHEET_LINKS           = "Links";
var SHEET_DOCUMENTS       = "Documents";
var SHEET_CONFIG          = "Config";
var SHEET_WINNERS         = "Winners";
var SHEET_WINNER_PREP     = "Winner Prep";
var SHEET_MEMORIES        = "Memory Submissions";
var SHEET_BULLETIN        = "Bulletin Board";


// ── CORE SIGN-UP HEADERS ─────────────────────────────────────
// The "core" columns that appear in every Signups sheet,
// before the per-event donation item columns.
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
  "Heard About",
  "Special Skills",
  "Opt-In: Events",
  "Opt-In: Newsletter",
  "Cash Donation",
  "Event",
  "Lookup Password",
];

// Set for fast O(1) membership checks
var CORE_HEADER_SET = (function() {
  var s = {};
  CORE_HEADERS.forEach(function(h) { s[h] = true; });
  return s;
}());


// ── SHEET HEADER DEFINITIONS ─────────────────────────────────
var EVENTS_HEADERS = [
  "Event ID", "Event Name", "Status", "Event Date", "Event Time",
  "Sign-Ups Open Date", "Short Description", "Medium Description",
  "Long Description", "Emoji Row", "Headline Adjective",
  "Location Name", "Location Address", "Banner Color Class",
  "ICS Start", "ICS End",
  "Organizer Name", "Organizer Address", "Organizer Phone",
  "Organizer Email", "Organizer Preferred Contact",
];

var VOL_ROLES_HEADERS     = ["Event ID", "Role Label", "Role Detail"];
var DONATION_ITEMS_HEADERS = ["Event ID", "Category", "Item Label", "Item Needed"];

var AWARD_CONTESTS_HEADERS = [
  "Contest ID", "Icon", "Badge", "Banner Color",
  "Award Name", "Category", "Period", "Status",
  "Description", "Deadline", "Prize",
];

var ANNOUNCEMENTS_HEADERS = [
  "ID", "Day", "Month", "Title", "Body",
  "Link", "Link Text", "Published",
];

var LINKS_HEADERS     = ["ID", "Category", "Icon", "Title", "Description", "URL", "URL Label"];
var DOCUMENTS_HEADERS = ["ID", "Category", "Icon", "Title", "Description", "URL", "URL Label"];
var CONFIG_HEADERS    = ["Key", "Value"];


// ============================================================
//  doPost — Main POST handler
// ============================================================
function doPost(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || "";
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    initializeSheets(ss);

    // ── Unauthenticated actions ──────────────────────────────

    // Default (no action): sign-up form submission
    if (!action) return handleSignup(params, ss);

    // Validate admin password (returns { valid: true/false })
    if (action === "validateAdmin") {
      var adminPass = getConfigValue(ss, "Admin Password");
      return json({ valid: (params.password || "") === adminPass });
    }

    // Validate dashboard password
    if (action === "validateDashboard") {
      var dbPass = getConfigValue(ss, "Dashboard Password");
      return json({ valid: (params.password || "") === dbPass });
    }

    // ── Admin-authenticated actions ──────────────────────────
    if (!validateAdminKey(ss, params.adminKey || "")) {
      return jsonErr("Unauthorized");
    }

    switch (action) {
      // Events
      case "archiveSignups":    return json(archiveAndAdvance(ss));
      case "saveEvent":         return json(saveEvent(parseData(params.data), ss));
      case "deleteEvent":       return json(deleteEvent(params.eventId, ss));

      // Award Contests
      case "saveAwardContest":  return json(saveAwardContest(parseData(params.data), ss));
      case "deleteAwardContest":return json(deleteAwardContest(params.contestId, ss));

      // Winners
      case "saveWinner":        return json(saveWinner(parseData(params.data), ss));
      case "deleteWinner":      return json(deleteWinner(params.winnerId, ss));
      case "promoteWinnerPrep": return json(promoteWinnerPrep(parseInt(params.rowId) || 0, ss));

      // Announcements
      case "saveAnnouncement":  return json(saveAnnouncement(parseData(params.data), ss));
      case "deleteAnnouncement":return json(deleteAnnouncement(params.id, ss));

      // Memories
      case "approveMemory":     return json(approveMemory(parseInt(params.rowId) || 0, ss));
      case "editMemory":        return json(editMemory(parseData(params.data), ss));
      case "deleteMemory":      return json(deleteMemory(parseInt(params.rowId) || 0, ss));

      // Bulletin Board
      case "approveBulletinPost": return json(approveBulletinPost(parseInt(params.rowId) || 0, ss));
      case "editBulletinPost":    return json(editBulletinPost(parseData(params.data), ss));
      case "deleteBulletinPost":  return json(deleteBulletinPost(parseInt(params.rowId) || 0, ss));

      // Links
      case "saveLink":          return json(saveLink(parseData(params.data), ss));
      case "deleteLink":        return json(deleteLink(params.id, ss));

      // Documents
      case "saveDocument":      return json(saveDocument(parseData(params.data), ss));
      case "deleteDocument":    return json(deleteDocument(params.id, ss));

      // Config / Settings
      case "updateConfig":      return json(updateConfigValues(parseData(params.data), ss));

      default: return jsonErr("Unknown action: " + action);
    }
  } catch (err) {
    return jsonErr(err.toString());
  }
}


// ============================================================
//  doGet — Main GET handler
// ============================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "";
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    initializeSheets(ss);

    // ── Public (no auth needed) ──────────────────────────────
    if (action === "nextEvent")       return json(getNextEventData(ss));
    if (action === "allEvents")       return json({ events: getAllEventsPublic(ss) });
    if (action === "allAnnouncements")return json({ announcements: getAllAnnouncements(ss, false) });
    if (action === "allLinks")        return json({ links: getAllLinks(ss) });
    if (action === "allDocuments")    return json({ documents: getAllDocuments(ss) });
    if (action === "allAwardContests")return json({ contests: getAllAwardContests(ss) });
    if (action === "allWinners")      return json({ winners: getAllWinners(ss) });
    if (action === "lookup")          return handleLookup(params, ss);

    // ── Admin-authenticated GETs ─────────────────────────────
    if (action === "allAnnouncementsAdmin" ||
        action === "allMemories"           ||
        action === "allBulletinPosts"      ||
        action === "getConfig"             ||
        action === "winnerPrep"            ||
        action === "allEventsAdmin") {

      if (!validateAdminKey(ss, params.adminKey || "")) return jsonErr("Unauthorized");

      if (action === "allAnnouncementsAdmin") return json({ announcements: getAllAnnouncements(ss, true) });
      if (action === "allMemories")           return json({ memories: getAllMemories(ss) });
      if (action === "allBulletinPosts")      return json({ posts: getAllBulletinPosts(ss) });
      if (action === "getConfig")             return json(getConfigAll(ss));
      if (action === "winnerPrep")            return json({ prep: getWinnerPrep(ss) });
      if (action === "allEventsAdmin")        return json({ events: getAllEventsAdmin(ss) });
    }

    // Default: dashboard summary (backward-compatible)
    return getDashboardSummary(ss);

  } catch (err) {
    return jsonErr(err.toString());
  }
}


// ============================================================
//  SHEET INITIALIZATION
//  Creates all required sheets on first run and seeds with
//  existing content so the transition is seamless.
// ============================================================
function initializeSheets(ss) {
  // Events sheet — seeded with Easter Egg Hunt 2026
  if (!ss.getSheetByName(SHEET_EVENTS)) seedEventsSheet(ss);

  // Volunteer roles — seeded with Easter roles
  if (!ss.getSheetByName(SHEET_VOL_ROLES)) seedVolRolesSheet(ss);

  // Donation items — seeded with Easter items
  if (!ss.getSheetByName(SHEET_DONATION_ITEMS)) seedDonationItemsSheet(ss);

  // Award contests — seeded with existing contests
  if (!ss.getSheetByName(SHEET_AWARD_CONTESTS)) seedAwardContestsSheet(ss);

  // Announcements — seeded with existing announcements
  if (!ss.getSheetByName(SHEET_ANNOUNCEMENTS)) seedAnnouncementsSheet(ss);

  // Links — seeded with existing links
  if (!ss.getSheetByName(SHEET_LINKS)) seedLinksSheet(ss);

  // Documents — seeded with existing documents
  if (!ss.getSheetByName(SHEET_DOCUMENTS)) seedDocumentsSheet(ss);

  // Config — seeded with default passwords and current event
  if (!ss.getSheetByName(SHEET_CONFIG)) seedConfigSheet(ss);

  // Signups — exists already; add Lookup Password column if missing
  migrateSignupsSheet(ss);

  // Memory Submissions — add Approved column if missing
  migrateMemoryApproved(ss);
}

function getOrCreateSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    var hr = sh.getRange(1, 1, 1, headers.length);
    hr.setFontWeight("bold");
    hr.setBackground("#d0e4f7");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
}

// Ensure Signups sheet has the Lookup Password column
function migrateSignupsSheet(ss) {
  var sh = ss.getSheetByName(SHEET_SIGNUPS);
  if (!sh || sh.getLastRow() < 1) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (headers.indexOf("Lookup Password") === -1) {
    var newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue("Lookup Password");
    sh.getRange(1, newCol).setFontWeight("bold").setBackground("#f4c8c0").setFontColor("#5a2a27");
  }
}

// Ensure Memory Submissions sheet has Approved column; mark existing rows Y
function migrateMemoryApproved(ss) {
  var sh = ss.getSheetByName(SHEET_MEMORIES);
  if (!sh || sh.getLastRow() < 1) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (headers.indexOf("Approved") === -1) {
    var col = sh.getLastColumn() + 1;
    sh.getRange(1, col).setValue("Approved").setFontWeight("bold");
    var lastRow = sh.getLastRow();
    if (lastRow > 1) {
      sh.getRange(2, col, lastRow - 1, 1).setValue("Y");
    }
  }
}


// ── SEED DATA FUNCTIONS ──────────────────────────────────────

function seedEventsSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_EVENTS, EVENTS_HEADERS);
  sh.appendRow([
    "EasterEggHunt2026",
    "Easter Egg Hunt 2026",
    "Confirmed",
    "2026-03-21",
    "10:00 AM \u2013 1:00 PM",
    "2026-02-01",
    "Join us for a neighborhood Easter Egg Hunt! Egg hunts for all age groups, crafts, potluck, and a photo booth. Volunteers and donations still needed!",
    "A fun-filled morning for the whole family — egg hunts by age group, crafts, potluck picnic, and more. Sign up to volunteer, donate supplies, or just RSVP!",
    "We hope you and your family are as excited as we are \u2014 this is going to be a wonderful morning! Here's how the day will unfold:<h3 class='description-heading'>\uD83D\uDCCB Event Schedule</h3>\uD83D\uDC68\u200D\uD83D\uDD27 <strong>9:00 AM</strong> &nbsp;\u00B7&nbsp; <em>Volunteer setup</em><br>Egg hiders, decorators, and setup crew get to work. If you're helping set up, please plan to arrive by 9:00 AM so everything is ready before the kids arrive!<br><br>\uD83D\uDC07 <strong>9:30 AM</strong> &nbsp;\u00B7&nbsp; <em>Doors open</em><br>Check-in begins, crafts \uD83C\uDFA8 and activities are available, and potluck dishes \uD83C\uDF70 start rolling in.<br><br>\uD83D\uDCE2 <strong>10:00 AM</strong> &nbsp;\u00B7&nbsp; <em>Welcome &amp; rules</em><br>A brief welcome and overview of the day's activities.<br><br>\uD83E\uDDFA <strong>10:20 AM</strong> &nbsp;\u00B7&nbsp; <em>Egg hunt begins!</em> \uD83E\uDD5A<br>Kids hunt in age-grouped areas to keep things fair and fun for everyone. Keep an eye out for the special <strong>Golden Eggs</strong> \u2014 each age bracket has two, and the lucky finders take home a prize!<br><br>\uD83D\uDCF7 <strong>11:00 AM</strong> &nbsp;\u00B7&nbsp; <em>Group photo, prizes &amp; potluck</em><br>Gather for a group photo, cheer on the prize winners \uD83C\uDFC6, then settle in for the community potluck picnic \uD83E\uDD50\uD83C\uDF6A. Bring a blanket or chairs if you have them, and please label dishes containing common allergens \uD83D\uDEA8.<br><br>\uD83D\uDC4B <strong>1:00 PM</strong> &nbsp;\u00B7&nbsp; <em>Wrap-up</em><br>The event officially ends \uD83E\uDEC2, but you're welcome to linger and enjoy the company of your neighbors! If you're able to help with cleanup \uD83E\uDDF9, we'd be so grateful. \uD83E\uDEB6",
    "\uD83D\uDC30 \uD83E\uDD5A \uD83C\uDF38 \uD83E\uDD5A \uD83D\uDC30",
    "Magical",
    "Pendleton Plantation Pool Area",
    "100 Armistead Ln \u2022 Easley, SC 29642",
    "card-color-1",
    "20260321T100000",
    "20260321T130000",
    "",
    "",
    "",
    "mandyvaliquette00@gmail.com",
    "Email",
  ]);
}

function seedVolRolesSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_VOL_ROLES, VOL_ROLES_HEADERS);
  var roles = [
    ["EasterEggHunt2026", "Hide the Eggs",  "Arrive 45 min early to help set up"],
    ["EasterEggHunt2026", "Check-In Table", "Welcome families & hand out bags"],
    ["EasterEggHunt2026", "Age Zone Monitor","Keep the groups organized"],
    ["EasterEggHunt2026", "Craft Station",  "Help kids decorate eggs"],
    ["EasterEggHunt2026", "Photo Booth",    "Help snap memories"],
    ["EasterEggHunt2026", "Cleanup Crew",   "Help tidy up afterward"],
    ["EasterEggHunt2026", "Setup / Decor",  "Help set up tables & decorations"],
    ["EasterEggHunt2026", "Snack Table",    "Help manage the refreshments"],
  ];
  roles.forEach(function(r) { sh.appendRow(r); });
}

function seedDonationItemsSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_DONATION_ITEMS, DONATION_ITEMS_HEADERS);
  var items = [
    // Eggs & Filling
    ["EasterEggHunt2026","Eggs & Filling","Plastic Eggs \u2014 any color",450],
    ["EasterEggHunt2026","Eggs & Filling","Plastic Eggs \u2014 teal (allergy-friendly)",30],
    ["EasterEggHunt2026","Eggs & Filling","Golden Eggs \u2014 special prize eggs",6],
    ["EasterEggHunt2026","Eggs & Filling","Candy \u2014 individually wrapped, nut-free",225],
    ["EasterEggHunt2026","Eggs & Filling","Bouncy Balls \u2014 small",45],
    ["EasterEggHunt2026","Eggs & Filling","Mini Erasers \u2014 fun shapes",45],
    ["EasterEggHunt2026","Eggs & Filling","Mini Play-Doh or putty containers",20],
    ["EasterEggHunt2026","Eggs & Filling","Stickers \u2014 mini sheets",45],
    ["EasterEggHunt2026","Eggs & Filling","Small Coins (nickels, dimes, quarters)",45],
    ["EasterEggHunt2026","Eggs & Filling","Fake Tattoo / Fun Coupons (DIY)",20],
    ["EasterEggHunt2026","Eggs & Filling","Temporary Tattoos \u2014 mini",45],
    ["EasterEggHunt2026","Eggs & Filling","Storage bins to save eggs for next year",2],
    // Prizes
    ["EasterEggHunt2026","Prizes","Golden Egg Prize Baskets \u2014 golden egg winners",6],
    ["EasterEggHunt2026","Prizes","Prizes for Inside Baskets",30],
    ["EasterEggHunt2026","Prizes","Ribbon for prize baskets",1],
    // Snack Table & Potluck
    ["EasterEggHunt2026","Snack Table & Potluck","Juice boxes for kids",50],
    ["EasterEggHunt2026","Snack Table & Potluck","Water bottles or water jug + cups",100],
    ["EasterEggHunt2026","Snack Table & Potluck","Other beverage",2],
    ["EasterEggHunt2026","Snack Table & Potluck","Main entree",6],
    ["EasterEggHunt2026","Snack Table & Potluck","Side entree",6],
    ["EasterEggHunt2026","Snack Table & Potluck","Dessert",3],
    ["EasterEggHunt2026","Snack Table & Potluck","Easter candy for grown-ups",""],
    ["EasterEggHunt2026","Snack Table & Potluck","Small plates",60],
    ["EasterEggHunt2026","Snack Table & Potluck","Large plates",60],
    ["EasterEggHunt2026","Snack Table & Potluck","Plastic cups",60],
    ["EasterEggHunt2026","Snack Table & Potluck","Plastic eating utensils",60],
    ["EasterEggHunt2026","Snack Table & Potluck","Paper towels / napkins",100],
    // Crafts
    ["EasterEggHunt2026","Crafts","Sticker sheets for decorating",""],
    ["EasterEggHunt2026","Crafts","Glitter glue sticks",""],
    ["EasterEggHunt2026","Crafts","Crayons \u2014 boxes",""],
    ["EasterEggHunt2026","Crafts","Washable markers \u2014 sets",""],
    ["EasterEggHunt2026","Crafts","Drop cloth / disposable tablecloth",""],
    // Decor
    ["EasterEggHunt2026","Decor","Pastel balloons \u2014 latex",""],
    ["EasterEggHunt2026","Decor","Pastel streamers",""],
    ["EasterEggHunt2026","Decor","Tissue paper pom-poms",""],
    ["EasterEggHunt2026","Decor","Paper flower garland (DIY)",""],
    ["EasterEggHunt2026","Decor","Easter banner ('Happy Easter!' or custom)",""],
    ["EasterEggHunt2026","Decor","Plastic Easter lawn decorations",""],
    ["EasterEggHunt2026","Decor","Ribbon / raffia for baskets & decor",""],
    ["EasterEggHunt2026","Decor","Easter-themed tablecloth weights/clips",""],
    ["EasterEggHunt2026","Decor","Chalkboard or whiteboard + markers",""],
    ["EasterEggHunt2026","Decor","Easel to hold signs",""],
    ["EasterEggHunt2026","Decor","Balloon pump (hand or electric)",""],
    ["EasterEggHunt2026","Decor","Balloon weights",""],
    // Photo Booth
    ["EasterEggHunt2026","Photo Booth","Photobooth backdrop",""],
    ["EasterEggHunt2026","Photo Booth","Photobooth backdrop stand",""],
    ["EasterEggHunt2026","Photo Booth","Easter basket prop (real or faux)",""],
    ["EasterEggHunt2026","Photo Booth","Printable photo booth props (DIY)",""],
    ["EasterEggHunt2026","Photo Booth","Other photo booth props (DIY)",""],
    ["EasterEggHunt2026","Photo Booth","Popsicle sticks for props",""],
    ["EasterEggHunt2026","Photo Booth","Tripod (for phone)",""],
    // Hunt Supplies
    ["EasterEggHunt2026","Hunt Supplies","Baskets / Easter bags for kids",20],
    ["EasterEggHunt2026","Hunt Supplies","Rope, twine, or pennant flags",50],
    ["EasterEggHunt2026","Hunt Supplies","Wooden stakes / dowel rods for signs",6],
    ["EasterEggHunt2026","Hunt Supplies","Zip ties or clips to attach rope",20],
    // Admin & Logistics
    ["EasterEggHunt2026","Admin & Logistics","Folding tables \u2014 refreshments",3],
    ["EasterEggHunt2026","Admin & Logistics","Folding tables \u2014 craft station",2],
    ["EasterEggHunt2026","Admin & Logistics","Folding tables \u2014 check-in",1],
    ["EasterEggHunt2026","Admin & Logistics","Folding tables \u2014 raffle/prize display",1],
    ["EasterEggHunt2026","Admin & Logistics","Folding chairs",100],
    ["EasterEggHunt2026","Admin & Logistics","Tablecloths \u2014 pastel/Easter themed",7],
    ["EasterEggHunt2026","Admin & Logistics","Trash bags \u2014 large (39 gal)",10],
    ["EasterEggHunt2026","Admin & Logistics","Recycling bags",4],
    ["EasterEggHunt2026","Admin & Logistics","Hand sanitizer",4],
    ["EasterEggHunt2026","Admin & Logistics","Pens / clipboards for sign-in",4],
    ["EasterEggHunt2026","Admin & Logistics","Portable bluetooth speaker",1],
    ["EasterEggHunt2026","Admin & Logistics","Extension cord (if music/PA)",2],
    ["EasterEggHunt2026","Admin & Logistics","First aid kit",1],
    ["EasterEggHunt2026","Admin & Logistics","Bug spray",2],
    ["EasterEggHunt2026","Admin & Logistics","Sunscreen",1],
  ];
  items.forEach(function(r) { sh.appendRow(r); });
}

function seedAwardContestsSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_AWARD_CONTESTS, AWARD_CONTESTS_HEADERS);
  var contests = [
    ["YardOfTheMonth","🌿","images/Awards%20Badges/awards-badges-pngs/yard-of-the-month.png","banner-green","Yard of the Month","Yard & Garden","April 2026","open","Know a neighbor with an outstanding yard? Whether it's a perfectly manicured lawn, beautiful seasonal flowers, or creative landscaping — nominate them! One winner is recognized each month.","March 31, 2026","$25 gift card + neighborhood recognition"],
    ["GreenThumbAward","🌱","images/Awards%20Badges/awards-badges-pngs/green-thumb-award.png","banner-forest","Green Thumb Award","Yard & Garden","Spring 2026","soon","Celebrate the neighbor with the most impressive garden, flower beds, or container plants. Nominations open April 15th — start scouting your favorite green thumbs now!","","HOA recognition + garden center gift card"],
    ["BestSeasonalDecoration","❄️","images/Awards%20Badges/awards-badges-pngs/best-seasonal-decoration.png","banner-purple","Best Seasonal Decoration","Yard & Garden","Spring 2026","soon","Celebrate the season with the most beautiful front-yard spring display! Nominations open April 1st.","","HOA recognition + neighborhood bragging rights"],
    ["BlockPartyMVP","🎉","images/Awards%20Badges/awards-badges-pngs/block-party-mvp.png","banner-navy","Block Party MVP","Events","Summer 2026","soon","Who made the neighborhood the life of the party this summer? Nominate the neighbor who went all-out to bring the community together.","","Recognition at the annual block party"],
    ["CommunityBeautificationAward","🏡","images/Awards%20Badges/awards-badges-pngs/community-beautification-award.png","banner-teal","Community Beautification Award","Community","Q2 2026","open","Recognize a neighbor who has made a visible, lasting improvement to the look and feel of our neighborhood.","April 15, 2026","Plaque + HOA recognition"],
    ["CommunitySpiritAward","✨","images/Awards%20Badges/awards-badges-pngs/community-spirit-award.png","banner-amber","Community Spirit Award","Community","Q1 2026","deliberating","Nominations for Q1's Community Spirit Award are now closed. Our committee is reviewing all submissions and will announce the winner shortly.","","HOA recognition + community spotlight"],
    ["CommunityInvolvementAward","🌍","images/Awards%20Badges/awards-badges-pngs/community-and-involvement-award.png","banner-bronze","Community & Involvement Award","Community","Q1 2026","voting","Finalists have been selected for Q1! Cast your vote for the neighbor who showed the greatest dedication to community involvement.","March 20, 2026","Personalized plaque + neighborhood recognition"],
    ["GoodNeighborAward","🤝","images/Awards%20Badges/awards-badges-pngs/good-neighbor-award.png","banner-gold","Good Neighbor Award","Community","April 2026","open","Know someone who goes out of their way to be kind, helpful, and welcoming? Nominate the neighbor who makes our street a better place.","March 31, 2026","Recognition + gift card"],
    ["NeighborhoodHero","🦸","images/Awards%20Badges/awards-badges-pngs/neighborhood-hero.png","banner-blue","Neighborhood Hero","Service","Q1 2026","voting","Three finalists have been selected for Q1's Neighborhood Hero award! Community voting is now open.","March 15, 2026","Personalized recognition plaque"],
    ["AboveAndBeyond","🦅","images/Awards%20Badges/awards-badges-pngs/above-and-beyond.png","banner-gold-warm","Above & Beyond Award","Service","Q1 2026","deliberating","Nominations have closed and our review committee is deliberating. The Above & Beyond Award recognizes a neighbor who truly exceeded all expectations.","","Award of Excellence plaque"],
    ["RandomActsOfKindness","🦋","images/Awards%20Badges/awards-badges-pngs/random-acts-of-kindness.png","banner-navy","Random Acts of Kindness","Service","Spring 2026","soon","This award celebrates neighbors who quietly make life better for those around them. Nominations open April 1st.","","Community recognition"],
    ["SpiritOfGiving","🕊️","images/Awards%20Badges/awards-badges-pngs/spirit-of-giving.png","banner-gold","Spirit of Giving Award","Service","Holiday 2025","awarded","The Holiday 2025 Spirit of Giving Award has been presented! See the Past Winners section below.","","Community recognition plaque"],
    ["VolunteerOfTheYear","🙌","images/Awards%20Badges/awards-badges-pngs/volunteer-of-the-year.png","banner-crimson","Volunteer of the Year","Service","2025","awarded","The 2025 Volunteer of the Year has been announced! See Past Winners for details.","","Annual recognition award"],
    ["WelcomeWagonAward","🛖","images/Awards%20Badges/awards-badges-pngs/welcome-wagon-award.png","banner-teal","Welcome Wagon Award","Community","Q2 2026","open","Who made you feel most at home when you moved to Pendleton Plantation? Nominate the neighbor who goes out of their way to welcome new families.","April 30, 2026","Recognition + welcome basket"],
    ["YouthSpotlight","⭐","images/Awards%20Badges/awards-badges-pngs/youth-spotlight.png","banner-sky","Youth Spotlight","Youth","Spring 2026","open","Celebrate a young neighbor (age 18 and under) who has shown exceptional kindness, leadership, or community spirit.","April 15, 2026","Certificate + community recognition"],
  ];
  contests.forEach(function(r) { sh.appendRow(r); });
}

function seedAnnouncementsSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_ANNOUNCEMENTS, ANNOUNCEMENTS_HEADERS);
  var rows = [
    [1,"21","Mar 2026","Easter Egg Hunt — Sign-Ups Now Open!","We're hosting our first neighborhood Easter egg hunt on March 21st! We're looking for volunteers, candy donations, and plastic egg donations. Fill out the sign-up form to let us know how you'd like to help — or just RSVP to join the fun.","signup.html","Sign Up Now →","Y"],
    [2,"01","Mar 2026","Welcome to Our New Community Hub","We've launched this website to keep Pendleton Plantation neighbors connected. Check back here for event sign-ups, announcements, and a growing photo gallery of our community memories.","","","Y"],
    [3,"2","Feb 2026","Spring HOA Meeting Recap","Our spring HOA meeting was held on February 2nd.","","","Y"],
  ];
  rows.forEach(function(r) { sh.appendRow(r); });
}

function seedLinksSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_LINKS, LINKS_HEADERS);
  var id = 1;
  var rows = [
    [id++,"Account & Payments","🔐","HOA Portal Login","Sign in to your Enumerate resident account to manage your HOA profile and settings.","https://engage.goenumerate.com/connect_login.php","goenumerate.com"],
    [id++,"Account & Payments","💳","Pay HOA Dues","Make a one-time or recurring payment for your HOA dues through ClickPay.","https://www.clickpay.com/custom/nhe/login.html","clickpay.com"],
    [id++,"Community Portal","🏡","HOA Home","Your Pendleton Plantation HOA dashboard — news, updates, and quick access to everything.","https://engage.goenumerate.com/s/pendletonplantation/home.php","goenumerate.com"],
    [id++,"Community Portal","💬","Community Feed","See what neighbors are posting and stay up to date with community conversations.","https://engage.goenumerate.com/s/pendletonplantation/communityfeed.php","goenumerate.com"],
    [id++,"Community Portal","📅","HOA Calendar","View upcoming HOA meetings, community events, and important dates.","https://engage.goenumerate.com/s/pendletonplantation/myhoacalendar.php","goenumerate.com"],
    [id++,"Community Portal","📰","News & Newsletters","Catch up on the latest HOA news, board updates, and community newsletters.","https://engage.goenumerate.com/s/pendletonplantation/news.php","goenumerate.com"],
    [id++,"Community Portal","🛍️","Classifieds","Buy, sell, or give away items with fellow Pendleton Plantation neighbors.","https://engage.goenumerate.com/s/pendletonplantation/classifieds.php","goenumerate.com"],
    [id++,"Community Portal","👥","Member Directory","Look up contact information for residents in the neighborhood.","https://engage.goenumerate.com/s/pendletonplantation/memberdirectory.php","goenumerate.com"],
    [id++,"Community Portal","🤝","Groups","Join or browse neighborhood interest groups and committees.","https://engage.goenumerate.com/s/pendletonplantation/groups.php","goenumerate.com"],
    [id++,"Community Portal","🖼️","HOA Gallery","Browse photo galleries uploaded through the official HOA portal.","https://engage.goenumerate.com/s/pendletonplantation/galleries.php","goenumerate.com"],
    [id++,"Community Portal","🏢","Sponsors","View local businesses and partners who support our community.","https://engage.goenumerate.com/s/pendletonplantation/sponsors.php","goenumerate.com"],
    [id++,"Community Portal","✉️","Contact the HOA","Send a message directly to the HOA board through the resident portal.","https://engage.goenumerate.com/s/pendletonplantation/hoapage.php?page=contact_5479","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Structural Application","Please complete this form to submit a structural architectural application.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118080","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Driveway Modifications Only","Please use this form to submit a request for any driveway modification.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118081","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Fencing Modifications Only","Please complete this form to submit an architectural application for fence installation.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118082","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Solar Panel Request","Please complete this form to submit a request for solar panel installation.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118100","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Play Structures and Basketball Goals","Please complete this form to submit a request for play structures or basketball goals.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118101","goenumerate.com"],
    [id++,"Forms & Requests","📋","Pendleton Plantation ARC Form — Landscaping and Trees","Please complete this form to submit an architectural application for landscaping improvements or trees.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118102","goenumerate.com"],
    [id++,"Forms & Requests","📋","Amenity Fob: Information/Request Form","Submit a request for an amenity fob. Pool Fobs are $50 each, limit of 1 per household.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118274","goenumerate.com"],
    [id++,"Forms & Requests","📋","Playground Survey — We Want Your Feedback!","The Board is exploring potential updates to the children's play area and would appreciate your input.","https://engage.goenumerate.com/s/pendletonplantation/dynform.php?qid=118275","goenumerate.com"],
  ];
  rows.forEach(function(r) { sh.appendRow(r); });
}

function seedDocumentsSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_DOCUMENTS, DOCUMENTS_HEADERS);
  var id = 1;
  var rows = [
    [id++,"Neighborhood Documents — Click to Download","📝","Annual Meeting Proxy Form","Pendleton Plantation HOA Annual Meeting Proxy Form — complete and submit if you cannot attend the annual meeting.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/PND%20Proxy%20-%202024%20Annual%20Meeting.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","🛠️","Architectural Review Committee Request Form (Physical Copy)","Use this form to submit a physical copy of an ARC request if you prefer not to submit through the online portal.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/ARC%20Request%20Form.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","⚖️","Pendleton Plantation Bylaws","Bylaws of the Pendleton Plantation Homeowners Association, outlining the rules and regulations governing our community.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-Bylaws.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","⚠️","Declaration of Covenants, Conditions, and Restrictions","Details the covenants, conditions, and restrictions that apply to all properties within Pendleton Plantation.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-%20Declaration%20of%20Covenants.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","📝","ARC Guidelines Updates (Effective February 2020)","Updated guidelines from the Architectural Review Committee outlining the standards and procedures for ARC requests.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20-%20ARC%20Guidelines%202020.02.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","📄","First Bylaws Amendment (Effective July 2003)","Amendments made to the original bylaws of Pendleton Plantation as of July 2003.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20Amendment%20deed%20book%20page%2000085.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","📄","Second Bylaws Amendment (Effective July 2003)","Second set of amendments to the original bylaws of Pendleton Plantation as of July 2003.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PDT%20Amendment%20deed%20book%20page%2000103.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","📄","Pool Rules (Effective 2024)","Rules and regulations for the use of the Pendleton Plantation pool.","https://engage.goenumerate.com/s/pendletonplantation/files/5479/dyn197526/PND%202024%20POOL%20RULES.pdf",""],
    [id++,"Neighborhood Documents — Click to Download","📄","Pendleton Plantation Financial Statements","Financial statements for Pendleton Plantation, including budgets, income statements, and balance sheets.","https://engage.goenumerate.com/s/pendletonplantation/dyndocuments.php?group=230231",""],
  ];
  rows.forEach(function(r) { sh.appendRow(r); });
}

function seedConfigSheet(ss) {
  var sh = getOrCreateSheet(ss, SHEET_CONFIG, CONFIG_HEADERS);
  var rows = [
    ["Current Event ID",     "EasterEggHunt2026"],
    ["Admin Password",       "qu0tingM3!"],
    ["Dashboard Password",   "w3bu!ld"],
    ["Organizer Name",       ""],
    ["Organizer Email",      "mandyvaliquette00@gmail.com"],
    ["Organizer Phone",      ""],
  ];
  rows.forEach(function(r) { sh.appendRow(r); });
}


// ============================================================
//  CONFIG HELPERS
// ============================================================
function getConfigValue(ss, key) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) return "";
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) return String(data[i][1] || "");
  }
  return "";
}

function setConfigValue(ss, key, value) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  // Key not found — add new row
  sh.appendRow([key, value]);
}

function validateAdminKey(ss, key) {
  var adminPass = getConfigValue(ss, "Admin Password");
  return key === adminPass && key !== "";
}

function getConfigAll(ss) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) return {};
  var data = sh.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < data.length; i++) { // skip header
    result[String(data[i][0])] = String(data[i][1] || "");
  }
  return result;
}

function updateConfigValues(data, ss) {
  Object.keys(data).forEach(function(key) {
    setConfigValue(ss, key, data[key]);
  });
  return { success: true };
}


// ============================================================
//  EVENT HELPERS
// ============================================================
function getCurrentEventId(ss) {
  return getConfigValue(ss, "Current Event ID") || "EasterEggHunt2026";
}

function getCurrentEventDonationItems(ss) {
  return getEventDonationItems(ss, getCurrentEventId(ss));
}

function getEventDonationItems(ss, eventId) {
  var sh = ss.getSheetByName(SHEET_DONATION_ITEMS);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === eventId) {
      items.push({
        category: String(data[i][1] || ""),
        label:    String(data[i][2] || ""),
        needed:   data[i][3] !== "" ? Number(data[i][3]) : null,
      });
    }
  }
  return items;
}

function getEventDonationItemsByCategory(ss, eventId) {
  var flat = getEventDonationItems(ss, eventId);
  var catMap = {};
  var catOrder = [];
  flat.forEach(function(item) {
    if (!catMap[item.category]) {
      catMap[item.category] = [];
      catOrder.push(item.category);
    }
    catMap[item.category].push({ label: item.label, needed: item.needed });
  });
  return catOrder.map(function(cat) {
    return { category: cat, items: catMap[cat] };
  });
}

function getEventVolunteerRoles(ss, eventId) {
  var sh = ss.getSheetByName(SHEET_VOL_ROLES);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var roles = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === eventId) {
      roles.push({ label: String(data[i][1] || ""), detail: String(data[i][2] || "") });
    }
  }
  return roles;
}

function getNextEvent(ss) {
  var sh = ss.getSheetByName(SHEET_EVENTS);
  if (!sh || sh.getLastRow() <= 1) return null;
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  var today = new Date();
  today.setHours(0,0,0,0);
  var next = null;
  var nextDate = null;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dateStr = String(row[col["Event Date"]] || "");
    if (!dateStr) continue;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    if (d < today) continue;
    if (!next || d < nextDate) {
      next = row;
      nextDate = d;
    }
  }
  if (!next) return null;
  return buildEventObject(next, col);
}

function buildEventObject(row, col) {
  return {
    eventId:              String(row[col["Event ID"]]                   || ""),
    eventName:            String(row[col["Event Name"]]                 || ""),
    status:               String(row[col["Status"]]                     || ""),
    eventDate:            String(row[col["Event Date"]]                 || ""),
    eventTime:            String(row[col["Event Time"]]                 || ""),
    signUpsOpenDate:      String(row[col["Sign-Ups Open Date"]]         || ""),
    shortDescription:     String(row[col["Short Description"]]          || ""),
    mediumDescription:    String(row[col["Medium Description"]]         || ""),
    longDescription:      String(row[col["Long Description"]]           || ""),
    emojiRow:             String(row[col["Emoji Row"]]                  || ""),
    headlineAdjective:    String(row[col["Headline Adjective"]]         || ""),
    locationName:         String(row[col["Location Name"]]              || ""),
    locationAddress:      String(row[col["Location Address"]]           || ""),
    bannerColorClass:     String(row[col["Banner Color Class"]]         || "card-color-1"),
    icsStart:             String(row[col["ICS Start"]]                  || ""),
    icsEnd:               String(row[col["ICS End"]]                    || ""),
    organizerName:        String(row[col["Organizer Name"]]             || ""),
    organizerAddress:     String(row[col["Organizer Address"]]          || ""),
    organizerPhone:       String(row[col["Organizer Phone"]]            || ""),
    organizerEmail:       String(row[col["Organizer Email"]]            || ""),
    organizerContact:     String(row[col["Organizer Preferred Contact"]]|| ""),
  };
}


// ============================================================
//  SIGN-UP HANDLER (doPost default)
// ============================================================
function handleSignup(params, ss) {
  try {
    var currentEventId = getCurrentEventId(ss);
    var currentEventName = params.event || currentEventId;

    // Parse volunteer roles
    var volunteerRoles = params.volunteer_roles || "None selected";

    // Parse donation items string "Label: qty, Label: qty, ..."
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

    // Get or create the Signups sheet
    var sheet = ss.getSheetByName(SHEET_SIGNUPS);
    var donationItems = getCurrentEventDonationItems(ss);
    var donationLabels = donationItems.map(function(d) { return d.label; });

    if (!sheet) {
      // Create fresh Signups sheet
      var allHeaders = CORE_HEADERS.concat(donationLabels);
      sheet = ss.insertSheet(SHEET_SIGNUPS);
      sheet.appendRow(allHeaders);
      var hr = sheet.getRange(1, 1, 1, allHeaders.length);
      hr.setFontWeight("bold").setBackground("#f4c8c0").setFontColor("#5a2a27");
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1000, allHeaders.length)
           .applyRowBanding(SpreadsheetApp.BandingTheme.PINK, true, false);
      sheet.autoResizeColumns(1, allHeaders.length);
    } else {
      // Ensure donation columns exist (in case event changed)
      var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      donationLabels.forEach(function(lbl) {
        if (existingHeaders.indexOf(lbl) === -1) {
          var newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue(lbl)
               .setFontWeight("bold").setBackground("#f4c8c0").setFontColor("#5a2a27");
          existingHeaders.push(lbl);
        }
      });
    }

    // Re-read headers to build col map
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    headers.forEach(function(h, i) { colMap[h] = i; });

    // Build the data row
    var row = new Array(headers.length).fill("");
    row[colMap["Timestamp"]]         = new Date();
    row[colMap["First Name"]]        = params.first_name      || "";
    row[colMap["Last Name"]]         = params.last_name       || "";
    row[colMap["Email"]]             = params.email           || "";
    row[colMap["Phone"]]             = params.phone           || "";
    row[colMap["Address"]]           = params.address         || "";
    row[colMap["Attending?"]]        = params.attending       || "";
    row[colMap["# Adults"]]          = params.num_adults      || "";
    row[colMap["# Children"]]        = params.num_children    || "";
    row[colMap["Ages 0-3"]]          = params.children_0_3    || "0";
    row[colMap["Ages 4-8"]]          = params.children_4_8    || "0";
    row[colMap["Ages 9+"]]           = params.children_9_plus || "0";
    row[colMap["Potluck Item"]]      = params.potluck_item    || "";
    row[colMap["Volunteer Roles"]]   = volunteerRoles;
    row[colMap["Other Donation"]]    = params.other_donation  || "";
    row[colMap["Notes"]]             = params.notes           || "";
    row[colMap["Heard About"]]       = params.heard_about     || "";
    row[colMap["Special Skills"]]    = params.special_skills  || "";
    row[colMap["Opt-In: Events"]]    = params.opt_in_events     || "No";
    row[colMap["Opt-In: Newsletter"]]= params.opt_in_newsletter || "No";
    row[colMap["Cash Donation"]]     = params.cash_donation   || "";
    row[colMap["Event"]]             = currentEventName;
    if (colMap["Lookup Password"] !== undefined) {
      row[colMap["Lookup Password"]] = params.lookup_password || "";
    }

    // Donation quantities
    donationLabels.forEach(function(lbl) {
      if (colMap[lbl] !== undefined) {
        row[colMap[lbl]] = donationMap[lbl] || 0;
      }
    });

    sheet.appendRow(row);
    sheet.autoResizeColumns(1, headers.length);

    // Send notification email
    var notificationEmail = getConfigValue(ss, "Organizer Email") || "mandyvaliquette00@gmail.com";
    var donationLines = Object.keys(donationMap).map(function(k) {
      return "  " + k + ": " + donationMap[k];
    }).join("\n") || "  None selected";

    var subject = "New Sign-Up: " + currentEventName + " \u2014 "
                + (params.first_name || "") + " " + (params.last_name || "");
    var body =
      "You have a new sign-up for " + currentEventName + "!\n\n" +
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
      "NAME:       " + (params.first_name || "") + " " + (params.last_name || "") + "\n" +
      "EMAIL:      " + (params.email   || "\u2014") + "\n" +
      "PHONE:      " + (params.phone   || "\u2014") + "\n" +
      "ADDRESS:    " + (params.address || "\u2014") + "\n\n" +
      "ATTENDING?  " + (params.attending    || "\u2014") + "\n" +
      "ADULTS:     " + (params.num_adults   || "0")  + "\n" +
      "CHILDREN:   " + (params.num_children || "0")  +
        "  (Ages 0\u20133: " + (params.children_0_3    || "0") +
        "  |  Ages 4\u20138: " + (params.children_4_8  || "0") +
        "  |  Ages 9+: "  + (params.children_9_plus || "0") + ")\n" +
      "POTLUCK:    " + (params.potluck_item  || "\u2014") + "\n\n" +
      "VOLUNTEERING FOR:\n  " + volunteerRoles.replace(/,/g, "\n  ") + "\n\n" +
      "DONATING:\n" + donationLines + "\n\n" +
      "OTHER DONATION: " + (params.other_donation || "\u2014") + "\n\n" +
      "NOTES:\n" + (params.notes || "\u2014") + "\n\n" +
      "HEARD ABOUT:    " + (params.heard_about       || "\u2014") + "\n" +
      "SPECIAL SKILLS: " + (params.special_skills    || "\u2014") + "\n" +
      "OPT-IN EVENTS:  " + (params.opt_in_events     || "No")     + "\n" +
      "OPT-IN NEWS:    " + (params.opt_in_newsletter || "No")     + "\n" +
      "CASH DONATION:  " + (params.cash_donation     || "\u2014") + "\n\n" +
      "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
      "View all responses in your Google Sheet.";

    MailApp.sendEmail(notificationEmail, subject, body);

    return json({ result: "success" });
  } catch (err) {
    return json({ result: "error", error: err.toString() });
  }
}


// ============================================================
//  LOOKUP HANDLER (dashboard "My Sign-Up")
// ============================================================
function handleLookup(params, ss) {
  try {
    var query    = String(params.name     || "").trim().toLowerCase();
    var password = String(params.password || "").trim();

    if (!query) return json({ results: [] });

    var sheet = ss.getSheetByName(SHEET_SIGNUPS);
    if (!sheet || sheet.getLastRow() <= 1) return json({ results: [] });

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);
    var col = {};
    headers.forEach(function(h, i) { col[h] = i; });

    var results = [];
    rows.forEach(function(row) {
      var fn   = String(row[col["First Name"]] || "").trim();
      var ln   = String(row[col["Last Name"]]  || "").trim();
      var full = (fn + " " + ln).trim();
      if (full.toLowerCase().indexOf(query) === -1) return;

      // Password validation
      var storedPw = String(row[col["Lookup Password"]] || "").trim();
      if (storedPw !== "" && storedPw !== password) {
        // Name matches but password wrong — include a "locked" placeholder
        results.push({ name: full, locked: true });
        return;
      }
      if (storedPw === "" && password === "") {
        // No password set and none provided — allow access (legacy entries)
      }

      var donationItems = getCurrentEventDonationItems(ss);
      var donations = [];
      donationItems.forEach(function(d) {
        if (col[d.label] !== undefined) {
          var qty = Number(row[col[d.label]] || 0) || 0;
          if (qty > 0) donations.push({ item: d.label, qty: qty });
        }
      });

      var roles = String(row[col["Volunteer Roles"]] || "")
        .split(",").map(function(r) { return r.trim(); })
        .filter(function(r) { return r && r !== "None selected"; });

      results.push({
        name:          full,
        locked:        false,
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

    return json({ results: results });
  } catch (err) {
    return json({ results: [], error: err.toString() });
  }
}


// ============================================================
//  DASHBOARD SUMMARY (doGet default — backward-compatible)
// ============================================================
function getDashboardSummary(ss) {
  var empty = {
    totalSignups: 0, attendingCount: 0,
    totalAdults: 0, totalChildren: 0,
    ages_0_3: 0, ages_4_8: 0, ages_9_plus: 0,
    volunteerCounts: {}, volunteerDetails: {},
    donationCounts: {}, potluckItems: [], attendees: [],
    volunteerRoles: [], donationCategories: [],
    lastUpdated: new Date().toISOString(),
  };

  try {
    var sheet = ss.getSheetByName(SHEET_SIGNUPS);
    if (!sheet || sheet.getLastRow() <= 1) return json(empty);

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);
    var col = {};
    headers.forEach(function(h, i) { col[h] = i; });

    // Identify donation columns (all headers not in CORE_HEADER_SET)
    var donationCols = headers.filter(function(h) { return !CORE_HEADER_SET[h]; });

    var totalSignups    = rows.length;
    var attendingCount  = 0;
    var totalAdults     = 0;
    var totalChildren   = 0;
    var ages_0_3        = 0;
    var ages_4_8        = 0;
    var ages_9_plus     = 0;
    var volunteerCounts = {};
    var volunteerDetails= {};
    var donationCounts  = {};
    var potluckItems    = [];
    var attendees       = [];

    rows.forEach(function(row) {
      var att = String(row[col["Attending?"]] || "");
      if (att.indexOf("Yes") === 0) attendingCount++;

      totalAdults   += Number(row[col["# Adults"]]   || 0) || 0;
      totalChildren += Number(row[col["# Children"]] || 0) || 0;
      ages_0_3      += Number(row[col["Ages 0-3"]]   || 0) || 0;
      ages_4_8      += Number(row[col["Ages 4-8"]]   || 0) || 0;
      ages_9_plus   += Number(row[col["Ages 9+"]]    || 0) || 0;

      var p = String(row[col["Potluck Item"]] || "").trim();
      if (p) potluckItems.push(p);

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

      var attFirst = String(row[col["First Name"]] || "").trim();
      var attLast  = String(row[col["Last Name"]]  || "").trim();
      var attRoles = String(row[col["Volunteer Roles"]] || "")
        .split(",").map(function(r) { return r.trim(); })
        .filter(function(r) { return r && r !== "None selected"; });
      attendees.push({
        name:      (attFirst + " " + attLast).trim(),
        attending: String(row[col["Attending?"]] || ""),
        adults:    Number(row[col["# Adults"]]   || 0) || 0,
        children:  Number(row[col["# Children"]] || 0) || 0,
        roles:     attRoles,
      });

      donationCols.forEach(function(item) {
        var qty = Number(row[col[item]] || 0) || 0;
        if (qty > 0) donationCounts[item] = (donationCounts[item] || 0) + qty;
      });
    });

    // Include roles and categories from sheet for dashboard to use
    var currentEventId = getCurrentEventId(ss);
    var volRoles = getEventVolunteerRoles(ss, currentEventId);
    var donCats  = getEventDonationItemsByCategory(ss, currentEventId);

    return json({
      totalSignups: totalSignups, attendingCount: attendingCount,
      totalAdults: totalAdults, totalChildren: totalChildren,
      ages_0_3: ages_0_3, ages_4_8: ages_4_8, ages_9_plus: ages_9_plus,
      volunteerCounts: volunteerCounts, volunteerDetails: volunteerDetails,
      donationCounts: donationCounts, potluckItems: potluckItems,
      attendees: attendees,
      volunteerRoles: volRoles,
      donationCategories: donCats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    empty.error = err.toString();
    return json(empty);
  }
}


// ============================================================
//  EVENT MANAGEMENT
// ============================================================
function getNextEventData(ss) {
  var ev = getNextEvent(ss);
  if (!ev) return { event: null };
  ev.volunteerRoles   = getEventVolunteerRoles(ss, ev.eventId);
  ev.donationItems    = getEventDonationItemsByCategory(ss, ev.eventId);
  return { event: ev };
}

function getAllEventsPublic(ss) {
  return getAllEventsRaw(ss);
}

function getAllEventsAdmin(ss) {
  return getAllEventsRaw(ss);
}

function getAllEventsRaw(ss) {
  var sh = ss.getSheetByName(SHEET_EVENTS);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });
  return data.slice(1).map(function(row) { return buildEventObject(row, col); });
}

function saveEvent(data, ss) {
  var sh = getOrCreateSheet(ss, SHEET_EVENTS, EVENTS_HEADERS);
  var rows = sh.getDataRange().getValues();
  var headers = rows[0];
  var col = {};
  headers.forEach(function(h, i) { col[h] = i; });

  // Find existing row
  var rowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][col["Event ID"]]) === data.eventId) { rowIdx = i + 1; break; }
  }

  var newRow = [
    data.eventId, data.eventName, data.status, data.eventDate, data.eventTime,
    data.signUpsOpenDate, data.shortDescription, data.mediumDescription,
    data.longDescription, data.emojiRow, data.headlineAdjective,
    data.locationName, data.locationAddress, data.bannerColorClass,
    data.icsStart, data.icsEnd,
    data.organizerName, data.organizerAddress, data.organizerPhone,
    data.organizerEmail, data.organizerContact,
  ];

  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  } else {
    sh.appendRow(newRow);
  }

  // Save volunteer roles and donation items
  if (data.volunteerRoles) saveEventVolunteerRoles(data.eventId, data.volunteerRoles, ss);
  if (data.donationItems)  saveEventDonationItems(data.eventId, data.donationItems, ss);

  return { success: true };
}

function saveEventVolunteerRoles(eventId, roles, ss) {
  var sh = getOrCreateSheet(ss, SHEET_VOL_ROLES, VOL_ROLES_HEADERS);
  // Delete existing rows for this event
  deleteRowsForEvent(sh, 0, eventId);
  roles.forEach(function(r) {
    sh.appendRow([eventId, r.label, r.detail]);
  });
}

function saveEventDonationItems(eventId, categories, ss) {
  var sh = getOrCreateSheet(ss, SHEET_DONATION_ITEMS, DONATION_ITEMS_HEADERS);
  deleteRowsForEvent(sh, 0, eventId);
  categories.forEach(function(cat) {
    (cat.items || []).forEach(function(item) {
      sh.appendRow([eventId, cat.category, item.label, item.needed !== null ? item.needed : ""]);
    });
  });
}

function deleteRowsForEvent(sh, colIdx, eventId) {
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return;
  var data = sh.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  // Delete from bottom up
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0]) === eventId) sh.deleteRow(i + 2);
  }
}

function deleteEvent(eventId, ss) {
  var sh = ss.getSheetByName(SHEET_EVENTS);
  if (!sh) return { success: false };
  deleteSheetRow(sh, "Event ID", eventId);
  // Also remove roles and items
  var rsh = ss.getSheetByName(SHEET_VOL_ROLES);
  if (rsh) deleteRowsForEvent(rsh, 0, eventId);
  var dsh = ss.getSheetByName(SHEET_DONATION_ITEMS);
  if (dsh) deleteRowsForEvent(dsh, 0, eventId);
  return { success: true };
}

function archiveAndAdvance(ss) {
  var currentId = getCurrentEventId(ss);
  var signupsSh = ss.getSheetByName(SHEET_SIGNUPS);

  if (signupsSh) {
    // Copy to archive sheet named by event ID
    var archiveName = currentId;
    var existing = ss.getSheetByName(archiveName);
    if (existing) ss.deleteSheet(existing);
    signupsSh.copyTo(ss).setName(archiveName);
    ss.deleteSheet(signupsSh);
  }

  // Find next upcoming event
  var next = getNextEvent(ss);
  var nextId = next ? next.eventId : "";

  if (nextId) {
    setConfigValue(ss, "Current Event ID", nextId);
    // Create fresh Signups sheet for the new event
    var donationItems = getEventDonationItems(ss, nextId);
    var donationLabels = donationItems.map(function(d) { return d.label; });
    var allHeaders = CORE_HEADERS.concat(donationLabels);
    var newSheet = ss.insertSheet(SHEET_SIGNUPS);
    newSheet.appendRow(allHeaders);
    var hr = newSheet.getRange(1, 1, 1, allHeaders.length);
    hr.setFontWeight("bold").setBackground("#f4c8c0").setFontColor("#5a2a27");
    newSheet.setFrozenRows(1);
    newSheet.getRange(1, 1, 1000, allHeaders.length)
            .applyRowBanding(SpreadsheetApp.BandingTheme.PINK, true, false);
    newSheet.autoResizeColumns(1, allHeaders.length);
  }

  return { success: true, archivedAs: currentId, nextEventId: nextId };
}


// ============================================================
//  AWARD CONTESTS
// ============================================================
function getAllAwardContests(ss) {
  return readSheetAsObjects(ss, SHEET_AWARD_CONTESTS, AWARD_CONTESTS_HEADERS);
}

function saveAwardContest(data, ss) {
  var sh = getOrCreateSheet(ss, SHEET_AWARD_CONTESTS, AWARD_CONTESTS_HEADERS);
  var rows = sh.getDataRange().getValues();
  var col = buildColMap(rows[0]);
  var rowIdx = findRowByKey(rows, col["Contest ID"], data.contestId);
  var newRow = [
    data.contestId, data.icon, data.badge, data.bannerColor,
    data.awardName, data.category, data.period, data.status,
    data.description, data.deadline, data.prize,
  ];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  else sh.appendRow(newRow);
  return { success: true };
}

function deleteAwardContest(contestId, ss) {
  deleteSheetRow(ss.getSheetByName(SHEET_AWARD_CONTESTS), "Contest ID", contestId);
  return { success: true };
}


// ============================================================
//  WINNERS
// ============================================================
function getAllWinners(ss) {
  return readSheetAsObjects(ss, SHEET_WINNERS, null);
}

function saveWinner(data, ss) {
  var sh = ss.getSheetByName(SHEET_WINNERS);
  if (!sh) return { success: false, error: "Winners sheet not found" };
  var rows = sh.getDataRange().getValues();
  var col = buildColMap(rows[0]);
  // Find by award + period as composite key
  var rowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][col["award"]]) === data.award &&
        String(rows[i][col["period"]]) === data.period) {
      rowIdx = i + 1; break;
    }
  }
  var headers = rows[0];
  var newRow = headers.map(function(h) { return data[h] !== undefined ? data[h] : ""; });
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, newRow.length).setValues([newRow]);
  else sh.appendRow(newRow);
  return { success: true };
}

function deleteWinner(winnerId, ss) {
  // winnerId is "award|period"
  var parts = (winnerId || "").split("|");
  var award  = parts[0] || "";
  var period = parts[1] || "";
  var sh = ss.getSheetByName(SHEET_WINNERS);
  if (!sh || sh.getLastRow() <= 1) return { success: false };
  var data = sh.getDataRange().getValues();
  var col = buildColMap(data[0]);
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col["award"]]) === award && String(data[i][col["period"]]) === period) {
      sh.deleteRow(i + 1);
    }
  }
  return { success: true };
}

function getWinnerPrep(ss) {
  return readSheetAsObjects(ss, SHEET_WINNER_PREP, null);
}

function promoteWinnerPrep(rowId, ss) {
  var prep = ss.getSheetByName(SHEET_WINNER_PREP);
  var winners = ss.getSheetByName(SHEET_WINNERS);
  if (!prep || !winners || rowId < 2) return { success: false };
  var prepRow = prep.getRange(rowId, 1, 1, prep.getLastColumn()).getValues()[0];
  var prepHeaders = prep.getRange(1, 1, 1, prep.getLastColumn()).getValues()[0];
  var winHeaders  = winners.getRange(1, 1, 1, winners.getLastColumn()).getValues()[0];
  var prepCol = buildColMap(prepHeaders);
  var newRow = winHeaders.map(function(h) {
    return prepCol[h] !== undefined ? prepRow[prepCol[h]] : "";
  });
  winners.appendRow(newRow);
  return { success: true };
}


// ============================================================
//  ANNOUNCEMENTS
// ============================================================
function getAllAnnouncements(ss, adminMode) {
  var sh = ss.getSheetByName(SHEET_ANNOUNCEMENTS);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getDataRange().getValues();
  var col = buildColMap(data[0]);
  return data.slice(1)
    .filter(function(row) {
      if (adminMode) return true;
      return String(row[col["Published"]] || "") === "Y";
    })
    .map(function(row, i) {
      return {
        rowId:    i + 2,
        id:       String(row[col["ID"]]         || ""),
        day:      String(row[col["Day"]]         || ""),
        month:    String(row[col["Month"]]       || ""),
        title:    String(row[col["Title"]]       || ""),
        body:     String(row[col["Body"]]        || ""),
        link:     String(row[col["Link"]]        || ""),
        linkText: String(row[col["Link Text"]]   || ""),
        published:String(row[col["Published"]]   || "N"),
      };
    });
}

function saveAnnouncement(data, ss) {
  var sh = getOrCreateSheet(ss, SHEET_ANNOUNCEMENTS, ANNOUNCEMENTS_HEADERS);
  if (data.id) {
    // Update existing
    var rows = sh.getDataRange().getValues();
    var col = buildColMap(rows[0]);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][col["ID"]]) === String(data.id)) {
        sh.getRange(i + 1, 1, 1, 8).setValues([[
          data.id, data.day, data.month, data.title, data.body,
          data.link || "", data.linkText || "", data.published || "N",
        ]]);
        return { success: true };
      }
    }
  }
  // New: assign next ID
  var nextId = sh.getLastRow(); // header + existing rows = next id
  sh.appendRow([nextId, data.day, data.month, data.title, data.body,
                data.link || "", data.linkText || "", data.published || "N"]);
  return { success: true };
}

function deleteAnnouncement(id, ss) {
  deleteSheetRow(ss.getSheetByName(SHEET_ANNOUNCEMENTS), "ID", id);
  return { success: true };
}


// ============================================================
//  MEMORIES (reads Memory Submissions sheet)
// ============================================================
function getAllMemories(ss) {
  var sh = ss.getSheetByName(SHEET_MEMORIES);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getDataRange().getValues();
  var col = buildColMap(data[0]);
  return data.slice(1).map(function(row, i) {
    var photoUrls = String(row[col["Photo URLs"]] || "").split("\n").filter(Boolean);
    var photoIds  = photoUrls.map(extractDriveId).filter(Boolean);
    return {
      rowId:    i + 2,
      date:     row[col["Timestamp"]] ? new Date(row[col["Timestamp"]]).toLocaleDateString() : "",
      uploader: String(row[col["Uploader Name"]] || ""),
      email:    String(row[col["Email"]] || ""),
      event:    String(row[col["Event Name"]] || ""),
      caption:  String(row[col["Caption / Message"]] || ""),
      photoIds: photoIds,
      approved: String(row[col["Approved"]] || "Y"),
    };
  });
}

function approveMemory(rowId, ss) {
  var sh = ss.getSheetByName(SHEET_MEMORIES);
  if (!sh) return { success: false };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = buildColMap(headers);
  var approvedCol = col["Approved"];
  if (approvedCol === undefined) return { success: false, error: "Approved column not found" };
  sh.getRange(rowId, approvedCol + 1).setValue("Y");
  return { success: true };
}

function editMemory(data, ss) {
  var sh = ss.getSheetByName(SHEET_MEMORIES);
  if (!sh) return { success: false };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = buildColMap(headers);
  if (data.caption  !== undefined && col["Caption / Message"] !== undefined)
    sh.getRange(data.rowId, col["Caption / Message"] + 1).setValue(data.caption);
  if (data.event    !== undefined && col["Event Name"] !== undefined)
    sh.getRange(data.rowId, col["Event Name"] + 1).setValue(data.event);
  return { success: true };
}

function deleteMemory(rowId, ss) {
  var sh = ss.getSheetByName(SHEET_MEMORIES);
  if (!sh) return { success: false };
  sh.deleteRow(rowId);
  return { success: true };
}


// ============================================================
//  BULLETIN BOARD (reads Bulletin Board sheet)
// ============================================================
function getAllBulletinPosts(ss) {
  var sh = ss.getSheetByName(SHEET_BULLETIN);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getDataRange().getValues();
  var col = buildColMap(data[0]);
  return data.slice(1).map(function(row, i) {
    var photoUrls = String(row[col["Photo URLs"]] || "").split("\n").filter(Boolean);
    var photoIds  = photoUrls.map(extractDriveId).filter(Boolean);
    return {
      rowId:     i + 2,
      date:      row[col["Timestamp"]] ? new Date(row[col["Timestamp"]]).toLocaleDateString() : "",
      name:      String(row[col["Name"]]      || ""),
      email:     String(row[col["Email"]]     || ""),
      category:  String(row[col["Category"]]  || ""),
      title:     String(row[col["Title"]]     || ""),
      content:   String(row[col["Content"]]   || ""),
      photoIds:  photoIds,
      approved:  String(row[col["Approved"]]  || "N"),
      showPhone: String(row[col["Show Phone"]]|| "N"),
      showEmail: String(row[col["Show Email"]]|| "N"),
    };
  });
}

function approveBulletinPost(rowId, ss) {
  var sh = ss.getSheetByName(SHEET_BULLETIN);
  if (!sh) return { success: false };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = buildColMap(headers);
  if (col["Approved"] !== undefined) sh.getRange(rowId, col["Approved"] + 1).setValue("Y");
  return { success: true };
}

function editBulletinPost(data, ss) {
  var sh = ss.getSheetByName(SHEET_BULLETIN);
  if (!sh) return { success: false };
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = buildColMap(headers);
  if (data.title    !== undefined && col["Title"]    !== undefined)
    sh.getRange(data.rowId, col["Title"]    + 1).setValue(data.title);
  if (data.content  !== undefined && col["Content"]  !== undefined)
    sh.getRange(data.rowId, col["Content"]  + 1).setValue(data.content);
  if (data.category !== undefined && col["Category"] !== undefined)
    sh.getRange(data.rowId, col["Category"] + 1).setValue(data.category);
  return { success: true };
}

function deleteBulletinPost(rowId, ss) {
  var sh = ss.getSheetByName(SHEET_BULLETIN);
  if (!sh) return { success: false };
  sh.deleteRow(rowId);
  return { success: true };
}


// ============================================================
//  LINKS
// ============================================================
function getAllLinks(ss) {
  return readSheetAsObjects(ss, SHEET_LINKS, LINKS_HEADERS);
}

function saveLink(data, ss) {
  var sh = getOrCreateSheet(ss, SHEET_LINKS, LINKS_HEADERS);
  if (data.id) {
    var rows = sh.getDataRange().getValues();
    var col = buildColMap(rows[0]);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][col["ID"]]) === String(data.id)) {
        sh.getRange(i + 1, 1, 1, 7).setValues([[
          data.id, data.category, data.icon, data.title,
          data.description, data.url, data.urlLabel || "",
        ]]);
        return { success: true };
      }
    }
  }
  var nextId = sh.getLastRow();
  sh.appendRow([nextId, data.category, data.icon, data.title,
                data.description, data.url, data.urlLabel || ""]);
  return { success: true };
}

function deleteLink(id, ss) {
  deleteSheetRow(ss.getSheetByName(SHEET_LINKS), "ID", id);
  return { success: true };
}


// ============================================================
//  DOCUMENTS
// ============================================================
function getAllDocuments(ss) {
  return readSheetAsObjects(ss, SHEET_DOCUMENTS, DOCUMENTS_HEADERS);
}

function saveDocument(data, ss) {
  var sh = getOrCreateSheet(ss, SHEET_DOCUMENTS, DOCUMENTS_HEADERS);
  if (data.id) {
    var rows = sh.getDataRange().getValues();
    var col = buildColMap(rows[0]);
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][col["ID"]]) === String(data.id)) {
        sh.getRange(i + 1, 1, 1, 7).setValues([[
          data.id, data.category, data.icon, data.title,
          data.description, data.url, data.urlLabel || "",
        ]]);
        return { success: true };
      }
    }
  }
  var nextId = sh.getLastRow();
  sh.appendRow([nextId, data.category, data.icon, data.title,
                data.description, data.url, data.urlLabel || ""]);
  return { success: true };
}

function deleteDocument(id, ss) {
  deleteSheetRow(ss.getSheetByName(SHEET_DOCUMENTS), "ID", id);
  return { success: true };
}


// ============================================================
//  UTILITY / HELPER FUNCTIONS
// ============================================================
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg) {
  return json({ error: msg });
}

function parseData(str) {
  try { return JSON.parse(str || "{}"); } catch (e) { return {}; }
}

function buildColMap(headers) {
  var m = {};
  (headers || []).forEach(function(h, i) { m[String(h)] = i; });
  return m;
}

function findRowByKey(rows, colIdx, key) {
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][colIdx]) === String(key)) return i + 1;
  }
  return -1;
}

function deleteSheetRow(sh, headerName, value) {
  if (!sh || sh.getLastRow() <= 1) return;
  var data = sh.getDataRange().getValues();
  var col = buildColMap(data[0]);
  var colIdx = col[headerName];
  if (colIdx === undefined) return;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIdx]) === String(value)) sh.deleteRow(i + 1);
  }
}

function readSheetAsObjects(ss, sheetName, defaultHeaders) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return obj;
  });
}

function extractDriveId(url) {
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
