/* ==========================================================================
   ISLOH — Enrollment module
   pages/student/course-landing.html dagi "Kursga yozilish" tugmasini
   boshqaradi. Ilgari tugma oraliq tasdiqlash oynasini ochardi va tasdiqlangach
   faqat "muvaffaqiyat" bloki ko'rsatilardi — hech qanday xarid bo'lmasdi.
   Endi tugma kursni savatga qo'shib to'g'ridan-to'g'ri xarid (checkout)
   oynasiga olib o'tadi; kurs allaqachon sotib olingan bo'lsa — o'quv
   sahifasiga.

   Markup shartnomasi:
     [data-enroll-buy]        → "Kursga yozilish" tugmasi
     [data-enroll-owned]      → "allaqachon yozilgansiz" belgisi (yashirin)
     [data-wishlist-toggle]   → istaklar ro'yxati tugmasi
   ========================================================================== */

// Sahifadagi kursni `?id=` bo'yicha oladi (js/course-content.js)
function isloh_enrollCourse() {
  if (typeof isloh_getCourseFromQuery !== 'function') return null;
  const fallback = typeof ISLOH_LANDING_FALLBACK_ID !== 'undefined' ? ISLOH_LANDING_FALLBACK_ID : '';
  return isloh_getCourseFromQuery(fallback);
}

function isloh_initEnrollFlow() {
  const btn = document.querySelector('[data-enroll-buy]');
  if (!btn) return;

  const course = isloh_enrollCourse();
  if (!course) return;

  const owned = typeof isloh_isPurchased === 'function' && isloh_isPurchased(course.id);

  /* Sotib olingan kursda tugma xaridni takrorlamaydi — o'quv sahifasini
     ochadi va yuqorida "yozilgansiz" belgisi chiqadi. */
  if (owned) {
    btn.innerHTML = '<i class="bi bi-play-fill"></i> O\'rganishni boshlash';
    document.querySelectorAll('[data-enroll-owned]').forEach((el) => { el.hidden = false; });
  }

  btn.addEventListener('click', () => {
    if (owned) {
      window.location.href = `course-detail.html?id=${course.id}`;
      return;
    }
    // Savatga qo'shiladi (takror qo'shilmaydi) va darhol xarid oynasi ochiladi
    if (typeof isloh_addToCart === 'function') isloh_addToCart(course);
    window.location.href = 'checkout.html';
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
