/* ==========================================================================
   ISLOH — Orders module
   pages/student/orders.html sahifasini boshqaradi.

   Buyurtmalar HTML ichida yozilmaydi: ro'yxat js/marketplace.js dagi
   `isloh_orders` do'konidan render qilinadi — checkout tasdiqlangan zahoti
   yangi buyurtma shu yerda paydo bo'ladi va Marketplace'dagi "Xaridlar
   tarixi" bloki bilan hech qachon zid bo'lmaydi (ikkalasi bitta manba).

   Status filtri va qidiruv js/filterable.js dvigateliga tayanadi.

   Markup shartnomasi:
     [data-orders-list]                     → ro'yxat konteyneri
     [data-orders-sort]                     → saralash <select>
     [data-download-receipt]                → kvitansiyani yuklab beradi
     [data-refund-request]                  → #refund-modal ni ochadi
     #refund-modal [data-refund-confirm]    → so'rovni yozadi
     [data-refund-order] / [data-refund-total] → modaldagi buyurtma ma'lumoti
   Ikkala buyurtma tugmasi ham `data-order-id` olib yuradi — amal qaysi
   buyurtmaga tegishli ekani shundan aniqlanadi.
   ========================================================================== */

const ISLOH_ORDER_SORTS = {
  newest: (a, b) => (a.date === b.date ? Number(b.id) - Number(a.id) : (a.date < b.date ? 1 : -1)),
  oldest: (a, b) => (a.date === b.date ? Number(a.id) - Number(b.id) : (a.date > b.date ? 1 : -1)),
  'amount-desc': (a, b) => isloh_orderTotal(b) - isloh_orderTotal(a),
  'amount-asc': (a, b) => isloh_orderTotal(a) - isloh_orderTotal(b)
};

/* --- Kartochka HTML ------------------------------------------------------ */

/* Kurs nomi katalogda bor bo'lsa havolaga aylanadi — buyurtmadan to'g'ridan
   to'g'ri kurs sahifasiga o'tish mumkin. To'plamlar (bundle) katalogda yo'q,
   ular oddiy matn bo'lib qoladi. */
function isloh_orderItemTitleHtml(item) {
  const course = typeof isloh_findCourseById === 'function' ? isloh_findCourseById(item.id) : null;
  if (!course) return `<div class="order-item-title">${item.title}</div>`;
  return `<a class="order-item-title order-item-link" href="${isloh_courseLinkHref(course)}">${item.title}</a>`;
}

function isloh_orderItemHtml(item, status) {
  const refunded = status === 'refunded';
  const price = `${refunded ? '−' : ''}${isloh_formatSom(item.price || 0)} so'm`;
  return `
    <div class="order-card-row">
      <div class="oc-cover" style="background:${item.cover};"><i class="${item.icon}"></i></div>
      ${isloh_orderItemTitleHtml(item)}
      <span class="order-item-price${refunded ? ' is-refund' : ''}">${price}</span>
    </div>`;
}

/* Pastki qator har doim summa bilan boshlanadi (ilgari qaytarilgan
   buyurtmada "Jami" umuman yo'q edi), keyin statusga mos amal yoki izoh. */
function isloh_orderFootHtml(order) {
  const sum = isloh_formatSom(isloh_orderTotal(order)) + " so'm";
  const label = order.status === 'refunded' ? `Qaytarilgan: ${sum}` : `Jami: ${sum}`;
  const total = `<span class="order-card-total">${label}</span>`;
  const receipt = `<button class="btn btn-outline btn-sm" data-download-receipt data-order-id="${order.id}"><i class="bi bi-download"></i> Kvitansiya</button>`;

  if (order.status === 'pending') {
    return `${total}<span class="order-card-note">Bank tasdig'i kutilmoqda</span>`;
  }
  if (order.status === 'refund_pending') {
    return `${total}
      <div class="order-card-actions">
        <span class="order-card-note">Qaytarish so'rovi ko'rib chiqilmoqda</span>
        ${receipt}
      </div>`;
  }
  if (order.status === 'refunded') {
    return `${total}<div class="order-card-actions">${receipt}</div>`;
  }
  return `${total}
    <div class="order-card-actions">
      ${receipt}
      <button class="btn btn-outline btn-sm" data-refund-request data-order-id="${order.id}"><i class="bi bi-arrow-counterclockwise"></i> Qaytarish</button>
    </div>`;
}

/* Qidiruv matni: buyurtma raqami + barcha kurs nomlari — shunda "Backend"
   deb qidirilganda ham buyurtma topiladi. */
function isloh_orderSearchText(order) {
  return [order.id]
    .concat(order.items.map((item) => item.title))
    .join(' ')
    .replace(/"/g, '&quot;');
}

function isloh_orderCardHtml(order) {
  return `
    <div class="card order-card" data-filter-item data-status="${order.status}" data-filter-text="${isloh_orderSearchText(order)}">
      <div class="order-card-head">
        <div>
          <div class="order-card-id">Buyurtma #${order.id}</div>
          <div class="order-card-date">${isloh_formatOrderDate(order.date)}</div>
        </div>
        <span class="badge ${ISLOH_ORDER_STATUS_BADGE[order.status]}">${ISLOH_ORDER_STATUS_LABEL[order.status]}</span>
      </div>
      ${order.items.map((item) => isloh_orderItemHtml(item, order.status)).join('')}
      <div class="order-card-foot">${isloh_orderFootHtml(order)}</div>
    </div>`;
}

function isloh_renderOrders() {
  const list = document.querySelector('[data-orders-list]');
  if (!list || typeof isloh_getOrders !== 'function') return;

  const mode = document.querySelector('[data-orders-sort]')?.value || 'newest';
  const orders = isloh_getOrders().sort(ISLOH_ORDER_SORTS[mode] || ISLOH_ORDER_SORTS.newest);
  list.innerHTML = orders.map(isloh_orderCardHtml).join('');

  /* Ro'yxat dinamik chizilgani uchun joriy filtr va qidiruv qayta qo'llanadi —
     bo'sh holat ham shu yerda hisoblanadi (js/filterable.js). */
  const scope = list.closest('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Kvitansiya ----------------------------------------------------------
   Server yo'q, shuning uchun kvitansiya brauzerning o'zida matn fayl sifatida
   yig'iladi va Blob orqali yuklab beriladi — `file://` ostida ham ishlaydi
   (CLAUDE.md §3: fetch ishlatilmaydi). Ilgari tugma faqat "yuklab olindi"
   deb toast chiqarardi, aslida hech narsa yuklanmasdi. */
function isloh_buildReceiptText(order) {
  const line = '------------------------------------------------';
  const rows = order.items
    .map((item) => `  ${item.title} — ${isloh_formatSom(item.price || 0)} so'm`)
    .join('\n');

  return [
    'ISLOH — KVITANSIYA',
    line,
    `Buyurtma:  #${order.id}`,
    `Sana:      ${isloh_formatOrderDate(order.date)}`,
    `Holat:     ${ISLOH_ORDER_STATUS_LABEL[order.status]}`,
    line,
    rows,
    line,
    `JAMI:      ${isloh_formatSom(isloh_orderTotal(order))} so'm`,
    '',
    'Xaridingiz uchun rahmat!'
  ].join('\n');
}

function isloh_downloadReceipt(order) {
  const blob = new Blob([isloh_buildReceiptText(order)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `isloh-kvitansiya-${order.id}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Brauzer faylni o'qib ulgurishi uchun havola keyinroq bo'shatiladi
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- Qaytarish so'rovi ---------------------------------------------------
   Modal endi qaysi buyurtma ekanini biladi va tasdiqlangach holat
   `refund_pending` ga o'tib do'konga saqlanadi — sahifa yangilansa ham
   so'rov joyida qoladi. */
let isloh_refundOrderId = null;

function isloh_openRefundModal(orderId) {
  const order = isloh_findOrderById(orderId);
  if (!order) return;

  isloh_refundOrderId = order.id;
  document.querySelectorAll('[data-refund-order]').forEach((el) => { el.textContent = '#' + order.id; });
  document.querySelectorAll('[data-refund-total]').forEach((el) => {
    el.textContent = isloh_formatSom(isloh_orderTotal(order)) + " so'm";
  });
  if (typeof isloh_openModal === 'function') isloh_openModal('refund-modal');
}

function isloh_confirmRefund() {
  if (typeof isloh_closeModal === 'function') isloh_closeModal('refund-modal');
  if (!isloh_refundOrderId) return;

  const order = isloh_setOrderStatus(isloh_refundOrderId, 'refund_pending');
  isloh_refundOrderId = null;
  if (!order) return;

  isloh_renderOrders();
  if (typeof isloh_showToast === 'function') {
    isloh_showToast(`#${order.id} uchun qaytarish so'rovi yuborildi`, 'success');
  }
}

/* --- Ishga tushirish ----------------------------------------------------- */
function isloh_initOrders() {
  isloh_renderOrders();

  const sort = document.querySelector('[data-orders-sort]');
  if (sort) sort.addEventListener('change', isloh_renderOrders);

  document.body.addEventListener('click', (e) => {
    const receiptBtn = e.target.closest('[data-download-receipt]');
    const refundBtn = e.target.closest('[data-refund-request]');
    const refundConfirm = e.target.closest('[data-refund-confirm]');

    if (receiptBtn) {
      const order = isloh_findOrderById(receiptBtn.dataset.orderId);
      if (order) {
        isloh_downloadReceipt(order);
        if (typeof isloh_showToast === 'function') {
          isloh_showToast(`#${order.id} kvitansiyasi yuklab olindi`, 'success');
        }
      }
    }

    if (refundBtn) isloh_openRefundModal(refundBtn.dataset.orderId);
    if (refundConfirm) isloh_confirmRefund();
  });
}

document.addEventListener('DOMContentLoaded', isloh_initOrders);
