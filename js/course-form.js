/* ==========================================================================
   ISLOH — Kurs formasi (yaratish + tahrirlash)
   pages/instructor/course-create.html va course-edit.html sehrgarini
   js/course-store.js dagi `isloh_courses` do'koniga ulaydi.

   NEGA: ilgari ikkala sahifa ham faqat ko'rinish edi. Maydonlar `c-title` /
   `e-title` kabi turli ID'lar bilan yozilgan, hech qayerda o'qilmagan, va
   "Yakunlash" tugmasi shunchaki "saqlandi" deb toast chiqarardi. Endi
   ikkala sahifa BIR XIL deklarativ shartnomadan foydalanadi, ya'ni mantiq
   sahifaga emas, maydon nomiga bog'langan (CLAUDE.md §2).

   Markup shartnomasi:
     [data-course-form]                → sehrgar o'ramini belgilaydi
     [data-course-field="<nom>"]       → input / textarea / select
     [data-course-field="price"]       → narx (USD)
     [data-course-radio="visibility"]  → radio guruhi (value = saqlanadigan qiymat)
     [data-course-radio="pricing"]     → "free" | "paid"
     [data-course-check="certificate"] → switch
     [data-course-tags]                → teglar konteyneri
       [data-course-tag-input]         → yangi teg kiritish maydoni
     [data-review="<nom>"]             → ko'rib chiqish bosqichidagi qiymat
     [data-course-title-out]           → sahifa sarlavhasi (tahrirlashda)
     [data-course-meta-out]            → "Qoralama · Yangilangan: ..." qatori
     [data-course-link="<sahifa>"]     → havolaga joriy ?id= qo'shiladi

   Tahrirlash rejimi URL orqali: course-edit.html?id=<kurs-id>.
   ========================================================================== */

/* Matn maydonlari — do'kondagi nom bilan bir xil atalади. */
const ISLOH_COURSE_TEXT_FIELDS = [
  'title', 'subtitle', 'description', 'category', 'level', 'language',
  'duration', 'estimate', 'prerequisites', 'metaTitle', 'metaDescription', 'slug'
];

function isloh_courseFormEl(name) {
  return document.querySelector(`[data-course-field="${name}"]`);
}

function isloh_courseFormIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

/* --- Teglar --------------------------------------------------------------- */

function isloh_courseTagsHtml(tags) {
  return tags.map((tag) => `<span class="tag-pill">${tag}
      <button type="button" data-course-tag-remove="${tag}" aria-label="${tag} tegini o'chirish"><i class="bi bi-x"></i></button>
    </span>`).join('');
}

function isloh_renderCourseTags(tags) {
  const box = document.querySelector('[data-course-tags]');
  const input = document.querySelector('[data-course-tag-input]');
  if (!box || !input) return;

  // Kiritish maydoni har doim oxirida qoladi
  box.querySelectorAll('.tag-pill').forEach((el) => el.remove());
  input.insertAdjacentHTML('beforebegin', isloh_courseTagsHtml(tags));
}

function isloh_readCourseTags() {
  return [...document.querySelectorAll('[data-course-tag-remove]')]
    .map((btn) => btn.dataset.courseTagRemove);
}

function isloh_initCourseTags() {
  const box = document.querySelector('[data-course-tags]');
  const input = document.querySelector('[data-course-tag-input]');
  if (!box || !input) return;

  /* Teglar `input`/`change` hodisasini bermaydi, shuning uchun ko'rib
     chiqish bosqichi qo'lda yangilanadi. */
  box.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-course-tag-remove]');
    if (!remove) return;
    remove.closest('.tag-pill').remove();
    isloh_renderCourseReview();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = input.value.trim();
    if (!value || isloh_readCourseTags().indexOf(value) !== -1) { input.value = ''; return; }
    isloh_renderCourseTags(isloh_readCourseTags().concat(value));
    input.value = '';
    isloh_renderCourseReview();
  });
}

/* --- Formani to'ldirish / o'qish ------------------------------------------ */

function isloh_fillCourseForm(course) {
  ISLOH_COURSE_TEXT_FIELDS.forEach((name) => {
    const el = isloh_courseFormEl(name);
    if (el) el.value = course[name] || '';
  });

  const price = isloh_courseFormEl('price');
  if (price) price.value = course.price ? course.price.toFixed(2) : '0.00';

  document.querySelectorAll('[data-course-radio="visibility"]').forEach((radio) => {
    radio.checked = radio.value === course.visibility;
  });
  document.querySelectorAll('[data-course-radio="pricing"]').forEach((radio) => {
    radio.checked = radio.value === (course.free ? 'free' : 'paid');
  });

  const cert = document.querySelector('[data-course-check="certificate"]');
  if (cert) cert.checked = !!course.certificate;

  isloh_renderCourseTags(course.tags);

  const titleOut = document.querySelector('[data-course-title-out]');
  if (titleOut) titleOut.textContent = course.title;

  const metaOut = document.querySelector('[data-course-meta-out]');
  if (metaOut) {
    const status = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
    metaOut.textContent = [
      status.label,
      'Yangilangan: ' + isloh_relativeDate(course.updatedAt),
      course.completion + '% tayyor'
    ].join(' · ');
  }

  isloh_applyCourseLinks(course.id);
}

/* Faqat sahifada MAVJUD maydonlar qaytadi. Bu muhim: kurs sozlamalari
   sahifasida sehrgardagi maydonlarning bir qismi yo'q, va yo'q maydon
   uchun standart qiymat qaytarilsa saqlashda teglar yoki sertifikat
   sozlamasi jimgina o'chib ketardi. */
function isloh_readCourseForm() {
  const data = {};
  ISLOH_COURSE_TEXT_FIELDS.forEach((name) => {
    const el = isloh_courseFormEl(name);
    if (el) data[name] = el.value.trim();
  });

  const visibility = document.querySelector('[data-course-radio="visibility"]:checked');
  if (visibility) data.visibility = visibility.value;

  const pricing = document.querySelector('[data-course-radio="pricing"]:checked');
  const price = isloh_courseFormEl('price');
  if (pricing) data.free = pricing.value === 'free';
  if (price) data.price = data.free ? 0 : Math.max(0, parseFloat(price.value) || 0);

  const cert = document.querySelector('[data-course-check="certificate"]');
  if (cert) data.certificate = cert.checked;

  if (document.querySelector('[data-course-tags]')) data.tags = isloh_readCourseTags();
  if (data.title && !data.slug && isloh_courseFormEl('slug')) data.slug = isloh_slugify(data.title);
  return data;
}

/* --- Ko'rib chiqish bosqichi ---------------------------------------------- */

/* Ilgari bu blokda "Python Backend Development" kabi qattiq yozilgan
   qiymatlar turardi — foydalanuvchi nima kiritganidan qat'i nazar. */
function isloh_renderCourseReview() {
  const data = isloh_readCourseForm();
  const values = {
    title: data.title || '—',
    categoryLevel: [data.category, data.level].filter(Boolean).join(' · '),
    language: data.language || '—',
    price: data.free ? 'Bepul' : '$' + data.price.toFixed(2),
    duration: [data.duration, data.estimate].filter(Boolean).join(' · ') || '—',
    certificate: data.certificate ? 'Ha' : "Yo'q",
    slug: data.slug || '—',
    tags: data.tags.length ? data.tags.join(', ') : '—'
  };

  Object.keys(values).forEach((key) => {
    document.querySelectorAll(`[data-review="${key}"]`).forEach((el) => {
      el.textContent = values[key];
    });
  });
}

/* --- Saqlash -------------------------------------------------------------- */

function isloh_courseFormToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_submitCourseForm(editingId) {
  const data = isloh_readCourseForm();

  if (!data.title) {
    isloh_courseFormToast("Kurs nomi bo'sh bo'lishi mumkin emas", 'error');
    return;
  }
  if (editingId) data.id = editingId;

  const saved = isloh_saveCourse(data);
  if (!saved) {
    isloh_courseFormToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    return;
  }

  isloh_courseFormToast(editingId ? "O'zgarishlar saqlandi" : `"${saved.title}" qoralama sifatida saqlandi`);
  // Toast ko'rinib ulgursin, so'ng ro'yxatga qaytamiz
  setTimeout(() => { window.location.href = 'courses.html'; }, 900);
}

function isloh_initCourseForm() {
  const form = document.querySelector('[data-course-form]');
  if (!form) return;

  /* Ikki marta ulanib qolmasin: aks holda har bir "Yakunlash" ikki marta
     saqlaydi va tahrirlash o'rniga yangi kurs yaratilib ketishi mumkin. */
  if (form.dataset.courseFormReady) return;
  form.dataset.courseFormReady = '1';

  const editingId = isloh_courseFormIdFromUrl();
  if (editingId) {
    const course = isloh_getCourse(editingId);
    if (course) isloh_fillCourseForm(course);
    else isloh_courseFormToast('Bunday kurs topilmadi', 'error');
  }

  isloh_initCourseTags();

  /* Sarlavhadan slug avtomat to'ldiriladi — foydalanuvchi o'zi yozguncha. */
  const title = isloh_courseFormEl('title');
  const slug = isloh_courseFormEl('slug');
  if (title && slug) {
    let slugTouched = !!slug.value;
    slug.addEventListener('input', () => { slugTouched = true; });
    title.addEventListener('input', () => {
      if (!slugTouched) slug.value = isloh_slugify(title.value);
    });
  }

  // Ko'rib chiqish bosqichi har qanday o'zgarishdan keyin yangilanadi
  form.addEventListener('input', isloh_renderCourseReview);
  form.addEventListener('change', isloh_renderCourseReview);
  isloh_renderCourseReview();

  form.addEventListener('isloh:wizard-complete', () => isloh_submitCourseForm(editingId));
}

document.addEventListener('DOMContentLoaded', isloh_initCourseForm);
