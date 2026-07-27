/* ==========================================================================
   ISLOH — Admin User Management module  (Sprint 9)
   Powers pages/admin/admin-users.html. Search/status/role filtering reuses
   js/filterable.js; bulk select/table-grid toggle reuses the generic engine
   already shipped in js/courses.js (isloh_initBulkSelect etc. are declarative,
   not course-specific). This file only wires the two destructive actions
   that need a confirmation step: Suspend and Activate.

   Markup contract:
     [data-user-row]                         → one row (table or card)
       [data-user-suspend] / [data-user-activate]
     #user-action-modal
       [data-user-action-modal-title]        → filled with action text
       [data-user-action-confirm]            → applies the status change
   ========================================================================== */

let isloh_pendingUserRow = null;
let isloh_pendingUserAction = null;

function isloh_setUserStatus(row, status) {
  const badge = row.querySelector('[data-user-status-badge]');
  if (!badge) return;
  badge.classList.remove('badge-green', 'badge-danger', 'badge-neutral');
  if (status === 'active') {
    badge.textContent = 'Faol';
    badge.classList.add('badge-green');
  } else {
    badge.textContent = 'Bloklangan';
    badge.classList.add('badge-danger');
  }
  row.dataset.status = status;
  const suspendBtn = row.querySelector('[data-user-suspend]');
  const activateBtn = row.querySelector('[data-user-activate]');
  if (suspendBtn) suspendBtn.hidden = status !== 'active';
  if (activateBtn) activateBtn.hidden = status === 'active';
}

function isloh_initAdminUsers() {
  document.body.addEventListener('click', (e) => {
    const suspendBtn = e.target.closest('[data-user-suspend]');
    const activateBtn = e.target.closest('[data-user-activate]');
    const confirmBtn = e.target.closest('[data-user-action-confirm]');

    if (suspendBtn || activateBtn) {
      isloh_pendingUserRow = (suspendBtn || activateBtn).closest('[data-user-row]');
      isloh_pendingUserAction = suspendBtn ? 'suspend' : 'active';
      const title = document.querySelector('[data-user-action-modal-title]');
      const name = isloh_pendingUserRow?.dataset.userName || 'Foydalanuvchi';
      if (title) {
        title.textContent = suspendBtn
          ? `${name} hisobini bloklamoqchimisiz?`
          : `${name} hisobini faollashtirmoqchimisiz?`;
      }
      if (typeof isloh_openModal === 'function') isloh_openModal('user-action-modal');
    }

    if (confirmBtn && isloh_pendingUserRow) {
      isloh_setUserStatus(isloh_pendingUserRow, isloh_pendingUserAction);
      if (typeof isloh_closeModal === 'function') isloh_closeModal('user-action-modal');
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(
          isloh_pendingUserAction === 'suspend' ? "Foydalanuvchi bloklandi" : "Foydalanuvchi faollashtirildi",
          'success'
        );
      }
      isloh_pendingUserRow = null;
      isloh_pendingUserAction = null;
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initAdminUsers);
