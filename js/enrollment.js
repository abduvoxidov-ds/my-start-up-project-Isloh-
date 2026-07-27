/* ==========================================================================
   ISLOH — Enrollment module  (Sprint 7)
   Powers pages/student/course-landing.html. Uses the existing
   isloh_openModal / isloh_closeModal helpers from js/modal.js for the
   confirmation dialog — no new overlay mechanism.

   Markup contract:
     [data-enroll-cta]        → wraps the "Enroll" price box / button
     [data-enroll-confirm]    → the confirm button inside the modal
     [data-enroll-success]    → success-state block, hidden until confirmed
     [data-wishlist-toggle]   → heart/bookmark-style toggle button
   ========================================================================== */

function isloh_initEnrollFlow() {
  const cta = document.querySelector('[data-enroll-cta]');
  const success = document.querySelector('[data-enroll-success]');
  const confirmBtn = document.querySelector('[data-enroll-confirm]');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', () => {
    isloh_closeModal('enroll-confirm-modal');
    if (cta) cta.hidden = true;
    if (success) success.hidden = false;
    if (typeof isloh_showToast === 'function') isloh_showToast("Kursga muvaffaqiyatli yozildingiz!", 'success');
  });
}

function isloh_initWishlistToggle() {
  document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const on = btn.classList.contains('active');
      btn.innerHTML = on
        ? '<i class="bi bi-heart-fill"></i> Saqlangan'
        : '<i class="bi bi-heart"></i> Istaklar ro\'yxatiga saqlash';
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(on ? "Istaklar ro'yxatiga qo'shildi" : "Istaklar ro'yxatidan olib tashlandi", 'info');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initEnrollFlow();
  isloh_initWishlistToggle();
});
