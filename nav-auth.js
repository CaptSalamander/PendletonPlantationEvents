// ============================================================
//  nav-auth.js
//  Updates the top nav based on the user's auth state.
//
//  - Logged out : shows "Sign In / Register" button (default)
//  - Logged in  : changes button label to "My Account"
//  - Admin only : reveals the Admin nav link
//
//  Must be loaded after supabase-config.js (creates `db`).
// ============================================================

(function () {

  async function initNav() {
    if (typeof db === 'undefined') return;

    const btn       = document.getElementById('nav-account-btn');
    const adminItem = document.getElementById('nav-admin-item');

    try {
      const { data: { session } } = await db.auth.getSession();

      if (!session) return; // logged out — defaults already set in HTML

      // Logged in: update button label
      if (btn) btn.textContent = 'My Account';

      // Show Admin link only for admin-role users
      if (adminItem) {
        const { data: profile } = await db
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile?.role === 'admin') {
          adminItem.style.display = '';
        }
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }

})();
