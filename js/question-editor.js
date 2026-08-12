/* ==========================================================================
   ISLOH — Question Editor module  (Sprint 6A)
   Powers the shared #question-editor-modal markup embedded in both
   pages/instructor/quiz-editor.html and pages/instructor/question-bank.html
   (same modal, same script — DRY instead of two near-identical editors).

   Reuses:
     js/lesson-editor.js  → generic [data-add-row]/[data-row-list]/
                             [data-remove-row] engine powers the option,
                             matching-pair, ordering-item and fill-blank
                             repeating rows — no new "add row" code here.
     js/course-wizard.js  → [data-char-counter] powers the title/
                             instructions/explanation counters.
     js/modal.js           → open/close.

   New here (question-editor-specific only):
     - [data-question-type-select] switches which [data-qtype-panel="…"]
       is visible.
     - Correct-answer marking: radio behavior for single-answer types,
       independent toggle for multi-answer types (both via .qo-mark
       checkboxes/radios + .is-correct row tint).
     - Live preview sync into [data-qe-preview].
     - Basic required-field validation on save.
   ========================================================================== */

function isloh_initQuestionTypeSwitch() {
  const select = document.getElementById('qe-type');
  if (!select) return;

  function sync() {
    const value = select.value;
    document.querySelectorAll('[data-qtype-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.qtypePanel !== value;
    });
    isloh_syncQuestionPreview();
  }
  select.addEventListener('change', sync);
  sync();
}

function isloh_initCorrectAnswerMarking() {
  const modal = document.getElementById('question-editor-modal');
  if (!modal) return;

  modal.addEventListener('change', (e) => {
    const mark = e.target.closest('.qo-mark');
    if (!mark) return;
    const row = mark.closest('.question-option-row');

    if (mark.type === 'radio') {
      document.querySelectorAll(`input[name="${mark.name}"]`).forEach((r) => r.closest('.question-option-row')?.classList.remove('is-correct'));
      row?.classList.add('is-correct');
    } else {
      row?.classList.toggle('is-correct', mark.checked);
    }
    isloh_syncQuestionPreview();
  });
}

function isloh_syncQuestionPreview() {
  const modal = document.getElementById('question-editor-modal');
  const preview = modal?.querySelector('[data-qe-preview]');
  if (!modal || !preview) return;

  const title = modal.querySelector('#qe-title')?.value.trim() || "Savol matni shu yerda ko'rinadi";
  const type = modal.querySelector('#qe-type')?.value;
  const meta = { single:"Bitta tanlov", multi:"Ko'p tanlov", boolean:"To'g'ri/Noto'g'ri", short:"Qisqa javob", long:"Batafsil javob", match:"Moslashtirish", order:"Tartiblash", blank:"Bo'sh joyni to'ldirish" }[type] || '';

  preview.querySelector('[data-qe-preview-title]').textContent = title;
  preview.querySelector('[data-qe-preview-type]').textContent = meta;

  const optsWrap = preview.querySelector('[data-qe-preview-options]');
  optsWrap.innerHTML = '';
  const visiblePanel = modal.querySelector(`[data-qtype-panel="${type}"]`);
  const optionInputs = visiblePanel ? [...visiblePanel.querySelectorAll('.question-option-row input[type="text"], .question-option-row input:not([type])')] : [];

  optionInputs.forEach((input, i) => {
    const row = input.closest('.question-option-row');
    const li = document.createElement('div');
    li.className = 'opt-row';
    li.style.marginBottom = '6px';
    const isCorrect = row?.classList.contains('is-correct');
    li.innerHTML = `<i class="bi ${isCorrect ? 'bi-check-circle-fill' : 'bi-circle'}" style="color:${isCorrect ? 'var(--teach-green)' : 'var(--ink-300)'};"></i> ${input.value.trim() || `Variant ${i + 1}`}`;
    optsWrap.appendChild(li);
  });

  if (!optionInputs.length) {
    optsWrap.innerHTML = `<p style="font-size:12.5px; color:var(--ink-300);">Bu savol turi uchun variantlar yo'q — talaba matn kiritadi yoki elementlarni tartiblaydi.</p>`;
  }
}

function isloh_initQuestionPreviewSync() {
  const modal = document.getElementById('question-editor-modal');
  if (!modal) return;
  modal.addEventListener('input', isloh_syncQuestionPreview);
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-row], [data-remove-row]')) {
      setTimeout(isloh_syncQuestionPreview, 0);
    }
  });
}

/* --- Do'kon bilan bog'lanish ----------------------------------------------
   Modal ikkala sahifada bir xil, shuning uchun ochish/to'ldirish/saqlash
   ham shu yerda — savollar bazasi ham, test muharriri ham o'z nusxasini
   yozmasin (CLAUDE.md §2).

   `modal.dataset.editingId` — tahrirlanayotgan savol id'si. Bo'sh bo'lsa
   yangi savol yaratilyapti. Ilgari bu yerda `editingRow` bor edi, lekin
   hech qachon o'qilmasdi: "tahrirlash" ham har safar YANGI savol
   yaratardi. */

const ISLOH_QE_FIELDS = {
  title: 'qe-title',
  type: 'qe-type',
  difficulty: 'qe-difficulty',
  category: 'qe-category',
  instructions: 'qe-instructions',
  explanation: 'qe-explanation',
  hint: 'qe-hint'
};

function isloh_qeValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* Modaldagi maydonlardan savol obyektini yig'adi. */
function isloh_readQuestionForm() {
  const data = {};
  Object.keys(ISLOH_QE_FIELDS).forEach((name) => {
    const el = document.getElementById(ISLOH_QE_FIELDS[name]);
    if (el) data[name] = el.value.trim();
  });
  data.points = parseInt(isloh_qeValue('qe-points'), 10) || 0;
  return data;
}

/* Savolni modalga yozadi. `questionId` bo'lmasa — bo'sh forma. */
function isloh_openQuestionEditor(questionId) {
  const modal = document.getElementById('question-editor-modal');
  if (!modal) return;

  const question = questionId && typeof isloh_getQuestion === 'function'
    ? isloh_getQuestion(questionId)
    : null;

  modal.dataset.editingId = question ? question.id : '';
  modal.querySelector('.modal-head b').textContent = question ? 'Savolni tahrirlash' : "Yangi savol qo'shish";

  Object.keys(ISLOH_QE_FIELDS).forEach((name) => {
    const el = document.getElementById(ISLOH_QE_FIELDS[name]);
    if (el) el.value = question ? (question[name] || '') : '';
  });

  const points = document.getElementById('qe-points');
  if (points) points.value = question ? question.points : 5;

  const type = document.getElementById('qe-type');
  if (type && !question) type.value = 'single';

  document.getElementById('qe-title')?.classList.remove('is-invalid');
  document.getElementById('qe-title')?.dispatchEvent(new Event('input'));
  type?.dispatchEvent(new Event('change'));

  if (typeof isloh_openModal === 'function') isloh_openModal('question-editor-modal');
}

function isloh_initQuestionSave() {
  document.querySelector('[data-save-question]')?.addEventListener('click', () => {
    const titleInput = document.getElementById('qe-title');
    if (!titleInput.value.trim()) {
      titleInput.classList.add('is-invalid');
      if (typeof isloh_showToast === 'function') isloh_showToast("Savol matnini kiriting", 'error');
      return;
    }
    titleInput.classList.remove('is-invalid');

    const modal = document.getElementById('question-editor-modal');
    const editingId = modal ? modal.dataset.editingId : '';
    const data = isloh_readQuestionForm();
    if (editingId) data.id = editingId;

    const saved = isloh_saveQuestion(data);
    if (!saved) {
      if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    /* Test muharririda yaratilgan YANGI savol darhol shu testga qo'shiladi.
       Ilgari u faqat bankka tushardi va qaysi testga tegishli ekani hech
       qayerda yozilmasdi — natijada u barcha testlarda ko'rinardi. */
    if (!editingId && typeof isloh_quizEditorId === 'function' && isloh_quizEditorId()) {
      isloh_addQuestionToQuiz(isloh_quizEditorId(), saved.id);
    }

    if (typeof isloh_closeModal === 'function') isloh_closeModal('question-editor-modal');
    document.dispatchEvent(new CustomEvent('isloh:question-saved', { detail: saved }));
    if (typeof isloh_showToast === 'function') isloh_showToast('Savol saqlandi', 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initQuestionTypeSwitch();
  isloh_initCorrectAnswerMarking();
  isloh_initQuestionPreviewSync();
  isloh_initQuestionSave();
});
