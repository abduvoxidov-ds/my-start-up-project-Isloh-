/* ==========================================================================
   ISLOH — Checkout module
   Multi-step checkout for pages/student/checkout.html, driven by the same
   ISLOH_CART_KEY cart (js/marketplace.js) that Marketplace/Cart write to —
   the order review (step 3) and the summary sidebar render straight from
   it, and "Buyurtmani tasdiqlash" finalizes + empties that same cart.

   Markup contract:
     [data-checkout-steps] [data-step]                → step indicator (1..3)
     [data-checkout-panel="1|2|3|success|failure"]     → panel to show/hide
     [data-checkout-next] / [data-checkout-back]       → step navigation
     [data-payment-card]                               → click selects a
       radio input inside it and adds .selected
     [data-checkout-review]                            → step-3 line items,
       rendered from isloh_getCartItems()
     [data-checkout-count] / [data-checkout-subtotal] /
       [data-checkout-discount-row] / [data-checkout-discount] /
       [data-checkout-total]                           → summary sidebar
     #promo-input / #promo-apply                       → promo code (ISLOH_COUPON)
     [data-checkout-submit]                            → moves to success
     [data-checkout-retry]                             → failure → step 2
   ========================================================================== */

let isloh_checkoutPromoApplied = false;

function isloh_showCheckoutPanel(step) {
  document.querySelectorAll('[data-checkout-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.checkoutPanel !== String(step);
  });
  document.querySelectorAll('[data-checkout-steps] [data-step]').forEach((el) => {
    const n = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'done');
    if (typeof step === 'number') {
      if (n < step) el.classList.add('done');
      if (n === step) el.classList.add('active');
    }
  });
}

function isloh_renderCheckoutSummary() {
  const items = typeof isloh_getCartItems === 'function' ? isloh_getCartItems() : [];
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const discount = isloh_checkoutPromoApplied ? subtotal * (ISLOH_COUPON.percent / 100) : 0;
  const total = subtotal - discount;

  const review = document.querySelector('[data-checkout-review]');
  if (review) {
    const rows = items.map((item) => `<div style="display:flex; justify-content:space-between; font-size:13px; padding:5px 0;"><span>${item.title}</span><span>${isloh_formatSom(item.price)} so'm</span></div>`).join('');
    review.innerHTML = rows + `<div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; padding-top:10px; margin-top:6px; border-top:1px solid var(--border-soft);"><span>Jami</span><span>${isloh_formatSom(total)} so'm</span></div>`;
  }

  const countEl = document.querySelector('[data-checkout-count]');
  if (countEl) countEl.textContent = `${items.length} ta kurs`;
  const subEl = document.querySelector('[data-checkout-subtotal]');
  if (subEl) subEl.textContent = isloh_formatSom(subtotal) + " so'm";
  const discRow = document.querySelector('[data-checkout-discount-row]');
  const discEl = document.querySelector('[data-checkout-discount]');
  if (discRow) discRow.hidden = !isloh_checkoutPromoApplied;
  if (discEl) discEl.textContent = '−' + isloh_formatSom(discount) + " so'm";
  const totEl = document.querySelector('[data-checkout-total]');
  if (totEl) totEl.textContent = isloh_formatSom(total) + " so'm";
}

function isloh_initCheckout() {
  const steps = document.querySelector('[data-checkout-steps]');
  if (!steps && !document.querySelector('[data-checkout-panel]')) return;

  let current = 1;
  isloh_showCheckoutPanel(current);
  isloh_renderCheckoutSummary();

  document.querySelectorAll('[data-checkout-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = Math.min(3, current + 1);
      isloh_showCheckoutPanel(current);
      if (current === 3) isloh_renderCheckoutSummary();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  document.querySelectorAll('[data-checkout-back]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = Math.max(1, current - 1);
      isloh_showCheckoutPanel(current);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-payment-card]').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('[data-payment-card]').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  const promoBtn = document.getElementById('promo-apply');
  if (promoBtn) {
    promoBtn.addEventListener('click', () => {
      const input = document.getElementById('promo-input');
      const value = (input?.value || '').trim().toUpperCase();
      const note = document.getElementById('promo-note');
      if (value === ISLOH_COUPON.code) {
        isloh_checkoutPromoApplied = true;
        isloh_renderCheckoutSummary();
        const label = `−${ISLOH_COUPON.percent}% chegirma qo'llandi`;
        if (note) { note.textContent = label; note.style.color = 'var(--teach-green)'; }
        if (typeof isloh_showToast === 'function') isloh_showToast(label, 'success');
      } else {
        if (note) { note.textContent = "Promo-kod topilmadi"; note.style.color = 'var(--danger)'; }
        if (typeof isloh_showToast === 'function') isloh_showToast("Promo-kod topilmadi", 'error');
      }
    });
  }

  document.querySelectorAll('[data-checkout-submit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_finalizeCartCheckout === 'function') isloh_finalizeCartCheckout();
      isloh_showCheckoutPanel('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-checkout-retry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = 2;
      isloh_showCheckoutPanel(current);
    });
  });
}

document.addEventListener('DOMContentLoaded', isloh_initCheckout);
