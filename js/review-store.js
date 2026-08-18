/* ==========================================================================
   ISLOH — Sharhlar do'koni

   NEGA BU FAYL BOR: sharhlar ro'yxati reviews.html ichiga qo'lda yozilgan
   5 ta kartochkadan iborat edi. Javob saqlanardi, lekin sharhning o'zi
   hech qayerda yo'q edi: yuqoridagi "4.8 / 128 ta sharh / 6 javobsiz"
   raqamlari ham, reyting taqsimoti chiziqlari ham ro'yxat bilan bog'liq
   emas edi (jadvalda 5 ta sharh turib, kartochka 128 derdi). Kurs
   tafsilotlari sahifasidagi "So'nggi sharhlar" bloki esa shu sababli
   umuman bo'sh — `.placeholder-note` bilan — qolgan edi.

   M6 (backend): manba endi `/instructor/reviews`, `isloh_reviews` esa
   OFFLINE NUSXA. Do'kon umumiy fabrikaga (`isloh_createStoreCache`)
   o'tkazildi va sahifalar avvalgidek sinxron `isloh_getReviews()`
   chaqiradi.

   JAVOB ENDI SHARHNING ICHIDA. Ilgari u alohida `isloh_review_replies`
   kalitida `{ "<sharh-id>": "javob matni" }` ko'rinishida yashardi va
   sharh o'chirilsa javob yetim bo'lib qolardi. Serverda u `OneToOne`
   (`ReviewReply`) va sharh bilan birga keladi. Tashqi API O'ZGARMADI —
   `isloh_getReviewReply(id)` hamon satr qaytaradi, ya'ni
   js/instructor-reviews.js va js/course-details.js ga tegilmadi.

   SHARHNI TALABA YOZADI, O'QITUVCHI FAQAT JAVOB BERADI. Shuning uchun bu
   do'kon o'qituvchi tomonida FAQAT O'QISH uchun: yagona yozuv amali —
   javob (`isloh_saveReviewReply`).
   ========================================================================== */

const ISLOH_REVIEWS_KEY = 'isloh_reviews';

const ISLOH_REVIEW_DEFAULTS = {
  id: '',
  courseId: '',
  courseTitle: '',
  studentId: '',
  studentName: '',
  avatar: '',       // CSS gradienti YOKI rasm manzili (M5 dan keyin)
  rating: 5,        // 1..5
  text: '',
  reply: '',        // o'qituvchi javobi; bo'sh bo'lsa javob berilmagan
  createdAt: ''     // ISO
};

/* Filtr chiplari uchun reyting guruhlari. "3 ★ va past" bitta qiymat bilan
   ishlashi kerak (js/filterable.js aniq moslikni tekshiradi), shuning uchun
   element atributi xom reyting emas, mana shu GURUH nomini oladi. */
function isloh_reviewRatingBand(rating) {
  const value = Number(rating) || 0;
  return value >= 5 ? '5' : (value === 4 ? '4' : 'low');
}

/* --- Demo ma'lumot --------------------------------------------------------
   Vaqtlar bugundan nisbatan (js/assignment-store.js dagi bilan bir xil
   sabab). Talaba id'lari js/chat-store.js va js/enrollment-store.js
   dagilar bilan bir xil.                                                   */

function isloh_rvHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function isloh_reviewSeed() {
  return [
    {
      id: 'rev-1', courseId: 'py-101', studentId: 's-bekzod', studentName: 'Bekzod Odilov',
      avatar: 'linear-gradient(135deg,#0EA5E9,#0369A1)', rating: 5,
      text: "Ajoyib kurs, hammasi tushunarli tushuntirilgan! Ayniqsa amaliy loyihalar juda foydali bo'ldi.",
      createdAt: isloh_rvHoursAgo(4)
    },
    {
      id: 'rev-2', courseId: 'django-rest-masterclass', studentId: 's-nodira', studentName: 'Nodira Yusupova',
      avatar: 'linear-gradient(135deg,#DB2777,#F472B6)', rating: 5,
      text: "Ustoz juda sabrli va savollarga aniq javob beradi. Xabarlar bo'limida tez javob oldim.",
      reply: 'Rahmat Nodira! Muvaffaqiyat tilayman 🙌',
      createdAt: isloh_rvHoursAgo(28)
    },
    {
      id: 'rev-3', courseId: 'py-101', studentId: 's-sardor', studentName: 'Sardor Aliyev',
      avatar: 'linear-gradient(135deg,#059669,#10B981)', rating: 4,
      text: "Yaxshi kurs, lekin ba'zi darslar biroz uzun. Qisqaroq video kesimlari bo'lsa yanada qulay bo'lardi.",
      createdAt: isloh_rvHoursAgo(50)
    },
    {
      /* Bu sharh egasining hisobi demo do'konlarda yo'q (kursni ancha oldin
         tugatgan talaba) — shuning uchun `studentId` bo'sh. Ism ko'rinadi,
         lekin uni hech qanday talaba yozuviga bog'lab bo'lmaydi. */
      id: 'rev-4', courseId: 'postgresql-complete-guide', studentId: '', studentName: 'Samarqand Islomov',
      avatar: '', rating: 3,
      text: "O'rtacha kurs, ba'zi bo'limlar biroz eskirgan versiyalarga asoslangan.",
      reply: 'Fikringiz uchun rahmat, kursni yangilash rejalashtirilgan.',
      createdAt: isloh_rvHoursAgo(120)
    },
    {
      id: 'rev-5', courseId: 'postgresql-complete-guide', studentId: 's-alisher', studentName: 'Alisher Karimov',
      avatar: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', rating: 5,
      text: 'Sertifikat uchun rahmat, kurs juda foydali bo\'ldi! Ishda darhol qo\'llay boshladim.',
      createdAt: isloh_rvHoursAgo(168)
    }
  ];
}

/* --- Do'kon: server (M6) --------------------------------------------------
   Serverdagi shakl snake_case (`student_name`, `created_at`) va javob
   ichma-ich obyekt; frontendniki camelCase va javob — oddiy satr. Ikkalasi
   FAQAT quyidagi funksiyada uchrashadi (M2 dagi 2-qaror). */

function isloh_isServerReview(row) {
  return row && (('student_name' in row) || ('course_title' in row));
}

function isloh_fromServerReview(row) {
  return {
    id: row.id,
    courseId: row.course,
    courseTitle: row.course_title || '',
    studentId: (row.author && row.author.id) || '',
    studentName: row.student_name || (row.author && row.author.name) || '',
    avatar: row.avatar || '',
    rating: Number(row.rating) || 0,
    text: row.text || '',
    reply: (row.reply && row.reply.text) || '',
    createdAt: row.created_at || ''
  };
}

function isloh_normalizeReview(review) {
  const source = isloh_isServerReview(review) ? isloh_fromServerReview(review) : (review || {});
  return Object.assign({}, ISLOH_REVIEW_DEFAULTS, source);
}

const ISLOH_REVIEW_CACHE = isloh_createStoreCache({
  key: ISLOH_REVIEWS_KEY,
  endpoint: '/instructor/reviews',
  event: 'isloh:reviews-updated',
  normalize: isloh_normalizeReview,
  seed: isloh_reviewSeed
});

function isloh_loadReviews() { return ISLOH_REVIEW_CACHE.load(); }
function isloh_getReviews()  { return ISLOH_REVIEW_CACHE.get(); }

function isloh_getReview(id) {
  if (!id) return null;
  return isloh_getReviews().find((r) => r.id === id) || null;
}

/* Bitta kursning sharhlari, eng yangisi tepada — kurs tafsilotlari
   sahifasidagi "So'nggi sharhlar" bloki shu ro'yxatni chizadi. */
function isloh_getCourseReviews(courseId) {
  const list = courseId ? isloh_getReviews().filter((r) => r.courseId === courseId) : isloh_getReviews();
  return list.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/* --- Javoblar -------------------------------------------------------------
   Tashqi API o'zgarmadi: `isloh_getReviewReply(id)` satr qaytaradi. */

function isloh_getReviewReply(id) {
  const review = isloh_getReview(id);
  return review ? (review.reply || '') : '';
}

/* Javob ALOHIDA endpoint'ga boradi, do'kon fabrikasining `PUT` yo'li bilan
   emas: fabrika butun sharhni yuborardi va u yerda `rating` ham, `text`
   ham bo'lardi — ya'ni o'qituvchi javob yozayotib talabaning bahosini
   ham o'zgartirib yuborishi mumkin bo'lardi. Server buni baribir rad
   etadi, lekin so'rovning o'zi noto'g'ri niyatni ifodalardi. */
function isloh_saveReviewReply(id, text) {
  const list = isloh_getReviews();
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return false;

  const previous = list[index].reply;
  list[index] = Object.assign({}, list[index], { reply: text });

  /* Optimistik: javob darhol ko'rinadi. Javob berish darajasi va
     "javobsiz qolgan" ko'rsatkichlari shu hodisadan keyin qayta
     hisoblanadi (js/profile-stats.js). */
  document.dispatchEvent(new CustomEvent('isloh:reviews-updated', { detail: list }));

  islohApi.post('/instructor/reviews/' + id + '/reply', { text: text })
    .then(() => ISLOH_REVIEW_CACHE.load())
    .catch((err) => {
      const at = isloh_getReviews().findIndex((r) => r.id === id);
      if (at !== -1) isloh_getReviews()[at].reply = previous;
      document.dispatchEvent(new CustomEvent('isloh:reviews-updated', { detail: isloh_getReviews() }));
      if (typeof islohUI !== 'undefined') islohUI.toast(err.error || "Saqlab bo'lmadi", 'error');
    });

  return true;
}

/* --- Talaba tomoni --------------------------------------------------------
   Sharh KURS manzili ostida yaratiladi va faqat kursga yozilgan talabadan
   qabul qilinadi (apps/social/views.py, 1-qoida). */

function isloh_loadCourseReviews(courseId) {
  return islohApi.get('/courses/' + courseId + '/reviews')
    .then((rows) => (rows || []).map(isloh_normalizeReview));
}

function isloh_submitCourseReview(courseId, rating, text) {
  return islohApi.post('/courses/' + courseId + '/reviews', { rating: rating, text: text })
    .then(isloh_normalizeReview);
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

/* Reyting xulosasi: o'rtacha, jami va yulduzlar bo'yicha taqsimot.
   Taqsimot FOIZda — reviews.html dagi chiziqlar shu qiymatni ishlatadi. */
function isloh_reviewStats(courseId) {
  const list = courseId ? isloh_getReviews().filter((r) => r.courseId === courseId) : isloh_getReviews();
  const replied = list.filter((r) => Boolean(r.reply)).length;

  const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  list.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
    buckets[star] += 1;
  });

  const distribution = {};
  Object.keys(buckets).forEach((star) => {
    distribution[star] = list.length ? Math.round((buckets[star] / list.length) * 100) : 0;
  });

  return {
    total: list.length,
    average: list.length ? list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / list.length : 0,
    replied: replied,
    pending: list.length - replied,
    replyRate: list.length ? Math.round((replied / list.length) * 100) : 0,
    counts: buckets,
    distribution: distribution
  };
}

/* Yulduzlar qatori. To'liq / yarim / bo'sh — bitta joyda, chunki uni ham
   sharhlar ro'yxati, ham reyting xulosasi chizadi. */
function isloh_reviewStarsHtml(rating) {
  const value = Number(rating) || 0;
  let html = '';
  for (let star = 1; star <= 5; star++) {
    if (value >= star) html += '<i class="bi bi-star-fill"></i>';
    else if (value >= star - 0.5) html += '<i class="bi bi-star-half"></i>';
    else html += '<i class="bi bi-star"></i>';
  }
  return html;
}

/* Sharh muallifining avatari — kartochka HTML'i uchun (M6).

   IKKI SHAKL: demo yozuvlarda `avatar` — CSS gradienti, serverda esa
   RASM MANZILI (M5 dan keyin `User.avatar` — `/api/v1/files/.../download`).
   Ikkalasini bitta `style="background:..."` bilan chizib bo'lmaydi.

   Manzil MATN maydonidan keladi, ya'ni unga istalgan narsa yozilishi
   mumkin — shuning uchun gradient `isloh_safeCssValue` (oq ro'yxat), manzil
   esa `isloh_escapeAttr` orqali o'tadi (js/escape.js).                     */
function isloh_reviewAvatarHtml(review) {
  const initials = typeof isloh_getUserInitials === 'function'
    ? isloh_getUserInitials(review.studentName)
    : String(review.studentName || '?').charAt(0).toUpperCase();
  const value = String(review.avatar || '');

  if (/^(\/|https?:)/.test(value)) {
    return `<div class="avatar avatar-sm">${isloh_escapeHtml(initials)}<img class="avatar-img" alt="" src="${isloh_escapeAttr(value)}"></div>`;
  }

  const css = isloh_safeCssValue(value);
  const style = css ? ` style="background:${css};"` : '';
  return `<div class="avatar avatar-sm"${style}>${isloh_escapeHtml(initials)}</div>`;
}

/* Sharh vaqti: "4 soat oldin" / "2 kun oldin". Format js/datetime.js
   zimmasida (til va mintaqa sozlamasiga bo'ysunadi). */
function isloh_reviewTimeLabel(review) {
  if (!review || !review.createdAt) return '';
  return typeof isloh_relativeTime === 'function' ? isloh_relativeTime(review.createdAt) : review.createdAt;
}
