/* ==========================================================================
   ISLOH — Sidebar renderer
   Reads NAV_CONFIG (js/navigation.js) and injects the nav markup into any
   page that has:

     <aside class="sidebar" data-role="student" data-active="dashboard">
       <div class="brand">...</div>
       <nav class="nav-group" id="sidebar-nav"></nav>
       <div class="sidebar-footer" id="sidebar-footer-nav"></div>
     </aside>

   This replaces copy-pasted <a class="nav-item">...</a> blocks on every
   page with one render function, so the menu only has to change in one
   place (js/navigation.js) to update everywhere — the core ask of
   Sprint 2's "Sidebar Architecture" section.

   NOTE: markup is generated with plain string templating (innerHTML), not
   fetch() of an external partial — fetch() of local files fails under the
   file:// protocol in most browsers (CORS), which this project needs to
   support since it has no dev server yet. TODO: switch to fetch-based
   includes once the project is served over http(s).
   ========================================================================== */

function isloh_renderNavItem(item, activeKey) {
  const isActive = item.key === activeKey;
  const cls = 'nav-item' + (isActive ? ' active' : '');
  const aria = isActive ? ' aria-current="page"' : '';
  return `<a href="${item.href}" class="${cls}"${aria}><i class="bi ${item.icon}"></i> ${item.label}</a>`;
}

function isloh_renderSidebar() {
  const aside = document.querySelector('.sidebar[data-role]');
  if (!aside) return;

  const role = aside.dataset.role;
  const activeKey = aside.dataset.active || '';
  const items = (typeof NAV_CONFIG !== 'undefined' && NAV_CONFIG[role]) || [];

  const navMount = aside.querySelector('#sidebar-nav');
  if (navMount) {
    navMount.setAttribute('role', 'navigation');
    navMount.setAttribute('aria-label', role === 'instructor' ? "O'qituvchi menyusi" : (role === 'admin' ? 'Admin menyusi' : 'Talaba menyusi'));
    navMount.innerHTML = items.map((item) => isloh_renderNavItem(item, activeKey)).join('');
  }

  const footerMount = aside.querySelector('#sidebar-footer-nav');
  if (footerMount && typeof NAV_CONFIG !== 'undefined') {
    footerMount.innerHTML = NAV_CONFIG.footer.map((item) => isloh_renderNavItem(item, '')).join('');
  }

  // Theme modifier: instructor sidebar uses the green accent (tokens already
  // exist in css/tokens.css + .sidebar.theme-teach in css/layout.css).
  if (role === 'instructor') {
    aside.classList.add('theme-teach');
  }
  if (role === 'admin') {
    aside.classList.add('theme-admin');
  }
}

document.addEventListener('DOMContentLoaded', isloh_renderSidebar);
