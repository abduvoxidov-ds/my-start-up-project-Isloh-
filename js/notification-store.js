/* ==========================================================================
   ISLOH — Bildirishnomalar do'koni

   `isloh_notifications` — bildirishnomalar ro'yxati va ularning o'qildi /
   o'qilmadi holati. Sahifasi: pages/instructor/notifications.html
   (ro'yxatni js/notifications.js chizadi).

   NEGA BU FAYL BOR: bildirishnomalar sahifasidagi qatorlar HTML ichida
   qo'lda yozilgan edi va sahifada bironta hodisa yo'q edi — qatorni bosish
   ham, o'qilgan deb belgilash ham ishlamasdi (js/notifications.js mavjud,
   lekin hech bir sahifaga ULANMAGAN edi). Topbar'dagi qizil nuqta esa
   markupdagi qattiq yozilgan `<span class="dot">` — u hech qachon
   o'chmasdi: hamma narsani o'qib chiqsangiz ham "yangilik bor" deb
   turaverardi.

   Endi holat do'konda: o'qilgan deb belgilash F5 dan keyin ham qoladi va
   nuqta o'qilmaganlar sonidan HISOBLANADI.

   Naqsh js/assignment-store.js bilan bir xil: sxema + demo seed + qisman
   yangilash + `isloh:notifications-updated` hodisasi. fetch() ishlatilmaydi
   (CLAUDE.md §3).

   Do'kon ROL bo'yicha ajratilgan (`role` maydoni): bitta kalitda uchala
   rolning bildirishnomalari yashaydi, sahifa esa faqat o'zinikini so'raydi.
   Hozircha demo ma'lumot faqat o'qituvchi uchun ekilgan — talaba va admin
   sahifalari o'z bosqichida ulanadi.
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

function isloh_ntReadJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function isloh_ntWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/* Sahifa roli sidebar'dan (js/chat-store.js va js/profile.js dagi bir xil
   naqsh) — bu modul profile.js siz sahifalarda ham ishlashi kerak. */
function isloh_notifRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  const role = aside ? aside.dataset.role : '';
  return role || 'student';
}

function isloh_normalizeNotification(notification) {
  return Object.assign({}, ISLOH_NOTIFICATION_DEFAULTS, notification || {});
}

function isloh_notifTypeMeta(type) {
  return ISLOH_NOTIF_TYPES[type] || ISLOH_NOTIF_TYPES.system;
}

/* Butun do'kon (barcha rollar). Sahifalar odatda isloh_getNotifications()
   ni ishlatadi — u faqat joriy rolnikini beradi. */
function isloh_getAllNotifications() {
  const stored = isloh_ntReadJson(ISLOH_NOTIFICATIONS_KEY);
  if (Array.isArray(stored)) return stored.map(isloh_normalizeNotification);

  const seed = isloh_notificationSeed().map(isloh_normalizeNotification);
  isloh_ntWriteJson(ISLOH_NOTIFICATIONS_KEY, seed);
  return seed;
}

/* Joriy rolning bildirishnomalari, eng yangisi tepada. */
function isloh_getNotifications(role) {
  const target = role || isloh_notifRole();
  return isloh_getAllNotifications()
    .filter((n) => n.role === target)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function isloh_commitNotifications(list) {
  if (!isloh_ntWriteJson(ISLOH_NOTIFICATIONS_KEY, list)) return false;
  document.dispatchEvent(new CustomEvent('isloh:notifications-updated', { detail: list }));
  return true;
}

/* --- Amallar -------------------------------------------------------------- */

function isloh_markNotificationRead(id, read) {
  const list = isloh_getAllNotifications();
  const index = list.findIndex((n) => n.id === id);
  if (index === -1) return false;

  list[index] = Object.assign({}, list[index], { read: read === undefined ? true : Boolean(read) });
  return isloh_commitNotifications(list);
}

/* Faqat JORIY rolning yozuvlari belgilanadi — o'qituvchi "barchasini
   o'qildi" desa, talabaning bildirishnomalari tegilmasin. */
function isloh_markAllNotificationsRead(role) {
  const target = role || isloh_notifRole();
  const list = isloh_getAllNotifications()
    .map((n) => (n.role === target ? Object.assign({}, n, { read: true }) : n));
  return isloh_commitNotifications(list);
}

function isloh_deleteNotification(id) {
  return isloh_commitNotifications(isloh_getAllNotifications().filter((n) => n.id !== id));
}

/* Do'konga yangi bildirishnoma qo'shish — voqealarni backend yuboradi
   (CLAUDE.md §4), shu sababli hozircha faqat API sifatida turadi. */
function isloh_addNotification(patch) {
  const list = isloh_getAllNotifications();
  const notification = isloh_normalizeNotification(patch);
  notification.id = notification.id || 'nt-' + Date.now();
  notification.createdAt = notification.createdAt || new Date().toISOString();
  list.push(notification);
  return isloh_commitNotifications(list) ? notification : null;
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
function isloh_renderNotifBadge() {
  const dots = document.querySelectorAll('.topbar-actions .icon-btn .dot');
  if (!dots.length) return;

  const unread = isloh_notifUnreadCount();
  dots.forEach((dot) => { dot.style.display = unread ? '' : 'none'; });
}

document.addEventListener('isloh:notifications-updated', isloh_renderNotifBadge);
document.addEventListener('DOMContentLoaded', isloh_renderNotifBadge);

/* Boshqa tabda o'qilgan bo'lsa nuqta bu tabda ham o'chsin. */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_NOTIFICATIONS_KEY) isloh_renderNotifBadge();
});
