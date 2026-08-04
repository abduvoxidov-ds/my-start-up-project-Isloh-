/* ==========================================================================
   ISLOH — Modal module
   `.modal` / `.modal-overlay` naqshi uchun umumiy ochish/yopish mantiqi
   (stillar css/components.css da). Sahifalar bu yerdagi ikki funksiyani
   chaqiradi — overlay mantiqini har joyda qayta yozmaslik uchun.

   A11y (WAI-ARIA Dialog naqshi). Ilgari `isloh_openModal` faqat `hidden`ni
   olib tashlardi, natijada:
     - fokus modal ortidagi sahifada qolardi, Tab foydalanuvchini ko'rinmas
       elementlar bo'ylab olib ketardi;
     - modal yopilganda fokus uni ochgan tugmaga qaytmasdi;
     - orqa sahifa skroll qilinaverardi.
   Endi shu uchalasi ham shu modulda, ya'ni `.modal-overlay` ishlatadigan
   HAR BIR modal (AI drawer, tasdiqlash oynalari, admin modallari) buni
   avtomatik oladi.

   Diqqat: modal panelining o'ziga `role="dialog"`, `aria-modal="true"` va
   `aria-labelledby` markupda qo'yiladi — bu modul faqat xatti-harakatni
   boshqaradi.
   ========================================================================== */

const ISLOH_FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/* Ko'rinmas (hidden ota-ona ichidagi) elementlar fokus tuzog'iga kirmasin */
function isloh_focusableIn(root) {
  return [...root.querySelectorAll(ISLOH_FOCUSABLE_SELECTOR)]
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function isloh_openOverlays() {
  return [...document.querySelectorAll('.modal-overlay:not([hidden])')];
}

/* Bir nechta modal ochiq bo'lsa — eng oxirgi ochilgani ustunlik qiladi */
function isloh_topOpenOverlay() {
  const open = isloh_openOverlays();
  return open.length ? open[open.length - 1] : null;
}

function isloh_openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay || !overlay.hidden) return;

  // Qaytish nuqtasi: modal yopilganda fokus shu elementga qaytadi
  overlay.islohReturnFocus = document.activeElement;

  overlay.hidden = false;
  overlay.classList.add('anim-fade-in');
  document.body.classList.add('modal-open');

  const items = isloh_focusableIn(overlay);
  if (items.length) {
    items[0].focus();
    return;
  }
  // Fokuslanadigan element bo'lmasa — konteynerning o'ziga
  overlay.tabIndex = -1;
  overlay.focus();
}

function isloh_closeOverlay(overlay) {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;

  // Skroll qulfi faqat oxirgi modal yopilganda olinadi
  if (!isloh_openOverlays().length) document.body.classList.remove('modal-open');

  const back = overlay.islohReturnFocus;
  overlay.islohReturnFocus = null;
  if (back && document.contains(back) && typeof back.focus === 'function') back.focus();
}

function isloh_closeModal(modalId) {
  isloh_closeOverlay(document.getElementById(modalId));
}

document.addEventListener('DOMContentLoaded', () => {
  /* Fon (backdrop) bosilganda yopish. Tinglovchi document darajasida —
     shunda JS bilan keyin qo'shilgan modallar ham ishlaydi. */
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
      isloh_closeOverlay(e.target);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      isloh_closeOverlay(isloh_topOpenOverlay());
      return;
    }

    // Fokus tuzog'i: Tab modal ichidan chiqib ketmasin
    if (e.key !== 'Tab') return;
    const overlay = isloh_topOpenOverlay();
    if (!overlay) return;

    const items = isloh_focusableIn(overlay);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const outside = !overlay.contains(document.activeElement);

    if (e.shiftKey && (outside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (outside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  });
});
