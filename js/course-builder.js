/* ==========================================================================
   ISLOH — Kurs tarkibi (modullar) — pages/instructor/course-builder.html
   Modullar endi js/content-store.js dagi `isloh_course_content` do'konidan
   chiziladi. Ilgari 4 ta modul HTML ichiga qo'lda yozilgan edi va
   qo'shish/nusxalash/o'chirish faqat DOM'da bo'lardi — sahifa yangilansa
   hammasi eski holatga qaytardi.

   Umumiy xatti-harakatlar avvalgidek boshqa modullardan olinadi:
   js/filterable.js (qidiruv/filtr), js/sortable.js (tartib), js/dropdown.js,
   js/modal.js. Bu fayl faqat modulga xos mantiqni va do'kon bilan
   bog'lanishni saqlaydi.
   ========================================================================== */

let isloh_pendingModuleDelete = null;

/* Qaysi kurs ustida ishlayapmiz: ?id= yoki ?course= */
function isloh_builderCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || params.get('course') || 'py-101';
}

function isloh_moduleStatusBadge(status) {
  return status === 'published'
    ? '<span class="badge badge-green">Nashr etilgan</span>'
    : '<span class="badge badge-warning">Qoralama</span>';
}

/* Modul ichidagi dastlabki 3 ta dars — yig'ilgan kartochka ochilganda. */
function isloh_modulePreviewHtml(module) {
  const lessons = module.lessons || [];
  if (!lessons.length) {
    return '<div class="module-preview-item text-muted"><i class="bi bi-info-circle"></i> Bu modulda hali dars yo\'q</div>';
  }
  return lessons.slice(0, 3).map((lesson) => {
    const meta = isloh_lessonTypeMeta(lesson.type);
    return `<div class="module-preview-item"><i class="bi ${meta.icon}"></i> ${lesson.title} (${meta.label} · ${lesson.duration})</div>`;
  }).join('');
}

function isloh_moduleCardHtml(module, index, courseId) {
  const lessons = module.lessons || [];
  const link = (page) => `${page}?course=${courseId}&module=${module.id}`;

  return `<div class="card module-card" data-id="${module.id}" data-filter-item data-status="${module.status}" data-filter-text="${module.title}" draggable="true" data-sortable-item>
    <div class="module-header">
      <i class="bi bi-grip-vertical drag-handle" data-drag-handle tabindex="0" role="button" aria-label="Modulni tashish"></i>
      <button class="module-toggle collapsed" data-module-toggle aria-expanded="false" aria-label="Yig'ish/Yoyish"><i class="bi bi-chevron-down"></i></button>
      <div class="module-info">
        <div class="module-title-row">
          <span class="module-title filter-title">${index + 1}-modul: ${module.title}</span>
          ${isloh_moduleStatusBadge(module.status)}
        </div>
        <div class="module-desc">${module.desc || "Tavsif qo'shilmagan"}</div>
      </div>
      <div class="module-meta">
        <span><i class="bi bi-journal-text"></i> ${lessons.length} dars</span>
      </div>
      <div class="dropdown">
        <button class="row-action" aria-label="Modul amallari"><i class="bi bi-three-dots"></i></button>
        <div class="dropdown-menu">
          <a href="${link('lesson-builder.html')}" class="dropdown-item"><i class="bi bi-list-task"></i> Darslarni boshqarish</a>
          <a href="${link('quiz-builder.html')}" class="dropdown-item"><i class="bi bi-patch-question"></i> Testlar</a>
          <a href="${link('assignment-builder.html')}" class="dropdown-item"><i class="bi bi-file-earmark-text"></i> Topshiriqlar</a>
          <a href="${link('resource-manager.html')}" class="dropdown-item"><i class="bi bi-folder2-open"></i> Resurslar</a>
          <div class="dropdown-item" data-action="duplicate-module"><i class="bi bi-copy"></i> Nusxalash</div>
          <div class="dropdown-item text-danger" data-action="delete-module"><i class="bi bi-trash"></i> O'chirish</div>
        </div>
      </div>
    </div>
    <div class="module-body collapsed">
      <div class="module-preview-list">${isloh_modulePreviewHtml(module)}</div>
      <div class="module-body-foot"><a href="${link('lesson-builder.html')}" class="btn btn-outline btn-sm"><i class="bi bi-list-task"></i> Barcha darslarni ko'rish (${lessons.length})</a></div>
    </div>
  </div>`;
}

function isloh_renderModules() {
  const list = document.querySelector('[data-modules-list]');
  if (!list) return;

  const courseId = isloh_builderCourseId();
  const modules = isloh_getModules(courseId);

  if (!modules.length) {
    list.innerHTML = `<div class="empty-state card">
      <div class="empty-icon"><i class="bi bi-diagram-3"></i></div>
      <div class="empty-title">Hali modul yo'q</div>
      <div class="empty-sub">"Modul qo'shish" tugmasi orqali kurs tarkibini boshlang.</div>
    </div>`;
  } else {
    list.innerHTML = modules.map((m, i) => isloh_moduleCardHtml(m, i, courseId)).join('');
  }

  isloh_renderModuleStats(modules);
}

/* Sahifa tepasidagi ko'rsatkichlar — ro'yxatdan hisoblanadi. */
function isloh_renderModuleStats(modules) {
  const set = (attr, value) => {
    const el = document.querySelector('[' + attr + ']');
    if (el) el.textContent = value;
  };
  set('data-module-count', modules.length);
  set('data-lesson-count', modules.reduce((s, m) => s + (m.lessons || []).length, 0));
  set('data-published-count', modules.filter((m) => m.status === 'published').length);
}

function isloh_initModuleCollapse() {
  const list = document.querySelector('[data-modules-list]');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-module-toggle]');
    if (!toggle) return;
    const body = toggle.closest('.module-card').querySelector('.module-body');
    const collapsed = body.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
}

function isloh_builderToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_initModuleActions() {
  const list = document.querySelector('[data-modules-list]');
  if (!list) return;
  const courseId = isloh_builderCourseId();

  list.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-module"]');
    if (dupBtn) {
      const id = dupBtn.closest('.module-card').dataset.id;
      if (isloh_duplicateModule(courseId, id)) {
        isloh_renderModules();
        isloh_builderToast('Modul nusxalandi');
      }
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-module"]');
    if (delBtn) {
      isloh_pendingModuleDelete = delBtn.closest('.module-card').dataset.id;
      isloh_openModal('delete-module-modal');
    }
  });

  document.querySelector('[data-confirm-delete-module]')?.addEventListener('click', () => {
    if (isloh_pendingModuleDelete) {
      isloh_deleteModule(courseId, isloh_pendingModuleDelete);
      isloh_pendingModuleDelete = null;
      isloh_renderModules();
      isloh_builderToast("Modul o'chirildi");
    }
    isloh_closeModal('delete-module-modal');
  });

  // Tortib ko'chirilgach yangi tartib saqlanadi (js/sortable.js hodisasi)
  list.addEventListener('isloh:sorted', (e) => {
    isloh_reorderModules(courseId, e.detail.ids);
    isloh_renderModules();
  });
}

function isloh_initAddModule() {
  const form = document.querySelector('[data-add-module-form]');
  if (!form) return;
  const courseId = isloh_builderCourseId();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) {
      isloh_builderToast('Modul nomini kiriting', 'error');
      return;
    }

    const saved = isloh_saveModule(courseId, {
      title: title,
      desc: form.querySelector('[name="desc"]').value.trim()
    });
    if (!saved) {
      isloh_builderToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    form.reset();
    isloh_renderModules();
    isloh_closeModal('add-module-modal');
    isloh_builderToast(`"${saved.title}" moduli qo'shildi`);
  });
}

/* Sahifa sarlavhasi va havolalarni joriy kursga moslaydi. */
function isloh_initBuilderHeader() {
  const courseId = isloh_builderCourseId();
  if (typeof isloh_getCourse !== 'function') return;

  const course = isloh_getCourse(courseId);
  if (!course) return;

  const title = document.querySelector('[data-course-heading]');
  if (title) title.textContent = course.title + ' — kurs tarkibi';

  /* Breadcrumb'dagi kurs nomi ham do'kondan — ilgari u markupda qotib
     qolgan edi va boshqa kursni ochganda ham "Python Backend Development"
     deb turardi (9-bosqich auditi). */
  document.querySelectorAll('[data-course-crumb]').forEach((el) => { el.textContent = course.title; });

  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(courseId);
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initBuilderHeader();
  isloh_renderModules();
  isloh_initModuleCollapse();
  isloh_initModuleActions();
  isloh_initAddModule();
});
