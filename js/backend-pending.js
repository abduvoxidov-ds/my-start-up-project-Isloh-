/* ==========================================================================
   ISLOH — Backend talab qiladigan amallar
   Ba'zi tugmalarni frontendda halol bajarib bo'lmaydi: pul yechish, to'lov
   usulini qo'shish yoki boshqarish — bularning hammasi real to'lov tizimini
   talab qiladi (CLAUDE.md §4, backend bosqichi).

   Shu paytgacha ular oddiy tugma bo'lib turardi va bosilganda hech narsa
   bo'lmasdi. Ularni soxta "muvaffaqiyatli bajarildi" toast'i bilan
   "ishlatib qo'yish" yolg'on bo'lardi — pul haqidagi amalda esa bu ayniqsa
   yomon. Shuning uchun tugma o'chirilgan holatda turadi va nima uchun
   ishlamayotganini ochiq aytadi.

   Markup shartnomasi:
     [data-backend-pending="<amal nomi>"]  → tugma
   ========================================================================== */

const ISLOH_BACKEND_PENDING_NOTE = "to'lov tizimi ulangandan keyin ishlaydi";

function isloh_initBackendPending() {
  const buttons = [...document.querySelectorAll('[data-backend-pending]')];
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.title = btn.dataset.backendPending + ' — ' + ISLOH_BACKEND_PENDING_NOTE;
  });

  /* Sababni faqat tooltip'da qoldirmaymiz: o'chiq tugmaning nega
     o'chiqligi ekranda ham ko'rinib tursin. Izoh bir marta, birinchi
     tugmaning kartochkasiga qo'yiladi. */
  const card = buttons[0].closest('.card') || buttons[0].parentElement;
  if (card && !card.querySelector('.pending-note')) {
    const note = document.createElement('p');
    note.className = 'pending-note';
    note.innerHTML = '<i class="bi bi-info-circle"></i> To\'lov amallari ' + ISLOH_BACKEND_PENDING_NOTE + '.';
    card.appendChild(note);
  }
}

document.addEventListener('DOMContentLoaded', isloh_initBackendPending);
