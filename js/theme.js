/* ==========================================================================
   ISLOH — Theme / afzalliklarni qo'llash moduli
   Sidebar rangi (talaba uchun binafsha, o'qituvchi uchun yashil) js/sidebar.js
   tomonidan `data-role` asosida hal qilinadi. Bu modul esa foydalanuvchi
   tanlagan sozlamalarni butun hujjatga qo'llaydi: tungi rejim, yuqori
   kontrast, katta shrift, ixcham rejim va animatsiyalar.

   Nega aynan shu fayl: theme.js deyarli barcha sahifalarga ulangan, shuning
   uchun sozlamalar Sozlamalar sahifasida emas, HAMMA joyda kuchga kiradi.
   js/settings-store.js faqat settings.html'ga ulangan, shu bois bu modul
   unga bog'liq emas — do'kon bo'lmasa localStorage'ni o'zi o'qiydi.

   Qo'yiladigan klasslar (css/tokens.css + css/base.css):
     body.is-dark-theme     -> tungi rejim tokenlari
     body.a11y-contrast     -> yuqori kontrast tokenlari
     body.a11y-large-text   -> o'qish maydoni kattalashadi
     body.compact-mode      -> masofalar qisqaradi
     body.no-animations     -> o'tish effektlari o'chadi
   ========================================================================== */

const ISLOH_THEME_SETTINGS_KEY = 'isloh_settings';
const ISLOH_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function isloh_applyBodyRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  if (!aside) return;
  document.body.dataset.role = aside.dataset.role;
}

/* Sozlamalarni o'qish. settings-store.js ulangan bo'lsa (settings.html)
   o'sha ishlatiladi — standart qiymatlar bilan; aks holda to'g'ridan-to'g'ri
   localStorage. */
function isloh_readPreferences() {
  if (typeof isloh_getSettings === 'function') return isloh_getSettings();
  try { return JSON.parse(localStorage.getItem(ISLOH_THEME_SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}

/* "auto" -> tizim sozlamasi; boshqa qiymatlar to'g'ridan-to'g'ri ishlatiladi */
function isloh_resolveTheme(preference) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return window.matchMedia(ISLOH_DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function isloh_applyPreferences() {
  const body = document.body;
  if (!body) return;

  const prefs = isloh_readPreferences();

  body.classList.toggle('is-dark-theme', isloh_resolveTheme(prefs.appear_theme) === 'dark');
  body.classList.toggle('a11y-contrast', prefs.a11y_contrast === true);
  body.classList.toggle('a11y-large-text', prefs.a11y_large_text === true);
  body.classList.toggle('compact-mode', prefs.appear_compact === true);
  // Animatsiyalar sukut bo'yicha yoqilgan: faqat aniq o'chirilgandagina klass qo'yiladi
  body.classList.toggle('no-animations', prefs.appear_animations === false);
}

/* Sahifa ochilishida darhol qo'llaymiz (skriptlar <body> oxirida turadi,
   shuning uchun body allaqachon mavjud) — shunda tungi rejim yorug'
   ko'rinishdan keyin "sakrab" almashmaydi. */
isloh_applyPreferences();

document.addEventListener('DOMContentLoaded', () => {
  isloh_applyBodyRole();
  isloh_applyPreferences();
});

/* Sozlamalar shu sahifada o'zgardi (js/settings-store.js hodisasi) */
document.addEventListener('isloh:settings-updated', isloh_applyPreferences);

/* Boshqa tabda o'zgardi */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_THEME_SETTINGS_KEY) isloh_applyPreferences();
});

/* "Avto" rejimda tizim mavzusi almashsa, darhol ergashamiz */
const isloh_darkMedia = window.matchMedia(ISLOH_DARK_MEDIA_QUERY);
if (isloh_darkMedia.addEventListener) isloh_darkMedia.addEventListener('change', isloh_applyPreferences);
else if (isloh_darkMedia.addListener) isloh_darkMedia.addListener(isloh_applyPreferences);
