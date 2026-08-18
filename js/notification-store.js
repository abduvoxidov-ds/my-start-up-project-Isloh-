/* ==========================================================================
   ISLOH — Bildirishnomalar do'koni

   NEGA BU FAYL BOR: bildirishnomalar sahifasidagi qatorlar HTML ichida
   qo'lda yozilgan edi va sahifada bironta hodisa yo'q edi — qatorni bosish
   ham, o'qilgan deb belgilash ham ishlamasdi (js/notifications.js mavjud,
   lekin hech bir sahifaga ULANMAGAN edi). Topbar'dagi qizil nuqta esa
   markupdagi qattiq yozilgan `<span class="dot">` — u hech qachon
   o'chmasdi: hamma narsani o'qib chiqsangiz ham "yangilik bor" deb
   turaverardi.

   M7 (backend): manba endi `/notifications`, `isloh_notifications` esa
   OFFLINE NUSXA. Do'kon umumiy fabrikaga (`isloh_createStoreCache`)
   o'tkazildi.

   ROL BO'YICHA AJRATISH SAQLANDI. Serverda ham `role` maydoni bor va sabab
   bir xil: bitta odam ham talaba, ham o'qituvchi bo'lishi mumkin, ikkala
   oqim aralashmasligi kerak. Filtrlash MIJOZDA bo'ladi — ro'yxat baribir
   yuklanadi va serverga rol bo'yicha ikkinchi so'rov yuborish keraksiz.

   O'QILMAGANLAR SONI ALOHIDA ENDPOINT'DAN. Qizil nuqta HAR BIR sahifada
   ko'rinadi, ro'yxat esa faqat ikkitasida kerak. Butun ro'yxatni bitta son
   uchun yuklash isrof bo'lardi, shuning uchun nuqta
   `/notifications/unread-count` ga boradi va do'kon YUKLANMAYDI.
   ========================================================================== */

const ISLOH_NOTIFICATIONS_KEY = 'isloh_notifications';

/* Bildirishnoma turi → belgi va rang. Yorliq matni ham, ikonka ham shu
   jadvalda: yangi tur qo'shilsa faqat shu yerga qo'shiladi. */
const ISLOH_NOTIF_TYPES = {
  enrollment: { icon: 'bi-person-plus-fill',       tint: 'tint-green' },
  submission: { icon: 'bi-file-earmark-check-fill', tint: 'tint-violet' },
  payment:    { icon: 'bi-cash-stack',              tint: 'tint-green' },
  review:     { icon: 'bi-star-fill',               tint: 'tint-warning' },
  course:     { icon: 'bi-journal-check',           tint: 'tint-green' },
  message:    { icon: 'bi-chat-dots-fill',          tint: 'tint-violet' },
  system:     { icon: 'bi-info-circle-fill',        tint: 'tint-muted' }
};

const ISLOH_NOTIFICATION_DEFAULTS = {
  id: '',
  role: 'instructor',   // student | instructor | admin
  type: 'system',
  title: '',
  desc: '',
  href: '',             // shu rol papkasidagi sahifaga nisbiy havola
  read: false,
  createdAt: ''         // ISO
};

/* --- Demo ma'lumot --------------------------------------------------------
   Vaqtlar bugundan nisbatan (js/assignment-store.js dagi bilan bir xil
   sabab: "10 daqiqa oldin" qat'iy sana bilan bir haftadan keyin kulgili
   ko'rinardi).

   Matnlar boshqa do'konlardagi HAQIQIY yozuvlarga ishora qiladi (Javohir
   topshirgan ish js/assignment-store.js da, Bekzodning 5 ★ sharhi
   js/review-store.js da bor) — bildirishnoma bosilganda ochiladigan
   sahifada aynan o'sha yozuv turadi.                                       */

function isloh_ntMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function isloh_notificationSeed() {
  return [
    {
      id: 'nt-1', role: 'instructor', type: 'enrollment', read: false,
      title: "Yangi talaba ro'yxatga olindi",
      desc: 'Sardor Aliyev "Python Backend" kursiga yozildi',
      href: 'students.html', createdAt: isloh_ntMinutesAgo(10)
    },
    {
      id: 'nt-2', role: 'instructor', type: 'submission', read: false,
      title: 'Yangi topshiriq topshirildi',
      desc: 'Javohir Rasimov "REST API endpointlari" topshirig\'ini yubordi',
      href: 'assignments.html', createdAt: isloh_ntMinutesAgo(60)
    },
    {
      id: 'nt-3', role: 'instructor', type: 'payment', read: true,
      title: "Yangi to'lov qabul qilindi",
      desc: '"Python Backend" kursi sotildi — +$45.00',
      href: 'revenue.html', createdAt: isloh_ntMinutesAgo(120)
    },
    {
      id: 'nt-4', role: 'instructor', type: 'review', read: true,
      title: 'Yangi sharh qoldirildi',
      desc: 'Bekzod Odilov 5 ★ sharh qoldirdi',
      href: 'reviews.html', createdAt: isloh_ntMinutesAgo(240)
    },
    {
      id: 'nt-5', role: 'instructor', type: 'course', read: true,
      title: "Kurs tekshiruvdan o'tdi",
      desc: '"Django REST Masterclass" nashr etishga tayyor',
      href: 'courses.html', createdAt: isloh_ntMinutesAgo(2880)
    }
  ];
}

/* --- Do'kon --------------------------------------------------------------- */

/* Sahifa roli sidebar'dan (js/chat-store.js va js/profile.js dagi bir xil
   naqsh) — bu modul profile.js siz sahifalarda ham ishlashi kerak. */
function isloh_notifRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  const role = aside ? aside.dataset.role : '';
  return role || 'student';
}

/* Serverdagi shakl snake_case va `read` — mantiqiy qiymat (u yerda
   `read_at` vaqt belgisidan hisoblanadi, sabab apps/notifications/models.py
   da). Ikkalasi FAQAT shu funksiyada uchrashadi. */
function isloh_isServerNotification(row) {
  return row && (('created_at' in row) || ('actor_name' in row));
}

function isloh_fromServerNotification(row) {
  return {
    id: row.id,
    role: row.role,
    type: row.type,
    title: row.title || '',
    desc: row.body || '',
    href: row.href || '',
    read: !!row.read,
    createdAt: row.created_at || ''
  };
}

function isloh_normalizeNotification(notification) {
  const source = isloh_isServerNotification(notification)
    ? isloh_fromServerNotification(notification)
    : (notification || {});
  return Object.assign({}, ISLOH_NOTIFICATION_DEFAULTS, source);
}

function isloh_notifTypeMeta(type) {
  return ISLOH_NOTIF_TYPES[type] || ISLOH_NOTIF_TYPES.system;
}

const ISLOH_NOTIFICATION_CACHE = isloh_createStoreCache({
  key: ISLOH_NOTIFICATIONS_KEY,
  endpoint: '/notifications',
  event: 'isloh:notifications-updated',
  normalize: isloh_normalizeNotification,
  seed: isloh_notificationSeed
});

function isloh_loadNotifications() { return ISLOH_NOTIFICATION_CACHE.load(); }

/* Butun do'kon (barcha rollar). Sahifalar odatda isloh_getNotifications()
   ni ishlatadi — u faqat joriy rolnikini beradi. */
function isloh_getAllNotifications() { return ISLOH_NOTIFICATION_CACHE.get(); }

/* Joriy rolning bildirishnomalari, eng yangisi tepada. */
function isloh_getNotifications(role) {
  const target = role || isloh_notifRole();
  return isloh_getAllNotifications()
    .filter((n) => n.role === target)
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function isloh_emitNotifications(list) {
  document.dispatchEvent(new CustomEvent('isloh:notifications-updated', { detail: list }));
}

/* --- Amallar --------------------------------------------------------------
   "O'qilgan" do'kon fabrikasining `PUT` yo'li bilan YUBORILMAYDI: fabrika
   butun obyektni yuborardi, serverda esa bildirishnomaning hamma maydoni
   `read_only` (uni voqealar yasaydi, mijoz emas). Shuning uchun bu amal
   o'z endpoint'iga boradi — js/review-store.js dagi javob bilan bir xil
   naqsh: optimistik o'zgarish + xatoda ortga qaytarish.                    */

function isloh_markNotificationRead(id, read) {
  const list = isloh_getAllNotifications();
  const index = list.findIndex((n) => n.id === id);
  if (index === -1) return false;

  // Faqat o'qilmagandan o'qilganga; serverda teskari amal yo'q
  if (read === false || list[index].read) return true;

  list[index] = Object.assign({}, list[index], { read: true });
  isloh_emitNotifications(list);

  islohApi.post('/notifications/' + id + '/read', {}).catch((err) => {
    const at = isloh_getAllNotifications().findIndex((n) => n.id === id);
    if (at !== -1) isloh_getAllNotifications()[at].read = false;
    isloh_emitNotifications(isloh_getAllNotifications());
    if (typeof islohUI !== 'undefined') islohUI.toast(err.error || "Saqlab bo'lmadi", 'error');
  });
  return true;
}

/* Faqat JORIY rolning yozuvlari belgilanadi — o'qituvchi "barchasini
   o'qildi" desa, o'sha odamning TALABA oqimidagi xabarlari tegilmasin
   (serverda ham xuddi shu qoida). */
function isloh_markAllNotificationsRead(role) {
  const target = role || isloh_notifRole();
  const list = isloh_getAllNotifications();
  const previous = list.filter((n) => n.role === target && !n.read).map((n) => n.id);
  if (!previous.length) return true;

  list.forEach((n) => { if (n.role === target) n.read = true; });
  isloh_emitNotifications(list);

  islohApi.post('/notifications/read-all', {}, { params: { role: target } }).catch((err) => {
    const current = isloh_getAllNotifications();
    previous.forEach((id) => {
      const at = current.findIndex((n) => n.id === id);
      if (at !== -1) current[at].read = false;
    });
    isloh_emitNotifications(current);
    if (typeof islohUI !== 'undefined') islohUI.toast(err.error || "Saqlab bo'lmadi", 'error');
  });
  return true;
}

/* O'chirish fabrikaning o'z yo'li bilan (`DELETE /notifications/{id}`) —
   u optimistik o'chirish va rollback'ni allaqachon bajaradi. */
function isloh_deleteNotification(id) {
  return ISLOH_NOTIFICATION_CACHE.remove(id);
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

function isloh_notifUnreadCount(role) {
  return isloh_getNotifications(role).filter((n) => !n.read).length;
}

/* Bildirishnoma vaqti: "10 daqiqa oldin". Format js/datetime.js zimmasida. */
function isloh_notifTimeLabel(notification) {
  if (!notification || !notification.createdAt) return '';
  return typeof isloh_relativeTime === 'function'
    ? isloh_relativeTime(notification.createdAt)
    : notification.createdAt;
}

/* --- Topbar nuqtasi -------------------------------------------------------
   Qizil nuqta har bir sahifaning markupida turadi, lekin uning KO'RINISHI
   endi do'kondan hisoblanadi. Shu sababli bu modul barcha o'qituvchi
   sahifalariga ulanadi: nuqta faqat bildirishnomalar sahifasida emas,
   hamma joyda to'g'ri ko'rinsin.                                           */
function isloh_showNotifBadge(unread) {
  document.querySelectorAll('.topbar-actions .icon-btn .dot')
    .forEach((dot) => { dot.style.display = unread ? '' : 'none'; });
}

/* Do'kon YUKLANGAN bo'lsa undan, aks holda alohida endpoint'dan.

   Nuqta 60+ sahifada turadi, ro'yxat esa faqat ikkitasida kerak —
   `isloh_getNotifications()` chaqirilsa fabrika butun ro'yxatni tortib
   olardi. `unread-count` bitta son qaytaradi va zaxirasi ham oddiy: xato
   bo'lsa nuqta shunchaki ko'rinmaydi (yolg'on "yangilik bor" dan ko'ra
   yaxshiroq). */
function isloh_renderNotifBadge() {
  const dots = document.querySelectorAll('.topbar-actions .icon-btn .dot');
  if (!dots.length) return;

  if (ISLOH_NOTIFICATION_CACHE.isLoaded()) {
    isloh_showNotifBadge(isloh_notifUnreadCount());
    return;
  }

  islohApi.get('/notifications/unread-count')
    .then((data) => isloh_showNotifBadge((data && data.unread) || 0))
    .catch(() => isloh_showNotifBadge(0));
}

document.addEventListener('isloh:notifications-updated', isloh_renderNotifBadge);
document.addEventListener('DOMContentLoaded', isloh_renderNotifBadge);

/* Boshqa tabda o'qilgan bo'lsa nuqta bu tabda ham o'chsin. */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_NOTIFICATIONS_KEY) isloh_renderNotifBadge();
});
