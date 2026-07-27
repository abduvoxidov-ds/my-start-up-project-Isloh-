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
   ========================================================================== */

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

function isloh_initPublishConfirm() {
  const confirmBtn = document.querySelector('[data-publish-confirm]');
  if (!confirmBtn) return;
  confirmBtn.addEventListener('click', () => {
    isloh_closeModal('publish-confirm-modal');
    const status = document.querySelector('[data-publish-status]');
    if (status) {
      status.querySelector('.publish-status-ic').innerHTML = '<i class="bi bi-check-lg"></i>';
      status.querySelector('.publish-status-ic').style.background = 'var(--teach-green)';
      status.querySelector('.publish-status-title').textContent = 'Kurs nashr etildi';
      status.querySelector('.publish-status-sub').textContent = "Talabalar endi kursni ko'rishlari mumkin.";
    }
    if (typeof isloh_showToast === 'function') isloh_showToast('Kurs muvaffaqiyatli nashr etildi', 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initValidationSummary();
  isloh_initScheduleToggle();
  isloh_initPublishConfirm();
});
