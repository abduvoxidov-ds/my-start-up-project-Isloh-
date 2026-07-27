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

function isloh_initRevealToggles() {
  document.querySelectorAll('[data-reveals]').forEach((control) => {
    const target = document.getElementById(control.dataset.reveals);
    if (!target) return;
    const sync = () => { target.hidden = !control.checked; };
    control.addEventListener('change', sync);
    sync();
  });
}

document.addEventListener('DOMContentLoaded', isloh_initRevealToggles);
