/* ==========================================================================
   ISLOH — Course Publish module  (Sprint 7)
   Powers pages/instructor/course-publish.html. Step navigation itself is
   handled by the existing js/course-wizard.js ([data-wizard] contract) —
   this module only adds what's specific to publishing: counting the
   checklist into a validation summary, showing the schedule date field
   when "Scheduled" is picked, and the final publish confirmation.

   Markup contract:
     [data-publish-checklist] [.publish-check-item.ok|.warn|.fail]
     [data-validation-ok] / [data-validation-warn] / [data-validation-fail]
     input[name="pub-visibility"][value="scheduled"] + [data-schedule-field]
     [data-publish-confirm]   → confirm button inside the modal
     [data-publish-status]    → status card updated after publishing
     [data-publish-title]     → nashr etilayotgan kurs nomi
     [data-publish-meta]      → uning holati / yangilangan sanasi

   Sprint "provider persistence": nashr etish endi haqiqatan ham holatni
   o'zgartiradi — js/course-store.js dagi kurs `status: 'published'` bo'ladi
   va shu zahoti talaba katalogiga tushadi (js/marketplace.js →
   isloh_getCatalog). Ilgari bu tugma faqat kartochka matnini almashtirib,
   "Kurs muvaffaqiyatli nashr etildi" deb yolg'on toast chiqarardi.

   Qaysi kurs nashr etilayotgani URL orqali: course-publish.html?id=<kurs-id>.
   ========================================================================== */

/* Nashr oynasidagi "Ko'rinish" tanlovi do'kondagi `visibility` qiymatiga
   moslanadi. "Rejalashtirilgan" hozircha ochiq nashr sifatida saqlanadi —
   rejalashtirilgan vaqtni tekshiradigan backend hali yo'q (CLAUDE.md §4). */
const ISLOH_PUBLISH_VISIBILITY = {
  draft: 'private',
  private: 'unlisted',
  scheduled: 'public',
  public: 'public'
};

function isloh_publishCourseId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

/* Sahifa sarlavhasi va ko'rinish tanlovi joriy kursdan to'ldiriladi. */
function isloh_initPublishCourse() {
  const course = isloh_getCourse(isloh_publishCourseId());
  if (!course) return null;

  const title = document.querySelector('[data-publish-title]');
  if (title) title.textContent = course.title;

  const meta = document.querySelector('[data-publish-meta]');
  if (meta) {
    const status = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
    meta.textContent = `${course.title} · ${status.label} · ${course.completion}% tayyor`;
  }

  isloh_applyCourseLinks(course.id);
  if (course.status === 'published') isloh_markPublishStatusCard();
  return course;
}

function isloh_initValidationSummary() {
  const list = document.querySelector('[data-publish-checklist]');
  if (!list) return;
  const items = [...list.querySelectorAll('.publish-check-item')];
  const counts = { ok: 0, warn: 0, fail: 0 };
  items.forEach((i) => {
    if (i.classList.contains('ok')) counts.ok++;
    else if (i.classList.contains('warn')) counts.warn++;
    else if (i.classList.contains('fail')) counts.fail++;
  });
  const setText = (sel, n) => { const el = document.querySelector(sel); if (el) el.textContent = n; };
  setText('[data-validation-ok]', counts.ok);
  setText('[data-validation-warn]', counts.warn);
  setText('[data-validation-fail]', counts.fail);

  const publishBtn = document.querySelector('[data-publish-btn]');
  if (publishBtn && counts.fail > 0) {
    publishBtn.disabled = true;
    publishBtn.title = "Nashr etishdan oldin talab qilingan bandlarni yakunlang";
  }
}

function isloh_initScheduleToggle() {
  const radios = [...document.querySelectorAll('input[name="pub-visibility"]')];
  const field = document.querySelector('[data-schedule-field]');
  if (!radios.length || !field) return;
  function sync() {
    const checked = radios.find((r) => r.checked);
    field.hidden = !checked || checked.value !== 'scheduled';
  }
  radios.forEach((r) => r.addEventListener('change', sync));
  sync();
}

function isloh_markPublishStatusCard() {
  const status = document.querySelector('[data-publish-status]');
  if (!status) return;
  status.classList.add('is-published');
  status.querySelector('.publish-status-ic').innerHTML = '<i class="bi bi-check-lg"></i>';
  status.querySelector('.publish-status-title').textContent = 'Kurs nashr etildi';
  status.querySelector('.publish-status-sub').textContent = "Talabalar endi kursni Marketplace'da ko'rishlari mumkin.";
}

function isloh_initPublishConfirm(course) {
  const confirmBtn = document.querySelector('[data-publish-confirm]');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', () => {
    isloh_closeModal('publish-confirm-modal');

    if (!course) {
      if (typeof isloh_showToast === 'function') isloh_showToast('Nashr etiladigan kurs tanlanmagan', 'error');
      return;
    }

    const picked = document.querySelector('input[name="pub-visibility"]:checked');
    const visibility = ISLOH_PUBLISH_VISIBILITY[picked ? picked.value : 'public'] || 'public';
    const saved = isloh_saveCourse({ id: course.id, status: 'published', visibility: visibility });

    if (!saved) {
      if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    isloh_markPublishStatusCard();
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(visibility === 'public'
        ? 'Kurs nashr etildi va Marketplace\'ga qo\'shildi'
        : 'Kurs nashr etildi (havola orqali kirish mumkin)', 'success');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const course = isloh_initPublishCourse();
  isloh_initValidationSummary();
  isloh_initScheduleToggle();
  isloh_initPublishConfirm(course);
});
