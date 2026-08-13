/* ==========================================================================
   ISLOH — Analitika sahifasi (pages/instructor/analytics.html)

   NEGA O'ZGARDI: sahifa to'liq statik edi — bironta mount nuqtasi yo'q,
   uchala kartochka, "Eng yaxshi kurslar" va "Eng faol talabalar"
   ro'yxatlari HTML ichida qo'lda yozilgan edi. Raqamlar boshqa sahifalar
   bilan ziddiyatda turardi: bu yerda "Python Backend — 248 talaba, 92%
   yakunlash" derdi, kurs do'konida esa 2,140 talaba va 78% yakunlash bor;
   "Eng faol talabalar" ro'yxatidagi Samarqand Islomov esa umuman hech
   qanday do'konda yo'q edi.

   Mehnat taqsimoti (CLAUDE.md §2 — DRY):
     DAVRGA BOG'LIQ raqamlar -> js/period-stats.js  (`[data-period-stat]`)
     DAVRDAN MUSTAQIL raqamlar -> js/profile-stats.js (`[data-stat]`)
     RO'YXATLAR                -> shu fayl
   Bu faylda bironta hisoblagich qayta yozilmagan.

   VAQT QATORI YO'Q: kunlik ro'yxatga olish va kunlik o'quv soatlari hech
   qanday do'konda saqlanmaydi (do'konlar faqat joriy HOLATNI biladi:
   jarayon foizi, oxirgi faollik sanasi). Shu sababli ikkala grafik
   dashboard'dagi bilan bir xil uslubda `.placeholder-note` bilan "namuna"
   deb belgilangan — o'ylab topilgan chiziq haqiqiy ko'rsatkich sifatida
   ko'rsatilmaydi (CLAUDE.md §4).

   Markup shartnomasi:
     [data-analytics-top-courses]   → eng yaxshi kurslar ro'yxati
     [data-analytics-top-students]  → eng faol talabalar ro'yxati
   ========================================================================== */

const ISLOH_ANALYTICS_TOP_COURSES = 3;
const ISLOH_ANALYTICS_TOP_STUDENTS = 3;

function isloh_analyticsEmptyHtml(text) {
  return `<p class="placeholder-note"><i class="bi bi-info-circle"></i> ${text}</p>`;
}

/* --- Eng yaxshi kurslar ---------------------------------------------------
   "Eng yaxshi" = talaba soni bo'yicha eng yuqori nashr etilgan kurslar —
   dashboard'dagi "Eng yaxshi kurslar" bilan AYNAN bir xil ta'rif, aks holda
   ikki sahifa boshqa-boshqa uchlikni ko'rsatardi. Farqi shundaki, bu yerda
   o'lchov sifatida daromad emas, yakunlash darajasi ko'rsatiladi. */

function isloh_analyticsCourseHtml(course) {
  const students = (course.students || 0).toLocaleString('en-US');
  const rating = course.rating ? ` · ${course.rating} ★` : '';

  return `<div class="perf-row">
    <div class="perf-cover" style="background:${course.cover};"><i class="bi ${course.icon}"></i></div>
    <div class="perf-info">
      <div class="perf-title"><a class="text-inherit" href="course-details.html?id=${encodeURIComponent(course.id)}">${course.title}</a></div>
      <div class="perf-sub">${students} talaba${rating}</div>
    </div>
    <div class="perf-metric">
      <div class="perf-metric-val">${course.completion}%</div>
      <div class="perf-metric-lbl">yakunlash</div>
    </div>
  </div>`;
}

function isloh_renderAnalyticsTopCourses() {
  const mount = document.querySelector('[data-analytics-top-courses]');
  if (!mount) return;

  const top = isloh_getPublishedCourses()
    .slice()
    .sort((a, b) => (b.students || 0) - (a.students || 0))
    .slice(0, ISLOH_ANALYTICS_TOP_COURSES);

  mount.innerHTML = top.length
    ? top.map(isloh_analyticsCourseHtml).join('')
    : isloh_analyticsEmptyHtml("Hali nashr etilgan kurs yo'q.");
}

/* --- Eng faol talabalar ---------------------------------------------------
   Saralash SERIYA bo'yicha: "eng faol" degani eng yuqori ball emas, eng
   uzluksiz o'qiyotgan talaba. Ro'yxat js/enrollment-store.js dagi
   `isloh_enrollments` do'konidan — talabalar sahifasidagi bilan bir xil
   manba. */

function isloh_analyticsStudentHtml(row) {
  const e = row.enrollment;
  const meta = isloh_enrollmentStateMeta(row.state);
  const initials = typeof isloh_getUserInitials === 'function'
    ? isloh_getUserInitials(e.studentName)
    : String(e.studentName || '?').charAt(0);
  const style = e.avatar ? ` style="background:${e.avatar};"` : '';

  return `<div class="roster-row">
    <div class="avatar avatar-sm"${style}>${initials}</div>
    <div class="roster-info">
      <div class="roster-name">${e.studentName}</div>
      <div class="roster-sub">🔥 ${e.streak} kunlik seriya · ${meta.label}</div>
    </div>
    <div class="roster-meta">${e.avgScore}%</div>
  </div>`;
}

function isloh_renderAnalyticsTopStudents() {
  const mount = document.querySelector('[data-analytics-top-students]');
  if (!mount) return;

  const top = isloh_getEnrollmentRows()
    .slice()
    .sort((a, b) => (b.enrollment.streak || 0) - (a.enrollment.streak || 0))
    .slice(0, ISLOH_ANALYTICS_TOP_STUDENTS);

  mount.innerHTML = top.length
    ? top.map(isloh_analyticsStudentHtml).join('')
    : isloh_analyticsEmptyHtml("Hali ro'yxatga olingan talaba yo'q.");
}

function isloh_renderInstructorAnalytics() {
  if (!document.querySelector('[data-analytics-top-courses]')) return; // bu sahifa emas
  isloh_renderAnalyticsTopCourses();
  isloh_renderAnalyticsTopStudents();
}

document.addEventListener('isloh:courses-updated', isloh_renderInstructorAnalytics);
document.addEventListener('isloh:enrollments-updated', isloh_renderInstructorAnalytics);
document.addEventListener('DOMContentLoaded', isloh_renderInstructorAnalytics);
