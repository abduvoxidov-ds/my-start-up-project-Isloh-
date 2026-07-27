/* ==========================================================================
   ISLOH — Notifications module  (upgraded in Sprint 3B)
   Notification Center behavior: mark one read, mark-all read, delete, and
   live unread recount. Category + read/unread filtering and search are
   handled by the shared js/filterable.js engine (this file only adds the
   actions filterable doesn't cover). Also still exposes the topbar
   unread-badge helper from Sprint 2.

   Markup contract (in addition to filterable's):
     [data-notif-item][data-read="true|false"]
       [data-notif-read]    → per-item "mark read" control
       [data-notif-delete]  → per-item delete control
     [data-notif-mark-all]  → global mark-all-read button
     #notif-unread-count / [data-notif-count="unread"]  → live counters
   ========================================================================== */

function isloh_setUnreadBadge(hasUnread) {
  const dot = document.querySelector('.topbar-actions .icon-btn .dot');
  if (!dot) return;
  dot.style.display = hasUnread ? '' : 'none';
}

function isloh_recountNotifs() {
  const items = [...document.querySelectorAll('[data-notif-item]')].filter((n) => n.dataset.archived !== 'true');
  let unread = 0;
  items.forEach((n) => { if (n.dataset.read === 'false') unread++; });

  document.querySelectorAll('[data-notif-count="unread"]').forEach((el) => { el.textContent = unread; });
  document.querySelectorAll('[data-notif-count="all"]').forEach((el) => { el.textContent = items.length; });

  isloh_setUnreadBadge(unread > 0);

  // re-run the shared filter so counts/empty-state stay in sync
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

function isloh_markRead(item) {
  item.dataset.read = 'true';
  item.classList.remove('unread');
  isloh_recountNotifs();
}

function isloh_initNotifications() {
  const items = document.querySelectorAll('[data-notif-item]');
  if (!items.length) { isloh_recountNotifs(); return; }

  items.forEach((item) => {
    const readBtn = item.querySelector('[data-notif-read]');
    if (readBtn) readBtn.addEventListener('click', (e) => { e.stopPropagation(); isloh_markRead(item); });

    const delBtn = item.querySelector('[data-notif-delete]');
    if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); item.remove(); isloh_recountNotifs(); });

    // clicking the row marks it read
    item.addEventListener('click', () => { if (item.dataset.read === 'false') isloh_markRead(item); });
  });

  const markAll = document.querySelector('[data-notif-mark-all]');
  if (markAll) markAll.addEventListener('click', () => {
    document.querySelectorAll('[data-notif-item]').forEach((n) => { n.dataset.read = 'true'; n.classList.remove('unread'); });
    isloh_recountNotifs();
  });

  isloh_recountNotifs();
}

document.addEventListener('DOMContentLoaded', isloh_initNotifications);

/* ==========================================================================
   Archive (Sprint 8B). Kept independent of js/filterable.js's own group
   logic (that module is shared by Certificates/Bookmarks/etc. and isn't
   sprint-specific) — this runs its own visibility pass right after
   filterable's, on the same controls, so an archived item never reappears
   under a category filter, and the "Arxiv" view only shows archived items.

   Markup contract:
     [data-notif-archive]        → per-item archive control (sets
       item.dataset.archived = "true" and hides it from the default view)
     [data-notif-show-archived]  → toggle button that switches the whole
       list to show only archived items
   ========================================================================== */

function isloh_applyArchiveView() {
  const scope = document.querySelector('[data-filterable]');
  if (!scope) return;
  const showArchived = document.querySelector('[data-notif-show-archived]')?.classList.contains('active');
  scope.querySelectorAll('[data-notif-item]').forEach((item) => {
    const isArchived = item.dataset.archived === 'true';
    if (showArchived ? !isArchived : isArchived) item.style.display = 'none';
  });
}

function isloh_initNotifArchive() {
  document.querySelectorAll('[data-notif-archive]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('[data-notif-item]');
      if (!item) return;
      item.dataset.archived = 'true';
      item.classList.remove('unread');
      isloh_recountNotifs();
      isloh_applyArchiveView();
      if (typeof isloh_showToast === 'function') isloh_showToast('Arxivga ko\'chirildi', 'info');
    });
  });

  const showArchivedBtn = document.querySelector('[data-notif-show-archived]');
  if (showArchivedBtn) {
    showArchivedBtn.addEventListener('click', () => {
      showArchivedBtn.classList.toggle('active');
      isloh_applyArchiveView();
    });
  }

  // Re-apply after every existing filter control's own click/input handler
  // (registered by filterable.js earlier in the page's script order).
  document.querySelectorAll('[data-filter-group] button[data-filter-value]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_applyArchiveView());
  });
  document.querySelector('[data-filter-search]')?.addEventListener('input', () => isloh_applyArchiveView());

  isloh_applyArchiveView();
}

document.addEventListener('DOMContentLoaded', isloh_initNotifArchive);
