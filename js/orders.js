/* ==========================================================================
   ISLOH — Orders module  (Sprint 9)
   Powers pages/student/orders.html. Status filtering + search reuse the
   shared js/filterable.js engine (this file adds nothing for that). This
   module only wires the two order-specific actions that don't fit that
   engine: receipt download (frontend placeholder) and refund request
   (confirmation modal, reusing .modal / js/modal.js).

   Markup contract:
     [data-download-receipt]                → shows a toast placeholder
     [data-refund-request]                  → opens #refund-modal
     #refund-modal [data-refund-confirm]    → closes modal + toast
   ========================================================================== */

function isloh_initOrders() {
  document.body.addEventListener('click', (e) => {
    const receiptBtn = e.target.closest('[data-download-receipt]');
    const refundBtn = e.target.closest('[data-refund-request]');
    const refundConfirm = e.target.closest('[data-refund-confirm]');

    if (receiptBtn) {
      if (typeof isloh_showToast === 'function') {
        isloh_showToast("Kvitansiya yuklab olindi (namuna)", 'success');
      }
    }

    if (refundBtn) {
      if (typeof isloh_openModal === 'function') isloh_openModal('refund-modal');
    }

    if (refundConfirm) {
      if (typeof isloh_closeModal === 'function') isloh_closeModal('refund-modal');
      if (typeof isloh_showToast === 'function') {
        isloh_showToast("Qaytarish so'rovi yuborildi (namuna)", 'success');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', isloh_initOrders);
