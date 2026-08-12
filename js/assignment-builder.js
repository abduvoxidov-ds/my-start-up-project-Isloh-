/* ==========================================================================
   ISLOH — Topshiriq loyihalari (pages/instructor/assignment-builder.html)

   Kartochkalar, jadval va statistika js/assignment-store.js dagi
   `isloh_assignments` do'konidan chiziladi.

   NEGA O'ZGARDI: ilgari 4 ta topshiriq HTML ichida IKKI MARTA (katakcha +
   jadval) qo'lda yozilgan edi. "Topshiriq yaratish" <template>dan nusxa
   olib grid'ga qo'shardi — sahifa yangilansa yo'qolardi; "O'chirish" esa
   faqat DOM'dan olib tashlardi. Statistika raqamlari (4 / 2 / 2 / 1)
   ro'yxat bilan umuman bog'liq emas edi.

   Umumiy xatti-harakatlar avvalgidek boshqa modullardan olinadi:
   js/filterable.js (qidiruv/filtr), js/courses.js (skeleton, ko'p tanlash,
   ko'rinish almashtirgich), js/dropdown.js, js/modal.js. Shu sababli bu
   fayl courses.js DAN OLDIN yuklanadi — avval markup chiziladi, keyin
   umumiy modullar unga ulanadi (js/instructor-courses.js bilan bir xil).

   Sahifa BITTA kursga tegishli: ?course= yoki ?id=.
   ========================================================================== */

let isloh_pendingAssignmentDelete = null;

/* Qaysi kurs ustida ishlayapmiz — js/course-builder.js bilan bir xil qoida. */
function isloh_asBuilderCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('course') || params.get('id') || 'py-101';
}

/* --- Kartochka va qator markupi ------------------------------------------- */

function isloh_asMenuHtml(assignment) {
  const id = encodeURIComponent(assignment.id);
  const editLabel = assignment.status === 'draft' ? 'Davom ettirish' : 'Tahrirlash';

  return `<div class="dropdown">
      <button class="row-action" aria-label="${assignment.title} amallari"><i class="bi bi-three-dots"></i></button>
      <div class="dropdown-menu dropdown-menu-right">
        <a href="assignment-editor.html?id=${id}" class="dropdown-item"><i class="bi bi-pencil"></i> ${editLabel}</a>
        <button type="button" class="dropdown-item" data-assignment-preview="${assignment.id}"><i class="bi bi-eye"></i> Oldindan ko'rish</button>
        <button type="button" class="dropdown-item" data-assignment-duplicate="${assignment.id}"><i class="bi bi-copy"></i> Nusxalash</button>
        <button type="button" class="dropdown-item" data-assignment-publish="${assignment.id}"><i class="bi bi-journal-check"></i> ${assignment.status === 'published' ? 'Qoralamaga qaytarish' : 'Nashr etish'}</button>
        <button type="button" class="dropdown-item is-danger" data-assignment-delete="${assignment.id}"><i class="bi bi-trash"></i> O'chirish</button>
      </div>
    </div>`;
}

/* Topshirilgan ishlar soni — kartochkada ko'rsatiladi, chunki o'qituvchi
   uchun "necha kishi topshirdi" muddatdan kam muhim emas. */
function isloh_asSubmissionCount(assignmentId) {
  return isloh_getSubmissions().filter((s) => s.assignmentId === assignmentId).length;
}

function isloh_asCoverHtml(assignment) {
  return assignment.status === 'draft'
    ? `<div class="cci-cover tint-muted"><i class="bi ${assignment.icon}"></i></div>`
    : `<div class="cci-cover" style="background:${assignment.cover};"><i class="bi ${assignment.icon}"></i></div>`;
}

function isloh_asCardHtml(assignment) {
  const meta = ISLOH_ASSIGNMENT_STATUSES[assignment.status] || ISLOH_ASSIGNMENT_STATUSES.draft;
  const submit = isloh_submitTypeMeta(assignment.submitType);
  const visible = assignment.visibility === 'public';
  const count = isloh_asSubmissionCount(assignment.id);

  return `<div class="card course-card-instr assignment-card" data-filter-item data-status="${assignment.status}" data-filter-text="${assignment.title}">
    <input type="checkbox" class="cci-select" data-select-item data-assignment-id="${assignment.id}" aria-label="${assignment.title} tanlash">
    ${isloh_asCoverHtml(assignment)}
    <span class="badge ${meta.badge} cci-status">${meta.label}</span>
    <div class="cci-body">
      <div class="cci-title filter-title">${assignment.title}</div>
      <div class="cci-tags">
        <span class="cci-tag" data-assignment-due><i class="bi bi-calendar-event"></i> ${isloh_assignmentDueLabel(assignment)}</span>
        <span class="cci-tag"><i class="bi ${submit.icon}"></i> ${submit.label}</span>
        <span class="cci-tag"><i class="bi bi-award"></i> ${assignment.maxScore} ball</span>
      </div>
      <div class="cci-stats">
        <span><i class="bi ${visible ? 'bi-eye' : 'bi-eye-slash'}"></i> ${visible ? 'Ochiq' : 'Yashirin'}</span>
        <span><i class="bi bi-hourglass-split"></i> ~${assignment.estimate} daq</span>
        <span><i class="bi bi-inbox"></i> ${count}</span>
      </div>
      <div class="cci-foot">
        <span class="cci-meta">Yangilangan: ${isloh_relativeDate(assignment.updatedAt)}</span>
        ${isloh_asMenuHtml(assignment)}
      </div>
    </div>
  </div>`;
}

function isloh_asRowHtml(assignment) {
  const meta = ISLOH_ASSIGNMENT_STATUSES[assignment.status] || ISLOH_ASSIGNMENT_STATUSES.draft;
  const submit = isloh_submitTypeMeta(assignment.submitType);
  const thumb = assignment.status === 'draft'
    ? '<div class="cell-thumb tint-muted"><i class="bi ' + assignment.icon + '"></i></div>'
    : '<div class="cell-thumb" style="background:' + assignment.cover + ';"><i class="bi ' + assignment.icon + '"></i></div>';

  return `<tr data-filter-item data-status="${assignment.status}" data-filter-text="${assignment.title}">
    <td><input type="checkbox" data-select-item data-assignment-id="${assignment.id}" aria-label="${assignment.title} tanlash"></td>
    <td><div class="cell-main">${thumb}<div class="cell-title filter-title">${assignment.title}</div></div></td>
    <td><span class="badge ${meta.badge}">${meta.label}</span></td>
    <td>${assignment.visibility === 'public' ? 'Ochiq' : 'Yashirin'}</td>
    <td>${isloh_assignmentDueLabel(assignment)}</td>
    <td>${submit.label}</td>
    <td>${assignment.maxScore}</td>
    <td>${isloh_asMenuHtml(assignment)}</td>
  </tr>`;
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderAssignmentStats(courseId) {
  const stats = isloh_assignmentStats(courseId);
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-assignment-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  });
}

function isloh_renderAssignmentBuilder() {
  const grid = document.querySelector('[data-assignment-grid]');
  const rows = document.querySelector('[data-assignment-rows]');
  if (!grid && !rows) return;

  const courseId = isloh_asBuilderCourseId();
  const list = isloh_getCourseAssignments(courseId);

  if (grid) grid.innerHTML = list.map(isloh_asCardHtml).join('');
  if (rows) rows.innerHTML = list.map(isloh_asRowHtml).join('');
  isloh_renderAssignmentStats(courseId);

  /* Sahifa sarlavhasidagi kurs nomi ham do'kondan — ilgari "Python Backend
     Development" qo'lda yozilgan edi va boshqa kurs ochilsa ham o'zgarmasdi. */
  const courseOut = document.querySelector('[data-assignment-course]');
  if (courseOut) {
    const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(courseId) : null;
    courseOut.textContent = course ? course.title : courseId;
  }

  /* Kurs tarkibiga qaytish havolalari joriy kursni yo'qotmasin. */
  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(courseId);

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_asToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_openAssignmentPreview(assignment) {
  const modal = document.getElementById('preview-assignment-modal');
  if (!modal || !assignment) return;

  const titleEl = modal.querySelector('[data-preview-assignment-title]');
  const metaEl = modal.querySelector('[data-preview-assignment-meta]');
  if (titleEl) titleEl.textContent = assignment.title;
  if (metaEl) {
    metaEl.textContent = [
      isloh_submitTypeMeta(assignment.submitType).label,
      assignment.maxScore + ' ball',
      'Muddat: ' + isloh_assignmentDueLabel(assignment),
      assignment.desc
    ].filter(Boolean).join(' · ');
  }
  if (typeof isloh_openModal === 'function') isloh_openModal('preview-assignment-modal');
}

function isloh_initAssignmentActions() {
  const scope = document.querySelector('[data-bulk-scope]');
  if (!scope) return;

  /* Delegatsiya: ro'yxat qayta chizilganda hodisalar qayta ulanmaydi. */
  scope.addEventListener('click', (e) => {
    const preview = e.target.closest('[data-assignment-preview]');
    if (preview) {
      isloh_openAssignmentPreview(isloh_getAssignment(preview.dataset.assignmentPreview));
      return;
    }

    const duplicate = e.target.closest('[data-assignment-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateAssignment(duplicate.dataset.assignmentDuplicate);
      isloh_renderAssignmentBuilder();
      isloh_asToast(copy ? 'Topshiriq nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const publish = e.target.closest('[data-assignment-publish]');
    if (publish) {
      const current = isloh_getAssignment(publish.dataset.assignmentPublish);
      if (!current) return;
      const next = current.status === 'published' ? 'draft' : 'published';
      isloh_setAssignmentStatus(current.id, next);
      isloh_renderAssignmentBuilder();
      isloh_asToast(next === 'published' ? 'Topshiriq nashr etildi' : 'Topshiriq qoralamaga qaytarildi');
      return;
    }

    const del = e.target.closest('[data-assignment-delete]');
    if (del) {
      isloh_pendingAssignmentDelete = del.dataset.assignmentDelete;
      const assignment = isloh_getAssignment(isloh_pendingAssignmentDelete);
      const nameEl = document.querySelector('[data-delete-assignment-name]');
      if (nameEl) nameEl.textContent = assignment ? assignment.title : '';
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-assignment-modal');
    }
  });

  document.querySelector('[data-confirm-delete-assignment]')?.addEventListener('click', () => {
    if (isloh_pendingAssignmentDelete) {
      isloh_deleteAssignment(isloh_pendingAssignmentDelete);
      isloh_pendingAssignmentDelete = null;
      isloh_renderAssignmentBuilder();
      isloh_asToast("Topshiriq o'chirildi");
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-assignment-modal');
  });
}

/* Yangi topshiriq. Faqat nom va muddat so'raladi — qolgan maydonlar
   muharrirda to'ldiriladi, shuning uchun yozuv qoralama sifatida tug'iladi. */
function isloh_initAddAssignment() {
  const form = document.querySelector('[data-add-assignment-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim();
    if (!title) {
      isloh_asToast("Topshiriq nomi bo'sh bo'lishi mumkin emas", 'error');
      return;
    }

    const saved = isloh_saveAssignment({
      courseId: isloh_asBuilderCourseId(),
      title: title,
      dueDate: form.querySelector('[name="due"]').value || ''
    });

    if (!saved) {
      isloh_asToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    form.reset();
    isloh_renderAssignmentBuilder();
    if (typeof isloh_closeModal === 'function') isloh_closeModal('add-assignment-modal');
    isloh_asToast("Yangi topshiriq qo'shildi — tafsilotlarni tahrirlang");
  });
}

/* Ko'p tanlash paneli. Tanlash mantiqi js/courses.js da. */
function isloh_selectedAssignmentIds() {
  return [...document.querySelectorAll('[data-select-item]:checked')]
    .map((el) => el.dataset.assignmentId)
    .filter(Boolean);
}

function isloh_initAssignmentBulkActions() {
  const bar = document.querySelector('[data-bulk-bar]');
  if (!bar) return;

  const run = (action, done) => {
    const ids = isloh_selectedAssignmentIds();
    if (!ids.length) return;
    ids.forEach(action);
    isloh_renderAssignmentBuilder();
    isloh_asToast(done.replace('{n}', ids.length));
  };

  bar.querySelector('[data-bulk-publish]')?.addEventListener('click', () => {
    run((id) => isloh_setAssignmentStatus(id, 'published'), '{n} ta topshiriq nashr etildi');
  });
  bar.querySelector('[data-bulk-duplicate]')?.addEventListener('click', () => {
    run((id) => isloh_duplicateAssignment(id), '{n} ta topshiriq nusxalandi');
  });
  bar.querySelector('[data-bulk-delete]')?.addEventListener('click', () => {
    run((id) => isloh_deleteAssignment(id), "{n} ta topshiriq o'chirildi");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderAssignmentBuilder();
  isloh_initAssignmentActions();
  isloh_initAddAssignment();
  isloh_initAssignmentBulkActions();
});
