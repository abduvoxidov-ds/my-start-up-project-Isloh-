/* ==========================================================================
   ISLOH — Wishlist module
   Two responsibilities, both backed by localStorage (ISLOH_WISHLIST_KEY):
     1) Generic heart toggle — any [data-wishlist-toggle] button persists
        the course when its card carries the data-course-* payload
        (Marketplace grid cards render this); on cards without that payload
        it falls back to a visual-only toggle.
     2) Dedicated pages/student/wishlist.html list — renders persisted items,
        lets you remove them or send them straight to cart (js/marketplace.js).

   Markup contract:
     button[data-wishlist-toggle]                → any card's heart icon
       closest [data-course-id][data-course-title][data-course-cover]
         [data-course-icon][data-course-price][data-course-discount-price]
     [data-wishlist-list]                        → wishlist.html grid (rendered)
       [data-wishlist-item][data-course-id]
         [data-wishlist-remove]                  → removes the item
         [data-wishlist-add-cart]                → adds it to cart
     [data-wishlist-count]                       → topbar badge
     [data-wishlist-empty]                       → shown when list is empty
   ========================================================================== */

const ISLOH_WISHLIST_KEY = 'isloh_wishlist_items';

function isloh_getWishlistItems() {
  try { return JSON.parse(localStorage.getItem(ISLOH_WISHLIST_KEY)) || []; } catch (e) { return []; }
}
function isloh_saveWishlistItems(items) {
  localStorage.setItem(ISLOH_WISHLIST_KEY, JSON.stringify(items));
}
function isloh_isInWishlist(id) {
  return isloh_getWishlistItems().some((c) => c.id === id);
}
function isloh_toggleWishlistItem(course) {
  const items = isloh_getWishlistItems();
  const idx = items.findIndex((c) => c.id === course.id);
  if (idx > -1) {
    items.splice(idx, 1);
    isloh_saveWishlistItems(items);
    return false;
  }
  items.push(course);
  isloh_saveWishlistItems(items);
  return true;
}
function isloh_updateWishlistBadge() {
  const count = isloh_getWishlistItems().length;
  document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
    el.textContent = count;
    el.classList.toggle('badge-empty', count === 0);
  });
}

function isloh_recountWishlist() {
  isloh_updateWishlistBadge();
  const items = document.querySelectorAll('[data-wishlist-item]');
  const empty = document.querySelector('[data-wishlist-empty]');
  const grid = document.querySelector('[data-wishlist-list]');
  if (empty && grid) {
    empty.style.display = items.length === 0 ? '' : 'none';
    grid.style.display = items.length === 0 ? 'none' : '';
  }
}

function isloh_initWishlistToggles() {
  document.body.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-wishlist-toggle]');
    if (!toggle) return;
    const card = toggle.closest('[data-course-id]');
    let active;

    if (card) {
      const course = {
        id: card.dataset.courseId,
        title: card.dataset.courseTitle,
        cover: card.dataset.courseCover,
        icon: card.dataset.courseIcon,
        price: Number(card.dataset.coursePrice) || 0,
        discount_price: card.dataset.courseDiscountPrice ? Number(card.dataset.courseDiscountPrice) : null
      };
      active = isloh_toggleWishlistItem(course);
      isloh_updateWishlistBadge();
    } else {
      active = !toggle.classList.contains('active');
    }

    toggle.classList.toggle('active', active);
    const icon = toggle.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-heart', !active);
      icon.classList.toggle('bi-heart-fill', active);
    }
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(active ? "Xohishlar ro'yxatiga qo'shildi" : "Xohishlar ro'yxatidan olib tashlandi", 'success');
    }
  });
}

function isloh_wishlistCardHtml(course) {
  const priceRow = course.discount_price
    ? `<span class="price-now" style="font-weight:800; font-size:15px;">${Math.round(course.discount_price).toLocaleString('uz-UZ')} so'm</span><span class="price-old" style="font-size:12.5px; color:var(--ink-300); text-decoration:line-through;">${Math.round(course.price).toLocaleString('uz-UZ')}</span>`
    : `<span class="price-now" style="font-weight:800; font-size:15px;">${Math.round(course.price).toLocaleString('uz-UZ')} so'm</span>`;

  return `
    <div class="card" data-wishlist-item data-course-id="${course.id}">
      <div class="wl-cover" style="background:${course.cover};">
        <i class="${course.icon}"></i>
        <button class="fav-toggle active" data-wishlist-remove aria-label="Ro'yxatdan olib tashlash"><i class="bi bi-heart-fill"></i></button>
      </div>
      <div class="card-pad" style="padding-top:14px;">
        <span style="font-weight:700; font-size:14px; display:block;">${course.title}</span>
        <div class="wl-price-row">${priceRow}</div>
        <button class="btn btn-primary btn-sm btn-block" style="margin-top:10px;" data-wishlist-add-cart>Savatga qo'shish</button>
      </div>
    </div>`;
}

function isloh_renderWishlistPage() {
  const grid = document.querySelector('[data-wishlist-list]');
  if (!grid) return;
  grid.innerHTML = isloh_getWishlistItems().map(isloh_wishlistCardHtml).join('');
}

function isloh_initWishlistList() {
  const list = document.querySelector('[data-wishlist-list]');
  if (!list) return;

  isloh_renderWishlistPage();

  list.addEventListener('click', (e) => {
    const card = e.target.closest('[data-wishlist-item]');
    if (!card) return;
    const removeBtn = e.target.closest('[data-wishlist-remove]');
    const addCartBtn = e.target.closest('[data-wishlist-add-cart]');

    if (removeBtn) {
      isloh_saveWishlistItems(isloh_getWishlistItems().filter((c) => c.id !== card.dataset.courseId));
      card.remove();
      isloh_recountWishlist();
    }

    if (addCartBtn) {
      const course = isloh_getWishlistItems().find((c) => c.id === card.dataset.courseId);
      if (course && typeof isloh_addToCart === 'function') {
        isloh_addToCart(course);
        if (typeof isloh_updateCartBadge === 'function') isloh_updateCartBadge();
        if (typeof isloh_showToast === 'function') isloh_showToast(`"${course.title}" savatga qo'shildi`, 'success');
      }
    }
  });

  isloh_recountWishlist();
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initWishlistToggles();
  isloh_initWishlistList();
  isloh_updateWishlistBadge();
});
