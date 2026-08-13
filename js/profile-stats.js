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
     js/enrollment-store.js   -> isloh_enrollmentStats()     (talabalar)
     js/review-store.js       -> isloh_reviewStats()         (sharhlar)
     js/assignment-store.js   -> isloh_assignmentStats()     (topshiriqlar)
     js/quiz-store.js         -> isloh_quizStats()           (testlar)
     js/resource-store.js     -> isloh_libraryStats()        (resurslar)
     js/profile.js            -> isloh_getActiveRole()       (qaysi rol)

   Markup shartnomasi:
     [data-stat="<kalit>"]    -> raqam shu elementga yoziladi
     [data-stat-goal="3000"]  -> "2,330 / 3,000" ko'rinishida maqsad bilan

   Kalitlar rol bo'yicha:
     student    -> completedCourses | certificates | studyHours | streak
     instructor -> publishedCourses | students | rating | teachingHours |
                   draftCourses | archivedCourses | ratedCourses |
                   totalRevenue | totalLessons | avgCompletion |
                   pendingSubmissions | enrolledStudents | activeStudents |
                   inactiveStudents | avgProgress | reviewAverage |
                   reviewCount | replyRate | pendingReplies |
                   totalAssignments | totalQuizzes | totalResources |
                   earningCourses | avgCoursePrice

   DAVRGA BOG'LIQ raqamlar bu yerda emas — ular js/period-stats.js da
   (`[data-period-stat]`), chunki ular sanali do'konlardan oyna bo'yicha
   hisoblanadi va tanlangan davrga qarab o'zgaradi.

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

/* --- Kontent hajmi (topshiriq / test / resurs do'konlari) -----------------
   Analitika sahifasidagi "nima yaratilgan" kartochkalari. Har bir raqam o'z
   do'konining STATISTIKA funksiyasidan olinadi — bu yerda qayta sanalmaydi,
   aks holda "topshiriq" ta'rifi ikki joyda yashardi. */

function isloh_statTotalAssignments() {
  if (typeof isloh_assignmentStats !== 'function') return null;
  return isloh_assignmentStats().total;
}

function isloh_statTotalQuizzes() {
  if (typeof isloh_quizStats !== 'function') return null;
  return isloh_quizStats().total;
}

/* Faqat faol (arxivlanmagan) resurslar — kutubxona ham shu sonni ko'rsatadi. */
function isloh_statTotalResources() {
  if (typeof isloh_libraryStats !== 'function') return null;
  return isloh_libraryStats().total;
}

/* --- Daromad ko'rsatkichlari (js/course-store.js) -------------------------
   Kunlik/oylik daromad tarixi hech qanday do'konda yo'q, shuning uchun bu
   yerdagi hammasi KURS YOZUVIDAGI umrbod qiymatlardan hisoblanadi (davrga
   bog'liq emas). Davr kesimidagi raqamlar revenue.html da `.placeholder-note`
   bilan ochiq belgilangan. */

/* Nechta kurs umuman pul keltirgan — arxivlangani ham sanaladi, pul
   allaqachon ishlangan (isloh_statTotalRevenue bilan bir xil mantiq). */
function isloh_statEarningCourses() {
  if (typeof isloh_getCourses !== 'function') return null;
  return isloh_getCourses().filter((course) => (course.revenue || 0) > 0).length;
}

/* O'rtacha kurs narxi — faqat nashr etilgan va BEPUL BO'LMAGAN kurslar:
   bepul kurslar o'rtachani sun'iy ravishda pasaytirardi. */
function isloh_statAvgCoursePrice() {
  if (typeof isloh_getPublishedCourses !== 'function') return null;
  const paid = isloh_getPublishedCourses().filter((course) => !course.free && course.price > 0);
  if (!paid.length) return 0;
  return paid.reduce((sum, course) => sum + course.price, 0) / paid.length;
}

/* --- Ro'yxatga olish ko'rsatkichlari (js/enrollment-store.js) -------------
   Talabalar sahifasidagi 4 ta kartochka. Diqqat: bu yerdagi "jami" —
   ro'yxatga olish YOZUVLARI bo'yicha noyob talabalar soni, yuqoridagi
   isloh_statTotalStudents() esa kurs yozuvlaridagi umumiy sotuv sonini
   qaytaradi. Ikkalasi boshqa savolga javob beradi va demo ma'lumotda
   farq qiladi — farq students.html da ochiq izohlanadi. */

function isloh_enrollmentStatValue(field) {
  if (typeof isloh_enrollmentStats !== 'function') return null;
  return isloh_enrollmentStats()[field];
}

function isloh_statEnrolledStudents() {
  return isloh_enrollmentStatValue('total');
}

function isloh_statActiveStudents() {
  return isloh_enrollmentStatValue('active');
}

function isloh_statInactiveStudents() {
  return isloh_enrollmentStatValue('inactive');
}

function isloh_statAvgProgress() {
  return isloh_enrollmentStatValue('avgProgress');
}

/* --- Sharh ko'rsatkichlari (js/review-store.js) ---------------------------
   Sharhlar sahifasidagi 4 ta kartochka. Javob berilgan/berilmagan holati
   `isloh_review_replies` do'konidan kelib chiqadi, ya'ni javob yozilishi
   bilan uchala raqam ham qayta hisoblanadi. */

function isloh_reviewStatValue(field) {
  if (typeof isloh_reviewStats !== 'function') return null;
  return isloh_reviewStats()[field];
}

function isloh_statReviewAverage() {
  return isloh_reviewStatValue('average');
}

function isloh_statReviewCount() {
  return isloh_reviewStatValue('total');
}

function isloh_statReplyRate() {
  return isloh_reviewStatValue('replyRate');
}

function isloh_statPendingReplies() {
  return isloh_reviewStatValue('pending');
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
    pendingSubmissions: isloh_statPendingSubmissions,
    /* Analitika sahifasi (kontent hajmi va daromad kesimi) */
    totalAssignments: isloh_statTotalAssignments,
    totalQuizzes: isloh_statTotalQuizzes,
    totalResources: isloh_statTotalResources,
    earningCourses: isloh_statEarningCourses,
    avgCoursePrice: isloh_statAvgCoursePrice,
    /* Talabalar sahifasi (ro'yxatga olish do'koni) */
    enrolledStudents: isloh_statEnrolledStudents,
    activeStudents: isloh_statActiveStudents,
    inactiveStudents: isloh_statInactiveStudents,
    avgProgress: isloh_statAvgProgress,
    /* Sharhlar sahifasi */
    reviewAverage: isloh_statReviewAverage,
    reviewCount: isloh_statReviewCount,
    replyRate: isloh_statReplyRate,
    pendingReplies: isloh_statPendingReplies
  }
};

/* Sukut bo'yicha barcha ko'rsatkich butun son va ming ajratgichli. Bundan
   chetga chiqadiganlar (kasr, valyuta, foiz) shu yerda e'lon qilinadi —
   shunda formatlash mantiqi markupda emas, bitta jadvalda qoladi. */
const ISLOH_STAT_FORMATS = {
  rating: (v) => v.toFixed(1),
  reviewAverage: (v) => v.toFixed(1),
  totalRevenue: (v) => (typeof isloh_formatUsd === 'function' ? isloh_formatUsd(v) : isloh_formatStatCount(v)),
  /* Narx — dollar va sentlar bilan ($49.33): kurs narxlari butun son emas. */
  avgCoursePrice: (v) => '$' + (Number(v) || 0).toFixed(2),
  avgCompletion: (v) => isloh_formatStatCount(v) + '%',
  avgProgress: (v) => isloh_formatStatCount(v) + '%',
  replyRate: (v) => isloh_formatStatCount(v) + '%'
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

/* Xuddi shu sabab qolgan do'konlar uchun ham: talaba ro'yxatga olinsa yoki
   sharhga javob yozilsa, kartochkalardagi raqamlar darhol yangilanadi. */
document.addEventListener('isloh:enrollments-updated', isloh_renderProfileStats);
document.addEventListener('isloh:reviews-updated', isloh_renderProfileStats);
document.addEventListener('DOMContentLoaded', isloh_renderProfileStats);
