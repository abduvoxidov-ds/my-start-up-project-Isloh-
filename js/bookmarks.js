/* ==========================================================================
   ISLOH — Bookmarks module  (Sprint 3B)
   Adds the two behaviors filterable.js doesn't cover for
   pages/student/bookmarks.html: removing a saved item, and sorting.
   Filtering + search come from the shared js/filterable.js engine.
   Also renders courses purchased on the Marketplace (js/marketplace.js) as
   "Mening kurslarim" bookmark cards — see ISLOH_PURCHASED_KEY.

   Markup contract (plus filterable's):
     [data-bookmark-item]  with  [data-bookmark-remove]
     #bookmark-sort  (<select>)  — sorts items within [data-bookmark-list]
     each item: data-title, data-date (YYYY-MM-DD)
   ========================================================================== */

function isloh_renderPurchasedCourses() {
  const list = document.querySelector('[data-bookmark-list]');
  if (!list || typeof isloh_getPurchasedCourses !== 'function') return;

  const existingTitles = new Set(
    [...list.querySelectorAll('[data-bookmark-item]')].map((i) => i.dataset.title)
  );
  const today = new Date().toISOString().slice(0, 10);

  isloh_getPurchasedCourses().forEach((course) => {
    if (existingTitles.has(course.title)) return;

    const item = document.createElement('div');
    item.className = 'card bookmark-card';
    item.setAttribute('data-filter-item', '');
    item.setAttribute('data-bookmark-item', '');
    item.dataset.type = 'course';
    item.dataset.title = course.title;
    item.dataset.date = today;
    item.dataset.filterText = course.title;
    item.innerHTML = `
      <div class="bookmark-thumb" style="background:${course.cover};"><i class="${course.icon}"></i></div>
      <div class="bookmark-body">
        <div class="bookmark-title filter-title">${course.title}</div>
        <div class="bookmark-sub">Kurs · Marketplace'dan sotib olindi</div>
        <div class="bookmark-tags"><span class="badge badge-violet">Kurs</span></div>
        <div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:0%;"></div></div>
        <div style="font-size:12px; color:var(--ink-500); margin-top:4px;">0% bajarildi</div>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <a href="course-detail.html" class="btn btn-outline btn-sm">Ochish</a>
        <button class="bookmark-remove" data-bookmark-remove aria-label="O'chirish"><i class="bi bi-x-lg"></i></button>
      </div>`;
    list.prepend(item);
  });
}

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
  isloh_renderPurchasedCourses();

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
