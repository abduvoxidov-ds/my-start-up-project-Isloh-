/* ==========================================================================
   ISLOH — Fayl yuklash yordamchisi  (M5)

   Loyihada fayl uch joyda yuklanadi: profil rasmi (profile.html), kurs
   resursi (resource-manager.html) va topshiriq fayli. Uchalasi ham
   BIR XIL uch qadamdan iborat, shuning uchun mantiq shu yerda
   (CLAUDE.md §2 — DRY):

     1. POST /uploads/presign       -> yozuv + imzolangan `upload_url`
     2. PUT  <upload_url>           -> baytlar SAQLASHGA ketadi
     3. POST /uploads/{id}/complete -> server hajmni tekshiradi va yakunlaydi

   NEGA 2-QADAM `islohApi` ORQALI EMAS: `upload_url` — API manzili emas.
   Hozir u o'z serverimizga ishora qiladi, S3 ga o'tilganda esa AWS ga
   ketadi. Unga `Authorization` sarlavhasi YUBORILMASLIGI kerak: imzolangan
   URL ning o'zi vaqtinchalik kalit va S3 kutilmagan sarlavhani ko'rib
   imzoni rad etadi.

   XMLHttpRequest ISHLATILADI, `fetch` emas — yuklash jarayonini (progress)
   `fetch` bermaydi, 40 MB lik video esa jimgina turgan tugma bilan
   yuklanmasligi kerak.

   file:// ostida ishlamaydi (CLAUDE.md §3) — `islohApi` allaqachon
   tushunarli xato qaytaradi, shu xato shundayligicha o'tkaziladi.
   ========================================================================== */

const ISLOH_UPLOAD_PURPOSES = {
  avatar: 'avatar',
  resource: 'resource',
  lessonVideo: 'lesson_video',
  submission: 'submission'
};

/* Serverdagi chegaralar bilan bir xil (apps/resources/rules.py). Bu yerdagi
   nusxa faqat QULAYLIK uchun: foydalanuvchi 2 GB lik faylni yuklab
   bo'lgandan keyin emas, tanlagan zahoti xato ko'rsin. Haqiqiy tekshiruv
   baribir serverda — u yerda ikki marta. */
const ISLOH_UPLOAD_LIMITS = {
  avatar: 4 * 1024 * 1024,
  resource: 200 * 1024 * 1024,
  lesson_video: 2048 * 1024 * 1024,
  submission: 25 * 1024 * 1024
};

/* --- 2-qadam: xom baytlar ------------------------------------------------- */

function isloh_putFileBytes(target, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method || 'PUT', target.upload_url, true);

    /* Server bergan sarlavhalar (S3 da imzo qismlari) shundayligicha
       qo'yiladi — mijoz o'zidan hech narsa qo'shmaydi. */
    Object.entries(target.headers || {}).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (typeof onProgress === 'function' && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      reject(isloh_uploadErrorFrom(xhr));
    });
    xhr.addEventListener('error', () => reject({
      success: false, error: "Tarmoqqa ulanib bo'lmadi", status: 0, code: 'network_error', fields: {}
    }));
    xhr.addEventListener('abort', () => reject({
      success: false, error: 'Yuklash bekor qilindi', status: 0, code: 'aborted', fields: {}
    }));

    xhr.send(file);
  });
}

/* Serverning §0.2 shaklidagi xatosini `islohApi` xatosiga keltiradi —
   chaqiruvchi joylar ikki xil xato obyektini bilmasin. */
function isloh_uploadErrorFrom(xhr) {
  let body = null;
  try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
  const err = (body && body.error) || {};
  return {
    success: false,
    error: err.message || "Faylni yuklab bo'lmadi",
    status: xhr.status,
    code: err.code || 'http_error',
    fields: err.fields || {}
  };
}

/* --- To'liq oqim ---------------------------------------------------------- */

/* isloh_uploadFile(file, { purpose, assignment, onProgress })
   -> Promise<{ id, name, size_bytes, size_kb, download_url, ... }>

   Qaytgan obyekt — `File` yozuvi. Uni keyin egasiga bog'lash CHAQIRUVCHI
   zimmasida: resurs uchun `/instructor/resources`, avatar uchun
   `/users/me/avatar`, topshiriq uchun `files: [{ file: id }]`. Shu bo'linish
   sababli bitta yordamchi uchala joyga ham yetadi. */
function isloh_uploadFile(file, options) {
  const opts = options || {};
  const purpose = opts.purpose || ISLOH_UPLOAD_PURPOSES.resource;

  if (!file) {
    return Promise.reject({ success: false, error: 'Fayl tanlanmadi', code: 'validation_error', fields: {} });
  }

  const limit = ISLOH_UPLOAD_LIMITS[purpose];
  if (limit && file.size > limit) {
    return Promise.reject({
      success: false,
      error: `Fayl hajmi ${Math.round(limit / 1024 / 1024)} MB dan oshmasligi kerak`,
      code: 'validation_error',
      fields: {}
    });
  }

  const body = {
    purpose: purpose,
    name: file.name,
    content_type: file.type || '',
    size_bytes: file.size
  };
  if (opts.assignment) body.assignment = opts.assignment;

  return islohApi.post('/uploads/presign', body)
    .then((target) => isloh_putFileBytes(target, file, opts.onProgress)
      .then(() => islohApi.post('/uploads/' + target.file.id + '/complete')));
}

window.isloh_uploadFile = isloh_uploadFile;
window.ISLOH_UPLOAD_PURPOSES = ISLOH_UPLOAD_PURPOSES;
