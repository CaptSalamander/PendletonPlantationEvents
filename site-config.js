// ============================================================
//  File:        site-config.js
//  Purpose:     Loads community name/email/phone from the Supabase
//               config table and makes them available globally as
//               window.SITE_CONFIG. Also automatically populates
//               any HTML element with a data-config attribute.
//
//  Requires:    supabase-config.js loaded before this file (db client).
//
//  Usage in HTML:
//    <!-- Include after supabase-config.js -->
//    <script src="site-config.js"></script>
//
//    <!-- Then tag elements to populate automatically: -->
//    <a href="#" data-config="organizer_email_link">Contact</a>
//    <span data-config="organizer_name"></span>
//
//  data-config attribute values:
//    "organizer_name"        — replaced with organizer name text
//    "organizer_email"       — replaced with email text content
//    "organizer_email_link"  — sets href="mailto:..." AND text content
//    "organizer_phone"       — replaced with phone text content
//    "organizer_phone_link"  — sets href="tel:..." AND text content
//
//  Direct access in JS:
//    window.SITE_CONFIG.organizer_email
//    window.SITE_CONFIG.organizer_name
//    window.SITE_CONFIG.organizer_phone
// ============================================================

// Fallback values used before (or if) the DB config loads
window.SITE_CONFIG = {
  organizer_name:  'Pendleton Plantation HOA',
  organizer_email: 'mandyvaliquette00@gmail.com',
  organizer_phone: '',
};

(async function loadSiteConfig() {
  try {
    const { data, error } = await db
      .from('config')
      .select('key, value')
      .in('key', ['organizer_name', 'organizer_email', 'organizer_phone', 'organizer_contact']);

    if (error || !data) return;

    data.forEach(row => {
      if (row.key && row.value) {
        window.SITE_CONFIG[row.key] = row.value;
      }
    });

    applyConfigToDOM();
  } catch (_) {
    // Silent fallback — hardcoded values remain
  }
})();

function applyConfigToDOM() {
  const cfg = window.SITE_CONFIG;

  document.querySelectorAll('[data-config]').forEach(el => {
    const key = el.getAttribute('data-config');

    switch (key) {
      case 'organizer_name':
        el.textContent = cfg.organizer_name || '';
        break;

      case 'organizer_email':
        el.textContent = cfg.organizer_email || '';
        break;

      case 'organizer_email_link':
        if (cfg.organizer_email) {
          el.setAttribute('href', 'mailto:' + cfg.organizer_email);
          // Only overwrite text if it's a placeholder or empty
          if (!el.textContent.trim() || el.textContent.trim() === el.getAttribute('data-config-placeholder')) {
            el.textContent = cfg.organizer_email;
          }
        }
        break;

      case 'organizer_phone':
        el.textContent = cfg.organizer_phone || '';
        break;

      case 'organizer_phone_link':
        if (cfg.organizer_phone) {
          el.setAttribute('href', 'tel:' + cfg.organizer_phone.replace(/\D/g, ''));
          if (!el.textContent.trim()) {
            el.textContent = cfg.organizer_phone;
          }
        }
        break;

      default:
        // Unknown key — do nothing
        break;
    }
  });
}
