/* ==========================================================================
   ISLOH — Testlar do'koni  (`isloh_quizzes`)

   Test SAVOL MATNINI saqlamaydi — u faqat savollar bankidagi id'lar
   ro'yxatini (`questionIds`) va o'z sozlamalarini yuritadi. Savollarning
   o'zi js/question-store.js da, umumiy havzada.

   NEGA SHUNDAY: bitta savol bir nechta testda ishlatilishi mumkin (savollar
   bazasi sahifasidagi "Ishlatilgan: N testda" ustuni aynan shu haqda).
   Agar har bir test o'z nusxasini saqlasa, savol tahrirlanganda faqat bitta
   joyda yangilanardi va bank raqamlari yolg'on bo'lardi.

   NEGA BU FAYL BOR: shu paytgacha testning O'ZI hech qayerda saqlanmasdi.
   quiz-builder.html dagi 5 ta kartochka HTML ichida yozilgan edi, "Test
   yaratish" <template>dan nusxa olib grid'ga qo'shardi (F5 — yo'q), test
   muharriri esa qaysi test ochilganini umuman bilmasdi: barcha
   kartochkalar parametrsiz `quiz-editor.html` ga olib borardi.

   Naqsh js/assignment-store.js bilan bir xil (2-bosqich): standart sxema +
   demo ma'lumot + qisman yangilash + `isloh:quizzes-updated` hodisasi.
   ========================================================================== */

const ISLOH_QUIZZES_KEY = 'isloh_quizzes';

const ISLOH_QUIZ_STATUSES = {
  draft:     { label: 'Qoralama',      badge: 'badge-warning' },
  published: { label: 'Nashr etilgan', badge: 'badge-green' }
};

const ISLOH_QUIZ_DEFAULTS = {
  id: '',
  courseId: '',
  title: '',
  desc: '',
  instructions: '',
  difficulty: 'medium',      // easy | medium | hard (js/question-store.js jadvali)
  status: 'draft',           // draft | published
  timeLimit: true,
  duration: 15,              // daqiqa
  limitAttempts: true,
  attempts: 2,
  scoringMode: 'last',       // last | best | average
  passingScore: 70,          // %
  showAnswers: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  randomSubset: false,
  subsetSize: 5,
  certificate: false,
  certName: '',
  notifySubmit: false,
  notifyFail: false,
  questionIds: [],
  cover: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)',
  icon: 'bi-patch-question-fill',
  createdAt: '',
  updatedAt: ''
};

/* Demo testlar — ilgari quiz-builder.html markupiga qo'lda yozilgan 5 ta
   kartochka. Savol sonlari endi qo'lda yozilmaydi: ular `questionIds`
   uzunligidan hisoblanadi, shuning uchun kartochka va muharrir hech qachon
   turli raqam ko'rsatmaydi. */
function isloh_quizSeed() {
  const shift = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: 'qz-module-1-final', courseId: 'py-101', title: '1-modul yakuniy testi',
      desc: '1-modulni yakunlagach bilimni tekshirish uchun test.',
      instructions: 'Har bir savolga diqqat bilan javob bering. Vaqt tugagach test avtomatik yakunlanadi.',
      difficulty: 'easy', status: 'published',
      duration: 15, attempts: 2, passingScore: 70, showAnswers: true,
      questionIds: ['q-def-keyword', 'q-mutable-types', 'q-interpreted', 'q-print-usage',
                    'q-docker-benefit', 'q-git-commands', 'q-docker-steps', 'q-list-index'],
      cover: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)',
      createdAt: shift(-40), updatedAt: shift(-2)
    },
    {
      id: 'qz-python-basics', courseId: 'py-101', title: "Python asoslari — bilim testi",
      desc: "Python sintaksisi va asosiy turlar bo'yicha nazorat.",
      difficulty: 'medium', status: 'published',
      duration: 25, attempts: 3, passingScore: 75, showAnswers: true, shuffleQuestions: true,
      questionIds: ['q-def-keyword', 'q-mutable-types', 'q-interpreted', 'q-print-usage', 'q-list-index'],
      cover: 'linear-gradient(135deg,#0EA5E9,#0369A1)',
      createdAt: shift(-35), updatedAt: shift(-6)
    },
    {
      id: 'qz-django-orm', courseId: 'django-rest-masterclass', title: 'Django ORM chuqurlashtirilgan test',
      desc: "QuerySet, optimizatsiya va bog'lanishlar.",
      difficulty: 'hard', status: 'published',
      duration: 30, attempts: 1, passingScore: 80, showAnswers: false,
      questionIds: ['q-orm-methods', 'q-queryset-lazy', 'q-select-related'],
      cover: 'linear-gradient(135deg,#0F766E,#14B8A6)',
      createdAt: shift(-28), updatedAt: shift(-9)
    },
    {
      id: 'qz-devops-midterm', courseId: 'py-101', title: 'Deployment va DevOps oraliq nazorat',
      desc: "Docker va CI/CD bo'yicha oraliq nazorat.",
      difficulty: 'medium', status: 'draft',
      timeLimit: false, limitAttempts: false, passingScore: 60, showAnswers: true,
      questionIds: ['q-docker-benefit', 'q-git-commands', 'q-docker-steps'],
      cover: 'linear-gradient(135deg,#F97316,#EA580C)',
      createdAt: shift(-10), updatedAt: shift(-1)
    },
    {
      id: 'qz-final-exam', courseId: 'py-101', title: 'Yakuniy kurs imtihoni',
      desc: 'Butun kurs bo\'yicha yakuniy imtihon.',
      difficulty: 'hard', status: 'draft',
      duration: 45, attempts: 1, passingScore: 85, showAnswers: false,
      certificate: true, certName: 'Python Backend sertifikati',
      randomSubset: true, subsetSize: 8,
      questionIds: ['q-def-keyword', 'q-mutable-types', 'q-docker-benefit', 'q-git-commands',
                    'q-docker-steps', 'q-list-index', 'q-index-purpose', 'q-normal-forms'],
      cover: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)',
      createdAt: shift(-5), updatedAt: shift(0)
    }
  ];
}

/* --- Do'kon --------------------------------------------------------------- */

function isloh_normalizeQuiz(quiz) {
  const merged = Object.assign({}, ISLOH_QUIZ_DEFAULTS, quiz || {});
  merged.questionIds = Array.isArray(merged.questionIds) ? merged.questionIds : [];
  return merged;
}

function isloh_getQuizzes() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_QUIZZES_KEY)); } catch (e) { stored = null; }
  if (Array.isArray(stored)) return stored.map(isloh_normalizeQuiz);

  const seed = isloh_quizSeed().map(isloh_normalizeQuiz);
  isloh_persistQuizzes(seed);
  return seed;
}

function isloh_getQuiz(id) {
  if (!id) return null;
  return isloh_getQuizzes().find((q) => q.id === id) || null;
}

function isloh_getCourseQuizzes(courseId) {
  if (!courseId) return isloh_getQuizzes();
  return isloh_getQuizzes().filter((q) => q.courseId === courseId);
}

function isloh_persistQuizzes(list) {
  try {
    localStorage.setItem(ISLOH_QUIZZES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_commitQuizzes(list) {
  if (!isloh_persistQuizzes(list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:quizzes-updated', { detail: list }));
  return true;
}

function isloh_uniqueQuizId(base, list) {
  const taken = list.map((q) => q.id);
  const slug = typeof isloh_slugify === 'function' ? isloh_slugify(base) : '';
  const root = 'qz-' + (slug || String(Date.now())).slice(0, 40);
  if (taken.indexOf(root) === -1) return root;

  let n = 2;
  while (taken.indexOf(root + '-' + n) !== -1) n += 1;
  return root + '-' + n;
}

function isloh_saveQuiz(patch) {
  const list = isloh_getQuizzes();
  const data = patch || {};
  const index = data.id ? list.findIndex((q) => q.id === data.id) : -1;
  const today = new Date().toISOString().slice(0, 10);

  if (index === -1) {
    const quiz = isloh_normalizeQuiz(data);
    quiz.id = isloh_uniqueQuizId(data.title || 'test', list);
    quiz.createdAt = today;
    quiz.updatedAt = today;
    list.push(quiz);
    return isloh_commitQuizzes(list) ? quiz : null;
  }

  const updated = isloh_normalizeQuiz(Object.assign({}, list[index], data));
  updated.updatedAt = today;
  list[index] = updated;
  return isloh_commitQuizzes(list) ? updated : null;
}

/* Test o'chirilganda savollar BANKDA QOLADI — ular boshqa testlarda ham
   ishlatilgan bo'lishi mumkin. Shuning uchun tasdiq oynasi matni ham
   "test o'chiriladi" deydi, "savollar bilan birga" emas. */
function isloh_deleteQuiz(id) {
  return isloh_commitQuizzes(isloh_getQuizzes().filter((q) => q.id !== id));
}

function isloh_duplicateQuiz(id) {
  const list = isloh_getQuizzes();
  const source = list.find((q) => q.id === id);
  if (!source) return null;

  const copy = isloh_normalizeQuiz(JSON.parse(JSON.stringify(source)));
  copy.title = source.title + ' (nusxa)';
  copy.id = isloh_uniqueQuizId(copy.title, list);
  copy.status = 'draft';
  copy.createdAt = new Date().toISOString().slice(0, 10);
  copy.updatedAt = copy.createdAt;

  list.splice(list.indexOf(source) + 1, 0, copy);
  return isloh_commitQuizzes(list) ? copy : null;
}

function isloh_setQuizStatus(id, status) {
  if (!ISLOH_QUIZ_STATUSES[status]) return null;
  return isloh_saveQuiz({ id: id, status: status });
}

/* --- Testdagi savollar ----------------------------------------------------
   Bu yerda faqat ID'lar ro'yxati boshqariladi; savolning o'zi bankda. */

function isloh_addQuestionToQuiz(quizId, questionId) {
  const quiz = isloh_getQuiz(quizId);
  if (!quiz || quiz.questionIds.indexOf(questionId) !== -1) return null;
  return isloh_saveQuiz({ id: quizId, questionIds: quiz.questionIds.concat(questionId) });
}

function isloh_removeQuestionFromQuiz(quizId, questionId) {
  const quiz = isloh_getQuiz(quizId);
  if (!quiz) return null;
  return isloh_saveQuiz({ id: quizId, questionIds: quiz.questionIds.filter((id) => id !== questionId) });
}

/* Savol bankdan butunlay o'chirilganda chaqiriladi (js/question-store.js) —
   uni ishlatgan barcha testlardan havola olib tashlanadi. */
function isloh_removeQuestionFromQuizzes(questionId) {
  const list = isloh_getQuizzes().map((quiz) => {
    if (quiz.questionIds.indexOf(questionId) === -1) return quiz;
    return Object.assign({}, quiz, { questionIds: quiz.questionIds.filter((id) => id !== questionId) });
  });
  return isloh_commitQuizzes(list);
}

function isloh_reorderQuizQuestions(quizId, ids) {
  const quiz = isloh_getQuiz(quizId);
  if (!quiz) return null;

  /* Ro'yxatda ko'rinmagan savol (masalan filtr yashirgan) yo'qolib
     qolmasin — js/content-store.js dagi tartiblash bilan bir xil qoida. */
  const ordered = ids.filter((id) => quiz.questionIds.indexOf(id) !== -1);
  quiz.questionIds.forEach((id) => { if (ordered.indexOf(id) === -1) ordered.push(id); });
  return isloh_saveQuiz({ id: quizId, questionIds: ordered });
}

/* Testdagi savollar — bank tartibida emas, TESTDAGI tartibda. Bankdan
   o'chirilgan id'lar tushib qoladi. */
function isloh_getQuizQuestions(quizId) {
  const quiz = isloh_getQuiz(quizId);
  if (!quiz) return [];

  const bank = {};
  isloh_getQuestions().forEach((q) => { bank[q.id] = q; });
  return quiz.questionIds.map((id) => bank[id]).filter(Boolean);
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

function isloh_quizQuestionCount(quiz) {
  return (quiz.questionIds || []).length;
}

/* Testning jami balli savollar ballaridan yig'iladi — markupda qo'lda
   yozilgan "jami" raqami endi yo'q. */
function isloh_quizTotalPoints(quiz) {
  return isloh_getQuizQuestions(quiz.id).reduce((sum, q) => sum + (q.points || 0), 0);
}

function isloh_quizDurationLabel(quiz) {
  return quiz.timeLimit ? quiz.duration + ' daq' : 'Cheklanmagan';
}

function isloh_quizAttemptsLabel(quiz) {
  return quiz.limitAttempts ? quiz.attempts + ' urinish' : 'Cheksiz';
}

function isloh_quizStats(courseId) {
  const list = isloh_getCourseQuizzes(courseId);
  return {
    total: list.length,
    published: list.filter((q) => q.status === 'published').length,
    draft: list.filter((q) => q.status === 'draft').length,
    /* "Jami savollar" — takrorlanmaydigan savollar soni: bir savol uch
       testda tursa ham bir marta sanaladi. */
    questions: new Set(list.reduce((all, q) => all.concat(q.questionIds || []), [])).size
  };
}
