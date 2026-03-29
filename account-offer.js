// ============================================================
//  account-offer.js
//  Shared post-submission "Create a free account" invite.
//
//  Usage:
//    1. Include this script after supabase-config.js.
//    2. Place <div id="account-offer-container"></div> inside
//       or just below the success screen.
//    3. Call showAccountOffer(prefillEmail) when showing success.
//
//  The component checks for an active session automatically
//  and does nothing if the user is already logged in.
// ============================================================

(function () {

  // ── Inject component styles once ──────────────────────────
  if (!document.getElementById('ao-styles')) {
    const style = document.createElement('style');
    style.id = 'ao-styles';
    style.textContent = `
      #account-offer-container {
        margin-top: 28px;
      }
      .ao-card {
        background: rgba(44, 61, 46, 0.04);
        border: 1.5px solid rgba(44, 61, 46, 0.14);
        border-radius: 14px;
        padding: 28px 32px;
        text-align: center;
      }
      .ao-icon {
        font-size: 2rem;
        margin-bottom: 10px;
      }
      .ao-title {
        font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
        font-size: 1.3rem;
        font-weight: 400;
        color: #2c3d2e;
        margin: 0 0 10px;
      }
      .ao-body {
        font-size: 0.88rem;
        color: #666;
        line-height: 1.65;
        margin: 0 0 20px;
        max-width: 380px;
        margin-left: auto;
        margin-right: auto;
      }
      .ao-fields {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 360px;
        margin: 0 auto 14px;
        text-align: left;
      }
      .ao-input {
        width: 100%;
        padding: 10px 14px;
        border: 1.5px solid rgba(44, 61, 46, 0.22);
        border-radius: 8px;
        font-family: inherit;
        font-size: 0.9rem;
        color: #2c3d2e;
        background: #fff;
        box-sizing: border-box;
        transition: border-color 0.15s;
      }
      .ao-input:focus {
        outline: none;
        border-color: #4a6741;
      }
      .ao-error {
        font-size: 0.82rem;
        color: #8b2222;
        margin: 0 auto 10px;
        max-width: 360px;
        text-align: left;
        min-height: 0;
      }
      .ao-btn {
        display: inline-block;
        padding: 12px 30px;
        background: #2c3d2e;
        color: #f5f0e8;
        font-family: inherit;
        font-size: 0.88rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        margin-bottom: 14px;
      }
      .ao-btn:hover:not(:disabled) {
        background: #4a6741;
      }
      .ao-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ao-skip {
        font-size: 0.78rem;
        color: #888;
        margin: 0;
      }
      .ao-skip a {
        color: #4a6741;
        text-decoration: none;
      }
      .ao-skip a:hover {
        text-decoration: underline;
      }
      .ao-success-icon {
        font-size: 2.2rem;
        margin-bottom: 8px;
      }
      .ao-success-title {
        font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
        font-size: 1.2rem;
        font-weight: 400;
        color: #2c3d2e;
        margin: 0 0 8px;
      }
      .ao-success-body {
        font-size: 0.88rem;
        color: #666;
        margin: 0;
      }
      .ao-success-body a {
        color: #4a6741;
        font-weight: 600;
        text-decoration: none;
      }
      .ao-success-body a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }


  // ── showAccountOffer ─────────────────────────────────────
  // Call after showing a success screen. Pass the email the
  // user typed into the submission form (may be empty string).
  window.showAccountOffer = async function (prefillEmail) {
    const container = document.getElementById('account-offer-container');
    if (!container) return;

    // Skip silently if already signed in.
    try {
      const { data: { session } } = await db.auth.getSession();
      if (session) return;
    } catch (_) { return; }

    const safeEmail = String(prefillEmail || '').replace(/"/g, '&quot;');

    container.innerHTML = `
      <div class="ao-card">
        <div class="ao-icon">🏡</div>
        <h3 class="ao-title">Track this &amp; future submissions</h3>
        <p class="ao-body">
          Create a free resident account to view all your event sign-ups,
          nominations, bulletin posts, and memories in one place.
        </p>
        <div class="ao-fields">
          <input type="email"    id="ao-email"    class="ao-input" placeholder="Email address"          value="${safeEmail}" autocomplete="email" />
          <input type="password" id="ao-password" class="ao-input" placeholder="Password (6+ characters)" autocomplete="new-password" />
          <input type="password" id="ao-confirm"  class="ao-input" placeholder="Confirm password"          autocomplete="new-password" />
        </div>
        <div id="ao-error" class="ao-error" role="alert"></div>
        <button id="ao-btn" class="ao-btn" onclick="_aoSubmit()">Create Free Account →</button>
        <p class="ao-skip">
          Already have an account? <a href="account.html">Sign in →</a>
          &nbsp;·&nbsp;
          <a href="#" onclick="document.getElementById('account-offer-container').innerHTML='';return false;">No thanks</a>
        </p>
      </div>`;
  };


  // ── _aoSubmit ────────────────────────────────────────────
  // Handles the inline sign-up form submission.
  window._aoSubmit = async function () {
    const email    = (document.getElementById('ao-email')?.value    || '').trim();
    const password =  document.getElementById('ao-password')?.value || '';
    const confirm  =  document.getElementById('ao-confirm')?.value  || '';
    const errEl    =  document.getElementById('ao-error');
    const btn      =  document.getElementById('ao-btn');

    errEl.textContent = '';

    if (!email)              { errEl.textContent = 'Please enter your email address.'; return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';

    const { error } = await db.auth.signUp({ email, password });

    if (error) {
      btn.disabled    = false;
      btn.textContent = 'Create Free Account →';
      const already = error.status === 422 ||
                      error.message.toLowerCase().includes('already') ||
                      error.message.toLowerCase().includes('registered');
      errEl.innerHTML = already
        ? 'An account with this email already exists. <a href="account.html" style="color:#4a6741;font-weight:600;">Sign in →</a>'
        : error.message;
      return;
    }

    // Link any prior guest submissions with this email.
    try { await db.rpc('claim_guest_submissions'); } catch (_) {}

    const container = document.getElementById('account-offer-container');
    container.innerHTML = `
      <div class="ao-card">
        <div class="ao-success-icon">✅</div>
        <h3 class="ao-success-title">Account created!</h3>
        <p class="ao-success-body">
          You're all set. <a href="account.html">View your account →</a>
        </p>
      </div>`;
  };

})();
