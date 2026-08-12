/* ==========================================================================
   ISLOH — Baholash navbati (pages/instructor/assignments.html)

   Jadval va statistika js/assignment-store.js dagi `isloh_submissions`
   do'konidan chiziladi. Bu sahifa TOPSHIRILGAN ISHLAR haqida, topshiriq
   loyihalari haqida emas (ular assignment-builder.html da).

   NEGA O'ZGARDI: ilgari 5 ta qator HTML ichida qo'lda yozilgan edi va
   ustidagi statistika (8 / 124 / 3 / 82%) ular bilan hech qanday
   bog'liq emas edi. Eng yomoni — "Baholash" tugmalarining HAMMASI
   parametrsiz `assignment-editor.html` ga olib borardi, ya'ni qaysi
   talabaning ishi ochilishi kerakligi umuman ma'lum emas edi.

   Endi "Baholash" tugmasi baholash oynasini ochadi: ball va izoh
   yoziladi va ular do'konga tushadi. Alohida "baholash sahifasi" ataylab
   yaratilmadi — assignment-editor.html topshiriqning O'ZINI tahrirlaydi,
   talaba ishini emas.

   Markup shartnomasi:
     [data-submission-rows]        → jadval tanasi
     [data-submission-stat="..."]  → pending | reviewed | late | avgScore
     #grade-submission-modal
       [data-grade-student] / [data-grade-assignment] / [data-grade-max]
       [data-grade-score] / [data-grade-feedback] / [data-grade-save]
   ========================================================================== */

let isloh_pendingGradeId = null;

/* --- Jadval --------------------------------------------------------------- */

/* Ball ustuni: baholanmagan ish uchun "—", baholangani uchun "88 / 100". */
function isloh_submissionScoreHtml(row) {
  if (row.submission.score === null || row.submission.score === undefined) return '<td>—</td>';
  return `<td class="text-bold">${row.submission.score} / ${row.assignment.maxScore}</td>`;
}

function isloh_submissionRowHtml(row) {
  const meta = ISLOH_SUBMISSION_STATES[row.state] || ISLOH_SUBMISSION_STATES.pending;
  const graded = row.state === 'reviewed';
  const id = row.submission.id;

  /* Qidiruv ham topshiriq nomi, ham talaba ismi bo'yicha ishlasin. */
  const searchText = row.assignment.title + ' ' + row.submission.studentName;

  return `<tr data-filter-item data-state="${row.state}" data-filter-text="${searchText}">
    <td><div class="cell-main">
      <div class="cell-thumb ${meta.thumb}"><i class="bi ${meta.icon}"></i></div>
      <div>
        <div class="cell-title filter-title">${row.assignment.title}</div>
        <div class="cell-sub">${isloh_submitTypeMeta(row.assignment.submitType).label}</div>
      </div>
    </div></td>
    <td>${row.submission.studentName}</td>
    <td>${row.courseTitle}</td>
    <td>${isloh_relativeTime(row.submission.submittedAt)}</td>
    <td><span class="badge ${meta.badge}">${meta.label}</span></td>
    ${isloh_submissionScoreHtml(row)}
    <td><button type="button" class="btn btn-sm ${graded ? 'btn-outline' : 'btn-teach'}" data-grade-open="${id}">${graded ? "Ko'rish" : 'Baholash'}</button></td>
  </tr>`;
}

function isloh_renderSubmissionStats() {
  const stats = isloh_submissionStats();
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-submission-stat="${key}"]`);
    if (!el) return;
    el.textContent = key === 'avgScore' ? stats[key] + '%' : stats[key];
  });
}

function isloh_renderSubmissionQueue() {
  const body = document.querySelector('[data-submission-rows]');
  if (!body) return;

  body.innerHTML = isloh_getSubmissionQueue().map(isloh_submissionRowHtml).join('');
  isloh_renderSubmissionStats();

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Baholash oynasi ------------------------------------------------------ */

function isloh_openGradeModal(submissionId) {
  const row = isloh_getSubmissionQueue().find((r) => r.submission.id === submissionId);
  if (!row) return;

  isloh_pendingGradeId = submissionId;

  const set = (attr, value) => {
    const el = document.querySelector('[' + attr + ']');
    if (el) el.textContent = value;
  };
  set('data-grade-student', row.submission.studentName);
  set('data-grade-assignment', row.assignment.title + ' · ' + row.courseTitle);
  set('data-grade-max', row.assignment.maxScore);
  set('data-grade-submitted', isloh_relativeTime(row.submission.submittedAt));

  const scoreEl = document.querySelector('[data-grade-score]');
  if (scoreEl) {
    scoreEl.max = row.assignment.maxScore;
    scoreEl.value = row.submission.score === null || row.submission.score === undefined ? '' : row.submission.score;
  }

  const feedbackEl = document.querySelector('[data-grade-feedback]');
  if (feedbackEl) feedbackEl.value = row.submission.feedback || '';

  /* Kechikkan ish uchun ogohlantirish — jarima foizi topshiriq
     sozlamalarida turadi, o'qituvchi buni bilib turib ball qo'ysin. */
  const lateNote = document.querySelector('[data-grade-late-note]');
  if (lateNote) {
    const isLate = isloh_submissionIsLate(row.submission, row.assignment);
    lateNote.hidden = !isLate;
    if (isLate) {
      lateNote.textContent = row.assignment.allowLate
        ? `Kechikkan topshirish · har kunlik jarima ${row.assignment.latePenalty}%`
        : 'Kechikkan topshirish · bu topshiriqda kechikishga ruxsat yo\'q';
    }
  }

  if (typeof isloh_openModal === 'function') isloh_openModal('grade-submission-modal');
}

function isloh_initGradeModal() {
  const body = document.querySelector('[data-submission-rows]');
  if (!body) return;

  body.addEventListener('click', (e) => {
    const open = e.target.closest('[data-grade-open]');
    if (open) isloh_openGradeModal(open.dataset.gradeOpen);
  });

  document.querySelector('[data-grade-save]')?.addEventListener('click', () => {
    if (!isloh_pendingGradeId) return;

    const scoreEl = document.querySelector('[data-grade-score]');
    const feedbackEl = document.querySelector('[data-grade-feedback]');
    const raw = scoreEl ? scoreEl.value.trim() : '';

    if (raw === '') {
      if (typeof isloh_showToast === 'function') isloh_showToast('Ball kiritilmadi', 'error');
      return;
    }

    const max = Number(scoreEl.max) || 100;
    const score = Math.min(Math.max(Number(raw) || 0, 0), max);

    const saved = isloh_gradeSubmission(isloh_pendingGradeId, score, feedbackEl ? feedbackEl.value.trim() : '');
    isloh_pendingGradeId = null;
    isloh_renderSubmissionQueue();

    if (typeof isloh_closeModal === 'function') isloh_closeModal('grade-submission-modal');
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(saved ? 'Baho saqlandi' : "Saqlab bo'lmadi", saved ? 'success' : 'error');
    }
  });

  /* Bahoni bekor qilish — ish yana navbatga qaytadi. */
  document.querySelector('[data-grade-clear]')?.addEventListener('click', () => {
    if (!isloh_pendingGradeId) return;
    isloh_gradeSubmission(isloh_pendingGradeId, null, '');
    isloh_pendingGradeId = null;
    isloh_renderSubmissionQueue();
    if (typeof isloh_closeModal === 'function') isloh_closeModal('grade-submission-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast('Baho olib tashlandi');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderSubmissionQueue();
  isloh_initGradeModal();
});
