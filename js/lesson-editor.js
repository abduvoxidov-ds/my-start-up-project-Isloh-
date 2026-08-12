/* ==========================================================================
   ISLOH — Lesson Editor module  (Sprint 5B, generalized Sprint 6A)
   Powers pages/instructor/lesson-editor.html's Content and Resources tabs.
   Generic "repeating row" engine: any [data-add-row="<templateId>"] button
   clones that <template> into the matching [data-row-list="<templateId>"]
   container. One implementation serves External Links, Download Files,
   Resource cards (Sprint 5B) and — reused as-is, no changes needed on
   their side — Question Editor's option/pair/item rows and Quiz Builder's
   settings notification rows (Sprint 6A).

   Sprint 6A change: the remove handler no longer hardcodes a class list
   (".link-row, .download-row, .resource-card"). It now removes whichever
   direct child of the row's own [data-row-list] container contains the
   clicked button, so any future row shape works without touching this
   file again.
   ========================================================================== */

function isloh_initRepeatingRows() {
  document.querySelectorAll('[data-add-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const templateId = btn.dataset.addRow;
      const template = document.getElementById(templateId);
      const container = document.querySelector(`[data-row-list="${templateId}"]`);
      if (!template || !container) return;
      container.appendChild(template.content.firstElementChild.cloneNode(true));
    });
  });

  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-row]');
    if (!removeBtn) return;
    const container = removeBtn.closest('[data-row-list]');
    if (!container) return;
    const row = [...container.children].find((child) => child.contains(removeBtn));
    row?.remove();
  });
}

/* "Darslarga qaytish" havolasi qaysi kurs va modulga qaytishni bilishi
   kerak — dars muharriri `?course=&module=&lesson=` bilan ochiladi.
   Ilgari havola parametrsiz edi va boshqa modulni ochib yuborardi.

   Bu blok faqat `[data-lesson-back]` bor sahifada ishlaydi, ya'ni shu
   faylni yuklaydigan boshqa muharrirlarga (topshiriq, test) tegmaydi. */
function isloh_initLessonBackLinks() {
  const links = document.querySelectorAll('[data-lesson-back]');
  if (!links.length) return;

  const params = new URLSearchParams(window.location.search);
  const course = params.get('course') || params.get('id') || '';
  const module = params.get('module') || '';
  if (!course) return;

  const query = 'course=' + encodeURIComponent(course) + (module ? '&module=' + encodeURIComponent(module) : '');
  links.forEach((link) => { link.href = 'lesson-builder.html?' + query; });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initRepeatingRows();
  isloh_initLessonBackLinks();
});
