/* ==========================================================================
   ISLOH — Marketplace module  (course purchase -> bookmarks bridge)
   Frontend-only: "Savatga qo'shish" simulates an immediate purchase and
   stores the course in localStorage so pages/student/bookmarks.html can
   render it under "Mening kurslarim". No backend/payment involved.

   Storage key: isloh_purchased_courses — array of
     { title, cover, icon }
   ========================================================================== */

const ISLOH_PURCHASED_KEY = 'isloh_purchased_courses';

function isloh_getPurchasedCourses() {
  try {
    return JSON.parse(localStorage.getItem(ISLOH_PURCHASED_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function isloh_addPurchasedCourse(course) {
  const list = isloh_getPurchasedCourses();
  if (list.some((c) => c.title === course.title)) return;
  list.push(course);
  localStorage.setItem(ISLOH_PURCHASED_KEY, JSON.stringify(list));
}

function isloh_initMarketplace() {
  document.querySelectorAll('[data-mkt-add-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.mkt-card');
      if (!card) return;

      const title = card.querySelector('.filter-title')?.textContent.trim() || 'Kurs';
      const cover = card.querySelector('.mkt-cover');
      const course = {
        title,
        cover: cover?.style.background || '',
        icon: cover?.querySelector('i')?.className || 'bi bi-journal-bookmark-fill'
      };

      isloh_addPurchasedCourse(course);

      btn.textContent = 'Sotib olindi';
      btn.disabled = true;
      btn.classList.add('btn-outline');
      btn.classList.remove('btn-primary');

      if (typeof isloh_showToast === 'function') {
        isloh_showToast(`"${title}" xarid qilindi va "Mening kurslarim"ga qo'shildi`, 'success');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', isloh_initMarketplace);
