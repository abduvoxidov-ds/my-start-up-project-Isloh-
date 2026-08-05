/* ==========================================================================
   ISLOH — Quiz Editor module  (Sprint 6A)
   Powers pages/instructor/quiz-editor.html's Savollar / Sozlamalar /
   Ko'rib chiqish tabs. Mirrors js/lesson-builder.js's shape (question
   rows reuse .lesson-item + js/sortable.js + js/dropdown.js + js/modal.js
   instead of a parallel implementation) and js/course-wizard.js's
   char-counter contract for the Question Editor modal fields.
   ========================================================================== */

let isloh_pendingQuestionDelete = null;

/* ISLOH_QUESTION_TYPE_META shu yerda e'lon qilingan, lekin hech qayerda
   ishlatilmasdi. Endi u js/question-store.js da — savollar bazasi
   sahifasi ham shu jadvalga muhtoj, bu fayl esa u yerda yuklanmaydi. */

function isloh_initQuestionRowActions() {
  const list = document.querySelector('[data-questions-list]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-question"]');
    if (dupBtn) {
      const item = dupBtn.closest('.question-card');
      const clone = item.cloneNode(true);
      clone.querySelector('.lesson-title').textContent += " (nusxa)";
      item.after(clone);
      isloh_renumberQuestions();
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-question"]');
    if (delBtn) {
      isloh_pendingQuestionDelete = delBtn.closest('.question-card');
      isloh_openModal('delete-question-modal');
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-question"]');
    if (editBtn) {
      const item = editBtn.closest('.question-card');
      isloh_openQuestionEditor(item);
    }
  });

  document.querySelector('[data-confirm-delete-question]')?.addEventListener('click', () => {
    isloh_pendingQuestionDelete?.remove();
    isloh_pendingQuestionDelete = null;
    isloh_closeModal('delete-question-modal');
    isloh_renumberQuestions();
  });
}

function isloh_renumberQuestions() {
  document.querySelectorAll('[data-questions-list] .question-card').forEach((item, i) => {
    const numEl = item.querySelector('[data-question-number]');
    if (numEl) numEl.textContent = i + 1;
  });
  const countEl = document.querySelector('[data-question-count]');
  if (countEl) countEl.textContent = document.querySelectorAll('[data-questions-list] .question-card').length;
}

function isloh_openQuestionEditor(existingItem) {
  const modal = document.getElementById('question-editor-modal');
  if (!modal) return;
  const titleInput = modal.querySelector('#qe-title');
  const typeSelect = modal.querySelector('#qe-type');
  modal.dataset.editingRow = '';

  if (existingItem) {
    titleInput.value = existingItem.querySelector('.lesson-title')?.textContent.trim() || '';
    typeSelect.value = existingItem.dataset.type || 'single';
    modal.querySelector('.modal-head b').textContent = "Savolni tahrirlash";
  } else {
    titleInput.value = '';
    typeSelect.value = 'single';
    modal.querySelector('.modal-head b').textContent = "Yangi savol qo'shish";
  }
  titleInput.dispatchEvent(new Event('input'));
  typeSelect.dispatchEvent(new Event('change'));
  isloh_openModal('question-editor-modal');
}

function isloh_initAddQuestionButton() {
  document.querySelector('[data-add-question-btn]')?.addEventListener('click', () => isloh_openQuestionEditor(null));
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initQuestionRowActions();
  isloh_initAddQuestionButton();
});
