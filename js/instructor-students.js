/* ==========================================================================
   ISLOH — Talabalar ro'yxati (pages/instructor/students.html)

   Jadval, kurs filtri chiplari va tafsilot oynasi js/enrollment-store.js
   dagi `isloh_enrollments` do'konidan chiziladi.

   NEGA O'ZGARDI: ilgari 6 ta qator HTML ichida qo'lda yozilgan edi va
   tafsilot oynasi shu qatordagi KATAKLARNI qayta o'qib chiqardi (ya'ni
   ma'lumot manbai — ekrandagi matn). Kurs filtri chiplari ham qo'lda
   yozilgan "python / django / sql" qiymatlariga tayanardi: kurs nomi
   o'zgarsa chip eskiligicha qolardi. Statistika kartochkalari esa ro'yxat
   bilan umuman bog'liq emas edi (jadvalda 6 ta talaba, kartochkada 245).

   Mehnat taqsimoti (CLAUDE.md §2 — DRY):
     RAQAMLAR   -> js/profile-stats.js, `[data-stat="<kalit>"]`
     HOLAT      -> js/enrollment-store.js (isloh_enrollmentState)
     RO'YXAT    -> shu fayl
     EKSPORT    -> js/table-export.js, FILTR -> js/filterable.js

   Markup shartnomasi:
     [data-student-filters]  → kurs chiplari shu yerga chiziladi
     [data-student-rows]     → jadval qatorlari
     [data-student-coverage] → do'kondagi va kurs yozuvidagi son farqi izohi
     #student-detail-modal + [data-student-detail-*] → tafsilot oynasi
   ========================================================================== */

/* Ism bosh harflari — js/profile.js dagi umumiy funksiya (u yerda ham
   avatar shu tarzda yasaladi). */
function isloh_studentInitials(name) {
  if (typeof isloh_getUserInitials === 'function') return isloh_getUserInitials(name);
  return String(name || '?').trim().charAt(0).toUpperCase();
}

function isloh_studentAvatarHtml(enrollment) {
  const style = enrollment.avatar ? ` style="background:${enrollment.avatar};"` : '';
  return `<div class="avatar avatar-sm"${style}>${isloh_studentInitials(enrollment.studentName)}</div>`;
}

/* --- Jadval --------------------------------------------------------------- */

function isloh_studentRowHtml(row) {
  const e = row.enrollment;
  const meta = isloh_enrollmentStateMeta(row.state);
  const id = encodeURIComponent(e.studentId);

  return `<tr data-filter-item data-course="${row.courseId}" data-enrollment-id="${e.id}" data-filter-text="${e.studentName} ${e.email}">
    <td><div class="cell-main">${isloh_studentAvatarHtml(e)}<div>
      <div class="cell-title filter-title">${e.studentName}</div>
      <div class="cell-sub">${e.email}</div>
    </div></div></td>
    <td>${row.courseTitle}</td>
    <td><div class="cell-progress"><div class="progress-track"><div class="progress-fill${meta.fill}" style="width:${e.progress}%;"></div></div></div></td>
    <td>${e.avgScore}%</td>
    <td>🔥 ${e.streak}</td>
    <td><span class="badge ${meta.badge}">${meta.label}</span></td>
    <td><div class="row-actions">
      <a href="messages.html?u=${id}" class="row-action" aria-label="Xabar yozish"><i class="bi bi-chat-dots"></i></a>
      <button type="button" class="row-action" data-student-view aria-label="Talaba ma'lumotlari"><i class="bi bi-eye"></i></button>
    </div></td>
  </tr>`;
}

/* Kurs chiplari — do'konda talabasi bor kurslar. Chiplar filtr moduli
   ishga tushishidan OLDIN chizilishi kerak, shuning uchun bu fayl
   js/filterable.js dan oldin yuklanadi (students.html ga qara). */
function isloh_renderStudentFilters(rows) {
  const mount = document.querySelector('[data-student-filters]');
  if (!mount) return;

  /* Tartib kurs do'konidagi tartib bilan bir xil (jadval esa jarayon
     bo'yicha saralanadi) — chiplar qator tartibiga qarab sakramasin. */
  const seen = [];
  const order = typeof isloh_getCourses === 'function' ? isloh_getCourses().map((c) => c.id) : [];
  rows.slice()
    .sort((a, b) => order.indexOf(a.courseId) - order.indexOf(b.courseId))
    .forEach((row) => {
      if (!seen.some((c) => c.id === row.courseId)) seen.push({ id: row.courseId, title: row.courseTitle });
    });

  mount.innerHTML = '<button class="filter-chip active" data-filter-value="all">Barcha kurslar</button>'
    + seen.map((c) => `<button class="filter-chip" data-filter-value="${c.id}">${c.title}</button>`).join('');
}

/* Kurs yozuvidagi `students` (sotuvdan yig'ilgan umumiy son) va do'kondagi
   qatorlar soni farqi. Yashirilmaydi — aks holda bu sahifa "6 talaba" deb
   turib, dashboard va profil "2,330" derdi (js/course-details.js dagi
   dars soni izohi bilan bir xil yondashuv). */
function isloh_renderStudentCoverage() {
  const mount = document.querySelector('[data-student-coverage]');
  if (!mount) return;

  const coverage = isloh_enrollmentCoverage();
  if (coverage.complete) { mount.innerHTML = ''; return; }

  const format = typeof isloh_formatStatCount === 'function' ? isloh_formatStatCount : String;
  mount.innerHTML = `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Kurs yozuvlarida jami ${format(coverage.counted)} talaba ko'rsatilgan, ro'yxatga olish do'konida hozircha ${format(coverage.listed)} tasining yozuvi bor — qolgani backend ulanganda keladi.</p>`;
}

function isloh_renderStudents() {
  const mount = document.querySelector('[data-student-rows]');
  if (!mount) return; // bu sahifa emas

  const rows = isloh_getEnrollmentRows();
  mount.innerHTML = rows.map(isloh_studentRowHtml).join('');
  isloh_renderStudentFilters(rows);
  isloh_renderStudentCoverage();

  /* Ro'yxat qayta chizilsa filtr/qidiruv holati ham qayta hisoblansin. */
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Tafsilot oynasi ------------------------------------------------------
   Ilgari oyna qatordagi kataklarni o'qirdi; endi u to'g'ridan-to'g'ri
   do'kondagi yozuvni ko'rsatadi, ya'ni jadvalda ko'rinmaydigan maydonlar
   (ro'yxatga olingan sana, oxirgi faollik) ham chiqadi. */

function isloh_studentDetailRows(row) {
  const e = row.enrollment;
  const meta = isloh_enrollmentStateMeta(row.state);
  const date = (value) => (typeof isloh_dtShortDate === 'function' ? isloh_dtShortDate(value) : value);
  const ago = (value) => (typeof isloh_relativeTime === 'function' ? isloh_relativeTime(value) : value);

  return [
    ['Joriy kurs', row.courseTitle],
    ['Jarayon', e.progress + '%'],
    ["O'rtacha ball", e.avgScore + '%'],
    ['Seriya', '🔥 ' + e.streak + ' kun'],
    ['Faollik', meta.label],
    ["Ro'yxatga olingan", date(e.enrolledAt)],
    ['Oxirgi faollik', ago(e.lastActiveAt)]
  ];
}

function isloh_renderStudentDetail(row) {
  const e = row.enrollment;
  const nameEl = document.querySelector('[data-student-detail-name]');
  const mailEl = document.querySelector('[data-student-detail-email]');
  const listEl = document.querySelector('[data-student-detail-rows]');
  const mailLink = document.querySelector('[data-student-detail-message]');

  if (nameEl) nameEl.textContent = e.studentName;
  if (mailEl) mailEl.textContent = e.email;
  /* Xabarlar do'konidagi hisob id'si (js/chat-store.js) — havola aynan shu
     talaba bilan suhbatni ochadi. */
  if (mailLink) mailLink.href = e.studentId ? 'messages.html?u=' + encodeURIComponent(e.studentId) : 'messages.html';

  if (!listEl) return;
  listEl.innerHTML = isloh_studentDetailRows(row)
    .map(([label, value]) => `<div class="review-summary-row"><span class="lbl">${label}</span><span class="val">${value}</span></div>`)
    .join('');
}

function isloh_initStudentDetails() {
  const table = document.querySelector('[data-student-rows]');
  if (!table || !document.getElementById('student-detail-modal')) return;

  /* Hodisa delegatsiyasi: qatorlar qayta chizilishi mumkin. */
  table.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-student-view]');
    if (!btn) return;

    const id = btn.closest('tr').dataset.enrollmentId;
    const row = isloh_getEnrollmentRows().find((r) => r.enrollment.id === id);
    if (!row) return;

    isloh_renderStudentDetail(row);
    if (typeof isloh_openModal === 'function') isloh_openModal('student-detail-modal');
  });
}

document.addEventListener('isloh:enrollments-updated', isloh_renderStudents);
/* Kurs nomi o'zgarsa jadvaldagi "Joriy kurs" ustuni ham yangilansin. */
document.addEventListener('isloh:courses-updated', isloh_renderStudents);
document.addEventListener('DOMContentLoaded', () => {
  isloh_renderStudents();
  isloh_initStudentDetails();
});
