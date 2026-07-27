/* ==========================================================================
   ISLOH — Bookmarks module  (Sprint 3B)
   Adds the two behaviors filterable.js doesn't cover for
   pages/student/bookmarks.html: removing a saved item, and sorting.
   Filtering + search come from the shared js/filterable.js engine.

   Markup contract (plus filterable's):
     [data-bookmark-item]  with  [data-bookmark-remove]
     #bookmark-sort  (<select>)  — sorts items within [data-bookmark-list]
     each item: data-title, data-date (YYYY-MM-DD)
   ========================================================================== */

function isloh_recountBookmarks() {
  const n = document.querySelectorAll('[data-bookmark-item]').length;
  const el = document.getElementById('bookmark-total');
  if (el) el.textContent = n;
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

function isloh_sortBookmarks(mode) {
  document.querySelectorAll('[data-bookmark-list]').forEach((list) => {
    const items = [...list.querySelectorAll('[data-bookmark-item]')];
    items.sort((a, b) => {
      if (mode === 'title') return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      // default: recent first by date
      return (b.dataset.date || '').localeCompare(a.dataset.date || '');
    });
    items.forEach((i) => list.appendChild(i));
  });
}

function isloh_initBookmarks() {
  const items = document.querySelectorAll('[data-bookmark-item]');
  if (!items.length) return;

  items.forEach((item) => {
    const rm = item.querySelector('[data-bookmark-remove]');
    if (rm) rm.addEventListener('click', (e) => {
      e.stopPropagation();
      item.remove();
      isloh_recountBookmarks();
    });
  });

  const sort = document.getElementById('bookmark-sort');
  if (sort) sort.addEventListener('change', () => isloh_sortBookmarks(sort.value));

  isloh_recountBookmarks();
}

document.addEventListener('DOMContentLoaded', isloh_initBookmarks);
