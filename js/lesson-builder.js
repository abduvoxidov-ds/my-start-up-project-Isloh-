/* ==========================================================================
   ISLOH — Lesson Builder module  (Sprint 5B)
   Powers pages/instructor/lesson-builder.html. Reuses js/filterable.js
   (search/filter by type), js/sortable.js (drag reorder), js/dropdown.js
   (quick actions), js/modal.js (add/delete dialogs).
   ========================================================================== */

let isloh_pendingLessonDelete = null;

const ISLOH_LESSON_TYPE_META = {
  video: { icon: 'bi-play-circle-fill', bg: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: 'Video' },
  article: { icon: 'bi-file-text-fill', bg: "linear-gradient(135deg,#8B5CF6,#6C5DD3)", label: 'Maqola' },
  quiz: { icon: 'bi-patch-question-fill', bg: 'linear-gradient(135deg,#F59E0B,#D97706)', label: 'Test' },
  assignment: { icon: 'bi-file-earmark-text-fill', bg: 'linear-gradient(135deg,#EA580C,#C2410C)', label: 'Topshiriq' },
  resource: { icon: 'bi-paperclip', bg: 'linear-gradient(135deg,#059669,#10B981)', label: 'Resurs' }
};

function isloh_initLessonActions() {
  const list = document.querySelector('[data-lessons-list]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-lesson"]');
    if (dupBtn) {
      const item = dupBtn.closest('.lesson-item');
      const clone = item.cloneNode(true);
      clone.querySelector('.lesson-title').textContent += " (nusxa)";
      item.after(clone);
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-lesson"]');
    if (delBtn) {
      isloh_pendingLessonDelete = delBtn.closest('.lesson-item');
      isloh_openModal('delete-lesson-modal');
    }
  });

  document.querySelector('[data-confirm-delete-lesson]')?.addEventListener('click', () => {
    isloh_pendingLessonDelete?.remove();
    isloh_pendingLessonDelete = null;
    isloh_closeModal('delete-lesson-modal');
  });
}

function isloh_initAddLesson() {
  const list = document.querySelector('[data-lessons-list]');
  const template = document.getElementById('lesson-template');
  const form = document.querySelector('[data-add-lesson-form]');
  if (!list || !template || !form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.querySelector('[name="title"]').value.trim() || 'Yangi dars';
    const type = form.querySelector('[name="type"]').value;
    const meta = ISLOH_LESSON_TYPE_META[type] || ISLOH_LESSON_TYPE_META.video;
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.dataset.type = type;
    clone.dataset.filterText = title;
    clone.querySelector('.lesson-title').textContent = title;
    clone.querySelector('.lesson-type-ic').style.background = meta.bg;
    clone.querySelector('.lesson-type-ic i').className = `bi ${meta.icon}`;
    clone.querySelector('[data-lesson-type-label]').textContent = meta.label;
    list.appendChild(clone);
    form.reset();
    isloh_closeModal('add-lesson-modal');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initLessonActions();
  isloh_initAddLesson();
});
