/* ==========================================================================
   ISLOH — Cart module
   Powers pages/student/cart.html by rendering directly from ISLOH_CART_KEY
   (js/marketplace.js), so it reflects whatever was added from Marketplace
   or Wishlist. "Keyinga saqlash" stays session-only (DOM state) — the cart
   item list itself is the persisted source of truth.

   Miqdor (qty) yo'q: kurs — jismoniy tovar emas, bir kursni faqat bir marta
   sotib olish mumkin. isloh_addToCart() ham bir xil kursni ikkinchi marta
   qo'shmaydi, shuning uchun savatdagi har bir qator = 1 dona.

   Markup contract:
     [data-cart-list]                     → container, rendered from
                                            isloh_getCartItems()
       [data-cart-item][data-course-id][data-price="0"]
         [data-cart-remove]               → removes the row + storage entry
         [data-cart-save]                 → moves row to "saved for later"
                                            (removed from storage meanwhile)
     [data-saved-list]                    → container for saved-for-later rows
       [data-cart-restore]                → moves row back to cart + storage
     [data-cart-count]                    → topbar badge
     [data-cart-empty]                    → shown when the cart has 0 items
     [data-checkout-btn]                  → gets .btn-disabled when empty
     #coupon-input / #coupon-apply        → coupon UI (ISLOH_COUPON, marketplace.js)
     [data-sum-subtotal] / [data-sum-discount] / [data-sum-total]
   ========================================================================== */

let isloh_couponApplied = false;

function isloh_cartRowHtml(item) {
  const meta = [item.instructor, item.duration, item.level].filter(Boolean).join(' &middot; ');
  return `<div class="cart-item" data-cart-item data-course-id="${item.id}" data-price="${item.price}">
    <div class="cart-item-cover" style="background:${item.cover};"><i class="${item.icon}"></i></div>
    <div class="cart-item-body">
      <div class="cart-item-title">${item.title}</div>
      ${meta ? `<div class="cart-item-meta">${meta}</div>` : ''}
    </div>
    <div class="cart-item-price"><div style="font-weight:800; font-size:14px;">${isloh_formatSom(item.price)} so'm</div></div>
    <div class="cart-item-actions">
      <button type="button" class="link-btn" data-cart-save>Keyinga saqlash</button>
      <button type="button" class="link-btn danger" data-cart-remove>O'chirish</button>
    </div>
  </div>`;
}

function isloh_renderCartRows() {
  const list = document.querySelector('[data-cart-list]');
  if (!list) return;
  const items = typeof isloh_getCartItems === 'function' ? isloh_getCartItems() : [];
  list.innerHTML = items.map(isloh_cartRowHtml).join('');
}

function isloh_cartItems() {
  return [...document.querySelectorAll('[data-cart-list] [data-cart-item]')];
}

function isloh_removeFromCartStorage(id) {
  if (typeof isloh_getCartItems !== 'function') return;
  isloh_saveCartItems(isloh_getCartItems().filter((c) => c.id !== id));
}

function isloh_recalcCart() {
  const items = isloh_cartItems();
  // Har bir qator bitta kurs — miqdorga ko'paytirish yo'q
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.dataset.price) || 0), 0);
  const discount = isloh_couponApplied ? subtotal * (ISLOH_COUPON.percent / 100) : 0;
  const total = subtotal - discount;

  const subEl = document.querySelector('[data-sum-subtotal]');
  const discEl = document.querySelector('[data-sum-discount]');
  const discRow = document.querySelector('[data-sum-discount-row]');
  const totEl = document.querySelector('[data-sum-total]');
  if (subEl) subEl.textContent = isloh_formatSom(subtotal) + " so'm";
  if (discEl) discEl.textContent = '−' + isloh_formatSom(discount) + " so'm";
  if (discRow) discRow.hidden = !isloh_couponApplied;
  if (totEl) totEl.textContent = isloh_formatSom(total) + " so'm";

  document.querySelectorAll('[data-cart-count]').forEach((el) => {
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
  if (checkoutBtn) checkoutBtn.classList.toggle('btn-disabled', items.length === 0);
}

function isloh_initCart() {
  const list = document.querySelector('[data-cart-list]');
  const saved = document.querySelector('[data-saved-list]');
  if (!list) return;

  isloh_renderCartRows();

  document.body.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-cart-remove]');
    const saveBtn = e.target.closest('[data-cart-save]');
    const restoreBtn = e.target.closest('[data-cart-restore]');

    if (removeBtn) {
      const row = removeBtn.closest('[data-cart-item]');
      isloh_removeFromCartStorage(row.dataset.courseId);
      row.remove();
      isloh_recalcCart();
      if (typeof isloh_showToast === 'function') isloh_showToast("Kurs savatdan o'chirildi", 'success');
    }

    if (saveBtn && saved) {
      const row = saveBtn.closest('[data-cart-item]');
      isloh_removeFromCartStorage(row.dataset.courseId);
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
      if (typeof isloh_addToCart === 'function') {
        isloh_addToCart({
          id: row.dataset.courseId,
          title: row.querySelector('.cart-item-title')?.textContent,
          cover: row.querySelector('.cart-item-cover')?.style.background,
          icon: row.querySelector('.cart-item-cover i')?.className,
          price: parseFloat(row.dataset.price) || 0
        });
      }
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
