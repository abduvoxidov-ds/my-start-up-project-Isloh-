/* ==========================================================================
   ISLOH — Settings reveal-toggle module  (Sprint 6B, extracted from
   Sprint 6A's js/quiz-editor.js)
   Generic "checkbox reveals a field" engine used by Quiz Editor's
   Sozlamalar tab (time limit / attempts / certificate fields) and now
   Assignment Editor's Submission tab (late-submission penalty, max file
   size, multiple-files count) — one implementation instead of two.

   Markup contract:
     <input type="checkbox" data-reveals="<targetId>">  → any checkbox
       [id="<targetId>"]                                 → shown/hidden
                                                            to match .checked
   ========================================================================== */

/* Faqat ko'rinishni holatga moslaydi — hodisa ulamaydi. Qiymatlar JS bilan
   (masalan do'kondan) qo'yilganda `change` hodisasi otilmaydi, shuning uchun
   bunday sahifalar shu funksiyani chaqiradi (js/assignment-editor.js). */
function isloh_syncRevealToggles() {
  document.querySelectorAll('[data-reveals]').forEach((control) => {
    const target = document.getElementById(control.dataset.reveals);
    if (target) target.hidden = !control.checked;
  });
}

function isloh_initRevealToggles() {
  document.querySelectorAll('[data-reveals]').forEach((control) => {
    const target = document.getElementById(control.dataset.reveals);
    if (!target || control.dataset.revealsReady) return;
    control.dataset.revealsReady = '1';
    control.addEventListener('change', () => { target.hidden = !control.checked; });
  });
  isloh_syncRevealToggles();
}

document.addEventListener('DOMContentLoaded', isloh_initRevealToggles);
