/* ==========================================================================
   ISLOH — Course List module  (Sprint 5A)
   Powers pages/instructor/courses.html:
     1) Grid / Table view toggle   (reuses .view-switch, see css/widgets.css)
     2) Bulk selection             (checkbox column/overlay + .bulk-bar)
     3) Loading skeleton reveal    (reuses .skeleton-* from css/widgets.css)
   Declarative — driven by data attributes, no page-specific script needed.
   ========================================================================== */

function isloh_initCourseListView() {
  const switchEl = document.querySelector('[data-view-switch]');
  if (!switchEl) return;
  const grid = document.querySelector('[data-course-grid]');
  const table = document.querySelector('[data-course-table]');

  switchEl.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      if (grid) grid.hidden = view !== 'grid';
      if (table) table.hidden = view !== 'table';
    });
  });
}

function isloh_initBulkSelect() {
  const scope = document.querySelector('[data-bulk-scope]');
  const bar = document.querySelector('[data-bulk-bar]');
  if (!scope || !bar) return;

  const countEl = bar.querySelector('[data-bulk-count]');
  const selectAll = scope.querySelectorAll('[data-select-all]');
  const items = () => [...scope.querySelectorAll('[data-select-item]')];

  function refresh() {
    const checked = items().filter((i) => i.checked);
    bar.hidden = checked.length === 0;
    if (countEl) countEl.textContent = checked.length;
    const allChecked = items().length > 0 && checked.length === items().length;
    selectAll.forEach((sa) => { sa.checked = allChecked; });
  }

  scope.addEventListener('change', (e) => {
    if (e.target.matches('[data-select-item]')) refresh();
  });
  selectAll.forEach((sa) => {
    sa.addEventListener('change', () => {
      items().forEach((i) => { i.checked = sa.checked; });
      refresh();
    });
  });
  bar.querySelector('[data-bulk-cancel]')?.addEventListener('click', () => {
    items().forEach((i) => { i.checked = false; });
    refresh();
  });

  refresh();
}

function isloh_initListSkeleton() {
  const skeleton = document.querySelector('[data-list-skeleton]');
  const content = document.querySelector('[data-list-content]');
  if (!skeleton || !content) return;
  content.hidden = true;
  skeleton.hidden = false;
  setTimeout(() => {
    skeleton.hidden = true;
    content.hidden = false;
  }, 650);
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initListSkeleton();
  isloh_initCourseListView();
  isloh_initBulkSelect();
});
