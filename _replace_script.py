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
      const container = document.getElementById("toast-container");
      // Evict the oldest toast when already at the cap.
      if (container.children.length >= 3) container.firstElementChild.remove();
      const el = document.createElement("div");
      el.className = "toast " + (type || "");
      el.textContent = msg;
      container.appendChild(el);
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
    function modalConfirm() { const cb = modalCallback; closeModal(); if (cb) cb(); }


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
      else if (currentPanel === "directory")     loadDirectory();
      else if (currentPanel === "volunteers")    initVolunteersPanel();
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

        const roles = (rolesRes.data||[]).map(r => ({ label: r.role_label, detail: r.role_detail||'', max_volunteers: r.max_volunteers ?? null }));

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
      (roles||[]).forEach(r => addVolRole(r.label, r.detail, r.max_volunteers));
    }

    function addVolRole(label, detail, qty) {
      const div = document.createElement("div");
      div.className = "dynamic-row vol-role-row";
      div.innerHTML = `
        <input type="text" placeholder="Role name" value="${esc(label||'')}" class="vol-label" />
        <input type="text" placeholder="Short description" value="${esc(detail||'')}" class="vol-detail" />
        <input type="number" placeholder="Qty" min="1" value="${qty != null ? qty : ''}" class="vol-qty" style="width:70px;" title="Max volunteers for this role (leave blank for unlimited)" />
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
      return Array.from(document.querySelectorAll(".vol-role-row")).map(row => {
        const qtyVal = row.querySelector(".vol-qty").value;
        return {
          label:  row.querySelector(".vol-label").value.trim(),
          detail: row.querySelector(".vol-detail").value.trim(),
          qty:    qtyVal !== "" ? parseInt(qtyVal, 10) : null,
        };
      }).filter(r => r.label);
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
            roles.map((r, i) => ({ event_id: eventId, role_label: r.label, role_detail: r.detail || null, max_volunteers: r.qty, sort_order: i }))
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
      const today = new Date().toISOString().slice(0, 10);
      const { data: pastRows } = await db.from('events').select('id, event_name')
        .lt('event_date', today).order('event_date', { ascending: false }).limit(1);
      const ev = pastRows?.[0];
      if (!ev) { toast("No past events found to archive.", "error"); return; }
      showModal("\u26a0\ufe0f", "Archive Sign-Ups",
        `This will archive all sign-ups for "${ev.event_name || ev.id}". This cannot be undone.`,
        async () => {
          try {
            const { error } = await db.from('signups').update({ archived: true }).eq('event_id', ev.id).eq('archived', false);
            if (error) throw error;
            toast("Sign-ups archived for: " + (ev.event_name || ev.id), "success");
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
      document.getElementById("awards-contests-panel").style.display    = sub === "contests"    ? "block" : "none";
      document.getElementById("awards-nominations-panel").style.display = sub === "nominations" ? "block" : "none";
      document.getElementById("awards-winners-panel").style.display     = sub === "winners"     ? "block" : "none";
      document.getElementById("awards-prep-panel").style.display        = sub === "prep"        ? "block" : "none";
      if (sub === "nominations") loadNominations();
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
        updateBadgePreview();
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
      updateBadgePreview();
      document.getElementById("cf-banner").value   = c.banner_color || "banner-green";
      document.getElementById("cf-prize").value    = c.prize        || "";
      document.getElementById("cf-desc").value     = c.description  || "";
    }

    function cancelContestForm() { document.getElementById("contest-form").style.display = "none"; }

    function updateBadgePreview() {
      const val = document.getElementById("cf-badge").value;
      const img = document.getElementById("cf-badge-preview");
      if (val) { img.src = val; img.style.display = "block"; }
      else { img.src = ""; img.style.display = "none"; }
    }

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
        award:         row.award        || null,
        winner_name:   row.winner_name  || null,
        icon:          row.icon         || null,
        badge:         row.badge        || null,
        banner_color:  row.banner_color || null,
        period:        row.period       || null,
        year:          row.year         || null,
        photo_id:      row.photo_id     || null,
        prize:         row.prize        || null,
        blurb:         row.blurb        || null,
        quote1:        row.quote1       || null,
        quote2:        row.quote2       || null,
        quote3:        row.quote3       || null,
      };
      const { error: winErr } = await db.from('winners').insert(winnerRow);
      if (winErr) { toast("Error: " + winErr.message, "error"); return; }
      await db.from('winner_prep').update({ promoted: true }).eq('id', prepId);
      toast("Promoted to Winners!", "success");
      loadWinnerPrep();
      loadWinners();
    }


    // ====================================================
    //  NOMINATIONS
    // ====================================================
    let nominationsData = [];

    async function loadNominations() {
      const tbody = document.getElementById("nominations-tbody");
      tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Loading\u2026</td></tr>';
      const [{ data, error }, { data: voteRows }] = await Promise.all([
        db.from('award_nominations').select('*').order('submitted_at', { ascending: false }),
        db.from('nomination_votes').select('nomination_id')
      ]);
      if (error) { tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);padding:20px;">${esc(error.message)}</td></tr>`; return; }
      nominationsData = data || [];
      const voteCounts = {};
      (voteRows || []).forEach(v => { voteCounts[v.nomination_id] = (voteCounts[v.nomination_id] || 0) + 1; });
      if (!nominationsData.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">\U0001f4dd</div><p>No nominations yet.</p></div></td></tr>';
        return;
      }
      tbody.innerHTML = nominationsData.map(n => {
        const contest = contestsData.find(c => c.id === n.contest_id);
        const vc = voteCounts[n.id] || 0;
        const voteLabel = vc ? `<strong>${vc}</strong>` : `<span style="color:var(--muted)">\u2014</span>`;
        return `
        <tr>
          <td>${esc(fmtDate(n.submitted_at))}</td>
          <td>${esc(contest ? contest.award_name : (n.contest_id||"\u2014"))}</td>
          <td>${esc(n.nominee_name||"")}</td>
          <td>${esc(n.nominator_name||"")}</td>
          <td style="text-align:center;">${voteLabel}</td>
          <td>${badge(n.approved ? "received" : "pending")}</td>
          <td>
            <button class="btn btn-outline   btn-sm" onclick="previewNomination(${n.id})">Preview</button>
            ${!n.approved ? `<button class="btn btn-success btn-sm" onclick="markNominationReceived(${n.id})">Mark Received</button>` : ""}
            <button class="btn btn-secondary btn-sm" onclick="openNominationForm(${n.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteNomination(${n.id})">Delete</button>
          </td>
        </tr>`;
      }).join("");
    }

    function openNominationForm(id) {
      const n = nominationsData.find(x => x.id === id);
      if (!n) return;
      const form = document.getElementById("nomination-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      document.getElementById("nf-id").value        = n.id;
      document.getElementById("nf-nom-name").value  = n.nominator_name    || "";
      document.getElementById("nf-nom-email").value = n.nominator_email   || "";
      document.getElementById("nf-nom-phone").value = n.nominator_phone   || "";
      document.getElementById("nf-nom-addr").value  = n.nominator_address || "";
      document.getElementById("nf-nee-name").value  = n.nominee_name      || "";
      document.getElementById("nf-nee-addr").value  = n.nominee_address   || "";
      document.getElementById("nf-cat").value       = n.award_category    || "";
      document.getElementById("nf-custom").value    = n.custom_award      || "";
      document.getElementById("nf-reasons").value   = n.reasons           || "";
      document.getElementById("nf-approved").value  = n.approved ? "true" : "false";
      const sel = document.getElementById("nf-contest");
      sel.innerHTML = '<option value="">— None —</option>' +
        contestsData.map(c => `<option value="${esc(c.id)}"${c.id === n.contest_id ? " selected" : ""}>${esc(c.award_name)}</option>`).join("");
    }

    function cancelNominationForm() {
      document.getElementById("nomination-form").style.display = "none";
    }

    async function submitNominationEdit() {
      const id  = document.getElementById("nf-id").value;
      const row = {
        contest_id:        document.getElementById("nf-contest").value.trim()    || null,
        nominator_name:    document.getElementById("nf-nom-name").value.trim(),
        nominator_email:   document.getElementById("nf-nom-email").value.trim(),
        nominator_phone:   document.getElementById("nf-nom-phone").value.trim()  || null,
        nominator_address: document.getElementById("nf-nom-addr").value.trim()   || null,
        nominee_name:      document.getElementById("nf-nee-name").value.trim(),
        nominee_address:   document.getElementById("nf-nee-addr").value.trim()   || null,
        award_category:    document.getElementById("nf-cat").value.trim()        || null,
        custom_award:      document.getElementById("nf-custom").value.trim()     || null,
        reasons:           document.getElementById("nf-reasons").value.trim()    || null,
        approved:          document.getElementById("nf-approved").value === "true",
      };
      const { error } = await db.from('award_nominations').update(row).eq('id', id);
      if (!error) { toast("Nomination saved!", "success"); cancelNominationForm(); loadNominations(); }
      else toast("Error: " + error.message, "error");
    }

    const NOM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbybNrl0_bXnHxWpPkc-9c0egc7UqpwJ5wQyRhqP4qodW6qIGbNKB_XlZsJDMDSQZLc/exec";

    async function markNominationReceived(id) {
      const n = nominationsData.find(x => x.id === id);
      if (!n) return;
      const { error } = await db.from('award_nominations').update({ approved: true }).eq('id', id);
      if (error) { toast("Error: " + error.message, "error"); return; }

      // Send confirmation email to the nominator via GAS.
      if (n.nominator_email) {
        try {
          const gasResp = await fetch(NOM_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
              action:          "mark_received",
              nominator_name:  n.nominator_name  || "",
              nominator_email: n.nominator_email || "",
              nominee_name:    n.nominee_name    || "",
              award_category:  n.award_category  || "",
              custom_award:    n.custom_award    || "",
            }),
          });
          const gasJson = await gasResp.json().catch(() => null);
          if (!gasJson || !gasJson.success) {
            toast("DB updated, but email failed: " + (gasJson?.error || "GAS returned an error. Check that the script is deployed."), "error");
            loadNominations();
            return;
          }
        } catch (gasErr) {
          toast("DB updated, but email failed: " + gasErr.message, "error");
          loadNominations();
          return;
        }
      }

      toast("Marked as received \\u2014 confirmation email sent!", "success");
      loadNominations();
    }

    function confirmDeleteNomination(id) {
      showModal("\U0001f5d1\ufe0f","Delete Nomination","Permanently delete this nomination?", async () => {
        const { error } = await db.from('award_nominations').delete().eq('id', id);
        if (!error) { toast("Nomination deleted.", "success"); loadNominations(); }
        else toast("Error: " + error.message, "error");
      });
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
    let memoriesData = [];

    async function loadMemories() {
      const tbody = document.getElementById("memories-tbody");
      tbody.innerHTML = '<tr><td colspan="7" class="admin-loading">Loading\u2026</td></tr>';
      const { data } = await db.from('memories').select('*').order('submitted_at', { ascending: false });
      memoriesData = data || [];
      if (!memoriesData.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">\U0001f4f7</div><p>No memories submitted yet.</p></div></td></tr>'; return; }
      tbody.innerHTML = memoriesData.map(m => {
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
            <button class="btn btn-outline   btn-sm" onclick="previewMemory(${m.id})">Preview</button>
            ${!m.approved?`<button class="btn btn-success btn-sm" onclick="approveMemory(${m.id})">Approve</button>`:""}
            <button class="btn btn-secondary btn-sm" onclick="openMemoryEdit(${m.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteMemory(${m.id})">Delete</button>
          </td>
        </tr>`;
      }).join("");
    }

    function openMemoryEdit(id) {
      const m = memoriesData.find(x => x.id === id);
      if (!m) return;
      const form = document.getElementById("memory-edit-form");
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
      document.getElementById("mef-id").value       = m.id;
      document.getElementById("mef-name").value     = m.uploader_name || "";
      document.getElementById("mef-email").value    = m.email         || "";
      document.getElementById("mef-event").value    = m.event_name    || "";
      document.getElementById("mef-caption").value  = m.caption       || "";
      document.getElementById("mef-approved").value = m.approved ? "true" : "false";
    }

    function cancelMemoryEdit() {
      document.getElementById("memory-edit-form").style.display = "none";
    }

    async function submitMemoryEdit() {
      const id  = document.getElementById("mef-id").value;
      const row = {
        uploader_name: document.getElementById("mef-name").value.trim(),
        email:         document.getElementById("mef-email").value.trim()   || null,
        event_name:    document.getElementById("mef-event").value.trim()   || null,
        caption:       document.getElementById("mef-caption").value.trim() || null,
        approved:      document.getElementById("mef-approved").value === "true",
      };
      const { error } = await db.from('memories').update(row).eq('id', id);
      if (!error) { toast("Memory saved!", "success"); cancelMemoryEdit(); loadMemories(); }
      else toast("Error: " + error.message, "error");
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
            <button class="btn btn-outline   btn-sm" onclick="previewBulletin(${p.id})">Preview</button>
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
    //  VOLUNTEERS
    // ====================================================
    let volunteersData = [];
    let volEventsCache = [];

    async function initVolunteersPanel() {
      const { data: evs } = await db.from('events').select('id, event_name, event_date').order('event_date', { ascending: false });
      volEventsCache = evs || [];
      const evSel = document.getElementById('vol-filter-event');
      evSel.innerHTML = '<option value="">All Events</option>' +
        volEventsCache.map(e => `<option value="${esc(e.id)}">${esc(e.event_name)}${e.event_date ? ' \xb7 ' + fmtDate(e.event_date) : ''}</option>`).join('');
      await loadVolunteers();
    }

    async function onVolEventFilterChange() {
      // When event filter changes, refresh role filter options then reload list
      const eventId = document.getElementById('vol-filter-event').value;
      const roleSel = document.getElementById('vol-filter-role');
      roleSel.innerHTML = '<option value="">All Roles</option>';
      if (eventId) {
        const { data: roles } = await db.from('event_volunteer_roles').select('role_label').eq('event_id', eventId).order('sort_order');
        (roles || []).forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.role_label; opt.textContent = r.role_label;
          roleSel.appendChild(opt);
        });
      }
      await loadVolunteers();
    }

    async function loadVolunteers() {
      const tbody = document.getElementById('volunteers-tbody');
      tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">Loading\u2026</td></tr>';

      const eventId      = document.getElementById('vol-filter-event').value;
      const roleFilter   = document.getElementById('vol-filter-role').value;
      const archivedSel  = document.getElementById('vol-filter-archived').value;

      let q = db.from('signups')
        .select('id, event_id, submitted_at, first_name, last_name, email, phone, address, attending, notes, archived, signup_volunteer_roles(role_label)');
      if (eventId)              q = q.eq('event_id', eventId);
      if (archivedSel === 'active')    q = q.eq('archived', false);
      if (archivedSel === 'archived')  q = q.eq('archived', true);
      q = q.order('submitted_at', { ascending: false });

      const { data, error } = await q;
      if (error) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--danger);padding:20px;">${esc(error.message)}</td></tr>`;
        return;
      }

      // Keep only rows that have at least one volunteer role
      let rows = (data || []).filter(s => s.signup_volunteer_roles && s.signup_volunteer_roles.length > 0);

      // Apply role filter client-side
      if (roleFilter) {
        rows = rows.filter(s => s.signup_volunteer_roles.some(r => r.role_label === roleFilter));
      }

      volunteersData = rows;
      document.getElementById('vol-summary').textContent =
        rows.length ? `Showing ${rows.length} volunteer${rows.length !== 1 ? 's' : ''}` : '';

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">\uD83D\uDE4B</div><p>No volunteers found.</p></div></td></tr>';
        return;
      }

      tbody.innerHTML = rows.map(s => {
        const ev    = volEventsCache.find(e => e.id === s.event_id);
        const roles = (s.signup_volunteer_roles || []).map(r => esc(r.role_label)).join(', ');
        return `
        <tr${s.archived ? ' style="opacity:0.6;"' : ''}>
          <td><strong>${esc(s.first_name)} ${esc(s.last_name)}</strong></td>
          <td>${esc(s.email || '')}</td>
          <td>${esc(s.phone || '\u2014')}</td>
          <td>${esc(s.address || '\u2014')}</td>
          <td>${esc(ev ? ev.event_name : (s.event_id || '\u2014'))}</td>
          <td>${ev && ev.event_date ? esc(fmtDate(ev.event_date)) : '\u2014'}</td>
          <td>${roles || '\u2014'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openVolunteerForm(${s.id})">Edit</button>
            <button class="btn btn-danger    btn-sm" onclick="confirmDeleteVolunteer(${s.id})">Delete</button>
          </td>
        </tr>`;
      }).join('');
    }

    async function openVolunteerForm(id) {
      const form = document.getElementById('volunteer-form');
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth' });

      // Populate event dropdown in form
      const evSel = document.getElementById('vf-event');
      evSel.innerHTML = volEventsCache.map(e =>
        `<option value="${esc(e.id)}">${esc(e.event_name)}${e.event_date ? ' \xb7 ' + fmtDate(e.event_date) : ''}</option>`
      ).join('');

      if (id) {
        document.getElementById('vol-form-title').textContent = 'Edit Volunteer';
        const s = volunteersData.find(x => x.id === id);
        if (!s) return;
        document.getElementById('vf-id').value        = s.id;
        document.getElementById('vf-first').value     = s.first_name  || '';
        document.getElementById('vf-last').value      = s.last_name   || '';
        document.getElementById('vf-email').value     = s.email       || '';
        document.getElementById('vf-phone').value     = s.phone       || '';
        document.getElementById('vf-address').value   = s.address     || '';
        document.getElementById('vf-attending').value = s.attending   || '';
        document.getElementById('vf-notes').value     = s.notes       || '';
        evSel.value = s.event_id || '';
        await loadEventRolesForForm((s.signup_volunteer_roles || []).map(r => r.role_label));
      } else {
        document.getElementById('vol-form-title').textContent = 'Add Volunteer';
        document.getElementById('vf-id').value = '';
        ['vf-first','vf-last','vf-email','vf-phone','vf-address','vf-notes'].forEach(f => { document.getElementById(f).value = ''; });
        document.getElementById('vf-attending').value = '';
        if (evSel.options.length > 0) evSel.value = evSel.options[0].value;
        await loadEventRolesForForm([]);
      }
    }

    async function loadEventRolesForForm(selectedRoles) {
      const eventId = document.getElementById('vf-event').value;
      const wrap    = document.getElementById('vf-roles-wrap');
      if (!eventId) {
        wrap.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Select an event above to see available roles.</span>';
        return;
      }
      const { data: roles } = await db.from('event_volunteer_roles')
        .select('role_label, role_detail').eq('event_id', eventId).order('sort_order');
      if (!roles || !roles.length) {
        wrap.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">No volunteer roles defined for this event.</span>';
        return;
      }
      wrap.innerHTML = roles.map(r => `
        <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--cream);border:1.5px solid rgba(44,61,46,0.12);border-radius:8px;cursor:pointer;min-width:160px;">
          <input type="checkbox" value="${esc(r.role_label)}" class="vf-role-cb"${(selectedRoles||[]).includes(r.role_label) ? ' checked' : ''} style="width:15px;height:15px;" />
          <span style="font-size:0.88rem;color:var(--forest);">${esc(r.role_label)}</span>
        </label>`).join('');
    }

    function cancelVolunteerForm() {
      document.getElementById('volunteer-form').style.display = 'none';
    }

    async function saveVolunteerEdit() {
      const id        = document.getElementById('vf-id').value;
      const eventId   = document.getElementById('vf-event').value;
      const firstName = document.getElementById('vf-first').value.trim();
      const lastName  = document.getElementById('vf-last').value.trim();
      const email     = document.getElementById('vf-email').value.trim();
      const phone     = document.getElementById('vf-phone').value.trim()   || null;
      const address   = document.getElementById('vf-address').value.trim() || null;
      const attending = document.getElementById('vf-attending').value      || null;
      const notes     = document.getElementById('vf-notes').value.trim()   || null;
      const roles     = [...document.querySelectorAll('.vf-role-cb:checked')].map(cb => cb.value);

      if (!firstName || !lastName || !email || !eventId) {
        toast('First name, last name, email, and event are required.', 'error');
        return;
      }

      const row = { event_id: eventId, first_name: firstName, last_name: lastName, email, phone, address, attending, notes };

      try {
        let signupId;
        if (id) {
          const { error } = await db.from('signups').update(row).eq('id', id);
          if (error) throw error;
          signupId = parseInt(id);
        } else {
          const { data: ins, error } = await db.from('signups').insert(row).select('id').single();
          if (error) throw error;
          signupId = ins.id;
        }

        // Replace volunteer roles
        await db.from('signup_volunteer_roles').delete().eq('signup_id', signupId);
        if (roles.length) {
          const { error: rErr } = await db.from('signup_volunteer_roles').insert(
            roles.map(r => ({ signup_id: signupId, role_label: r }))
          );
          if (rErr) throw rErr;
        }

        toast('Volunteer saved!', 'success');
        cancelVolunteerForm();
        loadVolunteers();
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    }

    function confirmDeleteVolunteer(id) {
      const s    = volunteersData.find(x => x.id === id);
      const name = s ? `${s.first_name} ${s.last_name}` : 'this volunteer';
      showModal('\uD83D\uDDD1\uFE0F', 'Delete Volunteer',
        `Delete sign-up for "${name}"? This also removes their donation pledges and role assignments.`,
        async () => {
          try {
            const { error } = await db.from('signups').delete().eq('id', id);
            if (error) throw error;
            toast('Volunteer deleted.', 'success');
            loadVolunteers();
          } catch (e) { toast('Error: ' + e.message, 'error'); }
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


    // ====================================================
    //  BULK IMPORT (CSV / Excel)
    // ====================================================

    let importType = null;
    let importRows = [];

    // Column definitions per entity type.
    // columns: ordered list used for template download + preview headers.
    // required: fields that must be non-empty for a row to be valid.
    // table: Supabase table name.
    // idCol: primary key column name, or null for auto-id tables.
    // reload: function to call after a successful import.
    const IMPORT_SCHEMAS = {
      events: {
        label: "Events",
        table: "events",
        idCol: "id",
        columns: ["id","event_name","status","event_date","event_time","signups_open_date",
                  "short_description","medium_description","long_description","emoji_row",
                  "headline_adjective","location_name","location_address","banner_color_class",
                  "organizer_name","organizer_email","organizer_phone","organizer_contact"],
        required: ["id","event_name"],
        reload: () => loadEvents(),
      },
      award_contests: {
        label: "Award Contests",
        table: "award_contests",
        idCol: "id",
        columns: ["id","icon","badge","banner_color","award_name","category",
                  "period","status","description","deadline","prize"],
        required: ["id","award_name"],
        reload: () => loadContests(),
      },
      announcements: {
        label: "Announcements",
        table: "announcements",
        idCol: null,
        columns: ["day","month","title","body","link","link_text","published"],
        required: ["title"],
        reload: () => loadAnnouncements(),
      },
      links: {
        label: "Links",
        table: "links",
        idCol: null,
        columns: ["category","icon","title","description","url","url_label","sort_order"],
        required: ["category","title","url"],
        reload: () => loadLinks(),
      },
      documents: {
        label: "Documents",
        table: "documents",
        idCol: null,
        columns: ["category","icon","title","description","url","url_label","sort_order"],
        required: ["category","title","url"],
        reload: () => loadDocuments(),
      },
      winners: {
        label: "Winners",
        table: "winners",
        idCol: null,
        columns: ["award","winner_name","period","year","icon","badge","banner_color",
                  "prize","photo_id","blurb","quote1","quote2","quote3"],
        required: ["award","winner_name"],
        reload: () => { loadWinners(); },
      },
    };

    function openImportModal(type) {
      importType = type;
      importRows = [];
      const schema = IMPORT_SCHEMAS[type];
      document.getElementById("import-modal-title").textContent = "Import " + schema.label;
      document.getElementById("import-file").value = "";
      document.getElementById("import-paste").value = "";
      document.getElementById("import-preview").style.display = "none";
      document.getElementById("import-confirm-btn").disabled = true;
      document.getElementById("import-modal").classList.remove("hidden");
    }

    function closeImportModal() {
      document.getElementById("import-modal").classList.add("hidden");
      importType = null;
      importRows = [];
    }

    // Download a blank CSV template with the correct column headers for this entity type.
    function downloadImportTemplate() {
      if (!importType) return;
      const schema = IMPORT_SCHEMAS[importType];
      const csv = schema.columns.join(",") + "\\n";
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = importType + "_template.csv";
      a.click();
    }

    // Parse a raw CSV string into { headers, rows }.
    // Handles quoted fields and embedded commas/newlines.
    function parseCSVText(text) {
      const lines = text.trim().split(/\\r?\\n/);
      if (lines.length < 2) return { headers: [], rows: [] };

      function parseLine(line) {
        const result = [];
        let cur = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim());
        return result;
      }

      const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
      const rows = lines.slice(1).filter(l => l.trim()).map(l => {
        const vals = parseLine(l);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : ""; });
        return obj;
      });
      return { headers, rows };
    }

    // Handle file upload (.csv or .xlsx/.xls).
    async function handleImportFile() {
      const file = document.getElementById("import-file").files[0];
      if (!file) return;
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv") {
        const text = await file.text();
        const { rows } = parseCSVText(text);
        renderImportPreview(rows);
      } else if (ext === "xlsx" || ext === "xls") {
        if (!window.XLSX) { toast("Excel library not loaded yet. Try again in a moment.", "error"); return; }
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const rows = data.map(row => {
          const out = {};
          Object.entries(row).forEach(([k, v]) => {
            out[k.toLowerCase().replace(/\\s+/g, "_").replace(/[^a-z0-9_]/g, "")] = String(v ?? "");
          });
          return out;
        });
        renderImportPreview(rows);
      } else {
        toast("Unsupported file type. Use .csv or .xlsx.", "error");
      }
    }

    // Parse pasted CSV text when the user clicks "Parse Text".
    function parseImportPaste() {
      const text = document.getElementById("import-paste").value;
      if (!text.trim()) { toast("Paste some CSV text first.", "error"); return; }
      const { rows } = parseCSVText(text);
      renderImportPreview(rows);
    }

    // Build and show the preview table from a parsed rows array.
    function renderImportPreview(rows) {
      if (!importType || !rows.length) { toast("No data rows found.", "error"); return; }
      importRows = rows;
      const schema = IMPORT_SCHEMAS[importType];

      // Only show columns that are in the schema (ignore unknown cols from user file).
      const headers = schema.columns.filter(col => rows[0].hasOwnProperty(col));
      if (!headers.length) {
        toast("No matching columns found. Download the template to see expected headers.", "error");
        return;
      }

      let html = '<thead><tr style="background:var(--surface-2,#f5f5f5);position:sticky;top:0;">';
      headers.forEach(h => { html += `<th style="padding:6px 8px;text-align:left;font-size:0.7rem;white-space:nowrap;border-bottom:1px solid var(--border);">${esc(h)}</th>`; });
      html += '</tr></thead><tbody>';

      const preview = rows.slice(0, 10);
      preview.forEach((row, i) => {
        html += `<tr style="${i % 2 === 1 ? 'background:var(--surface-2,#f5f5f5)' : ''}">`;
        headers.forEach(h => {
          html += `<td style="padding:5px 8px;font-size:0.7rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(String(row[h]||""))}">${esc(String(row[h]||""))}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';
      if (rows.length > 10) {
        html += `<tfoot><tr><td colspan="${headers.length}" style="padding:6px 8px;font-size:0.7rem;color:var(--muted);">… and ${rows.length - 10} more row(s) not shown</td></tr></tfoot>`;
      }

      document.getElementById("import-preview-table").innerHTML = html;
      document.getElementById("import-preview-count").textContent =
        `${rows.length} row${rows.length !== 1 ? "s" : ""} ready to import`;
      document.getElementById("import-preview").style.display = "block";
      document.getElementById("import-confirm-btn").disabled = false;
    }

    // Validate and batch-insert all parsed rows into Supabase.
    async function submitImport() {
      if (!importType || !importRows.length) return;
      const schema = IMPORT_SCHEMAS[importType];

      // Map each row to only include valid schema columns; coerce types.
      const rows = importRows.map(row => {
        const out = {};
        schema.columns.forEach(col => {
          const val = row[col];
          if (val === undefined || val === "") return;
          if (col === "published" || col === "approved") {
            out[col] = val.toLowerCase() === "true" || val === "1";
          } else if (col === "sort_order") {
            out[col] = parseInt(val) || 0;
          } else {
            out[col] = val;
          }
        });
        return out;
      });

      // Validate required fields.
      const errors = [];
      schema.required.forEach(req => {
        const bad = rows.reduce((acc, r, i) => (!r[req] ? acc.concat(i + 1) : acc), []);
        if (bad.length) errors.push(`"${req}" is empty in row(s) ${bad.join(", ")}`);
      });
      if (errors.length) { toast("Validation failed: " + errors.join("; "), "error"); return; }

      const btn = document.getElementById("import-confirm-btn");
      btn.disabled = true;
      btn.textContent = "Importing…";

      try {
        let error;
        if (schema.idCol) {
          ({ error } = await db.from(schema.table).upsert(rows, { onConflict: schema.idCol }));
        } else {
          ({ error } = await db.from(schema.table).insert(rows));
        }
        if (error) throw error;
        toast(`✓ Imported ${rows.length} ${schema.label.toLowerCase()} successfully!`, "success");
        closeImportModal();
        schema.reload();
      } catch (e) {
        toast("Import error: " + e.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Import All Rows";
      }
    }


    // ====================================================
    //  PREVIEW MODAL HELPERS (D1 Bulletin, D2 Nominations, D3 Memories)
    // ====================================================

    function openPreviewModal(title, bodyHtml, actionsHtml) {
      document.getElementById('preview-modal-title').textContent = title;
      document.getElementById('preview-modal-body').innerHTML    = bodyHtml;
      document.getElementById('preview-modal-actions').innerHTML = actionsHtml || '';
      document.getElementById('preview-modal').classList.remove('hidden');
    }

    function closePreviewModal() {
      document.getElementById('preview-modal').classList.add('hidden');
    }

    // ── D1: Bulletin Board preview ──────────────────────────────
    function previewBulletin(id) {
      const p = bulletinData.find(x => x.id === id);
      if (!p) return;
      const ids = extractDriveIds(p.photo_urls || []);
      const photos = ids.map(did =>
        `<img src="https://drive.google.com/thumbnail?id=${esc(did)}&sz=w200"
             style="width:120px;height:90px;object-fit:cover;border-radius:4px;margin:4px;"
             onerror="this.style.display='none'" />`
      ).join('');
      const body =
        `<div style="margin-bottom:12px;">
           <span style="display:inline-block;padding:3px 10px;background:var(--forest);color:var(--cream);border-radius:20px;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;">${esc(p.category||'')}</span>
         </div>
         <h2 style="margin:0 0 8px;font-size:1.2rem;">${esc(p.title||'')}</h2>
         <p style="font-size:0.8rem;color:var(--muted);margin:0 0 16px;">${esc(fmtDate(p.submitted_at))} · ${esc(p.poster_name||'')}</p>
         <div style="line-height:1.7;margin-bottom:16px;">${p.content || ''}</div>
         ${photos ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px;">${photos}</div>` : ''}
         <div style="font-size:0.8rem;color:var(--muted);border-top:1px solid rgba(44,61,46,0.1);padding-top:12px;">
           ${p.show_email && p.email   ? `<div>Email: ${esc(p.email)}</div>` : ''}
           ${p.show_phone && p.phone   ? `<div>Phone: ${esc(p.phone)}</div>` : ''}
           ${p.address                 ? `<div>Address: ${esc(p.address)}</div>` : ''}
         </div>`;
      const actions = !p.approved
        ? `<button class="btn btn-success" onclick="approveBulletin(${id});closePreviewModal()">Approve</button>
           <button class="btn btn-danger"  onclick="confirmDeleteBulletin(${id});closePreviewModal()">Delete</button>`
        : `<button class="btn btn-secondary" onclick="openBulletinEdit(${id});closePreviewModal()">Edit</button>
           <button class="btn btn-danger"    onclick="confirmDeleteBulletin(${id});closePreviewModal()">Delete</button>`;
      openPreviewModal('Bulletin Post Preview', body, actions);
    }

    // ── D2: Nomination preview ──────────────────────────────────
    function previewNomination(id) {
      const n = nominationsData.find(x => x.id === id);
      if (!n) return;
      const contest = contestsData.find(c => c.id === n.contest_id);
      const ids = extractDriveIds(n.photo_urls || []);
      const photos = ids.map(did =>
        `<img src="https://drive.google.com/thumbnail?id=${esc(did)}&sz=w200"
             style="width:120px;height:90px;object-fit:cover;border-radius:4px;margin:4px;"
             onerror="this.style.display='none'" />`
      ).join('');
      const body =
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
           <div>
             <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Nominator</div>
             <div style="font-weight:600;">${esc(n.nominator_name||'—')}</div>
             <div style="font-size:0.85rem;color:var(--muted);">${esc(n.nominator_email||'')}</div>
             <div style="font-size:0.85rem;color:var(--muted);">${esc(n.nominator_phone||'')}</div>
             <div style="font-size:0.85rem;color:var(--muted);">${esc(n.nominator_address||'')}</div>
           </div>
           <div>
             <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Nominee</div>
             <div style="font-weight:600;">${esc(n.nominee_name||'—')}</div>
             <div style="font-size:0.85rem;color:var(--muted);">${esc(n.nominee_address||'')}</div>
           </div>
         </div>
         <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Award</div>
         <div style="font-weight:600;margin-bottom:16px;">${esc(contest ? contest.award_name : (n.contest_id||'—'))}${n.custom_award ? ` — ${esc(n.custom_award)}` : ''}</div>
         <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Reasons</div>
         <div style="white-space:pre-wrap;line-height:1.6;margin-bottom:16px;">${esc(n.reasons||'—')}</div>
         ${photos ? `<div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Photos</div>
         <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px;">${photos}</div>` : ''}`;
      const actions = !n.approved
        ? `<button class="btn btn-success" onclick="markNominationReceived(${id});closePreviewModal()">Mark Received</button>
           <button class="btn btn-secondary" onclick="openNominationForm(${id});closePreviewModal()">Edit</button>
           <button class="btn btn-danger"    onclick="confirmDeleteNomination(${id});closePreviewModal()">Delete</button>`
        : `<button class="btn btn-secondary" onclick="openNominationForm(${id});closePreviewModal()">Edit</button>
           <button class="btn btn-danger"    onclick="confirmDeleteNomination(${id});closePreviewModal()">Delete</button>`;
      openPreviewModal('Nomination Preview', body, actions);
    }

    // ── D3: Memory preview ──────────────────────────────────────
    function previewMemory(id) {
      const m = memoriesData.find(x => x.id === id);
      if (!m) return;
      const ids = extractDriveIds(m.photo_urls || []);
      const photos = ids.map(did =>
        `<img src="https://drive.google.com/thumbnail?id=${esc(did)}&sz=w300"
             style="width:150px;height:110px;object-fit:cover;border-radius:4px;margin:4px;"
             onerror="this.style.display='none'" />`
      ).join('');
      const body =
        `<div style="margin-bottom:16px;">
           <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Event</div>
           <div style="font-weight:600;font-size:1.05rem;">${esc(m.event_name||'—')}</div>
         </div>
         <div style="margin-bottom:16px;">
           <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Uploaded by</div>
           <div>${esc(m.uploader_name||'—')} · <span style="color:var(--muted);">${esc(m.email||'')}</span></div>
           <div style="font-size:0.8rem;color:var(--muted);">${esc(fmtDate(m.submitted_at))}</div>
         </div>
         ${m.caption ? `<div style="margin-bottom:16px;">
           <div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Caption</div>
           <div style="line-height:1.6;">${esc(m.caption)}</div>
         </div>` : ''}
         ${photos ? `<div style="font-size:0.7rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Photos (${ids.length})</div>
         <div style="display:flex;flex-wrap:wrap;gap:4px;">${photos}</div>` : ''}`;
      const actions = !m.approved
        ? `<button class="btn btn-success" onclick="approveMemory(${id});closePreviewModal()">Approve</button>
           <button class="btn btn-secondary" onclick="openMemoryEdit(${id});closePreviewModal()">Edit</button>
           <button class="btn btn-danger"    onclick="confirmDeleteMemory(${id});closePreviewModal()">Delete</button>`
        : `<button class="btn btn-secondary" onclick="openMemoryEdit(${id});closePreviewModal()">Edit</button>
           <button class="btn btn-danger"    onclick="confirmDeleteMemory(${id});closePreviewModal()">Delete</button>`;
      openPreviewModal('Memory Preview', body, actions);
    }

  </script>
</body>
</html>
'''

content = open('admin.html', 'r', encoding='utf-8').read()

# Find the JS injection point by text search (robust — survives HTML additions above)
MARKER = "    // ── HELPERS"
start_idx = content.find(MARKER)
if start_idx == -1:
    raise RuntimeError("Injection marker '// ── HELPERS' not found in admin.html")

# Replace from start_idx to end of file with new tail
new_content = content[:start_idx] + new_tail

open('admin.html', 'w', encoding='utf-8').write(new_content)
print(f'Done. Lines: {len(new_content.splitlines())}')
