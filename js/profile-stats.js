/* ==========================================================================
   ISLOH — Profil statistikasi

   Profil sahifalaridagi raqamlarni MAVJUD do'konlardan hisoblaydi. Ilgari
   ular HTML ichida qo'lda yozilgan edi va boshqa sahifalar bilan ziddiyatga
   tushib qolgandi: profil "142 soat" derdi, analitika esa 42 soat; profil
   "6 nashr etilgan kurs" derdi, kurs do'konida esa 3 tasi nashr etilgan.

   Manbalar (hammasi typeof bilan himoyalangan — modul ulanmagan sahifada
   raqam shunchaki "—" bo'lib qoladi, sahifa buzilmaydi):
     js/lesson-viewer.js      -> isloh_getCourseProgress()   (yakunlangan kurs)
     js/certificate-engine.js -> isloh_getCertificates()     (sertifikatlar)
     js/progress-metrics.js   -> isloh_getAnalytics()        (soat, seriya)
     js/course-store.js       -> isloh_getPublishedCourses() (provayder)
     js/profile.js            -> isloh_getActiveRole()       (qaysi rol)

   Markup shartnomasi:
     [data-stat="<kalit>"]    -> raqam shu elementga yoziladi
     [data-stat-goal="3000"]  -> "2,330 / 3,000" ko'rinishida maqsad bilan

   Kalitlar rol bo'yicha:
     student    -> completedCourses | certificates | studyHours | streak
     instructor -> publishedCourses | students | rating | teachingHours
   ========================================================================== */

/* Ming ajratgichi mavjud sahifalardagi uslub bilan bir xil: 1,240 */
function isloh_formatStatCount(value) {
  return String(Math.round(value || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* --- Talaba ko'rsatkichlari ---------------------------------------------- */

/* Yakunlangan kurslar: darslari to'liq belgilangan kurslar + sertifikat
   olingan kurslar. To'plam (Set) — bir kurs ikkala manbada ham bo'lsa
   ikki marta sanalmasin. */
function isloh_statCompletedCourses() {
  const ids = new Set();

  if (typeof isloh_getCourseProgress === 'function') {
    const all = isloh_getCourseProgress();
    Object.keys(all).forEach((courseId) => {
      const lessons = all[courseId] || {};
      const lessonIds = Object.keys(lessons);
      if (lessonIds.length && lessonIds.every((id) => lessons[id])) ids.add(courseId);
    });
  }

  if (typeof isloh_getCertificates === 'function') {
    Object.values(isloh_getCertificates()).forEach((cert) => ids.add(cert.courseId));
  }

  return ids.size;
}

function isloh_statCertificates() {
  if (typeof isloh_getCertificates !== 'function') return null;
  return Object.keys(isloh_getCertificates()).length;
}

function isloh_statStudyHours() {
  if (typeof isloh_getAnalytics !== 'function') return null;
  return Math.round((isloh_getAnalytics().totalStudyMinutes || 0) / 60);
}

/* Kunlik seriya: analitika heatmap'i oxiridan (bugungi katakdan) orqaga
   qarab, birinchi bo'sh kunga duch kelguncha sanaladi. Heatmap oxirgi hafta
   bilan tugaydi, shuning uchun bugungi katak indeksi = oxirgi hafta boshi +
   bugungi kun tartibi (0=Dush ... 6=Yak). */
function isloh_statStreak() {
  if (typeof isloh_getAnalytics !== 'function') return null;
  const cells = isloh_getAnalytics().activityHeatmap || [];
  if (!cells.length) return 0;

  const dayIndex = (new Date().getDay() + 6) % 7;
  let i = Math.min(cells.length - 7 + dayIndex, cells.length - 1);

  let streak = 0;
  while (i >= 0 && cells[i] > 0) { streak++; i--; }
  return streak;
}

/* --- Provayder ko'rsatkichlari ------------------------------------------- */

/* Faqat NASHR ETILGAN kurslar: qoralama va arxiv yozuvlari talabaga
   ko'rinmaydi, shuning uchun profil statistikasiga ham kirmaydi. */
function isloh_statPublishedCourses() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  return isloh_getPublishedCourses().length;
}

function isloh_statTotalStudents() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  return isloh_getPublishedCourses().reduce((sum, course) => sum + (course.students || 0), 0);
}

/* Reytingi hali yo'q (0) kurslar o'rtachani pasaytirmasligi kerak. */
function isloh_statAverageRating() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  const rated = isloh_getPublishedCourses().filter((course) => course.rating > 0);
  if (!rated.length) return 0;
  return rated.reduce((sum, course) => sum + course.rating, 0) / rated.length;
}

/* Kurs davomiyligi do'konda "42 soat" ko'rinishida matn sifatida yotadi. */
function isloh_statTeachingHours() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  return isloh_getPublishedCourses()
    .reduce((sum, course) => sum + (parseInt(course.estimate, 10) || 0), 0);
}

/* --- Render --------------------------------------------------------------- */

const ISLOH_PROFILE_STATS = {
  student: {
    completedCourses: isloh_statCompletedCourses,
    certificates: isloh_statCertificates,
    studyHours: isloh_statStudyHours,
    streak: isloh_statStreak
  },
  instructor: {
    publishedCourses: isloh_statPublishedCourses,
    students: isloh_statTotalStudents,
    rating: isloh_statAverageRating,
    teachingHours: isloh_statTeachingHours
  }
};

/* Reyting yagona kasrli ko'rsatkich (4.8), qolganlari butun son. */
const ISLOH_STAT_DECIMALS = { rating: 1 };

function isloh_formatStat(key, value) {
  if (value === null || value === undefined) return '—';
  if (ISLOH_STAT_DECIMALS[key]) return value.toFixed(ISLOH_STAT_DECIMALS[key]);
  return isloh_formatStatCount(value);
}

function isloh_renderProfileStats() {
  const targets = document.querySelectorAll('[data-stat]');
  if (!targets.length) return; // bu sahifa emas — no-op

  const role = typeof isloh_getActiveRole === 'function' ? isloh_getActiveRole() : 'student';
  const resolvers = ISLOH_PROFILE_STATS[role];
  if (!resolvers) return;

  /* Bir kalit bir necha joyda ishlatilishi mumkin (stat kartochkasi va
     maqsad nishoni) — hisob bir marta bajariladi. */
  const cache = {};

  targets.forEach((el) => {
    const key = el.dataset.stat;
    if (!resolvers[key]) return;
    if (!(key in cache)) cache[key] = resolvers[key]();

    const value = cache[key];
    const goal = el.dataset.statGoal;
    el.textContent = goal
      ? isloh_formatStat(key, value) + ' / ' + isloh_formatStatCount(Number(goal))
      : isloh_formatStat(key, value);
  });
}

/* Profil tahrirlanganda ham qayta hisoblanadi (rol o'zgarmaydi, lekin
   sinxron bitta joydan boshqarilgani ma'qul). */
document.addEventListener('isloh:user-updated', isloh_renderProfileStats);
document.addEventListener('DOMContentLoaded', isloh_renderProfileStats);
