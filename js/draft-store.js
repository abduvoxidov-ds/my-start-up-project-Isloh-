/* ==========================================================================
   ISLOH — Tahrir qoralamalari do'koni
   Dars/test/topshiriq muharrirlaridagi "Saqlash" tugmasi shu paytgacha
   faqat "O'zgarishlar saqlandi" deb toast chiqarardi va dirty-bayroqni
   tozalardi — sahifa yangilansa yozilgan hamma narsa yo'q bo'lardi.

   Bu modul umumiy yechim beradi: `[data-unsaved-scope]` ichidagi barcha
   NOMLANGAN maydonlar (id yoki name'ga ega input/textarea/select) sahifa
   manzili bo'yicha `isloh_drafts` do'koniga yoziladi va qaytib kelinganda
   tiklanadi.

   Do'kon shakli: { "<sahifa>": { "<maydon-id>": "<qiymat>" } }

   Cheklov (ataylab): dinamik qo'shilgan kartochkalar (masalan yangi savol
   yoki modul) barqaror id'ga ega emas, shuning uchun ular saqlanmaydi —
   ular uchun alohida do'kon kerak. Shuning uchun "saqlandi" xabari ham
   aniq: nima saqlanganini aytadi.
   ========================================================================== */

const ISLOH_DRAFTS_KEY = 'isloh_drafts';
const ISLOH_DRAFT_FIELD_SEL = 'input:not([type="file"]):not([data-no-draft]), textarea:not([data-no-draft]), select:not([data-no-draft])';

/* Kalitni aniqlaydigan query parametrlari — TARTIB QAT'IY, aks holda
   `?course=a&module=b` va `?module=b&course=a` ikki xil kalit berardi. */
const ISLOH_DRAFT_SCOPE_PARAMS = ['id', 'course', 'module', 'lesson'];

/* Sahifa kaliti — fayl nomi + ochilgan yozuv identifikatorlari, masalan
   "lesson-editor.html?py-101:mod-1:les-3".

   NEGA IDENTIFIKATOR KERAK: ilgari kalit faqat fayl nomi edi
   ("lesson-editor.html"), ya'ni BARCHA darslar bitta qoralamani baham
   ko'rardi — A darsida yozilgan matn keyin B darsini ochganda paydo
   bo'lardi. Endi har bir yozuvning o'z qoralamasi bor. */
function isloh_draftPageKey() {
  const parts = window.location.pathname.split('/');
  const page = parts[parts.length - 1] || 'index.html';

  const params = new URLSearchParams(window.location.search);
  const scope = ISLOH_DRAFT_SCOPE_PARAMS
    .map((name) => params.get(name))
    .filter(Boolean)
    .join(':');

  return scope ? page + '?' + scope : page;
}

function isloh_readDrafts() {
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_DRAFTS_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch (e) {
    return {};
  }
}

function isloh_draftFieldKey(el) {
  return el.id || el.name || '';
}

function isloh_draftFields(scope) {
  return [...scope.querySelectorAll(ISLOH_DRAFT_FIELD_SEL)].filter(isloh_draftFieldKey);
}

/* Saqlaydi. Saqlangan maydonlar sonini qaytaradi, xatoda -1. */
function isloh_saveDraft(scope) {
  const fields = isloh_draftFields(scope);
  const data = {};

  fields.forEach((el) => {
    const key = isloh_draftFieldKey(el);
    if (el.type === 'checkbox' || el.type === 'radio') data[key] = el.checked;
    else data[key] = el.value;
  });

  const drafts = isloh_readDrafts();
  drafts[isloh_draftPageKey()] = data;

  try {
    localStorage.setItem(ISLOH_DRAFTS_KEY, JSON.stringify(drafts));
    return fields.length;
  } catch (e) {
    return -1;
  }
}

function isloh_restoreDraft(scope) {
  const data = isloh_readDrafts()[isloh_draftPageKey()];
  if (!data) return 0;

  let restored = 0;
  isloh_draftFields(scope).forEach((el) => {
    const key = isloh_draftFieldKey(el);
    if (!(key in data)) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!data[key];
    else el.value = data[key];
    restored += 1;
  });
  return restored;
}
