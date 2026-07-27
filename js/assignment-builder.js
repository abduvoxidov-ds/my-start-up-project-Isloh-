/* ==========================================================================
   ISLOH — Assignment Builder module  (Sprint 6B)
   Powers pages/instructor/assignment-builder.html. Mirrors js/quiz-builder.js
   (Sprint 6A) exactly in shape — same reuse of js/filterable.js, js/courses.js
   (skeleton/bulk/view-switch), js/dropdown.js, js/modal.js — only the
   assignment-specific card fields differ.
   ========================================================================== */

let isloh_pendingAssignmentDelete = null;

function isloh_initAssignmentCardActions() {
  const grid = document.querySelector('[data-assignment-grid]');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-assignment"]');
    if (dupBtn) {
      const card = dupBtn.closest('.assignment-card');
      const clone = card.cloneNode(true);
      const titleEl = clone.querySelector('.cci-title');
      titleEl.textContent += " (nusxa)";
      clone.dataset.filterText = titleEl.textContent;
      const statusBadge = clone.querySelector('.cci-status');
      statusBadge.className = 'badge badge-warning cci-status';
      statusBadge.textContent = "Qoralama";
      clone.dataset.status = 'draft';
      card.after(clone);
      if (typeof isloh_showToast === 'function') isloh_showToast("Topshiriq nusxalandi", 'success');
      return;
    }

    const previewBtn = e.target.closest('[data-action="preview-assignment"]');
    if (previewBtn) {
      const card = previewBtn.closest('.assignment-card');
      const modal = document.getElementById('preview-assignment-modal');
      if (modal) {
        modal.querySelector('[data-preview-assignment-title]').textContent = card.querySelector('.cci-title').textContent;
        modal.querySelector('[data-preview-assignment-meta]').textContent = card.querySelector('.cci-tags')?.textContent.trim().replace(/\s+/g, '  ') || '';
      }
      isloh_openModal('preview-assignment-modal');
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-assignment"]');
    if (delBtn) {
      isloh_pendingAssignmentDelete = delBtn.closest('.assignment-card');
      isloh_openModal('delete-assignment-modal');
    }
  });

  document.querySelector('[data-confirm-delete-assignment]')?.addEventListener('click', () => {
    isloh_pendingAssignmentDelete?.remove();
    isloh_pendingAssignmentDelete = null;
    isloh_closeModal('delete-assignment-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast("Topshiriq o'chirildi", 'success');
  });
}

function isloh_initAddAssignment() {
  const grid = document.querySelector('[data-assignment-grid]');
  const template = document.getElementById('assignment-card-template');
  const form = document.querySelector('[data-add-assignment-form]');
  if (!grid || !template || !form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim() || 'Yangi topshiriq';
    const dueDate = form.querySelector('[name="due"]').value || 'Belgilanmagan';
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector('.cci-title').textContent = title;
    clone.dataset.filterText = title;
    clone.querySelector('[data-assignment-due]').innerHTML = `<i class="bi bi-calendar-event"></i> ${dueDate}`;

    grid.appendChild(clone);
    form.reset();
    isloh_closeModal('add-assignment-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast("Yangi topshiriq qo'shildi — tafsilotlarni tahrirlang", 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initAssignmentCardActions();
  isloh_initAddAssignment();
});
