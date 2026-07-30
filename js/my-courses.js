/* ==========================================================================
   ISLOH — "Mening kurslarim" moduli  (pages/student/courses.html)
   Kurs darajasidagi ma'lumot shu sahifada to'planadi — avval u
   bookmarks.html ("Saqlanganlar") ichida edi, endi "Saqlanganlar" faqat
   dars materiallari bilan ishlaydi (js/bookmarks.js).

   Ikki manba, ikkalasi ham js/marketplace.js'dagi umumiy do'konlardan:
     isloh_purchased_courses → "Boshlangan kurslar"
     isloh_saved_courses     → "Saqlangan kurslar" (Marketplace xatcho'pi)

   Markup contract:
     [data-enrolled-courses] / [data-enrolled-empty]
     [data-saved-courses]    / [data-saved-empty]
       [data-unsave-course]  → saqlanganlardan olib tashlaydi
   ========================================================================== */

// Kurs katakchasi — ikkala bo'lim uchun yagona shakl (DRY)
function isloh_myCourseCardHtml(course, opts) {
  const action = opts && opts.unsave
    ? `<button class="btn btn-outline btn-sm btn-block" data-unsave-course data-course-id="${course.id}" style="margin-top:10px;">Saqlanganlardan olib tashlash</button>`
    : `<a href="course-player.html" class="btn btn-primary btn-sm btn-block" style="margin-top:10px;">Davom etish</a>`;

  return `
    <div class="card" style="overflow:hidden;" data-course-id="${course.id}">
      <div class="course-cover" style="background:${course.cover};"><i class="${course.icon}"></i></div>
      <div class="card-pad" style="padding-top:16px;">
        <div class="course-card-title">${course.title}</div>
        <div class="course-card-sub">${opts && opts.sub ? opts.sub : ''}</div>
        ${action}
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

// "Boshlangan kurslar" — sotib olingan kurslar
function isloh_renderEnrolledCourses() {
  if (typeof isloh_getPurchasedCourses !== 'function') return;
  const cards = isloh_getPurchasedCourses().map((course) =>
    isloh_myCourseCardHtml(course, { sub: "Marketplace'dan sotib olindi" })
  );
  isloh_renderCourseSection('[data-enrolled-courses]', '[data-enrolled-empty]', cards);
}

// "Saqlangan kurslar" — faqat ID saqlanadi, qolgani katalogdan olinadi
function isloh_renderSavedCourses() {
  if (typeof isloh_getSavedCourses !== 'function') return;
  const cards = isloh_getSavedCourses()
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')) // eng yangisi birinchi
    .map((saved) => {
      const course = isloh_findCourseById(saved.id);
      if (!course) return null; // katalogdan o'chirilgan kurs
      return isloh_myCourseCardHtml(course, { unsave: true, sub: `${course.instructor} · ${course.duration}` });
    })
    .filter(Boolean);
  isloh_renderCourseSection('[data-saved-courses]', '[data-saved-empty]', cards);
}

function isloh_initMyCourses() {
  const grid = document.querySelector('[data-enrolled-courses]');
  if (!grid) return; // bu sahifa emas — no-op

  isloh_renderEnrolledCourses();
  isloh_renderSavedCourses();

  // Saqlanganlardan olib tashlash — delegatsiya orqali
  document.querySelector('[data-saved-courses]')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-unsave-course]');
    if (!btn || typeof isloh_removeSavedCourse !== 'function') return;
    isloh_removeSavedCourse(btn.dataset.courseId);
    isloh_renderSavedCourses();
    if (typeof isloh_showToast === 'function') {
      isloh_showToast('Saqlangan kurslardan olib tashlandi', 'success');
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initMyCourses);
