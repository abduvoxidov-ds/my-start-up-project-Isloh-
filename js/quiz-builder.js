/* ==========================================================================
   ISLOH — Quiz Builder module  (Sprint 6A)
   Powers pages/instructor/quiz-builder.html. Reuses js/filterable.js
   (search/filter/status chips), js/dropdown.js (row actions), js/modal.js
   (create/delete/preview dialogs), js/courses.js (loading skeleton, bulk
   selection, grid/table view switch — all data-attribute driven and not
   course-specific, so no duplicate engine is written here). This file only
   adds the quiz-specific behaviors: add / duplicate / delete / preview.
   ========================================================================== */

let isloh_pendingQuizDelete = null;

function isloh_initQuizCardActions() {
  const grid = document.querySelector('[data-quiz-grid]');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-quiz"]');
    if (dupBtn) {
      const card = dupBtn.closest('.quiz-card');
      const clone = card.cloneNode(true);
      const titleEl = clone.querySelector('.cci-title');
      titleEl.textContent += " (nusxa)";
      clone.dataset.filterText = titleEl.textContent;
      const statusBadge = clone.querySelector('.cci-status');
      statusBadge.className = 'badge badge-warning cci-status';
      statusBadge.textContent = "Qoralama";
      clone.dataset.status = 'draft';
      card.after(clone);
      if (typeof isloh_showToast === 'function') isloh_showToast("Test nusxalandi", 'success');
      return;
    }

    const previewBtn = e.target.closest('[data-action="preview-quiz"]');
    if (previewBtn) {
      const card = previewBtn.closest('.quiz-card');
      const modal = document.getElementById('preview-quiz-modal');
      if (modal) {
        modal.querySelector('[data-preview-quiz-title]').textContent = card.querySelector('.cci-title').textContent;
        modal.querySelector('[data-preview-quiz-meta]').textContent = card.querySelector('.cci-stats')?.textContent.trim().replace(/\s+/g, '  ') || '';
      }
      isloh_openModal('preview-quiz-modal');
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-quiz"]');
    if (delBtn) {
      isloh_pendingQuizDelete = delBtn.closest('.quiz-card');
      isloh_openModal('delete-quiz-modal');
    }
  });

  document.querySelector('[data-confirm-delete-quiz]')?.addEventListener('click', () => {
    isloh_pendingQuizDelete?.remove();
    isloh_pendingQuizDelete = null;
    isloh_closeModal('delete-quiz-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast("Test o'chirildi", 'success');
  });
}

function isloh_initAddQuiz() {
  const grid = document.querySelector('[data-quiz-grid]');
  const template = document.getElementById('quiz-card-template');
  const form = document.querySelector('[data-add-quiz-form]');
  if (!grid || !template || !form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim() || 'Yangi test';
    const difficulty = form.querySelector('[name="difficulty"]').value;
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector('.cci-title').textContent = title;
    clone.dataset.filterText = title;

    const diffMeta = {
      easy:   { label: "Oson",  dot: 'easy',   badge: 'badge-green' },
      medium: { label: "O'rta", dot: 'medium', badge: 'badge-warning' },
      hard:   { label: "Qiyin", dot: 'hard',   badge: 'badge-danger' }
    }[difficulty] || { label: "O'rta", dot: 'medium', badge: 'badge-warning' };
    const diffBadge = clone.querySelector('.difficulty-badge');
    diffBadge.className = `badge ${diffMeta.badge} difficulty-badge`;
    diffBadge.innerHTML = `<span class="difficulty-dot ${diffMeta.dot}"></span> ${diffMeta.label}`;

    grid.appendChild(clone);
    form.reset();
    isloh_closeModal('add-quiz-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast("Yangi test qo'shildi — savollarni qo'shish uchun tahrirlang", 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initQuizCardActions();
  isloh_initAddQuiz();
});
