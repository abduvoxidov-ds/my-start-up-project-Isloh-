/* ==========================================================================
   ISLOH — Admin Marketplace Management module  (Sprint 9)
   Powers pages/admin/admin-marketplace.html. Categories/Featured/Collections
   reuse .chip, .card, .switch as static/visual-toggle markup with no extra
   JS needed. This file wires the two list actions: removing a coupon and
   activating/deactivating a promotional banner.

   Markup contract:
     [data-coupon-item]  [data-coupon-remove]
     [data-banner-item]  [data-banner-toggle]  (button, flips label + badge)
   ========================================================================== */

function isloh_initAdminMarketplace() {
  document.body.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-coupon-remove]');
    const bannerBtn = e.target.closest('[data-banner-toggle]');

    if (removeBtn) {
      removeBtn.closest('[data-coupon-item]')?.remove();
      if (typeof isloh_showToast === 'function') isloh_showToast("Kupon o'chirildi", 'success');
    }

    if (bannerBtn) {
      const item = bannerBtn.closest('[data-banner-item]');
      const badge = item?.querySelector('[data-banner-status]');
      const isActive = badge?.classList.contains('badge-green');
      if (badge) {
        badge.classList.toggle('badge-green', !isActive);
        badge.classList.toggle('badge-neutral', isActive);
        badge.textContent = isActive ? "Nofaol" : 'Faol';
      }
      bannerBtn.textContent = isActive ? 'Faollashtirish' : "O'chirish";
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(isActive ? 'Banner nofaol qilindi' : 'Banner faollashtirildi', 'success');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initAdminMarketplace);
