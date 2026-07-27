/* ==========================================================================
   ISLOH — Cart module  (Sprint 9)
   Powers pages/student/cart.html. Frontend-only: nothing is persisted or
   sent anywhere — quantity/remove/save-for-later/coupon all mutate the DOM
   and the price summary recalculates from what's currently rendered.
   Mirrors the declarative, data-attribute style of js/bookmarks.js and
   js/courses.js rather than introducing a new pattern.

   Markup contract:
     [data-cart-list]                     → container of cart rows
       [data-cart-item][data-price="0"]   → one row, price in so'm (number)
         [data-qty-value]                 → text node showing quantity
         [data-qty-inc] / [data-qty-dec]  → stepper buttons
         [data-cart-remove]               → removes the row
         [data-cart-save]                 → moves row to "saved for later"
     [data-saved-list]                    → container for saved-for-later rows
       [data-cart-restore]                → moves row back to the cart
     [data-cart-count]                    → topbar badge, shown as N
     [data-cart-empty]                    → shown when the cart has 0 items
     #coupon-input / #coupon-apply        → coupon UI (visual only)
     [data-sum-subtotal] / [data-sum-discount] / [data-sum-total]
     ========================================================================== */

const ISLOH_COUPON = { code: 'ISLOH2026', percent: 15 };
let isloh_couponApplied = false;

function isloh_cartItems() {
  return [...document.querySelectorAll('[data-cart-list] [data-cart-item]')];
}

function isloh_formatSom(n) {
  return Math.round(n).toLocaleString('uz-UZ') + " so'm";
}

function isloh_recalcCart() {
  const items = isloh_cartItems();
  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.dataset.price) || 0;
    const qty = parseInt(item.querySelector('[data-qty-value]')?.textContent, 10) || 1;
    return sum + price * qty;
  }, 0);
  const discount = isloh_couponApplied ? subtotal * (ISLOH_COUPON.percent / 100) : 0;
  const total = subtotal - discount;

  const subEl = document.querySelector('[data-sum-subtotal]');
  const discEl = document.querySelector('[data-sum-discount]');
  const discRow = document.querySelector('[data-sum-discount-row]');
  const totEl = document.querySelector('[data-sum-total]');
  if (subEl) subEl.textContent = isloh_formatSom(subtotal);
  if (discEl) discEl.textContent = '−' + isloh_formatSom(discount);
  if (discRow) discRow.hidden = !isloh_couponApplied;
  if (totEl) totEl.textContent = isloh_formatSom(total);

  const countEls = document.querySelectorAll('[data-cart-count]');
  countEls.forEach((el) => {
    el.textContent = items.length;
    el.classList.toggle('badge-empty', items.length === 0);
  });

  const empty = document.querySelector('[data-cart-empty]');
  const list = document.querySelector('[data-cart-list]');
  const checkoutBtn = document.querySelector('[data-checkout-btn]');
  if (empty && list) {
    empty.style.display = items.length === 0 ? '' : 'none';
    list.closest('.card').style.display = items.length === 0 ? 'none' : '';
  }
  if (checkoutBtn) checkoutBtn.disabled = items.length === 0;
}

function isloh_initCart() {
  const list = document.querySelector('[data-cart-list]');
  const saved = document.querySelector('[data-saved-list]');
  if (!list) return;

  document.body.addEventListener('click', (e) => {
    const incBtn = e.target.closest('[data-qty-inc]');
    const decBtn = e.target.closest('[data-qty-dec]');
    const removeBtn = e.target.closest('[data-cart-remove]');
    const saveBtn = e.target.closest('[data-cart-save]');
    const restoreBtn = e.target.closest('[data-cart-restore]');

    if (incBtn || decBtn) {
      const row = (incBtn || decBtn).closest('[data-cart-item]');
      const span = row.querySelector('[data-qty-value]');
      let val = parseInt(span.textContent, 10) || 1;
      val = incBtn ? val + 1 : Math.max(1, val - 1);
      span.textContent = val;
      isloh_recalcCart();
    }

    if (removeBtn) {
      const row = removeBtn.closest('[data-cart-item]');
      row.remove();
      isloh_recalcCart();
      if (typeof isloh_showToast === 'function') isloh_showToast("Kurs savatdan o'chirildi", 'success');
    }

    if (saveBtn && saved) {
      const row = saveBtn.closest('[data-cart-item]');
      row.classList.add('saved-later');
      saveBtn.remove();
      const restoreBtnEl = document.createElement('button');
      restoreBtnEl.className = 'link-btn';
      restoreBtnEl.setAttribute('data-cart-restore', '');
      restoreBtnEl.textContent = 'Savatga qaytarish';
      row.querySelector('.cart-item-actions').appendChild(restoreBtnEl);
      row.querySelector('.cart-item-actions [data-cart-remove]')?.remove();
      saved.appendChild(row);
      saved.closest('.card').hidden = false;
      isloh_recalcCart();
    }

    if (restoreBtn) {
      const row = restoreBtn.closest('[data-cart-item]');
      row.classList.remove('saved-later');
      restoreBtn.remove();
      const removeBtnEl = document.createElement('button');
      removeBtnEl.className = 'link-btn danger';
      removeBtnEl.setAttribute('data-cart-remove', '');
      removeBtnEl.textContent = "O'chirish";
      row.querySelector('.cart-item-actions').appendChild(removeBtnEl);
      list.appendChild(row);
      isloh_recalcCart();
    }
  });

  const couponBtn = document.getElementById('coupon-apply');
  if (couponBtn) {
    couponBtn.addEventListener('click', () => {
      const input = document.getElementById('coupon-input');
      const value = (input?.value || '').trim().toUpperCase();
      if (value === ISLOH_COUPON.code) {
        isloh_couponApplied = true;
        isloh_recalcCart();
        if (typeof isloh_showToast === 'function') isloh_showToast(`Kupon qo'llandi: −${ISLOH_COUPON.percent}%`, 'success');
      } else if (typeof isloh_showToast === 'function') {
        isloh_showToast("Kupon kodi noto'g'ri", 'error');
      }
    });
  }

  isloh_recalcCart();
}

document.addEventListener('DOMContentLoaded', isloh_initCart);
