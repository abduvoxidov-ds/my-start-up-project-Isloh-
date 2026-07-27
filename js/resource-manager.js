/* ==========================================================================
   ISLOH — Resource Manager module  (Sprint 6B)
   Powers pages/instructor/resource-manager.html. Extends the existing
   resource system (css/widgets.css .resource-card/.resource-grid from
   Sprint 5B, .collection-card from Sprint 3B) instead of a new one.
   Reuses js/filterable.js, js/courses.js (skeleton + bulk selection —
   data-attribute driven, not course-specific), js/dropdown.js, js/modal.js.

   New here (no existing equivalent):
     - 3-way Papka / Katakcha / Ro'yxat view switch (courses.js's
       view-switch helper is a hardcoded 2-way grid/table toggle, so this
       page reuses the same .view-switch markup contract but with a
       generic N-way [data-view-panel] switch instead).
     - Folder drill-down (click a folder tile → filter to that folder,
       show a back button).
     - Row/card actions: move / duplicate / archive / restore / preview.
   ========================================================================== */

function isloh_initResourceViewSwitch() {
  const switchEl = document.querySelector('[data-view-switch]');
  if (!switchEl) return;
  const panels = [...document.querySelectorAll('[data-view-panel]')];

  switchEl.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      panels.forEach((p) => { p.hidden = p.dataset.viewPanel !== view; });
    });
  });
}

function isloh_initFolderDrilldown() {
  const folderGrid = document.querySelector('[data-folder-grid]');
  const flatViews = document.querySelectorAll('[data-view-panel="grid"], [data-view-panel="list"]');
  const crumb = document.querySelector('[data-folder-crumb]');
  const backBtn = document.querySelector('[data-folder-back]');
  if (!folderGrid) return;

  const crumbLabel = document.querySelector('[data-folder-crumb-label]');

  function openFolder(name, label) {
    folderGrid.hidden = true;
    flatViews.forEach((v) => { v.hidden = false; });
    document.querySelectorAll('[data-resource-item]').forEach((item) => {
      item.style.display = item.dataset.folder === name ? '' : 'none';
    });
    if (crumbLabel) crumbLabel.textContent = label;
    if (crumb) crumb.hidden = false;
  }

  folderGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-folder-tile]');
    if (!tile) return;
    openFolder(tile.dataset.folderTile, tile.dataset.folderLabel || tile.dataset.folderTile);
  });

  backBtn?.addEventListener('click', () => {
    folderGrid.hidden = false;
    flatViews.forEach((v) => { v.hidden = v.dataset.viewPanel !== (document.querySelector('[data-view-switch] button.active')?.dataset.view || 'grid'); });
    document.querySelectorAll('[data-resource-item]').forEach((item) => { item.style.display = ''; });
    if (crumb) crumb.hidden = true;
  });
}

let isloh_pendingResourceDelete = null;

function isloh_initResourceRowActions() {
  document.addEventListener('click', (e) => {
    const previewBtn = e.target.closest('[data-action="preview-resource"]');
    if (previewBtn) {
      const item = previewBtn.closest('[data-resource-item]');
      const modal = document.getElementById('preview-resource-modal');
      if (modal && item) {
        modal.querySelector('[data-preview-resource-name]').textContent = item.querySelector('.resource-name, .cell-title')?.textContent.trim() || 'Resurs';
        modal.querySelector('[data-preview-resource-meta]').textContent = item.querySelector('.resource-meta, .cell-sub')?.textContent.trim() || '';
      }
      isloh_openModal('preview-resource-modal');
      return;
    }

    const moveBtn = e.target.closest('[data-action="move-resource"]');
    if (moveBtn) { isloh_openModal('move-resource-modal'); return; }

    const dupBtn = e.target.closest('[data-action="duplicate-resource"]');
    if (dupBtn) {
      const item = dupBtn.closest('[data-resource-item]');
      const clone = item.cloneNode(true);
      const nameEl = clone.querySelector('.resource-name, .cell-title');
      if (nameEl) nameEl.textContent += " (nusxa)";
      item.after(clone);
      if (typeof isloh_showToast === 'function') isloh_showToast("Resurs nusxalandi", 'success');
      return;
    }

    const archiveBtn = e.target.closest('[data-action="archive-resource"]');
    if (archiveBtn) {
      archiveBtn.closest('[data-resource-item]')?.classList.add('is-archived');
      if (typeof isloh_showToast === 'function') isloh_showToast("Resurs arxivlandi", 'success');
      return;
    }
    const restoreBtn = e.target.closest('[data-action="restore-resource"]');
    if (restoreBtn) {
      restoreBtn.closest('[data-resource-item]')?.classList.remove('is-archived');
      if (typeof isloh_showToast === 'function') isloh_showToast("Resurs tiklandi", 'success');
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-resource"]');
    if (delBtn) {
      isloh_pendingResourceDelete = delBtn.closest('[data-resource-item]');
      isloh_openModal('delete-resource-modal');
    }
  });

  document.querySelector('[data-confirm-delete-resource]')?.addEventListener('click', () => {
    isloh_pendingResourceDelete?.remove();
    isloh_pendingResourceDelete = null;
    isloh_closeModal('delete-resource-modal');
  });

  document.querySelector('[data-confirm-move-resource]')?.addEventListener('click', () => {
    isloh_closeModal('move-resource-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast("Resurs ko'chirildi", 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initResourceViewSwitch();
  isloh_initFolderDrilldown();
  isloh_initResourceRowActions();
});
