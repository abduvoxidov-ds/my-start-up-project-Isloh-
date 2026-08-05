/* ==========================================================================
   ISLOH — Modal module
   `.modal` / `.modal-overlay` naqshi uchun umumiy ochish/yopish mantiqi
   (stillar css/components.css da). Sahifalar bu yerdagi ikki funksiyani
   chaqiradi — overlay mantiqini har joyda qayta yozmaslik uchun.

   Markup shartnomasi (js/dropdown.js dagi kabi, document darajasida
   delegatsiya — ya'ni JS bilan keyin qo'shilgan tugmalar ham ishlaydi):
     [data-modal-open="<id>"]   → shu id li modalni ochadi
     [data-modal-close="<id>"]  → shu id li modalni yopadi
     [data-modal-close]         → o'zi joylashgan modalni yopadi

   Ilgari sahifalarda buning o'rniga inline `onclick="isloh_openModal(...)"`
   yozilardi (67 ta joyda) — CLAUDE.md §2 bunday inline hodisa-atributlarni
   taqiqlaydi. Funksiyalar public bo'lib qoladi: ularni boshqa modullar
   (js/ai-panel.js, js/ai-chat.js, js/course-publish.js) chaqiradi.

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
  /* Ochish/yopish tugmalari va fon (backdrop) bosilishi — hammasi bitta
     document darajasidagi tinglovchida, shunda JS bilan keyin qo'shilgan
     modallar ham qo'shimcha init'siz ishlaydi. */
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (!el || typeof el.closest !== 'function') return;

    const opener = el.closest('[data-modal-open]');
    if (opener) {
      isloh_openModal(opener.getAttribute('data-modal-open'));
      return;
    }

    /* Qiymatsiz `data-modal-close` — o'zi turgan overlay yopiladi. */
    const closer = el.closest('[data-modal-close]');
    if (closer) {
      const id = closer.getAttribute('data-modal-close');
      isloh_closeOverlay(id ? document.getElementById(id) : closer.closest('.modal-overlay'));
      return;
    }

    if (el.classList && el.classList.contains('modal-overlay')) {
      isloh_closeOverlay(el);
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
