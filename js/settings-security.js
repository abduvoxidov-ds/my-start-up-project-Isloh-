/* ==========================================================================
   ISLOH — Sozlamalar / Xavfsizlik paneli  (Sprint 6C)
   pages/student/settings.html dagi "Xavfsizlik" bo'limi: parolni o'zgartirish
   formasi va faol seanslarni yakunlash.

   MUHIM — parol haqida:
   Bu yerda parol HECH QAYERGA saqlanmaydi. localStorage'ga ochiq matnda
   parol yozish xavfli amaliyot, va loyihada hali real autentifikatsiya yo'q
   (CLAUDE.md 4-bosqich). Shu sababli "Joriy parol" ning TO'G'RILIGINI
   tekshirib bo'lmaydi — faqat formatga oid tekshiruvlar bajariladi
   (bo'shligi, uzunligi, yangi parol bilan mos kelishi). Haqiqiy tekshiruv
   backend ulangach serverda bo'lishi kerak.

   Seanslar esa saqlanadi: yakunlangan seans id'lari
   `isloh_revoked_sessions` ro'yxatiga yoziladi, shuning uchun qator sahifa
   yangilangandan keyin ham qaytib kelmaydi.

   js/settings.js (panel almashish) va js/settings-store.js (sozlamalar
   do'koni) bu faylga bog'liq emas va o'zgartirilmagan.

   Markup shartnomasi:
     <form data-password-form>
       <input data-password-field="current|new|confirm">
       <div class="field-error" data-error-for="<maydon>" hidden>
     .device-row[data-session-id]
       button[data-session-revoke]
     [data-sessions-empty]   -> barcha seans yakunlanganda ko'rsatiladi
   ========================================================================== */

const ISLOH_REVOKED_SESSIONS_KEY = 'isloh_revoked_sessions';
const ISLOH_PASSWORD_MIN_LENGTH = 6;

function isloh_securityToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* --- 1) Parolni o'zgartirish formasi -------------------------------------- */

/* Bitta maydon uchun xato matnini ko'rsatadi/yashiradi */
function isloh_setFieldError(form, name, message) {
  const input = form.querySelector('[data-password-field="' + name + '"]');
  const errorEl = form.querySelector('[data-error-for="' + name + '"]');
  if (!input || !errorEl) return;

  if (message) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    errorEl.innerHTML = '<i class="bi bi-exclamation-circle"></i>' + message;
    errorEl.hidden = false;
  } else {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}

function isloh_clearPasswordErrors(form) {
  ['current', 'new', 'confirm'].forEach((name) => isloh_setFieldError(form, name, ''));
}

/* Tekshiruvlar. Xatolar {maydon: xabar} ko'rinishida qaytadi — bo'sh obyekt
   forma to'g'ri to'ldirilganini bildiradi. */
function isloh_validatePasswordForm(values) {
  const errors = {};

  if (!values.current) {
    errors.current = 'Joriy parolni kiriting';
  }

  if (!values.new) {
    errors.new = 'Yangi parolni kiriting';
  } else if (values.new.length < ISLOH_PASSWORD_MIN_LENGTH) {
    errors.new = 'Parol kamida ' + ISLOH_PASSWORD_MIN_LENGTH + ' belgidan iborat bo\'lishi kerak';
  } else if (values.current && values.new === values.current) {
    errors.new = 'Yangi parol joriy paroldan farq qilishi kerak';
  }

  if (!values.confirm) {
    errors.confirm = 'Yangi parolni takrorlang';
  } else if (values.new && values.confirm !== values.new) {
    errors.confirm = 'Parollar mos kelmadi';
  }

  return errors;
}

function isloh_initPasswordForm() {
  const form = document.querySelector('[data-password-form]');
  if (!form) return;

  const inputs = form.querySelectorAll('[data-password-field]');

  // Foydalanuvchi tuzata boshlaganda xato darhol yo'qoladi
  inputs.forEach((input) => {
    input.addEventListener('input', () => isloh_setFieldError(form, input.dataset.passwordField, ''));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault(); // file:// ostida sahifa qayta yuklanmasin

    const values = {};
    inputs.forEach((input) => { values[input.dataset.passwordField] = input.value; });

    isloh_clearPasswordErrors(form);
    const errors = isloh_validatePasswordForm(values);
    const failed = Object.keys(errors);

    if (failed.length) {
      failed.forEach((name) => isloh_setFieldError(form, name, errors[name]));
      const firstInvalid = form.querySelector('[data-password-field="' + failed[0] + '"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Muvaffaqiyat: parol saqlanmaydi (yuqoridagi izohga qarang), faqat
    // maydonlar tozalanadi — ekranda parol qolib ketmasin
    inputs.forEach((input) => { input.value = ''; });
    isloh_securityToast("Parol muvaffaqiyatli o'zgartirildi");
  });
}

/* --- 2) Faol seanslar ----------------------------------------------------- */

function isloh_getRevokedSessions() {
  let list = null;
  try { list = JSON.parse(localStorage.getItem(ISLOH_REVOKED_SESSIONS_KEY)); } catch (e) { list = null; }
  return Array.isArray(list) ? list : [];
}

function isloh_saveRevokedSessions(list) {
  try {
    localStorage.setItem(ISLOH_REVOKED_SESSIONS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/* Yakunlanadigan seanslar qolmaganda bo'sh holat xabarini ko'rsatadi */
function isloh_refreshSessionsEmptyState() {
  const empty = document.querySelector('[data-sessions-empty]');
  if (!empty) return;
  const remaining = document.querySelectorAll('.device-row[data-session-id] [data-session-revoke]').length;
  empty.hidden = remaining > 0;
}

function isloh_initSessionRevoke() {
  const rows = document.querySelectorAll('.device-row[data-session-id]');
  if (!rows.length) return;

  const revoked = isloh_getRevokedSessions();

  rows.forEach((row) => {
    // Avval yakunlangan seans — sahifa ochilishida animatsiyasiz olib tashlanadi
    if (revoked.indexOf(row.dataset.sessionId) !== -1) {
      row.remove();
      return;
    }

    const btn = row.querySelector('[data-session-revoke]');
    if (!btn) return; // joriy seans: uni bu yerdan yakunlab bo'lmaydi

    btn.addEventListener('click', () => {
      const id = row.dataset.sessionId;
      const list = isloh_getRevokedSessions();
      if (list.indexOf(id) === -1) list.push(id);

      if (!isloh_saveRevokedSessions(list)) {
        isloh_securityToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }

      row.classList.add('anim-row-out');
      row.addEventListener('animationend', () => {
        row.remove();
        isloh_refreshSessionsEmptyState();
      }, { once: true });

      isloh_securityToast('Seans yakunlandi');
    });
  });

  isloh_refreshSessionsEmptyState();
}

function isloh_initSettingsSecurity() {
  isloh_initPasswordForm();
  isloh_initSessionRevoke();
}

document.addEventListener('DOMContentLoaded', isloh_initSettingsSecurity);
