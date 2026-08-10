/* ==========================================================================
   ISLOH — Sozlamalar do'koni  (Sprint 6C, 7A da rol bo'yicha ajratildi)
   Sozlamalar sahifasidagi switch'lar, select'lar va segmentli tanlovlar
   uchun yagona manba. Ilgari har bir switch faqat HTML'dagi `checked`
   atributi bilan yashardi — sahifa yangilanishi bilan tanlov yo'qolardi.

   --- Nega ikki kalit? -----------------------------------------------------
   6C da hamma narsa bitta `isloh_settings` obyektida tekis yotardi. Lekin
   sozlamalarning bir qismi rolga bog'liq emas (mavzu, shrift, til — bu
   BRAUZER qanday ko'rinishi), bir qismi esa aniq rolga tegishli (talaba
   "dars eslatmasi" oladi, o'qituvchi "yangi talaba yozildi" xabarini).
   Bitta kalitda ushlab turilsa, o'qituvchi sahifasi talabaning
   bildirishnoma tanlovini ustiga yozib ketardi.

     isloh_settings       → umumiy afzalliklar (js/theme.js shu kalitni
                            o'qiydi va u o'zgartirilmagan)
     isloh_role_settings  → { student: {...}, instructor: {...}, admin: {...} }

   Bu js/profile.js dagi `isloh_profiles` naqshining aynan o'zi: rol bo'yicha
   bo'limlar. Maxfiylik va 2FA ham rol bo'limida — profil yozuvlari ham rol
   bo'yicha alohida (talaba profili ≠ o'qituvchi profili), demak "profilim
   ko'rinsin" ham har rol uchun mustaqil.

   `isloh_getSettings()` ikkisini bitta TEKIS obyektga birlashtirib qaytaradi,
   shuning uchun `data-setting="<kalit>"` shartnomasi va js/theme.js
   o'zgarishsiz qoladi — ajratish faqat saqlash qatlamida.

   Markup shartnomasi:
     <input type="checkbox" data-setting="<kalit>">  -> .checked
     <input|textarea|select data-setting="<kalit>">  -> .value
     <div data-setting-group="<kalit>">              -> segmentli tanlov
       <button data-setting-value="<qiymat>">           (.active = tanlangan)
     [data-settings-reset]                          -> standart holatga qaytarish
   ========================================================================== */

const ISLOH_SETTINGS_KEY = 'isloh_settings';
const ISLOH_ROLE_SETTINGS_KEY = 'isloh_role_settings';

/* Toast'ni biroz kechiktiramiz: bir nechta switch ketma-ket bosilganda
   ekranni to'ldirib yubormasin, bitta xabar chiqsin. */
const ISLOH_SETTINGS_TOAST_DELAY = 600;

/* Sahifada `data-role` topilmasa ishlatiladigan rol (masalan komponentlar
   ko'rgazmasi kabi rolsiz sahifada) */
const ISLOH_SETTINGS_FALLBACK_ROLE = 'student';

/* --- Standart sxema ------------------------------------------------------
   Kalitlar tekis (nested emas) — `isloh_updateSetting(key, value)` va
   `data-setting="key"` shartnomasi shu bilan to'g'ridan-to'g'ri mos keladi.
   Prefikslar bo'lim nomini bildiradi: appear_ / a11y_ / lang_ / notif_ /
   privacy_ / security_ / payout_ */

/* Rolga bog'liq bo'lmagan afzalliklar. js/theme.js aynan shularni o'qiydi. */
const ISLOH_SETTINGS_DEFAULTS = {
  // Ko'rinish. appear_theme: 'light' | 'dark' | 'auto' ('auto' -> tizim
  // sozlamasi, js/theme.js prefers-color-scheme orqali hal qiladi)
  appear_theme: 'light',
  appear_compact: false,
  appear_animations: true,

  // Qulaylik
  a11y_large_text: false,
  a11y_contrast: false,
  a11y_shortcuts: true,

  // Til va hudud
  lang_ui: 'uz',
  lang_tz: 'GMT+5'
};

/* Rolga xos sozlamalar. Yangi rol qo'shilsa shu yerga bo'lim qo'shiladi —
   `isloh_settingsRole()` ham shu ro'yxatga qarab tekshiradi.
   Instruktor va admin kalitlari 2- va 3-bosqichda sahifalarga bog'lanadi;
   sxema esa hozirdan bitta joyda turadi. */
const ISLOH_ROLE_SETTINGS_DEFAULTS = {
  student: {
    notif_email: true,
    notif_lessons: true,
    notif_deadlines: true,
    notif_ai: false,
    notif_marketing: false,

    privacy_profile: true,
    privacy_stats: true,
    privacy_online: false,

    security_2fa: false
  },
  instructor: {
    notif_students: true,
    notif_submissions: true,
    notif_reviews: true,
    notif_payouts: true,
    notif_ai: false,
    notif_marketing: false,

    privacy_profile: true,
    privacy_stats: true,
    privacy_online: false,

    security_2fa: false,

    // To'lovlar (2-bosqich). payout_tin — STIR raqami, matn maydoni.
    payout_auto: true,
    payout_tin: ''
  },
  admin: {}
};

/* --- Past qatlam: o'qish/yozish ------------------------------------------- */

function isloh_settingsRead(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function isloh_settingsWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false; // kvota to'lgan — chaqiruvchi xabar beradi
  }
}

/* Joriy sahifaning roli. js/theme.js `body[data-role]`ni DOMContentLoaded'da
   qo'yadi, lekin skript tartibi kafolatlanmagani uchun asl manbaga —
   `.sidebar[data-role]`ga ham qaraymiz (theme.js ham shu yerdan oladi). */
function isloh_settingsRole() {
  const fromBody = document.body && document.body.dataset.role;
  if (fromBody && fromBody in ISLOH_ROLE_SETTINGS_DEFAULTS) return fromBody;

  const aside = document.querySelector('.sidebar[data-role]');
  const fromSidebar = aside && aside.dataset.role;
  if (fromSidebar && fromSidebar in ISLOH_ROLE_SETTINGS_DEFAULTS) return fromSidebar;

  return ISLOH_SETTINGS_FALLBACK_ROLE;
}

/* --- Bir martalik ko'chirish ----------------------------------------------
   6C yozuvlarida rolga xos kalitlar `isloh_settings` ichida tekis yotadi.
   Ularni FAQAT pages/student/settings.html yozardi (o'qituvchi va admin
   sahifalarida `data-setting` bog'lanish umuman yo'q edi), shuning uchun
   eski qiymatlar aniq TALABAning tanlovi — `student` bo'limiga ko'chiriladi.
   Toza brauzerda yoki ko'chirish allaqachon bo'lgan bo'lsa hech narsa
   qilinmaydi. */
function isloh_migrateLegacySettings() {
  const stored = isloh_settingsRead(ISLOH_SETTINGS_KEY);
  if (!stored) return;

  const legacyKeys = Object.keys(ISLOH_ROLE_SETTINGS_DEFAULTS.student)
    .filter((key) => key in stored);
  if (!legacyKeys.length) return;

  const buckets = isloh_settingsRead(ISLOH_ROLE_SETTINGS_KEY) || {};
  const student = Object.assign({}, buckets.student);

  legacyKeys.forEach((key) => {
    // Yangi bo'limdagi qiymat ustunroq: ko'chirish uni bosib o'tmasin
    if (!(key in student)) student[key] = stored[key];
    delete stored[key];
  });
  buckets.student = student;

  // Avval yangi joyga yozamiz: ikkinchi yozuv muvaffaqiyatsiz bo'lsa ham
  // ma'lumot yo'qolmasin (eski nusxa hali joyida turadi)
  if (isloh_settingsWrite(ISLOH_ROLE_SETTINGS_KEY, buckets)) {
    isloh_settingsWrite(ISLOH_SETTINGS_KEY, stored);
  }
}

/* --- Do'kon --------------------------------------------------------------- */

/* Bitta rolning bo'limi: standartlar + saqlangani. */
function isloh_getRoleSettings(role) {
  const buckets = isloh_settingsRead(ISLOH_ROLE_SETTINGS_KEY) || {};
  const defaults = ISLOH_ROLE_SETTINGS_DEFAULTS[role] || {};
  return Object.assign({}, defaults, buckets[role] || {});
}

/* Umumiy + rol sozlamalari bitta tekis obyektda. Saqlangan yozuv
   standartlar USTIGA qo'yiladi, shuning uchun sxemaga yangi kalit
   qo'shilsa ham eski yozuvlar buzilmaydi. */
function isloh_getSettings(role) {
  const stored = isloh_settingsRead(ISLOH_SETTINGS_KEY) || {};
  const settings = Object.assign({}, ISLOH_SETTINGS_DEFAULTS, stored);
  return Object.assign(settings, isloh_getRoleSettings(role || isloh_settingsRole()));
}

/* Bitta sozlamani yangilaydi: kalit joriy rolning sxemasida bo'lsa rol
   bo'limiga, aks holda umumiy obyektga yoziladi. Muvaffaqiyatda birlashgan
   obyektni, yozib bo'lmasa null qaytaradi. */
function isloh_updateSetting(key, value) {
  const role = isloh_settingsRole();
  const roleDefaults = ISLOH_ROLE_SETTINGS_DEFAULTS[role] || {};
  let saved;

  if (key in roleDefaults) {
    const buckets = isloh_settingsRead(ISLOH_ROLE_SETTINGS_KEY) || {};
    buckets[role] = Object.assign({}, buckets[role], { [key]: value });
    saved = isloh_settingsWrite(ISLOH_ROLE_SETTINGS_KEY, buckets);
  } else {
    const globals = Object.assign({}, ISLOH_SETTINGS_DEFAULTS, isloh_settingsRead(ISLOH_SETTINGS_KEY) || {});
    globals[key] = value;
    saved = isloh_settingsWrite(ISLOH_SETTINGS_KEY, globals);
  }

  if (!saved) return null;

  const settings = isloh_getSettings(role);
  document.dispatchEvent(new CustomEvent('isloh:settings-updated', { detail: { key, value, settings } }));
  return settings;
}

/* Standart holatga qaytarish: umumiy sozlamalar va FAQAT joriy rolning
   bo'limi tozalanadi — boshqa roldagi tanlovlarga tegilmaydi.
   ESLATMA: bu qaytarilmaydigan amal, shuning uchun tugma bilan bog'lashda
   tasdiqlash so'raladi (js/settings-danger.js dagi dialoglar naqshi). */
function isloh_resetSettings() {
  const role = isloh_settingsRole();
  const buckets = isloh_settingsRead(ISLOH_ROLE_SETTINGS_KEY) || {};
  delete buckets[role];

  if (!isloh_settingsWrite(ISLOH_SETTINGS_KEY, {})) return null;
  if (!isloh_settingsWrite(ISLOH_ROLE_SETTINGS_KEY, buckets)) return null;

  const settings = isloh_getSettings(role);
  isloh_applySettingsToControls();
  document.dispatchEvent(new CustomEvent('isloh:settings-updated', { detail: { key: null, value: null, settings } }));
  return settings;
}

/* --- DOM bog'lanishi ------------------------------------------------------ */

/* toast.js har bir sahifada ulanmagan bo'lishi mumkin — himoyalangan chaqiruv */
function isloh_settingsToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* Do'kondagi qiymatlarni boshqaruv elementlariga qo'yadi (sahifa ochilganda,
   standart holatga qaytarilganda va boshqa tabda o'zgarish bo'lganda). */
function isloh_applySettingsToControls() {
  const settings = isloh_getSettings();

  document.querySelectorAll('[data-setting]').forEach((control) => {
    const key = control.dataset.setting;
    if (!(key in settings)) return;

    if (control.type === 'checkbox') {
      control.checked = Boolean(settings[key]);
    } else {
      control.value = settings[key];
    }
  });

  // Segmentli tanlovlar (mavzu kabi): tanlangan tugmaga .active qo'yiladi
  document.querySelectorAll('[data-setting-group]').forEach((group) => {
    const key = group.dataset.settingGroup;
    if (!(key in settings)) return;
    group.querySelectorAll('[data-setting-value]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.settingValue === settings[key]);
      btn.setAttribute('aria-pressed', String(btn.dataset.settingValue === settings[key]));
    });
  });
}

function isloh_initSettingsStore() {
  // Ko'chirish boshqaruvlar bor-yo'qligidan qat'i nazar bajariladi
  isloh_migrateLegacySettings();

  const controls = document.querySelectorAll('[data-setting]');
  const groups = document.querySelectorAll('[data-setting-group]');
  const resetButtons = document.querySelectorAll('[data-settings-reset]');
  if (!controls.length && !groups.length && !resetButtons.length) return;

  isloh_applySettingsToControls();

  let toastTimer = null;
  function announceSaved() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => isloh_settingsToast('Sozlamalar saqlandi'), ISLOH_SETTINGS_TOAST_DELAY);
  }

  controls.forEach((control) => {
    /* Matn maydonlari uchun `change` (fokus ketganda) — har harfda
       localStorage'ga yozib o'tirmaslik uchun; switch va select'da
       `change` allaqachon to'g'ri hodisa. */
    control.addEventListener('change', () => {
      const key = control.dataset.setting;
      const value = control.type === 'checkbox' ? control.checked : control.value;

      if (!isloh_updateSetting(key, value)) {
        // Saqlanmadi — boshqaruvni do'kondagi haqiqiy holatga qaytaramiz,
        // aks holda ekran yolg'on ko'rsatib turadi
        isloh_applySettingsToControls();
        isloh_settingsToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }
      announceSaved();
    });
  });

  groups.forEach((group) => {
    const key = group.dataset.settingGroup;
    group.querySelectorAll('[data-setting-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isloh_updateSetting(key, btn.dataset.settingValue)) {
          isloh_settingsToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
          return;
        }
        isloh_applySettingsToControls(); // tanlangan tugmani belgilaymiz
        announceSaved();
      });
    });
  });

  resetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isloh_resetSettings()) {
        isloh_settingsToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
        return;
      }
      isloh_settingsToast('Sozlamalar standart holatga qaytarildi');
    });
  });
}

/* Boshqa tabda sozlama o'zgarsa, bu sahifa ham yangilanadi */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_SETTINGS_KEY || e.key === ISLOH_ROLE_SETTINGS_KEY) isloh_applySettingsToControls();
});

document.addEventListener('DOMContentLoaded', isloh_initSettingsStore);
