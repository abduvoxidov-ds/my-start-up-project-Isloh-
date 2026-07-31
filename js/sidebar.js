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

   Sprint 6C: also mounts the mobile nav (off-canvas drawer). The toggle
   button and backdrop are injected here for the same reason the nav is —
   so 60 HTML files don't each hand-roll the same markup. CSS lives in
   css/layout.css under the 900px breakpoint.
   ========================================================================== */

const ISLOH_MOBILE_NAV_MQ = '(max-width: 900px)';

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

  // Nav elementlari joyiga qo'yilgandan keyin mobil boshqaruvni ulaymiz
  isloh_mountMobileNav(aside);
}

/* --- Mobil navigatsiya ---------------------------------------------------- */

function isloh_buildNavToggle(aside) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-controls', aside.id);
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Menyuni ochish');
  btn.innerHTML = '<i class="bi bi-list"></i>';
  return btn;
}

/* Tugma topbar bor sahifada uning boshiga, topbar yo'q sahifalarda esa
   alohida ixcham mobil satrga joylashadi — ikkalasi ham faqat ≤900px da
   ko'rinadi (css/layout.css). */
function isloh_placeNavToggle(mainCol, toggle) {
  const topbar = mainCol.querySelector('.topbar');
  if (topbar) {
    topbar.insertBefore(toggle, topbar.firstChild);
    return;
  }

  const bar = document.createElement('div');
  bar.className = 'mobile-nav-bar';
  const title = document.createElement('div');
  title.className = 'mobile-nav-title';
  title.textContent = 'Isloh';
  bar.appendChild(toggle);
  bar.appendChild(title);
  mainCol.insertBefore(bar, mainCol.firstChild);
}

function isloh_mountMobileNav(aside) {
  const mainCol = document.querySelector('.main-col');
  if (!mainCol || mainCol.querySelector('.nav-toggle')) return;

  if (!aside.id) aside.id = 'sidebar';

  const toggle = isloh_buildNavToggle(aside);
  isloh_placeNavToggle(mainCol, toggle);

  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  let isOpen = false;

  function setNavOpen(open, returnFocus) {
    isOpen = open;
    aside.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menyuni yopish' : 'Menyuni ochish');
    toggle.innerHTML = open ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-list"></i>';

    if (open) {
      const firstItem = aside.querySelector('.nav-item');
      if (firstItem) firstItem.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  }

  toggle.addEventListener('click', () => setNavOpen(!isOpen, true));
  backdrop.addEventListener('click', () => setNavOpen(false, true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setNavOpen(false, true);
  });

  // Menyudan havola tanlangach panel yopiladi (sahifa almashmasa ham)
  aside.addEventListener('click', (e) => {
    if (isOpen && e.target.closest('.nav-item')) setNavOpen(false, false);
  });

  // Desktopga qaytilganda ochiq qolgan holat tozalanadi
  const mq = window.matchMedia(ISLOH_MOBILE_NAV_MQ);
  const onBreakpointChange = (e) => { if (!e.matches && isOpen) setNavOpen(false, false); };
  if (mq.addEventListener) mq.addEventListener('change', onBreakpointChange);
  else mq.addListener(onBreakpointChange); // eski Safari uchun
}

document.addEventListener('DOMContentLoaded', isloh_renderSidebar);
