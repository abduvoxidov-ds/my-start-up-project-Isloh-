/* ==========================================================================
   ISLOH — Profil ro'yxatlarini tahrirlash

   Ko'nikma, maqsad va yo'nalishlarni qo'shish/o'chirish. Ilgari bu ro'yxatlar
   HTML ichida qotib turardi, ya'ni foydalanuvchi ularga umuman tegolmasdi.

   Bitta umumiy dialog uch xil ro'yxatga xizmat qiladi (CLAUDE.md §2 — DRY):
   sahifada faqat "Tahrirlash" tugmasi turadi, dialog markupini shu modul
   o'zi yaratib body'ga qo'shadi — shuning uchun ikkala profil sahifasida
   bir xil modal markupi takrorlanmaydi.

   Ochish/yopish, fokus tuzog'i va Escape — js/modal.js zimmasida.
   Saqlash isloh_updateUserProfile orqali, u `isloh:user-updated` hodisasini
   uchiradi — ro'yxatlar (js/profile-sections.js) va raqamlar
   (js/profile-stats.js) o'zi qayta chiziladi.

   Markup shartnomasi:
     [data-profile-edit="skills|goals|categories"] -> tahrirlash tugmasi
   ========================================================================== */

const ISLOH_EDITOR_MODAL_ID = 'profile-list-modal';
const ISLOH_EDITOR_TITLE_ID = 'profile-list-modal-title';
const ISLOH_SKILL_LEVELS = ["Boshlang'ich", "O'rta", "Ilg'or", 'Ekspert'];

/* Har bir ro'yxat turi: profil maydoni, dialog sarlavhasi, qator matni,
   qo'shish formasi va tekshiruvi. */
const ISLOH_EDITOR_CONFIG = {
  skills: {
    field: 'skills',
    title: "Ko'nikmalarni tahrirlash",
    empty: "Ro'yxat bo'sh — quyidan birinchi ko'nikmani qo'shing.",
    label: (item) => item.name + (item.level ? ' — ' + item.level : ''),
    key: (item) => String(item.name || '').toLowerCase(),
    inputs: [
      { name: 'name', label: "Ko'nikma", placeholder: 'Masalan: Python' },
      { name: 'level', label: 'Daraja', options: ISLOH_SKILL_LEVELS }
    ],
    build: (values) => ({ name: values.name, level: values.level }),
    invalid: (values) => (values.name ? null : "Ko'nikma nomini kiriting")
  },
  goals: {
    field: 'goals',
    title: 'Maqsadlarni tahrirlash',
    empty: "Ro'yxat bo'sh — quyidan birinchi maqsadni qo'shing.",
    label: (item) => item.text,
    key: (item) => String(item.text || '').toLowerCase(),
    inputs: [
      { name: 'text', label: 'Maqsad', placeholder: "Masalan: REST API loyihasini qurish" }
    ],
    build: (values) => ({ text: values.text }),
    invalid: (values) => (values.text ? null : 'Maqsad matnini kiriting')
  },
  categories: {
    field: 'categories',
    title: "Yo'nalishlarni tahrirlash",
    empty: "Ro'yxat bo'sh — quyidan birinchi yo'nalishni qo'shing.",
    label: (item) => item,
    key: (item) => String(item || '').toLowerCase(),
    inputs: [
      { name: 'name', label: "Yo'nalish", placeholder: 'Masalan: DevOps' }
    ],
    build: (values) => values.name,
    invalid: (values) => (values.name ? null : "Yo'nalish nomini kiriting")
  }
};

/* Dialog qaysi ro'yxat ustida ochilgani. */
let isloh_editorMode = null;

function isloh_editorEscape(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isloh_editorConfig() {
  return ISLOH_EDITOR_CONFIG[isloh_editorMode] || null;
}

/* Joriy ro'yxat — profil do'konidan. Har doim nusxa qaytadi, shuning uchun
   do'kondagi massiv tasodifan joyida o'zgarib ketmaydi. */
function isloh_editorList() {
  const config = isloh_editorConfig();
  if (!config || typeof isloh_getUserProfile !== 'function') return [];
  const value = isloh_getUserProfile()[config.field];
  return Array.isArray(value) ? value.slice() : [];
}

/* Provayder sahifalarida yashil, talabada binafsha aksent. */
function isloh_editorAccentClass() {
  const role = typeof isloh_getActiveRole === 'function' ? isloh_getActiveRole() : 'student';
  return role === 'instructor' ? 'btn-teach' : 'btn-primary';
}

/* --- Dialog markupi ------------------------------------------------------ */

function isloh_ensureEditorModal() {
  const existing = document.getElementById(ISLOH_EDITOR_MODAL_ID);
  if (existing) return existing;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = ISLOH_EDITOR_MODAL_ID;
  overlay.hidden = true;
  overlay.innerHTML = '<div class="modal modal-editor" role="dialog" aria-modal="true" aria-labelledby="' + ISLOH_EDITOR_TITLE_ID + '">'
    + '<div class="modal-head">'
    + '<h3 class="modal-title" id="' + ISLOH_EDITOR_TITLE_ID + '" data-editor-title>Ro\'yxatni tahrirlash</h3>'
    + '<button type="button" class="icon-btn" data-modal-close aria-label="Yopish"><i class="bi bi-x-lg"></i></button>'
    + '</div>'
    + '<div class="modal-body">'
    + '<div data-editor-rows></div>'
    + '<div class="editor-add" data-editor-add></div>'
    + '</div>'
    + '<div class="modal-foot"><button type="button" class="btn btn-outline" data-modal-close>Yopish</button></div>'
    + '</div>';

  document.body.appendChild(overlay);
  return overlay;
}

function isloh_editorRowsHtml(config, list) {
  if (!list.length) return '<div class="profile-empty">' + isloh_editorEscape(config.empty) + '</div>';

  return list.map((item, index) => {
    const label = isloh_editorEscape(config.label(item));
    return '<div class="editor-row">'
         + '<span class="editor-row-text">' + label + '</span>'
         + '<button type="button" class="icon-btn" data-editor-remove="' + index + '"'
         + ' aria-label="' + label + " — o'chirish" + '"><i class="bi bi-trash"></i></button>'
         + '</div>';
  }).join('');
}

function isloh_editorFormHtml(config) {
  const fields = config.inputs.map((input) => {
    const id = 'editor-field-' + input.name;
    const control = input.options
      ? '<select id="' + id + '" data-editor-input="' + input.name + '">'
        + input.options.map((option) => '<option>' + isloh_editorEscape(option) + '</option>').join('')
        + '</select>'
      : '<input id="' + id + '" data-editor-input="' + input.name + '" placeholder="'
        + isloh_editorEscape(input.placeholder || '') + '">';

    return '<div class="field"><label for="' + id + '">' + isloh_editorEscape(input.label) + '</label>' + control + '</div>';
  }).join('');

  return fields
    + '<button type="button" class="btn ' + isloh_editorAccentClass() + ' btn-sm" data-editor-submit>'
    + '<i class="bi bi-plus-lg"></i> Qo\'shish</button>';
}

function isloh_renderEditor() {
  const config = isloh_editorConfig();
  const overlay = document.getElementById(ISLOH_EDITOR_MODAL_ID);
  if (!config || !overlay) return;

  overlay.querySelector('[data-editor-title]').textContent = config.title;
  overlay.querySelector('[data-editor-rows]').innerHTML = isloh_editorRowsHtml(config, isloh_editorList());
  overlay.querySelector('[data-editor-add]').innerHTML = isloh_editorFormHtml(config);
}

/* --- Saqlash -------------------------------------------------------------- */

function isloh_editorToast(message, type) {
  if (typeof isloh_toast === 'function') isloh_toast(message, type);
}

function isloh_editorSave(list, message) {
  const config = isloh_editorConfig();
  const patch = {};
  patch[config.field] = list;

  if (!isloh_updateUserProfile(patch)) {
    isloh_editorToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    return;
  }
  isloh_renderEditor();
  isloh_editorToast(message);
}

function isloh_editorRemove(index) {
  const list = isloh_editorList();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  isloh_editorSave(list, "Ro'yxatdan olib tashlandi");
}

function isloh_editorAdd(overlay) {
  const config = isloh_editorConfig();
  const values = {};
  overlay.querySelectorAll('[data-editor-input]').forEach((el) => {
    values[el.dataset.editorInput] = el.value.trim();
  });

  const error = config.invalid(values);
  if (error) { isloh_editorToast(error, 'error'); return; }

  const list = isloh_editorList();
  const candidate = config.build(values);
  if (list.some((item) => config.key(item) === config.key(candidate))) {
    isloh_editorToast("Bu yozuv ro'yxatda allaqachon bor", 'error');
    return;
  }

  list.push(candidate);
  isloh_editorSave(list, "Ro'yxatga qo'shildi");
}

/* --- Hodisalar ------------------------------------------------------------
   Delegatsiya: dialog ichidagi tugmalar har safar qaytadan chiziladi,
   shuning uchun ular document darajasida tinglanadi (js/modal.js bilan
   bir xil yondashuv). */
function isloh_initProfileEditor() {
  if (!document.querySelector('[data-profile-edit]')) return; // bu sahifa emas

  isloh_ensureEditorModal();

  document.addEventListener('click', (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;

    const opener = e.target.closest('[data-profile-edit]');
    if (opener) {
      isloh_editorMode = opener.dataset.profileEdit;
      isloh_renderEditor();
      if (typeof isloh_openModal === 'function') isloh_openModal(ISLOH_EDITOR_MODAL_ID);
      return;
    }

    const overlay = document.getElementById(ISLOH_EDITOR_MODAL_ID);
    if (!overlay || overlay.hidden || !overlay.contains(e.target)) return;

    const removeBtn = e.target.closest('[data-editor-remove]');
    if (removeBtn) { isloh_editorRemove(Number(removeBtn.dataset.editorRemove)); return; }

    if (e.target.closest('[data-editor-submit]')) isloh_editorAdd(overlay);
  });

  /* Matn maydonida Enter — "Qo'shish" bilan bir xil. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const overlay = document.getElementById(ISLOH_EDITOR_MODAL_ID);
    if (!overlay || overlay.hidden || !overlay.contains(e.target)) return;
    if (!e.target.matches('input[data-editor-input]')) return;

    e.preventDefault();
    isloh_editorAdd(overlay);
  });
}

document.addEventListener('DOMContentLoaded', isloh_initProfileEditor);
