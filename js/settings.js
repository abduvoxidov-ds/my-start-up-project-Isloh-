/* ==========================================================================
   ISLOH — Settings module  (Sprint 3B)
   Left-nav section switching for pages/student/settings.html. Clicking a
   settings-nav item shows the matching section panel and scrolls it into
   view. Toggles reuse the existing .switch component (css/components.css);
   no bespoke toggle logic needed here.

   Markup contract:
     .settings-nav-item[data-settings-target="<id>"]
     .settings-section[data-settings-panel="<id>"]
   ========================================================================== */

function isloh_initSettings() {
  const navItems = document.querySelectorAll('.settings-nav-item[data-settings-target]');
  if (!navItems.length) return;

  const panels = document.querySelectorAll('.settings-section[data-settings-panel]');

  function activate(id) {
    navItems.forEach((n) => n.classList.toggle('active', n.dataset.settingsTarget === id));
    panels.forEach((p) => { p.hidden = p.dataset.settingsPanel !== id; });
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => activate(item.dataset.settingsTarget));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(item.dataset.settingsTarget); }
    });
  });

  // start on the first section
  activate(navItems[0].dataset.settingsTarget);
}

document.addEventListener('DOMContentLoaded', isloh_initSettings);
