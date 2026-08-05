/* ==========================================================================
   ISLOH — Kurs sozlamalari (pages/instructor/course-settings.html)
   Sahifani js/course-store.js dagi `isloh_courses` do'koniga ulaydi.

   NEGA: bu sahifadagi HAR BIR tugma o'lik edi — "O'zgarishlarni saqlash"
   hech narsa qilmasdi, "Arxivlash" va "Ha, o'chirish" esa faqat modalni
   yopardi (qaytarib bo'lmaydigan amal deb ogohlantirib turib!).

   Maydonlarni o'qish/yozish js/course-form.js dagi `data-course-field`
   shartnomasi orqali — sehrgar bilan bir xil mantiq takrorlanmasin.

   Qo'shimcha markup shartnomasi:
     [data-course-save]                → "O'zgarishlarni saqlash"
     [data-course-status-badge]        → holat nishoni
     [data-course-visibility-search]   → "Qidiruvda ko'rsatish" switch
     [data-course-visibility-unlisted] → "Faqat havola orqali" switch
     [data-course-archive-confirm]     → arxivlashni tasdiqlash
     [data-course-delete-confirm]      → o'chirishni tasdiqlash
     [data-course-delete-students]     → o'chirish oynasidagi talabalar soni
   ========================================================================== */

const ISLOH_SETTINGS_REDIRECT = 'courses.html';

function isloh_settingsCourseId() {
  const fromUrl = new URLSearchParams(window.location.search).get('id');
  if (fromUrl) return fromUrl;
  const mount = document.querySelector('[data-course-id]');
  return mount ? mount.dataset.courseId : '';
}

/* Ikkita switch -> bitta `visibility` qiymati.
     qidiruvda ko'rinmasin      -> private
     faqat havola orqali        -> unlisted
     aks holda                  -> public                                  */
function isloh_readVisibilitySwitches() {
  const search = document.querySelector('[data-course-visibility-search]');
  const unlisted = document.querySelector('[data-course-visibility-unlisted]');
  if (!search || !unlisted) return null;
  if (!search.checked) return 'private';
  return unlisted.checked ? 'unlisted' : 'public';
}

function isloh_applyVisibilitySwitches(visibility) {
  const search = document.querySelector('[data-course-visibility-search]');
  const unlisted = document.querySelector('[data-course-visibility-unlisted]');
  if (!search || !unlisted) return;
  search.checked = visibility !== 'private';
  unlisted.checked = visibility === 'unlisted';
}

function isloh_renderCourseSettings(course) {
  isloh_fillCourseForm(course);
  isloh_applyVisibilitySwitches(course.visibility);

  const badge = document.querySelector('[data-course-status-badge]');
  if (badge) {
    const meta = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
    badge.textContent = meta.label;
    badge.className = 'badge settings-item-control ' + meta.badge;
  }

  const students = document.querySelector('[data-course-delete-students]');
  if (students) students.textContent = course.students || 0;
}

function isloh_settingsToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_initCourseSettings() {
  const mount = document.querySelector('[data-course-id]');
  if (!mount) return;

  const id = isloh_settingsCourseId();
  const course = isloh_getCourse(id);
  if (!course) {
    isloh_settingsToast('Bunday kurs topilmadi', 'error');
    return;
  }

  isloh_renderCourseSettings(course);
  isloh_applyCourseLinks(course.id);

  const titleOut = document.querySelector('[data-course-heading]');
  if (titleOut) titleOut.textContent = course.title + ' — sozlamalar';

  /* Saqlash tugmalari bir nechta panelda — hammasi bir xil ishlaydi,
     chunki isloh_readCourseForm faqat mavjud maydonlarni qaytaradi. */
  document.querySelectorAll('[data-course-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const patch = isloh_readCourseForm();
      const visibility = isloh_readVisibilitySwitches();
      if (visibility) patch.visibility = visibility;
      patch.id = course.id;

      if (patch.title === '') {
        isloh_settingsToast("Kurs nomi bo'sh bo'lishi mumkin emas", 'error');
        return;
      }
      const saved = isloh_saveCourse(patch);
      if (!saved) {
        isloh_settingsToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }
      isloh_renderCourseSettings(saved);
      isloh_settingsToast("O'zgarishlar saqlandi");
    });
  });

  const archiveBtn = document.querySelector('[data-course-archive-confirm]');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      isloh_setCourseStatus(course.id, 'archived');
      if (typeof isloh_closeModal === 'function') isloh_closeModal('archive-confirm-modal');
      isloh_settingsToast('Kurs arxivlandi');
      setTimeout(() => { window.location.href = ISLOH_SETTINGS_REDIRECT; }, 900);
    });
  }

  const deleteBtn = document.querySelector('[data-course-delete-confirm]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      isloh_deleteCourse(course.id);
      if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-confirm-modal');
      isloh_settingsToast("Kurs o'chirildi");
      setTimeout(() => { window.location.href = ISLOH_SETTINGS_REDIRECT; }, 900);
    });
  }
}

document.addEventListener('DOMContentLoaded', isloh_initCourseSettings);
