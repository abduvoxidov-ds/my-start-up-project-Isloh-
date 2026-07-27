/* ==========================================================================
   ISLOH — Notification Bell Dropdown  (notif-panel.js)
   Injects a bell button with badge into the topbar and renders a
   popover/dropdown with recent notifications. Works for all roles
   (student, instructor, admin) — role is read from the sidebar's
   data-role attribute so no per-page config is needed.

   Markup contract (auto-injected, no page changes required):
     .topbar-actions  → the bell btn is prepended here
     .sidebar[data-role]  → used to detect role for link prefixes
   ========================================================================== */

(function () {
  'use strict';

  /* ── Sample notification data per role ─────────────────────────────────── */
  const NOTIF_DATA = {
    student: [
      { id: 1,  read: false, icon: 'bi-play-circle-fill',      color: '#7C6FD8', title: 'Yangi dars qo\'shildi',          body: '"Python Backend" kursiga 3 ta yangi video qo\'shildi.',   href: 'courses.html',      time: '5 daqiqa oldin' },
      { id: 2,  read: false, icon: 'bi-patch-check-fill',      color: '#2ECC71', title: 'Sertifikat tayyor!',             body: '"UI/UX Asoslari" kursini muvaffaqiyatli tamomladingiz.', href: 'certificates.html', time: '1 soat oldin' },
      { id: 3,  read: false, icon: 'bi-calendar-event-fill',   color: '#F59E0B', title: 'Bugun jonli seans bor',          body: 'Saat 18:00 da "React Native" onlayn darsi boshlanadi.', href: 'calendar.html',     time: '2 soat oldin' },
      { id: 4,  read: true,  icon: 'bi-check2-circle',         color: '#6366F1', title: 'Topshiriq baholandi',            body: '"JS Loyihasi" topshirig\'ingiz 92/100 ball oldi.',       href: 'tasks.html',        time: 'Kecha' },
      { id: 5,  read: true,  icon: 'bi-stars',                 color: '#A78BFA', title: 'AI maslahat tayyor',             body: 'AI yordamchi yangi o\'rganish rejangizni tayyorladi.',   href: 'ai-assistant.html', time: '2 kun oldin' },
    ],
    instructor: [
      { id: 1,  read: false, icon: 'bi-person-plus-fill',      color: '#2ECC71', title: 'Yangi talaba qo\'shildi',        body: 'Kamola Yusupova "Django Masterclass" kursiga yozildi.', href: '../instructor/students.html',     time: '10 daqiqa oldin' },
      { id: 2,  read: false, icon: 'bi-file-earmark-check-fill',color:'#7C6FD8', title: 'Topshiriq topshirildi',         body: '5 ta talaba "7-dars topshirig\'i" ni topshirdi.',       href: '../instructor/assignments.html', time: '30 daqiqa oldin' },
      { id: 3,  read: false, icon: 'bi-star-fill',             color: '#F59E0B', title: 'Yangi sharh qoldirildi',         body: 'Asror Toshmatov kursga 5 yulduz baho berdi.',           href: '../instructor/reviews.html',    time: '1 soat oldin' },
      { id: 4,  read: true,  icon: 'bi-cash-stack',            color: '#10B981', title: 'To\'lov amalga oshirildi',       body: 'Bu oy daromadingiz 1,250,000 so\'mga yetdi.',           href: '../instructor/revenue.html',    time: 'Kecha' },
      { id: 5,  read: true,  icon: 'bi-bar-chart-fill',        color: '#6366F1', title: 'Haftalik hisobot tayyor',        body: 'O\'tgan hafta 24 ta yangi talaba qo\'shildi.',           href: '../instructor/analytics.html',  time: '2 kun oldin' },
    ],
    admin: [
      { id: 1,  read: false, icon: 'bi-person-fill-exclamation', color: '#EF4444', title: 'Yangi ro\'yxatdan o\'tish', body: '3 ta yangi provayder ro\'yxatdan o\'tdi, tekshiring.',    href: '../admin/admin-users.html',        time: '15 daqiqa oldin' },
      { id: 2,  read: false, icon: 'bi-journal-plus',           color: '#7C6FD8', title: 'Kurs tasdiqlash kutilmoqda', body: '2 ta yangi kurs ko\'rib chiqishni kutmoqda.',            href: '../admin/admin-courses.html',      time: '1 soat oldin' },
      { id: 3,  read: true,  icon: 'bi-bag-check-fill',         color: '#2ECC71', title: 'Marketplace yangilandi',     body: 'Yangi 5 ta mahsulot marketplace ga qo\'shildi.',         href: '../admin/admin-marketplace.html',  time: 'Kecha' },
    ],
  };

  /* ── CSS injected once ──────────────────────────────────────────────────── */
  const STYLES = `
    .np-bell-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--ink-600, #555);
      cursor: pointer;
      font-size: 17px;
      transition: background 0.18s;
    }
    .np-bell-btn:hover { background: var(--bg-hover, rgba(0,0,0,0.06)); }
    .np-bell-btn .np-badge {
      position: absolute;
      top: 5px;
      right: 5px;
      min-width: 17px;
      height: 17px;
      border-radius: 9px;
      background: #EF4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid var(--bg-app, #fff);
      pointer-events: none;
      transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
    }
    .np-bell-btn .np-badge[data-count="0"] { display: none; }

    /* Dropdown panel */
    .np-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 360px;
      max-height: 480px;
      background: var(--bg-card, #fff);
      border: 1px solid var(--border-soft, #e5e7eb);
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.14);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(-8px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s cubic-bezier(.34,1.56,.64,1);
      z-index: 999;
    }
    .np-panel.np-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .np-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border-soft, #e5e7eb);
      flex-shrink: 0;
    }
    .np-panel-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink-900, #111);
    }
    .np-mark-all-btn {
      font-size: 12px;
      color: var(--violet-600, #6C63FF);
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 600;
      padding: 2px 0;
    }
    .np-mark-all-btn:hover { text-decoration: underline; }
    .np-list {
      overflow-y: auto;
      flex: 1;
    }
    .np-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-soft, #f3f4f6);
      transition: background 0.15s;
      text-decoration: none;
      color: inherit;
    }
    .np-item:last-child { border-bottom: none; }
    .np-item:hover { background: var(--bg-hover, rgba(0,0,0,0.04)); }
    .np-item.np-unread { background: rgba(108,99,255,0.05); }
    .np-item .np-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
      opacity: 0.9;
    }
    .np-item .np-body { flex: 1; min-width: 0; }
    .np-item .np-item-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink-900, #111);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .np-item .np-item-body {
      font-size: 12px;
      color: var(--ink-500, #6b7280);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .np-item .np-item-time {
      font-size: 11px;
      color: var(--ink-400, #9ca3af);
      margin-top: 4px;
    }
    .np-item .np-unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--violet-500, #6C63FF);
      flex-shrink: 0;
      margin-top: 5px;
    }
    .np-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: var(--ink-500, #6b7280);
      font-size: 13px;
      gap: 8px;
    }
    .np-empty i { font-size: 32px; opacity: 0.4; }
    .np-wrap {
      position: relative;
      display: flex;
    }
  `;

  function injectStyles() {
    if (document.getElementById('np-styles')) return;
    const s = document.createElement('style');
    s.id = 'np-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  /* ── Detect role from sidebar ─────────────────────────────────────────── */
  function getRole() {
    const aside = document.querySelector('.sidebar[data-role]');
    return aside ? aside.dataset.role : 'student';
  }

  /* ── Build the dropdown HTML ────────────────────────────────────────────── */
  function buildPanel(notifs) {
    const unread = notifs.filter(n => !n.read).length;

    const items = notifs.map(n => {
      const unreadCls = !n.read ? ' np-unread' : '';
      const dot = !n.read ? `<div class="np-unread-dot"></div>` : '';
      return `
        <a class="np-item${unreadCls}" href="${n.href}" data-np-id="${n.id}">
          <div class="np-icon" style="background:${n.color}22; color:${n.color};">
            <i class="bi ${n.icon}"></i>
          </div>
          <div class="np-body">
            <div class="np-item-title">${n.title}</div>
            <div class="np-item-body">${n.body}</div>
            <div class="np-item-time">${n.time}</div>
          </div>
          ${dot}
        </a>`;
    }).join('');

    const emptyState = `
      <div class="np-empty">
        <i class="bi bi-bell-slash"></i>
        <span>Hech qanday bildirishnoma yo'q</span>
      </div>`;

    return `
      <div class="np-panel" id="np-panel" role="dialog" aria-label="Bildirishnomalar">
        <div class="np-panel-header">
          <span class="np-panel-title">Bildirishnomalar <span id="np-unread-pill" style="
            display:inline-flex; align-items:center; justify-content:center;
            background:var(--violet-100,#ede9fe); color:var(--violet-600,#6C63FF);
            font-size:11px; font-weight:700; border-radius:9px;
            padding:1px 7px; margin-left:4px;
            ${unread === 0 ? 'display:none!important;' : ''}
          ">${unread}</span></span>
          <button class="np-mark-all-btn" id="np-mark-all">Barchasini o'qilgan deb belgilash</button>
        </div>
        <div class="np-list" id="np-list">
          ${notifs.length ? items : emptyState}
        </div>
      </div>`;
  }

  /* ── Mount bell button into topbar ─────────────────────────────────────── */
  function mount() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions) return;

    // Remove old bell link if it exists (plain <a> that navigates to notifications page)
    const oldBell = actions.querySelector('a.icon-btn[aria-label="Bildirishnomalar"]');
    if (oldBell) oldBell.remove();

    const role = getRole();
    const notifs = NOTIF_DATA[role] || NOTIF_DATA.student;
    const unreadCount = notifs.filter(n => !n.read).length;

    // State
    let localNotifs = notifs.map(n => ({ ...n }));

    // Wrapper keeps the panel positioned relative to the button
    const wrap = document.createElement('div');
    wrap.className = 'np-wrap';

    const btn = document.createElement('button');
    btn.className = 'np-bell-btn icon-btn';
    btn.setAttribute('aria-label', 'Bildirishnomalar');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.id = 'np-bell-btn';
    btn.innerHTML = `<i class="bi bi-bell-fill"></i><span class="np-badge" data-count="${unreadCount}">${unreadCount || ''}</span>`;

    wrap.appendChild(btn);

    // Insert before avatar (first non-search child)
    const avatar = actions.querySelector('.avatar');
    if (avatar) {
      actions.insertBefore(wrap, avatar);
    } else {
      actions.appendChild(wrap);
    }

    // Render panel
    function renderPanel() {
      const existing = document.getElementById('np-panel-wrap');
      if (existing) existing.remove();

      const panelWrap = document.createElement('div');
      panelWrap.id = 'np-panel-wrap';
      panelWrap.innerHTML = buildPanel(localNotifs);
      wrap.appendChild(panelWrap);

      // Mark all as read
      const markAll = document.getElementById('np-mark-all');
      if (markAll) {
        markAll.addEventListener('click', (e) => {
          e.stopPropagation();
          localNotifs.forEach(n => { n.read = true; });
          updateBadge(0);
          renderPanel();
          document.getElementById('np-panel').classList.add('np-open');
          btn.setAttribute('aria-expanded', 'true');
        });
      }

      // Item click → mark read then navigate
      document.querySelectorAll('.np-item[data-np-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          const id = parseInt(el.dataset.npId);
          const notif = localNotifs.find(n => n.id === id);
          if (notif && !notif.read) {
            notif.read = true;
            const newUnread = localNotifs.filter(n => !n.read).length;
            updateBadge(newUnread);
          }
          closePanel();
          // navigation happens via href naturally
        });
      });
    }

    function updateBadge(count) {
      const badge = btn.querySelector('.np-badge');
      if (!badge) return;
      badge.dataset.count = count;
      badge.textContent = count > 0 ? count : '';
    }

    function openPanel() {
      renderPanel();
      requestAnimationFrame(() => {
        const panel = document.getElementById('np-panel');
        if (panel) {
          panel.classList.add('np-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    }

    function closePanel() {
      const panel = document.getElementById('np-panel');
      if (panel) {
        panel.classList.remove('np-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    }

    function togglePanel() {
      const panel = document.getElementById('np-panel');
      if (!panel) { openPanel(); return; }
      panel.classList.contains('np-open') ? closePanel() : openPanel();
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closePanel();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
