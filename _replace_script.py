import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

new_tail = '''    // ── HELPERS ───────────────────────────────────────────────
    function esc(s) {
      return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
    function badge(val) {
      val = String(val||"").toLowerCase();
      return `<span class="badge badge-${val}">${esc(val)}</span>`;
    }
    function fmtDate(isoStr) {
      if (!isoStr) return "";
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    }
    function extractDriveIds(urls) {
      return (urls||[]).map(url => {
        if (!url) return null;
        const m = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        return m2 ? m2[1] : null;
      }).filter(Boolean);
    }

    // ── TOAST ─────────────────────────────────────────────────
    function toast(msg, type) {
      const el = document.createElement("div");
      el.className = "toast " + (type || "");
      el.textContent = msg;
      document.getElementById("toast-container").appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }

    // ── MODAL ─────────────────────────────────────────────────
    function showModal(icon, title, body, onConfirm) {
      document.getElementById("modal-icon").textContent  = icon;
      document.getElementById("modal-title").textContent = title;
      document.getElementById("modal-body").textContent  = body;
      document.getElementById("confirm-modal").classList.remove("hidden");
      modalCallback = onConfirm;
    }
    function closeModal() {
      document.getElementById("confirm-modal").classList.add("hidden");
      modalCallback = null;
    }
    function modalConfirm() { closeModal(); if (modalCallback) modalCallback(); }


    // ── LOGIN / AUTH ──────────────────────────────────────────
    async function doLogin() {
      const email = document.getElementById("login-email").value.trim();
      const pw    = document.getElementById("login-password").value;
      const err   = document.getElementById("login-error");
      const card  = document.getElementById("login-card");
      if (!email || !pw) { err.textContent = "Please enter email and password."; return; }

      const { data: authData, error: authErr } = await db.auth.signInWithPassword({ email, password: pw });
      if (authErr) {
        err.textContent = "Incorrect email or password.";
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
        return;
      }

      const { data: profile } = await db.from('profiles').select('role').eq('id', authData.user.id).single();
      if (!profile || profile.role !== 'admin') {
        err.textContent = "This account does not have admin access.";
        await db.auth.signOut();
        return;
      }

      showAdminUI();
    }

    function showAdminUI() {
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("admin-ui").style.display    = "block";
      loadCurrentPanel();
      loadSettings();
    }

    async function doLogout() {
      await db.auth.signOut();
      document.getElementById("login-screen").style.display = "flex";
      document.getElementById("admin-ui").style.display    = "none";
      document.getElementById("login-password").value = "";
      document.getElementById("login-email").value    = "";
    }

    // Restore session on page load
    window.addEventListener("load", async function() {
      const { data: { session } } = await db.auth.getSession();
      if (session) {
        const { data: profile } = await db.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile && profile.role === 'admin') showAdminUI();
      }
    });


    // ── PANEL NAVIGATION ──────────────────────────────────────
    let currentPanel = "events";

    function showPanel(name) {
      currentPanel = name;
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".sidebar-nav-item").forEach(i => i.classList.remove("active"));
      document.getElementById("panel-" + name).classList.add("active");
      document.querySelector('[data-panel="' + name + '"]').classList.add("active");
      loadCurrentPanel();
    }

    function loadCurrentPanel() {
      if      (currentPanel === "events")        loadEvents();
      else if (currentPanel === "awards")        { loadContests(); loadWinners(); loadWinnerPrep(); }
      else if (currentPanel === "announcements") loadAnnouncements();
      else if (currentPanel === "memories")      loadMemories();
      else if (currentPanel === "bulletin")      loadBulletin();
      else if (currentPanel === "links")         loadLinks();
      else if (currentPanel === "documents")     loadDocuments();
    }


    // ====================================================
    //  EVENTS
    // ====================================================
    let eventsData = [];

    async function loadEvents() {
      const tbody = document.getElementById("events-tbody");
      tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Loading\u2026</td></tr>';
      try {
        const { data, error } = await db.from('events').select('*').order('event_date');
        if (error) throw error;
        eventsData = data || [];
        renderEventsTable(eventsData);
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);padding:20px;">${esc(e.message)}</td></tr>`;
      }
    }

    function renderEventsTable(events) {
      const tbody = document.getElementById("events-tbody");
      if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">\U0001f4c5</div><p>No events yet.</p></div></td></tr>';
        return;
      }
      tbody.innerHTML = events.map(ev => `
        <tr>
          <td><strong>${esc(ev.event_name)}</strong><br><small style="color:var(--muted)">${esc(ev.id)}</small></td>
          <td>${esc(ev.event_date||"")}</td>
          <td>${badge(ev.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openEventForm('${esc(ev.id)}')">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteEvent('${esc(ev.id)}','${esc(ev.event_name)}')">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openEventForm(eventId) {
      currentEventId = eventId;
      const form = document.getElementById("event-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });

      if (!eventId) {
        document.getElementById("event-form-title").textContent = "New Event";
        clearEventForm();
        return;
      }

      document.getElementById("event-form-title").textContent = "Edit Event";
      const ev = eventsData.find(e => e.id === eventId);
      if (!ev) return;

      document.getElementById("ef-name").value        = ev.event_name         || "";
      document.getElementById("ef-id").value          = ev.id                 || "";
      document.getElementById("ef-date").value        = ev.event_date         || "";
      document.getElementById("ef-time").value        = ev.event_time         || "";
      document.getElementById("ef-signup-open").value = ev.signups_open_date  || "";
      document.getElementById("ef-status").value      = ev.status             || "Draft";
      document.getElementById("ef-color").value       = ev.banner_color_class || "card-color-1";
      document.getElementById("ef-emoji").value       = ev.emoji_row          || "";
      document.getElementById("ef-adjective").value   = ev.headline_adjective || "";
      document.getElementById("ef-loc-name").value    = ev.location_name      || "";
      document.getElementById("ef-loc-addr").value    = ev.location_address   || "";
      document.getElementById("ef-ics-start").value   = ev.ics_start          || "";
      document.getElementById("ef-ics-end").value     = ev.ics_end            || "";
      document.getElementById("ef-short").value       = ev.short_description  || "";
      document.getElementById("ef-medium").value      = ev.medium_description || "";
      document.getElementById("ef-long").value        = ev.long_description   || "";
      document.getElementById("ef-org-name").value    = ev.organizer_name     || "";
      document.getElementById("ef-org-email").value   = ev.organizer_email    || "";
      document.getElementById("ef-org-phone").value   = ev.organizer_phone    || "";
      document.getElementById("ef-org-addr").value    = ev.organizer_address  || "";
      document.getElementById("ef-org-contact").value = ev.organizer_contact  || "Email";

      loadEventRolesAndItems(eventId);
    }

    async function loadEventRolesAndItems(eventId) {
      try {
        const [rolesRes, itemsRes] = await Promise.all([
          db.from('event_volunteer_roles').select('*').eq('event_id', eventId).order('sort_order'),
          db.from('event_donation_items').select('*').eq('event_id', eventId).order('sort_order'),
        ]);

        const roles = (rolesRes.data||[]).map(r => ({ label: r.role_label, detail: r.role_detail||'' }));

        const catMap = {}, catList = [];
        (itemsRes.data||[]).forEach(item => {
          if (!catMap[item.category]) {
            catMap[item.category] = { category: item.category, items: [] };
            catList.push(catMap[item.category]);
          }
          catMap[item.category].items.push({ label: item.item_label, needed: item.qty_needed });
        });

        renderVolRolesFromData(roles);
        renderDonationCatsFromData(catList);
      } catch (e) {
        renderVolRolesFromData([]);
        renderDonationCatsFromData([]);
      }
    }

    function clearEventForm() {
      ["ef-name","ef-id","ef-date","ef-time","ef-signup-open","ef-emoji","ef-adjective",
       "ef-loc-name","ef-loc-addr","ef-ics-start","ef-ics-end","ef-short","ef-medium","ef-long",
       "ef-org-name","ef-org-email","ef-org-phone","ef-org-addr"].forEach(id => {
        document.getElementById(id).value = "";
      });
      document.getElementById("ef-status").value      = "Draft";
      document.getElementById("ef-color").value       = "card-color-1";
      document.getElementById("ef-org-contact").value = "Email";
      renderVolRolesFromData([]);
      renderDonationCatsFromData([]);
    }

    function cancelEventForm() {
      document.getElementById("event-form").style.display = "none";
      currentEventId = null;
    }

    function autoSlug() {
      if (currentEventId) return;
      const name = document.getElementById("ef-name").value;
      document.getElementById("ef-id").value = name.replace(/[^a-zA-Z0-9]/g,"");
    }

    // Volunteer roles dynamic rows
    function renderVolRolesFromData(roles) {
      const list = document.getElementById("vol-roles-list");
      list.innerHTML = "";
      (roles||[]).forEach(r => addVolRole(r.label, r.detail));
    }

    function addVolRole(label, detail) {
      const div = document.createElement("div");
      div.className = "dynamic-row vol-role-row";
      div.innerHTML = `
        <input type="text" placeholder="Role name" value="${esc(label||'')}" class="vol-label" />
        <input type="text" placeholder="Short description" value="${esc(detail||'')}" class="vol-detail" />
        <button class="remove-btn" onclick="this.parentElement.remove()">\u2715</button>`;
      document.getElementById("vol-roles-list").appendChild(div);
    }

    // Donation categories dynamic
    function renderDonationCatsFromData(cats) {
      const cont = document.getElementById("donation-cats-list");
      cont.innerHTML = "";
      (cats||[]).forEach(cat => addDonationCategory(cat.category, cat.items));
    }

    function addDonationCategory(catName, items) {
      const div = document.createElement("div");
      div.className = "category-block donation-cat-block";
      div.innerHTML = `
        <div class="category-block-header">
          <input type="text" placeholder="Category name" value="${esc(catName||'')}" class="cat-name-input" />
          <button class="remove-btn" onclick="this.closest('.donation-cat-block').remove()">\u2715 Remove Category</button>
        </div>
        <div class="donation-items-list dynamic-list"></div>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="addDonationItem(this)">+ Add Item</button>`;
      document.getElementById("donation-cats-list").appendChild(div);
      const itemsList = div.querySelector(".donation-items-list");
      (items||[]).forEach(item => addDonationItem(null, item.label, item.needed, itemsList));
    }

    function addDonationItem(btn, label, needed, listEl) {
      const list = listEl || btn.previousElementSibling;
      const div = document.createElement("div");
      div.className = "dynamic-row donation-item-row";
      div.innerHTML = `
        <input type="text"   placeholder="Item label" value="${esc(label||'')}" class="item-label-input" style="flex:2" />
        <input type="number" placeholder="Needed qty" value="${needed!==null&&needed!==undefined?needed:''}" class="item-needed-input" style="flex:1;max-width:100px;" />
        <button class="remove-btn" onclick="this.parentElement.remove()">\u2715</button>`;
      list.appendChild(div);
    }

    function collectVolRoles() {
      return Array.from(document.querySelectorAll(".vol-role-row")).map(row => ({
        label:  row.querySelector(".vol-label").value.trim(),
        detail: row.querySelector(".vol-detail").value.trim(),
      })).filter(r => r.label);
    }

    function collectDonationItems() {
      return Array.from(document.querySelectorAll(".donation-cat-block")).map(block => ({
        category: block.querySelector(".cat-name-input").value.trim(),
        items: Array.from(block.querySelectorAll(".donation-item-row")).map(row => ({
          label:  row.querySelector(".item-label-input").value.trim(),
          needed: row.querySelector(".item-needed-input").value !== ""
                  ? Number(row.querySelector(".item-needed-input").value) : null,
        })).filter(i => i.label),
      })).filter(c => c.category);
    }

    async function submitEventForm() {
      const eventId   = document.getElementById("ef-id").value.trim();
      const eventName = document.getElementById("ef-name").value.trim();
      if (!eventId || !eventName) { toast("Event ID and Name are required.", "error"); return; }

      const eventRow = {
        id:                 eventId,
        event_name:         eventName,
        status:             document.getElementById("ef-status").value,
        event_date:         document.getElementById("ef-date").value         || null,
        event_time:         document.getElementById("ef-time").value.trim()  || null,
        signups_open_date:  document.getElementById("ef-signup-open").value  || null,
        short_description:  document.getElementById("ef-short").value.trim() || null,
        medium_description: document.getElementById("ef-medium").value.trim()|| null,
        long_description:   document.getElementById("ef-long").value.trim()  || null,
        emoji_row:          document.getElementById("ef-emoji").value.trim() || null,
        headline_adjective: document.getElementById("ef-adjective").value.trim() || null,
        location_name:      document.getElementById("ef-loc-name").value.trim()  || null,
        location_address:   document.getElementById("ef-loc-addr").value.trim()  || null,
        banner_color_class: document.getElementById("ef-color").value,
        ics_start:          document.getElementById("ef-ics-start").value.trim() || null,
        ics_end:            document.getElementById("ef-ics-end").value.trim()   || null,
        organizer_name:     document.getElementById("ef-org-name").value.trim()  || null,
        organizer_address:  document.getElementById("ef-org-addr").value.trim()  || null,
        organizer_phone:    document.getElementById("ef-org-phone").value.trim() || null,
        organizer_email:    document.getElementById("ef-org-email").value.trim() || null,
        organizer_contact:  document.getElementById("ef-org-contact").value,
      };

      try {
        const { error: evErr } = await db.from('events').upsert(eventRow, { onConflict: 'id' });
        if (evErr) throw evErr;

        // Replace volunteer roles
        await db.from('event_volunteer_roles').delete().eq('event_id', eventId);
        const roles = collectVolRoles();
        if (roles.length > 0) {
          const { error: rErr } = await db.from('event_volunteer_roles').insert(
            roles.map((r, i) => ({ event_id: eventId, role_label: r.label, role_detail: r.detail || null, sort_order: i }))
          );
          if (rErr) throw rErr;
        }

        // Replace donation items
        await db.from('event_donation_items').delete().eq('event_id', eventId);
        const cats = collectDonationItems();
        if (cats.length > 0) {
          const rows = [];
          cats.forEach((cat, ci) => cat.items.forEach((item, ii) => {
            rows.push({ event_id: eventId, category: cat.category, item_label: item.label, qty_needed: item.needed, sort_order: ci * 100 + ii });
          }));
          if (rows.length > 0) {
            const { error: iErr } = await db.from('event_donation_items').insert(rows);
            if (iErr) throw iErr;
          }
        }

        toast("Event saved!", "success");
        cancelEventForm();
        loadEvents();
      } catch (e) { toast("Error: " + e.message, "error"); }
    }

    function confirmDeleteEvent(eventId, eventName) {
      showModal("\U0001f5d1\ufe0f","Delete Event","Delete \\"" + eventName + "\\"? This also removes its volunteer roles and donation items.",
        async () => {
          const { error } = await db.from('events').delete().eq('id', eventId);
          if (!error) { toast("Event deleted.", "success"); loadEvents(); }
          else toast("Error: " + error.message, "error");
        });
    }

    async function confirmArchive() {
      showModal("\u26a0\ufe0f","Archive Sign-Ups",
        "This will mark all current sign-ups as archived. This cannot be undone.",
        async () => {
          try {
            const { data: cfg } = await db.from('config').select('value').eq('key','current_event_id').maybeSingle();
            const eventId = cfg?.value;
            if (!eventId) { toast("No current_event_id set in config.", "error"); return; }
            const { error } = await db.from('signups').update({ archived: true }).eq('event_id', eventId).eq('archived', false);
            if (error) throw error;
            toast("Sign-ups archived for: " + eventId, "success");
          } catch (e) { toast("Error: " + e.message, "error"); }
        });
    }


    // ====================================================
    //  AWARD CONTESTS
    // ====================================================
    let contestsData = [];

    function setAwardsSubtab(sub, btn) {
      document.querySelectorAll(".subtab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("awards-contests-panel").style.display = sub === "contests" ? "block" : "none";
      document.getElementById("awards-winners-panel").style.display  = sub === "winners"  ? "block" : "none";
      document.getElementById("awards-prep-panel").style.display     = sub === "prep"     ? "block" : "none";
    }

    async function loadContests() {
      const tbody = document.getElementById("contests-tbody");
      tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">Loading\u2026</td></tr>';
      try {
        const { data, error } = await db.from('award_contests').select('*').order('award_name');
        if (error) throw error;
        contestsData = data || [];
        renderContestsTable(contestsData);
      } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Error: ${esc(e.message)}</td></tr>`; }
    }

    function renderContestsTable(contests) {
      const tbody = document.getElementById("contests-tbody");
      if (!contests.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">\U0001f3c6</div><p>No contests yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = contests.map(c => `
        <tr>
          <td>${esc(c.award_name||"")}</td>
          <td>${esc(c.category||"")}</td>
          <td>${esc(c.period||"")}</td>
          <td>${badge(c.status||"")}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openContestForm('${esc(c.id)}')">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteContest('${esc(c.id)}')">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openContestForm(contestId) {
      const form = document.getElementById("contest-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      if (!contestId) {
        document.getElementById("contest-form-title").textContent = "New Contest";
        ["cf-name","cf-id","cf-period","cf-deadline","cf-icon","cf-badge","cf-prize","cf-desc"].forEach(id => document.getElementById(id).value="");
        return;
      }
      document.getElementById("contest-form-title").textContent = "Edit Contest";
      const c = contestsData.find(x => x.id === contestId);
      if (!c) return;
      document.getElementById("cf-name").value     = c.award_name   || "";
      document.getElementById("cf-id").value       = c.id           || "";
      document.getElementById("cf-cat").value      = c.category     || "Community";
      document.getElementById("cf-period").value   = c.period       || "";
      document.getElementById("cf-status").value   = c.status       || "open";
      document.getElementById("cf-deadline").value = c.deadline     || "";
      document.getElementById("cf-icon").value     = c.icon         || "";
      document.getElementById("cf-badge").value    = c.badge        || "";
      document.getElementById("cf-banner").value   = c.banner_color || "banner-green";
      document.getElementById("cf-prize").value    = c.prize        || "";
      document.getElementById("cf-desc").value     = c.description  || "";
    }

    function cancelContestForm() { document.getElementById("contest-form").style.display = "none"; }

    function autoContestId() {
      const name = document.getElementById("cf-name").value;
      document.getElementById("cf-id").value = name.replace(/[^a-zA-Z0-9]/g,"");
    }

    async function submitContestForm() {
      const contestId = document.getElementById("cf-id").value.trim();
      const awardName = document.getElementById("cf-name").value.trim();
      if (!contestId || !awardName) { toast("Contest ID and Award Name required.", "error"); return; }
      const row = {
        id:           contestId,
        icon:         document.getElementById("cf-icon").value.trim()   || null,
        badge:        document.getElementById("cf-badge").value.trim()  || null,
        banner_color: document.getElementById("cf-banner").value,
        award_name:   awardName,
        category:     document.getElementById("cf-cat").value,
        period:       document.getElementById("cf-period").value.trim() || null,
        status:       document.getElementById("cf-status").value,
        description:  document.getElementById("cf-desc").value.trim()   || null,
        deadline:     document.getElementById("cf-deadline").value.trim()|| null,
        prize:        document.getElementById("cf-prize").value.trim()  || null,
      };
      const { error } = await db.from('award_contests').upsert(row, { onConflict: 'id' });
      if (!error) { toast("Contest saved!", "success"); cancelContestForm(); loadContests(); }
      else toast("Error: " + error.message, "error");
    }

    function confirmDeleteContest(contestId) {
      showModal("\U0001f5d1\ufe0f","Delete Contest","Delete this award contest?", async () => {
        const { error } = await db.from('award_contests').delete().eq('id', contestId);
        if (!error) { toast("Contest deleted.", "success"); loadContests(); }
        else toast("Error: " + error.message, "error");
      });
    }


    // ====================================================
    //  WINNERS
    // ====================================================
    let winnersData = [];

    async function loadWinners() {
      const tbody = document.getElementById("winners-tbody");
      tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('winners').select('*').order('created_at', { ascending: false });
      winnersData = data || [];
      if (!winnersData.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">\U0001f947</div><p>No winners yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = winnersData.map(w => `
        <tr>
          <td>${esc(w.award||"")}</td>
          <td>${esc(w.winner_name||"")}</td>
          <td>${esc(w.period||"")}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openWinnerForm(${w.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteWinner(${w.id},'${esc(w.award||"")}')">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openWinnerForm(id) {
      const form = document.getElementById("winner-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      if (!id) {
        ["wf-award","wf-winner","wf-period","wf-year","wf-icon","wf-badge","wf-banner","wf-prize","wf-photo","wf-blurb","wf-q1","wf-q2","wf-q3"].forEach(x => document.getElementById(x).value="");
        form.dataset.editId = "";
        return;
      }
      const w = winnersData.find(x => x.id === id);
      if (!w) return;
      form.dataset.editId       = w.id;
      document.getElementById("wf-award").value  = w.award        || "";
      document.getElementById("wf-winner").value = w.winner_name  || "";
      document.getElementById("wf-period").value = w.period       || "";
      document.getElementById("wf-year").value   = w.year         || "";
      document.getElementById("wf-icon").value   = w.icon         || "";
      document.getElementById("wf-badge").value  = w.badge        || "";
      document.getElementById("wf-banner").value = w.banner_color || "";
      document.getElementById("wf-prize").value  = w.prize        || "";
      document.getElementById("wf-photo").value  = w.photo_id     || "";
      document.getElementById("wf-blurb").value  = w.blurb        || "";
      document.getElementById("wf-q1").value     = w.quote1       || "";
      document.getElementById("wf-q2").value     = w.quote2       || "";
      document.getElementById("wf-q3").value     = w.quote3       || "";
    }

    function cancelWinnerForm() { document.getElementById("winner-form").style.display = "none"; }

    async function submitWinnerForm() {
      const award  = document.getElementById("wf-award").value.trim();
      const winner = document.getElementById("wf-winner").value.trim();
      if (!award || !winner) { toast("Award and winner name required.", "error"); return; }
      const editId = document.getElementById("winner-form").dataset.editId;
      const row = {
        award:        award,
        winner_name:  winner,
        period:       document.getElementById("wf-period").value.trim() || null,
        year:         document.getElementById("wf-year").value.trim()   || null,
        icon:         document.getElementById("wf-icon").value.trim()   || null,
        badge:        document.getElementById("wf-badge").value.trim()  || null,
        banner_color: document.getElementById("wf-banner").value.trim() || null,
        prize:        document.getElementById("wf-prize").value.trim()  || null,
        photo_id:     document.getElementById("wf-photo").value.trim()  || null,
        blurb:        document.getElementById("wf-blurb").value.trim()  || null,
        quote1:       document.getElementById("wf-q1").value.trim()     || null,
        quote2:       document.getElementById("wf-q2").value.trim()     || null,
        quote3:       document.getElementById("wf-q3").value.trim()     || null,
      };
      let error;
      if (editId) {
        ({ error } = await db.from('winners').update(row).eq('id', editId));
      } else {
        ({ error } = await db.from('winners').insert(row));
      }
      if (!error) { toast("Winner saved!", "success"); cancelWinnerForm(); loadWinners(); }
      else toast("Error: " + error.message, "error");
    }

    function confirmDeleteWinner(id, award) {
      showModal("\U0001f5d1\ufe0f","Delete Winner","Remove this winner entry?", async () => {
        const { error } = await db.from('winners').delete().eq('id', id);
        if (!error) { toast("Winner deleted.", "success"); loadWinners(); }
        else toast("Error: " + error.message, "error");
      });
    }


    // ====================================================
    //  WINNER PREP
    // ====================================================
    let prepData = [];

    async function loadWinnerPrep() {
      const tbody = document.getElementById("prep-tbody");
      tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('winner_prep').select('*').order('submitted_at', { ascending: false });
      prepData = (data||[]).filter(r => !r.promoted);
      if (!prepData.length) { tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">\U0001f4cb</div><p>No winner prep rows yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = prepData.map(row => `
        <tr>
          <td>${esc(row.award||"")}</td>
          <td>${esc(row.winner_name||"")}</td>
          <td>${esc(row.nominator_name||"")}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((row.blurb||"").substring(0,80))}</td>
          <td><button class="btn btn-success btn-sm" onclick="promotePrep(${row.id})">Promote to Winners</button></td>
        </tr>`).join("");
    }

    async function promotePrep(prepId) {
      const row = prepData.find(r => r.id === prepId);
      if (!row) { toast("Row not found.", "error"); return; }
      const winnerRow = {
        nomination_id: row.nomination_id,
        award:         row.award,
        winner_name:   row.winner_name,
        icon:          row.icon,
        badge:         row.badge,
        banner_color:  row.banner_color,
        period:        row.period,
        year:          row.year,
        photo_id:      row.photo_id,
        prize:         row.prize,
        blurb:         row.blurb,
        quote1:        row.quote1,
        quote2:        row.quote2,
        quote3:        row.quote3,
      };
      const { error: winErr } = await db.from('winners').insert(winnerRow);
      if (winErr) { toast("Error: " + winErr.message, "error"); return; }
      await db.from('winner_prep').update({ promoted: true }).eq('id', prepId);
      toast("Promoted to Winners!", "success");
      loadWinnerPrep();
      loadWinners();
    }


    // ====================================================
    //  ANNOUNCEMENTS
    // ====================================================
    let announcementsData = [];

    async function loadAnnouncements() {
      const tbody = document.getElementById("announcements-tbody");
      tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('announcements').select('*').order('created_at', { ascending: false });
      announcementsData = data || [];
      if (!announcementsData.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">\U0001f4e2</div><p>No announcements yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = announcementsData.map(a => `
        <tr>
          <td>${esc(a.day||"")} ${esc(a.month||"")}</td>
          <td>${esc(a.title||"")}</td>
          <td>${badge(a.published ? "published" : "draft")}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openAnnouncementForm(${a.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteAnnouncement(${a.id},'${esc(a.title||"")}')">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openAnnouncementForm(id) {
      const form = document.getElementById("announcement-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      if (!id) {
        document.getElementById("af-title-label").textContent = "New Announcement";
        document.getElementById("af-id").value = "";
        ["af-day","af-month","af-title","af-body","af-link","af-link-text"].forEach(x=>document.getElementById(x).value="");
        document.getElementById("af-published").checked = true;
        return;
      }
      document.getElementById("af-title-label").textContent = "Edit Announcement";
      const a = announcementsData.find(x => x.id === id);
      if (!a) return;
      document.getElementById("af-id").value        = a.id        || "";
      document.getElementById("af-day").value       = a.day       || "";
      document.getElementById("af-month").value     = a.month     || "";
      document.getElementById("af-title").value     = a.title     || "";
      document.getElementById("af-body").value      = a.body      || "";
      document.getElementById("af-link").value      = a.link      || "";
      document.getElementById("af-link-text").value = a.link_text || "";
      document.getElementById("af-published").checked = a.published === true;
    }

    function cancelAnnouncementForm() { document.getElementById("announcement-form").style.display = "none"; }

    async function submitAnnouncementForm() {
      const id    = document.getElementById("af-id").value.trim();
      const title = document.getElementById("af-title").value.trim();
      const body  = document.getElementById("af-body").value.trim();
      if (!title || !body) { toast("Title and body are required.", "error"); return; }
      const row = {
        day:       document.getElementById("af-day").value.trim()       || null,
        month:     document.getElementById("af-month").value.trim()     || null,
        title,
        body,
        link:      document.getElementById("af-link").value.trim()      || null,
        link_text: document.getElementById("af-link-text").value.trim() || null,
        published: document.getElementById("af-published").checked,
      };
      let error;
      if (id) {
        ({ error } = await db.from('announcements').update(row).eq('id', id));
      } else {
        ({ error } = await db.from('announcements').insert(row));
      }
      if (!error) { toast("Announcement saved!", "success"); cancelAnnouncementForm(); loadAnnouncements(); }
      else toast("Error: " + error.message, "error");
    }

    function confirmDeleteAnnouncement(id, title) {
      showModal("\U0001f5d1\ufe0f","Delete Announcement","Delete \\"" + title + "\\"?", async () => {
        const { error } = await db.from('announcements').delete().eq('id', id);
        if (!error) { toast("Announcement deleted.", "success"); loadAnnouncements(); }
        else toast("Error: " + error.message, "error");
      });
    }


    // ====================================================
    //  MEMORIES
    // ====================================================
    async function loadMemories() {
      const tbody = document.getElementById("memories-tbody");
      tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('memories').select('*').order('submitted_at', { ascending: false });
      const memories = data || [];
      if (!memories.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">\U0001f4f7</div><p>No memories submitted yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = memories.map(m => {
        const ids = extractDriveIds(m.photo_urls||[]);
        return `
        <tr>
          <td>${esc(fmtDate(m.submitted_at))}</td>
          <td>${esc(m.uploader_name||"")}</td>
          <td>${esc(m.event_name||"")}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(m.caption||"")}</td>
          <td><div class="thumb-grid">${ids.slice(0,3).map(id=>`<img src="https://drive.google.com/thumbnail?id=${esc(id)}&sz=w70" onerror="this.style.display='none'" />`).join("")}</div></td>
          <td>${badge(m.approved?"approved":"pending")}</td>
          <td>
            ${!m.approved?`<button class="btn btn-success btn-sm" onclick="approveMemory(${m.id})">Approve</button>`:""}
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteMemory(${m.id})">Delete</button>
          </td>
        </tr>`;
      }).join("");
    }

    async function approveMemory(id) {
      const { error } = await db.from('memories').update({ approved: true }).eq('id', id);
      if (!error) { toast("Memory approved!", "success"); loadMemories(); }
      else toast("Error.", "error");
    }

    function confirmDeleteMemory(id) {
      showModal("\U0001f5d1\ufe0f","Delete Memory","Permanently delete this memory submission?", async () => {
        const { error } = await db.from('memories').delete().eq('id', id);
        if (!error) { toast("Memory deleted.", "success"); loadMemories(); }
        else toast("Error.", "error");
      });
    }


    // ====================================================
    //  BULLETIN BOARD
    // ====================================================
    let bulletinData = [];

    async function loadBulletin() {
      const tbody = document.getElementById("bulletin-tbody");
      tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('bulletin_posts').select('*').order('submitted_at', { ascending: false });
      bulletinData = data || [];
      if (!bulletinData.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">\U0001f4cb</div><p>No posts yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = bulletinData.map(p => {
        const ids = extractDriveIds(p.photo_urls||[]);
        return `
        <tr>
          <td>${esc(fmtDate(p.submitted_at))}</td>
          <td>${esc(p.poster_name||"")}</td>
          <td>${esc(p.category||"")}</td>
          <td>${esc(p.title||"")}</td>
          <td><div class="thumb-grid">${ids.slice(0,2).map(id=>`<img src="https://drive.google.com/thumbnail?id=${esc(id)}&sz=w70" onerror="this.style.display='none'" />`).join("")}</div></td>
          <td>${badge(p.approved?"approved":"pending")}</td>
          <td>
            ${!p.approved?`<button class="btn btn-success btn-sm" onclick="approveBulletin(${p.id})">Approve</button>`:""}
            <button class="btn btn-secondary btn-sm" onclick="openBulletinEdit(${p.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteBulletin(${p.id})">Delete</button>
          </td>
        </tr>`;
      }).join("");
    }

    async function approveBulletin(id) {
      const { error } = await db.from('bulletin_posts').update({ approved: true }).eq('id', id);
      if (!error) { toast("Post approved!", "success"); loadBulletin(); }
      else toast("Error.", "error");
    }

    function openBulletinEdit(id) {
      const p = bulletinData.find(x => x.id === id);
      if (!p) return;
      const form = document.getElementById("bulletin-edit-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      document.getElementById("bef-rowid").value   = p.id;
      document.getElementById("bef-cat").value     = p.category || "";
      document.getElementById("bef-title").value   = p.title    || "";
      document.getElementById("bef-content").value = p.content  || "";
    }

    function cancelBulletinEdit() { document.getElementById("bulletin-edit-form").style.display = "none"; }

    async function submitBulletinEdit() {
      const id  = document.getElementById("bef-rowid").value;
      const row = {
        category: document.getElementById("bef-cat").value,
        title:    document.getElementById("bef-title").value.trim(),
        content:  document.getElementById("bef-content").value.trim(),
      };
      const { error } = await db.from('bulletin_posts').update(row).eq('id', id);
      if (!error) { toast("Post updated!", "success"); cancelBulletinEdit(); loadBulletin(); }
      else toast("Error.", "error");
    }

    function confirmDeleteBulletin(id) {
      showModal("\U0001f5d1\ufe0f","Delete Post","Permanently delete this bulletin board post?", async () => {
        const { error } = await db.from('bulletin_posts').delete().eq('id', id);
        if (!error) { toast("Post deleted.", "success"); loadBulletin(); }
        else toast("Error.", "error");
      });
    }


    // ====================================================
    //  LINKS
    // ====================================================
    let linksData = [];

    async function loadLinks() {
      const tbody = document.getElementById("links-tbody");
      tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('links').select('*').order('sort_order');
      linksData = data || [];
      if (!linksData.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">\U0001f517</div><p>No links yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = linksData.map(l => `
        <tr>
          <td>${esc(l.category||"")}</td>
          <td>${esc(l.title||"")}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="${esc(l.url||"")}" target="_blank">${esc(l.url||"")}</a></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openLinkForm(${l.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteLink(${l.id})">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openLinkForm(id) {
      const form = document.getElementById("link-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      if (!id) {
        document.getElementById("lf-title-label").textContent = "New Link";
        document.getElementById("lf-id").value = "";
        ["lf-cat","lf-icon","lf-title","lf-desc","lf-url","lf-label"].forEach(x=>document.getElementById(x).value="");
        return;
      }
      document.getElementById("lf-title-label").textContent = "Edit Link";
      const l = linksData.find(x => x.id === id);
      if (!l) return;
      document.getElementById("lf-id").value    = l.id          || "";
      document.getElementById("lf-cat").value   = l.category    || "";
      document.getElementById("lf-icon").value  = l.icon        || "";
      document.getElementById("lf-title").value = l.title       || "";
      document.getElementById("lf-desc").value  = l.description || "";
      document.getElementById("lf-url").value   = l.url         || "";
      document.getElementById("lf-label").value = l.url_label   || "";
    }

    function cancelLinkForm() { document.getElementById("link-form").style.display = "none"; }

    async function submitLinkForm() {
      const title = document.getElementById("lf-title").value.trim();
      const url   = document.getElementById("lf-url").value.trim();
      if (!title || !url) { toast("Title and URL are required.", "error"); return; }
      const id  = document.getElementById("lf-id").value.trim();
      const row = {
        category:    document.getElementById("lf-cat").value.trim(),
        icon:        document.getElementById("lf-icon").value.trim()  || null,
        title,
        description: document.getElementById("lf-desc").value.trim() || null,
        url,
        url_label:   document.getElementById("lf-label").value.trim()|| null,
      };
      let error;
      if (id) {
        ({ error } = await db.from('links').update(row).eq('id', id));
      } else {
        ({ error } = await db.from('links').insert(row));
      }
      if (!error) { toast("Link saved!", "success"); cancelLinkForm(); loadLinks(); }
      else toast("Error.", "error");
    }

    function confirmDeleteLink(id) {
      showModal("\U0001f5d1\ufe0f","Delete Link","Delete this link?", async () => {
        const { error } = await db.from('links').delete().eq('id', id);
        if (!error) { toast("Link deleted.", "success"); loadLinks(); }
        else toast("Error.", "error");
      });
    }


    // ====================================================
    //  DOCUMENTS
    // ====================================================
    let docsData = [];

    async function loadDocuments() {
      const tbody = document.getElementById("docs-tbody");
      tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('documents').select('*').order('sort_order');
      docsData = data || [];
      if (!docsData.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">\U0001f4c4</div><p>No documents yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = docsData.map(d => `
        <tr>
          <td>${esc(d.category||"")}</td>
          <td>${esc(d.title||"")}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="${esc(d.url||"")}" target="_blank">${esc(d.url||"")}</a></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openDocForm(${d.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteDoc(${d.id})">Delete</button>
          </td>
        </tr>`).join("");
    }

    function openDocForm(id) {
      const form = document.getElementById("doc-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      if (!id) {
        document.getElementById("df-title-label").textContent = "New Document";
        document.getElementById("df-id").value = "";
        ["df-cat","df-icon","df-title","df-desc","df-url","df-label"].forEach(x=>document.getElementById(x).value="");
        return;
      }
      document.getElementById("df-title-label").textContent = "Edit Document";
      const d = docsData.find(x => x.id === id);
      if (!d) return;
      document.getElementById("df-id").value    = d.id          || "";
      document.getElementById("df-cat").value   = d.category    || "";
      document.getElementById("df-icon").value  = d.icon        || "";
      document.getElementById("df-title").value = d.title       || "";
      document.getElementById("df-desc").value  = d.description || "";
      document.getElementById("df-url").value   = d.url         || "";
      document.getElementById("df-label").value = d.url_label   || "";
    }

    function cancelDocForm() { document.getElementById("doc-form").style.display = "none"; }

    async function submitDocForm() {
      const title = document.getElementById("df-title").value.trim();
      const url   = document.getElementById("df-url").value.trim();
      if (!title || !url) { toast("Title and URL are required.", "error"); return; }
      const id  = document.getElementById("df-id").value.trim();
      const row = {
        category:    document.getElementById("df-cat").value.trim(),
        icon:        document.getElementById("df-icon").value.trim()  || null,
        title,
        description: document.getElementById("df-desc").value.trim() || null,
        url,
        url_label:   document.getElementById("df-label").value.trim()|| null,
      };
      let error;
      if (id) {
        ({ error } = await db.from('documents').update(row).eq('id', id));
      } else {
        ({ error } = await db.from('documents').insert(row));
      }
      if (!error) { toast("Document saved!", "success"); cancelDocForm(); loadDocuments(); }
      else toast("Error.", "error");
    }

    function confirmDeleteDoc(id) {
      showModal("\U0001f5d1\ufe0f","Delete Document","Delete this document entry?", async () => {
        const { error } = await db.from('documents').delete().eq('id', id);
        if (!error) { toast("Document deleted.", "success"); loadDocuments(); }
        else toast("Error.", "error");
      });
    }


    // ====================================================
    //  SETTINGS
    // ====================================================
    async function loadSettings() {
      try {
        const { data } = await db.from('config').select('key, value');
        const cfg = {};
        (data||[]).forEach(r => { cfg[r.key] = r.value; });
        document.getElementById("cfg-org-name").value  = cfg.organizer_name  || "";
        document.getElementById("cfg-org-email").value = cfg.organizer_email || "";
        document.getElementById("cfg-org-phone").value = cfg.organizer_phone || "";
      } catch(e) {}
    }

    async function changeAdminPassword() {
      const np = document.getElementById("new-admin-pass").value;
      const cp = document.getElementById("confirm-admin-pass").value;
      if (!np) { toast("Enter a new password.", "error"); return; }
      if (np !== cp) { toast("Passwords do not match.", "error"); return; }
      const { error } = await db.auth.updateUser({ password: np });
      if (!error) {
        toast("Password updated!", "success");
        document.getElementById("new-admin-pass").value     = "";
        document.getElementById("confirm-admin-pass").value = "";
      } else toast("Error: " + error.message, "error");
    }

    async function saveOrgInfo() {
      const fields = [
        { key: 'organizer_name',  value: document.getElementById("cfg-org-name").value.trim() },
        { key: 'organizer_email', value: document.getElementById("cfg-org-email").value.trim() },
        { key: 'organizer_phone', value: document.getElementById("cfg-org-phone").value.trim() },
      ];
      const { error } = await db.from('config').upsert(fields, { onConflict: 'key' });
      if (!error) toast("Contact info saved!", "success");
      else toast("Error saving.", "error");
    }

  </script>
</body>
</html>
'''

content = open('admin.html', 'r', encoding='utf-8').read()
lines = content.split('\n')

# Find start of old implementation (line 623, 0-indexed 622)
target_line = lines[622]
start_idx = content.find(target_line)

# Replace from start_idx to end of file with new tail
new_content = content[:start_idx] + new_tail

open('admin.html', 'w', encoding='utf-8').write(new_content)
print(f'Done. Lines: {len(new_content.splitlines())}')
