/* ==========================================================================
   ISLOH — HTML ekranlash  (M6)

   NEGA BU FAYL BOR: M6 dan boshlab ekranda BOSHQA foydalanuvchining matni
   chiziladi — sharh, muhokama mavzusi, javob. Shu paytgacha frontenddagi
   deyarli barcha matn o'z egasining ma'lumoti edi (o'z kursi, o'z izohi):
   eng yomon holatda odam o'z sahifasini buzardi. Endi esa begona matn
   `innerHTML` ga tushadi va bu jiddiy.

   Loyihada ekranlash ikki joyda ALOHIDA yozilgan edi va ular BIR XIL
   ISHLAMASDI:

     js/chat.js            — faqat `<` va `>`
     js/profile-sections.js — `&`, `<`, `>`, `"`

   Birinchisi atribut ichida yetarli emas (`"` qolib ketardi), ikkinchisi
   esa `'` ni qoldirardi — bitta tirnoq bilan yozilgan atributda
   (`style='...'`) shu ham yetarli. Endi qoida BITTA joyda.

   IKKI FUNKSIYA, chunki ikki kontekst har xil:

     isloh_escapeHtml(x)  — MATN uchun: `<div>${...}</div>`
     isloh_escapeAttr(x)  — ATRIBUT uchun: `title="${...}"`

   Ikkalasi ham bir xil almashtirishni bajaradi (eng keng to'plam), lekin
   nomlar chaqiruv joyida NIYATNI ko'rsatadi — kod o'qiyotgan odam
   atributga matn ekranlagichi qo'yilganini darrov ko'radi.

   BU YAGONA HIMOYA EMAS: server ham matnni tozalab saqlaydi
   (apps/social/sanitize.py). Lekin ASOSIY himoya SHU YERDA — u har qanday
   manbadagi matn uchun ishlaydi, shu jumladan eski yozuvlar va boshqa
   modullardan kelgan qiymatlar uchun ham.
   ========================================================================== */

/* `&` BIRINCHI almashtiriladi: aks holda keyingi almashtirishlar yasagan
   `&lt;` ning `&` i ham qayta ekranlanib `&amp;lt;` bo'lib qolardi. */
const ISLOH_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function isloh_escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ISLOH_ESCAPE_MAP[ch]);
}

/* Atribut qiymati. Hozir mantiq bir xil, lekin alohida nom bilan:
   chaqiruv joyi qaysi kontekstda ekanini aytib turadi va kelajakda
   atributga xos qoida kerak bo'lsa u shu yerga qo'shiladi. */
function isloh_escapeAttr(value) {
  return isloh_escapeHtml(value);
}

/* CSS qiymati (gradient, rang) — `style="background:${...}"`.

   BU EKRANLASH EMAS, OQ RO'YXAT. Sabab: CSS ichida ekranlash yetarli
   emas — `url(javascript:...)` yoki `expression(...)` kabi qiymatlar
   umuman teg ochmasdan ish bajaradi. Shuning uchun faqat KUTILGAN
   belgilar (rang, gradient, foiz, o'lchov) qoldiriladi; qolgani
   tushiriladi va qiymat bo'sh bo'lsa chaqiruvchi o'z sukut rangini
   ishlatadi.

   Avatar rangi va kurs muqovasi do'kondan keladi va ular MATN maydoni —
   ya'ni foydalanuvchi u yerga istalgan narsa yozishi mumkin. */
const ISLOH_SAFE_CSS = /^[A-Za-z0-9\s,.()#%°+\-/_]*$/;

function isloh_safeCssValue(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text || text.length > 200) return '';
  if (!ISLOH_SAFE_CSS.test(text)) return '';
  // `url(` va `expression(` oq ro'yxatdan o'tib ketmasin
  if (/url\s*\(|expression\s*\(|@import/i.test(text)) return '';
  return text;
}

window.isloh_escapeHtml = isloh_escapeHtml;
window.isloh_escapeAttr = isloh_escapeAttr;
window.isloh_safeCssValue = isloh_safeCssValue;
