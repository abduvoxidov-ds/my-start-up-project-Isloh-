/* ==========================================================================
   ISLOH — Sharhlar do'koni

   IKKI KALIT, ikki tushuncha:

     `isloh_reviews`        — sharhlarning O'ZI (kim, qaysi kursga, necha
                              yulduz, qachon). Shu fayl ekadi va boshqaradi.
     `isloh_review_replies` — o'qituvchining JAVOBLARI, `{ "<sharh-id>":
                              "javob matni" }` ko'rinishida. Bu kalit ilgari
                              js/instructor-reviews.js da paydo bo'lgan va
                              shakli O'ZGARMADI — faqat o'qish/yozish
                              funksiyalari shu yerga ko'chirildi, chunki
                              endi ularni kurs tafsilotlari sahifasi ham
                              ishlatadi (CLAUDE.md §2 — DRY).

   NEGA BU FAYL BOR: sharhlar ro'yxati reviews.html ichiga qo'lda yozilgan
   5 ta kartochkadan iborat edi. Javob saqlanardi, lekin sharhning o'zi
   hech qayerda yo'q edi: yuqoridagi "4.8 / 128 ta sharh / 6 javobsiz"
   raqamlari ham, reyting taqsimoti chiziqlari ham ro'yxat bilan bog'liq
   emas edi (jadvalda 5 ta sharh turib, kartochka 128 derdi). Kurs
   tafsilotlari sahifasidagi "So'nggi sharhlar" bloki esa shu sababli
   umuman bo'sh — `.placeholder-note` bilan — qolgan edi.

   Naqsh js/assignment-store.js bilan bir xil: sxema + demo seed + qisman
   yangilash + `isloh:reviews-updated` hodisasi. fetch() ishlatilmaydi
   (CLAUDE.md §3).
   ========================================================================== */

const ISLOH_REVIEWS_KEY = 'isloh_reviews';
const ISLOH_REVIEW_REPLIES_KEY = 'isloh_review_replies';

const ISLOH_REVIEW_DEFAULTS = {
  id: '',
  courseId: '',
  studentId: '',
  studentName: '',
  avatar: '',       // CSS gradienti; bo'sh bo'lsa .avatar sinfining o'z rangi
  rating: 5,        // 1..5
  text: '',
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

/* Javoblarning demo ma'lumoti — ilgari reviews.html markupida turgan ikki
   javob. Faqat kalit UMUMAN yo'q bo'lganda ekiladi: foydalanuvchi javobni
   o'chirib bo'sh `{}` qoldirgan bo'lsa, u qayta tiklanmasin. */
function isloh_reviewReplySeed() {
  return {
    'rev-2': 'Rahmat Nodira! Muvaffaqiyat tilayman 🙌',
    'rev-4': 'Fikringiz uchun rahmat, kursni yangilash rejalashtirilgan.'
  };
}

/* --- Do'kon (sharhlar) ---------------------------------------------------- */

function isloh_rvReadJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function isloh_rvWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_normalizeReview(review) {
  return Object.assign({}, ISLOH_REVIEW_DEFAULTS, review || {});
}

function isloh_getReviews() {
  const stored = isloh_rvReadJson(ISLOH_REVIEWS_KEY);
  if (Array.isArray(stored)) return stored.map(isloh_normalizeReview);

  const seed = isloh_reviewSeed().map(isloh_normalizeReview);
  isloh_rvWriteJson(ISLOH_REVIEWS_KEY, seed);
  return seed;
}

function isloh_getReview(id) {
  if (!id) return null;
  return isloh_getReviews().find((r) => r.id === id) || null;
}

/* Bitta kursning sharhlari, eng yangisi tepada — kurs tafsilotlari
   sahifasidagi "So'nggi sharhlar" bloki shu ro'yxatni chizadi. */
function isloh_getCourseReviews(courseId) {
  const list = courseId ? isloh_getReviews().filter((r) => r.courseId === courseId) : isloh_getReviews();
  return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function isloh_commitReviews(list) {
  if (!isloh_rvWriteJson(ISLOH_REVIEWS_KEY, list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:reviews-updated', { detail: list }));
  return true;
}

/* Yozish API'si: sharhni talaba qoldiradi (talaba tomoni yoki backend),
   o'qituvchi tomonida esa faqat javob yoziladi. */
function isloh_saveReview(patch) {
  const list = isloh_getReviews();
  const data = patch || {};
  const index = data.id ? list.findIndex((r) => r.id === data.id) : -1;

  if (index === -1) {
    const review = isloh_normalizeReview(data);
    review.id = 'rev-' + Date.now();
    review.createdAt = review.createdAt || new Date().toISOString();
    list.unshift(review);
    return isloh_commitReviews(list) ? review : null;
  }

  list[index] = isloh_normalizeReview(Object.assign({}, list[index], data));
  return isloh_commitReviews(list) ? list[index] : null;
}

function isloh_deleteReview(id) {
  return isloh_commitReviews(isloh_getReviews().filter((r) => r.id !== id));
}

/* --- Do'kon (javoblar) ----------------------------------------------------
   Shakl o'zgarmadi: { "<sharh-id>": "javob matni" }.                        */

function isloh_getReviewReplies() {
  const raw = localStorage.getItem(ISLOH_REVIEW_REPLIES_KEY);
  if (raw === null) {
    const seed = isloh_reviewReplySeed();
    isloh_rvWriteJson(ISLOH_REVIEW_REPLIES_KEY, seed);
    return seed;
  }

  const stored = isloh_rvReadJson(ISLOH_REVIEW_REPLIES_KEY);
  return stored && typeof stored === 'object' ? stored : {};
}

function isloh_getReviewReply(id) {
  return isloh_getReviewReplies()[id] || '';
}

function isloh_saveReviewReply(id, text) {
  const replies = isloh_getReviewReplies();
  replies[id] = text;
  if (!isloh_rvWriteJson(ISLOH_REVIEW_REPLIES_KEY, replies)) return false;
  /* Javob berish darajasi va "javobsiz qolgan" ko'rsatkichlari shu hodisadan
     keyin qayta hisoblanadi (js/profile-stats.js). */
  document.dispatchEvent(new CustomEvent('isloh:reviews-updated', { detail: isloh_getReviews() }));
  return true;
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

/* Reyting xulosasi: o'rtacha, jami va yulduzlar bo'yicha taqsimot.
   Taqsimot FOIZda — reviews.html dagi chiziqlar shu qiymatni ishlatadi. */
function isloh_reviewStats(courseId) {
  const list = courseId ? isloh_getReviews().filter((r) => r.courseId === courseId) : isloh_getReviews();
  const replies = isloh_getReviewReplies();
  const replied = list.filter((r) => Boolean(replies[r.id])).length;

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

/* Sharh vaqti: "4 soat oldin" / "2 kun oldin". Format js/datetime.js
   zimmasida (til va mintaqa sozlamasiga bo'ysunadi). */
function isloh_reviewTimeLabel(review) {
  if (!review || !review.createdAt) return '';
  return typeof isloh_relativeTime === 'function' ? isloh_relativeTime(review.createdAt) : review.createdAt;
}
