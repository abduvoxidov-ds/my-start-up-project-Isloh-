/* ==========================================================================
   ISLOH — Ro'yxatga olish (enrollment) do'koni

   `isloh_enrollments` — KIM qaysi kursga QACHON yozilgani, jarayoni necha
   foiz va oxirgi marta qachon faol bo'lgani. Sahifalari:
     pages/instructor/students.html  — talabalar jadvali va statistikasi
     pages/instructor/dashboard.html — "So'nggi ro'yxatga olinganlar"

   DIQQAT — js/enrollment.js BILAN ADASHTIRMANG: u talaba tomonidagi
   butunlay boshqa modul ("Kursga yozilish" tugmasi oqimi). Bu fayl esa
   o'qituvchi ko'radigan ro'yxatning manbai.

   NEGA BU FAYL BOR: students.html dagi 6 ta qator HTML ichiga qo'lda
   yozilgan edi — ism, jarayon foizi, o'rtacha ball, seriya va "Faol / Sust /
   Faol emas" nishoni ham. Yuqoridagi statistika kartochkalari (245 / 189 /
   72% / 5) esa shu qatorlar bilan umuman bog'liq emas edi: jadvalda 6 ta
   talaba turib, kartochka 245 deb yozardi. Dashboard'dagi "Talabalar"
   kartochkasi ham shu sababli ro'yxatni ko'rsata olmasdi.

   Naqsh js/assignment-store.js bilan bir xil: standart sxema + birinchi
   o'qishda ekiladigan demo ma'lumot + qisman yangilash + `isloh:...-updated`
   hodisasi. fetch() ishlatilmaydi (CLAUDE.md §3).

   HOLAT HISOBLANADI, SAQLANMAYDI: "Faol / Sust / Faol emas / Yakunladi"
   alohida maydonda emas — u `progress` va `lastActiveAt` dan kelib chiqadi
   (isloh_enrollmentState). Aks holda "faol, lekin 3 oydan beri kirmagan"
   kabi ziddiyatli yozuvlar paydo bo'lishi mumkin edi.
   ========================================================================== */

const ISLOH_ENROLLMENTS_KEY = 'isloh_enrollments';

/* Faollik holatlari. Chegaralar KUNda: shu jadvaldan tashqarida hech qayerda
   "3 kun" yoki "10 kun" yozilmasin. `fill` — jarayon chizig'ining sinfi
   (css/components.css), ya'ni rang ham markupda emas, shu yerda. */
const ISLOH_ENROLLMENT_STATES = {
  completed: { label: 'Yakunladi', badge: 'badge-green',   fill: ' fill-teach',   maxIdleDays: null },
  active:    { label: 'Faol',      badge: 'badge-green',   fill: '',              maxIdleDays: 3 },
  idle:      { label: 'Sust',      badge: 'badge-warning', fill: ' fill-warning', maxIdleDays: 10 },
  inactive:  { label: 'Faol emas', badge: 'badge-danger',  fill: ' fill-muted',   maxIdleDays: null }
};

/* "Bu hafta faol" ko'rsatkichi uchun — yuqoridagi holat chegaralaridan
   mustaqil savol: talaba oxirgi 7 kun ichida umuman kirganmi? */
const ISLOH_ENROLLMENT_WEEK_DAYS = 7;

const ISLOH_ENROLLMENT_DEFAULTS = {
  id: '',
  studentId: '',
  studentName: '',
  email: '',
  avatar: '',          // CSS gradienti; bo'sh bo'lsa .avatar sinfining o'z rangi
  courseId: '',
  enrolledAt: '',      // ISO
  progress: 0,         // %
  avgScore: 0,         // %
  streak: 0,           // kunlik seriya
  lastActiveAt: ''     // ISO
};

/* --- Demo ma'lumot --------------------------------------------------------
   Sanalar BUGUNDAN nisbatan ekiladi (js/assignment-store.js dagi bilan bir
   xil sabab): faollik holatining butun ma'nosi "oxirgi marta qachon kirgan?"
   savolida — qat'iy sana yozilsa, bir oydan keyin do'kondagi HAMMA talaba
   "faol emas" bo'lib qolardi.

   Talaba id'lari js/chat-store.js va js/assignment-store.js dagilar bilan
   BIR XIL (`std-001`, `s-javohir` ...) — "Xabar yozish" havolasi aynan shu
   talaba bilan suhbatni ochishi uchun. Avatar gradientlari ham chatdagi
   ranglar bilan bir xil, ya'ni bitta talaba ikki sahifada ikki xil rangda
   ko'rinmaydi.                                                             */

function isloh_enDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function isloh_enHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function isloh_enrollmentSeed() {
  return [
    {
      id: 'en-1', studentId: 'std-001', studentName: 'Samar Mirzayev', email: 'samar@example.com',
      avatar: '', courseId: 'py-101',
      enrolledAt: isloh_enDaysAgo(40), progress: 66, avgScore: 88, streak: 12,
      lastActiveAt: isloh_enDaysAgo(1)
    },
    {
      id: 'en-2', studentId: 's-javohir', studentName: 'Javohir Rasimov', email: 'javohir@example.com',
      avatar: 'linear-gradient(135deg,#F97316,#EA580C)', courseId: 'django-rest-masterclass',
      enrolledAt: isloh_enDaysAgo(55), progress: 90, avgScore: 92, streak: 21,
      lastActiveAt: isloh_enHoursAgo(3)
    },
    {
      id: 'en-3', studentId: 's-bekzod', studentName: 'Bekzod Odilov', email: 'bekzod@example.com',
      avatar: 'linear-gradient(135deg,#0EA5E9,#0369A1)', courseId: 'py-101',
      enrolledAt: isloh_enDaysAgo(18), progress: 40, avgScore: 74, streak: 3,
      lastActiveAt: isloh_enDaysAgo(6)
    },
    {
      id: 'en-4', studentId: 's-alisher', studentName: 'Alisher Karimov', email: 'alisher@example.com',
      avatar: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', courseId: 'postgresql-complete-guide',
      enrolledAt: isloh_enDaysAgo(70), progress: 100, avgScore: 95, streak: 30,
      lastActiveAt: isloh_enDaysAgo(3)
    },
    {
      id: 'en-5', studentId: 's-nodira', studentName: 'Nodira Yusupova', email: 'nodira@example.com',
      avatar: 'linear-gradient(135deg,#DB2777,#F472B6)', courseId: 'django-rest-masterclass',
      enrolledAt: isloh_enDaysAgo(12), progress: 55, avgScore: 81, streak: 8,
      lastActiveAt: isloh_enDaysAgo(2)
    },
    {
      id: 'en-6', studentId: 's-sardor', studentName: 'Sardor Aliyev', email: 'sardor@example.com',
      avatar: 'linear-gradient(135deg,#059669,#10B981)', courseId: 'py-101',
      enrolledAt: isloh_enDaysAgo(8), progress: 22, avgScore: 68, streak: 1,
      lastActiveAt: isloh_enDaysAgo(21)
    }
  ];
}

/* --- Do'kon --------------------------------------------------------------- */

function isloh_enReadJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function isloh_enWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_normalizeEnrollment(enrollment) {
  return Object.assign({}, ISLOH_ENROLLMENT_DEFAULTS, enrollment || {});
}

function isloh_getEnrollments() {
  const stored = isloh_enReadJson(ISLOH_ENROLLMENTS_KEY);
  if (Array.isArray(stored)) return stored.map(isloh_normalizeEnrollment);

  const seed = isloh_enrollmentSeed().map(isloh_normalizeEnrollment);
  isloh_enWriteJson(ISLOH_ENROLLMENTS_KEY, seed);
  return seed;
}

function isloh_getEnrollment(id) {
  if (!id) return null;
  return isloh_getEnrollments().find((e) => e.id === id) || null;
}

/* Bitta kursning talabalari — kurs tafsilotlari sahifasi shu ro'yxatga
   tayanadi. */
function isloh_getCourseEnrollments(courseId) {
  if (!courseId) return isloh_getEnrollments();
  return isloh_getEnrollments().filter((e) => e.courseId === courseId);
}

function isloh_commitEnrollments(list) {
  if (!isloh_enWriteJson(ISLOH_ENROLLMENTS_KEY, list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:enrollments-updated', { detail: list }));
  return true;
}

/* Yozish API'si: talaba kursga yozilganda yoki jarayoni o'zgarganda
   chaqiriladi. Hozircha yozuvlar faqat demo ma'lumotdan keladi — talaba
   tomonidagi "Kursga yozilish" oqimi (js/enrollment.js) va real jarayon
   backend ulangach shu funksiyaga bog'lanadi (CLAUDE.md §4). */
function isloh_saveEnrollment(patch) {
  const list = isloh_getEnrollments();
  const data = patch || {};
  const index = data.id ? list.findIndex((e) => e.id === data.id) : -1;

  if (index === -1) {
    const enrollment = isloh_normalizeEnrollment(data);
    enrollment.id = 'en-' + Date.now();
    enrollment.enrolledAt = enrollment.enrolledAt || new Date().toISOString();
    enrollment.lastActiveAt = enrollment.lastActiveAt || enrollment.enrolledAt;
    list.push(enrollment);
    return isloh_commitEnrollments(list) ? enrollment : null;
  }

  list[index] = isloh_normalizeEnrollment(Object.assign({}, list[index], data));
  return isloh_commitEnrollments(list) ? list[index] : null;
}

function isloh_deleteEnrollment(id) {
  return isloh_commitEnrollments(isloh_getEnrollments().filter((e) => e.id !== id));
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

/* Oxirgi faollikdan beri necha kun o'tgani. Sana yo'q bo'lsa Infinity —
   bunday yozuv hech qachon "faol" deb hisoblanmaydi. */
function isloh_enrollmentIdleDays(enrollment) {
  if (!enrollment || !enrollment.lastActiveAt) return Infinity;
  const at = new Date(enrollment.lastActiveAt).getTime();
  if (isNaN(at)) return Infinity;
  return Math.floor((Date.now() - at) / 86400000);
}

/* Yagona holat manbai — sahifalar o'z shartini yozmasin. */
function isloh_enrollmentState(enrollment) {
  if (!enrollment) return 'inactive';
  if ((enrollment.progress || 0) >= 100) return 'completed';

  const idle = isloh_enrollmentIdleDays(enrollment);
  if (idle <= ISLOH_ENROLLMENT_STATES.active.maxIdleDays) return 'active';
  if (idle <= ISLOH_ENROLLMENT_STATES.idle.maxIdleDays) return 'idle';
  return 'inactive';
}

function isloh_enrollmentStateMeta(state) {
  return ISLOH_ENROLLMENT_STATES[state] || ISLOH_ENROLLMENT_STATES.inactive;
}

/* Jadval uchun to'liq qator: yozuv + kurs nomi + holat bir joyda
   (js/assignment-store.js dagi isloh_getSubmissionQueue kabi). Kursi
   o'chirilgan yozuv ham ko'rinadi — talaba yo'qolib qolmasin, faqat kurs
   nomi o'rniga uning id'si chiqadi. */
function isloh_getEnrollmentRows() {
  return isloh_getEnrollments()
    .map((enrollment) => {
      const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(enrollment.courseId) : null;
      return {
        enrollment: enrollment,
        courseId: enrollment.courseId,
        courseTitle: course ? course.title : enrollment.courseId,
        state: isloh_enrollmentState(enrollment)
      };
    })
    .sort((a, b) => (b.enrollment.progress || 0) - (a.enrollment.progress || 0));
}

/* So'nggi ro'yxatga olinganlar — dashboard'dagi "Talabalar" kartochkasi. */
function isloh_recentEnrollments(limit) {
  return isloh_getEnrollments()
    .slice()
    .sort((a, b) => String(b.enrolledAt || '').localeCompare(String(a.enrolledAt || '')))
    .slice(0, limit || 3);
}

/* students.html dagi 4 ta kartochka. Talabalar NOYOB id bo'yicha sanaladi:
   bitta talaba ikki kursga yozilgan bo'lsa ham u bitta talaba. */
function isloh_enrollmentStats() {
  const list = isloh_getEnrollments();
  const students = new Set(list.map((e) => e.studentId));
  const activeStudents = new Set(
    list.filter((e) => isloh_enrollmentIdleDays(e) <= ISLOH_ENROLLMENT_WEEK_DAYS).map((e) => e.studentId)
  );
  const inactiveStudents = new Set(
    list.filter((e) => isloh_enrollmentState(e) === 'inactive').map((e) => e.studentId)
  );

  return {
    total: students.size,
    active: activeStudents.size,
    /* O'rtacha jarayon YOZUVLAR bo'yicha, talabalar bo'yicha emas: har bir
       yozuv alohida kursdagi alohida jarayon. */
    avgProgress: list.length
      ? Math.round(list.reduce((sum, e) => sum + (e.progress || 0), 0) / list.length)
      : 0,
    inactive: inactiveStudents.size
  };
}

/* Kurs yozuvlaridagi `students` maydoni — sotuvdan yig'ilgan umumiy son;
   bu do'konda esa har bir talabaning o'z qatori bor. Demo ma'lumotda ular
   albatta farq qiladi va bu farq sahifada ochiq aytiladi (students.html),
   aks holda sahifa "6 talaba" deb turib, dashboard "2,330" derdi. */
function isloh_enrollmentCoverage() {
  const counted = typeof isloh_statTotalStudents === 'function' ? isloh_statTotalStudents() : null;
  const listed = isloh_enrollmentStats().total;
  return { counted: counted, listed: listed, complete: counted === null || counted <= listed };
}
