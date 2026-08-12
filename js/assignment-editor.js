/* ==========================================================================
   ISLOH — Topshiriq muharriri (pages/instructor/assignment-editor.html)

   Sahifa endi js/assignment-store.js dagi `isloh_assignments` do'koniga
   ulangan: `?id=<topshiriq>` bilan ochiladi, maydonlar do'kondan
   to'ldiriladi, "Saqlash" esa o'sha yozuvni yangilaydi.

   NEGA O'ZGARDI: ilgari sahifa qaysi topshiriq ochilganini BILMASDI —
   qiymatlar markupga qo'lda yozilgan edi ("Django modellari loyihasi",
   100 ball, 28-iyul). Qaysi kartochkadan kirilganidan qat'i nazar ayni
   o'sha matn ko'rinardi. "Saqlash" esa js/draft-store.js orqali maydonni
   SAHIFA NOMI bo'yicha saqlardi — ya'ni A topshirig'ida yozilgan matn
   keyin B topshirig'ida chiqib qolardi.

   Saqlash mexanikasi qayta yozilmadi: js/unsaved-guard.js dagi
   almashtiriladigan do'kon nuqtasidan foydalaniladi
   (`data-unsaved-store="assignment"`), xuddi js/platform-settings.js
   kabi. Shu sababli "Saqlanmagan o'zgarishlar" nishoni, beforeunload
   ogohlantirishi va "Saqlash" tugmasi avvalgidek ishlayveradi.

   Markup shartnomasi:
     [data-assignment-field="<nom>"]     → input / textarea / select
     [data-assignment-check="<nom>"]     → switch (text|file|multi|allowLate|published)
     [data-assignment-radio="visibility"] → radio guruhi
     [data-assignment-out="<nom>"]       → faqat ko'rsatish uchun matn
     [data-row-list="rubric-row-template"] → rubrika qatorlari
     [data-row-list="filetype-chip-list"]  → ruxsat etilgan fayl turlari
   ========================================================================== */

/* Matn maydonlari — do'kondagi nom bilan bir xil atalади. */
const ISLOH_ASSIGNMENT_TEXT_FIELDS = ['title', 'desc', 'instructions', 'dueDate', 'dueTime', 'notes'];

/* Raqamli maydonlar alohida: bo'sh qiymat 0 emas, standart qiymat bo'lishi
   kerak, aks holda tozalab qo'yilgan maydon ballni nolga tushirardi. */
const ISLOH_ASSIGNMENT_NUMBER_FIELDS = ['maxScore', 'estimate', 'attempts', 'latePenalty', 'maxFiles', 'maxSizeMb'];

function isloh_asFieldEl(name) {
  return document.querySelector(`[data-assignment-field="${name}"]`);
}

function isloh_asCheckEl(name) {
  return document.querySelector(`[data-assignment-check="${name}"]`);
}

function isloh_asEditorId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

/* --- Topshirish turi ------------------------------------------------------
   Do'konda bitta qiymat (text|file|multi), markupda esa uchta switch —
   shuning uchun ikki tomonga o'girish shu yerda, bitta joyda. */
function isloh_readSubmitType() {
  const text = isloh_asCheckEl('text');
  const file = isloh_asCheckEl('file');
  const multi = isloh_asCheckEl('multi');

  if (file && file.checked) return multi && multi.checked ? 'multi' : 'file';
  if (text && text.checked) return 'text';
  return 'file';
}

function isloh_applySubmitType(type) {
  const text = isloh_asCheckEl('text');
  const file = isloh_asCheckEl('file');
  const multi = isloh_asCheckEl('multi');

  if (text) text.checked = type === 'text';
  if (file) file.checked = type === 'file' || type === 'multi';
  if (multi) multi.checked = type === 'multi';
}

/* --- Rubrika --------------------------------------------------------------
   Qatorlar <template id="rubric-row-template"> dan yasaladi — markupdagi
   shakl bitta joyda qoladi (js/lesson-editor.js dagi "qator qo'shish"
   dvigateli ham aynan shu shablonni ishlatadi). */
function isloh_rubricList() {
  return document.querySelector('[data-row-list="rubric-row-template"]');
}

function isloh_readRubric() {
  const list = isloh_rubricList();
  if (!list) return null;

  return [...list.children].map((row) => {
    const text = row.querySelector('input[type="text"]');
    const points = row.querySelector('input[type="number"]');
    return { text: text ? text.value.trim() : '', points: points ? parseFloat(points.value) || 0 : 0 };
  }).filter((item) => item.text);
}

function isloh_renderRubric(rubric) {
  const list = isloh_rubricList();
  const template = document.getElementById('rubric-row-template');
  if (!list || !template) return;

  list.innerHTML = '';
  rubric.forEach((item) => {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector('input[type="text"]').value = item.text;
    row.querySelector('input[type="number"]').value = item.points;
    list.appendChild(row);
  });
}

/* --- Fayl turlari --------------------------------------------------------- */

function isloh_fileTypeList() {
  return document.querySelector('[data-row-list="filetype-chip-list"]');
}

function isloh_fileTypeChipHtml(ext) {
  const label = ext.replace(/^\./, '').toUpperCase();
  return `<span class="file-chip">.${label} <button type="button" data-remove-row aria-label="${label} ni olib tashlash"><i class="bi bi-x"></i></button></span>`;
}

function isloh_readFileTypes() {
  const list = isloh_fileTypeList();
  if (!list) return null;
  return [...list.querySelectorAll('.file-chip')]
    .map((chip) => chip.textContent.trim().split(/\s+/)[0].toLowerCase())
    .filter(Boolean);
}

function isloh_renderFileTypes(types) {
  const list = isloh_fileTypeList();
  if (!list) return;
  list.innerHTML = types.map(isloh_fileTypeChipHtml).join('');
}

/* --- Formani to'ldirish --------------------------------------------------- */

function isloh_fillAssignmentForm() {
  const assignment = isloh_getAssignment(isloh_asEditorId());
  if (!assignment) return 0;

  let filled = 0;
  ISLOH_ASSIGNMENT_TEXT_FIELDS.forEach((name) => {
    const el = isloh_asFieldEl(name);
    if (!el) return;
    el.value = assignment[name] || '';
    filled += 1;
  });

  ISLOH_ASSIGNMENT_NUMBER_FIELDS.forEach((name) => {
    const el = isloh_asFieldEl(name);
    if (!el) return;
    el.value = assignment[name];
    filled += 1;
  });

  isloh_applySubmitType(assignment.submitType);

  const allowLate = isloh_asCheckEl('allowLate');
  if (allowLate) allowLate.checked = !!assignment.allowLate;

  const published = isloh_asCheckEl('published');
  if (published) published.checked = assignment.status === 'published';

  document.querySelectorAll('[data-assignment-radio="visibility"]').forEach((radio) => {
    radio.checked = radio.value === assignment.visibility;
  });

  isloh_renderRubric(assignment.rubric);
  isloh_renderFileTypes(assignment.fileTypes);

  /* Qiymatlar JS bilan qo'yilgani uchun `change` otilmaydi — `data-reveals`
     bloklarini qo'lda moslaymiz, aks holda "Fayl yuklash" o'chirilgan
     topshiriqda ham fayl sozlamalari ochiq qolardi. */
  if (typeof isloh_syncRevealToggles === 'function') isloh_syncRevealToggles();

  isloh_renderAssignmentOutputs(assignment);
  return filled;
}

/* --- Faqat ko'rsatiladigan qiymatlar (sarlavha, nishon, ko'rib chiqish) --- */

function isloh_renderAssignmentOutputs(assignment) {
  const values = {
    status: (ISLOH_ASSIGNMENT_STATUSES[assignment.status] || ISLOH_ASSIGNMENT_STATUSES.draft).label,
    title: assignment.title,
    instructions: assignment.instructions || assignment.desc || '—',
    scoreLine: assignment.maxScore + ' ball · Muddat: ' + isloh_assignmentDueLabel(assignment),
    rubricLine: assignment.rubric.length
      ? assignment.rubric.length + ' mezon · ' + assignment.rubric.reduce((sum, r) => sum + (r.points || 0), 0) + ' ball'
      : 'Mezon belgilanmagan',
    submissions: isloh_getSubmissions().filter((s) => s.assignmentId === assignment.id).length + ' ta topshirilgan ish'
  };

  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-assignment-out="${key}"]`).forEach((el) => {
      el.textContent = values[key];
    });
  });

  const badge = document.querySelector('[data-assignment-status-badge]');
  if (badge) {
    const meta = ISLOH_ASSIGNMENT_STATUSES[assignment.status] || ISLOH_ASSIGNMENT_STATUSES.draft;
    badge.className = 'badge ' + meta.badge;
    badge.textContent = meta.label;
  }

  /* Brauzer tabidagi sarlavha ham markupda qotib qolgan edi — qaysi
     topshiriq ochilganidan qat'i nazar "Django modellari loyihasi" derdi. */
  document.title = assignment.title + " — Topshiriqni tahrirlash — Isloh";

  /* "Topshiriq loyihalariga qaytish" havolasi kursni yo'qotmasin. */
  document.querySelectorAll('[data-assignment-back]').forEach((link) => {
    link.href = 'assignment-builder.html?course=' + encodeURIComponent(assignment.courseId);
  });

  /* Qolgan kurs bo'limlari havolalari ham (Kurs tarkibi) — course-store. */
  if (typeof isloh_applyCourseLinks === 'function') isloh_applyCourseLinks(assignment.courseId);
}

/* --- Saqlash --------------------------------------------------------------
   js/unsaved-guard.js shartnomasi: saqlangan maydonlar sonini qaytaradi,
   xatoda manfiy son. */
function isloh_saveAssignmentForm() {
  const id = isloh_asEditorId();
  if (!id) return null; // muharrir topshiriqsiz ochilgan — hech narsa saqlamaymiz

  const data = { id: id };
  let count = 0;

  ISLOH_ASSIGNMENT_TEXT_FIELDS.forEach((name) => {
    const el = isloh_asFieldEl(name);
    if (!el) return;
    data[name] = el.value.trim();
    count += 1;
  });

  ISLOH_ASSIGNMENT_NUMBER_FIELDS.forEach((name) => {
    const el = isloh_asFieldEl(name);
    if (!el || el.value === '') return;
    data[name] = Math.max(0, parseFloat(el.value) || 0);
    count += 1;
  });

  data.submitType = isloh_readSubmitType();

  const allowLate = isloh_asCheckEl('allowLate');
  if (allowLate) data.allowLate = allowLate.checked;

  const published = isloh_asCheckEl('published');
  if (published) data.status = published.checked ? 'published' : 'draft';

  const visibility = document.querySelector('[data-assignment-radio="visibility"]:checked');
  if (visibility) data.visibility = visibility.value;

  const rubric = isloh_readRubric();
  if (rubric) data.rubric = rubric;

  const fileTypes = isloh_readFileTypes();
  if (fileTypes) data.fileTypes = fileTypes;

  const saved = isloh_saveAssignment(data);
  if (!saved) return -1;

  isloh_renderAssignmentOutputs(saved);
  return count;
}

/* Do'kon js/unsaved-guard.js ga ro'yxatdan o'tadi — fayl yuklanishida,
   DOMContentLoaded'dan OLDIN (platform-settings.js bilan bir xil). */
if (typeof isloh_registerUnsavedStore === 'function') {
  isloh_registerUnsavedStore('assignment', {
    save: () => isloh_saveAssignmentForm(),
    restore: () => isloh_fillAssignmentForm()
  });
}

/* --- Sahifaga xos kichik xatti-harakatlar --------------------------------- */

/* Ruxsat etilgan fayl turi qo'shish. O'chirish js/lesson-editor.js dagi
   umumiy [data-row-list]/[data-remove-row] dvigateli zimmasida. */
function isloh_initFileTypeChips() {
  const input = document.getElementById('as-filetype-input');
  const addBtn = document.querySelector('[data-add-filetype]');
  const list = isloh_fileTypeList();
  if (!input || !addBtn || !list) return;

  function addChip() {
    const value = input.value.trim().replace(/^\./, '');
    if (!value) return;
    list.insertAdjacentHTML('beforeend', isloh_fileTypeChipHtml(value));
    input.value = '';
    input.focus();
  }

  addBtn.addEventListener('click', addChip);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addChip(); }
  });
}

/* Rubrika jami balli — qatorlar o'zgarganda jonli hisoblanadi. */
function isloh_initRubricTotal() {
  const list = isloh_rubricList();
  const totalEl = document.querySelector('[data-rubric-total]');
  if (!list || !totalEl) return;

  function recompute() {
    const total = [...list.querySelectorAll('input[type="number"]')]
      .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    totalEl.textContent = total;
  }
  list.addEventListener('input', recompute);
  list.addEventListener('click', (e) => { if (e.target.closest('[data-remove-row]')) setTimeout(recompute, 0); });
  document.querySelector('[data-add-row="rubric-row-template"]')?.addEventListener('click', () => setTimeout(recompute, 0));
  recompute();
}

/* Topshiriq topilmasa — ochiq aytamiz. Ilgari sahifa begona topshiriqning
   markupdagi qiymatlarini ko'rsatib turaverardi. */
function isloh_initAssignmentEditorGuard() {
  if (!document.querySelector('[data-assignment-field="title"]')) return;
  if (isloh_getAssignment(isloh_asEditorId())) return;

  if (typeof isloh_showToast === 'function') {
    isloh_showToast(isloh_asEditorId() ? 'Bunday topshiriq topilmadi' : "Topshiriq tanlanmagan — ro'yxatdan oching", 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initAssignmentEditorGuard();
  isloh_initFileTypeChips();
  isloh_initRubricTotal();
});
