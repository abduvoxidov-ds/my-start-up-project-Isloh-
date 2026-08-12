/* ==========================================================================
   ISLOH — Topshiriqlar do'koni

   IKKI TUSHUNCHA, ikki kalit — ular chalkashtirilmasligi kerak:

     `isloh_assignments`  — o'qituvchi YARATGAN topshiriq loyihalari
                            (nomi, muddati, ball, rubrika). Sahifasi:
                            assignment-builder.html + assignment-editor.html
     `isloh_submissions`  — talaba TOPSHIRGAN ishlar (kim, qachon, necha ball).
                            Sahifasi: assignments.html (baholash navbati)

   NEGA BU FAYL BOR: uchala sahifa ham HTML ichiga qo'lda yozilgan qatorlar
   bilan ishlardi va bir-biridan bexabar edi. Builder'da "Topshiriq yaratish"
   bosilsa kartochka faqat DOM'da paydo bo'lardi (F5 — yo'q), baholash
   navbatidagi "Baholash" tugmasi esa qaysi ish ekanini bilmay, hammasi bir
   xil `assignment-editor.html` ga olib borardi. Statistika kartochkalari
   ham ro'yxat bilan bog'liq emas edi.

   Naqsh js/course-store.js va js/content-store.js bilan bir xil: standart
   sxema + birinchi o'qishda ekiladigan demo ma'lumot + qisman yangilash +
   `isloh:...-updated` hodisasi. fetch() ishlatilmaydi (CLAUDE.md §3).

   HOLAT HISOBLANADI, SAQLANMAYDI: topshirilgan ishning holati
   (kutilmoqda / kechikkan / baholangan) alohida maydonda emas — u
   `score` va `submittedAt` dan kelib chiqadi (isloh_submissionState).
   Aks holda "baholangan, lekin ball yo'q" kabi ziddiyatli yozuvlar
   paydo bo'lishi mumkin edi.
   ========================================================================== */

const ISLOH_ASSIGNMENTS_KEY = 'isloh_assignments';
const ISLOH_SUBMISSIONS_KEY = 'isloh_submissions';

const ISLOH_ASSIGNMENT_STATUSES = {
  draft:     { label: 'Qoralama',      badge: 'badge-warning' },
  published: { label: 'Nashr etilgan', badge: 'badge-green' }
};

/* Topshirish turi — kartochkadagi teg va muharrirdagi tugmalar shu jadvaldan
   o'qiydi, ya'ni yorliq matni bir joyda turadi. */
const ISLOH_SUBMIT_TYPES = {
  text:  { label: 'Matnli javob',  icon: 'bi-fonts' },
  file:  { label: 'Fayl yuklash',  icon: 'bi-upload' },
  multi: { label: 'Bir nechta fayl', icon: 'bi-files' }
};

/* Baholash navbatidagi holatlar. `late` — muddatdan keyin topshirilgan va
   HALI baholanmagan ish; baholangach u `reviewed` ga o'tadi (mavjud filtr
   chiplari ham aynan shunday ishlagan). */
const ISLOH_SUBMISSION_STATES = {
  pending:  { label: 'Kutilmoqda',  badge: 'badge-warning', thumb: 'tint-violet', icon: 'bi-file-earmark-text' },
  late:     { label: 'Kechikkan',   badge: 'badge-danger',  thumb: 'tint-danger', icon: 'bi-file-earmark-text' },
  reviewed: { label: 'Baholangan',  badge: 'badge-green',   thumb: 'tint-green',  icon: 'bi-file-earmark-check' }
};

const ISLOH_ASSIGNMENT_DEFAULTS = {
  id: '',
  courseId: '',
  title: '',
  desc: '',
  instructions: '',
  submitType: 'file',       // text | file | multi
  maxFiles: 3,
  fileTypes: ['.pdf', '.zip'],
  maxSizeMb: 25,
  maxScore: 100,
  estimate: 60,             // daqiqa
  dueDate: '',              // YYYY-MM-DD
  dueTime: '23:59',
  status: 'draft',          // draft | published
  visibility: 'public',     // public | hidden | scheduled
  attempts: 1,
  allowLate: true,
  latePenalty: 10,          // % / kun
  rubric: [],               // [{ text, points }]
  notes: '',                // faqat o'qituvchi ko'radigan eslatma
  cover: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)',
  icon: 'bi-file-earmark-text-fill',
  createdAt: '',
  updatedAt: ''
};

/* --- Demo ma'lumot --------------------------------------------------------
   Muddatlar va topshirish vaqtlari BUGUNDAN nisbatan ekiladi (absolut sana
   emas). Sabab: baholash navbatining butun ma'nosi "muddat o'tdimi?"
   savolida — qat'iy 2026-07-28 yozib qo'yilsa, bir oydan keyin do'kondagi
   HAMMA ish "kechikkan" bo'lib qolardi va sahifa mantiqsiz ko'rinardi.  */

function isloh_asDayShift(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isloh_asHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function isloh_assignmentSeed() {
  return [
    {
      id: 'as-django-models', courseId: 'py-101', title: 'Django modellari loyihasi',
      desc: 'Django ORM yordamida kurs katalogi modellarini loyihalash',
      instructions: "Ushbu topshiriqda Django ORM yordamida kurs katalogi uchun modellarni loyihalashingiz kerak. Kamida 3 ta bog'langan model yarating (masalan, Course, Module, Lesson).",
      submitType: 'file', maxScore: 100, estimate: 90, status: 'published', visibility: 'public',
      dueDate: isloh_asDayShift(3), attempts: 2, latePenalty: 10,
      rubric: [
        { text: "Modellar to'g'ri belgilangan (ForeignKey, fields)", points: 40 },
        { text: 'Migratsiyalar xatosiz ishlaydi', points: 30 },
        { text: 'Kod uslubi va izohlar', points: 30 }
      ],
      notes: "Talabalar ko'pincha ManyToMany maydonlarni unutishadi — shunga alohida e'tibor bering.",
      cover: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)', icon: 'bi-file-earmark-text-fill',
      createdAt: isloh_asDayShift(-20), updatedAt: isloh_asDayShift(-2)
    },
    {
      id: 'as-rest-endpoints', courseId: 'django-rest-masterclass', title: 'REST API endpointlari',
      desc: "CRUD endpointlarini DRF ViewSet'lar bilan qurish",
      submitType: 'multi', maxScore: 80, estimate: 120, status: 'published', visibility: 'public',
      dueDate: isloh_asDayShift(7), attempts: 2,
      cover: 'linear-gradient(135deg,#0EA5E9,#0369A1)', icon: 'bi-file-earmark-code-fill',
      createdAt: isloh_asDayShift(-15), updatedAt: isloh_asDayShift(-5)
    },
    {
      id: 'as-sql-optimization', courseId: 'postgresql-complete-guide', title: 'SQL query optimizatsiyasi',
      desc: "Sekin ishlaydigan so'rovlarni EXPLAIN yordamida tahlil qilish",
      submitType: 'text', maxScore: 50, estimate: 60, status: 'published', visibility: 'public',
      dueDate: isloh_asDayShift(-2), attempts: 1,
      cover: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', icon: 'bi-file-earmark-text-fill',
      createdAt: isloh_asDayShift(-12), updatedAt: isloh_asDayShift(-4)
    },
    {
      id: 'as-model-migrations', courseId: 'py-101', title: 'Modellar migratsiyasi',
      desc: 'Mavjud bazani buzsiz migratsiya qilish',
      submitType: 'file', maxScore: 100, estimate: 60, status: 'published', visibility: 'public',
      dueDate: isloh_asDayShift(-6), attempts: 1,
      cover: 'linear-gradient(135deg,#059669,#10B981)', icon: 'bi-file-earmark-check-fill',
      createdAt: isloh_asDayShift(-30), updatedAt: isloh_asDayShift(-8)
    },
    {
      id: 'as-serializers', courseId: 'django-rest-masterclass', title: 'Serializers amaliyoti',
      desc: 'Nested serializer va validatsiya',
      submitType: 'file', maxScore: 100, estimate: 75, status: 'published', visibility: 'public',
      dueDate: isloh_asDayShift(-3), attempts: 1,
      cover: 'linear-gradient(135deg,#0F766E,#14B8A6)', icon: 'bi-file-earmark-check-fill',
      createdAt: isloh_asDayShift(-25), updatedAt: isloh_asDayShift(-7)
    },
    {
      id: 'as-final-project', courseId: 'py-101', title: "Yakuniy loyiha — kichik REST servis",
      desc: "To'liq CRUD servisini noldan qurish",
      submitType: 'file', maxScore: 150, estimate: 300, status: 'draft', visibility: 'hidden',
      dueDate: isloh_asDayShift(14), attempts: 1,
      cover: 'linear-gradient(135deg,#F97316,#EA580C)', icon: 'bi-file-earmark-zip-fill',
      createdAt: isloh_asDayShift(-6), updatedAt: isloh_asDayShift(-3)
    },
    {
      id: 'as-write-tests', courseId: 'py-101', title: 'Testlar yozish (pytest)',
      desc: "Modellar uchun birlik testlari",
      submitType: 'file', maxScore: 60, estimate: 90, status: 'draft', visibility: 'hidden',
      dueDate: '', attempts: 1,
      cover: 'linear-gradient(135deg,#9CA3AF,#6B7280)', icon: 'bi-file-earmark-text',
      createdAt: isloh_asDayShift(-1), updatedAt: isloh_asDayShift(0)
    }
  ];
}

/* Talaba yozuvlari js/chat-store.js va students.html dagi ID'lar bilan bir
   xil (`std-001`, `s-javohir` ...) — "Xabar yozish" havolasi keyinchalik
   aynan shu talaba bilan suhbatni ocha olishi uchun. */
function isloh_submissionSeed() {
  return [
    { id: 'sub-1', assignmentId: 'as-django-models',  studentId: 'std-001',   studentName: 'Samar Mirzayev',   submittedAt: isloh_asHoursAgo(2),   score: null, feedback: '' },
    { id: 'sub-2', assignmentId: 'as-rest-endpoints', studentId: 's-javohir', studentName: 'Javohir Rasimov',  submittedAt: isloh_asHoursAgo(5),   score: null, feedback: '' },
    { id: 'sub-3', assignmentId: 'as-sql-optimization', studentId: 's-bekzod', studentName: 'Bekzod Odilov',   submittedAt: isloh_asHoursAgo(20),  score: null, feedback: '' },
    { id: 'sub-4', assignmentId: 'as-model-migrations', studentId: 's-alisher', studentName: 'Alisher Karimov', submittedAt: isloh_asHoursAgo(30),  score: 95,   feedback: "Modellar toza, migratsiyalar xatosiz. Izohlarni biroz ko'paytiring." },
    { id: 'sub-5', assignmentId: 'as-serializers',    studentId: 's-nodira',  studentName: 'Nodira Yusupova',  submittedAt: isloh_asHoursAgo(52),  score: 88,   feedback: 'Nested serializer yaxshi ishlangan, validatsiya qismi yetishmaydi.' },
    { id: 'sub-6', assignmentId: 'as-django-models',  studentId: 's-sardor',  studentName: 'Sardor Aliyev',    submittedAt: isloh_asHoursAgo(26),  score: null, feedback: '' }
  ];
}

/* --- Do'kon (topshiriq loyihalari) ---------------------------------------- */

function isloh_asReadJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function isloh_asWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_normalizeAssignment(assignment) {
  const merged = Object.assign({}, ISLOH_ASSIGNMENT_DEFAULTS, assignment || {});
  merged.rubric = Array.isArray(merged.rubric) ? merged.rubric : [];
  merged.fileTypes = Array.isArray(merged.fileTypes) ? merged.fileTypes : [];
  return merged;
}

function isloh_getAssignments() {
  const stored = isloh_asReadJson(ISLOH_ASSIGNMENTS_KEY);
  if (Array.isArray(stored)) return stored.map(isloh_normalizeAssignment);

  const seed = isloh_assignmentSeed().map(isloh_normalizeAssignment);
  isloh_asWriteJson(ISLOH_ASSIGNMENTS_KEY, seed);
  return seed;
}

function isloh_getAssignment(id) {
  if (!id) return null;
  return isloh_getAssignments().find((a) => a.id === id) || null;
}

/* Bitta kursning topshiriqlari — builder sahifasi shu ro'yxatni chizadi. */
function isloh_getCourseAssignments(courseId) {
  if (!courseId) return isloh_getAssignments();
  return isloh_getAssignments().filter((a) => a.courseId === courseId);
}

function isloh_commitAssignments(list) {
  if (!isloh_asWriteJson(ISLOH_ASSIGNMENTS_KEY, list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:assignments-updated', { detail: list }));
  return true;
}

/* Noyob ID — js/course-store.js dagi isloh_uniqueCourseId bilan bir xil
   mantiq, faqat boshqa to'plam ustida. Modul ulanmagan bo'lsa oddiy
   vaqt tamg'asiga tushiladi. */
function isloh_uniqueAssignmentId(base, list) {
  const taken = list.map((a) => a.id);
  const slug = typeof isloh_slugify === 'function' ? isloh_slugify(base) : '';
  const root = 'as-' + (slug || String(Date.now()));
  if (taken.indexOf(root) === -1) return root;

  let n = 2;
  while (taken.indexOf(root + '-' + n) !== -1) n += 1;
  return root + '-' + n;
}

function isloh_asToday() {
  return new Date().toISOString().slice(0, 10);
}

/* Yaratadi yoki yangilaydi (js/course-store.js dagi isloh_saveCourse kabi). */
function isloh_saveAssignment(patch) {
  const list = isloh_getAssignments();
  const data = patch || {};
  const index = data.id ? list.findIndex((a) => a.id === data.id) : -1;

  if (index === -1) {
    const assignment = isloh_normalizeAssignment(data);
    assignment.id = isloh_uniqueAssignmentId(data.title || 'topshiriq', list);
    assignment.createdAt = isloh_asToday();
    assignment.updatedAt = assignment.createdAt;
    list.push(assignment);
    return isloh_commitAssignments(list) ? assignment : null;
  }

  const updated = isloh_normalizeAssignment(Object.assign({}, list[index], data));
  updated.updatedAt = isloh_asToday();
  list[index] = updated;
  return isloh_commitAssignments(list) ? updated : null;
}

/* Topshiriq o'chirilsa unga tegishli ishlar ham ketadi — aks holda baholash
   navbatida egasi yo'q qatorlar qolib ketardi (o'chirish oynasi ham aynan
   shuni va'da qiladi). */
function isloh_deleteAssignment(id) {
  const list = isloh_getAssignments().filter((a) => a.id !== id);
  const kept = isloh_getSubmissions().filter((s) => s.assignmentId !== id);
  isloh_commitSubmissions(kept);
  return isloh_commitAssignments(list);
}

function isloh_duplicateAssignment(id) {
  const list = isloh_getAssignments();
  const source = list.find((a) => a.id === id);
  if (!source) return null;

  const copy = isloh_normalizeAssignment(JSON.parse(JSON.stringify(source)));
  copy.title = source.title + ' (nusxa)';
  copy.id = isloh_uniqueAssignmentId(copy.title, list);
  copy.status = 'draft';
  copy.visibility = 'hidden';
  copy.createdAt = isloh_asToday();
  copy.updatedAt = copy.createdAt;

  list.splice(list.indexOf(source) + 1, 0, copy);
  return isloh_commitAssignments(list) ? copy : null;
}

function isloh_setAssignmentStatus(id, status) {
  if (!ISLOH_ASSIGNMENT_STATUSES[status]) return null;
  return isloh_saveAssignment({ id: id, status: status });
}

/* --- Do'kon (topshirilgan ishlar) ----------------------------------------- */

function isloh_getSubmissions() {
  const stored = isloh_asReadJson(ISLOH_SUBMISSIONS_KEY);
  if (Array.isArray(stored)) return stored;

  const seed = isloh_submissionSeed();
  isloh_asWriteJson(ISLOH_SUBMISSIONS_KEY, seed);
  return seed;
}

function isloh_getSubmission(id) {
  if (!id) return null;
  return isloh_getSubmissions().find((s) => s.id === id) || null;
}

function isloh_commitSubmissions(list) {
  if (!isloh_asWriteJson(ISLOH_SUBMISSIONS_KEY, list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:submissions-updated', { detail: list }));
  return true;
}

/* Baholash: ball va izoh yoziladi, holat esa shundan KELIB CHIQADI. */
function isloh_gradeSubmission(id, score, feedback) {
  const list = isloh_getSubmissions();
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) return null;

  list[index] = Object.assign({}, list[index], {
    score: score === null || score === '' ? null : Number(score),
    feedback: feedback || '',
    gradedAt: new Date().toISOString()
  });
  return isloh_commitSubmissions(list) ? list[index] : null;
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

/* Topshiriqning muddati — sana va vaqtdan bitta nuqta. Muddat belgilanmagan
   bo'lsa null: bunday topshiriqqa hech qachon "kechikkan" deyilmaydi. */
function isloh_assignmentDueAt(assignment) {
  if (!assignment || !assignment.dueDate) return null;
  const at = new Date(assignment.dueDate + 'T' + (assignment.dueTime || '23:59'));
  return isNaN(at.getTime()) ? null : at;
}

function isloh_submissionIsLate(submission, assignment) {
  const due = isloh_assignmentDueAt(assignment);
  if (!due || !submission || !submission.submittedAt) return false;
  return new Date(submission.submittedAt).getTime() > due.getTime();
}

/* Yagona holat manbai — sahifalar o'z shartini yozmasin. */
function isloh_submissionState(submission, assignment) {
  if (submission && submission.score !== null && submission.score !== undefined) return 'reviewed';
  return isloh_submissionIsLate(submission, assignment) ? 'late' : 'pending';
}

/* Baholash navbati uchun to'liq qator: ish + topshiriq + kurs bir joyda.
   Topshirig'i o'chirilgan ish ro'yxatga tushmaydi. */
function isloh_getSubmissionQueue() {
  const assignments = {};
  isloh_getAssignments().forEach((a) => { assignments[a.id] = a; });

  return isloh_getSubmissions()
    .map((submission) => {
      const assignment = assignments[submission.assignmentId];
      if (!assignment) return null;

      const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(assignment.courseId) : null;
      return {
        submission: submission,
        assignment: assignment,
        courseTitle: course ? course.title : assignment.courseId,
        state: isloh_submissionState(submission, assignment)
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.submission.submittedAt).localeCompare(String(a.submission.submittedAt)));
}

/* Baholash navbati statistikasi — assignments.html dagi 4 ta kartochka. */
function isloh_submissionStats() {
  const queue = isloh_getSubmissionQueue();
  const graded = queue.filter((row) => row.state === 'reviewed');

  /* O'rtacha ball FOIZda: topshiriqlarning maksimal balli har xil (50, 80,
     100, 150), shuning uchun xom ballarni o'rtachalash noto'g'ri bo'lardi. */
  const percents = graded
    .map((row) => (row.assignment.maxScore ? (row.submission.score / row.assignment.maxScore) * 100 : 0));

  return {
    pending: queue.filter((row) => row.state === 'pending').length,
    reviewed: graded.length,
    late: queue.filter((row) => row.state === 'late').length,
    avgScore: percents.length ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length) : 0
  };
}

/* Builder sahifasi statistikasi. "Muddati yaqin" — keyingi 7 kun ichida
   muddati tugaydigan nashr etilgan topshiriqlar. */
const ISLOH_ASSIGNMENT_SOON_DAYS = 7;

function isloh_assignmentStats(courseId) {
  const list = isloh_getCourseAssignments(courseId);
  const now = Date.now();
  const horizon = now + ISLOH_ASSIGNMENT_SOON_DAYS * 86400000;

  return {
    total: list.length,
    published: list.filter((a) => a.status === 'published').length,
    draft: list.filter((a) => a.status === 'draft').length,
    soon: list.filter((a) => {
      if (a.status !== 'published') return false;
      const due = isloh_assignmentDueAt(a);
      return due && due.getTime() >= now && due.getTime() <= horizon;
    }).length
  };
}

/* Muddat yorlig'i: "14-avgust, 23:59" yoki "Belgilanmagan". Sana formati
   js/datetime.js zimmasida (til va mintaqa sozlamasiga bo'ysunadi). */
function isloh_assignmentDueLabel(assignment) {
  const due = isloh_assignmentDueAt(assignment);
  if (!due) return 'Belgilanmagan';
  return typeof isloh_dtDayTime === 'function' ? isloh_dtDayTime(due.toISOString()) : assignment.dueDate;
}

function isloh_submitTypeMeta(type) {
  return ISLOH_SUBMIT_TYPES[type] || ISLOH_SUBMIT_TYPES.file;
}
