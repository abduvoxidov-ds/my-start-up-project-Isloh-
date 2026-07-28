/* ==========================================================================
   ISLOH — Checkout module  (Sprint 9)
   Frontend-only multi-step checkout for pages/student/checkout.html. No
   backend/payment processing — "Buyurtmani tasdiqlash" only swaps the
   visible step panel to a Success (or, rarely, Failure) placeholder state.

   Markup contract:
     [data-checkout-steps] [data-step]                → step indicator (1..3)
     [data-checkout-panel="1|2|3|success|failure"]     → panel to show/hide
     [data-checkout-next] / [data-checkout-back]       → step navigation
     [data-payment-card]                               → click selects a
       radio input inside it and adds .selected
     #promo-input / #promo-apply                       → promo code (visual)
     [data-checkout-submit]                            → moves to success
     [data-checkout-retry]                             → failure → step 2
   ========================================================================== */

const ISLOH_PROMO = { code: 'ISLOH2026', label: "−15% chegirma qo'llandi" };

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

function isloh_initCheckout() {
  const steps = document.querySelector('[data-checkout-steps]');
  if (!steps && !document.querySelector('[data-checkout-panel]')) return;

  let current = 1;
  isloh_showCheckoutPanel(current);

  document.querySelectorAll('[data-checkout-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = Math.min(3, current + 1);
      isloh_showCheckoutPanel(current);
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
      if (value === ISLOH_PROMO.code) {
        if (note) { note.textContent = ISLOH_PROMO.label; note.style.color = 'var(--teach-green)'; }
        if (typeof isloh_showToast === 'function') isloh_showToast(ISLOH_PROMO.label, 'success');
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
