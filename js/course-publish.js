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

/* --- Nashrdan oldingi tekshiruv ---------------------------------------------
   Bandlar DO'KONLARDAN hisoblanadi. Ilgari ular markupda qattiq yozilgan edi:
   qaysi kurs ochilishidan qat'i nazar bir xil olti band ko'rinardi, ulardan
   biri esa doim `fail` bo'lgani uchun "Kursni nashr etish" tugmasi hech qachon
   ochilmasdi (9-bosqich auditi shuni topdi).

   Uch daraja:
     ok   — band bajarilgan
     warn — bajarilmagan, lekin nashrga to'sqinlik qilmaydi
     fail — nashr etib bo'lmaydi (tugma o'chiq qoladi)

   M5 dan boshlab fayl yuklash haqiqiy, lekin "video yuklanganmi" bandi
   hamon yo'q: darsga video biriktirish (`Lesson.video_file`) serverda bor,
   frontenddagi dars muharriri esa unga hali ulanmagan. O'ylab topilgan
   ogohlantirish yozilmaydi. */
function isloh_publishChecks(course) {
  const modules = typeof isloh_getModules === 'function' ? isloh_getModules(course.id) : [];
  const lessons = modules.reduce((sum, m) => sum + ((m.lessons || []).length), 0);
  const quizzes = typeof isloh_getCourseQuizzes === 'function' ? isloh_getCourseQuizzes(course.id).length : 0;
  const assignments = typeof isloh_getCourseAssignments === 'function' ? isloh_getCourseAssignments(course.id).length : 0;
  const resources = typeof isloh_getCourseResources === 'function'
    ? isloh_getCourseResources(course.id).filter((r) => r.status === 'active').length : 0;
  const seo = Boolean((course.metaTitle || course.title) && (course.metaDescription || course.description));

  return [
    { level: course.title && (course.description || course.subtitle) ? 'ok' : 'fail',
      label: "Asosiy ma'lumotlar to'ldirilgan", note: 'Kurs tahriri' },
    { level: lessons > 0 ? 'ok' : 'fail',
      label: lessons > 0 ? lessons + ' ta dars tayyor' : "Kamida 1 ta dars qo'shilishi shart", note: 'Kurs tarkibi' },
    { level: course.free || course.price > 0 ? 'ok' : 'fail',
      label: course.free ? 'Kurs bepul deb belgilangan' : (course.price > 0 ? 'Narx belgilangan' : "Narx belgilanmagan"), note: 'Sozlamalar' },
    { level: seo ? 'ok' : 'warn',
      label: seo ? "SEO ma'lumotlari to'ldirilgan" : "SEO tavsifi yozilmagan", note: 'SEO qadami' },
    { level: quizzes > 0 ? 'ok' : 'warn',
      label: quizzes > 0 ? quizzes + " ta test qo'shilgan" : "Test qo'shilmagan", note: 'Test yaratuvchi' },
    { level: assignments > 0 ? 'ok' : 'warn',
      label: assignments > 0 ? assignments + " ta topshiriq qo'shilgan" : "Topshiriq qo'shilmagan", note: 'Topshiriqlar' },
    { level: resources > 0 ? 'ok' : 'warn',
      label: resources > 0 ? resources + " ta resurs biriktirilgan" : "Resurs biriktirilmagan", note: 'Resurslar' }
  ];
}

const ISLOH_PUBLISH_CHECK_ICON = { ok: 'bi-check-lg', warn: 'bi-exclamation', fail: 'bi-x-lg' };

function isloh_initValidationSummary(course) {
  const list = document.querySelector('[data-publish-checklist]');
  if (!list) return;

  const target = course || (typeof isloh_getCourse === 'function' ? isloh_getCourse(isloh_publishCourseId()) : null);
  const setText = (sel, n) => { const el = document.querySelector(sel); if (el) el.textContent = n; };

  if (!target) {
    list.innerHTML = "<p class=\"placeholder-note\"><i class=\"bi bi-info-circle\"></i> Kurs tanlanmagan — tekshiruvni ko'rsatib bo'lmaydi.</p>";
    setText('[data-validation-ok]', 0); setText('[data-validation-warn]', 0); setText('[data-validation-fail]', 0);
    return;
  }

  const checks = isloh_publishChecks(target);
  list.innerHTML = '<div class="publish-checklist">' + checks.map((c) =>
    `<div class="publish-check-item ${c.level}"><span class="pci-ic"><i class="bi ${ISLOH_PUBLISH_CHECK_ICON[c.level]}"></i></span>` +
    `<span class="pci-label">${c.label}</span><span class="pci-note">${c.note}</span></div>`).join('') + '</div>';

  const counts = { ok: 0, warn: 0, fail: 0 };
  checks.forEach((c) => { counts[c.level] += 1; });
  setText('[data-validation-ok]', counts.ok);
  setText('[data-validation-warn]', counts.warn);
  setText('[data-validation-fail]', counts.fail);

  /* Talab qilingan band bajarilmagan bo'lsa tugma o'chiq — lekin endi bu
     HAQIQIY holatdan kelib chiqadi va band bajarilishi bilan ochiladi. */
  const publishBtn = document.querySelector('[data-publish-btn]');
  if (publishBtn) {
    publishBtn.disabled = counts.fail > 0;
    publishBtn.title = counts.fail > 0 ? "Nashr etishdan oldin talab qilingan bandlarni yakunlang" : '';
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

/* Ro'yxatdagi "N ta resurs biriktirilgan" bandi resurslar do'konidan
   hisoblanadi va u M5 da serverga o'tdi — javob kelganda qayta chiziladi,
   aks holda o'qituvchi "Resurs biriktirilmagan" ogohlantirishini noto'g'ri
   ko'rardi. */
document.addEventListener('isloh:resources-updated', () => isloh_initValidationSummary(null));

document.addEventListener('DOMContentLoaded', () => {
  const course = isloh_initPublishCourse();
  isloh_initValidationSummary(course);
  isloh_initScheduleToggle();
  isloh_initPublishConfirm(course);
});
