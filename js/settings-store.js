/* ==========================================================================
   ISLOH — Sozlamalar do'koni  (Sprint 6C)
   pages/student/settings.html dagi switch'lar va select'lar uchun yagona
   manba: localStorage'dagi `isloh_settings` kaliti. Ilgari har bir switch
   faqat HTML'dagi `checked` atributi bilan yashardi — sahifa yangilanishi
   bilan foydalanuvchi tanlovi yo'qolardi.

   js/profile.js dagi `isloh_user` do'koni bilan bir xil naqsh: standart
   qiymatlar + saqlanganini ustiga birlashtirish + bitta sinxron funksiya.
   Ikkisi ataylab alohida kalitlarda: `isloh_user` — kim ekanligingiz
   (profilda ko'rinadi), `isloh_settings` — ilova o'zini qanday tutishi.

   MUHIM: js/settings.js (panel almashish) va js/settings-toggles.js
   (`data-reveals` mexanizmi) bu faylga bog'liq emas va o'zgartirilmagan —
   bu modul faqat qiymatlarni o'qiydi/yozadi.

   Markup shartnomasi:
     <input type="checkbox" data-setting="<kalit>">  -> .checked
     <select data-setting="<kalit>">                 -> .value
     <div data-setting-group="<kalit>">              -> segmentli tanlov
       <button data-setting-value="<qiymat>">           (.active = tanlangan)
   ========================================================================== */

const ISLOH_SETTINGS_KEY = 'isloh_settings';

/* Toast'ni biroz kechiktiramiz: bir nechta switch ketma-ket bosilganda
   ekranni to'ldirib yubormasin, bitta xabar chiqsin. */
const ISLOH_SETTINGS_TOAST_DELAY = 600;

/* --- Standart sxema ------------------------------------------------------
   Kalitlar tekis (nested emas) — `isloh_updateSetting(key, value)` va
   `data-setting="key"` shartnomasi shu bilan to'g'ridan-to'g'ri mos keladi.
   Prefikslar bo'lim nomini bildiradi: notif_ / appear_ / privacy_ /
   security_ / a11y_ / lang_ */
const ISLOH_SETTINGS_DEFAULTS = {
  // Bildirishnomalar
  notif_email: true,
  notif_lessons: true,
  notif_deadlines: true,
  notif_ai: false,
  notif_marketing: false,

  // Ko'rinish. appear_theme: 'light' | 'dark' | 'auto' ('auto' -> tizim
  // sozlamasi, js/theme.js prefers-color-scheme orqali hal qiladi)
  appear_theme: 'light',
  appear_compact: false,
  appear_animations: true,

  // Maxfiylik
  privacy_profile: true,
  privacy_stats: true,
  privacy_online: false,

  // Xavfsizlik
  security_2fa: false,

  // Qulaylik
  a11y_large_text: false,
  a11y_contrast: false,
  a11y_shortcuts: true,

  // Til va hudud
  lang_ui: 'uz',
  lang_tz: 'GMT+5'
};

/* --- Do'kon --------------------------------------------------------------- */

/* Saqlangan yozuvni standartlar ustiga qo'yadi, shuning uchun sxemaga yangi
   kalit qo'shilsa ham eski yozuvlar buzilmaydi. */
function isloh_getSettings() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_SETTINGS_KEY)); } catch (e) { stored = null; }
  return Object.assign({}, ISLOH_SETTINGS_DEFAULTS, stored || {});
}

function isloh_saveSettings(settings) {
  try {
    localStorage.setItem(ISLOH_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    return false; // kvota to'lgan — chaqiruvchi xabar beradi
  }
}

/* Bitta sozlamani yangilaydi. Muvaffaqiyatda yangilangan obyektni,
   yozib bo'lmasa null qaytaradi. */
function isloh_updateSetting(key, value) {
  const settings = isloh_getSettings();
  settings[key] = value;
  if (!isloh_saveSettings(settings)) return null;

  document.dispatchEvent(new CustomEvent('isloh:settings-updated', { detail: { key, value, settings } }));
  return settings;
}

/* --- DOM bog'lanishi ------------------------------------------------------ */

/* toast.js har bir sahifada ulanmagan bo'lishi mumkin — himoyalangan chaqiruv */
function isloh_settingsToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* Do'kondagi qiymatlarni boshqaruv elementlariga qo'yadi (sahifa ochilganda
   va boshqa tabda o'zgarish bo'lganda chaqiriladi). */
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
  const controls = document.querySelectorAll('[data-setting]');
  const groups = document.querySelectorAll('[data-setting-group]');
  if (!controls.length && !groups.length) return;

  isloh_applySettingsToControls();

  let toastTimer = null;
  function announceSaved() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => isloh_settingsToast('Sozlamalar saqlandi'), ISLOH_SETTINGS_TOAST_DELAY);
  }

  controls.forEach((control) => {
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
}

/* Boshqa tabda sozlama o'zgarsa, bu sahifa ham yangilanadi */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_SETTINGS_KEY) isloh_applySettingsToControls();
});

document.addEventListener('DOMContentLoaded', isloh_initSettingsStore);
