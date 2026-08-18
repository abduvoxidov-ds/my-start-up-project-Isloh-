/* ==========================================================================
   ISLOH — Resurslar kutubxonasi (pages/instructor/resource-library.html)

   Kutubxona — TANLASH ko'rinishi: barcha kurslar bo'ylab qayta
   ishlatiladigan resurslar. Boshqarish (papkalar, yuklash, o'chirish)
   resource-manager.html da. Ikkalasi ham bitta do'kondan o'qiydi
   (js/resource-store.js).

   NEGA O'ZGARDI: 6 ta kartochka HTML ichida yozilgan edi va boshqaruvchi
   sahifasidagi fayllar bilan hech qanday aloqasi yo'q edi — bir xil
   `architecture-diagram.png` ikki sahifada turli hajm bilan ko'rinardi.
   Sevimli yulduzchasi faqat klass almashtirardi (F5 — so'nardi),
   "Tanlash" tugmasi esa hech narsa qilmasdi. Kolleksiyalar
   ("14 ta resurs"), "Oxirgi ishlatilgan" ro'yxati va statistika
   (86 / 5 / 12 / 7) ham o'ylab topilgan raqamlar edi.

   Qamrov tablari (Barchasi / Kurs / Dars / Topshiriq / Test) do'kondagi
   `folder` maydoniga to'g'ridan-to'g'ri mos keladi, shuning uchun ular
   endi bo'sh emas — har biri o'z papkasidagi resurslarni ko'rsatadi.

   Markup shartnomasi:
     [data-library-grid="<qamrov>"] → all | general | lessons | assignments | quizzes
     [data-library-collections]     → kolleksiya kafellari
     [data-library-recent]          → oxirgi ishlatilganlar
     [data-library-stat="<nom>"]    → total | collections | favorites | recent
   ========================================================================== */

/* Tab nomi -> do'kondagi papka. `all` — filtrsiz. */
const ISLOH_LIBRARY_SCOPES = {
  all: '',
  course: 'general',
  lesson: 'lessons',
  assignment: 'assignments',
  quiz: 'quizzes'
};

function isloh_libraryCardHtml(resource) {
  const type = isloh_resourceTypeMeta(resource.type);
  const category = isloh_resourceCategoryMeta(resource.category);
  const fav = resource.favorite;

  return `<div class="card resource-card" data-filter-item data-category="${resource.category}" data-type="${resource.type}" data-filter-text="${resource.name}">
    <div class="resource-icon" style="background:${type.bg};"><i class="bi ${type.icon}"></i></div>
    <div class="resource-body">
      <div class="resource-name filter-title">${resource.name}</div>
      <div class="resource-meta">${isloh_resourceMetaLabel(resource)} · <span class="chip-demo">${category.label}</span></div>
    </div>
    <div class="resource-actions">
      <button class="fav-toggle${fav ? ' active' : ''}" data-library-fav="${resource.id}" aria-pressed="${fav}" aria-label="Sevimlilarga qo'shish/olib tashlash"><i class="bi ${fav ? 'bi-star-fill' : 'bi-star'}"></i></button>
      <button class="btn btn-teach btn-sm" data-library-pick="${resource.id}"><i class="bi bi-plus-lg"></i> Tanlash</button>
    </div>
  </div>`;
}

/* Kolleksiyalar — kategoriya bo'yicha + alohida "Sevimlilar" kafeli. */
function isloh_renderLibraryCollections() {
  const mount = document.querySelector('[data-library-collections]');
  if (!mount) return;

  const tiles = Object.keys(ISLOH_RESOURCE_CATEGORIES).map((slug) => {
    const meta = ISLOH_RESOURCE_CATEGORIES[slug];
    return `<div class="card collection-card">
      <div class="collection-icon" style="background:${meta.bg};"><i class="bi ${meta.icon}"></i></div>
      <div><div class="collection-title">${meta.label}</div><div class="collection-meta">${isloh_categoryCount(slug)} ta resurs</div></div>
    </div>`;
  });

  const favorites = isloh_libraryStats().favorites;
  tiles.push(`<div class="card collection-card">
    <div class="collection-icon" style="background:var(--teach-green);"><i class="bi bi-star-fill"></i></div>
    <div><div class="collection-title">Sevimlilar</div><div class="collection-meta">${favorites} ta resurs</div></div>
  </div>`);

  mount.innerHTML = tiles.join('');
}

function isloh_renderLibraryRecent() {
  const mount = document.querySelector('[data-library-recent]');
  if (!mount) return;

  const recent = isloh_recentResources(3);
  mount.innerHTML = recent.length
    ? recent.map((resource) => {
        const type = isloh_resourceTypeMeta(resource.type);
        return `<div class="activity-row">
          <div class="activity-ic" style="background:${type.bg}; color:#fff;"><i class="bi ${type.icon}"></i></div>
          <div class="activity-main">
            <div class="activity-text"><b>${resource.name}</b> — ${isloh_resourceFolderMeta(resource.folder).label}</div>
            <div class="activity-time">${isloh_relativeTime(resource.usedAt)}</div>
          </div>
        </div>`;
      }).join('')
    : `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Hali biror resurs tanlanmagan — "Tanlash" tugmasi bosilgach ular shu yerda ko'rinadi.</p>`;
}

function isloh_renderResourceLibrary() {
  const grids = document.querySelectorAll('[data-library-grid]');
  if (!grids.length) return;

  const active = isloh_getResources().filter((r) => r.status === 'active');

  grids.forEach((grid) => {
    const folder = ISLOH_LIBRARY_SCOPES[grid.dataset.libraryGrid];
    const list = folder ? active.filter((r) => r.folder === folder) : active;
    grid.innerHTML = list.length
      ? list.map(isloh_libraryCardHtml).join('')
      : `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Bu bo'limda hali resurs yo'q.</p>`;
  });

  isloh_renderLibraryCollections();
  isloh_renderLibraryRecent();

  const stats = isloh_libraryStats();
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-library-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  });

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_initLibraryActions() {
  document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-library-fav]');
    if (fav) {
      const updated = isloh_toggleResourceFavorite(fav.dataset.libraryFav);
      isloh_renderResourceLibrary();
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(updated && updated.favorite ? 'Sevimlilarga qo\'shildi' : 'Sevimlilardan olib tashlandi');
      }
      return;
    }

    /* "Tanlash" — resursni dars/topshiriq muharririga qo'shish. M5 da fayl
       qatlami tayyor bo'ldi, lekin BOG'LANISH hali yo'q: dars muharriri
       resurs do'koniga ulanmagan. Shu sababli bu yerda halol bajarish
       mumkin bo'lgani — ishlatilgan vaqtini belgilash, ya'ni "Oxirgi
       ishlatilgan" ro'yxati haqiqiy bo'lib qoladi. */
    const pick = e.target.closest('[data-library-pick]');
    if (pick) {
      const resource = isloh_markResourceUsed(pick.dataset.libraryPick);
      isloh_renderResourceLibrary();
      if (typeof isloh_showToast === 'function' && resource) {
        isloh_showToast(`"${resource.name}" tanlandi — muharrirga qo'shish dars muharriri ulangach ishlaydi`);
      }
    }
  });
}

/* M5: do'kon serverdan asinxron to'ladi — javob kelganda kutubxona qayta
   chiziladi, aks holda ekranda zaxira ma'lumot qolib ketardi. */
document.addEventListener('isloh:resources-updated', isloh_renderResourceLibrary);

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderResourceLibrary();
  isloh_initLibraryActions();
});
