/* ==========================================================================
   ISLOH — Sana va vaqt formatlagichi  (Sprint 7B)

   Nima uchun kerak bo'ldi: sozlamalardagi "Vaqt mintaqasi" (lang_tz) va
   "Interfeys tili" (lang_ui) saqlanardi, lekin hech narsaga ta'sir qilmasdi.
   Sababi — markazlashgan formatlagich yo'q edi: sanalar 7 xil modulda o'z
   helperi bilan, `getHours()`/`getMonth()` orqali BRAUZERNING mahalliy
   mintaqasida chiqarilardi. Foydalanuvchi Moskvani tanlasa ham vaqt o'z
   qurilmasining mintaqasida ko'rinardi.

   Endi shu modul yagona manba: mintaqa, til va oy nomlari faqat shu yerda.
   Eski helperlar (isloh_formatNoteDate, isloh_chatBubbleTime, ...) saqlanib
   qoldi — ular endi shu modulga murojaat qiladi, shuning uchun chaqiruv
   joylari o'zgarmadi.

   --- Muhim: "kalendar sanasi" va "moment" farqi -------------------------
   `'2026-08-10'` — kalendar sanasi: unda vaqt yo'q, demak mintaqa ham
   qo'llanmaydi. `new Date('2026-08-10')` esa uni UTC yarim kechasi deb
   o'qiydi, so'ng `getDate()` mahalliy mintaqaga o'giradi — UTC'dan g'arbdagi
   foydalanuvchida bu 9-avgustni ko'rsatib qo'yadi (bir kunlik xato, loyihada
   ilgari mavjud edi). Shu sababli kalendar sanalari satrdan to'g'ridan-to'g'ri
   o'qiladi, Date ham, mintaqa ham ishlatilmaydi.

   `'2026-08-10T14:30:00Z'` — moment: mana bunda mintaqa ma'noli.

   ESLATMA: `isloh_todayISO()` (js/course-store.js, js/tasks.js) va kalendar
   panjarasi ataylab tegilmadi — ular ko'rsatish uchun emas, MAHALLIY kalendar
   kunini kalit sifatida ishlatadi.
   ========================================================================== */

const ISLOH_DT_SETTINGS_KEY = 'isloh_settings';

/* Sozlamadagi qiymat -> IANA mintaqa nomi. Sozlamalar sahifasida faqat shu
   ikki variant bor; yangi variant qo'shilsa shu jadvalga ham qo'shiladi. */
const ISLOH_DT_ZONES = {
  'GMT+5': 'Asia/Tashkent',
  'GMT+3': 'Europe/Moscow'
};

const ISLOH_DT_LOCALES = { uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU' };

/* Oy nomlari. O'zbekcha ataylab qo'lda: loyihaning matnlari "2026-yil
   10-avgust" ko'rinishida yozilgan va `Intl` uz-UZ uchun boshqacha shakl
   beradi — dizayndagi matnni o'zgartirmaslik uchun o'z jadvalimiz.
   Ingliz va rus uchun `Intl` ishlatiladi (pastdagi funksiyalarga qara). */
const ISLOH_DT_MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const ISLOH_DT_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/* --- Sozlamalarni o'qish --------------------------------------------------
   js/settings-store.js faqat sozlamalar sahifasida ulangan, shuning uchun
   do'kon bo'lmasa localStorage to'g'ridan-to'g'ri o'qiladi (js/theme.js dagi
   bir xil naqsh).                                                          */

function isloh_dtPrefs() {
  if (typeof isloh_getSettings === 'function') return isloh_getSettings();
  try { return JSON.parse(localStorage.getItem(ISLOH_DT_SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}

function isloh_dtTimeZone() {
  return ISLOH_DT_ZONES[isloh_dtPrefs().lang_tz] || null;
}

function isloh_dtLocale() {
  return ISLOH_DT_LOCALES[isloh_dtPrefs().lang_ui] || ISLOH_DT_LOCALES.uz;
}

function isloh_dtIsUzbek() {
  return isloh_dtLocale() === ISLOH_DT_LOCALES.uz;
}

/* --- Sanani qismlarga ajratish -------------------------------------------- */

/* Qaytaradi: { y, mo (0-11), da, h, mi, hasTime } yoki null (yaroqsiz).

   Kalendar sanasi (`YYYY-MM-DD`) satrdan o'qiladi — Date ham, mintaqa ham
   ishlatilmaydi (yuqoridagi izohga qara). Moment esa tanlangan mintaqada
   hisoblanadi: `Intl.DateTimeFormat.formatToParts` buni `getHours()` dan
   farqli ravishda to'g'ri bajaradi. */
function isloh_dtParts(value) {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value);
  if (ISLOH_DT_DATE_ONLY.test(raw)) {
    const [y, mo, da] = raw.split('-').map(Number);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    return { y: y, mo: mo - 1, da: da, h: 0, mi: 0, hasTime: false };
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  const zone = isloh_dtTimeZone();
  if (!zone) {
    return { y: d.getFullYear(), mo: d.getMonth(), da: d.getDate(),
             h: d.getHours(), mi: d.getMinutes(), hasTime: true };
  }

  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).forEach((p) => { parts[p.type] = p.value; });

  return {
    y: Number(parts.year), mo: Number(parts.month) - 1, da: Number(parts.day),
    // Ba'zi muhitlarda hour12:false yarim kechada "24" qaytaradi
    h: Number(parts.hour) % 24, mi: Number(parts.minute), hasTime: true
  };
}

/* Momentni tanlangan mintaqada `Intl` bilan formatlash (uz bo'lmagan tillar
   uchun). Kalendar sanasida mintaqa berilmaydi, aks holda kun surilib
   ketardi — shuning uchun UTC'da o'qiymiz va `timeZone: 'UTC'` beramiz. */
function isloh_dtIntl(value, options) {
  const raw = String(value);
  const dateOnly = ISLOH_DT_DATE_ONLY.test(raw);
  const d = new Date(dateOnly ? raw + 'T00:00:00Z' : value);
  if (isNaN(d.getTime())) return '';

  const zone = dateOnly ? 'UTC' : isloh_dtTimeZone();
  const opts = Object.assign({}, options);
  if (zone) opts.timeZone = zone;

  return new Intl.DateTimeFormat(isloh_dtLocale(), opts).format(d);
}

const isloh_dtPad = (n) => String(n).padStart(2, '0');

/* --- Ommaviy formatlagichlar ---------------------------------------------- */

/* "2026-yil avgust" | "August 2026" | "август 2026" */
function isloh_dtMonthYear(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) return p.y + '-yil ' + ISLOH_DT_MONTHS_UZ[p.mo];
  return isloh_dtIntl(value, { year: 'numeric', month: 'long' });
}

/* "2026-yil 10-avgust" | "August 10, 2026" | "10 августа 2026 г." */
function isloh_dtFullDate(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) return p.y + '-yil ' + p.da + '-' + ISLOH_DT_MONTHS_UZ[p.mo];
  return isloh_dtIntl(value, { year: 'numeric', month: 'long', day: 'numeric' });
}

/* "18-iyul, 2026" | "Jul 18, 2026" | "18 июл. 2026 г." */
function isloh_dtShortDate(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) return p.da + '-' + ISLOH_DT_MONTHS_UZ[p.mo] + ', ' + p.y;
  return isloh_dtIntl(value, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* "14:30" — tanlangan mintaqada */
function isloh_dtTime(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) return isloh_dtPad(p.h) + ':' + isloh_dtPad(p.mi);
  return isloh_dtIntl(value, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* "10.08.2026 14:30" — qisqa raqamli shakl (qayd va izoh vaqtlari) */
function isloh_dtDateTime(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) {
    return isloh_dtPad(p.da) + '.' + isloh_dtPad(p.mo + 1) + '.' + p.y
         + ' ' + isloh_dtPad(p.h) + ':' + isloh_dtPad(p.mi);
  }
  return isloh_dtIntl(value, { year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false });
}

/* "10-avgust, 14:30" — jonli sessiyalar ro'yxati uchun (yilsiz) */
function isloh_dtDayTime(value) {
  const p = isloh_dtParts(value);
  if (!p) return '';
  if (isloh_dtIsUzbek()) {
    return p.da + '-' + ISLOH_DT_MONTHS_UZ[p.mo] + ', ' + isloh_dtPad(p.h) + ':' + isloh_dtPad(p.mi);
  }
  return isloh_dtIntl(value, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/* "Hozirgina" | "40 daqiqa oldin" | "3 soat oldin" | "2 kun oldin"
   Kun darajasidan yuqorisini js/course-store.js dagi isloh_relativeDate()
   hal qiladi (u kurs ro'yxatidagi "Yangilangan" ustunini ham chizadi) —
   shu sababli bu funksiya faqat SUTKA ICHIDAGI farqni o'zi hisoblaydi.
   Modul ulanmagan sahifada qisqa sana ko'rsatiladi, xato bermaydi. */
function isloh_relativeTime(value) {
  if (!value) return '—';
  const then = new Date(value);
  if (isNaN(then.getTime())) return String(value);

  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return minutes + ' daqiqa oldin';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' soat oldin';

  return typeof isloh_relativeDate === 'function' ? isloh_relativeDate(value) : isloh_dtShortDate(value);
}

/* Sozlama o'zgarsa, sahifadagi sanalarni qayta chizish kerak bo'lishi mumkin.
   Modullar shu hodisaga ulanadi (js/theme.js dagi naqsh bilan bir xil). */
function isloh_dtNotifyChange() {
  document.dispatchEvent(new CustomEvent('isloh:datetime-changed'));
}

document.addEventListener('isloh:settings-updated', (e) => {
  const key = e.detail && e.detail.key;
  // null -> standart holatga qaytarish (barcha kalitlar o'zgargan)
  if (key === null || key === 'lang_tz' || key === 'lang_ui') isloh_dtNotifyChange();
});

window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_DT_SETTINGS_KEY) isloh_dtNotifyChange();
});
