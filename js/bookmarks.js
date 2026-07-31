/* ==========================================================================
   ISLOH — Bookmarks module  ("Saqlanganlar" — pages/student/bookmarks.html)

   SCOPE: faqat DARS DARAJASIDAGI materiallar — video darslar, maqolalar,
   kod parchalari va eslatmalar. Kurs darajasidagi ma'lumot bu yerga UMUMAN
   kirmaydi — sotib olingan kurslar "Mening kurslarim" sahifasida
   (pages/student/courses.html + js/my-courses.js).

   Ikki vazifasi bor:
     1) ISLOH_BOOKMARKS_KEY do'koni — istalgan sahifa (course-player.html,
        lesson-player.html) material qo'shishi/olib tashlashi uchun.
        Shu sababli bu fayl faqat helper'lar uchun ham yuklanishi mumkin:
        pastdagi har bir render funksiyasi o'z elementini tekshiradi.
     2) bookmarks.html ro'yxatini to'liq do'kondan chizish — sahifada statik
        demo kartochka yo'q, hamma narsa localStorage'dan keladi.
   Filtrlash + qidiruv umumiy js/filterable.js dvigatelidan keladi.

   Material obyekti:
     { id, type, title, sub, icon, cover, href, date }
     type: 'lesson' | 'article' | 'code' | 'note'  — filtr chiplariga mos

   Markup contract (filterable'nikiga qo'shimcha):
     [data-bookmark-list]                     — ro'yxat konteyneri
       [data-filter-empty]                    — bo'sh holat bloki
         [data-bookmark-empty-title] / [data-bookmark-empty-sub]
     [data-recent-card] / [data-recent-bookmarks]  — "So'nggi saqlangan"
     #bookmark-total                          — jami hisoblagich
   ========================================================================== */

const ISLOH_BOOKMARKS_KEY = 'isloh_bookmarks';

// "So'nggi saqlangan" panelida nechta element ko'rsatiladi
const ISLOH_BM_RECENT_LIMIT = 3;

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
   2) Umumiy yordamchilar
   -------------------------------------------------------------------------- */
// Do'kondagi matn HTML'ga qo'yilishidan oldin xavfsizlantiriladi
function isloh_bmEscape(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// Eng yangisi birinchi bo'lgan nusxa
function isloh_bookmarksNewestFirst() {
  return isloh_getBookmarks()
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// "Bugun" / "Kecha" / "5 kun oldin" ko'rinishidagi qisqa sana
function isloh_bmRelativeDate(dateStr) {
  if (!dateStr) return '';
  const then = new Date(`${dateStr}T00:00:00`);
  if (isNaN(then)) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return 'Bugun';
  if (days === 1) return 'Kecha';
  return `${days} kun oldin`;
}

/* --------------------------------------------------------------------------
   3) bookmarks.html ro'yxati
   -------------------------------------------------------------------------- */
function isloh_bookmarkMaterialCard(material) {
  const style = ISLOH_MATERIAL_STYLE[material.type] || ISLOH_MATERIAL_STYLE.lesson;

  const el = document.createElement('div');
  el.className = 'card bookmark-card';
  el.setAttribute('data-filter-item', '');
  el.setAttribute('data-bookmark-item', '');
  el.dataset.bookmarkId = material.id;
  el.dataset.type = material.type;
  el.dataset.title = material.title;
  el.dataset.date = material.date;
  el.dataset.filterText = material.title;

  const open = material.href
    ? `<a href="${isloh_bmEscape(material.href)}" class="btn btn-outline btn-sm">Ochish</a>`
    : '<button class="btn btn-outline btn-sm">Ochish</button>';

  el.innerHTML = `
    <div class="bookmark-thumb" style="background:${material.cover || style.cover};"><i class="${material.icon || style.icon}"></i></div>
    <div class="bookmark-body">
      <div class="bookmark-title filter-title">${isloh_bmEscape(material.title)}</div>
      <div class="bookmark-sub">${isloh_bmEscape(material.sub)}</div>
      <div class="bookmark-tags"><span class="badge badge-neutral">${style.label}</span></div>
    </div>
    <div class="bookmark-actions">
      ${open}
      <button class="bookmark-remove" data-bookmark-remove aria-label="O'chirish"><i class="bi bi-x-lg"></i></button>
    </div>`;
  return el;
}

// Ro'yxatni do'kondan to'liq qayta chizadi (eng yangisi birinchi)
function isloh_renderBookmarkList() {
  const list = document.querySelector('[data-bookmark-list]');
  if (!list) return;

  list.querySelectorAll('[data-bookmark-item]').forEach((el) => el.remove());

  const empty = list.querySelector('[data-filter-empty]');
  isloh_bookmarksNewestFirst().forEach((material) => {
    const card = isloh_bookmarkMaterialCard(material);
    // Bo'sh holat bloki har doim ro'yxat oxirida qolishi kerak
    if (empty) list.insertBefore(card, empty); else list.appendChild(card);
  });
}

// O'ng ustundagi "So'nggi saqlangan" paneli — shu do'kondan
function isloh_renderRecentBookmarks() {
  const box = document.querySelector('[data-recent-bookmarks]');
  if (!box) return;

  const items = isloh_bookmarksNewestFirst().slice(0, ISLOH_BM_RECENT_LIMIT);
  box.innerHTML = items.map((m) => {
    const style = ISLOH_MATERIAL_STYLE[m.type] || ISLOH_MATERIAL_STYLE.lesson;
    return `
      <div class="upcoming-row">
        <div class="upcoming-icon" style="background:${m.cover || style.cover}; color:#fff;"><i class="${m.icon || style.icon}"></i></div>
        <div class="upcoming-body">
          <div class="upcoming-title">${isloh_bmEscape(m.title)}</div>
          <div class="upcoming-sub">${isloh_bmRelativeDate(m.date)}</div>
        </div>
      </div>`;
  }).join('');

  // Bitta ham saqlangan material bo'lmasa — panel yashiriladi va
  // ro'yxat butun kenglikni egallaydi (.bm-layout-solo)
  const card = document.querySelector('[data-recent-card]');
  if (card) card.hidden = items.length === 0;
  document.querySelector('.bm-layout')?.classList.toggle('bm-layout-solo', items.length === 0);
}

// Hisoblagich + bo'sh holat matni + filtrni qayta qo'llash
function isloh_recountBookmarks() {
  const total = isloh_getBookmarks().length;

  const totalEl = document.getElementById('bookmark-total');
  if (totalEl) totalEl.textContent = total;

  // Do'kon bo'sh bo'lsa boshqa xabar — "filtr bo'yicha topilmadi" emas
  const title = document.querySelector('[data-bookmark-empty-title]');
  const sub = document.querySelector('[data-bookmark-empty-sub]');
  if (title && sub) {
    title.textContent = total === 0 ? 'Hali hech narsa saqlanmagan' : 'Hech narsa topilmadi';
    sub.textContent = total === 0
      ? "Kurs darsini ochib, yuqoridagi xatcho'p tugmasini bosing — material shu yerda paydo bo'ladi."
      : "Bu filtr yoki qidiruv bo'yicha saqlangan element yo'q.";
  }

  // Filtrni qayta qo'llaymiz — bo'sh holat (.empty-state) shu yerda ko'rinadi
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

// Sahifadagi hamma narsani do'kon bilan sinxronlaydi.
// Boshqa modul (masalan course-player) material qo'shganda ham chaqiriladi.
function isloh_refreshBookmarks() {
  if (!document.querySelector('[data-bookmark-list]')) return;
  isloh_renderBookmarkList();
  isloh_renderRecentBookmarks();
  isloh_recountBookmarks();
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

    isloh_removeBookmark(item.dataset.bookmarkId);
    item.remove();
    isloh_renderRecentBookmarks();
    isloh_recountBookmarks();
    if (typeof isloh_showToast === 'function') {
      isloh_showToast('Saqlanganlardan olib tashlandi', 'success');
    }
  });
}

function isloh_initBookmarks() {
  if (!document.querySelector('[data-bookmark-list]')) return; // helper'lar uchun — no-op

  isloh_refreshBookmarks();
  isloh_initBookmarkRemoval();

  // Boshqa tabda material qo'shilsa/o'chirilsa — ro'yxat o'zi yangilanadi
  window.addEventListener('storage', (e) => {
    if (e.key === ISLOH_BOOKMARKS_KEY) isloh_refreshBookmarks();
  });
}

document.addEventListener('DOMContentLoaded', isloh_initBookmarks);
