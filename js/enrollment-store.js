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
  courseTitle: '',
  enrolledAt: '',      // ISO
  progress: 0,         // %
  avgScore: 0,         // %
  streak: 0,           // kunlik seriya
  lastActiveAt: '',    // ISO
  /* Serverdan keladi (M3). Bo'sh bo'lsa — offline nusxa yoki demo, u
     holda `isloh_enrollmentState` uni mahalliy hisoblaydi. */
  state: ''
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

/* Serverdan kelgan yozuvni frontend sxemasiga o'giradi (M3).
   API snake_case, do'kon camelCase — ajratish belgisi `student_id`.
   Naqsh js/course-store.js dagi bilan bir xil. */
function isloh_isServerEnrollment(row) {
  return row && (('student_id' in row) || ('last_active_at' in row));
}

function isloh_fromServerEnrollment(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    email: row.email,
    avatar: row.avatar,
    courseId: row.course,
    courseTitle: row.course_title,
    enrolledAt: row.enrolled_at,
    progress: row.progress,
    avgScore: row.avg_score,
    streak: row.streak,
    lastActiveAt: row.last_active_at,
    /* Holat endi SERVERDA hisoblanadi (docs/BACKEND-PLAN.md §M3).
       Chegaralar ikki tomonda ikki xil bo'lib qolmasin. */
    state: row.state
  };
}

function isloh_normalizeEnrollment(enrollment) {
  const source = isloh_isServerEnrollment(enrollment)
    ? isloh_fromServerEnrollment(enrollment)
    : (enrollment || {});
  return Object.assign({}, ISLOH_ENROLLMENT_DEFAULTS, source);
}

/* --- Sync-over-Async kesh -------------------------------------------------
   Mexanizm js/api.js dagi `isloh_createStoreCache` da (kesh, qayta urinish,
   optimistik yozish, rollback). Bu yerda faqat ro'yxatga olishga XOS qism.

   Beshala iste'molchi (students, dashboard, analytics, period-stats,
   profile-stats) `isloh:enrollments-updated` ga allaqachon obuna.

   Demo ma'lumot FUNKSIYA sifatida beriladi: sanalar bugunga nisbatan
   ekiladi (qat'iy sana yozilsa bir oydan keyin hamma talaba "faol emas"
   bo'lib qolardi). */

const ISLOH_ENROLLMENT_CACHE = isloh_createStoreCache({
  key: ISLOH_ENROLLMENTS_KEY,
  /* O'qituvchi ko'radigan ro'yxat — o'z kurslaridagi talabalar.
     Talabaning O'Z kurslari boshqa endpoint (`/student/enrollments`) va
     boshqa shakl: ikkalasi bitta manzilda bo'lsa ruxsat qoidasi ham,
     javob maydonlari ham ziddiyatga tushardi. */
  endpoint: '/instructor/enrollments',
  event: 'isloh:enrollments-updated',
  normalize: isloh_normalizeEnrollment,
  seed: isloh_enrollmentSeed
});

function isloh_loadEnrollments()      { return ISLOH_ENROLLMENT_CACHE.load(); }
function isloh_retryLoadEnrollments() { return ISLOH_ENROLLMENT_CACHE.retry(); }
function isloh_getEnrollments()       { return ISLOH_ENROLLMENT_CACHE.get(); }
function isloh_persistEnrollment(e)   { return ISLOH_ENROLLMENT_CACHE.persist(e); }

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

/* Yozish API'si: talaba kursga yozilganda yoki jarayoni o'zgarganda
   chaqiriladi. Talaba tomonidagi "Kursga yozilish" oqimi (js/enrollment.js)
   backend ulangach shu funksiyaga bog'lanadi.

   SINXRON qoladi — chaqiruvchilar natijani darhol kutadi; tarmoq qismi
   fonda, xatoni isloh_persistEnrollment o'zi orqaga qaytaradi. */
function isloh_saveEnrollment(patch) {
  const list = isloh_getEnrollments();
  const data = patch || {};
  const index = data.id ? list.findIndex((e) => e.id === data.id) : -1;

  if (index === -1) {
    const enrollment = isloh_normalizeEnrollment(data);
    enrollment.id = 'en-' + Date.now();   // vaqtinchalik, server almashtiradi
    enrollment.enrolledAt = enrollment.enrolledAt || new Date().toISOString();
    enrollment.lastActiveAt = enrollment.lastActiveAt || enrollment.enrolledAt;
    isloh_persistEnrollment(enrollment).catch(() => {});
    return enrollment;
  }

  const updated = isloh_normalizeEnrollment(Object.assign({}, list[index], data));
  isloh_persistEnrollment(updated).catch(() => {});
  return updated;
}

/* Optimistik o'chirish (fabrikada: rollback o'sha o'ringa qaytaradi). */
function isloh_deleteEnrollment(id) {
  return ISLOH_ENROLLMENT_CACHE.remove(id);
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

/* Yagona holat manbai — sahifalar o'z shartini yozmasin.

   M3 dan boshlab holatni SERVER hisoblaydi va yozuv bilan birga yuboradi
   (`state`). Quyidagi mahalliy hisob faqat zaxira: `file://` ostida,
   tarmoq uzilganda va demo ma'lumotda. Chegaralar ikkala tomonda bir xil
   (backend: apps/learning/models.py dagi ACTIVE_MAX_IDLE_DAYS). */
function isloh_enrollmentState(enrollment) {
  if (!enrollment) return 'inactive';
  if (enrollment.state) return enrollment.state;
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
