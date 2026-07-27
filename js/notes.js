/* ==========================================================================
   ISLOH — Notes module  (Sprint 8B)
   Powers pages/student/notes.html. Search + Personal/Shared/Pinned/Recent
   tab filtering reuse js/filterable.js; this module adds note-specific
   actions: create, favorite, pin, and tag-chip filtering (a second,
   independent filter group layered on top of filterable's own groups).

   Markup contract:
     [data-note-create]           → reveals the new-note composer card
     [data-note-save]             → appends a new .shared-note-card
     [data-note-favorite]         → per-note favorite star (reuses .fav-toggle)
     [data-note-pin]              → per-note pin toggle (adds .pinned)
     [data-note-tag-filter] button[data-tag] → filters [data-filter-item] by
       a data-tags list (comma-separated), independent of filterable.js's
       own groups so tag filtering can combine with the tab/search filters
   ========================================================================== */

function isloh_initNoteCreate() {
  const createBtn = document.querySelector('[data-note-create]');
  const composer = document.querySelector('[data-note-composer]');
  if (createBtn && composer) {
    createBtn.addEventListener('click', () => { composer.hidden = !composer.hidden; });
  }

  const saveBtn = document.querySelector('[data-note-save]');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', () => {
    const titleInput = document.querySelector('[data-note-title-input]');
    const bodyInput = document.querySelector('[data-note-body-input]');
    const grid = document.querySelector('[data-notes-grid]');
    if (!titleInput?.value.trim() || !grid) return;

    const card = document.createElement('div');
    card.className = 'card shared-note-card';
    card.setAttribute('data-filter-item', '');
    card.dataset.scope = 'personal';
    card.dataset.filterText = titleInput.value.trim();
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div class="note-title"></div>
        <button class="fav-toggle" data-note-favorite aria-label="Sevimli"><i class="bi bi-star"></i></button>
      </div>
      <div class="note-body"></div>
      <div class="note-card-foot"><span>hozir</span><span>Shaxsiy</span></div>`;
    card.querySelector('.note-title').textContent = titleInput.value.trim();
    card.querySelector('.note-body').textContent = bodyInput?.value.trim() || '';
    grid.prepend(card);

    titleInput.value = '';
    if (bodyInput) bodyInput.value = '';
    document.querySelector('[data-note-composer]').hidden = true;
    if (typeof isloh_showToast === 'function') isloh_showToast('Izoh saqlandi', 'success');

    const scope = document.querySelector('[data-filterable]');
    if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
  });
}

function isloh_initNoteToggles() {
  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-note-favorite]');
    if (favBtn) {
      favBtn.classList.toggle('active');
      favBtn.querySelector('i').className = favBtn.classList.contains('active') ? 'bi bi-star-fill' : 'bi bi-star';
      return;
    }
    const pinBtn = e.target.closest('[data-note-pin]');
    if (pinBtn) {
      pinBtn.closest('.shared-note-card')?.classList.toggle('pinned');
    }
  });
}

function isloh_initNoteTagFilter() {
  const group = document.querySelector('[data-note-tag-filter]');
  if (!group) return;
  group.querySelectorAll('button[data-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tag = btn.dataset.tag;
      document.querySelectorAll('[data-filter-item]').forEach((card) => {
        const tags = (card.dataset.tags || '').split(',');
        card.style.display = (tag === 'all' || tags.includes(tag)) ? '' : 'none';
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initNoteCreate();
  isloh_initNoteToggles();
  isloh_initNoteTagFilter();
});
