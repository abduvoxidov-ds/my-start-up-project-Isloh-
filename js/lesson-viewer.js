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
     [data-course-id]              → anywhere on the page, identifies the
       course for the persisted-progress schema below
     [data-cps-lesson]             → sidebar lesson row (also a .tab-item);
       its data-tab-target doubles as the lesson id for that schema
       [data-lesson-done]          → optional, marks the row already complete
     [data-mark-complete]          → button inside the active lesson panel
     [data-lesson-bookmark]        → bookmark toggle button
     [data-lesson-prev] / [data-lesson-next] → step to sibling lesson
     [data-course-progress-fill] / [data-course-progress-pct] → recomputed
       whenever a lesson is marked complete
     [data-notes-save]             → saves the notes textarea (state only)

   Persisted progress: localStorage key ISLOH_COURSE_PROGRESS_KEY holds
   { [courseId]: { [lessonId]: true } } so completed lessons survive a
   reload instead of resetting to whatever is-done classes are baked into
   the HTML — mirrors the {courseId: {lessonId: true}} shape planned for
   the future backend API, so swapping the storage layer later doesn't
   require redesigning the schema.
   ========================================================================== */

const ISLOH_COURSE_PROGRESS_KEY = 'isloh_course_progress';

function isloh_lessonRows() {
  return [...document.querySelectorAll('[data-cps-lesson]')];
}

function isloh_courseId() {
  const el = document.querySelector('[data-course-id]');
  return el ? el.dataset.courseId : null;
}

function isloh_lessonId(row) {
  return row ? row.dataset.tabTarget || null : null;
}

function isloh_getCourseProgress() {
  let all = null;
  try { all = JSON.parse(localStorage.getItem(ISLOH_COURSE_PROGRESS_KEY)); } catch (e) { all = null; }
  return all || {};
}

function isloh_saveCourseProgress(all) {
  localStorage.setItem(ISLOH_COURSE_PROGRESS_KEY, JSON.stringify(all));
}

function isloh_persistLessonDone(row) {
  const courseId = isloh_courseId();
  const lessonId = isloh_lessonId(row);
  if (!courseId || !lessonId) return;
  const all = isloh_getCourseProgress();
  if (!all[courseId]) all[courseId] = {};
  all[courseId][lessonId] = true;
  isloh_saveCourseProgress(all);
}

/* Runs before isloh_updateCourseProgress() so the first paint already
   reflects real history. First time a course is seen on this device there's
   nothing stored yet, so whatever is-done classes are already baked into
   the HTML become the seeded baseline instead of being silently discarded. */
function isloh_restoreLessonProgress() {
  const courseId = isloh_courseId();
  if (!courseId) return;
  const all = isloh_getCourseProgress();
  const courseProgress = all[courseId] || {};
  let seeded = false;

  isloh_lessonRows().forEach((row) => {
    const lessonId = isloh_lessonId(row);
    if (!lessonId) return;
    const stored = courseProgress[lessonId];
    const markupDone = row.classList.contains('is-done');

    if (stored === undefined) {
      courseProgress[lessonId] = markupDone;
      seeded = true;
      return;
    }
    if (stored === markupDone) return;
    row.classList.toggle('is-done', stored);
    const check = row.querySelector('[data-cps-lesson-check]');
    if (check) check.hidden = !stored;
  });

  if (seeded) {
    all[courseId] = courseProgress;
    isloh_saveCourseProgress(all);
  }
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
  isloh_persistLessonDone(row);
  if (typeof isloh_recordLessonCompleted === 'function') isloh_recordLessonCompleted();
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

/* Feeds real study time into js/progress-metrics.js while a lesson page is
   open: one minute per tick, only while the tab is actually visible, so
   Analitika's totalStudyMinutes/heatmap reflect time actually spent instead
   of staying frozen at the seeded defaults. */
function isloh_initStudyTimer() {
  if (typeof isloh_recordStudyMinutes !== 'function') return;
  setInterval(() => {
    if (document.hidden) return;
    isloh_recordStudyMinutes(1);
  }, 60000);
}

function isloh_initLessonViewer() {
  // Module expand/collapse is reused on plain curriculum previews (e.g.
  // course-landing.html) too, so it always initializes.
  isloh_initModuleToggles();
  if (!isloh_lessonRows().length) return;
  isloh_restoreLessonProgress();
  isloh_initMarkComplete();
  isloh_initBookmarkToggle();
  isloh_initPrevNext();
  isloh_initNotesSave();
  isloh_updateCourseProgress();
  isloh_initStudyTimer();
}

document.addEventListener('DOMContentLoaded', isloh_initLessonViewer);
