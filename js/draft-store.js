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

/* Sahifa kaliti — fayl nomi (query'siz), masalan "lesson-editor.html". */
function isloh_draftPageKey() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1] || 'index.html';
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
