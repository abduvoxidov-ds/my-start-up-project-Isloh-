/* ==========================================================================
   ISLOH — Course Builder (Module Builder) module  (Sprint 5B)
   Powers pages/instructor/course-builder.html. Reuses js/filterable.js
   (search/filter), js/sortable.js (drag reorder), js/dropdown.js (quick
   actions), js/modal.js (add/delete dialogs) — this file only adds the
   module-specific behaviors that don't belong in those generic modules.
   ========================================================================== */

let isloh_pendingModuleDelete = null;

function isloh_initModuleCollapse() {
  const list = document.querySelector('[data-modules-list]');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-module-toggle]');
    if (!toggle) return;
    const body = toggle.closest('.module-card').querySelector('.module-body');
    const collapsed = body.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
}

function isloh_initModuleActions() {
  const list = document.querySelector('[data-modules-list]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const dupBtn = e.target.closest('[data-action="duplicate-module"]');
    if (dupBtn) {
      const card = dupBtn.closest('.module-card');
      const clone = card.cloneNode(true);
      clone.querySelector('.module-title').textContent += " (nusxa)";
      clone.querySelector('.module-body')?.classList.add('collapsed');
      clone.querySelector('[data-module-toggle]')?.classList.add('collapsed');
      card.after(clone);
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-module"]');
    if (delBtn) {
      isloh_pendingModuleDelete = delBtn.closest('.module-card');
      isloh_openModal('delete-module-modal');
    }
  });

  document.querySelector('[data-confirm-delete-module]')?.addEventListener('click', () => {
    isloh_pendingModuleDelete?.remove();
    isloh_pendingModuleDelete = null;
    isloh_closeModal('delete-module-modal');
  });
}

function isloh_initAddModule() {
  const list = document.querySelector('[data-modules-list]');
  const template = document.getElementById('module-template');
  const form = document.querySelector('[data-add-module-form]');
  if (!list || !template || !form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const count = list.querySelectorAll('.module-card').length + 1;
    const title = form.querySelector('[name="title"]').value.trim() || 'Yangi modul';
    const desc = form.querySelector('[name="desc"]').value.trim() || "Tavsif qo'shilmagan";
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.querySelector('.module-title').textContent = `${count}-modul: ${title}`;
    clone.querySelector('.module-desc').textContent = desc;
    clone.dataset.filterText = title;
    list.appendChild(clone);
    form.reset();
    isloh_closeModal('add-module-modal');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initModuleCollapse();
  isloh_initModuleActions();
  isloh_initAddModule();
});
