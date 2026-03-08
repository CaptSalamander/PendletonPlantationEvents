# Pendleton Plantation — Community Hub Website

Live site: [pendletonplantation.com](https://pendletonplantation.com)

A neighborhood community website for Pendleton Plantation in Easley, South Carolina, built to connect residents through events, recognition, and shared memories.

---

## Project Files

| File | Purpose |
|---|---|
| `index.html` | Main homepage |
| `index-styles.css` | Homepage styles |
| `memories.html` | Neighborhood photo/video gallery |
| `memories-styles.css` | Gallery styles |
| `documents.html` | Community documents page |
| `documents-styles.css` | Documents page styles |
| `links.html` | Community links page |
| `links-styles.css` | Links page styles |
| `dashboard.html` | Sign-up dashboard for event organizers |
| `dashboard-styles.css` | Dashboard styles |
| `styles.css` | Shared/global styles |
| `community-signup-form.html` | Event sign-up form (embeddable) |
| `google-apps-script.gs` | Google Apps Script for form → Google Sheet |
| `images/` | Photos and video for the gallery |

---

## Site Sections

**Navigation:** Home, Awards, Events, Memories, Announcements, Contact, Sign-Up, Links, Documents

### Special Recognition Awards
Four community award categories:
- Yard of the Month
- Best Seasonal Decoration
- Neighborhood Hero
- Above & Beyond

### Neighborhood Events
Upcoming community gatherings displayed as event cards with date, time, description, and sign-up links:
- Easter Egg Hunt — March 21, 2025
- Ice Cream Social — May 2025
- 4th of July Block Party — July 2025
- Shrimp Boil — Summer 2025
- Halloween Trunk or Treat — October 2025
- Holiday Lights Contest — December 2025

### Neighborhood Memories
Community photo and video gallery featuring Halloween 2025 event images. Residents can submit additional photos.

### HOA Announcements
Timeline of neighborhood updates (Easter Egg Hunt sign-ups open, website launch, HOA meeting recaps, etc.)

### Contact
Links to email the organizer, the event sign-up form, Nextdoor group, and Facebook community group.

---

## Event Sign-Up Form + Google Sheet Integration

The `community-signup-form.html` form connects to a Google Sheet via `google-apps-script.gs`.

### STEP 1 — Create Your Google Sheet

1. Go to **Google Drive** (drive.google.com)
2. Click **New → Google Sheets → Blank spreadsheet**
3. Name it something like `Easter Egg Hunt 2025 — Signups`

### STEP 2 — Add the Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete the existing code and paste in everything from `google-apps-script.gs`
3. Update these two lines near the top:
   ```
   var NOTIFICATION_EMAIL = "your@email.com";
   var EVENT_NAME = "Easter Egg Hunt 2025";
   ```
4. Save (Ctrl+S / Cmd+S)

### STEP 3 — Deploy as a Web App

1. Click **Deploy → New deployment**
2. Select type: **Web app**
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone  ← this is important!
4. Click **Deploy** and authorize when prompted
5. Copy the Web app URL (`https://script.google.com/macros/s/...`)

### STEP 4 — Connect the Form

1. Open `community-signup-form.html` in a text editor
2. Find and replace:
   ```
   var SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";
   ```
   with the URL from Step 3, then save.

### STEP 5 — Test

1. Open `community-signup-form.html` in a browser
2. Submit a test entry
3. Confirm a new row appears in the **Signups** tab of your Google Sheet
4. Confirm you received a notification email

---

## Sign-Up Dashboard

`dashboard.html` provides an organizer view of event sign-ups, accessible via the Sign-Up link in the nav.

---

## Customizing for Future Events

Look for `✏️ EDIT` comments in the HTML files. Key things to update each event cycle:

| What to change | Where |
|---|---|
| Event title & headline | Top of `<body>` in the form HTML |
| Date, time, location | The `event-meta` div |
| Volunteer options | The `volunteer-grid` div |
| Donation options | The `donate-grid` div |
| Event name in submissions | `var EVENT_NAME` in the `<script>` tag |

For the Apps Script, update `EVENT_NAME` at the top of `google-apps-script.gs` and redeploy: **Deploy → Manage deployments → edit → New version → Deploy**.

---

## Viewing Responses

All submissions are saved in the Google Sheet's **Signups** tab:

| Timestamp | First Name | Last Name | Email | Phone | Address | Attending? | # Children | Volunteer Roles | Donations | Other Donation | Notes | Event |

Email notifications arrive for every submission with all details formatted.

---

## Troubleshooting

**Nothing appears in the sheet after form submit**
→ Confirm "Who has access" is **Anyone** (not "Anyone with Google account") in Step 3.

**Script authorization error**
→ In Apps Script: Run → Run function → doGet to trigger the auth dialog.

**Need to update the script after deploying**
→ Make changes, then Deploy → Manage deployments → pencil icon → New version → Deploy.
