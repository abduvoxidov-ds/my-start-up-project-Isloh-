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

const ISLOH_DROPDOWN_TRIGGER_SEL = '.dropdown > button, .dropdown > .dropdown-trigger';
const ISLOH_DROPDOWN_OWN_TRIGGER_SEL = ':scope > button, :scope > .dropdown-trigger';

/* Ochish/yopishning yagona nuqtasi. `aria-expanded` faqat trigger'da shu
   atribut oldindan e'lon qilingan bo'lsa yangilanadi — shunda oddiy
   dekorativ dropdown'larga ortiqcha ARIA yopishtirilmaydi. */
function isloh_setDropdownOpen(dropdown, open) {
  dropdown.classList.toggle('open', open);

  const trigger = dropdown.querySelector(ISLOH_DROPDOWN_OWN_TRIGGER_SEL);
  if (trigger && trigger.hasAttribute('aria-expanded')) {
    trigger.setAttribute('aria-expanded', String(open));
  }
}

function isloh_closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach((d) => isloh_setDropdownOpen(d, false));
}

function isloh_initDropdowns() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest(ISLOH_DROPDOWN_TRIGGER_SEL);
    if (trigger) {
      e.stopPropagation();
      const dropdown = trigger.closest('.dropdown');
      const isOpen = dropdown.classList.contains('open');
      isloh_closeAllDropdowns();
      if (!isOpen) isloh_setDropdownOpen(dropdown, true);
      return;
    }
    isloh_closeAllDropdowns();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    /* Escape'dan keyin fokus yo'qolib qolmasligi uchun uni trigger'ga
       qaytaramiz — klaviatura bilan ishlayotgan foydalanuvchi joyini
       yo'qotmaydi. */
    const focused = document.activeElement;
    const openHost = focused ? focused.closest('.dropdown.open') : null;

    isloh_closeAllDropdowns();

    if (openHost) {
      const trigger = openHost.querySelector(ISLOH_DROPDOWN_OWN_TRIGGER_SEL);
      if (trigger) trigger.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initDropdowns);
