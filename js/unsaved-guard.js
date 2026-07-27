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
     [data-save-action]          → clears the dirty state (Save/Saqlash)
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
  document.querySelectorAll('[data-save-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
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
