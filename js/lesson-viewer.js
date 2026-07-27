/* ==========================================================================
   ISLOH — Lesson Viewer module  (Sprint 7)
   Powers pages/student/course-player.html and pages/student/lesson-player.html.
   Lesson switching itself reuses js/tabs.js (each [data-cps-lesson] carries
   the .tab-item + data-tab-target contract, each content panel carries
   data-tab-panel) — this module only adds the behaviors tabs.js doesn't
   cover: module collapse, mark-complete, bookmark toggle, prev/next,
   frontend-only notes save and progress recompute.

   Markup contract:
     [data-cps-module-toggle]      → collapses a .cps-lesson-list
     [data-cps-lesson]             → sidebar lesson row (also a .tab-item)
       [data-lesson-done]          → optional, marks the row already complete
     [data-mark-complete]          → button inside the active lesson panel
     [data-lesson-bookmark]        → bookmark toggle button
     [data-lesson-prev] / [data-lesson-next] → step to sibling lesson
     [data-course-progress-fill] / [data-course-progress-pct] → recomputed
       whenever a lesson is marked complete
     [data-notes-save]             → saves the notes textarea (state only)
   ========================================================================== */

function isloh_lessonRows() {
  return [...document.querySelectorAll('[data-cps-lesson]')];
}

function isloh_updateCourseProgress() {
  const rows = isloh_lessonRows();
  if (!rows.length) return;
  const done = rows.filter((r) => r.classList.contains('is-done')).length;
  const pct = Math.round((done / rows.length) * 100);

  document.querySelectorAll('[data-course-progress-fill]').forEach((el) => { el.style.width = pct + '%'; });
  document.querySelectorAll('[data-course-progress-pct]').forEach((el) => { el.textContent = pct + '%'; });

  const banner = document.querySelector('[data-completion-banner]');
  if (banner) banner.hidden = pct < 100;
}

function isloh_initModuleToggles() {
  document.querySelectorAll('[data-cps-module-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.cps-module, .module-card');
      const list = container?.querySelector('.cps-lesson-list, .module-body');
      const icon = btn.querySelector('.cps-module-toggle') || btn;
      if (!list) return;
      list.classList.toggle('collapsed');
      icon.classList.toggle('collapsed');
    });
  });
}

function isloh_markLessonDone(row) {
  if (!row || row.classList.contains('is-done')) return;
  row.classList.add('is-done');
  const check = row.querySelector('[data-cps-lesson-check]');
  if (check) check.hidden = false;
  isloh_updateCourseProgress();
}

function isloh_initMarkComplete() {
  document.querySelectorAll('[data-mark-complete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const activeRow = document.querySelector('[data-cps-lesson].active');
      isloh_markLessonDone(activeRow);
      if (typeof isloh_showToast === 'function') isloh_showToast("Dars yakunlandi deb belgilandi", 'success');
    });
  });
}

function isloh_initBookmarkToggle() {
  document.querySelectorAll('[data-lesson-bookmark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const on = btn.classList.contains('active');
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(on ? "Darsga xatcho'p qo'yildi" : "Xatcho'p olib tashlandi", 'info');
      }
    });
  });
}

function isloh_initPrevNext() {
  document.querySelectorAll('[data-lesson-prev], [data-lesson-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rows = isloh_lessonRows();
      const activeIndex = rows.findIndex((r) => r.classList.contains('active'));
      if (activeIndex === -1) return;
      const dir = btn.hasAttribute('data-lesson-next') ? 1 : -1;
      const target = rows[activeIndex + dir];
      if (target) target.click();
    });
  });
}

function isloh_initNotesSave() {
  document.querySelectorAll('[data-notes-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_showToast === 'function') isloh_showToast('Izoh saqlandi', 'success');
    });
  });
}

function isloh_initLessonViewer() {
  // Module expand/collapse is reused on plain curriculum previews (e.g.
  // course-landing.html) too, so it always initializes.
  isloh_initModuleToggles();
  if (!isloh_lessonRows().length) return;
  isloh_initMarkComplete();
  isloh_initBookmarkToggle();
  isloh_initPrevNext();
  isloh_initNotesSave();
  isloh_updateCourseProgress();
}

document.addEventListener('DOMContentLoaded', isloh_initLessonViewer);
