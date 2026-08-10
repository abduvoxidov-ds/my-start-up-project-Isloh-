/* ==========================================================================
   ISLOH — Platforma sozlamalari do'koni  (Sprint 7A, 3-bosqich)
   pages/admin/admin-settings.html uchun. Ilgari bu sahifada hech qanday
   do'kon yo'q edi: maydonlar HTML'dagi `value`da yashardi, "O'zgarishlarni
   saqlash" tugmasi esa hech qayerga hech narsa yozmasdi.

   --- Nega alohida do'kon? --------------------------------------------------
   js/settings-store.js — FOYDALANUVCHI afzalliklari: rol bo'yicha, har bir
   o'zgarish darhol saqlanadi. Platforma sozlamalari esa boshqa narsa:
   butun platformaga tegishli (rolga bog'liq emas), adminlar uchun umumiy va
   "tahrirla → saqla" modelida ishlaydi — domen nomidagi xato darhol kuchga
   kirib qolmasligi kerak. Shu bois alohida kalit va alohida modul.

   Iflos holat, ogohlantirish va Saqlash tugmasi qaytadan yozilmaydi:
   js/unsaved-guard.js dagi mexanika ishlatiladi, bu modul unga faqat o'z
   do'konini beradi (`data-unsaved-store="platform"`).

   Markup shartnomasi:
     [data-platform-setting="<kalit>"]   -> checkbox .checked, qolganlari .value
     [data-maintenance-note]             -> texnik xizmat rejimi yoqilganda
                                            ko'rinadigan ogohlantirish

   ESLATMA: bu qiymatlar mahalliy (localStorage). Real platformada ular
   serverda bo'lishi kerak — SMTP, xotira va sessiya sozlamalari shu sababli
   hali `disabled` holatida turadi (CLAUDE.md §4).
   ========================================================================== */

const ISLOH_PLATFORM_SETTINGS_KEY = 'isloh_platform_settings';

/* Brend rangi hujjatga shu token orqali qo'llanadi. `--violet-600` —
   loyihadagi asosiy aksent (tugmalar, faol holatlar, sidebar belgisi);
   uni almashtirish butun interfeys rangini o'zgartiradi. */
const ISLOH_BRAND_TOKEN = '--violet-600';

const ISLOH_PLATFORM_SETTINGS_DEFAULTS = {
  // Umumiy
  platform_name: 'Isloh LMS',
  platform_domain: 'isloh.uz',
  platform_tz: 'UTC+5',
  platform_currency: 'UZS',

  // Brendlash. Qiymat #rrggbb ko'rinishida — <input type="color"> shuni
  // talab qiladi. Standart qiymat css/tokens.css dagi --violet-600.
  brand_primary: '#6C5DD3',

  // Tillar. O'zbekcha standart til, shuning uchun o'chirib bo'lmaydi va
  // sozlama sifatida saqlanmaydi.
  lang_ru_enabled: true,
  lang_en_enabled: false,

  // Texnik xizmat rejimi
  maintenance_mode: false
};

/* --- O'qish / yozish ------------------------------------------------------ */

function isloh_getPlatformSettings() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_PLATFORM_SETTINGS_KEY)); } catch (e) { stored = null; }
  return Object.assign({}, ISLOH_PLATFORM_SETTINGS_DEFAULTS, stored || {});
}

function isloh_writePlatformSettings(settings) {
  try {
    localStorage.setItem(ISLOH_PLATFORM_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false; // kvota to'lgan
  }
}

/* Saqlangan yozuv bormi? Boshlanishida tiklash kerakligini bilish uchun —
   toza brauzerda standart qiymatlar HTML'dan keladi. */
function isloh_hasStoredPlatformSettings() {
  return localStorage.getItem(ISLOH_PLATFORM_SETTINGS_KEY) !== null;
}

/* --- Brend rangini qo'llash ----------------------------------------------- */

/* Rangni butun hujjatga qo'llaydi. Faqat #rrggbb qabul qilinadi — noto'g'ri
   qiymat tokenni buzib, interfeysni rangsiz qoldirmasin. */
function isloh_applyBrandColor(color) {
  const valid = /^#[0-9a-f]{6}$/i.test(String(color || ''));
  const root = document.documentElement;

  if (!valid || color.toLowerCase() === ISLOH_PLATFORM_SETTINGS_DEFAULTS.brand_primary.toLowerCase()) {
    // Standart rang — o'zgartirishni butunlay olib tashlaymiz, toki
    // css/tokens.css (va tungi rejim varianti) o'z ishini qilsin
    root.style.removeProperty(ISLOH_BRAND_TOKEN);
    return;
  }
  root.style.setProperty(ISLOH_BRAND_TOKEN, color);
}

/* --- DOM bog'lanishi ------------------------------------------------------ */

function isloh_platformControls(scope) {
  return [...(scope || document).querySelectorAll('[data-platform-setting]')];
}

/* Do'kondagi qiymatlarni maydonlarga qo'yadi. */
function isloh_applyPlatformSettingsToControls(scope) {
  const settings = isloh_getPlatformSettings();

  isloh_platformControls(scope).forEach((control) => {
    const key = control.dataset.platformSetting;
    if (!(key in settings)) return;

    if (control.type === 'checkbox') control.checked = Boolean(settings[key]);
    else control.value = settings[key];
  });
}

/* Texnik xizmat ogohlantirishi maydon holatiga ergashadi (saqlashdan oldin
   ham ko'rinadi — bu ko'rinish oldini olish emas, tanlovning natijasi). */
function isloh_syncMaintenanceNote() {
  const note = document.querySelector('[data-maintenance-note]');
  const toggle = document.querySelector('[data-platform-setting="maintenance_mode"]');
  if (!note || !toggle) return;
  note.hidden = !toggle.checked;
}

/* --- unsaved-guard uchun do'kon ------------------------------------------- */

/* js/unsaved-guard.js chaqiradigan shartnoma: saqlangan maydonlar sonini,
   xatoda manfiy son qaytaradi. */
function isloh_savePlatformSettings(scope) {
  const controls = isloh_platformControls(scope);
  const settings = isloh_getPlatformSettings();

  controls.forEach((control) => {
    const key = control.dataset.platformSetting;
    settings[key] = control.type === 'checkbox' ? control.checked : control.value;
  });

  if (!isloh_writePlatformSettings(settings)) return -1;

  // Saqlangach rang haqiqatan kuchga kiradi
  isloh_applyBrandColor(settings.brand_primary);
  return controls.length;
}

/* Tiklangan maydonlar soni. 0 -> saqlangan yozuv yo'q, HTML'dagi
   boshlang'ich qiymatlar qoladi. */
function isloh_restorePlatformSettings(scope) {
  if (!isloh_hasStoredPlatformSettings()) return 0;
  isloh_applyPlatformSettingsToControls(scope);
  isloh_syncMaintenanceNote();
  return isloh_platformControls(scope).length;
}

/* --- Standart holatga qaytarish -------------------------------------------
   Talaba/o'qituvchi sozlamalaridan farqli: bu yerda do'kon TOZALANMAYDI,
   faqat maydonlarga standart qiymatlar qo'yiladi. Sahifa "tahrirla → saqla"
   modelida ishlaydi, ya'ni qaytarish ham boshqa har qanday tahrir kabi —
   admin "Saqlash"ni bosmaguncha kuchga kirmaydi va istasa bekor qila oladi.

   `input` hodisasi ataylab chiqariladi: js/unsaved-guard.js buni tahrir deb
   biladi va "Saqlanmagan o'zgarishlar" nishonini ko'rsatadi. */
function isloh_resetPlatformControls() {
  isloh_platformControls().forEach((control) => {
    const key = control.dataset.platformSetting;
    if (!(key in ISLOH_PLATFORM_SETTINGS_DEFAULTS)) return;

    const value = ISLOH_PLATFORM_SETTINGS_DEFAULTS[key];
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = value;

    control.dispatchEvent(new Event('input', { bubbles: true }));
  });

  isloh_applyBrandColor(ISLOH_PLATFORM_SETTINGS_DEFAULTS.brand_primary);
  isloh_syncMaintenanceNote();
}

/* Ro'yxatdan o'tish fayl yuklanishida bajariladi — js/unsaved-guard.js
   o'z ishini DOMContentLoaded'da boshlaydi, ya'ni bu paytda do'kon
   allaqachon joyida bo'ladi (skript tartibidan qat'i nazar). */
if (typeof isloh_registerUnsavedStore === 'function') {
  isloh_registerUnsavedStore('platform', {
    save: isloh_savePlatformSettings,
    restore: isloh_restorePlatformSettings
  });
}

function isloh_initPlatformSettings() {
  const controls = isloh_platformControls();
  if (!controls.length) return;

  /* Standart qiymatlar HAR SAFAR maydonlarga qo'yiladi, saqlangan yozuv
     bo'lmasa ham. Aks holda standart ikki joyda — HTML atributida va shu
     fayldagi sxemada — yashaydi va ular osongina bir-biridan uzoqlashadi
     (masalan "Ruscha" sxemada yoqilgan, markupda esa o'chirilgan bo'lib
     qolgan edi). Endi yagona manba shu sxema; markupdagi `value` faqat
     JS ishlamagan holatdagi zaxira. Bu yerda qiymat to'g'ridan-to'g'ri
     yozilgani uchun `input`/`change` hodisasi chiqmaydi, ya'ni sahifa
     "o'zgargan" holatga o'tmaydi. */
  isloh_applyPlatformSettingsToControls();

  /* Rang tanlagichda jonli ko'rish: tanlangan rang darhol tokenga yoziladi,
     do'konga esa faqat "Saqlash" bosilganda. Saqlanmagan holat
     js/unsaved-guard.js nishoni bilan ko'rsatiladi.

     ESLATMA: ba'zi render muhitlarida allaqachon chizilgan elementlar
     tokenning o'zgarishiga darhol javob bermaydi (style-invalidation
     qusuri) — shu sababli interfeys "darhol ko'rinadi" deb va'da bermaydi,
     rang esa har qanday holatda sahifa qayta ochilganda aniq qo'llanadi
     (js/theme.js). Majburiy reflow bilan "tuzatish" yo'liga kirilmadi:
     u ishlab chiqarish kodiga muhitga xos qusur uchun hack kiritardi. */
  const brand = document.querySelector('[data-platform-setting="brand_primary"]');
  if (brand) brand.addEventListener('input', () => isloh_applyBrandColor(brand.value));

  const maintenance = document.querySelector('[data-platform-setting="maintenance_mode"]');
  if (maintenance) maintenance.addEventListener('change', isloh_syncMaintenanceNote);

  document.querySelectorAll('[data-platform-reset]').forEach((btn) => {
    btn.addEventListener('click', isloh_resetPlatformControls);
  });

  isloh_syncMaintenanceNote();
}

document.addEventListener('DOMContentLoaded', isloh_initPlatformSettings);
