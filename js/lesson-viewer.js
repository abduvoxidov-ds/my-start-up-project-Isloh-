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
     [data-notes-input] / [data-notes-save] / [data-notes-status]
       → per-lesson notes, persisted under ISLOH_NOTES_KEY (see below)

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

/* --- Faol dars sarlavhasi va hisoblagichlar ------------------------------
   Ilgari sarlavha, meta va "Dars N / M" markupda qattiq yozilgan edi va
   dars almashganda o'zgarmay qolardi — foydalanuvchi qaysi darsni ochganini
   bilmasdi. Modul hisoblagichlari ("3/6") va kursdagi jami darslar soni ham
   qo'lda yozilgani uchun haqiqiy darslar soniga mos kelmasdi. Endi hammasi
   dars qatorlaridan hisoblanadi.

   Markup shartnomasi:
     [data-lesson-title]        -> faol dars nomi
     [data-lesson-module]       -> modul nomi
     [data-lesson-time]         -> davomiylik
     [data-lesson-meta-item]    -> meta bandining o'ramasi; ichidagi qiymat
                                   bo'sh bo'lsa butun band yashiriladi
                                   (lesson-player.html da vaqt/modul yo'q)
     [data-lesson-counter]      -> "Dars N / M"
     [data-module-counter]      -> modul ichida "bajarilgan/jami"
     [data-course-lesson-total] -> kursdagi jami darslar                  */

function isloh_activeLessonRow() {
  return document.querySelector('[data-cps-lesson].active');
}

function isloh_setLessonMeta(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value || '';
    const item = el.closest('[data-lesson-meta-item]');
    if (item) item.hidden = !value;
  });
}

function isloh_syncLessonHeader() {
  const rows = isloh_lessonRows();
  const row = isloh_activeLessonRow();
  if (!row) return;

  const title = row.querySelector('.cps-lesson-name');
  const time = row.querySelector('.cps-lesson-time');
  const moduleTitle = row.closest('.cps-module')?.querySelector('.cps-module-title');

  document.querySelectorAll('[data-lesson-title]').forEach((el) => {
    el.textContent = title ? title.textContent.trim() : '';
  });
  isloh_setLessonMeta('[data-lesson-module]', moduleTitle ? moduleTitle.textContent.trim() : '');
  isloh_setLessonMeta('[data-lesson-time]', time ? time.textContent.trim() : '');

  const index = rows.indexOf(row);
  document.querySelectorAll('[data-lesson-counter]').forEach((el) => {
    el.textContent = index === -1 ? '' : 'Dars ' + (index + 1) + ' / ' + rows.length;
  });
}

/* Har bir modul yonidagi "bajarilgan/jami" va kursdagi umumiy darslar soni */
function isloh_updateLessonCounters(rows) {
  document.querySelectorAll('[data-module-counter]').forEach((el) => {
    const scope = el.closest('.cps-module');
    const moduleRows = scope ? [...scope.querySelectorAll('[data-cps-lesson]')] : [];
    const done = moduleRows.filter((r) => r.classList.contains('is-done')).length;
    el.textContent = done + '/' + moduleRows.length;
  });

  document.querySelectorAll('[data-course-lesson-total]').forEach((el) => {
    el.textContent = rows.length + ' dars';
  });
}

function isloh_updateCourseProgress() {
  const rows = isloh_lessonRows();
  if (!rows.length) return;
  const done = rows.filter((r) => r.classList.contains('is-done')).length;
  const pct = Math.round((done / rows.length) * 100);

  document.querySelectorAll('[data-course-progress-fill]').forEach((el) => { el.style.width = pct + '%'; });
  document.querySelectorAll('[data-course-progress-pct]').forEach((el) => { el.textContent = pct + '%'; });
  isloh_updateLessonCounters(rows);

  const banner = document.querySelector('[data-completion-banner]');
  if (banner) banner.hidden = pct < 100;
}

/* Dars almashganda bajariladigan hamma narsa shu yerda to'planadi */
function isloh_handleLessonChange() {
  isloh_syncLessonHeader();
  isloh_loadLessonNote();
}

/* js/tabs.js bu fayldan oldin yuklanadi, shuning uchun uning click
   tinglovchisi birinchi ro'yxatdan o'tadi va `.active` klassini biz
   o'qishimizdan oldin ko'chirib bo'ladi. */
function isloh_initLessonChangeSync() {
  document.querySelectorAll('[data-cps-lesson]').forEach((row) => {
    row.addEventListener('click', isloh_handleLessonChange);
  });
  isloh_handleLessonChange();
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

// Dars qatoridagi .lt-* klassi material turini bildiradi — "Saqlanganlar"
// sahifasidagi filtr chiplariga shu yerda moslanadi.
const ISLOH_LESSON_TYPE_MAP = { 'lt-video': 'lesson', 'lt-article': 'article', 'lt-code': 'code', 'lt-quiz': 'lesson' };

function isloh_lessonMaterialType(row) {
  const ic = row?.querySelector('.cps-lesson-ic');
  const hit = ic && [...ic.classList].find((c) => ISLOH_LESSON_TYPE_MAP[c]);
  return hit ? ISLOH_LESSON_TYPE_MAP[hit] : 'lesson';
}

// Faol darsdan "Saqlanganlar" uchun material obyektini yig'adi
function isloh_activeLessonMaterial() {
  const row = document.querySelector('[data-cps-lesson].active');
  if (!row) return null;
  const courseId = isloh_courseId();
  const lessonId = isloh_lessonId(row);
  const title = row.querySelector('.cps-lesson-name')?.textContent.trim() || 'Dars';
  const time = row.querySelector('.cps-lesson-time')?.textContent.trim() || '';
  const course = document.querySelector('.cps-course-title')?.textContent.trim() || '';

  return {
    id: `${courseId || 'course'}:${lessonId || title}`,
    type: isloh_lessonMaterialType(row),
    title,
    sub: [time, course].filter(Boolean).join(' · '),
    href: `course-player.html${courseId ? '?id=' + courseId : ''}`
  };
}

// Faol darsning xatcho'p holatini tugmada ko'rsatadi
function isloh_syncLessonBookmarkBtn() {
  if (typeof isloh_isBookmarked !== 'function') return;
  const material = isloh_activeLessonMaterial();
  const on = material ? isloh_isBookmarked(material.id) : false;
  document.querySelectorAll('[data-lesson-bookmark]').forEach((btn) => {
    btn.classList.toggle('active', on);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-bookmark', !on);
      icon.classList.toggle('bi-bookmark-fill', on);
    }
  });
}

function isloh_initBookmarkToggle() {
  document.querySelectorAll('[data-lesson-bookmark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const material = isloh_activeLessonMaterial();
      // js/bookmarks.js yuklanmagan bo'lsa — eski vizual xatti-harakat
      if (!material || typeof isloh_toggleBookmark !== 'function') {
        btn.classList.toggle('active');
        return;
      }
      const on = isloh_toggleBookmark(material);
      isloh_syncLessonBookmarkBtn();
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(on ? "Darsga xatcho'p qo'yildi" : "Xatcho'p olib tashlandi", 'info');
      }
    });
  });

  // Dars almashganda tugma holati ham yangilansin
  document.querySelectorAll('[data-cps-lesson]').forEach((row) => {
    row.addEventListener('click', () => setTimeout(isloh_syncLessonBookmarkBtn, 0));
  });

  isloh_syncLessonBookmarkBtn();
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

/* --- Dars izohlari -------------------------------------------------------
   Ilgari "Izohni saqlash" faqat toast chiqarardi va matn hech qayerga
   yozilmasdi: foydalanuvchi izohi saqlandi deb o'ylab sahifani yopar va
   hammasini yo'qotardi.

   Do'konning o'zi js/notes-store.js da (u "Izohlarim" sahifasi bilan
   umumiy), bu yerda faqat DOM bilan bog'lash qoladi. Shu sababli hamma
   chaqiruvlar typeof bilan himoyalangan — notes-store.js ulanmagan
   sahifada pleer baribir ishlashda davom etadi.

   Markup shartnomasi:
     [data-notes-input]  -> textarea
     [data-notes-save]   -> saqlash tugmasi
     [data-notes-status] -> oxirgi saqlangan vaqt (ixtiyoriy)              */

function isloh_notesStoreReady() {
  return typeof isloh_setLessonNote === 'function' && typeof isloh_getLessonNote === 'function';
}

/* Izoh kartochkasida ko'rinadigan sarlavha/kurs nomi — dars qatoridan */
function isloh_activeLessonNoteMeta() {
  const row = isloh_activeLessonRow();
  const lessonTitle = row?.querySelector('.cps-lesson-name')?.textContent.trim() || '';
  const courseTitle = document.querySelector('.cps-course-title')?.textContent.trim() || '';
  return { title: lessonTitle, lessonTitle, courseTitle };
}

function isloh_formatNoteDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function isloh_renderNoteStatus(note) {
  document.querySelectorAll('[data-notes-status]').forEach((el) => {
    const stamp = note ? isloh_formatNoteDate(note.updatedAt) : '';
    el.textContent = stamp ? 'Oxirgi saqlangan: ' + stamp : '';
    el.hidden = !stamp;
  });
}

/* Dars almashganda o'sha darsning izohi textarea'ga qaytariladi */
function isloh_loadLessonNote() {
  const input = document.querySelector('[data-notes-input]');
  if (!input || !isloh_notesStoreReady()) return;
  const note = isloh_getLessonNote(isloh_courseId(), isloh_lessonId(isloh_activeLessonRow()));
  input.value = note ? note.text : '';
  isloh_renderNoteStatus(note);
}

function isloh_initNotesSave() {
  const input = document.querySelector('[data-notes-input]');

  document.querySelectorAll('[data-notes-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!input || !isloh_notesStoreReady()) return;
      const courseId = isloh_courseId();
      const lessonId = isloh_lessonId(isloh_activeLessonRow());
      if (!courseId || !lessonId) return;

      const hadText = input.value.trim().length > 0;
      if (!isloh_setLessonNote(courseId, lessonId, input.value, isloh_activeLessonNoteMeta())) {
        if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }

      isloh_renderNoteStatus(isloh_getLessonNote(courseId, lessonId));
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(hadText ? 'Izoh saqlandi' : "Izoh o'chirildi", 'success');
      }
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
  isloh_initLessonChangeSync();
  isloh_updateCourseProgress();
  isloh_initStudyTimer();
}

document.addEventListener('DOMContentLoaded', isloh_initLessonViewer);
