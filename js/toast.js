/* ==========================================================================
   ISLOH — Toast module
   Shows a transient toast using the existing `.toast-demo` visual (see
   css/components.css). Any future page can call:
     isloh_showToast('O'zgarishlar saqlandi', 'success');
   instead of hand-rolling toast markup + a setTimeout.
   ========================================================================== */

function isloh_ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/* Turlar: 'success' (standart), 'error', 'info'.

   'info' keyinroq qo'shildi: ba'zi xabarlar muvaffaqiyat ham, xato ham emas
   — masalan "parol formati to'g'ri, lekin almashtirish backend ulangandan
   keyin saqlanadi". Bunday xabarni yashil belgi bilan ko'rsatish "bajarildi"
   degan yolg'on tasavvur berardi. */
const ISLOH_TOAST_STYLES = {
  success: { icon: 'bi-check-circle-fill', color: 'var(--teach-green)' },
  error:   { icon: 'bi-exclamation-triangle-fill', color: 'var(--danger)' },
  info:    { icon: 'bi-info-circle-fill', color: 'var(--info)' }
};

function isloh_showToast(message, type = 'success', duration = 3500) {
  const container = isloh_ensureToastContainer();
  const style = ISLOH_TOAST_STYLES[type] || ISLOH_TOAST_STYLES.success;

  const toast = document.createElement('div');
  toast.className = 'toast-demo anim-slide-up';
  toast.innerHTML = `<i class="bi ${style.icon} toast-icon" style="color:${style.color};"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}
