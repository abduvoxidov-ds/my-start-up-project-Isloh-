/* ==========================================================================
   ISLOH — "Mening kurslarim" moduli  (pages/student/courses.html)
   Sahifada faqat sotib olingan kurslar ro'yxati chiqadi — tavsiya etilgan
   va saqlangan kurslar bo'limlari olib tashlandi.

   Manba — js/marketplace.js'dagi umumiy do'kon:
     isloh_purchased_courses → "Sotib olingan kurslar"

   Markup contract:
     [data-enrolled-courses] / [data-enrolled-empty]
   ========================================================================== */

// Kurs katakchasi
function isloh_myCourseCardHtml(course, opts) {
  return `
    <div class="card" style="overflow:hidden;" data-course-id="${course.id}">
      <div class="course-cover" style="background:${course.cover};"><i class="${course.icon}"></i></div>
      <div class="card-pad" style="padding-top:16px;">
        <div class="course-card-title">${course.title}</div>
        <div class="course-card-sub">${opts && opts.sub ? opts.sub : ''}</div>
        <a href="course-player.html" class="btn btn-primary btn-sm btn-block" style="margin-top:10px;">Davom etish</a>
      </div>
    </div>`;
}

// Ro'yxatni chizadi va bo'sh holatni almashtiradi
function isloh_renderCourseSection(gridSel, emptySel, cards) {
  const grid = document.querySelector(gridSel);
  const empty = document.querySelector(emptySel);
  if (!grid) return;
  grid.innerHTML = cards.join('');
  grid.style.display = cards.length ? '' : 'none';
  if (empty) empty.style.display = cards.length ? 'none' : '';
}

// "Sotib olingan kurslar"
function isloh_renderEnrolledCourses() {
  if (typeof isloh_getPurchasedCourses !== 'function') return;
  const cards = isloh_getPurchasedCourses().map((course) =>
    isloh_myCourseCardHtml(course, { sub: "Marketplace'dan sotib olindi" })
  );
  isloh_renderCourseSection('[data-enrolled-courses]', '[data-enrolled-empty]', cards);
}

function isloh_initMyCourses() {
  const grid = document.querySelector('[data-enrolled-courses]');
  if (!grid) return; // bu sahifa emas — no-op

  isloh_renderEnrolledCourses();
}

document.addEventListener('DOMContentLoaded', isloh_initMyCourses);
