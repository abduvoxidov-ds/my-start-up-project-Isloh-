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
     [data-backend-pending="<amal nomi>"]        → tugma
     [data-backend-pending-reason="<sabab>"]     → tugmani o'z ichiga olgan
                                                    istalgan element; sabab
                                                    tooltip va izohda
                                                    ishlatiladi
     [data-backend-pending-note]                 → izoh aynan shu elementga
                                                    yoziladi (ixtiyoriy)
   ========================================================================== */

/* Sukut bo'yicha sabab. Ilgari bu qiymat to'lovga xos edi ("to'lov tizimi")
   va tugmaning tooltip'iga majburan qo'yilardi — natijada admin brendlash
   bo'limidagi "Logotip yuklash" tugmasi ham to'lov tizimini bahona qilardi.
   Endi sabab kartochkadan olinadi, bu esa faqat zaxira qiymat. */
const ISLOH_BACKEND_PENDING_REASON = 'backend ulangandan keyin ishlaydi';

/* Sabab tugmaning eng yaqin `data-backend-pending-reason` otasidan olinadi */
function isloh_backendPendingReason(btn) {
  const holder = btn.closest('[data-backend-pending-reason]');
  return (holder && holder.dataset.backendPendingReason) || ISLOH_BACKEND_PENDING_REASON;
}

function isloh_initBackendPending() {
  const buttons = [...document.querySelectorAll('[data-backend-pending]')];
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.title = btn.dataset.backendPending + ' — ' + isloh_backendPendingReason(btn);
  });

  /* Sababni faqat tooltip'da qoldirmaymiz: o'chiq tugmaning nega
     o'chiqligi ekranda ham ko'rinib tursin. Izoh bir marta, birinchi
     tugmaning kartochkasiga qo'yiladi.

     `data-backend-pending-note` — aniq mo'ljal. Kerak bo'lgan sabab: AI
     panelida skrepka tugmasi yumaloq kiritish "tabletka"si (`.ai-input-box`)
     ichida turadi; izoh uning eng yaqin otasiga tushsa, tabletka ichini
     buzardi. Mo'ljal berilmasa avvalgidek kartochka ishlatiladi.

     Kartochkada allaqachon izoh bo'lsa (`.pending-note` yoki sahifa o'zi
     yozgan `.placeholder-note`) yangisi qo'shilmaydi — aks holda bir xil
     gap ikki marta ko'rinardi (admin brendlash bo'limida shunday bo'lgan). */
  const card = buttons[0].closest('[data-backend-pending-note]')
    || buttons[0].closest('.card')
    || buttons[0].parentElement;
  if (card && !card.querySelector('.pending-note, .placeholder-note')) {
    const note = document.createElement('p');
    note.className = 'pending-note';
    /* Kartochkada bitta tugma bo'lsa "Bu amallar" deyish noto'g'ri —
       masalan chat oynasida faqat "Fayl biriktirish" o'chirilgan. */
    const subject = buttons.length > 1 ? 'Bu amallar ' : 'Bu amal ';
    note.innerHTML = '<i class="bi bi-info-circle"></i> ' + subject + isloh_backendPendingReason(buttons[0]) + '.';
    card.appendChild(note);
  }
}

document.addEventListener('DOMContentLoaded', isloh_initBackendPending);
