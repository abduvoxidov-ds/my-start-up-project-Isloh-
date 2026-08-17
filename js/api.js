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
      /* API javoblari brauzer keshiga tushmasin: aks holda sahifa eskirgan
         ma'lumotni ko'rsatib turaveradi va eng yomoni "Qayta urinish"
         serverga bormay, o'sha keshdan o'qib "tuzaldi" deb ko'rsatadi. */
      cache: 'no-store',
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

/* --- Universal Sync-over-Async do'kon fabrikasi ---------------------------
   js/course-store.js va js/enrollment-store.js da bir xil ~70 qator kod
   takrorlangan edi (kesh, yuklash, qayta urinish, optimistik yozish,
   rollback). Yana 21 ta do'kon oldinda — shuning uchun naqsh shu yerga
   ko'chirildi (CLAUDE.md §2).

   NEGA AYNAN api.js: loyihada ES modul yo'q, skript tartibi muhim. api.js
   62+ sahifada BIRINCHI yuklanadi, ya'ni fabrika har qanday do'kon
   faylidan oldin tayyor — alohida fayl bo'lsa yana 62 ta teg kerak bo'lardi.

   config:
     key       — localStorage kaliti (offline nusxa)
     endpoint  — '/courses' kabi
     event     — 'isloh:courses-updated'
     normalize — SERVERDAN kelgan yozuvni frontend sxemasiga keltiradi
     serialize — SERVERGA ketayotgan yozuvni API sxemasiga o'giradi
                 (ixtiyoriy; berilmasa yozuv o'zgarishsiz yuboriladi).
                 Ikkalasi juft: API o'z toza shaklida (snake_case,
                 `price_cents`) qoladi, frontend esa o'z ichki shaklida —
                 va bu ikkisi FAQAT shu ikki funksiyada uchrashadi.
     seed      — demo ma'lumot: massiv YOKI massiv qaytaruvchi funksiya
                 (sanalari bugunga nisbatan ekiladigan do'konlar uchun)

   Qaytaradi: { get, load, retry, persist, remove, fallback } */
function isloh_createStoreCache(config) {
  const normalize = config.normalize || ((x) => x);
  const serialize = config.serialize || ((x) => x);

  let _cache = [];
  let _isLoaded = false;
  let _loadPromise = null;
  let _loadFailed = false;

  /* Offline nusxa; yo'q bo'lsa demo. Bu yerda localStorage'ga YOZILMAYDI:
     seed o'qishda yozilsa bo'sh holat hech qachon ko'rinmasdi va backend
     ulanganda demo yozuvlar serverga ketib qolardi. */
  function fallback() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(config.key)); } catch (e) { stored = null; }
    if (Array.isArray(stored)) return stored.map(normalize);
    const seed = typeof config.seed === 'function' ? config.seed() : (config.seed || []);
    return seed.map(normalize);
  }

  function cacheLocally() {
    try { localStorage.setItem(config.key, JSON.stringify(_cache)); } catch (e) { /* kvota */ }
  }

  /* DIQQAT — `document`, `window` emas: loyihadagi barcha obunachilar
     `document.addEventListener('isloh:...')` yozadi. `window`ga yuborilsa
     hodisa hech kimga bormasdi va sahifalar jimgina eskirgan ma'lumot
     bilan qolib ketardi. `detail` ham saqlanadi — mavjud shartnoma. */
  function emit() {
    if (!config.event) return;
    document.dispatchEvent(new CustomEvent(config.event, { detail: _cache }));
  }

  async function load() {
    if (_loadPromise) return _loadPromise;

    _loadPromise = islohApi.get(config.endpoint)
      .then((data) => {
        _cache = (data || []).map(normalize);
        _loadFailed = false;
        cacheLocally();
      })
      .catch((err) => {
        _cache = fallback();
        _loadFailed = true;
        /* file:// da API umuman yo'q (CLAUDE.md §3) — kutilgan holat,
           banner shovqin bo'lardi. */
        if (err && err.code !== 'file_protocol' && typeof islohUI !== 'undefined') {
          islohUI.showNetworkError(retry, err.error);
        }
      })
      .then(() => { _isLoaded = true; emit(); return _cache; });

    return _loadPromise;
  }

  /* Ikki nozik joy:
     1) settled promise tozalanmasa yangi so'rov umuman ketmasdi;
     2) load() xatoni o'zi yutadi va hech qachon reject qilmaydi, shuning
        uchun banner "tuzaldi" deb yopilib ketardi — nosozlik shu yerda
        qayta otiladi va banner joyida qoladi. */
  function retry() {
    _loadPromise = null;
    _isLoaded = false;
    return load().then(() => {
      if (_loadFailed) throw new Error(config.endpoint + ' reload failed');
    });
  }

  /* SINXRON — sahifalar shuni chaqiradi. Kesh bo'sh bo'lsa zaxira
     qaytariladi va yuklash fonda boshlanadi. */
  function get() {
    if (!_isLoaded) {
      if (!_cache.length) _cache = fallback();
      load();
    }
    return _cache;
  }

  /* --- Yozuv navbati -------------------------------------------------------
     Yozish so'rovlari BIRIN-KETIN yuboriladi, parallel emas.

     NEGA (o'lchangan): sahifa bir amalda bir nechta yozuvni o'zgartirishi
     mumkin — masalan vazifalar ro'yxatiga uchta band qo'shilsa, do'kon
     uchta alohida so'rov yuboradi. Ular parallel ketganda ikki muammo
     chiqdi:

       1) SQLite'da bitta yozuvchi bo'ladi — biri `database is locked`
          bilan 500 oldi va yozuv jimgina yo'qoldi;
       2) tartib kafolatlanmadi — "hammasini o'chir, keyin yangisini
          qo'sh" amalida DELETE va POST aralashib ketdi.

     Navbat ikkalasini ham hal qiladi va u bazadan MUSTAQIL: PostgreSQL'ga
     o'tilganda ham amallar tartibi saqlanishi kerak.

     Optimistik yangilanish navbatda TURMAYDI — u sinxron bajariladi,
     shuning uchun interfeys darhol javob beradi. */
  let _writeQueue = Promise.resolve();

  function enqueue(task) {
    const run = _writeQueue.then(task, task);
    // Navbat xato tufayli uzilib qolmasin
    _writeQueue = run.then(() => {}, () => {});
    return run;
  }

  /* Optimistik qo'shish/yangilash. `isNew` keshdagi id bo'yicha
     ANIQLANADI, tashqaridan berilmaydi: ikki manba bir-biriga zid
     bo'lsa (masalan "yangi" deyilgan yozuv keshda turgan bo'lsa)
     ro'yxatda ikki nusxa paydo bo'lardi. */
  function persist(item) {
    const index = _cache.findIndex((c) => c.id === item.id);
    const isNew = index === -1;
    const previous = isNew ? null : _cache[index];

    if (isNew) _cache.push(item); else _cache[index] = item;
    cacheLocally();
    emit();

    const body = serialize(item);
    const request = enqueue(() => (isNew
      ? islohApi.post(config.endpoint, body)
      : islohApi.put(config.endpoint + '/' + item.id, body)));

    return request
      .then((saved) => {
        // Server o'z id'sini beradi — vaqtinchalik id almashadi
        const at = _cache.findIndex((c) => c.id === item.id);
        if (at !== -1 && saved) _cache[at] = normalize(saved);
        cacheLocally();
        emit();
        return (at !== -1 ? _cache[at] : item);
      })
      .catch((err) => {
        const at = _cache.findIndex((c) => c.id === item.id);
        if (at !== -1) { if (isNew) _cache.splice(at, 1); else _cache[at] = previous; }
        cacheLocally();
        emit();
        if (typeof islohUI !== 'undefined') islohUI.toast(err.error || "Saqlab bo'lmadi", 'error');
        throw err;
      });
  }

  /* Optimistik o'chirish: qator darhol ketadi, server rad etsa
     O'SHA O'RNIGA qaytariladi (tartib buzilmasin). */
  function remove(id) {
    const index = _cache.findIndex((c) => c.id === id);
    if (index === -1) return false;

    const removed = _cache.splice(index, 1)[0];
    cacheLocally();
    emit();

    enqueue(() => islohApi.delete(config.endpoint + '/' + id)).catch((err) => {
      _cache.splice(index, 0, removed);
      cacheLocally();
      emit();
      if (typeof islohUI !== 'undefined') islohUI.toast(err.error || "O'chirib bo'lmadi", 'error');
    });
    return true;
  }

  return { get: get, load: load, retry: retry, persist: persist, remove: remove, fallback: fallback };
}

window.isloh_createStoreCache = isloh_createStoreCache;
