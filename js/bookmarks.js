/* ==========================================================================
   ISLOH — Bookmarks module  ("Saqlanganlar" — pages/student/bookmarks.html)

   SCOPE: faqat DARS DARAJASIDAGI materiallar — video darslar, maqolalar,
   kod parchalari va eslatmalar. Kurs darajasidagi ma'lumot (sotib olingan
   yoki saqlangan kurslar) bu yerga UMUMAN kirmaydi — u "Mening kurslarim"
   sahifasiga ko'chirilgan (pages/student/courses.html + js/my-courses.js).

   Ikki vazifasi bor:
     1) ISLOH_BOOKMARKS_KEY do'koni — istalgan sahifa (course-player.html,
        lesson-player.html) material qo'shishi/olib tashlashi uchun.
        Shu sababli bu fayl faqat helper'lar uchun ham yuklanishi mumkin:
        pastdagi har bir render funksiyasi o'z elementini tekshiradi.
     2) bookmarks.html ro'yxatini render qilish, o'chirish va saralash.
   Filtrlash + qidiruv umumiy js/filterable.js dvigatelidan keladi.

   Material obyekti:
     { id, type, title, sub, icon, cover, href, date }
     type: 'lesson' | 'article' | 'code' | 'note'  — filtr chiplariga mos

   Markup contract (filterable'nikiga qo'shimcha):
     [data-bookmark-list]                     — ro'yxat konteyneri
     [data-bookmark-item]                     — har bir element
       [data-bookmark-remove]                 — o'chirish tugmasi
       data-bookmark-id="<id>"                — do'kondan kelgan material
       data-type, data-title, data-date       — filtr va saralash uchun
     #bookmark-sort (<select>), #bookmark-total
   ========================================================================== */

const ISLOH_BOOKMARKS_KEY = 'isloh_bookmarks';

// Har bir render'da qayta yaratiladigan (dinamik) elementlar belgisi
const ISLOH_BM_DYNAMIC_ATTR = 'data-bookmark-dynamic';

// Material turlari uchun standart ikonka va rang — bitta joyda
const ISLOH_MATERIAL_STYLE = {
  lesson:  { icon: 'bi bi-play-circle-fill',      cover: 'linear-gradient(135deg,#0F766E,#14B8A6)', label: 'Dars' },
  article: { icon: 'bi bi-file-earmark-richtext', cover: 'linear-gradient(135deg,#6C5DD3,#8B5CF6)', label: 'Maqola' },
  code:    { icon: 'bi bi-code-slash',            cover: 'linear-gradient(135deg,#1F2937,#4B5563)', label: 'Kod' },
  note:    { icon: 'bi bi-journal-text',          cover: 'linear-gradient(135deg,#E7A63B,#F59E0B)', label: 'Eslatma' }
};

/* --------------------------------------------------------------------------
   1) Do'kon (localStorage) — course-player.html shu funksiyalarni chaqiradi
   -------------------------------------------------------------------------- */
function isloh_getBookmarks() {
  try { return JSON.parse(localStorage.getItem(ISLOH_BOOKMARKS_KEY)) || []; } catch (e) { return []; }
}
function isloh_setBookmarks(items) {
  localStorage.setItem(ISLOH_BOOKMARKS_KEY, JSON.stringify(items));
}
function isloh_isBookmarked(id) {
  return isloh_getBookmarks().some((m) => m.id === id);
}
function isloh_removeBookmark(id) {
  isloh_setBookmarks(isloh_getBookmarks().filter((m) => m.id !== id));
}

// Material qo'shadi yoki olib tashlaydi.
// Qaytaradi: true — saqlandi, false — olib tashlandi.
function isloh_toggleBookmark(material) {
  const items = isloh_getBookmarks();
  const idx = items.findIndex((m) => m.id === material.id);
  if (idx > -1) {
    items.splice(idx, 1);
    isloh_setBookmarks(items);
    return false;
  }
  const style = ISLOH_MATERIAL_STYLE[material.type] || ISLOH_MATERIAL_STYLE.lesson;
  items.push({
    id: material.id,
    type: material.type || 'lesson',
    title: material.title,
    sub: material.sub || '',
    icon: material.icon || style.icon,
    cover: material.cover || style.cover,
    href: material.href || '',
    date: new Date().toISOString().slice(0, 10)
  });
  isloh_setBookmarks(items);
  return true;
}

/* --------------------------------------------------------------------------
   2) bookmarks.html ro'yxati
   -------------------------------------------------------------------------- */
function isloh_bookmarkMaterialCard(material) {
  const style = ISLOH_MATERIAL_STYLE[material.type] || ISLOH_MATERIAL_STYLE.lesson;

  const el = document.createElement('div');
  el.className = 'card bookmark-card';
  el.setAttribute('data-filter-item', '');
  el.setAttribute('data-bookmark-item', '');
  el.setAttribute(ISLOH_BM_DYNAMIC_ATTR, '');
  el.dataset.bookmarkId = material.id;
  el.dataset.type = material.type;
  el.dataset.title = material.title;
  el.dataset.date = material.date;
  el.dataset.filterText = material.title;

  const open = material.href
    ? `<a href="${material.href}" class="btn btn-outline btn-sm">Ochish</a>`
    : '<button class="btn btn-outline btn-sm">Ochish</button>';

  el.innerHTML = `
    <div class="bookmark-thumb" style="background:${material.cover};"><i class="${material.icon}"></i></div>
    <div class="bookmark-body">
      <div class="bookmark-title filter-title">${material.title}</div>
      <div class="bookmark-sub">${material.sub}</div>
      <div class="bookmark-tags"><span class="badge badge-neutral">${style.label}</span></div>
    </div>
    <div class="bookmark-actions">
      ${open}
      <button class="bookmark-remove" data-bookmark-remove aria-label="O'chirish"><i class="bi bi-x-lg"></i></button>
    </div>`;
  return el;
}

// Do'kondagi materiallarni qaytadan chizadi (statik demo elementlarga tegmaydi)
function isloh_renderDynamicBookmarks() {
  const list = document.querySelector('[data-bookmark-list]');
  if (!list) return;

  list.querySelectorAll(`[${ISLOH_BM_DYNAMIC_ATTR}]`).forEach((el) => el.remove());

  const cards = isloh_getBookmarks()
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')) // eng yangisi birinchi
    .map(isloh_bookmarkMaterialCard);

  if (cards.length) list.prepend(...cards);
}

function isloh_recountBookmarks() {
  const n = document.querySelectorAll('[data-bookmark-item]').length;
  const el = document.getElementById('bookmark-total');
  if (el) el.textContent = n;
  // Filtrni qayta qo'llaymiz — bo'sh holat (.empty-state) shu yerda ko'rinadi
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

// Boshqa modul (masalan course-player) material qo'shganda chaqiriladi
function isloh_refreshBookmarks() {
  if (!document.querySelector('[data-bookmark-list]')) return;
  isloh_renderDynamicBookmarks();
  isloh_sortBookmarks(document.getElementById('bookmark-sort')?.value || 'recent');
  isloh_recountBookmarks();
}

function isloh_sortBookmarks(mode) {
  document.querySelectorAll('[data-bookmark-list]').forEach((list) => {
    const items = [...list.querySelectorAll('[data-bookmark-item]')];
    items.sort((a, b) => {
      if (mode === 'title') return (a.dataset.title || '').localeCompare(b.dataset.title || '');
      // default: eng yangisi birinchi
      return (b.dataset.date || '').localeCompare(a.dataset.date || '');
    });
    items.forEach((i) => list.appendChild(i));
    // Bo'sh holat bloki har doim ro'yxat oxirida qolishi kerak
    const empty = list.querySelector('[data-filter-empty]');
    if (empty) list.appendChild(empty);
  });
}

// O'chirish — delegatsiya orqali, shuning uchun dinamik kartochkalar ham ishlaydi
function isloh_initBookmarkRemoval() {
  const list = document.querySelector('[data-bookmark-list]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bookmark-remove]');
    if (!btn) return;
    e.stopPropagation();
    const item = btn.closest('[data-bookmark-item]');
    if (!item) return;

    // Do'kondan kelgan material bo'lsa — localStorage'dan ham o'chiramiz
    if (item.dataset.bookmarkId) isloh_removeBookmark(item.dataset.bookmarkId);

    item.remove();
    isloh_recountBookmarks();
    if (typeof isloh_showToast === 'function') {
      isloh_showToast('Saqlanganlardan olib tashlandi', 'success');
    }
  });
}

function isloh_initBookmarks() {
  const list = document.querySelector('[data-bookmark-list]');
  if (!list) return; // helper'lar uchun yuklangan sahifalarda — no-op

  isloh_renderDynamicBookmarks();
  isloh_initBookmarkRemoval();

  const sort = document.getElementById('bookmark-sort');
  if (sort) sort.addEventListener('change', () => isloh_sortBookmarks(sort.value));

  isloh_sortBookmarks('recent');
  isloh_recountBookmarks();
}

document.addEventListener('DOMContentLoaded', isloh_initBookmarks);
