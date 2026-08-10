/* ==========================================================================
   ISLOH — Sozlamalar navigatsiyasi  (Sprint 3B, 7A da qayta yozildi)
   Sozlamalar sahifasining chap ustunidagi bo'limlar ro'yxati: bandni
   tanlaganda mos panel ko'rinadi.

   7A dan oldin bu fayl o'zining kichik almashtirish mantiqini tutardi —
   bandlar `role="button"`, klaviaturada faqat Enter/Bo'shliq, markupdagi
   `.active` esa e'tiborsiz qolardi (har doim birinchi bo'lim ochilardi).
   Endi mantiq js/tabs.js dagi `isloh_mountTabs()` dvigatelidan olinadi —
   bir xil vidjetning ikki nusxasi o'rniga bittasi. Bu fayl faqat shu
   sahifaga xos ikki narsani qo'shadi: vertikal shartnoma va `#bo'lim`
   chuqur havolasi.

   TALAB: js/tabs.js shu fayldan OLDIN ulanishi kerak (dvigatel shu yerda).

   Markup shartnomasi:
     .settings-nav                                   → role="tablist"
       .settings-nav-item[data-settings-target="<id>"]  (.active = joriy)
       .settings-nav-label                             → guruh sarlavhasi
     .settings-section[data-settings-panel="<id>"]
   ========================================================================== */

/* Faqat oddiy identifikator qabul qilinadi — manzil satridan kelgan
   qiymat to'g'ridan-to'g'ri selektorga qo'yilgani uchun. */
const ISLOH_SETTINGS_HASH_PATTERN = /^[a-z][a-z0-9-]*$/i;

function isloh_settingsHashId() {
  const id = (location.hash || '').replace('#', '');
  return ISLOH_SETTINGS_HASH_PATTERN.test(id) ? id : '';
}

/* Bo'lim almashganda manzildagi `#bo'lim` yangilanadi — havolani nusxalab
   to'g'ridan-to'g'ri shu bo'limga qaytish mumkin bo'lsin.

   `location.hash` emas, `history.replaceState` ishlatiladi: tarixga yangi
   yozuv qo'shilmaydi (Orqaga tugmasi sozlamalar bo'limlari bo'ylab
   "tiqilib" qolmasin) va sahifa panelga sakramaydi.

   `file://` ostida hujjat manbasi "null" bo'lgani uchun brauzer bu
   chaqiruvni rad etishi mumkin (CLAUDE.md §3) — o'sha holda manzil
   shunchaki o'zgarmaydi, bo'lim almashishiga esa hech qanday ta'siri yo'q. */
function isloh_syncSettingsHash(id) {
  try {
    history.replaceState(null, '', '#' + id);
  } catch (e) {
    /* file:// — e'tiborsiz qoldiriladi */
  }
}

function isloh_initSettings() {
  const tabs = [...document.querySelectorAll('.settings-nav-item[data-settings-target]')];
  if (!tabs.length || typeof isloh_mountTabs !== 'function') return;

  const nav = document.querySelector('.settings-nav');

  /* "Xavfli hudud" — bo'limlar guruhining sarlavhasi, tab emas. tablist
     ichida turgani uchun ARIA daraxtidan olib tashlanadi: matni ekranda
     va skrin-riderda qoladi, lekin tab sifatida sanalmaydi. */
  document.querySelectorAll('.settings-nav .settings-nav-label')
    .forEach((label) => label.setAttribute('role', 'presentation'));

  /* Chuqur havola dvigateldan OLDIN hisobga olinadi: `isloh_mountTabs`
     markupdagi `.active`ni hurmat qiladi, shuning uchun kerakli bandni shu
     yerda belgilab qo'yish yetarli. Ilgari bu mantiq js/profile.js da
     turardi va nav bandini `click()` qilib ishga tushirardi — sozlamalar
     mantiqi profil moduliga bog'liq bo'lib qolgan edi. */
  const wanted = isloh_settingsHashId();
  const target = wanted && tabs.find((tab) => tab.dataset.settingsTarget === wanted);
  if (target) {
    tabs.forEach((tab) => tab.classList.remove('active'));
    target.classList.add('active');
  }

  /* Boshlang'ich faollashtirishda manzil YOZILMAYDI: foydalanuvchi hashsiz
     kelgan bo'lsa, manzil o'z-o'zidan `#notifications`ga aylanib qolmasin. */
  let mounted = false;

  isloh_mountTabs({
    list: nav,
    tabs: tabs,
    panels: [...document.querySelectorAll('.settings-section[data-settings-panel]')],
    tabId: (tab) => tab.dataset.settingsTarget,
    panelId: (panel) => panel.dataset.settingsPanel,
    vertical: true,
    idPrefix: 'settings',
    onChange: (id) => { if (mounted) isloh_syncSettingsHash(id); }
  });

  mounted = true;
}

document.addEventListener('DOMContentLoaded', isloh_initSettings);
