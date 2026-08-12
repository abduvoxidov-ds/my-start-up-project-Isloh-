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
     instructor -> publishedCourses | students | rating | teachingHours |
                   draftCourses | archivedCourses | ratedCourses |
                   totalRevenue | totalLessons | avgCompletion |
                   pendingSubmissions

   Modul faqat profil sahifasiga tegishli emas: `[data-stat]` bor istalgan
   sahifada ishlaydi (instruktor dashboard'i ham shu shartnomadan
   foydalanadi).
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

/* Holat bo'yicha kurslar soni — qoralama/arxiv kartochkalari uchun. Bu yerda
   isloh_getCourses() ishlatiladi, isloh_getPublishedCourses() emas: savol
   aynan nashr etilMAGAN kurslar haqida. */
function isloh_statCoursesByStatus(status) {
  if (typeof isloh_getCourses !== 'function') return null;
  return isloh_getCourses().filter((course) => course.status === status).length;
}

function isloh_statDraftCourses() {
  return isloh_statCoursesByStatus('draft');
}

function isloh_statArchivedCourses() {
  return isloh_statCoursesByStatus('archived');
}

/* "O'rtacha reyting N ta kurs bo'yicha" izohi uchun — o'rtacha qaysi
   kurslardan olinganini aytadi (isloh_statAverageRating bilan bir xil
   to'plam: reytingi bor nashr etilgan kurslar). */
function isloh_statRatedCourses() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  return isloh_getPublishedCourses().filter((course) => course.rating > 0).length;
}

/* Jami daromad. Arxivlangan kurslar ham qo'shiladi — pul allaqachon
   ishlangan, kursni ro'yxatdan olish uni yo'q qilmaydi. */
function isloh_statTotalRevenue() {
  if (typeof isloh_getCourses !== 'function') return null;
  return isloh_getCourses().reduce((sum, course) => sum + (course.revenue || 0), 0);
}

/* Darslar soni kurs yozuvidagi `lessons` maydonidan olinadi — kurslar
   ro'yxati ham aynan shu raqamni ko'rsatadi, ikki sahifa qarama-qarshi
   raqam aytmasin. Maydonni js/content-store.js modul yoki dars
   qo'shilganda o'zi yangilab boradi. */
function isloh_statTotalLessons() {
  if (typeof isloh_getCourses !== 'function') return null;
  return isloh_getCourses().reduce((sum, course) => sum + (course.lessons || 0), 0);
}

/* Baholanmagan topshirilgan ishlar (kechikkanlar ham shu yerda) — o'qituvchi
   uchun eng harakatga chorlovchi raqam. Manba js/assignment-store.js; modul
   ulanmagan sahifada "—" bo'lib qoladi. */
function isloh_statPendingSubmissions() {
  if (typeof isloh_submissionStats !== 'function') return null;
  const stats = isloh_submissionStats();
  return stats.pending + stats.late;
}

/* Nashr etilgan kurslarning o'rtacha yakunlash darajasi. Qoralamalarda
   `completion` butunlay boshqa narsani anglatadi ("necha foizi tayyor"),
   shuning uchun ular hisobga kirmaydi. */
function isloh_statAvgCompletion() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  const list = isloh_getPublishedCourses();
  if (!list.length) return 0;
  return list.reduce((sum, course) => sum + (course.completion || 0), 0) / list.length;
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
    teachingHours: isloh_statTeachingHours,
    /* Quyidagilar instruktor dashboard'i uchun qo'shildi — sahifa o'z
       hisoblagichini yozmasin, raqam manbasi bitta bo'lsin. */
    draftCourses: isloh_statDraftCourses,
    archivedCourses: isloh_statArchivedCourses,
    ratedCourses: isloh_statRatedCourses,
    totalRevenue: isloh_statTotalRevenue,
    totalLessons: isloh_statTotalLessons,
    avgCompletion: isloh_statAvgCompletion,
    pendingSubmissions: isloh_statPendingSubmissions
  }
};

/* Sukut bo'yicha barcha ko'rsatkich butun son va ming ajratgichli. Bundan
   chetga chiqadiganlar (kasr, valyuta, foiz) shu yerda e'lon qilinadi —
   shunda formatlash mantiqi markupda emas, bitta jadvalda qoladi. */
const ISLOH_STAT_FORMATS = {
  rating: (v) => v.toFixed(1),
  totalRevenue: (v) => (typeof isloh_formatUsd === 'function' ? isloh_formatUsd(v) : isloh_formatStatCount(v)),
  avgCompletion: (v) => isloh_formatStatCount(v) + '%'
};

function isloh_formatStat(key, value) {
  if (value === null || value === undefined) return '—';
  const format = ISLOH_STAT_FORMATS[key];
  return format ? format(value) : isloh_formatStatCount(value);
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

/* Provayder ko'rsatkichlari kurs do'konidan hisoblanadi, shuning uchun kurs
   nashr etilgani yoki o'chirilgani raqamlarni ham darhol yangilashi kerak —
   aks holda dashboard sahifa yangilanmaguncha eski sonni ko'rsatib turardi. */
document.addEventListener('isloh:courses-updated', isloh_renderProfileStats);
document.addEventListener('DOMContentLoaded', isloh_renderProfileStats);
