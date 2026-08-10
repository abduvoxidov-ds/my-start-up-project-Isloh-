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
     [data-unsaved-store="<nom>"] → boshqa do'kon ishlatiladi (pastga qara)

   "Saqlash" endi haqiqatan saqlaydi: maydon qiymatlari js/draft-store.js
   orqali `isloh_drafts` do'koniga yoziladi va sahifa qayta ochilganda
   tiklanadi. Ilgari bu tugma faqat bayroqni tozalab, "O'zgarishlar
   saqlandi" deb yolg'on toast chiqarardi.

   --- Do'konni almashtirish ------------------------------------------------
   "Tahrirla → Saqla" mexanikasi (iflos holat, ogohlantirish, tugma,
   beforeunload) qoralamalarga xos emas. Admin platforma sozlamalari ham
   xuddi shu naqshda ishlaydi, lekin `isloh_drafts`ga emas, o'z do'koniga
   (`isloh_platform_settings`) yozilishi kerak — u yerdagi qiymatlarni
   boshqa modullar ham o'qiydi.

   Shu sababli saqlash/tiklash almashtiriladigan qilindi: sahifa
   `data-unsaved-store="<nom>"` yozadi, modul esa shu nom bilan ro'yxatdan
   o'tgan do'konni ishlatadi. Atribut bo'lmasa — avvalgidek qoralama do'koni.
   ========================================================================== */

/* nom -> { save(scope) -> son (xatoda <0), restore(scope) -> son } */
const ISLOH_UNSAVED_STORES = {};

/* Do'konlar DOMContentLoaded'dan oldin, ya'ni fayl yuklanishida ro'yxatdan
   o'tadi (js/platform-settings.js shunday qiladi). */
function isloh_registerUnsavedStore(name, store) {
  ISLOH_UNSAVED_STORES[name] = store;
}

/* Sukut bo'yicha do'kon — js/draft-store.js. U ulanmagan sahifada
   funksiyalar mavjud bo'lmaydi, shuning uchun himoyalangan chaqiruv. */
const ISLOH_DRAFT_UNSAVED_STORE = {
  save: (scope) => (typeof isloh_saveDraft === 'function' ? isloh_saveDraft(scope) : null),
  restore: (scope) => (typeof isloh_restoreDraft === 'function' ? isloh_restoreDraft(scope) : 0)
};

function isloh_unsavedStoreFor(scope) {
  const name = scope.dataset.unsavedStore;
  return (name && ISLOH_UNSAVED_STORES[name]) || ISLOH_DRAFT_UNSAVED_STORE;
}

function isloh_initUnsavedGuard() {
  const scope = document.querySelector('[data-unsaved-scope]');
  if (!scope) return;
  const indicator = document.querySelector('[data-unsaved-indicator]');
  const store = isloh_unsavedStoreFor(scope);
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
  // Saqlangan yozuv bo'lsa tiklanadi (bu "o'zgarish" hisoblanmaydi)
  if (store.restore(scope)) {
    markClean();
  }

  document.querySelectorAll('[data-save-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const saved = store.save(scope);
      // null -> do'kon umuman ulanmagan: hech narsa qilmaymiz, yolg'on
      // "saqlandi" xabari ham bermaymiz
      if (saved === null) return;

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
