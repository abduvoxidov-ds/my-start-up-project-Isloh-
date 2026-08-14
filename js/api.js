/* ==========================================================================
   ISLOH — HTTP qatlami (bazaviy)
   Loyihadagi YAGONA tarmoq chaqiruvi shu yerda. Do'konlar `fetch`ni
   to'g'ridan-to'g'ri chaqirmaydi — token, xato va 401 mantig'i bir joyda
   turishi kerak (CLAUDE.md §2 — DRY).

   file:// ostida `fetch` CORS xatosi beradi (CLAUDE.md §3), shuning uchun
   protokol tekshiriladi va tushunarli xato qaytariladi — brauzerning
   "Failed to fetch" xabari o'rniga.

   Muvaffaqiyat -> parse qilingan `data` (204 bo'lsa null)
   Xato         -> reject({ success:false, error, status, code, fields })
                   `fields` -> [data-error-for="<maydon>"] (js/settings-security.js)
   ========================================================================== */

let ISLOH_API_BASE_URL = window.ISLOH_API_BASE_URL || '/api/v1';
const ISLOH_API_TIMEOUT_MS = 15000;
const ISLOH_TOKEN_KEY = 'isloh_access_token'; // `isloh_` prefiksi — wipe qamrab olsin

function isloh_setApiBaseUrl(url) { ISLOH_API_BASE_URL = url; }
function isloh_getToken() { return localStorage.getItem(ISLOH_TOKEN_KEY) || ''; }
function isloh_setToken(token) { localStorage.setItem(ISLOH_TOKEN_KEY, token); }
function isloh_clearToken() { localStorage.removeItem(ISLOH_TOKEN_KEY); }

/* --- Xato obyekti --------------------------------------------------------- */

function isloh_apiError(message, status, code, fields) {
  return { success: false, error: message, status: status || 0, code: code || 'error', fields: fields || {} };
}

/* --- 401: tokenni o'chirib login'ga ---------------------------------------
   Sahifalar `pages/<papka>/fayl.html` ko'rinishida, ildizda esa index.html —
   shuning uchun yo'l hisoblanadi, qattiq yozilmaydi. */
function isloh_loginPath() {
  return location.pathname.indexOf('/pages/') !== -1 ? '../auth/login.html' : 'pages/auth/login.html';
}

function isloh_handleUnauthorized() {
  isloh_clearToken();
  // Login sahifasining o'zida qayta yo'naltirish — cheksiz sikl
  if (/auth\/login\.html$/.test(location.pathname)) return;
  window.location.href = isloh_loginPath();
}

/* --- Javobni o'qish ------------------------------------------------------- */

async function isloh_parseResponse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw isloh_apiError("Server noto'g'ri javob qaytardi", res.status, 'parse_error');
  }
}

/* --- Asosiy wrapper -------------------------------------------------------
   options: { method, data, params, headers, skipAuthRedirect, signal }
   `data` FormData bo'lsa Content-Type qo'yilmaydi — chegara (boundary) ni
   brauzer o'zi yozadi (avatar/resurs yuklash uchun). */
async function islohFetch(endpoint, options = {}) {
  if (location.protocol === 'file:') {
    return Promise.reject(isloh_apiError('API file:// ostida ishlamaydi — HTTP server orqali oching', 0, 'file_protocol'));
  }

  const url = new URL(ISLOH_API_BASE_URL + endpoint, location.origin);
  Object.entries(options.params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const isForm = options.data instanceof FormData;
  const token = isloh_getToken();
  const headers = Object.assign(
    { Accept: 'application/json' },
    isForm ? {} : { 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {},
    typeof isloh_i18nLang === 'function' ? { 'Accept-Language': isloh_i18nLang() } : {},
    options.headers || {}
  );

  // Tarmoq osilib qolmasin
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ISLOH_API_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: headers,
      credentials: 'include', // refresh token — httpOnly cookie
      signal: options.signal || controller.signal,
      body: options.data === undefined ? undefined : (isForm ? options.data : JSON.stringify(options.data))
    });
  } catch (e) {
    return Promise.reject(e.name === 'AbortError'
      ? isloh_apiError('So\'rov vaqti tugadi', 0, 'timeout')
      : isloh_apiError('Tarmoqqa ulanib bo\'lmadi', 0, 'network_error'));
  } finally {
    clearTimeout(timer);
  }

  const body = await isloh_parseResponse(res);
  if (res.ok) return body;

  /* Login formasidagi 401 — noto'g'ri parol, sessiya tugashi emas:
     u yerda xatoni maydonda ko'rsatish kerak, login'ga otish emas. */
  if (res.status === 401 && !options.skipAuthRedirect) {
    isloh_handleUnauthorized();
  }

  const err = (body && body.error) || {};
  return Promise.reject(isloh_apiError(
    err.message || 'Xatolik yuz berdi',
    res.status,
    err.code || (res.status === 400 || res.status === 422 ? 'validation_error' : 'http_error'),
    err.fields   // 400/422 -> maydon xatolari
  ));
}

/* --- Qulay metodlar -------------------------------------------------------
   GET/DELETE tanasiz, shuning uchun ikkinchi argument — so'rov parametrlari
   (`?page=&status=`). Yozuvchi metodlarda esa — yuboriladigan `data`.

   `islohApi` — do'konlar ishlatadigan yagona kirish nuqtasi. Global obyekt
   ataylab: loyihada ES modul yo'q (CLAUDE.md §1), lekin 5 ta funksiyani
   alohida-alohida global qilish nom maydonini keraksiz to'ldirardi. */
const islohApi = {
  fetch: islohFetch,
  get:    (endpoint, params, options)  => islohFetch(endpoint, Object.assign({ method: 'GET', params: params }, options)),
  post:   (endpoint, data, options)    => islohFetch(endpoint, Object.assign({ method: 'POST', data: data }, options)),
  put:    (endpoint, data, options)    => islohFetch(endpoint, Object.assign({ method: 'PUT', data: data }, options)),
  patch:  (endpoint, data, options)    => islohFetch(endpoint, Object.assign({ method: 'PATCH', data: data }, options)),
  delete: (endpoint, options)          => islohFetch(endpoint, Object.assign({ method: 'DELETE' }, options)),

  // Token boshqaruvi shu yerdan — js/auth.js localStorage kalitini bilmasin
  setToken: isloh_setToken,
  clearToken: isloh_clearToken,
  getToken: isloh_getToken,
  setBaseUrl: isloh_setApiBaseUrl
};

window.islohApi = islohApi;
