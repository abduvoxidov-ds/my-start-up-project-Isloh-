/* ==========================================================================
   ISLOH — Wishlist module  (Sprint 9)
   Two responsibilities, both frontend-only (in-DOM, nothing persisted):
     1) Generic heart toggle — any [data-wishlist-toggle] button (reuses the
        existing .fav-toggle visual from css/widgets.css) flips .active and
        its icon class. Works on Marketplace cards and course cards alike.
     2) Dedicated pages/student/wishlist.html list — remove item + empty
        state + count, same shape as js/bookmarks.js.

   Markup contract:
     button[data-wishlist-toggle]                → any card's heart icon
     [data-wishlist-list]                        → wishlist.html grid
       [data-wishlist-item]                      → one card
         [data-wishlist-remove]                  → removes the card
     [data-wishlist-count]                       → topbar badge
     [data-wishlist-empty]                       → shown when list is empty
   ========================================================================== */

function isloh_recountWishlist() {
  const items = document.querySelectorAll('[data-wishlist-item]');
  document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
    el.textContent = items.length;
    el.classList.toggle('badge-empty', items.length === 0);
  });
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
    toggle.classList.toggle('active');
    const icon = toggle.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-heart');
      icon.classList.toggle('bi-heart-fill');
    }
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(
        toggle.classList.contains('active') ? "Xohishlar ro'yxatiga qo'shildi" : "Xohishlar ro'yxatidan olib tashlandi",
        'success'
      );
    }
  });
}

function isloh_initWishlistList() {
  const list = document.querySelector('[data-wishlist-list]');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-wishlist-remove]');
    if (!removeBtn) return;
    removeBtn.closest('[data-wishlist-item]')?.remove();
    isloh_recountWishlist();
  });
  isloh_recountWishlist();
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initWishlistToggles();
  isloh_initWishlistList();
});
