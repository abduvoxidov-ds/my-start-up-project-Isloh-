/* ==========================================================================
   ISLOH — Bildirishnomalar sahifasi (pages/instructor/notifications.html)

   NEGA O'ZGARDI: bu fayl loyihada bor edi, lekin hech bir sahifaga
   ULANMAGAN edi — ya'ni o'lik kod. Ichidagi mantiq ham faqat DOM ustida
   ishlardi: "o'qilgan deb belgilash" qatorning `data-read` atributini
   o'zgartirardi, xolos — F5 bosilishi bilan hamma narsa qaytib kelardi.
   Endi ro'yxat js/notification-store.js dagi `isloh_notifications`
   do'konidan CHIZILADI va har bir amal o'sha do'konga yoziladi.

   Mehnat taqsimoti:
     DO'KON (o'qish/yozish, o'qilmaganlar soni, topbar nuqtasi)
                              -> js/notification-store.js
     SAHIFA (chizish, tugmalar) -> shu fayl

   Markup shartnomasi:
     [data-notif-list]      → ro'yxat shu yerga chiziladi
     [data-notif-mark-all]  → "Barchasini o'qilgan deb belgilash"
     [data-notif-count="unread|all"] → jonli hisoblagichlar
   Chizilgan har bir qator:
     [data-notif-item][data-notif-id][data-read="true|false"]
       [data-notif-read]    → qatorni o'qilgan deb belgilash
       [data-notif-delete]  → qatorni o'chirish

   ARXIV VA FILTR OLIB TASHLANDI: eski faylda `[data-notif-archive]` va
   qidiruv/filtr bilan ishlaydigan katta blok bor edi, lekin loyihadagi
   birorta sahifada bunday boshqaruv yo'q (bildirishnomalar sahifasi
   ataylab sodda) va arxiv holati hech qayerda saqlanmasdi. Kerak bo'lsa
   do'konga `archived` maydoni qo'shiladi. Filtrli sahifa paydo bo'lsa,
   umumiy js/filterable.js ishlaydi — quyida ro'yxat qayta chizilganda u
   ham yangilanadi.
   ========================================================================== */

/* Bitta qator. Sarlavha havola bo'ladi (bildirishnoma qayerga olib
   borishini do'kondagi `href` aytadi) — ilgari qatorlar hech qayerga
   bog'lanmagan edi. */

/* Havola FAQAT shu rol papkasidagi sahifaga borishi mumkin.

   Ekranlashning o'zi yetarli emas: `javascript:...` yoki `//boshqa-sayt`
   qiymati ekranlangandan keyin ham ishlaydi. `href` serverdan keladi va
   hozir uni voqealar yozadi, lekin bu qiymat baza orqali o'tadi — ya'ni
   kelajakda uni boshqa yo'l bilan to'ldirish mumkin bo'lsa, tekshiruv shu
   yerda turgani ma'qul. Ruxsat etilgani — oddiy fayl nomi. */
const ISLOH_NOTIF_HREF = /^[a-z0-9._-]+\.html(\?[a-z0-9=&_.%-]*)?$/i;

function isloh_notifHref(href) {
  const value = String(href || '').trim();
  return ISLOH_NOTIF_HREF.test(value) ? value : '';
}
/* M7 — MATN EKRANLANADI (js/escape.js).

   Bildirishnoma matnini server yozadi, LEKIN uning ichida boshqa
   foydalanuvchining ismi va kurs nomi bor ("Sardor Aliyev ... kursiga
   yozildi"). Ya'ni bu ham begona matn va M6 dagi qoida shu yerga ham
   tegishli. `href` alohida: u ATRIBUT ichiga tushadi va faqat mahalliy
   sahifaga ishora qilishi kerak — `isloh_notifHref` shuni tekshiradi. */
function isloh_notifRowHtml(notification) {
  const meta = isloh_notifTypeMeta(notification.type);
  const href = isloh_notifHref(notification.href);
  const safeTitle = isloh_escapeHtml(notification.title);
  const title = href
    ? `<a class="text-inherit" href="${isloh_escapeAttr(href)}">${safeTitle}</a>`
    : safeTitle;

  return `<div class="notif-row${notification.read ? '' : ' unread'}" data-notif-item
       data-notif-id="${isloh_escapeAttr(notification.id)}" data-read="${notification.read}">
    <div class="notif-icon ${meta.tint}"><i class="bi ${meta.icon}"></i></div>
    <div>
      <div class="notif-title">${title}</div>
      <div class="notif-desc">${isloh_escapeHtml(notification.desc)}</div>
    </div>
    <div class="notif-time">${isloh_escapeHtml(isloh_notifTimeLabel(notification))}</div>
    <div class="notif-actions">
      ${notification.read ? '' : '<button type="button" class="notif-action-btn" data-notif-read aria-label="O\'qilgan deb belgilash"><i class="bi bi-check2"></i></button>'}
      <button type="button" class="notif-action-btn del" data-notif-delete aria-label="O'chirish"><i class="bi bi-trash"></i></button>
    </div>
  </div>`;
}

function isloh_renderNotifications() {
  const mount = document.querySelector('[data-notif-list]');
  if (!mount) return; // bu sahifa emas — no-op

  const list = isloh_getNotifications();
  mount.innerHTML = list.length
    ? list.map(isloh_notifRowHtml).join('')
    : `<div class="empty-state">
         <div class="empty-icon"><i class="bi bi-bell-slash"></i></div>
         <div class="empty-title">Bildirishnoma yo'q</div>
         <div class="empty-sub">Yangi voqealar shu yerda ko'rinadi.</div>
       </div>`;

  /* Hisoblagichlar ro'yxatdan HISOBLANADI, markupga yozilmaydi. */
  const unread = list.filter((n) => !n.read).length;
  document.querySelectorAll('[data-notif-count="unread"]').forEach((el) => { el.textContent = unread; });
  document.querySelectorAll('[data-notif-count="all"]').forEach((el) => { el.textContent = list.length; });

  /* "Barchasini o'qilgan deb belgilash" o'qilmagan qolmaganda ma'nosiz. */
  const markAll = document.querySelector('[data-notif-mark-all]');
  if (markAll) markAll.disabled = unread === 0;

  /* Filtrli sahifada (kelajakda) ro'yxat qayta chizilgach filtr holati ham
     qayta hisoblansin — js/instructor-courses.js dagi bir xil naqsh. */
  const scope = document.querySelector('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

function isloh_initNotifications() {
  const mount = document.querySelector('[data-notif-list]');
  if (!mount) return;

  isloh_renderNotifications();

  /* Hodisa delegatsiyasi: qatorlar qayta chizilgani uchun har biriga
     alohida tinglovchi bog'lash noto'g'ri bo'lardi. */
  mount.addEventListener('click', (e) => {
    const row = e.target.closest('[data-notif-item]');
    if (!row) return;
    const id = row.dataset.notifId;

    if (e.target.closest('[data-notif-delete]')) {
      e.preventDefault();
      isloh_deleteNotification(id);
      if (typeof isloh_showToast === 'function') isloh_showToast("Bildirishnoma o'chirildi", 'info');
      return;
    }

    /* Qatorning istalgan joyini bosish ham o'qilgan deb belgilaydi —
       sarlavha havolasi bosilsa, belgilash navigatsiyadan oldin ulguradi. */
    if (row.dataset.read !== 'true') isloh_markNotificationRead(id, true);
  });

  const markAll = document.querySelector('[data-notif-mark-all]');
  if (markAll) {
    markAll.addEventListener('click', () => {
      isloh_markAllNotificationsRead();
      if (typeof isloh_showToast === 'function') isloh_showToast("Barchasi o'qilgan deb belgilandi", 'success');
    });
  }
}

/* Do'kon o'zgarsa ro'yxat ham, hisoblagichlar ham qayta chiziladi (topbar
   nuqtasini js/notification-store.js o'zi yangilaydi). */
document.addEventListener('isloh:notifications-updated', isloh_renderNotifications);
document.addEventListener('DOMContentLoaded', isloh_initNotifications);
