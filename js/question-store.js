/* ==========================================================================
   ISLOH — Savollar banki do'koni  (`isloh_questions`)

   Bank — UMUMIY havza: savol bir marta yoziladi va bir nechta testda
   ishlatilishi mumkin. Testning o'zi savol MATNINI saqlamaydi, faqat
   `questionIds` ro'yxatini yuritadi (js/quiz-store.js).

   NEGA QAYTA YOZILDI: avvalgi versiya faqat `isloh_addQuestion()` ni
   bilardi va sahifa ochilganda saqlangan savollarni MARKUPDAGI qattiq
   yozilgan qatorlar USTIGA qo'shib qo'yardi. Natijada:
     - savollar bazasidagi 5 qator hech qachon o'chmasdi (ular HTML edi);
     - test muharririda qo'shilgan savol BARCHA testlarda ko'rinardi,
       chunki savol qaysi testga tegishli ekani hech qayerda yozilmasdi;
     - tahrirlash va o'chirish faqat DOM'da bo'lardi.

   Do'kon shakli:
     [{ id, title, type, points, difficulty, category, tags,
        instructions, explanation, hint, status, createdAt, updatedAt }]
   ========================================================================== */

const ISLOH_QUESTIONS_KEY = 'isloh_questions';

/* Savol turi -> yorliq, ikonka va muqova gradienti. Kalitlar markupdagi
   `#qe-type` option qiymatlari va savollar bazasidagi filtr chiplari bilan
   bir xil.

   Bu jadval ilgari js/quiz-editor.js ichida edi, lekin savollar bazasi
   sahifasi quiz-editor.js ni yuklamaydi — shuning uchun u shu quyi
   qatlamdagi modulga ko'chirilgan (CLAUDE.md §2). */
const ISLOH_QUESTION_TYPE_META = {
  single:  { icon: 'bi-ui-radios',         bg: 'linear-gradient(135deg,#6C5DD3,#4B3FA8)', label: 'Bitta tanlov' },
  multi:   { icon: 'bi-ui-checks',         bg: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: "Ko'p tanlov" },
  boolean: { icon: 'bi-toggle2-on',        bg: 'linear-gradient(135deg,#1FAE5E,#0F7A3F)', label: "To'g'ri / Noto'g'ri" },
  short:   { icon: 'bi-input-cursor-text', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', label: 'Qisqa javob' },
  long:    { icon: 'bi-textarea-t',        bg: 'linear-gradient(135deg,#EA580C,#C2410C)', label: 'Batafsil javob' },
  match:   { icon: 'bi-arrow-left-right',  bg: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', label: 'Moslashtirish' },
  order:   { icon: 'bi-sort-numeric-down', bg: 'linear-gradient(135deg,#0F766E,#14B8A6)', label: 'Tartiblash' },
  blank:   { icon: 'bi-textarea-resize',   bg: 'linear-gradient(135deg,#374151,#1C1B29)', label: "Bo'sh joyni to'ldirish" }
};

const ISLOH_DIFFICULTY_META = {
  easy:   { label: 'Oson',    badge: 'badge-green',   dot: 'easy' },
  medium: { label: "O'rta",   badge: 'badge-warning', dot: 'medium' },
  hard:   { label: 'Qiyin',   badge: 'badge-danger',  dot: 'hard' }
};

/* Kategoriya do'konda SLUG sifatida yotadi (filtr chiplari shu qiymat
   bo'yicha ishlaydi), jadvalda esa o'qiladigan nomi ko'rsatiladi. */
const ISLOH_QUESTION_CATEGORIES = {
  python: 'Python',
  django: 'Django',
  devops: 'DevOps',
  db: "Ma'lumotlar bazasi",
  umumiy: 'Umumiy'
};

const ISLOH_QUESTION_DEFAULTS = {
  id: '',
  title: '',
  type: 'single',
  points: 5,
  difficulty: 'easy',
  category: 'umumiy',
  tags: [],
  instructions: '',
  explanation: '',
  hint: '',
  status: 'active',   // active | archived
  createdAt: '',
  updatedAt: ''
};

/* Demo savollar — ilgari question-bank.html va quiz-editor.html markupiga
   qo'lda yozilgan savollar. Endi ular bitta joyda va ikkala sahifa ham
   shu ro'yxatdan chiziladi. */
const ISLOH_QUESTION_SEED = [
  { id: 'q-def-keyword',    title: "Python'da qaysi kalit so'z funksiya e'lon qiladi?", type: 'single',  points: 5,  difficulty: 'easy',   category: 'python', tags: ['sintaksis', 'asoslar'] },
  { id: 'q-mutable-types',  title: "Quyidagilardan qaysilari o'zgaruvchan (mutable) turlar?", type: 'multi', points: 8, difficulty: 'medium', category: 'python', tags: ['turlar'] },
  { id: 'q-interpreted',    title: 'Python interpretatsiya qilinadigan til hisoblanadi', type: 'boolean', points: 3,  difficulty: 'easy',   category: 'python', tags: ['nazariya'] },
  { id: 'q-print-usage',    title: 'print() funksiyasi nima uchun ishlatiladi?', type: 'short',   points: 5,  difficulty: 'easy',   category: 'python', tags: ['asoslar'] },
  { id: 'q-docker-benefit', title: 'Docker konteynerining afzalliklarini tushuntiring', type: 'long', points: 10, difficulty: 'hard',   category: 'devops', tags: ['docker'] },
  { id: 'q-git-commands',   title: "Har bir Git buyrug'ini tavsifiga moslashtiring", type: 'match',   points: 8,  difficulty: 'medium', category: 'devops', tags: ['git'] },
  { id: 'q-docker-steps',   title: "Docker image yaratish bosqichlarini to'g'ri tartibda joylashtiring", type: 'order', points: 8, difficulty: 'medium', category: 'devops', tags: ['docker', 'ci'] },
  { id: 'q-list-index',     title: "Python'da ro'yxat elementiga ___ orqali murojaat qilinadi", type: 'blank', points: 5, difficulty: 'easy', category: 'python', tags: ['ro\'yxatlar'] },
  { id: 'q-orm-methods',    title: 'Django ORM metodlarini vazifasiga moslashtiring', type: 'match',   points: 8,  difficulty: 'hard',   category: 'django', tags: ['orm'] },
  { id: 'q-queryset-lazy',  title: 'Django QuerySet lazy (dangasa) hisoblanadi', type: 'boolean', points: 3,  difficulty: 'medium', category: 'django', tags: ['orm'] },
  { id: 'q-select-related', title: 'select_related va prefetch_related farqi nimada?', type: 'long',    points: 10, difficulty: 'hard',   category: 'django', tags: ['orm', 'optimizatsiya'] },
  { id: 'q-index-purpose',  title: "Indeks nima uchun so'rovni tezlashtiradi?", type: 'short',   points: 5,  difficulty: 'medium', category: 'db',     tags: ['indeks'] },
  { id: 'q-normal-forms',   title: 'Quyidagilardan qaysilari normal shakl talablari?', type: 'multi', points: 8,  difficulty: 'hard',   category: 'db',     tags: ['normalizatsiya'] },
  { id: 'q-old-jquery',     title: "jQuery'da $(document).ready() nima qiladi?", type: 'single', points: 3,  difficulty: 'easy',   category: 'umumiy', tags: ['eski'], status: 'archived' }
];

/* --- Do'kon --------------------------------------------------------------- */

function isloh_normalizeQuestion(question) {
  const merged = Object.assign({}, ISLOH_QUESTION_DEFAULTS, question || {});
  merged.tags = Array.isArray(merged.tags) ? merged.tags : [];
  return merged;
}

function isloh_getQuestions() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_QUESTIONS_KEY)); } catch (e) { stored = null; }
  if (Array.isArray(stored)) return stored.map(isloh_normalizeQuestion);

  const seed = ISLOH_QUESTION_SEED.map(isloh_normalizeQuestion);
  isloh_persistQuestions(seed);
  return seed;
}

function isloh_getQuestion(id) {
  if (!id) return null;
  return isloh_getQuestions().find((q) => q.id === id) || null;
}

function isloh_persistQuestions(list) {
  try {
    localStorage.setItem(ISLOH_QUESTIONS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_commitQuestions(list) {
  if (!isloh_persistQuestions(list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:questions-updated', { detail: list }));
  return true;
}

function isloh_uniqueQuestionId(base, list) {
  const taken = list.map((q) => q.id);
  const slug = typeof isloh_slugify === 'function' ? isloh_slugify(base) : '';
  const root = 'q-' + (slug || String(Date.now())).slice(0, 40);
  if (taken.indexOf(root) === -1) return root;

  let n = 2;
  while (taken.indexOf(root + '-' + n) !== -1) n += 1;
  return root + '-' + n;
}

/* Yaratadi yoki yangilaydi — js/course-store.js dagi isloh_saveCourse kabi. */
function isloh_saveQuestion(patch) {
  const list = isloh_getQuestions();
  const data = patch || {};
  const index = data.id ? list.findIndex((q) => q.id === data.id) : -1;
  const today = new Date().toISOString().slice(0, 10);

  if (index === -1) {
    const question = isloh_normalizeQuestion(data);
    question.id = isloh_uniqueQuestionId(data.title || 'savol', list);
    question.createdAt = today;
    question.updatedAt = today;
    list.push(question);
    return isloh_commitQuestions(list) ? question : null;
  }

  const updated = isloh_normalizeQuestion(Object.assign({}, list[index], data));
  updated.updatedAt = today;
  list[index] = updated;
  return isloh_commitQuestions(list) ? updated : null;
}

/* Savol o'chirilsa, uni ishlatgan testlardan ham chiqarib tashlanadi —
   aks holda testda mavjud bo'lmagan savolga havola qolib ketardi. */
function isloh_deleteQuestion(id) {
  const list = isloh_getQuestions().filter((q) => q.id !== id);
  if (typeof isloh_removeQuestionFromQuizzes === 'function') isloh_removeQuestionFromQuizzes(id);
  return isloh_commitQuestions(list);
}

function isloh_duplicateQuestion(id) {
  const list = isloh_getQuestions();
  const source = list.find((q) => q.id === id);
  if (!source) return null;

  const copy = isloh_normalizeQuestion(JSON.parse(JSON.stringify(source)));
  copy.title = source.title + ' (nusxa)';
  copy.id = isloh_uniqueQuestionId(copy.title, list);
  copy.status = 'active';
  list.splice(list.indexOf(source) + 1, 0, copy);
  return isloh_commitQuestions(list) ? copy : null;
}

function isloh_setQuestionStatus(id, status) {
  if (status !== 'active' && status !== 'archived') return null;
  return isloh_saveQuestion({ id: id, status: status });
}

/* --- Yordamchilar --------------------------------------------------------- */

function isloh_questionTypeMeta(type) {
  return ISLOH_QUESTION_TYPE_META[type] || ISLOH_QUESTION_TYPE_META.single;
}

/* Kartochka muqovasi turga qarab bo'yaladi — jadval bilan bir xil manba. */
function isloh_questionTypeStyle(type) {
  return ' style="background:' + isloh_questionTypeMeta(type).bg + ';"';
}

function isloh_difficultyMeta(level) {
  return ISLOH_DIFFICULTY_META[level] || ISLOH_DIFFICULTY_META.easy;
}

function isloh_questionCategoryLabel(slug) {
  return ISLOH_QUESTION_CATEGORIES[slug] || slug || 'Umumiy';
}

/* Savol nechta testda ishlatilgan — "Ishlatilgan" ustuni uchun. Manba
   js/quiz-store.js; u ulanmagan sahifada 0 qaytadi. */
function isloh_questionUsage(id) {
  if (typeof isloh_getQuizzes !== 'function') return 0;
  return isloh_getQuizzes().filter((quiz) => (quiz.questionIds || []).indexOf(id) !== -1).length;
}

/* Bank statistikasi — savollar bazasidagi 4 ta kartochka. */
function isloh_questionStats() {
  const list = isloh_getQuestions();
  const active = list.filter((q) => q.status === 'active');
  const tags = new Set();
  active.forEach((q) => q.tags.forEach((tag) => tags.add(tag)));

  return {
    total: active.length,
    categories: new Set(active.map((q) => q.category)).size,
    tags: tags.size,
    archived: list.filter((q) => q.status === 'archived').length
  };
}

/* --- Umumiy markup -------------------------------------------------------
   Ikki sahifa, ikki xil ko'rinish — lekin bitta ma'lumot manbai.         */

/* Savollar bazasi: jadval qatori */
function isloh_questionRowHtml(q) {
  const type = isloh_questionTypeMeta(q.type);
  const diff = isloh_difficultyMeta(q.difficulty);
  const archived = q.status === 'archived';
  const usage = isloh_questionUsage(q.id);
  const tags = q.tags.map((tag) => `<span class="chip-demo">${tag}</span>`).join(' ') || '—';

  const statusAction = archived
    ? `<button type="button" class="dropdown-item" data-question-restore="${q.id}"><i class="bi bi-arrow-counterclockwise"></i> Tiklash</button>`
    : `<button type="button" class="dropdown-item" data-question-archive="${q.id}"><i class="bi bi-archive"></i> Arxivlash</button>`;

  return `<tr class="${archived ? 'is-archived' : ''}" data-filter-item data-category="${q.category}" data-type="${q.type}" data-difficulty="${q.difficulty}" data-status="${q.status}" data-filter-text="${q.title}">
    <td><input type="checkbox" data-select-item data-question-id="${q.id}" aria-label="Savolni tanlash"></td>
    <td><div class="cell-title filter-title">${q.title}</div></td>
    <td><span class="badge badge-violet question-type-badge"><i class="bi ${type.icon}"></i> ${type.label}</span></td>
    <td>${isloh_questionCategoryLabel(q.category)}</td>
    <td><span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span></td>
    <td>${tags}</td>
    <td>${usage} testda</td>
    <td>
      <div class="dropdown">
        <button class="row-action" aria-label="Amallar"><i class="bi bi-three-dots"></i></button>
        <div class="dropdown-menu dropdown-menu-right">
          <button type="button" class="dropdown-item" data-question-edit="${q.id}"><i class="bi bi-pencil"></i> Tahrirlash</button>
          <button type="button" class="dropdown-item" data-question-duplicate="${q.id}"><i class="bi bi-copy"></i> Nusxalash</button>
          ${statusAction}
          <button type="button" class="dropdown-item is-danger" data-question-delete="${q.id}"><i class="bi bi-trash"></i> O'chirish</button>
        </div>
      </div>
    </td>
  </tr>`;
}

/* Test muharriri: tortib ko'chiriladigan kartochka */
function isloh_questionCardHtml(q, number) {
  const type = isloh_questionTypeMeta(q.type);
  const diff = isloh_difficultyMeta(q.difficulty);

  /* `data-id` — js/sortable.js tartib o'zgarganda aynan shu atributni
     o'qiydi; `data-question-id` esa tugmalar uchun. */
  return `<div class="lesson-item question-card" data-filter-item data-type="${q.type}" data-id="${q.id}" data-question-id="${q.id}" data-filter-text="${q.title}" draggable="true" data-sortable-item>
    <i class="bi bi-grip-vertical drag-handle" data-drag-handle tabindex="0" role="button" aria-label="Savolni tashish"></i>
    <div class="lesson-type-ic"${isloh_questionTypeStyle(q.type)}><i class="bi ${type.icon}"></i></div>
    <div class="lesson-info">
      <div class="lesson-title filter-title">${q.title}</div>
      <div class="lesson-meta"><span>${type.label}</span><span><i class="bi bi-award"></i> ${q.points} ball</span><span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span></div>
    </div>
    <div class="lesson-badges">
      <span class="badge badge-neutral" data-question-number>${number}</span>
      <div class="dropdown">
        <button class="row-action" aria-label="Savol amallari"><i class="bi bi-three-dots"></i></button>
        <div class="dropdown-menu dropdown-menu-right">
          <button type="button" class="dropdown-item" data-question-edit="${q.id}"><i class="bi bi-pencil"></i> Tahrirlash</button>
          <button type="button" class="dropdown-item" data-question-duplicate="${q.id}"><i class="bi bi-copy"></i> Nusxalash</button>
          <button type="button" class="dropdown-item is-danger" data-quiz-question-remove="${q.id}"><i class="bi bi-x-circle"></i> Testdan chiqarish</button>
        </div>
      </div>
    </div>
  </div>`;
}
