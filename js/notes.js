/* ==========================================================================
   ISLOH — Notes module  (pages/student/notes.html)
   Do'kon js/notes-store.js da (ISLOH_NOTES_KEY) — u course-player.html
   bilan umumiy, shuning uchun darsda yozilgan izoh shu sahifada ham
   ko'rinadi. Bu fayl faqat ro'yxatni chizadi va amallarni do'konga
   bog'laydi; sahifada statik demo kartochka yo'q.

   Qidiruv + "Barchasi/Shaxsiy/Bo'lishilgan/Qadalgan" filtri umumiy
   js/filterable.js dvigatelidan keladi — kartochkalar chizilgach filtr
   qayta qo'llanadi.

   Markup contract (filterable'nikiga qo'shimcha):
     [data-notes-grid]                — kartochkalar konteyneri
     [data-note-create]               — composer'ni ochadi/yopadi
     [data-note-composer]             — yangi izoh formasi
       [data-note-title-input] / [data-note-body-input] / [data-note-tags-input]
     [data-note-save]                 — yangi izohni saqlaydi
     [data-note-tag-filter]           — teg chiplari (do'kondan chiziladi)
     [data-notes-empty-title] / [data-notes-empty-sub] — bo'sh holat matni
   ========================================================================== */

function isloh_notesStoreAvailable() {
  return typeof isloh_notesNewestFirst === 'function';
}

function isloh_noteEscape(text) {
  const div = document.createElement('div');
  div.textContent = String(text == null ? '' : text);
  return div.innerHTML;
}

/* "2 kun oldin" ko'rinishidagi nisbiy sana */
function isloh_noteRelativeDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'hozir';
  if (min < 60) return min + ' daqiqa oldin';
  const hours = Math.round(min / 60);
  if (hours < 24) return hours + ' soat oldin';
  const days = Math.round(hours / 24);
  if (days === 1) return 'kecha';
  if (days < 30) return days + ' kun oldin';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isloh_noteCardTitle(note) {
  return note.title || note.lessonTitle || 'Izoh';
}

/* Qidiruv js/filterable.js'ning data-filter-text'i orqali ishlaydi */
function isloh_noteFilterText(note) {
  return [isloh_noteCardTitle(note), note.text, note.courseTitle, (note.tags || []).join(' ')]
    .filter(Boolean).join(' ');
}

function isloh_noteCard(note) {
  const card = document.createElement('div');
  card.className = 'card shared-note-card' + (note.pinned ? ' pinned' : '');
  card.setAttribute('data-filter-item', '');
  card.dataset.noteId = note.id;
  card.dataset.scope = note.pinned ? 'pinned' : (note.scope || 'personal');
  card.dataset.tags = (note.tags || []).join(',');
  card.dataset.filterText = isloh_noteFilterText(note);

  const tags = (note.tags || [])
    .map((t) => '<span class="note-tag-pill">' + isloh_noteEscape(t) + '</span>').join('');

  // Dars izohi bo'lsa manbasi ko'rsatiladi va darsga qaytish havolasi beriladi
  const source = note.source === 'lesson'
    ? '<a class="note-source" href="course-player.html"><i class="bi bi-collection-play"></i> ' +
      isloh_noteEscape(note.courseTitle || 'Kurs') + '</a>'
    : '<span class="note-source">Shaxsiy</span>';

  card.innerHTML =
    '<div class="note-card-head">' +
      '<div class="note-title"></div>' +
      '<div class="note-card-tools">' +
        '<button class="fav-toggle' + (note.favorite ? ' active' : '') + '" data-note-favorite aria-label="Sevimli">' +
          '<i class="bi ' + (note.favorite ? 'bi-star-fill' : 'bi-star') + '"></i></button>' +
        '<button class="note-tool" data-note-pin aria-label="Qadash"><i class="bi ' + (note.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle') + '"></i></button>' +
        '<button class="note-tool note-tool-danger" data-note-delete aria-label="O\'chirish"><i class="bi bi-trash"></i></button>' +
      '</div>' +
    '</div>' +
    '<div class="note-body"></div>' +
    (tags ? '<div class="note-tag-row">' + tags + '</div>' : '') +
    '<div class="note-card-foot"><span>' + isloh_noteEscape(isloh_noteRelativeDate(note.updatedAt)) + '</span>' + source + '</div>';

  // Matnlar textContent orqali — do'kondagi matn HTML sifatida talqin qilinmasin
  card.querySelector('.note-title').textContent = isloh_noteCardTitle(note);
  card.querySelector('.note-body').textContent = note.text || '';
  return card;
}

function isloh_renderNotesGrid() {
  const grid = document.querySelector('[data-notes-grid]');
  if (!grid || !isloh_notesStoreAvailable()) return;

  grid.querySelectorAll('[data-filter-item]').forEach((el) => el.remove());
  isloh_notesNewestFirst().forEach((note) => grid.appendChild(isloh_noteCard(note)));

  isloh_renderNoteTagFilter();
  isloh_syncNotesEmptyState();

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* Teg chiplari do'kondagi haqiqiy teglardan chiziladi — avval ular
   qattiq yozilgan edi va hech qanday izohga mos kelmasdi */
function isloh_renderNoteTagFilter() {
  const group = document.querySelector('[data-note-tag-filter]');
  if (!group) return;

  const tags = isloh_notesAllTags();
  const active = group.querySelector('button.active')?.dataset.tag || 'all';
  group.hidden = !tags.length;
  if (!tags.length) { group.innerHTML = ''; return; }

  group.innerHTML = '<button class="category-chip" data-tag="all">Barcha teglar</button>' +
    tags.map((t) => '<button class="category-chip" data-tag="' + isloh_noteEscape(t) + '">' + isloh_noteEscape(t) + '</button>').join('');

  const restore = group.querySelector('[data-tag="' + (active === 'all' ? 'all' : CSS.escape(active)) + '"]') || group.querySelector('[data-tag="all"]');
  if (restore) restore.classList.add('active');
}

/* Hech qanday izoh yo'qligi bilan filtrga mos kelmasligini ajratamiz */
function isloh_syncNotesEmptyState() {
  const title = document.querySelector('[data-notes-empty-title]');
  const sub = document.querySelector('[data-notes-empty-sub]');
  if (!title || !sub) return;

  if (!isloh_notesNewestFirst().length) {
    title.textContent = 'Hali izoh yozilmagan';
    sub.textContent = "Kurs darsida izoh yozing yoki bu yerda \"Yangi izoh\" tugmasini bosing.";
  } else {
    title.textContent = 'Izoh topilmadi';
    sub.textContent = "Boshqa filtr yoki qidiruv so'zini sinab ko'ring.";
  }
}

function isloh_initNoteCreate() {
  const createBtn = document.querySelector('[data-note-create]');
  const composer = document.querySelector('[data-note-composer]');
  if (createBtn && composer) {
    createBtn.addEventListener('click', () => {
      composer.hidden = !composer.hidden;
      if (!composer.hidden) composer.querySelector('[data-note-title-input]')?.focus();
    });
  }

  const saveBtn = document.querySelector('[data-note-save]');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    const titleInput = document.querySelector('[data-note-title-input]');
    const bodyInput = document.querySelector('[data-note-body-input]');
    const tagsInput = document.querySelector('[data-note-tags-input]');
    const title = titleInput?.value.trim() || '';
    const text = bodyInput?.value.trim() || '';

    if (!title && !text) {
      if (typeof isloh_showToast === 'function') isloh_showToast('Sarlavha yoki matn kiriting', 'error');
      return;
    }

    const saved = isloh_upsertNote({
      id: 'note-' + Date.now(),
      title: title || 'Izoh',
      text,
      source: 'personal',
      scope: 'personal',
      tags: typeof isloh_parseNoteTags === 'function' ? isloh_parseNoteTags(tagsInput?.value) : []
    });

    if (!saved) {
      if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.value = '';
    if (tagsInput) tagsInput.value = '';
    if (composer) composer.hidden = true;

    isloh_renderNotesGrid();
    if (typeof isloh_showToast === 'function') isloh_showToast('Izoh saqlandi', 'success');
  });
}

/* Sevimli / qadash / o'chirish — hammasi do'konga yoziladi */
function isloh_initNoteToggles() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-note-id]');
    if (!card || !isloh_notesStoreAvailable()) return;
    const id = card.dataset.noteId;

    if (e.target.closest('[data-note-favorite]')) {
      const note = isloh_getNote(id);
      if (note) { isloh_upsertNote({ id, favorite: !note.favorite }); isloh_renderNotesGrid(); }
      return;
    }
    if (e.target.closest('[data-note-pin]')) {
      const note = isloh_getNote(id);
      if (note) { isloh_upsertNote({ id, pinned: !note.pinned }); isloh_renderNotesGrid(); }
      return;
    }
    if (e.target.closest('[data-note-delete]')) {
      isloh_removeNote(id);
      isloh_renderNotesGrid();
      if (typeof isloh_showToast === 'function') isloh_showToast("Izoh o'chirildi", 'info');
    }
  });
}

/* Teg filtri — filterable.js'ning o'z guruhlari ustiga qo'shimcha qatlam */
function isloh_initNoteTagFilter() {
  const group = document.querySelector('[data-note-tag-filter]');
  if (!group) return;

  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tag]');
    if (!btn) return;
    group.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const tag = btn.dataset.tag;
    document.querySelectorAll('[data-notes-grid] [data-filter-item]').forEach((card) => {
      const tags = (card.dataset.tags || '').split(',');
      card.hidden = !(tag === 'all' || tags.indexOf(tag) !== -1);
    });
  });
}

/* Boshqa tabda izoh o'zgarsa (masalan pleerda yozilsa) ro'yxat yangilanadi */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_NOTES_KEY) isloh_renderNotesGrid();
});

document.addEventListener('DOMContentLoaded', () => {
  isloh_renderNotesGrid();
  isloh_initNoteCreate();
  isloh_initNoteToggles();
  isloh_initNoteTagFilter();
});
