/* ==========================================================================
   ISLOH — Kurslarim ro'yxati (pages/instructor/courses.html)
   Jadval, katakcha va statistika kartochkalari js/course-store.js dagi
   `isloh_courses` do'konidan chiziladi.

   NEGA: ilgari 6 ta kurs HTML ichida IKKI MARTA (jadval + katakcha) qo'lda
   yozilgan edi — ~340 qator takroriy markup. Statistika raqamlari ham
   qo'lda kiritilgan va ro'yxat bilan hech qanday bog'liq emas edi;
   qatordagi "Arxivlash"/"O'chirish" tugmalari esa umuman ishlamasdi.

   Umumiy xatti-harakatlar (skeleton, ko'rinish almashtirgich, ko'p tanlash)
   js/courses.js zimmasida qoladi — u boshqa provider sahifalarida ham
   ishlatiladi, shuning uchun bu yerga ko'chirilmaydi. Shu sababli bu fayl
   courses.js DAN OLDIN yuklanadi: markup avval chiziladi, keyin umumiy
   modul unga ulanadi.
   ========================================================================== */

/* Qatordagi "..." menyusi holatga qarab farq qiladi. */
function isloh_courseRowMenu(course) {
  const id = encodeURIComponent(course.id);
  const items = [];

  if (course.status === 'archived') {
    items.push(`<a href="course-details.html?id=${id}" class="dropdown-item"><i class="bi bi-eye"></i> Ko'rish</a>`);
    items.push(`<button type="button" class="dropdown-item" data-course-restore="${course.id}"><i class="bi bi-arrow-counterclockwise"></i> Tiklash</button>`);
    return items.join('');
  }

  if (course.status === 'published') {
    items.push(`<a href="course-details.html?id=${id}" class="dropdown-item"><i class="bi bi-eye"></i> Ko'rish</a>`);
    items.push(`<a href="course-edit.html?id=${id}" class="dropdown-item"><i class="bi bi-pencil"></i> Tahrirlash</a>`);
  } else {
    items.push(`<a href="course-edit.html?id=${id}" class="dropdown-item"><i class="bi bi-pencil"></i> Tahrirlashni davom ettirish</a>`);
    items.push(`<a href="course-publish.html?id=${id}" class="dropdown-item"><i class="bi bi-rocket-takeoff"></i> Nashr etish</a>`);
  }

  items.push(`<a href="course-builder.html?id=${id}" class="dropdown-item"><i class="bi bi-diagram-3"></i> Kurs tarkibi</a>`);
  items.push(`<a href="course-settings.html?id=${id}" class="dropdown-item"><i class="bi bi-gear"></i> Sozlamalar</a>`);
  /* M8: kurs guruhi — o'qituvchi va yozilgan talabalar uchun umumiy
     suhbat. Guruh birinchi ochilganda yaratiladi (js/chat-store.js). */
  items.push(`<a href="messages.html?course=${course.id}" class="dropdown-item"><i class="bi bi-chat-square-text"></i> Kurs guruhi</a>`);
  items.push(`<button type="button" class="dropdown-item" data-course-duplicate="${course.id}"><i class="bi bi-files"></i> Nusxalash</button>`);

  if (course.status === 'published') {
    items.push(`<button type="button" class="dropdown-item is-danger" data-course-archive="${course.id}"><i class="bi bi-archive"></i> Arxivlash</button>`);
  } else {
    items.push(`<button type="button" class="dropdown-item is-danger" data-course-delete="${course.id}"><i class="bi bi-trash"></i> O'chirish</button>`);
  }
  return items.join('');
}

function isloh_courseMenuHtml(course) {
  return `<div class="dropdown">
      <button class="row-action" aria-label="${course.title} amallari"><i class="bi bi-three-dots"></i></button>
      <div class="dropdown-menu dropdown-menu-right">${isloh_courseRowMenu(course)}</div>
    </div>`;
}

/* isloh_courseFillClass() js/course-store.js ga ko'chirildi — dashboard'dagi
   qoralamalar ro'yxati ham shu jadvalga muhtoj, bu fayl esa u yerda
   yuklanmaydi. */

function isloh_courseRevenueHtml(course) {
  if (!course.revenue) return '<td>—</td>';
  const cls = course.status === 'archived' ? 'cell-sub' : 'cell-revenue';
  return `<td class="${cls}">${isloh_formatUsd(course.revenue)}</td>`;
}

function isloh_courseTableRowHtml(course) {
  const meta = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
  const sub = course.status === 'draft'
    ? `${course.lessons} dars · ${course.completion}% tayyor`
    : `${course.lessons} dars`;

  return `<tr data-filter-item data-status="${course.status}" data-filter-text="${course.title}">
    <td><input type="checkbox" data-select-item data-course-id="${course.id}" aria-label="${course.title} tanlash"></td>
    <td><div class="cell-main">
      <div class="cell-thumb" style="background:${course.cover};"><i class="bi ${course.icon}"></i></div>
      <div><div class="cell-title filter-title">${course.title}</div><div class="cell-sub">${sub}</div></div>
    </div></td>
    <td><span class="badge ${meta.badge}">${meta.label}</span></td>
    <td>${course.category}</td>
    <td>${course.students || '—'}</td>
    <td>${course.rating ? course.rating + ' ★' : '—'}</td>
    <td><div class="cell-progress"><div class="progress-track"><div class="progress-fill${isloh_courseFillClass(course.status)}" style="width:${course.completion}%;"></div></div></div></td>
    ${isloh_courseRevenueHtml(course)}
    <td class="cell-sub">${isloh_relativeDate(course.updatedAt)}</td>
    <td>${isloh_courseMenuHtml(course)}</td>
  </tr>`;
}

function isloh_courseCardHtml(course) {
  const meta = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
  const progressLabel = course.status === 'draft' ? `${course.completion}% tayyor` : `${course.completion}%`;
  const revenue = course.revenue
    ? `<span class="cell-revenue">${isloh_formatUsd(course.revenue)}</span>`
    : '<span>—</span>';

  return `<div class="card course-card-instr" data-filter-item data-status="${course.status}" data-filter-text="${course.title}">
    <input type="checkbox" class="cci-select" data-select-item data-course-id="${course.id}" aria-label="${course.title} tanlash">
    <div class="cci-cover" style="background:${course.cover};"><i class="bi ${course.icon}"></i></div>
    <span class="badge ${meta.badge} cci-status">${meta.label}</span>
    <div class="cci-body">
      <div class="cci-title filter-title">${course.title}</div>
      <div class="cci-tags"><span class="cci-tag">${course.category}</span><span class="cci-tag">${course.level}</span></div>
      <div class="cci-stats">
        <span><i class="bi bi-people-fill"></i> ${course.students || '—'}</span>
        <span><i class="bi ${course.rating ? 'bi-star-fill' : 'bi-star'} cci-star"></i> ${course.rating || '—'}</span>
        ${revenue}
      </div>
      <div class="cci-progress-row"><div class="progress-track"><div class="progress-fill${isloh_courseFillClass(course.status)}" style="width:${course.completion}%;"></div></div><span>${progressLabel}</span></div>
      <div class="cci-foot">
        <span class="cci-meta">Yangilangan: ${isloh_relativeDate(course.updatedAt)}</span>
        ${isloh_courseMenuHtml(course)}
      </div>
    </div>
  </div>`;
}

/* Statistika kartochkalari ro'yxatdan hisoblanadi — qo'lda yozilgan
   raqamlar endi yo'q.

   "Jami talabalar" ataylab js/profile-stats.js dagi isloh_statTotalStudents()
   ga topshirilgan: u FAQAT nashr etilgan kurslarni sanaydi. Bu yerda barcha
   kurslar sanalardi, natijada bir xil "Jami talabalar" yorlig'i ostida
   kurslar ro'yxati 3 312, dashboard va profil esa 2 330 ko'rsatardi. Ta'rif
   bitta joyda tursin — modul ulanmagan bo'lsa eski hisob zaxira sifatida
   qoladi. */
function isloh_renderCourseStats(courses) {
  const counts = {
    published: courses.filter((c) => c.status === 'published').length,
    draft: courses.filter((c) => c.status === 'draft').length,
    archived: courses.filter((c) => c.status === 'archived').length,
    students: typeof isloh_statTotalStudents === 'function'
      ? isloh_statTotalStudents()
      : courses.filter((c) => c.status === 'published').reduce((sum, c) => sum + (c.students || 0), 0)
  };
  /* Ming ajratgichi ham bir joydan — profil va dashboard "2,330" deb
     yozayotganda bu sahifa "2330" deb yozmasin. */
  const format = typeof isloh_formatStatCount === 'function' ? isloh_formatStatCount : String;
  Object.keys(counts).forEach((key) => {
    const el = document.querySelector(`[data-course-stat="${key}"]`);
    if (el) el.textContent = format(counts[key]);
  });
}

function isloh_renderInstructorCourses() {
  const tableBody = document.querySelector('[data-course-rows]');
  const grid = document.querySelector('[data-course-grid]');
  if (!tableBody && !grid) return;

  const courses = isloh_getCourses();
  if (tableBody) tableBody.innerHTML = courses.map(isloh_courseTableRowHtml).join('');
  if (grid) grid.innerHTML = courses.map(isloh_courseCardHtml).join('');
  isloh_renderCourseStats(courses);

  /* Ro'yxat yangilanganda filtr/qidiruv holati ham qayta hisoblansin,
     aks holda o'chirilgan qator "topilmadi" holatini buzib qo'yadi. */
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_courseToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* O'chirish qaytarib bo'lmaydi — avval tasdiq oynasi ochiladi. */
let isloh_pendingCourseDelete = null;

function isloh_initCourseRowActions() {
  const scope = document.querySelector('[data-bulk-scope]');
  if (!scope) return;

  scope.addEventListener('click', (e) => {
    const archive = e.target.closest('[data-course-archive]');
    if (archive) {
      isloh_setCourseStatus(archive.dataset.courseArchive, 'archived');
      isloh_renderInstructorCourses();
      isloh_courseToast('Kurs arxivlandi');
      return;
    }

    const restore = e.target.closest('[data-course-restore]');
    if (restore) {
      isloh_setCourseStatus(restore.dataset.courseRestore, 'draft');
      isloh_renderInstructorCourses();
      isloh_courseToast('Kurs qoralamaga tiklandi');
      return;
    }

    const duplicate = e.target.closest('[data-course-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateCourse(duplicate.dataset.courseDuplicate);
      isloh_renderInstructorCourses();
      isloh_courseToast(copy ? 'Kurs nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const del = e.target.closest('[data-course-delete]');
    if (del) {
      isloh_pendingCourseDelete = del.dataset.courseDelete;
      const course = isloh_getCourse(isloh_pendingCourseDelete);
      const nameEl = document.querySelector('[data-delete-course-name]');
      if (nameEl) nameEl.textContent = course ? course.title : '';
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-course-modal');
    }
  });

  const confirmBtn = document.querySelector('[data-course-delete-confirm]');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (isloh_pendingCourseDelete) {
        isloh_deleteCourse(isloh_pendingCourseDelete);
        isloh_pendingCourseDelete = null;
        isloh_renderInstructorCourses();
        isloh_courseToast("Kurs o'chirildi");
      }
      if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-course-modal');
    });
  }
}

/* Ko'p tanlash paneli. Tanlash mantiqi js/courses.js da — bu yerda faqat
   tanlanganlarga nima qilinishi. */
function isloh_selectedCourseIds() {
  return [...document.querySelectorAll('[data-select-item]:checked')]
    .map((el) => el.dataset.courseId)
    .filter(Boolean);
}

function isloh_initCourseBulkActions() {
  const bar = document.querySelector('[data-bulk-bar]');
  if (!bar) return;

  const run = (action, done) => {
    const ids = isloh_selectedCourseIds();
    if (!ids.length) return;
    ids.forEach(action);
    isloh_renderInstructorCourses();
    isloh_courseToast(done.replace('{n}', ids.length));
  };

  bar.querySelector('[data-bulk-publish]')?.addEventListener('click', () => {
    run((id) => isloh_setCourseStatus(id, 'published'), '{n} ta kurs nashr etildi');
  });
  bar.querySelector('[data-bulk-archive]')?.addEventListener('click', () => {
    run((id) => isloh_setCourseStatus(id, 'archived'), '{n} ta kurs arxivlandi');
  });
  bar.querySelector('[data-bulk-delete]')?.addEventListener('click', () => {
    run((id) => isloh_deleteCourse(id), "{n} ta kurs o'chirildi");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderInstructorCourses();
  isloh_initCourseRowActions();
  isloh_initCourseBulkActions();
});

/* Do'kon API'dan yuklab bo'lgach qayta chizamiz — aks holda sahifada
   zaxira (demo) ro'yxat qolib ketardi. Amal tugmalari delegatsiya orqali
   ulangani uchun innerHTML almashishi ularni buzmaydi. */
document.addEventListener('isloh:courses-updated', isloh_renderInstructorCourses);
