/* ==========================================================================
   ISLOH — Savollar banki (pages/instructor/question-bank.html)

   Jadval va statistika js/question-store.js dagi `isloh_questions`
   do'konidan chiziladi.

   NEGA O'ZGARDI: 5 ta qator HTML ichida yozilgan edi va do'kondagi
   savollar ULAR USTIGA qo'shilardi — ya'ni markupdagi qatorlarni hech
   qachon o'chirib bo'lmasdi (ular ma'lumot emas, HTML edi). Nusxalash
   DOM'da nusxa yasardi, arxivlash esa faqat `data-status` ni
   almashtirardi; sahifa yangilansa hammasi qaytib kelardi. Statistika
   (142 / 6 / 28 / 9) ham ro'yxat bilan bog'liq emas edi.

   Umumiy xatti-harakatlar: js/filterable.js (kategoriya/tur/qiyinlik/holat
   chiplari + qidiruv), js/courses.js (skeleton + ko'p tanlash),
   js/dropdown.js, js/modal.js. Savol yaratish/tahrirlash esa umumiy
   #question-editor-modal (js/question-editor.js).
   ========================================================================== */

let isloh_pendingBankDelete = null;

function isloh_renderBankStats() {
  const stats = isloh_questionStats();
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-bank-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  });
}

function isloh_renderQuestionBank() {
  const body = document.querySelector('[data-bank-rows]');
  if (!body) return;

  body.innerHTML = isloh_getQuestions().map(isloh_questionRowHtml).join('');
  isloh_renderBankStats();

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

function isloh_bankToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_initBankRowActions() {
  const table = document.querySelector('[data-bank-table]');
  if (!table) return;

  table.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-question-edit]');
    if (edit) {
      isloh_openQuestionEditor(edit.dataset.questionEdit);
      return;
    }

    const duplicate = e.target.closest('[data-question-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateQuestion(duplicate.dataset.questionDuplicate);
      isloh_renderQuestionBank();
      isloh_bankToast(copy ? 'Savol nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const archive = e.target.closest('[data-question-archive]');
    if (archive) {
      isloh_setQuestionStatus(archive.dataset.questionArchive, 'archived');
      isloh_renderQuestionBank();
      isloh_bankToast('Savol arxivlandi');
      return;
    }

    const restore = e.target.closest('[data-question-restore]');
    if (restore) {
      isloh_setQuestionStatus(restore.dataset.questionRestore, 'active');
      isloh_renderQuestionBank();
      isloh_bankToast('Savol tiklandi');
      return;
    }

    const del = e.target.closest('[data-question-delete]');
    if (del) {
      isloh_pendingBankDelete = del.dataset.questionDelete;
      const question = isloh_getQuestion(isloh_pendingBankDelete);
      const nameEl = document.querySelector('[data-delete-question-name]');
      const usageEl = document.querySelector('[data-delete-question-usage]');
      if (nameEl) nameEl.textContent = question ? question.title : '';

      /* O'chirish testlarga ham ta'sir qiladi — buni oldindan aytamiz. */
      if (usageEl) {
        const usage = isloh_questionUsage(isloh_pendingBankDelete);
        usageEl.hidden = !usage;
        if (usage) usageEl.textContent = `Bu savol ${usage} ta testda ishlatilgan — ulardan ham chiqarib tashlanadi.`;
      }
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-bank-question-modal');
    }
  });

  document.querySelector('[data-confirm-delete-bank-question]')?.addEventListener('click', () => {
    if (isloh_pendingBankDelete) {
      isloh_deleteQuestion(isloh_pendingBankDelete);
      isloh_pendingBankDelete = null;
      isloh_renderQuestionBank();
      isloh_bankToast("Savol o'chirildi");
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-bank-question-modal');
  });
}

function isloh_initAddBankQuestionButton() {
  document.querySelector('[data-add-bank-question-btn]')
    ?.addEventListener('click', () => isloh_openQuestionEditor(''));
}

function isloh_selectedQuestionIds() {
  return [...document.querySelectorAll('[data-select-item]:checked')]
    .map((el) => el.dataset.questionId)
    .filter(Boolean);
}

function isloh_initBankBulkActions() {
  const bar = document.querySelector('[data-bulk-bar]');
  if (!bar) return;

  const run = (action, done) => {
    const ids = isloh_selectedQuestionIds();
    if (!ids.length) return;
    ids.forEach(action);
    isloh_renderQuestionBank();
    isloh_bankToast(done.replace('{n}', ids.length));
  };

  bar.querySelector('[data-bulk-archive]')?.addEventListener('click', () => {
    run((id) => isloh_setQuestionStatus(id, 'archived'), '{n} ta savol arxivlandi');
  });
  bar.querySelector('[data-bulk-duplicate]')?.addEventListener('click', () => {
    run((id) => isloh_duplicateQuestion(id), '{n} ta savol nusxalandi');
  });
  bar.querySelector('[data-bulk-delete]')?.addEventListener('click', () => {
    run((id) => isloh_deleteQuestion(id), "{n} ta savol o'chirildi");
  });
}

document.addEventListener('isloh:question-saved', isloh_renderQuestionBank);

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderQuestionBank();
  isloh_initBankRowActions();
  isloh_initAddBankQuestionButton();
  isloh_initBankBulkActions();
});
