/* ==========================================================================
   ISLOH — Savollar do'koni
   #question-editor-modal ikkita sahifada ishlatiladi (savollar bazasi va
   test muharriri). Ilgari "Saqlash" tugmasi faqat modalni yopib "Savol
   saqlandi" deb toast chiqarardi — savol na ro'yxatga qo'shilardi, na
   biror joyga yozilardi.

   Endi savol `isloh_questions` do'koniga tushadi va ikkala sahifadagi
   ro'yxatga ham qo'shiladi. Do'kon sahifa bo'yicha emas, umumiy: savollar
   bazasiga qo'shilgan savol test muharririda ham ko'rinadi.

   Do'kon shakli: [{ id, title, type, points, difficulty, category }]
   ========================================================================== */

const ISLOH_QUESTIONS_KEY = 'isloh_questions';

/* Savol turi -> yorliq, ikonka va muqova gradienti. Kalitlar markupdagi
   `#qe-type` option qiymatlari bilan bir xil.

   Bu jadval ilgari js/quiz-editor.js ichida edi, lekin savollar bazasi
   sahifasi quiz-editor.js ni yuklamaydi — shuning uchun u shu quyi
   qatlamdagi modulga ko'chirildi va endi ikkala sahifa ham bitta manbadan
   foydalanadi (CLAUDE.md §2). */
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

function isloh_getQuestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_QUESTIONS_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (e) {
    return [];
  }
}

function isloh_addQuestion(question) {
  const list = isloh_getQuestions();
  list.push(question);
  try {
    localStorage.setItem(ISLOH_QUESTIONS_KEY, JSON.stringify(list));
    return question;
  } catch (e) {
    return null;
  }
}

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

/* --- Ro'yxatga chizish ----------------------------------------------------
   Ikki sahifa, ikki xil markup — lekin bitta ma'lumot manbai.            */

/* Savollar bazasi: jadval qatori */
function isloh_questionRowHtml(q) {
  const type = isloh_questionTypeMeta(q.type);
  const diff = isloh_difficultyMeta(q.difficulty);
  return `<tr data-filter-item data-category="${q.category}" data-type="${q.type}" data-difficulty="${q.difficulty}" data-status="active" data-filter-text="${q.title}">
    <td><input type="checkbox" data-select-item aria-label="Savolni tanlash"></td>
    <td><div class="cell-title filter-title">${q.title}</div></td>
    <td><span class="badge badge-violet question-type-badge"><i class="bi ${type.icon}"></i> ${type.label}</span></td>
    <td>${q.category}</td>
    <td><span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span></td>
    <td>—</td>
    <td>0 testda</td>
    <td>
      <div class="dropdown">
        <button class="row-action" aria-label="Amallar"><i class="bi bi-three-dots"></i></button>
        <div class="dropdown-menu">
          <div class="dropdown-item" data-action="duplicate-bank-question"><i class="bi bi-copy"></i> Nusxalash</div>
          <div class="dropdown-item" data-action="archive-bank-question"><i class="bi bi-archive"></i> Arxivlash</div>
          <div class="dropdown-item text-danger" data-action="delete-bank-question"><i class="bi bi-trash"></i> O'chirish</div>
        </div>
      </div>
    </td>
  </tr>`;
}

/* Test muharriri: tortib ko'chiriladigan kartochka */
function isloh_questionCardHtml(q, number) {
  const type = isloh_questionTypeMeta(q.type);
  const diff = isloh_difficultyMeta(q.difficulty);
  return `<div class="lesson-item question-card" data-filter-item data-type="${q.type}" data-filter-text="${q.title}" draggable="true" data-sortable-item>
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
        <div class="dropdown-menu">
          <div class="dropdown-item" data-action="duplicate-question"><i class="bi bi-copy"></i> Nusxalash</div>
          <div class="dropdown-item text-danger" data-action="delete-question"><i class="bi bi-trash"></i> O'chirish</div>
        </div>
      </div>
    </div>
  </div>`;
}

/* Savolni sahifadagi ro'yxatga qo'shadi (qaysi ro'yxat borligiga qarab). */
function isloh_appendQuestionToList(q) {
  const table = document.querySelector('[data-bank-table] tbody');
  if (table) {
    table.insertAdjacentHTML('beforeend', isloh_questionRowHtml(q));
    return true;
  }

  const list = document.querySelector('[data-questions-list]');
  if (list) {
    const number = list.querySelectorAll('.question-card').length + 1;
    list.insertAdjacentHTML('beforeend', isloh_questionCardHtml(q, number));
    isloh_syncQuestionCount();
    return true;
  }
  return false;
}

/* "Savollar soni" ko'rsatkichi ro'yxat bilan bir joyda tursin. */
function isloh_syncQuestionCount() {
  const out = document.querySelector('[data-question-count]');
  const list = document.querySelector('[data-questions-list]');
  if (out && list) out.textContent = list.querySelectorAll('.question-card').length;
}

/* Sahifa ochilganda oldin qo'shilgan savollarni tiklaydi. */
function isloh_restoreQuestions() {
  if (!document.querySelector('[data-bank-table] tbody') && !document.querySelector('[data-questions-list]')) return;
  isloh_getQuestions().forEach(isloh_appendQuestionToList);
}

document.addEventListener('DOMContentLoaded', isloh_restoreQuestions);
