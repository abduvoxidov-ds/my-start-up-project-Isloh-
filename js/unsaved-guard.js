/* ==========================================================================
   ISLOH — Unsaved-changes guard  (Sprint 5B)
   Generic dirty-state tracker so Module Builder, Lesson Builder and the
   Lesson Editor share one "you have unsaved changes" mechanism instead of
   each page re-implementing it.

   Markup contract:
     [data-unsaved-scope]        → wraps the editable area to watch
     [data-unsaved-indicator]    → badge shown once something changed
     [data-marks-dirty]          → non-input controls that should also
                                    count as an edit (e.g. Add/Delete/
                                    Duplicate/Reorder buttons)
     [data-save-action]          → saves the draft + clears the dirty state

   "Saqlash" endi haqiqatan saqlaydi: maydon qiymatlari js/draft-store.js
   orqali `isloh_drafts` do'koniga yoziladi va sahifa qayta ochilganda
   tiklanadi. Ilgari bu tugma faqat bayroqni tozalab, "O'zgarishlar
   saqlandi" deb yolg'on toast chiqarardi.
   ========================================================================== */

function isloh_initUnsavedGuard() {
  const scope = document.querySelector('[data-unsaved-scope]');
  if (!scope) return;
  const indicator = document.querySelector('[data-unsaved-indicator]');
  let dirty = false;

  function markDirty() {
    dirty = true;
    if (indicator) indicator.hidden = false;
  }
  function markClean() {
    dirty = false;
    if (indicator) indicator.hidden = true;
  }

  scope.addEventListener('input', markDirty);
  scope.addEventListener('change', markDirty);
  scope.addEventListener('click', (e) => {
    if (e.target.closest('[data-marks-dirty]')) markDirty();
  });
  // Oldingi seansdagi qoralama bo'lsa tiklanadi (bu "o'zgarish" hisoblanmaydi)
  if (typeof isloh_restoreDraft === 'function' && isloh_restoreDraft(scope)) {
    markClean();
  }

  document.querySelectorAll('[data-save-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_saveDraft !== 'function') return;

      const saved = isloh_saveDraft(scope);
      if (saved < 0) {
        if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }
      markClean();
      if (typeof isloh_showToast === 'function') isloh_showToast("O'zgarishlar saqlandi", 'success');
    });
  });

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

document.addEventListener('DOMContentLoaded', isloh_initUnsavedGuard);
