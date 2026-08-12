/* ==========================================================================
   ISLOH — Resurslar boshqaruvi (pages/instructor/resource-manager.html)

   Papka kafellari, katakcha va jadval ko'rinishlari, statistika —
   hammasi js/resource-store.js dagi `isloh_resources` do'konidan.
   Sahifa BITTA kursga tegishli: ?course= yoki ?id=.

   NEGA O'ZGARDI: 11 ta fayl HTML ichida IKKI MARTA (katakcha + jadval)
   yozilgan edi; nusxalash DOM'da nusxa yasardi, arxivlash faqat klass
   qo'shardi, "Ko'chirish" esa umuman hech narsa qilmasdi — oyna yopilib
   "Resurs ko'chirildi" degan yolg'on toast chiqarardi. Papka
   kafellaridagi sonlar va yuqoridagi statistika ham ro'yxat bilan
   bog'liq emas edi.

   Umumiy xatti-harakatlar avvalgidek boshqa modullardan: js/filterable.js,
   js/courses.js (skeleton + ko'p tanlash), js/dropdown.js, js/modal.js.
   Shu sababli bu fayl courses.js DAN OLDIN yuklanadi.

   Bu yerda qoladigan o'ziga xos mantiq:
     - 3 tomonlama Papka / Katakcha / Ro'yxat almashtirgichi (courses.js
       dagi yordamchi faqat 2 tomonlama grid/table uchun);
     - papka ichiga kirish (kafelni bosish → shu papka fayllari).
   ========================================================================== */

let isloh_pendingResourceDelete = null;
let isloh_pendingResourceMove = null;
let isloh_activeResourceFolder = '';   // bo'sh = barcha fayllar

function isloh_resManagerCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('course') || params.get('id') || 'py-101';
}

/* --- Markup --------------------------------------------------------------- */

function isloh_resourceMenuHtml(resource) {
  const archived = resource.status === 'archived';
  const statusItem = archived
    ? `<button type="button" class="dropdown-item" data-resource-restore="${resource.id}"><i class="bi bi-arrow-counterclockwise"></i> Tiklash</button>`
    : `<button type="button" class="dropdown-item" data-resource-archive="${resource.id}"><i class="bi bi-archive"></i> Arxivlash</button>`;

  return `<div class="dropdown">
      <button class="row-action" aria-label="${resource.name} amallari"><i class="bi bi-three-dots"></i></button>
      <div class="dropdown-menu dropdown-menu-right">
        <button type="button" class="dropdown-item" data-resource-preview="${resource.id}"><i class="bi bi-eye"></i> Oldindan ko'rish</button>
        <button type="button" class="dropdown-item" data-resource-move="${resource.id}"><i class="bi bi-folder-symlink"></i> Ko'chirish</button>
        <button type="button" class="dropdown-item" data-resource-duplicate="${resource.id}"><i class="bi bi-copy"></i> Nusxalash</button>
        ${statusItem}
        <button type="button" class="dropdown-item is-danger" data-resource-delete="${resource.id}"><i class="bi bi-trash"></i> O'chirish</button>
      </div>
    </div>`;
}

function isloh_resourceCardHtml(resource) {
  const type = isloh_resourceTypeMeta(resource.type);
  const archived = resource.status === 'archived';
  const meta = isloh_resourceMetaLabel(resource) + (archived ? ' · Arxivlangan' : '');

  return `<div class="card resource-card${archived ? ' is-archived' : ''}" data-resource-item data-folder="${resource.folder}" data-filter-item data-type="${resource.type}" data-filter-text="${resource.name}">
    <input type="checkbox" data-select-item data-resource-id="${resource.id}" aria-label="${resource.name} tanlash">
    <div class="resource-icon" style="background:${type.bg};"><i class="bi ${type.icon}"></i></div>
    <div class="resource-body"><div class="resource-name filter-title">${resource.name}</div><div class="resource-meta">${meta}</div></div>
    <div class="resource-actions">${isloh_resourceMenuHtml(resource)}</div>
  </div>`;
}

function isloh_resourceRowHtml(resource) {
  const type = isloh_resourceTypeMeta(resource.type);
  const archived = resource.status === 'archived';

  return `<tr class="${archived ? 'is-archived' : ''}" data-resource-item data-folder="${resource.folder}" data-filter-item data-type="${resource.type}" data-filter-text="${resource.name}">
    <td><input type="checkbox" data-select-item data-resource-id="${resource.id}" aria-label="${resource.name} tanlash"></td>
    <td><div class="cell-main"><div class="cell-thumb" style="background:${type.bg};"><i class="bi ${type.icon}"></i></div><div class="cell-title filter-title">${resource.name}</div></div></td>
    <td>${type.label}</td>
    <td>${isloh_resourceFolderMeta(resource.folder).label}</td>
    <td>${isloh_formatResourceSize(resource.sizeKb)}</td>
    <td class="cell-sub">${isloh_relativeDate(resource.uploadedAt)}</td>
    <td>${isloh_resourceMenuHtml(resource)}</td>
  </tr>`;
}

function isloh_folderTileHtml(folder, courseId) {
  const meta = ISLOH_RESOURCE_FOLDERS[folder];
  const count = isloh_folderCount(folder, courseId);

  return `<button type="button" class="card collection-card" data-folder-tile="${folder}" data-folder-label="${meta.label}">
    <div class="collection-icon" style="background:${meta.bg};"><i class="bi ${meta.icon}"></i></div>
    <div><div class="collection-title">${meta.label}</div><div class="collection-meta">${count} ta fayl</div></div>
  </button>`;
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderResourceManager() {
  const grid = document.querySelector('[data-resource-grid]');
  const rows = document.querySelector('[data-resource-rows]');
  const folderGrid = document.querySelector('[data-folder-grid]');
  if (!grid && !rows) return;

  const courseId = isloh_resManagerCourseId();
  let list = isloh_getCourseResources(courseId);
  if (isloh_activeResourceFolder) list = list.filter((r) => r.folder === isloh_activeResourceFolder);

  if (grid) grid.innerHTML = list.map(isloh_resourceCardHtml).join('');
  if (rows) rows.innerHTML = list.map(isloh_resourceRowHtml).join('');
  if (folderGrid) {
    folderGrid.innerHTML = Object.keys(ISLOH_RESOURCE_FOLDERS)
      .map((folder) => isloh_folderTileHtml(folder, courseId)).join('');
  }

  const stats = isloh_resourceStats(courseId);
  Object.keys(stats).forEach((key) => {
    const el = document.querySelector(`[data-resource-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  });

  const courseOut = document.querySelector('[data-resource-course]');
  if (courseOut) {
    const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(courseId) : null;
    courseOut.textContent = course ? course.title : courseId;
  }

  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(courseId);

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Ko'rinish almashtirgich va papka ------------------------------------- */

function isloh_activeResourceView() {
  const active = document.querySelector('[data-view-switch] button.active');
  return (active && active.dataset.view) || 'folder';
}

function isloh_showResourcePanel(view) {
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
}

function isloh_initResourceViewSwitch() {
  const switchEl = document.querySelector('[data-view-switch]');
  if (!switchEl) return;

  switchEl.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      /* Papka ko'rinishiga qaytish = papka ichidan chiqish. */
      if (btn.dataset.view === 'folder') isloh_closeResourceFolder();
      else isloh_showResourcePanel(btn.dataset.view);
    });
  });
}

function isloh_openResourceFolder(folder) {
  isloh_activeResourceFolder = folder;
  isloh_renderResourceManager();

  /* Papka ichida katakcha ko'rinishi ochiladi — kafellar endi keraksiz. */
  isloh_showResourcePanel('grid');

  const crumb = document.querySelector('[data-folder-crumb]');
  const label = document.querySelector('[data-folder-crumb-label]');
  if (label) label.textContent = isloh_resourceFolderMeta(folder).label;
  if (crumb) crumb.hidden = false;
}

function isloh_closeResourceFolder() {
  isloh_activeResourceFolder = '';
  isloh_renderResourceManager();
  isloh_showResourcePanel(isloh_activeResourceView() === 'folder' ? 'folder' : isloh_activeResourceView());

  const crumb = document.querySelector('[data-folder-crumb]');
  if (crumb) crumb.hidden = true;
}

function isloh_initFolderDrilldown() {
  const folderGrid = document.querySelector('[data-folder-grid]');
  if (!folderGrid) return;

  folderGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-folder-tile]');
    if (tile) isloh_openResourceFolder(tile.dataset.folderTile);
  });

  document.querySelector('[data-folder-back]')?.addEventListener('click', () => {
    /* Almashtirgichni ham papka holatiga qaytaramiz. */
    const switchEl = document.querySelector('[data-view-switch]');
    if (switchEl) {
      switchEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      switchEl.querySelector('button[data-view="folder"]')?.classList.add('active');
    }
    isloh_closeResourceFolder();
  });
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_resourceToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_openResourcePreview(resource) {
  const modal = document.getElementById('preview-resource-modal');
  if (!modal || !resource) return;

  const nameEl = modal.querySelector('[data-preview-resource-name]');
  const metaEl = modal.querySelector('[data-preview-resource-meta]');
  if (nameEl) nameEl.textContent = resource.name;
  if (metaEl) {
    metaEl.textContent = [
      isloh_resourceMetaLabel(resource),
      isloh_resourceFolderMeta(resource.folder).label,
      'Yuklangan: ' + isloh_relativeDate(resource.uploadedAt)
    ].join(' · ');
  }
  if (typeof isloh_openModal === 'function') isloh_openModal('preview-resource-modal');
}

function isloh_initResourceActions() {
  const scope = document.querySelector('[data-bulk-scope]');
  if (!scope) return;

  scope.addEventListener('click', (e) => {
    const preview = e.target.closest('[data-resource-preview]');
    if (preview) {
      isloh_openResourcePreview(isloh_getResource(preview.dataset.resourcePreview));
      return;
    }

    const move = e.target.closest('[data-resource-move]');
    if (move) {
      isloh_pendingResourceMove = move.dataset.resourceMove;
      const resource = isloh_getResource(isloh_pendingResourceMove);
      const nameEl = document.querySelector('[data-move-resource-name]');
      const select = document.querySelector('[data-move-resource-folder]');
      if (nameEl) nameEl.textContent = resource ? resource.name : '';
      if (select && resource) select.value = resource.folder;
      if (typeof isloh_openModal === 'function') isloh_openModal('move-resource-modal');
      return;
    }

    const duplicate = e.target.closest('[data-resource-duplicate]');
    if (duplicate) {
      const copy = isloh_duplicateResource(duplicate.dataset.resourceDuplicate);
      isloh_renderResourceManager();
      isloh_resourceToast(copy ? 'Resurs nusxalandi' : "Nusxalab bo'lmadi", copy ? 'success' : 'error');
      return;
    }

    const archive = e.target.closest('[data-resource-archive]');
    if (archive) {
      isloh_setResourceStatus(archive.dataset.resourceArchive, 'archived');
      isloh_renderResourceManager();
      isloh_resourceToast('Resurs arxivlandi');
      return;
    }

    const restore = e.target.closest('[data-resource-restore]');
    if (restore) {
      isloh_setResourceStatus(restore.dataset.resourceRestore, 'active');
      isloh_renderResourceManager();
      isloh_resourceToast('Resurs tiklandi');
      return;
    }

    const del = e.target.closest('[data-resource-delete]');
    if (del) {
      isloh_pendingResourceDelete = del.dataset.resourceDelete;
      const resource = isloh_getResource(isloh_pendingResourceDelete);
      const nameEl = document.querySelector('[data-delete-resource-name]');
      if (nameEl) nameEl.textContent = resource ? resource.name : '';
      if (typeof isloh_openModal === 'function') isloh_openModal('delete-resource-modal');
    }
  });

  document.querySelector('[data-confirm-delete-resource]')?.addEventListener('click', () => {
    if (isloh_pendingResourceDelete) {
      isloh_deleteResource(isloh_pendingResourceDelete);
      isloh_pendingResourceDelete = null;
      isloh_renderResourceManager();
      isloh_resourceToast("Resurs o'chirildi");
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-resource-modal');
  });

  document.querySelector('[data-confirm-move-resource]')?.addEventListener('click', () => {
    const select = document.querySelector('[data-move-resource-folder]');
    if (isloh_pendingResourceMove && select) {
      const moved = isloh_moveResource(isloh_pendingResourceMove, select.value);
      isloh_pendingResourceMove = null;
      isloh_renderResourceManager();
      isloh_resourceToast(moved ? `Resurs "${isloh_resourceFolderMeta(select.value).label}" papkasiga ko'chirildi` : "Ko'chirib bo'lmadi", moved ? 'success' : 'error');
    }
    if (typeof isloh_closeModal === 'function') isloh_closeModal('move-resource-modal');
  });
}

/* Yuklash — fayl tanlanadi, metama'lumot do'konga yoziladi. Faylning O'ZI
   saqlanmaydi: localStorage'ga megabaytlik fayl sig'maydi va sig'gani ham
   noto'g'ri bo'lardi (CLAUDE.md §4 — bu backend ishi). Shu sababli oynada
   buni ochiq aytadigan izoh turadi. */
const ISLOH_RESOURCE_EXT_TYPES = {
  pdf: 'pdf', zip: 'zip', rar: 'zip',
  mp4: 'video', mov: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image',
  ppt: 'presentation', pptx: 'presentation',
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet',
  doc: 'document', docx: 'document', txt: 'document',
  py: 'code', js: 'code', yml: 'code', yaml: 'code', json: 'code', sh: 'code'
};

function isloh_resourceTypeFromName(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  return ISLOH_RESOURCE_EXT_TYPES[ext] || 'document';
}

function isloh_initResourceUpload() {
  const form = document.querySelector('[data-upload-resource-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('[data-upload-file]');
    const urlInput = form.querySelector('[data-upload-url]');
    const folder = form.querySelector('[data-upload-folder]').value;
    const category = form.querySelector('[data-upload-category]').value;

    const file = fileInput && fileInput.files.length ? fileInput.files[0] : null;
    const url = urlInput ? urlInput.value.trim() : '';

    if (!file && !url) {
      isloh_resourceToast('Fayl tanlang yoki havola kiriting', 'error');
      return;
    }

    const data = file
      ? { name: file.name, type: isloh_resourceTypeFromName(file.name), sizeKb: Math.max(1, Math.round(file.size / 1024)) }
      : { name: url.replace(/^https?:\/\//, '').replace(/\/$/, ''), type: 'url', url: url, sizeKb: 0 };

    const saved = isloh_saveResource(Object.assign(data, {
      courseId: isloh_resManagerCourseId(),
      folder: folder,
      category: category
    }));

    if (!saved) {
      isloh_resourceToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    form.reset();
    isloh_renderResourceManager();
    if (typeof isloh_closeModal === 'function') isloh_closeModal('upload-resource-modal');
    isloh_resourceToast(`"${saved.name}" qo'shildi`);
  });
}

function isloh_selectedResourceIds() {
  return [...document.querySelectorAll('[data-select-item]:checked')]
    .map((el) => el.dataset.resourceId)
    .filter(Boolean);
}

function isloh_initResourceBulkActions() {
  const bar = document.querySelector('[data-bulk-bar]');
  if (!bar) return;

  const run = (action, done) => {
    const ids = isloh_selectedResourceIds();
    if (!ids.length) return;
    ids.forEach(action);
    isloh_renderResourceManager();
    isloh_resourceToast(done.replace('{n}', ids.length));
  };

  bar.querySelector('[data-bulk-archive]')?.addEventListener('click', () => {
    run((id) => isloh_setResourceStatus(id, 'archived'), '{n} ta resurs arxivlandi');
  });
  bar.querySelector('[data-bulk-duplicate]')?.addEventListener('click', () => {
    run((id) => isloh_duplicateResource(id), '{n} ta resurs nusxalandi');
  });
  bar.querySelector('[data-bulk-delete]')?.addEventListener('click', () => {
    run((id) => isloh_deleteResource(id), "{n} ta resurs o'chirildi");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderResourceManager();
  isloh_initResourceViewSwitch();
  isloh_initFolderDrilldown();
  isloh_initResourceActions();
  isloh_initResourceUpload();
  isloh_initResourceBulkActions();
});
