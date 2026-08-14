/* ==========================================================================
   ISLOH — UI holatlari: tugma yuklanishi, tarmoq xatosi banneri, validatsiya
   Uchala holat ham loyihada tarqoq yozilgan edi (yoki umuman yo'q edi).
   Bu modul ularni bitta joyga yig'adi — chaqiruvchi UI markupini o'zi
   yasamaydi (CLAUDE.md §2).

   Mavjud komponentlar qayta ishlatiladi: `.spinner` (css/animations.css),
   `.field-error` va `.is-invalid` (css/components.css), `.net-error`
   (css/widgets.css). Inline `style` yozilmaydi.
   ========================================================================== */

/* --- 1. Tugma yuklanish holati -------------------------------------------
   Asl markup `data-prev-html` da saqlanadi: tugma ichida ikonka bo'lishi
   mumkin, faqat matnni almashtirsak u yo'qolib ketardi. */
function isloh_setButtonLoading(btn, isLoading, loadingText) {
  if (!btn) return;

  if (isLoading) {
    if (btn.dataset.loading === '1') return;          // takroriy bosish
    btn.dataset.loading = '1';
    btn.dataset.prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    btn.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'spinner spinner-sm';
    btn.appendChild(spinner);
    if (loadingText) {
      const label = document.createElement('span');
      label.textContent = loadingText;                // matn — textContent, HTML emas
      btn.appendChild(label);
    }
    return;
  }

  if (btn.dataset.loading !== '1') return;
  btn.innerHTML = btn.dataset.prevHtml || '';
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
  delete btn.dataset.loading;
  delete btn.dataset.prevHtml;
}

/* --- 2. Tarmoq xatosi banneri --------------------------------------------
   Bitta banner: ketma-ket kelgan xatolar ustma-ust to'planmaydi. */
const ISLOH_NET_ERROR_DEFAULT = "Serverga ulanib bo'lmadi";

function isloh_hideNetworkError() {
  const el = document.querySelector('.net-error');
  if (el) el.remove();
}

function isloh_showNetworkError(retryCallback, message) {
  isloh_hideNetworkError();

  const box = document.createElement('div');
  box.className = 'net-error anim-slide-up';
  box.setAttribute('role', 'alert');

  const icon = document.createElement('i');
  icon.className = 'bi bi-wifi-off net-error-icon';

  const text = document.createElement('span');
  text.className = 'net-error-text';
  text.textContent = message || ISLOH_NET_ERROR_DEFAULT;

  box.appendChild(icon);
  box.appendChild(text);

  if (typeof retryCallback === 'function') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-sm btn-outline';
    retry.textContent = 'Qayta urinish';
    retry.addEventListener('click', () => {
      isloh_setButtonLoading(retry, true, 'Kuting…');
      Promise.resolve()
        .then(retryCallback)
        .then(() => isloh_hideNetworkError())
        .catch(() => isloh_setButtonLoading(retry, false));
    });
    box.appendChild(retry);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-btn net-error-close';
  close.setAttribute('aria-label', 'Yopish');
  close.innerHTML = '<i class="bi bi-x"></i>';
  close.addEventListener('click', isloh_hideNetworkError);
  box.appendChild(close);

  document.body.appendChild(box);
  return box;
}

/* --- 3. Forma validatsiyasi ----------------------------------------------
   Maydonlar: `required` yoki istalgan `data-*-field` (courseField,
   quizField, assignmentField, userField ...). CSS atribut selektori nom
   bo'yicha wildcard qo'llab-quvvatlamaydi, shuning uchun dataset kaliti
   tekshiriladi. */
function isloh_fieldKey(el) {
  const dataKey = Object.keys(el.dataset).find((k) => /Field$/.test(k));
  return (dataKey && el.dataset[dataKey]) || el.name || el.id || '';
}

function isloh_isFieldEmpty(el) {
  if (el.type === 'checkbox' || el.type === 'radio') return !el.checked;
  return !String(el.value || '').trim();
}

function isloh_formFields(form) {
  return [...form.querySelectorAll('input, select, textarea')].filter((el) => {
    if (el.disabled || el.type === 'hidden') return false;
    return el.hasAttribute('required') || Object.keys(el.dataset).some((k) => /Field$/.test(k));
  });
}

function isloh_clearFormErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; el.hidden = true; });
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}

function isloh_setFieldError(form, field, message) {
  const box = form.querySelector('[data-error-for="' + field + '"]');
  if (box) { box.textContent = message; box.hidden = false; }
  else if (typeof isloh_showToast === 'function') isloh_showToast(message, 'error');
}

/* `{ valid, errors }` qaytaradi — chaqiruvchi serverga yuborishdan oldin
   tekshiradi. Birinchi xato maydoniga fokus beriladi. */
function isloh_validateForm(form) {
  if (!form) return { valid: true, errors: {} };
  isloh_clearFormErrors(form);

  const errors = {};
  let first = null;

  isloh_formFields(form).forEach((el) => {
    // `data-*-field` bo'lgani bilan `required` bo'lmagan maydon majburiy emas
    if (!el.hasAttribute('required') || !isloh_isFieldEmpty(el)) return;

    const key = isloh_fieldKey(el);
    if (!key) return;
    errors[key] = el.dataset.errorMessage || "Bu maydon to'ldirilishi shart";
    el.classList.add('is-invalid');
    if (!first) first = el;
  });

  Object.keys(errors).forEach((key) => isloh_setFieldError(form, key, errors[key]));
  if (first) first.focus();

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

/* --- Eksport -------------------------------------------------------------- */

window.islohUI = {
  setButtonLoading: isloh_setButtonLoading,
  showNetworkError: isloh_showNetworkError,
  hideNetworkError: isloh_hideNetworkError,
  validateForm: isloh_validateForm,
  clearFormErrors: isloh_clearFormErrors,
  setFieldError: isloh_setFieldError,
  // toast.js alohida fayl — bu yerda faqat qayta eksport (guarded)
  toast: (message, type, duration) => {
    if (typeof isloh_showToast === 'function') isloh_showToast(message, type, duration);
  }
};
