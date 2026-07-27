/* ==========================================================================
   ISLOH — Filterable module  (Sprint 3B)
   One generic engine for the "filter chips + search + empty state" pattern
   shared by Certificates, Bookmarks and the Notification Center, so none of
   those pages reimplement filtering. Declarative — driven entirely by data
   attributes, no per-page JS needed.

   Markup contract (scope any container with [data-filterable]):
     [data-filterable]
       [data-filter-group="<attr>"]  → wraps buttons; <attr> is the item
                                        data-key to match, e.g. "type"
         button[data-filter-value="all|<value>"]   (.active = current)
       [data-filter-search]           → <input> that matches item text
       [data-filter-item]             → each filterable item, carrying
                                        data-<attr> keys + optional
                                        [data-filter-text] (defaults to
                                        the item's .filter-title text)
       [data-filter-empty]            → shown when nothing matches
   Multiple groups AND together (e.g. type=course AND status=earned).
   ========================================================================== */

function isloh_applyFilterable(scope) {
  const groups = [...scope.querySelectorAll('[data-filter-group]')].map((g) => ({
    key: g.dataset.filterGroup,
    value: (g.querySelector('button.active')?.dataset.filterValue) || 'all'
  }));
  const searchEl = scope.querySelector('[data-filter-search]');
  const q = (searchEl?.value || '').trim().toLowerCase();

  let visible = 0;
  scope.querySelectorAll('[data-filter-item]').forEach((item) => {
    let show = groups.every((g) => g.value === 'all' || item.dataset[g.key] === g.value);
    if (show && q) {
      const text = (item.dataset.filterText || item.querySelector('.filter-title')?.textContent || item.textContent).toLowerCase();
      show = text.includes(q);
    }
    item.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  const empty = scope.querySelector('[data-filter-empty]');
  if (empty) empty.style.display = visible === 0 ? '' : 'none';

  // Optional: hide section wrappers that end up empty
  scope.querySelectorAll('[data-filter-section]').forEach((sec) => {
    const any = [...sec.querySelectorAll('[data-filter-item]')].some((i) => i.style.display !== 'none');
    sec.style.display = any ? '' : 'none';
  });
}

function isloh_initFilterable() {
  document.querySelectorAll('[data-filterable]').forEach((scope) => {
    scope.querySelectorAll('[data-filter-group] button[data-filter-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('[data-filter-group]');
        group.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        isloh_applyFilterable(scope);
      });
    });
    const search = scope.querySelector('[data-filter-search]');
    if (search) search.addEventListener('input', () => isloh_applyFilterable(scope));
    isloh_applyFilterable(scope);
  });
}

document.addEventListener('DOMContentLoaded', isloh_initFilterable);
