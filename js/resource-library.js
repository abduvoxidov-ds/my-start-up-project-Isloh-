/* ==========================================================================
   ISLOH — Resource Library module  (Sprint 6B)
   Powers pages/instructor/resource-library.html. Scope tabs (Course/Lesson/
   Assignment/Quiz Resources) reuse js/tabs.js as-is; category/tag/type
   filters + search reuse js/filterable.js as-is — no page-specific code
   needed for either. Only the favorite toggle and the "insert" stub
   (frontend-only — this page has no backend to insert into) live here.
   ========================================================================== */

function isloh_initFavoriteToggles() {
  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav-toggle]');
    if (!favBtn) return;
    const active = favBtn.classList.toggle('active');
    favBtn.querySelector('i').className = active ? 'bi bi-star-fill' : 'bi bi-star';
    favBtn.setAttribute('aria-pressed', String(active));
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(active ? "Sevimlilarga qo'shildi" : "Sevimlilardan olib tashlandi", 'success');
    }
  });
}

function isloh_initInsertResource() {
  document.addEventListener('click', (e) => {
    const insertBtn = e.target.closest('[data-action="insert-resource"]');
    if (!insertBtn) return;
    if (typeof isloh_showToast === 'function') isloh_showToast("Resurs tanlandi", 'success');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initFavoriteToggles();
  isloh_initInsertResource();
});
