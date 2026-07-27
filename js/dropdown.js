/* ==========================================================================
   ISLOH — Dropdown module
   Generic open/close behavior for any `.dropdown` (see the "Dropdown"
   entry in pages/shared/components.html for markup).

   Sprint 5B: rewritten to delegate from `document` instead of binding a
   listener to each trigger at DOMContentLoaded. Same public function name
   and markup contract, so no existing page needs to change — but this now
   also makes dropdowns work on elements added dynamically after load
   (e.g. a module/lesson/resource card cloned by js/course-builder.js,
   js/lesson-builder.js, js/lesson-editor.js), which per-element binding
   could not support without an explicit re-init call.
   ========================================================================== */

function isloh_initDropdowns() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.dropdown > button, .dropdown > .dropdown-trigger');
    if (trigger) {
      e.stopPropagation();
      const dropdown = trigger.closest('.dropdown');
      const isOpen = dropdown.classList.contains('open');
      document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
      if (!isOpen) dropdown.classList.add('open');
      return;
    }
    document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initDropdowns);
