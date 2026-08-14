/* ==========================================================================
   ISLOH — Auth guard va auth formalari
   Ikki vazifa:
     1) Himoyalangan papkada token yo'q bo'lsa — login'ga otish
     2) login/register formalarini islohApi ga ulash

   js/api.js dan KEYIN ulanadi. Guard `defer`ni kutmaydi — sahifa chizilib
   bo'lgach otish "ko'rinib-yo'qoladigan" sahifa berardi, shuning uchun
   tekshiruv fayl o'qilishi bilan darhol bajariladi.

   Markup shartnomasi:
     [data-error-for="<maydon>"]  → xato matni shu yerga (js/settings-security.js
                                    bilan bir xil); yo'q bo'lsa toast
   ========================================================================== */

const ISLOH_PROTECTED_FOLDERS = ['/student/', '/instructor/', '/admin/'];
const ISLOH_ROLE_HOME = {
  student:    '../student/dashboard.html',
  instructor: '../instructor/dashboard.html',
  admin:      '../admin/admin-dashboard.html'
};

function isloh_isAuthPage() {
  return location.pathname.indexOf('/auth/') !== -1;
}

function isloh_isProtectedPage() {
  return ISLOH_PROTECTED_FOLDERS.some((f) => location.pathname.indexOf(f) !== -1);
}

/* --- 1. Guard -------------------------------------------------------------
   file:// ostida API yo'q (CLAUDE.md §3) — u yerda otish butun demoni
   yopib qo'yardi, shuning uchun guard faqat http(s) da ishlaydi. */
function isloh_runAuthGuard() {
  if (location.protocol === 'file:') return;
  if (!isloh_isProtectedPage()) return;
  if (islohApi.getToken()) return;
  window.location.replace('../auth/login.html');
}

isloh_runAuthGuard();

/* --- 2. Xato ko'rsatish --------------------------------------------------- */

/* Tozalash va maydon xatosi — islohUI dan (js/ui-feedback.js). Bu yerda
   o'z nusxasi bor edi, endi yagona joyda (CLAUDE.md §2). */
function isloh_showFieldError(form, field, message) {
  islohUI.setFieldError(form, field, message);
}

/* Server javobidagi `fields` — maydonlarga, `error` — umumiy qatorga */
function isloh_showAuthError(form, err) {
  const fields = (err && err.fields) || {};
  const keys = Object.keys(fields);
  keys.forEach((name) => isloh_showFieldError(form, name, fields[name]));
  if (!keys.length) isloh_showFieldError(form, 'form', (err && err.error) || 'Xatolik yuz berdi');
}

/* --- 3. Formani yuborish -------------------------------------------------- */

function isloh_authValue(form, id) {
  const el = form.querySelector('#' + id);
  return el ? el.value.trim() : '';
}

function isloh_authChecked(form, id) {
  const el = form.querySelector('#' + id);
  return !!(el && el.checked);
}

/* Sahifadan kelib chiqib qaysi so'rov ekanini aniqlaydi */
function isloh_authPayload(form) {
  const path = location.pathname;

  if (path.indexOf('login.html') !== -1) {
    return {
      endpoint: '/auth/login',
      body: {
        email: isloh_authValue(form, 'email'),
        password: isloh_authValue(form, 'pass'),
        remember: !!form.querySelector('input[type="checkbox"]:checked')
      }
    };
  }

  if (path.indexOf('forgot-password') !== -1) {
    return {
      endpoint: '/auth/forgot-password',
      body: {
        email: isloh_authValue(form, 'email')
      }
    };
  }

  if (path.indexOf('reset-password') !== -1) {
    return {
      endpoint: '/auth/reset-password',
      body: {
        password: isloh_authValue(form, 'pass'),
        password_confirm: isloh_authValue(form, 'pass_confirm')
      }
    };
  }

  const role = path.indexOf('register-instructor') !== -1 ? 'instructor' : 'student';
  const body = {
    full_name: isloh_authValue(form, 'fname'),
    email: isloh_authValue(form, 'email2'),
    password: isloh_authValue(form, 'pass2'),
    role: role
  };
  if (role === 'instructor') body.organization = isloh_authValue(form, 'org');
  return { endpoint: '/auth/register', body: body, confirm: isloh_authValue(form, 'pass3'), agree: isloh_authChecked(form, 'agree') };
}

/* Bo'sh maydonlarni endi islohUI.validateForm tekshiradi (`required` +
   `data-auth-field`). Bu yerda faqat SEMANTIK qoidalar qoladi — bittasi
   ham "bo'shmi?" degan savol emas. */
function isloh_authLocalError(form, req) {
  if (req.endpoint === '/auth/reset-password' && req.body.password !== req.body.password_confirm) {
    return ['password_confirm', 'Parollar mos kelmadi'];
  }
  if (req.endpoint === '/auth/register' && req.body.password !== req.confirm) {
    return ['password_confirm', 'Parollar mos kelmadi'];
  }
  return null;
}

function isloh_initAuthForm() {
  const form = document.querySelector('.auth-form-inner form');
  if (!form) return;

  /* Inline `onsubmit` tokensiz ham dashboard'ga otib yuborardi —
     addEventListener uni to'xtatmaydi, atribut olib tashlanadi. */
  form.removeAttribute('onsubmit');

  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Bo'sh majburiy maydonlar — serverga bormasdan. validateForm o'zi
       eski xatolarni tozalaydi, `.is-invalid` qo'yadi va birinchi bo'sh
       maydonga fokus beradi. */
    if (!islohUI.validateForm(form).valid) return;

    const req = isloh_authPayload(form);
    const local = isloh_authLocalError(form, req);
    if (local) { isloh_showFieldError(form, local[0], local[1]); return; }

    islohUI.setButtonLoading(submitBtn, true, 'Kuting…');
    try {
      // 401 = noto'g'ri parol, sessiya tugashi emas — login'ga otilmasin
      const res = await islohApi.post(req.endpoint, req.body, { skipAuthRedirect: true });
      islohApi.setToken(res.access_token);
      const role = (res.user && res.user.role) || req.body.role || 'student';
      window.location.href = ISLOH_ROLE_HOME[role] || ISLOH_ROLE_HOME.student;
    } catch (err) {
      isloh_showAuthError(form, err);
    } finally {
      islohUI.setButtonLoading(submitBtn, false);
    }
  });
}

if (isloh_isAuthPage()) document.addEventListener('DOMContentLoaded', isloh_initAuthForm);
