/* ==========================================================================
   ISLOH — Test muharriri (pages/instructor/quiz-editor.html)

   Sahifa `?id=<test>` bilan ochiladi va js/quiz-store.js dagi
   `isloh_quizzes` do'koniga ulanadi. Savollar ro'yxati testning
   `questionIds` tartibida, savol MATNI esa bankdan (js/question-store.js).

   NEGA O'ZGARDI: sahifa qaysi test ochilganini bilmasdi — 8 ta savol va
   barcha sozlamalar markupga qo'lda yozilgan edi. "Savol qo'shish" savolni
   UMUMIY bankka yozardi, lekin uni hech qaysi testga bog'lamasdi, shuning
   uchun yangi savol keyin BARCHA testlarda ko'rinardi. Tartiblash,
   nusxalash va o'chirish faqat DOM'da bo'lardi.

   Saqlash js/unsaved-guard.js dagi almashtiriladigan do'kon nuqtasi orqali
   (`data-unsaved-store="quiz"`) — js/assignment-editor.js bilan bir xil,
   shuning uchun "Saqlanmagan o'zgarishlar" nishoni va "Saqlash" tugmasi
   qayta yozilmadi.

   Markup shartnomasi:
     [data-quiz-field="<nom>"]  → input / textarea / select
     [data-quiz-check="<nom>"]  → switch
     [data-quiz-out="<nom>"]    → faqat ko'rsatish uchun matn
     [data-questions-list]      → savollar ro'yxati (sortable)
     [data-quiz-stat="<nom>"]   → savollar tabidagi 4 ta kartochka
   ========================================================================== */

const ISLOH_QUIZ_TEXT_FIELDS = ['title', 'desc', 'instructions', 'scoringMode', 'certName'];
const ISLOH_QUIZ_NUMBER_FIELDS = ['duration', 'attempts', 'passingScore', 'subsetSize'];
const ISLOH_QUIZ_CHECK_FIELDS = ['timeLimit', 'limitAttempts', 'showAnswers', 'shuffleQuestions',
                                 'shuffleOptions', 'randomSubset', 'certificate', 'notifySubmit', 'notifyFail'];

let isloh_pendingQuestionRemove = null;

function isloh_quizEditorId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function isloh_quizFieldEl(name) {
  return document.querySelector(`[data-quiz-field="${name}"]`);
}

function isloh_quizCheckEl(name) {
  return document.querySelector(`[data-quiz-check="${name}"]`);
}

/* --- Savollar ro'yxati ---------------------------------------------------- */

function isloh_renderQuizQuestions(quiz) {
  const list = document.querySelector('[data-questions-list]');
  if (!list) return;

  const questions = isloh_getQuizQuestions(quiz.id);
  list.innerHTML = questions.length
    ? questions.map((q, i) => isloh_questionCardHtml(q, i + 1)).join('')
    : `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Testda hali savol yo'q — "Savol qo'shish" tugmasi orqali yangi savol yarating yoki bankdan tanlang.</p>`;

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* Savollar tabidagi 4 ta kartochka — hammasi haqiqiy ro'yxatdan. */
function isloh_renderQuizStatsCards(quiz) {
  const values = {
    count: isloh_quizQuestionCount(quiz),
    points: isloh_quizTotalPoints(quiz),
    duration: isloh_quizDurationLabel(quiz),
    passing: quiz.passingScore + '%'
  };
  /* querySelectorAll: "O'tish balli" ikki joyda — savollar tabidagi
     kartochkada va ko'rib chiqish tabidagi ko'rsatkichda. */
  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-quiz-stat="${key}"]`).forEach((el) => { el.textContent = values[key]; });
  });

  /* Ko'rib chiqishdagi chiziq ham o'tish ballini ko'rsatsin — markupda u
     qat'iy 70% edi. */
  const bar = document.querySelector('[data-quiz-passing-bar]');
  if (bar) bar.style.width = Math.min(100, Math.max(0, quiz.passingScore)) + '%';
}

/* --- Ko'rsatiladigan qiymatlar (nishon, ko'rib chiqish tabi) -------------- */

function isloh_renderQuizOutputs(quiz) {
  const questions = isloh_getQuizQuestions(quiz.id);
  const values = {
    title: quiz.title,
    desc: quiz.desc || '—',
    instructions: quiz.instructions || '—',
    summary: [
      isloh_quizQuestionCount(quiz) + ' savol',
      '~' + isloh_quizDurationLabel(quiz),
      isloh_quizTotalPoints(quiz) + ' ball'
    ].join(' · ')
  };

  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-quiz-out="${key}"]`).forEach((el) => { el.textContent = values[key]; });
  });

  /* Ko'rib chiqish tabidagi savollar ro'yxati — ilgari 8 ta <li> qo'lda
     yozilgan edi va savollar o'zgarsa ham o'zgarmasdi. */
  const previewList = document.querySelector('[data-quiz-preview-questions]');
  if (previewList) {
    previewList.innerHTML = questions.length
      ? questions.map((q) => `<li>${q.title} <span class="badge badge-neutral">${isloh_questionTypeMeta(q.type).label}</span></li>`).join('')
      : '<li>Savol yo\'q</li>';
  }

  const badge = document.querySelector('[data-quiz-status-badge]');
  if (badge) {
    const meta = ISLOH_QUIZ_STATUSES[quiz.status] || ISLOH_QUIZ_STATUSES.draft;
    badge.className = 'badge ' + meta.badge;
    badge.textContent = meta.label;
  }

  document.title = quiz.title + " — Testni tahrirlash — Isloh";

  document.querySelectorAll('[data-quiz-back]').forEach((link) => {
    link.href = 'quiz-builder.html?course=' + encodeURIComponent(quiz.courseId);
  });

  /* Qolgan kurs bo'limlari havolalari ham (Kurs tarkibi) — course-store. */
  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(quiz.courseId);
}

/* --- Formani to'ldirish / o'qish ------------------------------------------ */

function isloh_fillQuizForm() {
  const quiz = isloh_getQuiz(isloh_quizEditorId());
  if (!quiz) return 0;

  let filled = 0;
  ISLOH_QUIZ_TEXT_FIELDS.forEach((name) => {
    const el = isloh_quizFieldEl(name);
    if (!el) return;
    el.value = quiz[name] || '';
    filled += 1;
  });

  ISLOH_QUIZ_NUMBER_FIELDS.forEach((name) => {
    const el = isloh_quizFieldEl(name);
    if (!el) return;
    el.value = quiz[name];
    filled += 1;
  });

  ISLOH_QUIZ_CHECK_FIELDS.forEach((name) => {
    const el = isloh_quizCheckEl(name);
    if (!el) return;
    el.checked = !!quiz[name];
    filled += 1;
  });

  /* Qiymatlar JS bilan qo'yilgani uchun `change` otilmaydi — `data-reveals`
     bloklarini qo'lda moslaymiz. */
  if (typeof isloh_syncRevealToggles === 'function') isloh_syncRevealToggles();

  isloh_renderQuizQuestions(quiz);
  isloh_renderQuizStatsCards(quiz);
  isloh_renderQuizOutputs(quiz);
  return filled;
}

/* js/unsaved-guard.js shartnomasi: saqlangan maydonlar soni, xatoda manfiy. */
function isloh_saveQuizForm() {
  const id = isloh_quizEditorId();
  if (!id) return null;

  const data = { id: id };
  let count = 0;

  ISLOH_QUIZ_TEXT_FIELDS.forEach((name) => {
    const el = isloh_quizFieldEl(name);
    if (!el) return;
    data[name] = el.value.trim();
    count += 1;
  });

  ISLOH_QUIZ_NUMBER_FIELDS.forEach((name) => {
    const el = isloh_quizFieldEl(name);
    if (!el || el.value === '') return;
    data[name] = Math.max(0, parseFloat(el.value) || 0);
    count += 1;
  });

  ISLOH_QUIZ_CHECK_FIELDS.forEach((name) => {
    const el = isloh_quizCheckEl(name);
    if (!el) return;
    data[name] = el.checked;
    count += 1;
  });

  const saved = isloh_saveQuiz(data);
  if (!saved) return -1;

  isloh_renderQuizStatsCards(saved);
  isloh_renderQuizOutputs(saved);
  return count;
}

if (typeof isloh_registerUnsavedStore === 'function') {
  isloh_registerUnsavedStore('quiz', {
    save: () => isloh_saveQuizForm(),
    restore: () => isloh_fillQuizForm()
  });
}

/* --- Savol amallari ------------------------------------------------------- */

function isloh_quizEditorToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_refreshQuizEditor() {
  const quiz = isloh_getQuiz(isloh_quizEditorId());
  if (!quiz) return;
  isloh_renderQuizQuestions(quiz);
  isloh_renderQuizStatsCards(quiz);
  isloh_renderQuizOutputs(quiz);
}

function isloh_initQuizQuestionActions() {
  const list = document.querySelector('[data-questions-list]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-question-edit]');
    if (edit) {
      isloh_openQuestionEditor(edit.dataset.questionEdit);
      return;
    }

    /* Nusxalash savolni BANKDA nusxalaydi va nusxani shu testga qo'shadi —
       asl savol boshqa testlarda tegilmagan holda qoladi. */
    const duplicate = e.target.closest('[data-question-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateQuestion(duplicate.dataset.questionDuplicate);
      if (copy) isloh_addQuestionToQuiz(isloh_quizEditorId(), copy.id);
      isloh_refreshQuizEditor();
      isloh_quizEditorToast(copy ? 'Savol nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const remove = e.target.closest('[data-quiz-question-remove]');
    if (remove) {
      isloh_pendingQuestionRemove = remove.dataset.quizQuestionRemove;
      const question = isloh_getQuestion(isloh_pendingQuestionRemove);
      const nameEl = document.querySelector('[data-remove-question-name]');
      if (nameEl) nameEl.textContent = question ? question.title : '';
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-question-modal');
    }
  });

  document.querySelector('[data-confirm-delete-question]')?.addEventListener('click', () => {
    if (isloh_pendingQuestionRemove) {
      isloh_removeQuestionFromQuiz(isloh_quizEditorId(), isloh_pendingQuestionRemove);
      isloh_pendingQuestionRemove = null;
      isloh_refreshQuizEditor();
      isloh_quizEditorToast('Savol testdan chiqarildi');
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-question-modal');
  });

  /* Tortib ko'chirish tartibi do'konga yoziladi (js/sortable.js hodisasi). */
  list.addEventListener('isloh:sorted', (e) => {
    isloh_reorderQuizQuestions(isloh_quizEditorId(), e.detail.ids);
    isloh_refreshQuizEditor();
  });
}

/* --- Bankdan savol tanlash ------------------------------------------------
   Yangi savol yaratish js/question-editor.js zimmasida; bu yerda esa
   MAVJUD savolni testga qo'shish. Ikkalasi ham kerak: savol banki umumiy
   havza bo'lgani uchun uni qayta yozish o'rniga tanlash mantiqiy. */

function isloh_renderQuizBankPicker() {
  const mount = document.querySelector('[data-quiz-bank-list]');
  if (!mount) return;

  const quiz = isloh_getQuiz(isloh_quizEditorId());
  if (!quiz) return;

  const available = isloh_getQuestions()
    .filter((q) => q.status === 'active' && quiz.questionIds.indexOf(q.id) === -1);

  mount.innerHTML = available.length
    ? available.map((q) => {
        const type = isloh_questionTypeMeta(q.type);
        const diff = isloh_difficultyMeta(q.difficulty);
        return `<label class="opt-row">
          <input type="checkbox" data-bank-pick="${q.id}">
          <span class="flex-1">${q.title}</span>
          <span class="badge badge-violet question-type-badge"><i class="bi ${type.icon}"></i> ${type.label}</span>
          <span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span>
        </label>`;
      }).join('')
    : `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Bankdagi barcha faol savollar allaqachon shu testda.</p>`;
}

function isloh_initQuizBankPicker() {
  const openBtn = document.querySelector('[data-quiz-bank-open]');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      isloh_renderQuizBankPicker();
      if (typeof isloh_openModal === 'function') isloh_openModal('quiz-bank-modal');
    });
  }

  document.querySelector('[data-quiz-bank-add]')?.addEventListener('click', () => {
    const ids = [...document.querySelectorAll('[data-bank-pick]:checked')].map((el) => el.dataset.bankPick);
    if (!ids.length) {
      isloh_quizEditorToast('Savol tanlanmadi', 'error');
      return;
    }

    ids.forEach((id) => isloh_addQuestionToQuiz(isloh_quizEditorId(), id));
    isloh_refreshQuizEditor();
    if (typeof isloh_closeModal === 'function') isloh_closeModal('quiz-bank-modal');
    isloh_quizEditorToast(ids.length + ' ta savol testga qo\'shildi');
  });
}

/* Savol muharriri modali yopilgach ro'yxatni yangilaymiz — yangi savol
   js/question-editor.js tomonidan bankka yoziladi va shu testga qo'shiladi. */
document.addEventListener('isloh:question-saved', isloh_refreshQuizEditor);

function isloh_initQuizEditorGuard() {
  if (!document.querySelector('[data-questions-list]')) return;
  if (isloh_getQuiz(isloh_quizEditorId())) return;
  isloh_quizEditorToast(isloh_quizEditorId() ? 'Bunday test topilmadi' : "Test tanlanmagan — ro'yxatdan oching", 'error');
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initQuizEditorGuard();
  isloh_initQuizQuestionActions();
  isloh_initQuizBankPicker();
});
