/* ==========================================================================
   ISLOH — Assignment Editor module  (Sprint 6B)
   Powers pages/instructor/assignment-editor.html's Submission and Content
   tabs. Everything else on that page (tab switching, char counters,
   download/link repeating rows, resource cards, reveal toggles, unsaved
   guard, save toast) is powered entirely by existing Sprint 5B/6A modules
   — js/tabs.js, js/course-wizard.js, js/lesson-editor.js,
   js/settings-toggles.js, js/unsaved-guard.js. Only the two interactions
   below have no existing equivalent.
   ========================================================================== */

/* Allowed file type chips: type an extension, press "Qo'shish" (or Enter)
   to add a removable .file-chip. Removal reuses js/lesson-editor.js's
   generic [data-row-list]/[data-remove-row] engine — the chip container
   just needs to be a [data-row-list], so no new "remove" code is written
   here. */
function isloh_initFileTypeChips() {
  const input = document.getElementById('as-filetype-input');
  const addBtn = document.querySelector('[data-add-filetype]');
  const list = document.querySelector('[data-row-list="filetype-chip-list"]');
  if (!input || !addBtn || !list) return;

  function addChip() {
    const value = input.value.trim().replace(/^\./, '').toUpperCase();
    if (!value) return;
    const chip = document.createElement('span');
    chip.className = 'file-chip';
    chip.innerHTML = `.${value} <button type="button" data-remove-row aria-label="${value} ni olib tashlash"><i class="bi bi-x"></i></button>`;
    list.appendChild(chip);
    input.value = '';
    input.focus();
  }

  addBtn.addEventListener('click', addChip);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addChip(); }
  });
}

/* Rubric total: sums the point inputs across the rubric's repeating
   [data-row-list="rubric-row-template"] rows (same shape as Sprint 6A's
   .question-option-row) and reflects the total live. */
function isloh_initRubricTotal() {
  const list = document.querySelector('[data-row-list="rubric-row-template"]');
  const totalEl = document.querySelector('[data-rubric-total]');
  if (!list || !totalEl) return;

  function recompute() {
    const total = [...list.querySelectorAll('input[type="number"]')]
      .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    totalEl.textContent = total;
  }
  list.addEventListener('input', recompute);
  list.addEventListener('click', (e) => { if (e.target.closest('[data-remove-row]')) setTimeout(recompute, 0); });
  document.querySelector('[data-add-row="rubric-row-template"]')?.addEventListener('click', () => setTimeout(recompute, 0));
  recompute();
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initFileTypeChips();
  isloh_initRubricTotal();
});
