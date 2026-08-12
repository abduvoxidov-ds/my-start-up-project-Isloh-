/* ==========================================================================
   ISLOH — Dars muharriri formasi (pages/instructor/lesson-editor.html)

   Sahifa `?course=&module=&lesson=` bilan ochiladi. Darsning O'ZI
   js/content-store.js dagi `isloh_course_content` do'konida yotadi
   (nomi, turi, davomiyligi, ko'rinishi, holati), shuning uchun shu
   maydonlar do'kondan to'ldiriladi va o'sha yerga saqlanadi.

   NEGA O'ZGARDI: sahifa `?lesson=` ni umuman o'qimasdi — qaysi darsni
   ochsangiz ham "Kursga kirish", Video, 8 daqiqa ko'rinardi, ya'ni
   darslar ro'yxatidan boshqa darsni ochish hech narsani o'zgartirmasdi.

   IKKI DO'KON, BITTA "SAQLASH":
     - dars YOZUVI (nom, tur, davomiylik, ko'rinish, holat) → content-store
     - qolgan boy kontent (matn, video havolasi, kod bloki) → draft-store
   Ular bitta almashtiriladigan do'konga (`data-unsaved-store="lesson"`)
   birlashtirilgan, shuning uchun "Saqlash" tugmasi va "Saqlanmagan
   o'zgarishlar" nishoni js/unsaved-guard.js da qanday bo'lsa shunday
   qoladi. Qoralama kaliti endi dars id'sini o'z ichiga oladi
   (js/draft-store.js), ya'ni bir darsning matni boshqasida chiqmaydi.

   Markup shartnomasi:
     [data-lesson-field="<nom>"]  → title | type | duration
     [data-lesson-radio="visibility"] → radio guruhi
     [data-lesson-check="published"]  → holat switch'i
     [data-lesson-out="<nom>"]    → ko'rib chiqish tabidagi matnlar
   ========================================================================== */

function isloh_lessonFormScope() {
  const params = new URLSearchParams(window.location.search);
  return {
    courseId: params.get('course') || params.get('id') || '',
    moduleId: params.get('module') || '',
    lessonId: params.get('lesson') || ''
  };
}

function isloh_lessonFieldEl(name) {
  return document.querySelector(`[data-lesson-field="${name}"]`);
}

function isloh_currentLesson() {
  const scope = isloh_lessonFormScope();
  if (!scope.courseId || !scope.moduleId || !scope.lessonId) return null;
  return isloh_getLessons(scope.courseId, scope.moduleId).find((l) => l.id === scope.lessonId) || null;
}

/* --- Ko'rsatiladigan qiymatlar -------------------------------------------- */

function isloh_renderLessonOutputs(lesson) {
  const meta = isloh_lessonTypeMeta(lesson.type);

  const values = {
    title: lesson.title,
    summary: meta.label + ' · ' + (lesson.duration || '—')
  };
  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-lesson-out="${key}"]`).forEach((el) => { el.textContent = values[key]; });
  });

  const badge = document.querySelector('[data-lesson-status-badge]');
  if (badge) {
    const published = lesson.status === 'published';
    badge.className = 'badge ' + (published ? 'badge-green' : 'badge-warning');
    badge.textContent = published ? 'Nashr etilgan' : 'Qoralama';
  }

  document.title = lesson.title + ' — Darsni tahrirlash — Isloh';
}

/* --- To'ldirish / saqlash ------------------------------------------------- */

function isloh_fillLessonForm() {
  const lesson = isloh_currentLesson();
  if (!lesson) return 0;

  let filled = 0;
  ['title', 'type', 'duration'].forEach((name) => {
    const el = isloh_lessonFieldEl(name);
    if (!el) return;
    el.value = lesson[name] || '';
    filled += 1;
  });

  document.querySelectorAll('[data-lesson-radio="visibility"]').forEach((radio) => {
    radio.checked = radio.value === lesson.visibility;
  });

  const published = document.querySelector('[data-lesson-check="published"]');
  if (published) published.checked = lesson.status === 'published';

  isloh_renderLessonOutputs(lesson);
  return filled;
}

function isloh_saveLessonForm() {
  const scope = isloh_lessonFormScope();
  const lesson = isloh_currentLesson();
  if (!lesson) return 0; // dars topilmadi — faqat qoralama saqlanadi

  const data = { id: lesson.id };
  let count = 0;

  ['title', 'type', 'duration'].forEach((name) => {
    const el = isloh_lessonFieldEl(name);
    if (!el) return;
    data[name] = el.value.trim();
    count += 1;
  });

  const visibility = document.querySelector('[data-lesson-radio="visibility"]:checked');
  if (visibility) data.visibility = visibility.value;

  const published = document.querySelector('[data-lesson-check="published"]');
  if (published) data.status = published.checked ? 'published' : 'draft';

  const saved = isloh_saveLesson(scope.courseId, scope.moduleId, data);
  if (!saved) return -1;

  isloh_renderLessonOutputs(saved);
  return count;
}

/* Birlashgan do'kon: dars yozuvi content-store'ga, qolgan maydonlar
   qoralama do'koniga. Tiklashda AVVAL qoralama, KEYIN do'kon — shunda
   do'kondagi haqiqiy qiymat eski qoralama ustidan yozadi. */
if (typeof isloh_registerUnsavedStore === 'function') {
  isloh_registerUnsavedStore('lesson', {
    save: (scope) => {
      const stored = isloh_saveLessonForm();
      if (stored < 0) return -1;
      const drafted = typeof isloh_saveDraft === 'function' ? isloh_saveDraft(scope) : 0;
      if (drafted < 0) return -1;
      return stored + drafted;
    },
    restore: (scope) => {
      const drafted = typeof isloh_restoreDraft === 'function' ? isloh_restoreDraft(scope) : 0;
      return drafted + isloh_fillLessonForm();
    }
  });
}

function isloh_initLessonFormGuard() {
  if (!isloh_lessonFieldEl('title')) return;
  if (isloh_currentLesson()) return;
  if (typeof isloh_showToast === 'function') {
    isloh_showToast("Dars tanlanmagan yoki topilmadi — ro'yxatdan oching", 'error');
  }
}

document.addEventListener('DOMContentLoaded', isloh_initLessonFormGuard);
