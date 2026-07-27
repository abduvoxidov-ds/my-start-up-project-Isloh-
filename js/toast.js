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

function isloh_showToast(message, type = 'success', duration = 3500) {
  const container = isloh_ensureToastContainer();
  const icon = type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
  const color = type === 'error' ? 'var(--danger)' : 'var(--teach-green)';

  const toast = document.createElement('div');
  toast.className = 'toast-demo anim-slide-up';
  toast.innerHTML = `<i class="bi ${icon}" style="color:${color}; font-size:18px;"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}
