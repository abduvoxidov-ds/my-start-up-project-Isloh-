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

   Qidiruv rejimi (search mode) — sahifa qidiruv paytida "natijalar
   sahifasi"ga aylanishi uchun (Marketplace kabi do'kon sahifalarida
   bannerlar, tavsiyalar, to'plamlar natijaga aralashmasligi kerak):
       [data-filter-hide-on-search]   → qidiruv boshlanishi bilan yashiriladi
       [data-filter-only-on-search]   → faqat qidiruv paytida ko'rinadi
       [data-filter-query]            → kiritilgan so'rov matni yoziladi
       [data-filter-count]            → topilgan elementlar soni yoziladi
       [data-filter-clear]            → qidiruvni tozalash tugmasi

   Multiple groups AND together (e.g. type=course AND status=earned).
   Qidiruv so'zlari ham AND: "python backend" ikkala so'zi bor elementni
   topadi, tartibidan qat'i nazar.
   ========================================================================== */

/* So'rovni qidiruv so'zlariga bo'ladi. Bo'sh so'rov -> bo'sh massiv, ya'ni
   "qidiruv rejimi o'chiq" degani. */
function isloh_filterQueryTokens(value) {
  return String(value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/* Element qaysi matn bo'yicha qidirilishi: aniq e'lon qilingan
   data-filter-text, bo'lmasa sarlavha, bo'lmasa butun matn. */
function isloh_filterItemText(item) {
  return (item.dataset.filterText || item.querySelector('.filter-title')?.textContent || item.textContent).toLowerCase();
}

function isloh_applyFilterable(scope) {
  const groups = [...scope.querySelectorAll('[data-filter-group]')].map((g) => ({
    key: g.dataset.filterGroup,
    value: (g.querySelector('button.active')?.dataset.filterValue) || 'all'
  }));
  const searchEl = scope.querySelector('[data-filter-search]');
  const query = (searchEl?.value || '').trim();
  const tokens = isloh_filterQueryTokens(query);
  const searching = tokens.length > 0;

  let visible = 0;
  scope.querySelectorAll('[data-filter-item]').forEach((item) => {
    let show = groups.every((g) => g.value === 'all' || item.dataset[g.key] === g.value);
    if (show && searching) {
      const text = isloh_filterItemText(item);
      show = tokens.every((token) => text.includes(token));
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

  /* Qidiruv rejimi: sahifadagi qidiruvga aloqasiz bloklar (banner, tavsiyalar,
     to'plamlar, tarix) yashiriladi va faqat natijalar qoladi. */
  scope.querySelectorAll('[data-filter-hide-on-search]').forEach((el) => { el.hidden = searching; });
  scope.querySelectorAll('[data-filter-only-on-search]').forEach((el) => { el.hidden = !searching; });
  scope.querySelectorAll('[data-filter-clear]').forEach((el) => { el.hidden = !searching; });
  scope.querySelectorAll('[data-filter-query]').forEach((el) => { el.textContent = query; });
  scope.querySelectorAll('[data-filter-count]').forEach((el) => { el.textContent = visible; });
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
    if (search) {
      search.addEventListener('input', () => isloh_applyFilterable(scope));
      // Esc — qidiruvni tozalash (brauzerlardagi odatiy xatti-harakat)
      search.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !search.value) return;
        search.value = '';
        isloh_applyFilterable(scope);
      });
    }

    /* Tozalash tugmalari: qidiruv maydonidagi "×" ham, natija topilmaganda
       chiqadigan tugma ham bir xil atribut orqali ishlaydi. */
    scope.querySelectorAll('[data-filter-clear]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!search) return;
        search.value = '';
        isloh_applyFilterable(scope);
        search.focus();
      });
    });

    isloh_applyFilterable(scope);
  });
}

document.addEventListener('DOMContentLoaded', isloh_initFilterable);
