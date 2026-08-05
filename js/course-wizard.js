/* ==========================================================================
   ISLOH — Course Wizard module  (Sprint 5A)
   Powers the multi-step form in pages/instructor/course-create.html and
   pages/instructor/course-edit.html (same markup contract, so both pages
   share this one module instead of each re-implementing step navigation).

   Markup contract:
     [data-wizard]
       [data-stepper-item]        → one per step, in the .wizard-stepper
       [data-wizard-step]         → one per step body, in .wizard-body
       [data-wizard-next]         → advances to the next step
       [data-wizard-back]         → returns to the previous step
     [data-char-counter="<max>"]  → input/textarea with a live counter
       [data-char-counter-for="<inputId>"] → element that displays it

   Oxirgi bosqichdagi "Yakunlash" bosilganda `isloh:wizard-complete` hodisasi
   yuboriladi. Ilgari shu joyda to'g'ridan-to'g'ri "Kurs muvaffaqiyatli
   saqlandi" toast'i chiqarilardi — hech narsa saqlanmasa ham. Endi saqlash
   js/course-form.js zimmasida (u shu hodisani tinglaydi), bu modul esa
   faqat bosqichlar bilan shug'ullanadi; nashr sahifasi (course-publish)
   xuddi shu bosqich mexanizmini ishlatadi, lekin saqlamaydi.
   ========================================================================== */

function isloh_initWizard() {
  const wizard = document.querySelector('[data-wizard]');
  if (!wizard) return;

  const steps = [...wizard.querySelectorAll('[data-wizard-step]')];
  const stepperItems = [...wizard.querySelectorAll('[data-stepper-item]')];
  let current = 0;

  function show(index) {
    steps.forEach((s, i) => { s.hidden = i !== index; });
    stepperItems.forEach((s, i) => {
      s.classList.toggle('active', i === index);
      s.classList.toggle('done', i < index);
    });
    wizard.querySelectorAll('[data-wizard-back]').forEach((b) => { b.disabled = index === 0; });
    wizard.querySelectorAll('[data-wizard-next]').forEach((b) => {
      b.innerHTML = index === steps.length - 1
        ? '<i class="bi bi-check2-circle"></i> Yakunlash'
        : 'Keyingisi <i class="bi bi-arrow-right"></i>';
    });
    current = index;
    wizard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  wizard.querySelectorAll('[data-wizard-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (current < steps.length - 1) {
        show(current + 1);
        return;
      }
      wizard.dispatchEvent(new CustomEvent('isloh:wizard-complete', { bubbles: true }));
    });
  });
  wizard.querySelectorAll('[data-wizard-back]').forEach((btn) => {
    btn.addEventListener('click', () => { if (current > 0) show(current - 1); });
  });
  stepperItems.forEach((item, i) => {
    item.addEventListener('click', () => {
      if (i < current || item.classList.contains('done')) show(i);
    });
  });

  show(0);
}

function isloh_initCharCounters() {
  document.querySelectorAll('[data-char-counter]').forEach((input) => {
    const max = parseInt(input.dataset.charCounter, 10);
    const out = document.querySelector(`[data-char-counter-for="${input.id}"]`);
    if (!out || !max) return;
    const update = () => { out.textContent = `${input.value.length} / ${max}`; };
    input.addEventListener('input', update);
    update();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initWizard();
  isloh_initCharCounters();
});
