/* ==========================================================================
   ISLOH — Tabs module  (Sprint 5B)
   Generic switcher for the `.tab-strip` / `.tab-item` components (see the
   "Tabs" entry in pages/shared/components.html — visual-only until now).
   Powers pages/instructor/lesson-editor.html's Content/Resources/Settings/
   Preview tabs, and is reusable anywhere `.tab-strip` appears.

   Markup contract:
     [data-tabs]
       .tab-strip
         .tab-item[data-tab-target="<id>"]   (.active = current)
       [data-tab-panel="<id>"]               → one per tab, sibling or
                                                 descendant of [data-tabs]
   ========================================================================== */

function isloh_initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((scope) => {
    const tabs = [...scope.querySelectorAll('.tab-item[data-tab-target]')];
    if (!tabs.length) return;
    const panels = [...scope.querySelectorAll('[data-tab-panel]')];

    function activate(id) {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tabTarget === id));
      panels.forEach((p) => { p.hidden = p.dataset.tabPanel !== id; });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.tabTarget));
      tab.setAttribute('role', 'tab');
      tab.setAttribute('tabindex', '0');
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(tab.dataset.tabTarget); }
      });
    });

    activate(tabs[0].dataset.tabTarget);
  });
}

document.addEventListener('DOMContentLoaded', isloh_initTabs);
