/* ==========================================================================
   ISLOH — Testlar ro'yxati (pages/instructor/quiz-builder.html)

   Kartochkalar, jadval va statistika js/quiz-store.js dagi `isloh_quizzes`
   do'konidan chiziladi. Sahifa BITTA kursga tegishli: ?course= yoki ?id=.

   NEGA O'ZGARDI: 5 ta test HTML ichida IKKI MARTA (katakcha + jadval)
   yozilgan edi; "Test yaratish" <template>dan nusxa olib qo'yardi va
   sahifa yangilanishi bilan yo'qolardi; "O'chirish" faqat DOM'dan olib
   tashlardi. Savol sonlari (12 / 20 / 18 ...) esa hech qanday savol bilan
   bog'liq emas edi — endi ular `questionIds` uzunligidan hisoblanadi.

   Umumiy xatti-harakatlar boshqa modullardan: js/filterable.js,
   js/courses.js (skeleton, ko'p tanlash, ko'rinish almashtirgich),
   js/dropdown.js, js/modal.js. Shuning uchun bu fayl courses.js DAN OLDIN
   yuklanadi (js/instructor-courses.js va js/assignment-builder.js kabi).
   ========================================================================== */

let isloh_pendingQuizDelete = null;

function isloh_quizBuilderCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('course') || params.get('id') || 'py-101';
}

/* --- Markup --------------------------------------------------------------- */

function isloh_quizMenuHtml(quiz) {
  const id = encodeURIComponent(quiz.id);
  const editLabel = quiz.status === 'draft' ? 'Savollarni tahrirlash' : 'Tahrirlash';

  return `<div class="dropdown">
      <button class="row-action" aria-label="${quiz.title} amallari"><i class="bi bi-three-dots"></i></button>
      <div class="dropdown-menu dropdown-menu-right">
        <a href="quiz-editor.html?id=${id}" class="dropdown-item"><i class="bi bi-pencil"></i> ${editLabel}</a>
        <button type="button" class="dropdown-item" data-quiz-preview="${quiz.id}"><i class="bi bi-eye"></i> Oldindan ko'rish</button>
        <button type="button" class="dropdown-item" data-quiz-duplicate="${quiz.id}"><i class="bi bi-copy"></i> Nusxalash</button>
        <button type="button" class="dropdown-item" data-quiz-publish="${quiz.id}"><i class="bi bi-journal-check"></i> ${quiz.status === 'published' ? 'Qoralamaga qaytarish' : 'Nashr etish'}</button>
        <button type="button" class="dropdown-item is-danger" data-quiz-delete="${quiz.id}"><i class="bi bi-trash"></i> O'chirish</button>
      </div>
    </div>`;
}

function isloh_quizCardHtml(quiz) {
  const meta = ISLOH_QUIZ_STATUSES[quiz.status] || ISLOH_QUIZ_STATUSES.draft;
  const diff = isloh_difficultyMeta(quiz.difficulty);
  const cover = quiz.status === 'draft'
    ? '<div class="cci-cover tint-muted"><i class="bi bi-patch-question"></i></div>'
    : `<div class="cci-cover" style="background:${quiz.cover};"><i class="bi ${quiz.icon}"></i></div>`;

  return `<div class="card course-card-instr quiz-card" data-filter-item data-status="${quiz.status}" data-filter-text="${quiz.title}" draggable="false">
    <input type="checkbox" class="cci-select" data-select-item data-quiz-id="${quiz.id}" aria-label="${quiz.title} tanlash">
    ${cover}
    <span class="badge ${meta.badge} cci-status">${meta.label}</span>
    <div class="cci-body">
      <div class="cci-title filter-title">${quiz.title}</div>
      <div class="cci-tags">
        <span class="cci-tag"><i class="bi bi-journal-text"></i> ${isloh_quizQuestionCount(quiz)} savol</span>
        <span class="cci-tag"><i class="bi bi-clock"></i> ${isloh_quizDurationLabel(quiz)}</span>
        <span class="cci-tag"><i class="bi bi-arrow-repeat"></i> ${isloh_quizAttemptsLabel(quiz)}</span>
      </div>
      <div class="cci-stats">
        <span><i class="bi bi-bullseye"></i> O'tish balli: ${quiz.passingScore}%</span>
        <span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span>
      </div>
      <div class="cci-foot">
        <span class="cci-meta">Yangilangan: ${isloh_relativeDate(quiz.updatedAt)}</span>
        ${isloh_quizMenuHtml(quiz)}
      </div>
    </div>
  </div>`;
}

function isloh_quizRowHtml(quiz) {
  const meta = ISLOH_QUIZ_STATUSES[quiz.status] || ISLOH_QUIZ_STATUSES.draft;
  const diff = isloh_difficultyMeta(quiz.difficulty);
  const thumb = quiz.status === 'draft'
    ? '<div class="cell-thumb tint-muted"><i class="bi bi-patch-question"></i></div>'
    : `<div class="cell-thumb" style="background:${quiz.cover};"><i class="bi ${quiz.icon}"></i></div>`;

  return `<tr data-filter-item data-status="${quiz.status}" data-filter-text="${quiz.title}">
    <td><input type="checkbox" data-select-item data-quiz-id="${quiz.id}" aria-label="${quiz.title} tanlash"></td>
    <td><div class="cell-main">${thumb}<div class="cell-title filter-title">${quiz.title}</div></div></td>
    <td><span class="badge ${meta.badge}">${meta.label}</span></td>
    <td><span class="badge ${diff.badge} difficulty-badge"><span class="difficulty-dot ${diff.dot}"></span> ${diff.label}</span></td>
    <td>${isloh_quizQuestionCount(quiz)}</td>
    <td>${isloh_quizDurationLabel(quiz)}</td>
    <td>${isloh_quizAttemptsLabel(quiz)}</td>
    <td>${quiz.passingScore}%</td>
    <td>${isloh_quizMenuHtml(quiz)}</td>
  </tr>`;
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderQuizStats(courseId) {
  const stats = isloh_quizStats(courseId);
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-quiz-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  });
}

function isloh_renderQuizBuilder() {
  const grid = document.querySelector('[data-quiz-grid]');
  const rows = document.querySelector('[data-quiz-rows]');
  if (!grid && !rows) return;

  const courseId = isloh_quizBuilderCourseId();
  const list = isloh_getCourseQuizzes(courseId);

  if (grid) grid.innerHTML = list.map(isloh_quizCardHtml).join('');
  if (rows) rows.innerHTML = list.map(isloh_quizRowHtml).join('');
  isloh_renderQuizStats(courseId);

  const courseOut = document.querySelector('[data-quiz-course]');
  if (courseOut) {
    const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(courseId) : null;
    courseOut.textContent = course ? course.title : courseId;
  }

  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(courseId);

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_quizToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_openQuizPreview(quiz) {
  const modal = document.getElementById('preview-quiz-modal');
  if (!modal || !quiz) return;

  const titleEl = modal.querySelector('[data-preview-quiz-title]');
  const metaEl = modal.querySelector('[data-preview-quiz-meta]');
  if (titleEl) titleEl.textContent = quiz.title;
  if (metaEl) {
    metaEl.textContent = [
      isloh_quizQuestionCount(quiz) + ' savol',
      isloh_quizTotalPoints(quiz) + ' ball',
      isloh_quizDurationLabel(quiz),
      isloh_quizAttemptsLabel(quiz),
      "O'tish balli: " + quiz.passingScore + '%'
    ].join(' · ');
  }
  if (typeof isloh_openModal === 'function') isloh_openModal('preview-quiz-modal');
}

function isloh_initQuizActions() {
  const scope = document.querySelector('[data-bulk-scope]');
  if (!scope) return;

  scope.addEventListener('click', (e) => {
    const preview = e.target.closest('[data-quiz-preview]');
    if (preview) {
      isloh_openQuizPreview(isloh_getQuiz(preview.dataset.quizPreview));
      return;
    }

    const duplicate = e.target.closest('[data-quiz-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateQuiz(duplicate.dataset.quizDuplicate);
      isloh_renderQuizBuilder();
      isloh_quizToast(copy ? 'Test nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const publish = e.target.closest('[data-quiz-publish]');
    if (publish) {
      const current = isloh_getQuiz(publish.dataset.quizPublish);
      if (!current) return;

      /* Bo'sh testni nashr etib bo'lmaydi — talaba savolsiz test ochib
         qolmasin. */
      if (current.status !== 'published' && !isloh_quizQuestionCount(current)) {
        isloh_quizToast("Bo'sh testni nashr etib bo'lmaydi — avval savol qo'shing", 'error');
        return;
      }

      const next = current.status === 'published' ? 'draft' : 'published';
      isloh_setQuizStatus(current.id, next);
      isloh_renderQuizBuilder();
      isloh_quizToast(next === 'published' ? 'Test nashr etildi' : 'Test qoralamaga qaytarildi');
      return;
    }

    const del = e.target.closest('[data-quiz-delete]');
    if (del) {
      isloh_pendingQuizDelete = del.dataset.quizDelete;
      const quiz = isloh_getQuiz(isloh_pendingQuizDelete);
      const nameEl = document.querySelector('[data-delete-quiz-name]');
      if (nameEl) nameEl.textContent = quiz ? quiz.title : '';
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-quiz-modal');
    }
  });

  document.querySelector('[data-confirm-delete-quiz]')?.addEventListener('click', () => {
    if (isloh_pendingQuizDelete) {
      isloh_deleteQuiz(isloh_pendingQuizDelete);
      isloh_pendingQuizDelete = null;
      isloh_renderQuizBuilder();
      isloh_quizToast("Test o'chirildi");
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-quiz-modal');
  });
}

/* Yangi test: nom va qiyinlik so'raladi, qolgani muharrirda. */
function isloh_initAddQuiz() {
  const form = document.querySelector('[data-add-quiz-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) {
      isloh_quizToast("Test nomi bo'sh bo'lishi mumkin emas", 'error');
      return;
    }

    const saved = isloh_saveQuiz({
      courseId: isloh_quizBuilderCourseId(),
      title: title,
      difficulty: form.querySelector('[name="difficulty"]').value || 'medium'
    });

    if (!saved) {
      isloh_quizToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    form.reset();
    isloh_renderQuizBuilder();
    if (typeof isloh_closeModal === 'function') isloh_closeModal('add-quiz-modal');
    isloh_quizToast("Yangi test qo'shildi — savollarni qo'shish uchun tahrirlang");
  });
}

function isloh_selectedQuizIds() {
  return [...document.querySelectorAll('[data-select-item]:checked')]
    .map((el) => el.dataset.quizId)
    .filter(Boolean);
}

function isloh_initQuizBulkActions() {
  const bar = document.querySelector('[data-bulk-bar]');
  if (!bar) return;

  const run = (action, done) => {
    const ids = isloh_selectedQuizIds();
    if (!ids.length) return;
    ids.forEach(action);
    isloh_renderQuizBuilder();
    isloh_quizToast(done.replace('{n}', ids.length));
  };

  bar.querySelector('[data-bulk-publish]')?.addEventListener('click', () => {
    run((id) => {
      const quiz = isloh_getQuiz(id);
      if (quiz && isloh_quizQuestionCount(quiz)) isloh_setQuizStatus(id, 'published');
    }, '{n} ta test ko\'rib chiqildi — savoli borlari nashr etildi');
  });
  bar.querySelector('[data-bulk-duplicate]')?.addEventListener('click', () => {
    run((id) => isloh_duplicateQuiz(id), '{n} ta test nusxalandi');
  });
  bar.querySelector('[data-bulk-delete]')?.addEventListener('click', () => {
    run((id) => isloh_deleteQuiz(id), "{n} ta test o'chirildi");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderQuizBuilder();
  isloh_initQuizActions();
  isloh_initAddQuiz();
  isloh_initQuizBulkActions();
});
