/* ==========================================================================
   ISLOH — Quiz Editor module  (Sprint 6A)
   Powers pages/instructor/quiz-editor.html's Savollar / Sozlamalar /
   Ko'rib chiqish tabs. Mirrors js/lesson-builder.js's shape (question
   rows reuse .lesson-item + js/sortable.js + js/dropdown.js + js/modal.js
   instead of a parallel implementation) and js/course-wizard.js's
   char-counter contract for the Question Editor modal fields.
   ========================================================================== */

let isloh_pendingQuestionDelete = null;

const ISLOH_QUESTION_TYPE_META = {
  single:  { icon: 'bi-ui-radios',            bg: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)', label: "Bitta tanlov" },
  multi:   { icon: 'bi-ui-checks',            bg: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: "Ko'p tanlov" },
  boolean: { icon: 'bi-toggle2-on',           bg: 'linear-gradient(135deg,#1FAE5E,#0F7A3F)', label: "To'g'ri / Noto'g'ri" },
  short:   { icon: 'bi-input-cursor-text',    bg: 'linear-gradient(135deg,#F59E0B,#D97706)', label: "Qisqa javob" },
  long:    { icon: 'bi-textarea-t',           bg: 'linear-gradient(135deg,#EA580C,#C2410C)', label: "Batafsil javob" },
  match:   { icon: 'bi-arrow-left-right',     bg: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', label: "Moslashtirish" },
  order:   { icon: 'bi-sort-numeric-down',    bg: 'linear-gradient(135deg,#0F766E,#14B8A6)', label: "Tartiblash" },
  blank:   { icon: 'bi-textarea-resize',      bg: 'linear-gradient(135deg,#374151,#1C1B29)', label: "Bo'sh joyni to'ldirish" }
};

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
