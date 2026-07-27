/* ==========================================================================
   ISLOH — Modal module
   Minimal open/close helpers for the `.modal` / `.modal-overlay` pattern
   defined in css/components.css. No page uses a live modal yet (only the
   static preview in pages/shared/components.html), but Course Editor
   ("Kursdan chiqasizmi?" confirmation) and future delete/confirm flows
   will call these directly instead of re-implementing overlay logic.
   ========================================================================== */

function isloh_openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.hidden = false;
  overlay.classList.add('anim-fade-in');
}

function isloh_closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not([hidden])').forEach((o) => { o.hidden = true; });
    }
  });
});
