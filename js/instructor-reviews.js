/* ==========================================================================
   ISLOH — Sharhlarga javob berish (pages/instructor/reviews.html)
   "Javob berish" tugmalari hech qanday hodisaga ulanmagan edi — bosilsa
   hech narsa bo'lmasdi. Endi ular javob oynasini ochadi va yozilgan javob
   `isloh_review_replies` do'koniga tushadi, ya'ni sahifa yangilangandan
   keyin ham joyida qoladi.

   Do'kon shakli: { "<review-id>": "javob matni" }

   Markup shartnomasi:
     .review-card[data-review-id][data-reply="pending|replied"]
       [data-review-reply]    → "Javob berish" tugmasi
     #review-reply-modal
       [data-review-quote]    → javob yozilayotgan sharh matni
       [data-review-reply-input] / [data-review-reply-submit]
     [data-review-rate]       → "Javob berish darajasi" ko'rsatkichi
   ========================================================================== */

const ISLOH_REVIEW_REPLIES_KEY = 'isloh_review_replies';

function isloh_getReviewReplies() {
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_REVIEW_REPLIES_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch (e) {
    return {};
  }
}

function isloh_saveReviewReply(id, text) {
  const replies = isloh_getReviewReplies();
  replies[id] = text;
  try {
    localStorage.setItem(ISLOH_REVIEW_REPLIES_KEY, JSON.stringify(replies));
    return true;
  } catch (e) {
    return false;
  }
}

/* Javob blokini kartochkaga qo'yadi va holatini "replied" ga o'tkazadi. */
function isloh_renderReviewReply(card, text) {
  card.dataset.reply = 'replied';

  const actions = card.querySelector('.review-actions');
  if (actions) actions.remove();

  let block = card.querySelector('.review-reply');
  if (!block) {
    block = document.createElement('div');
    block.className = 'review-reply';
    block.innerHTML = '<div class="lbl">Sizning javobingiz</div><div class="txt"></div>';
    card.querySelector('.review-text').insertAdjacentElement('afterend', block);
  }
  block.querySelector('.txt').textContent = text;
}

/* "Javob berish darajasi" — javob berilgan sharhlar ulushi. Ilgari bu
   raqam qo'lda "92%" deb yozilgan va ro'yxat bilan bog'liq emas edi. */
function isloh_renderReviewRate() {
  const target = document.querySelector('[data-review-rate]');
  if (!target) return;
  const cards = [...document.querySelectorAll('.review-card')];
  if (!cards.length) return;
  const replied = cards.filter((c) => c.dataset.reply === 'replied').length;
  target.textContent = Math.round((replied / cards.length) * 100) + '%';
}

/* Saqlangan javoblarni sahifa ochilganda tiklaymiz. */
function isloh_restoreReviewReplies() {
  const replies = isloh_getReviewReplies();
  Object.keys(replies).forEach((id) => {
    const card = document.querySelector(`.review-card[data-review-id="${id}"]`);
    if (card) isloh_renderReviewReply(card, replies[id]);
  });
}

function isloh_initReviewReplies() {
  const list = document.querySelector('[data-filterable]') || document;
  if (!document.querySelector('.review-card')) return;

  isloh_restoreReviewReplies();
  isloh_renderReviewRate();

  let pendingCard = null;
  const input = document.querySelector('[data-review-reply-input]');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-review-reply]');
    if (!btn) return;

    pendingCard = btn.closest('.review-card');
    const quote = document.querySelector('[data-review-quote]');
    if (quote) quote.textContent = pendingCard.querySelector('.review-text').textContent;
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
    if (!pendingCard) return;

    if (!isloh_saveReviewReply(pendingCard.dataset.reviewId, text)) {
      if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    isloh_renderReviewReply(pendingCard, text);
    isloh_renderReviewRate();
    pendingCard = null;

    if (typeof isloh_closeModal === 'function') isloh_closeModal('review-reply-modal');
    if (typeof isloh_showToast === 'function') isloh_showToast('Javobingiz saqlandi', 'success');
  });
}

document.addEventListener('DOMContentLoaded', isloh_initReviewReplies);
