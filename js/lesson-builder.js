/* ==========================================================================
   ISLOH — Darslar ro'yxati — pages/instructor/lesson-builder.html
   Darslar js/content-store.js dagi `isloh_course_content` do'konidan
   chiziladi. Sahifa `?course=<id>&module=<id>` bilan ochiladi (havolalarni
   js/course-builder.js yasaydi).

   Ilgari 6 ta dars HTML ichida qo'lda yozilgan, qo'shish/nusxalash/o'chirish
   esa faqat DOM'da bo'lardi. Dars turi jadvali (ISLOH_LESSON_TYPE_META) ham
   shu faylda edi — endi u content-store.js da, chunki modullar ro'yxati ham
   uni ishlatadi.
   ========================================================================== */

let isloh_pendingLessonDelete = null;

function isloh_lessonScope() {
  const params = new URLSearchParams(window.location.search);
  return {
    courseId: params.get('course') || params.get('id') || 'py-101',
    moduleId: params.get('module') || ''
  };
}

/* Modul berilmagan bo'lsa — kursning birinchi moduli. */
function isloh_resolveModuleId(scope) {
  if (scope.moduleId) return scope.moduleId;
  const modules = isloh_getModules(scope.courseId);
  return modules.length ? modules[0].id : '';
}

function isloh_lessonVisibilityHtml(lesson) {
  return lesson.visibility === 'hidden'
    ? '<span><i class="bi bi-eye-slash"></i> Yashirin</span>'
    : '<span><i class="bi bi-eye"></i> Ochiq</span>';
}

function isloh_lessonStatusBadge(lesson) {
  return lesson.status === 'published'
    ? '<span class="badge badge-green">Nashr etilgan</span>'
    : '<span class="badge badge-warning">Qoralama</span>';
}

function isloh_lessonItemHtml(lesson, scope) {
  const meta = isloh_lessonTypeMeta(lesson.type);
  const editHref = `lesson-editor.html?course=${scope.courseId}&module=${scope.moduleId}&lesson=${lesson.id}`;

  return `<div class="lesson-item" data-id="${lesson.id}" data-filter-item data-type="${lesson.type}" data-filter-text="${lesson.title}" draggable="true" data-sortable-item>
    <i class="bi bi-grip-vertical drag-handle" data-drag-handle tabindex="0" role="button" aria-label="Darsni tashish"></i>
    <div class="lesson-type-ic" style="background:${meta.bg};"><i class="bi ${meta.icon}"></i></div>
    <div class="lesson-info">
      <div class="lesson-title filter-title">${lesson.title}</div>
      <div class="lesson-meta"><span data-lesson-type-label>${meta.label}</span><span><i class="bi bi-clock"></i> ${lesson.duration}</span>${isloh_lessonVisibilityHtml(lesson)}</div>
    </div>
    <div class="lesson-badges">
      ${isloh_lessonStatusBadge(lesson)}
      <div class="dropdown">
        <button class="row-action" aria-label="Dars amallari"><i class="bi bi-three-dots"></i></button>
        <div class="dropdown-menu">
          <a href="${editHref}" class="dropdown-item"><i class="bi bi-pencil"></i> Tahrirlash</a>
          <div class="dropdown-item" data-action="duplicate-lesson"><i class="bi bi-copy"></i> Nusxalash</div>
          <div class="dropdown-item text-danger" data-action="delete-lesson"><i class="bi bi-trash"></i> O'chirish</div>
        </div>
      </div>
    </div>
  </div>`;
}

function isloh_renderLessons() {
  const list = document.querySelector('[data-lessons-list]');
  if (!list) return;

  const scope = isloh_lessonScope();
  scope.moduleId = isloh_resolveModuleId(scope);
  const lessons = isloh_getLessons(scope.courseId, scope.moduleId);

  list.innerHTML = lessons.length
    ? lessons.map((l) => isloh_lessonItemHtml(l, scope)).join('')
    : `<div class="empty-state card">
         <div class="empty-icon"><i class="bi bi-journal-text"></i></div>
         <div class="empty-title">Bu modulda hali dars yo'q</div>
         <div class="empty-sub">"Dars qo'shish" tugmasi orqali birinchi darsni yarating.</div>
       </div>`;

  isloh_renderLessonStats(lessons);
}

function isloh_renderLessonStats(lessons) {
  const set = (attr, value) => {
    const el = document.querySelector('[' + attr + ']');
    if (el) el.textContent = value;
  };
  set('data-lessons-total', lessons.length);
  set('data-lessons-published', lessons.filter((l) => l.status === 'published').length);
  set('data-lessons-video', lessons.filter((l) => l.type === 'video').length);
}

/* Sahifa sarlavhasi: qaysi kurs va modul ustida ishlayapmiz. */
function isloh_renderLessonHeader(scope) {
  const module = isloh_getModule(scope.courseId, scope.moduleId);
  const modules = isloh_getModules(scope.courseId);
  const index = modules.findIndex((m) => m.id === scope.moduleId);

  const title = document.querySelector('[data-module-heading]');
  if (title && module) title.textContent = `${index + 1}-modul: ${module.title}`;

  const crumb = document.querySelector('[data-module-crumb]');
  if (crumb && module) crumb.textContent = `${index + 1}-modul`;

  /* Sarlavha ostidagi qator ham do'kondan: dars soni + modul tavsifi.
     Ilgari u markupda qotib qolgan edi va boshqa kursning modulini
     ta'riflab turardi ("6 ta dars · Docker, Git ..."). */
  const sub = document.querySelector('[data-module-sub]');
  if (sub && module) {
    const count = (module.lessons || []).length;
    sub.textContent = [count + ' ta dars', module.desc].filter(Boolean).join(' · ');
  }
  if (module) document.title = module.title + ' — Isloh';

  document.querySelectorAll('[data-builder-link]').forEach((link) => {
    link.href = `course-builder.html?id=${scope.courseId}`;
  });

  /* Boshqa kurs bo'limlariga havolalar ham joriy kursni olib yursin
     (Testlar, Resurslar, Kurs tarkibi) — js/course-store.js. */
  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(scope.courseId);
}

function isloh_lessonToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_initLessonActions() {
  const list = document.querySelector('[data-lessons-list]');
  if (!list) return;

  const scope = isloh_lessonScope();
  scope.moduleId = isloh_resolveModuleId(scope);

  list.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-lesson"]');
    if (dupBtn) {
      const id = dupBtn.closest('.lesson-item').dataset.id;
      if (isloh_duplicateLesson(scope.courseId, scope.moduleId, id)) {
        isloh_renderLessons();
        isloh_lessonToast('Dars nusxalandi');
      }
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-lesson"]');
    if (delBtn) {
      isloh_pendingLessonDelete = delBtn.closest('.lesson-item').dataset.id;
      isloh_openModal('delete-lesson-modal');
    }
  });

  document.querySelector('[data-confirm-delete-lesson]')?.addEventListener('click', () => {
    if (isloh_pendingLessonDelete) {
      isloh_deleteLesson(scope.courseId, scope.moduleId, isloh_pendingLessonDelete);
      isloh_pendingLessonDelete = null;
      isloh_renderLessons();
      isloh_lessonToast("Dars o'chirildi");
    }
    isloh_closeModal('delete-lesson-modal');
  });

  list.addEventListener('isloh:sorted', (e) => {
    isloh_reorderLessons(scope.courseId, scope.moduleId, e.detail.ids);
    isloh_renderLessons();
  });
}

function isloh_initAddLesson() {
  const form = document.querySelector('[data-add-lesson-form]');
  if (!form) return;

  const scope = isloh_lessonScope();
  scope.moduleId = isloh_resolveModuleId(scope);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) {
      isloh_lessonToast('Dars nomini kiriting', 'error');
      return;
    }

    const saved = isloh_saveLesson(scope.courseId, scope.moduleId, {
      title: title,
      type: form.querySelector('[name="type"]').value
    });
    if (!saved) {
      isloh_lessonToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    form.reset();
    isloh_renderLessons();
    isloh_closeModal('add-lesson-modal');
    isloh_lessonToast(`"${saved.title}" darsi qo'shildi`);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const scope = isloh_lessonScope();
  scope.moduleId = isloh_resolveModuleId(scope);
  isloh_renderLessonHeader(scope);
  isloh_renderLessons();
  isloh_initLessonActions();
  isloh_initAddLesson();
});
