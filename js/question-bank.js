/* ==========================================================================
   ISLOH — Question Bank module  (Sprint 6A)
   Powers pages/instructor/question-bank.html. Reuses js/filterable.js
   (category/type/difficulty/status chips + search), js/courses.js
   (loading skeleton + bulk selection — data-attribute driven, not course-
   specific), js/dropdown.js, js/modal.js. Only the bank-specific row
   actions (duplicate/archive/restore/delete) live here; adding/editing a
   question opens the shared #question-editor-modal (js/question-editor.js).
   ========================================================================== */

let isloh_pendingBankDelete = null;

function isloh_initBankRowActions() {
  const table = document.querySelector('[data-bank-table]');
  if (!table) return;

  table.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="edit-bank-question"]');
    if (editBtn) {
      const row = editBtn.closest('tr');
      const modal = document.getElementById('question-editor-modal');
      if (modal) {
        modal.querySelector('#qe-title').value = row.querySelector('.cell-title')?.textContent.trim() || '';
        modal.querySelector('#qe-title').dispatchEvent(new Event('input'));
        modal.querySelector('.modal-head b').textContent = "Savolni tahrirlash";
      }
      isloh_openModal('question-editor-modal');
      return;
    }

    const dupBtn = e.target.closest('[data-action="duplicate-bank-question"]');
    if (dupBtn) {
      const row = dupBtn.closest('tr');
      const clone = row.cloneNode(true);
      const titleEl = clone.querySelector('.cell-title');
      titleEl.textContent += " (nusxa)";
      clone.dataset.filterText = titleEl.textContent;
      row.after(clone);
      if (typeof isloh_showToast === 'function') isloh_showToast("Savol nusxalandi", 'success');
      return;
    }

    const archiveBtn = e.target.closest('[data-action="archive-bank-question"]');
    if (archiveBtn) {
      const row = archiveBtn.closest('tr');
      row.classList.add('is-archived');
      row.dataset.status = 'archived';
      isloh_applyFilterable(document.querySelector('[data-filterable]'));
      if (typeof isloh_showToast === 'function') isloh_showToast("Savol arxivlandi", 'success');
      return;
    }

    const restoreBtn = e.target.closest('[data-action="restore-bank-question"]');
    if (restoreBtn) {
      const row = restoreBtn.closest('tr');
      row.classList.remove('is-archived');
      row.dataset.status = 'active';
      isloh_applyFilterable(document.querySelector('[data-filterable]'));
      if (typeof isloh_showToast === 'function') isloh_showToast("Savol tiklandi", 'success');
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-bank-question"]');
    if (delBtn) {
      isloh_pendingBankDelete = delBtn.closest('tr');
      isloh_openModal('delete-bank-question-modal');
    }
  });

  document.querySelector('[data-confirm-delete-bank-question]')?.addEventListener('click', () => {
    isloh_pendingBankDelete?.remove();
    isloh_pendingBankDelete = null;
    isloh_closeModal('delete-bank-question-modal');
  });
}

function isloh_initAddBankQuestionButton() {
  document.querySelector('[data-add-bank-question-btn]')?.addEventListener('click', () => {
    const modal = document.getElementById('question-editor-modal');
    if (modal) {
      modal.querySelector('#qe-title').value = '';
      modal.querySelector('#qe-title').dispatchEvent(new Event('input'));
      modal.querySelector('.modal-head b').textContent = "Yangi savol qo'shish";
    }
    isloh_openModal('question-editor-modal');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initBankRowActions();
  isloh_initAddBankQuestionButton();
});
