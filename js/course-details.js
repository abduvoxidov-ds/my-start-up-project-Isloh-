/* ==========================================================================
   ISLOH — Kurs tafsilotlari (pages/instructor/course-details.html)

   Sahifa `?id=<kurs>` bilan ochiladi va js/course-store.js dagi
   `isloh_courses` do'konidan chiziladi.

   NEGA O'ZGARDI: sahifa qaysi kurs ochilganini UMUMAN o'qimasdi —
   kurslar ro'yxatidagi qaysi kursni bossangiz ham "Python Backend
   Development", $1,480, 248 talaba, 4.9 ★ ko'rinardi. Barcha havolalar
   ham parametrsiz edi, ya'ni "Tahrirlash" tugmasi boshqa kursni ochib
   yuborishi mumkin edi.

   Sahifadagi bloklar va ularning manbasi:
     sarlavha / statistika / tavsif / teglar → js/course-store.js
     "Kurs tarkibi"                          → js/content-store.js
     "Kurs materiallari"                     → assignment / quiz / resource
                                                do'konlari
     "Yakunlash xulosasi"                    → kursning `completion` maydoni
     "So'nggi sharhlar"                      → js/review-store.js
   Daromad dinamikasi hech qanday do'konda yo'q (kunlik tarix saqlanmaydi),
   shuning uchun u `.placeholder-note` bilan ochiq belgilangan
   (CLAUDE.md §4).

   Markup shartnomasi:
     [data-course-out="<nom>"]      → matn qo'yiladi
     [data-course-detail-stat="…"]  → statistika kartochkalari
     [data-course-modules]          → modullar ro'yxati
     [data-course-materials]        → materiallar hisoblagichlari
     [data-course-reviews]          → shu kursning sharhlari
     [data-course-link="<sahifa>"]  → havolaga ?id= qo'shiladi (course-store)
   ========================================================================== */

function isloh_courseDetailsId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

/* --- Modullar ro'yxati ---------------------------------------------------- */

function isloh_courseModuleRowHtml(module, index) {
  const lessons = (module.lessons || []).length;
  const published = module.status === 'published';

  return `<div class="goal-item">
    <div class="goal-text">${index + 1}. ${module.title}</div>
    <span class="badge ${published ? 'badge-green' : 'badge-warning'}">${lessons} dars</span>
  </div>`;
}

function isloh_renderCourseModules(course) {
  const mount = document.querySelector('[data-course-modules]');
  if (!mount) return;

  const modules = typeof isloh_getModules === 'function' ? isloh_getModules(course.id) : [];
  if (!modules.length) {
    mount.innerHTML = `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Bu kursda hali modul yo'q — "Kurs tarkibi" bo'limida qo'shing.</p>`;
    return;
  }

  let html = modules.map(isloh_courseModuleRowHtml).join('');

  /* Kurs yozuvidagi dars soni (kurslar ro'yxati va talaba katalogi shu
     raqamni ko'rsatadi) tarkib do'konidagidan ko'p bo'lishi mumkin: demo
     tarkib kursning faqat bir qismini qamraydi. Bu farqni yashirmaymiz —
     aks holda sahifa "96 dars" deb turib 12 tasini ko'rsatardi. */
  const built = modules.reduce((sum, m) => sum + ((m.lessons || []).length), 0);
  if (course.lessons > built) {
    html += `<p class="placeholder-note mt-8"><i class="bi bi-info-circle"></i> Kurs yozuvida ${course.lessons} dars ko'rsatilgan, tarkib muharririda hozircha ${built} tasi tayyor.</p>`;
  }

  mount.innerHTML = html;
}

/* --- Materiallar ---------------------------------------------------------
   Har bir raqam o'z do'konidan hisoblanadi. Modul ulanmagan sahifada
   raqam "—" bo'lib qoladi, sahifa buzilmaydi. */

function isloh_courseMaterialCounts(course) {
  const count = (fn, arg) => (typeof fn === 'function' ? fn(arg) : null);

  return [
    { label: 'Modullar',   icon: 'bi-diagram-3',           page: 'course-builder.html',
      value: count(isloh_getModules, course.id) ? isloh_getModules(course.id).length : 0 },
    { label: 'Darslar',    icon: 'bi-play-btn-fill',       page: 'course-builder.html',
      value: course.lessons || 0 },
    { label: 'Topshiriqlar', icon: 'bi-file-earmark-text-fill', page: 'assignment-builder.html',
      value: typeof isloh_getCourseAssignments === 'function' ? isloh_getCourseAssignments(course.id).length : null },
    { label: 'Testlar',    icon: 'bi-patch-question-fill', page: 'quiz-builder.html',
      value: typeof isloh_getCourseQuizzes === 'function' ? isloh_getCourseQuizzes(course.id).length : null },
    { label: 'Resurslar',  icon: 'bi-folder-fill',         page: 'resource-manager.html',
      value: typeof isloh_getCourseResources === 'function'
        ? isloh_getCourseResources(course.id).filter((r) => r.status === 'active').length : null }
  ];
}

function isloh_renderCourseMaterials(course) {
  const mount = document.querySelector('[data-course-materials]');
  if (!mount) return;

  const id = encodeURIComponent(course.id);
  mount.innerHTML = isloh_courseMaterialCounts(course).map((item) => `
    <a class="goal-item text-inherit" href="${item.page}?id=${id}">
      <div class="goal-text"><i class="bi ${item.icon}"></i> ${item.label}</div>
      <span class="badge badge-neutral">${item.value === null ? '—' : item.value}</span>
    </a>`).join('');
}

/* --- So'nggi sharhlar -----------------------------------------------------
   Ilgari bu blokda "sharhlar do'koni hali yo'q" degan izoh turardi. Endi
   shu kursning sharhlari js/review-store.js dan chiziladi; javob berish
   sharhlar sahifasida qoladi, bu yerda faqat ko'rinadi. */

const ISLOH_COURSE_REVIEW_LIMIT = 3;

function isloh_courseReviewHtml(review) {
  const reply = isloh_getReviewReply(review.id);
  const replyBlock = reply
    ? `<div class="review-reply"><div class="lbl">Sizning javobingiz</div><div class="txt">${reply}</div></div>`
    : '';

  return `<div class="review-card">
    <div class="avatar avatar-sm"${review.avatar ? ` style="background:${review.avatar};"` : ''}>${isloh_getUserInitials(review.studentName)}</div>
    <div class="flex-1 min-w-0">
      <div class="review-head">
        <span class="review-name">${review.studentName}</span>
        <span class="rating-stars">${isloh_reviewStarsHtml(review.rating)}</span>
        <span class="review-time">${isloh_reviewTimeLabel(review)}</span>
      </div>
      <div class="review-text">${review.text}</div>
      ${replyBlock}
    </div>
  </div>`;
}

function isloh_renderCourseReviews(course) {
  const mount = document.querySelector('[data-course-reviews]');
  if (!mount) return;

  /* Do'kon ulanmagan sahifada soxta sharh chizilmaydi. */
  if (typeof isloh_getCourseReviews !== 'function') {
    mount.innerHTML = `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Sharhlar moduli bu sahifaga ulanmagan.</p>`;
    return;
  }

  const reviews = isloh_getCourseReviews(course.id);
  if (!reviews.length) {
    mount.innerHTML = `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Bu kursga hali sharh qoldirilmagan.</p>`;
    return;
  }

  const stats = isloh_reviewStats(course.id);
  let html = reviews.slice(0, ISLOH_COURSE_REVIEW_LIMIT).map(isloh_courseReviewHtml).join('');

  /* Ro'yxat qisqartirilgan bo'lsa, nechtasi ko'rinmagani ochiq aytiladi. */
  if (reviews.length > ISLOH_COURSE_REVIEW_LIMIT) {
    html += `<p class="text-xs text-muted mt-8">Jami ${stats.total} ta sharh · o'rtacha ${stats.average.toFixed(1)} ★ — barchasi "Sharhlar" bo'limida.</p>`;
  }
  mount.innerHTML = html;
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderCourseDetails() {
  if (!document.querySelector('[data-course-out="title"]')) return; // bu sahifa emas

  const course = isloh_getCourse(isloh_courseDetailsId());
  if (!course) {
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(isloh_courseDetailsId() ? 'Bunday kurs topilmadi' : "Kurs tanlanmagan — ro'yxatdan oching", 'error');
    }
    return;
  }

  const values = {
    title: course.title,
    /* Dars soni kurs yozuvidan — kurslar ro'yxati ham shu raqamni
       ko'rsatadi (js/content-store.js uni tarkib o'zgarganda yangilaydi). */
    meta: [course.category, course.level, course.lessons + ' dars',
           'Yangilangan ' + isloh_relativeDate(course.updatedAt)].filter(Boolean).join(' · '),
    description: course.description || course.subtitle || 'Tavsif hali yozilmagan.',
    completionNote: `O'rtacha ${course.completion}% talaba kursni yakunlagan`
  };
  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-course-out="${key}"]`).forEach((el) => { el.textContent = values[key]; });
  });

  const stats = {
    revenue: course.revenue ? isloh_formatUsd(course.revenue) : '—',
    students: (course.students || 0).toLocaleString('en-US'),
    rating: course.rating ? course.rating.toFixed(1) : '—',
    completion: course.completion + '%'
  };
  /* querySelectorAll: talabalar soni ikki joyda — statistika kartochkasida
     va "Tezkor havolalar" dagi izohda. */
  Object.keys(stats).forEach((key) => {
    document.querySelectorAll(`[data-course-detail-stat="${key}"]`).forEach((el) => { el.textContent = stats[key]; });
  });

  /* Muqova va holat nishoni */
  const cover = document.querySelector('[data-course-cover]');
  if (cover) {
    cover.style.background = course.cover;
    cover.innerHTML = `<i class="bi ${course.icon}"></i>`;
  }

  const badge = document.querySelector('[data-course-status-badge]');
  if (badge) {
    const meta = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
    badge.className = 'badge ' + meta.badge;
    badge.textContent = meta.label;
  }

  const tags = document.querySelector('[data-course-tags-out]');
  if (tags) {
    tags.innerHTML = course.tags.length
      ? course.tags.map((tag) => `<span class="cci-tag">${tag}</span>`).join('')
      : '<span class="cci-tag">Teg yo\'q</span>';
  }

  const bar = document.querySelector('[data-course-completion-bar]');
  if (bar) bar.style.width = Math.min(100, Math.max(0, course.completion)) + '%';

  isloh_renderCourseModules(course);
  isloh_renderCourseMaterials(course);
  isloh_renderCourseReviews(course);

  /* Barcha amal havolalari joriy kursni olib yuradi. */
  document.querySelectorAll('[data-course-crumb]').forEach((el) => { el.textContent = course.title; });
  isloh_applyCourseLinks(course.id);
  document.title = course.title + ' — Isloh';
}

document.addEventListener('isloh:courses-updated', isloh_renderCourseDetails);
document.addEventListener('DOMContentLoaded', isloh_renderCourseDetails);
