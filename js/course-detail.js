/* ==========================================================================
   ISLOH — Sotib olingan kurs sahifasi (pages/student/course-detail.html)
   Marketplace kartochkasi yoki "Mening kurslarim" ro'yxatidan
   `course-detail.html?id=<kurs-id>` ko'rinishida ochiladi. Sarlavha, dastur
   va kurs tarkibi js/marketplace.js (katalog) + js/course-content.js
   (kurs mazmuni) ma'lumotidan to'ldiriladi.

   Progress haqiqiy: js/lesson-viewer.js pleerda belgilangan darslarni
   `isloh_course_progress` kalitiga yozadi, shu sahifa esa faqat o'qiydi.
   Hali bironta dars belgilanmagan bo'lsa 0% ko'rsatiladi (ilgari bu yerda
   har qanday kurs uchun 63% qattiq yozilgan edi).

   Markup shartnomasi:
     [data-detail-title] [data-detail-summary] [data-detail-badge]
     [data-detail-cover] [data-detail-icon]
     [data-detail-outcomes]   -> "Bu kursda o'rganasiz"
     [data-detail-includes]   -> "Kurs tarkibi"
     [data-detail-modules]    -> dastur (modullar + darslar)
     [data-detail-progress-pct]  -> foiz yozuvi
     [data-detail-progress-fill] -> progress chizig'i
   ========================================================================== */

// `?id=` berilmagan yoki noto'g'ri bo'lsa shu kurs ko'rsatiladi
const ISLOH_DETAIL_FALLBACK_ID = 'py-101';

const ISLOH_DETAIL_BINDINGS = {
  'data-detail-title': (c) => c.title,
  'data-detail-summary': (c) => c.summary,
  'data-detail-badge': (c) => c.level
};

/* Kurs progressi: pleerda belgilangan darslar nisbati. Yozuv bo'lmasa null —
   chaqiruvchi uni 0% deb ko'rsatadi. */
function isloh_detailProgressPercent(courseId) {
  if (typeof isloh_getCourseProgress !== 'function') return 0;
  const progress = isloh_getCourseProgress()[courseId];
  if (!progress) return 0;

  const lessonIds = Object.keys(progress);
  if (!lessonIds.length) return 0;
  const done = lessonIds.filter((id) => progress[id]).length;
  return Math.round((done / lessonIds.length) * 100);
}

function isloh_renderDetailProgress(course) {
  const percent = isloh_detailProgressPercent(course.id);
  document.querySelectorAll('[data-detail-progress-pct]').forEach((el) => { el.textContent = percent + '%'; });
  document.querySelectorAll('[data-detail-progress-fill]').forEach((el) => { el.style.width = percent + '%'; });
}

/* Dastur qatori: dars nomi + davomiyligi, bosilganda pleer ochiladi.
   Darsning bajarilgan/bajarilmagan holati pleerda belgilanadi, shuning
   uchun bu yerda faqat turi bo'yicha ikonka qo'yiladi. */
function isloh_detailLessonHtml(lesson, order) {
  const type = ISLOH_LESSON_TYPES[lesson.type] || ISLOH_LESSON_TYPES.video;
  return `
    <a href="course-player.html" class="lesson-row lesson-link">
      <i class="${type.icon}"></i> ${order}. ${lesson.title}
      <span class="lesson-time">${lesson.duration}</span>
    </a>`;
}

function isloh_renderDetailModules(details) {
  const el = document.querySelector('[data-detail-modules]');
  if (!el) return;

  let order = 0;
  el.innerHTML = details.modules.map((module, index) => {
    const lessons = module.preview.map((lesson) => {
      order += 1;
      return isloh_detailLessonHtml(lesson, order);
    }).join('');

    return `
      <div class="module-title">Modul ${index + 1}: ${module.title}
        <span class="badge badge-neutral module-title-badge">${module.lessons} dars</span>
      </div>
      ${lessons}`;
  }).join('');
}

function isloh_renderDetailCourse() {
  const course = isloh_getCourseFromQuery(ISLOH_DETAIL_FALLBACK_ID);
  if (!course) return;

  isloh_applyCourseBindings(ISLOH_DETAIL_BINDINGS, course);

  document.querySelectorAll('[data-detail-cover]').forEach((el) => { el.style.background = course.cover; });
  document.querySelectorAll('[data-detail-icon]').forEach((el) => { el.className = course.icon; });

  isloh_renderDetailProgress(course);

  const details = isloh_getCourseDetails(course.id);
  if (details) {
    isloh_renderIconList('[data-detail-outcomes]', details.outcomes, 'includes-row', 'bi bi-check2 text-green');
    isloh_renderIconList('[data-detail-includes]', [
      { icon: 'bi bi-camera-reels', text: `${course.lessons} ta dars · ${course.duration}` },
      { icon: 'bi bi-patch-question', text: `${details.quizzes} ta test` },
      { icon: 'bi bi-kanban', text: `${details.projects} ta amaliy loyiha` },
      { icon: 'bi bi-award', text: 'Yakunlash sertifikati' },
      { icon: 'bi bi-infinity', text: 'Umrbod kirish' }
    ], 'includes-row');
    isloh_renderDetailModules(details);
  }

  document.title = course.title + ' — Isloh';
}

document.addEventListener('DOMContentLoaded', isloh_renderDetailCourse);
