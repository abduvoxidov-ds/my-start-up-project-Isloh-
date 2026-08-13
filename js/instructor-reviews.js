/* ==========================================================================
   ISLOH — Sharhlar sahifasi (pages/instructor/reviews.html)

   NEGA O'ZGARDI: bu fayl ilgari faqat JAVOBLARNI boshqarardi — sharhlarning
   o'zi HTML ichida qo'lda yozilgan 5 ta kartochka edi. Shu sababli reyting
   xulosasi ("4.8", "128 ta sharh", taqsimot chiziqlari) hech narsadan
   hisoblanmasdi va ro'yxat bilan ziddiyatda turardi. Endi kartochkalar ham,
   xulosa ham js/review-store.js dagi `isloh_reviews` do'konidan chiziladi.

   Javoblar SHU KUNGACHA bo'lgan joyida qoldi — `isloh_review_replies`,
   { "<sharh-id>": "javob matni" } shaklida. O'zgargani: o'qish/yozish
   funksiyalari do'kon fayliga ko'chirildi, chunki ularni endi kurs
   tafsilotlari sahifasi ham ishlatadi.

   Mehnat taqsimoti:
     RAQAMLAR (4 ta kartochka) -> js/profile-stats.js, `[data-stat]`
     RO'YXAT + XULOSA          -> shu fayl
     FILTR                     -> js/filterable.js

   Markup shartnomasi:
     [data-review-list]           → kartochkalar shu yerga chiziladi
     [data-review-average] / [data-review-average-stars] / [data-review-total]
     [data-review-bars]           → yulduzlar taqsimoti chiziqlari
     #review-reply-modal
       [data-review-quote] / [data-review-reply-input] / [data-review-reply-submit]
   ========================================================================== */

/* Kurs nomi do'kondan; kurs o'chirilgan bo'lsa id ko'rinadi (sharh
   yo'qolib qolmasin). */
function isloh_reviewCourseTitle(courseId) {
  const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(courseId) : null;
  return course ? course.title : courseId;
}

function isloh_reviewCardHtml(review) {
  const reply = isloh_getReviewReply(review.id);
  const initials = typeof isloh_getUserInitials === 'function'
    ? isloh_getUserInitials(review.studentName)
    : String(review.studentName || '?').charAt(0).toUpperCase();
  const avatarStyle = review.avatar ? ` style="background:${review.avatar};"` : '';

  /* Javob bor bo'lsa javob bloki, bo'lmasa "Javob berish" tugmasi —
     ikkalasi birga ko'rinmaydi. */
  const tail = reply
    ? `<div class="review-reply"><div class="lbl">Sizning javobingiz</div><div class="txt">${reply}</div></div>`
    : `<div class="review-actions"><button type="button" class="btn btn-teach btn-sm" data-review-reply><i class="bi bi-reply-fill"></i> Javob berish</button></div>`;

  return `<div class="review-card" data-review-id="${review.id}" data-filter-item
       data-rating-band="${isloh_reviewRatingBand(review.rating)}"
       data-reply="${reply ? 'replied' : 'pending'}"
       data-filter-text="${review.studentName} ${review.text}">
    <div class="avatar avatar-sm"${avatarStyle}>${initials}</div>
    <div style="flex:1; min-width:0;">
      <div class="review-head">
        <span class="review-name filter-title">${review.studentName}</span>
        <span class="rating-stars">${isloh_reviewStarsHtml(review.rating)}</span>
        <span class="review-course">· ${isloh_reviewCourseTitle(review.courseId)}</span>
        <span class="review-time">${isloh_reviewTimeLabel(review)}</span>
      </div>
      <div class="review-text">${review.text}</div>
      ${tail}
    </div>
  </div>`;
}

/* Reyting xulosasi: o'rtacha ball, yulduzlar va 5..1 taqsimoti. Foizlar
   do'kondan (js/review-store.js — isloh_reviewStats). */
function isloh_renderReviewSummary(stats) {
  const average = document.querySelector('[data-review-average]');
  if (average) average.textContent = stats.total ? stats.average.toFixed(1) : '—';

  const stars = document.querySelector('[data-review-average-stars]');
  if (stars) stars.innerHTML = isloh_reviewStarsHtml(stats.average);

  const total = document.querySelector('[data-review-total]');
  if (total) total.textContent = stats.total;

  const bars = document.querySelector('[data-review-bars]');
  if (!bars) return;
  bars.innerHTML = [5, 4, 3, 2, 1].map((star) => {
    const pct = stats.distribution[star];
    return `<div class="rating-bar-row">
      <span class="lbl">${star} ★</span>
      <div class="progress-track"><div class="progress-fill warning-fill" style="width:${pct}%;"></div></div>
      <span class="pct">${pct}%</span>
    </div>`;
  }).join('');
}

function isloh_renderReviews() {
  const mount = document.querySelector('[data-review-list]');
  if (!mount) return; // bu sahifa emas

  const reviews = isloh_getCourseReviews(); // kurssiz chaqiruv — barcha sharhlar
  mount.innerHTML = reviews.map(isloh_reviewCardHtml).join('');
  isloh_renderReviewSummary(isloh_reviewStats());

  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Javob berish ---------------------------------------------------------
   Javob do'konga yoziladi va `isloh:reviews-updated` hodisasi orqali ham
   ro'yxat, ham yuqoridagi raqamlar qayta chiziladi. */

function isloh_initReviewReplies() {
  const mount = document.querySelector('[data-review-list]');
  if (!mount) return;

  let pendingId = null;
  const input = document.querySelector('[data-review-reply-input]');

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-review-reply]');
    if (!btn) return;

    const card = btn.closest('.review-card');
    pendingId = card.dataset.reviewId;

    const quote = document.querySelector('[data-review-quote]');
    if (quote) quote.textContent = card.querySelector('.review-text').textContent;
    if (input) input.value = '';
    if (typeof isloh_openModal === 'function') isloh_openModal('review-reply-modal');
  });

  const submit = document.querySelector('[data-review-reply-submit]');
  if (!submit) return;

  submit.addEventListener('click', () => {
    const text = input ? input.value.trim() : '';
    if (!text) {
      if (typeof isloh_showToast === 'function') isloh_showToast('Javob matnini kiriting', 'error');
      return;
    }
    if (!pendingId) return;

    if (!isloh_saveReviewReply(pendingId, text)) {
      if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    pendingId = null;
    if (typeof isloh_closeModal === 'function') isloh_closeModal('review-reply-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast('Javobingiz saqlandi', 'success');
  });
}

document.addEventListener('isloh:reviews-updated', isloh_renderReviews);
/* Kurs nomi o'zgarsa kartochkadagi kurs yorlig'i ham yangilansin. */
document.addEventListener('isloh:courses-updated', isloh_renderReviews);
document.addEventListener('DOMContentLoaded', () => {
  isloh_renderReviews();
  isloh_initReviewReplies();
});
