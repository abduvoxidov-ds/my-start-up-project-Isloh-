/* ==========================================================================
   ISLOH — Admin Course Management module  (Sprint 9)
   Powers pages/admin/admin-courses.html. Bulk select + grid/table toggle
   reuse js/courses.js's generic engine as-is. Featured toggle is a plain
   .switch checkbox (no JS required — see css/components.css). This file
   only wires: Approval Queue accept/reject, and the Archive confirmation.

   Markup contract:
     [data-approval-item]
       [data-approve] / [data-reject]     → removes the card from the queue
     [data-course-row]
       [data-archive-course]              → opens #archive-modal
     #archive-modal [data-archive-confirm] → marks the row .is-archived
   ========================================================================== */

let isloh_pendingArchiveRow = null;

function isloh_recountApprovalQueue() {
  const countEl = document.querySelector('[data-approval-count]');
  const remaining = document.querySelectorAll('[data-approval-item]').length;
  if (countEl) countEl.textContent = remaining;
  const empty = document.querySelector('[data-approval-empty]');
  if (empty) empty.style.display = remaining === 0 ? '' : 'none';
}

function isloh_initAdminCourses() {
  document.body.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    const rejectBtn = e.target.closest('[data-reject]');
    const archiveBtn = e.target.closest('[data-archive-course]');
    const archiveConfirm = e.target.closest('[data-archive-confirm]');

    if (approveBtn) {
      approveBtn.closest('[data-approval-item]')?.remove();
      isloh_recountApprovalQueue();
      if (typeof isloh_showToast === 'function') isloh_showToast('Kurs tasdiqlandi', 'success');
    }

    if (rejectBtn) {
      rejectBtn.closest('[data-approval-item]')?.remove();
      isloh_recountApprovalQueue();
      if (typeof isloh_showToast === 'function') isloh_showToast('Kurs rad etildi', 'error');
    }

    if (archiveBtn) {
      isloh_pendingArchiveRow = archiveBtn.closest('[data-course-row]');
      if (typeof isloh_openModal === 'function') isloh_openModal('archive-modal');
    }

    if (archiveConfirm && isloh_pendingArchiveRow) {
      isloh_pendingArchiveRow.classList.add('is-archived');
      if (typeof isloh_closeModal === 'function') isloh_closeModal('archive-modal');
      if (typeof isloh_showToast === 'function') isloh_showToast('Kurs arxivlandi', 'success');
      isloh_pendingArchiveRow = null;
    }
  });

  isloh_recountApprovalQueue();
}

document.addEventListener('DOMContentLoaded', isloh_initAdminCourses);
