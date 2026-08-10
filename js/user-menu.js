/* ==========================================================================
   ISLOH — Topbar profil menyusi
   Topbar'dagi avatar ("SM" bosh harflari yoki profil rasmi) endi shunchaki
   bezak emas — u bosiladigan tugma bo'lib, ustiga bosilganda profil menyusi
   ochiladi. Shu sababli "Profil" havolasi yon menyudan (js/navigation.js)
   olib tashlandi.

   Bu modul HAR BIR sahifada bir xil markup yozilmasligi uchun menyuni
   JS orqali quradi (CLAUDE.md §2 — DRY): sahifa faqat mavjud
   `.topbar-actions > .avatar` elementini beradi, qolganini shu fayl qiladi.

   Bog'liqliklar (ikkalasi ham ixtiyoriy emas, sahifaga qo'shilgan):
     js/navigation.js — USER_MENU_CONFIG va NAV_CONFIG.footer (havolalar)
     js/dropdown.js   — ochish/yopish, tashqariga bosish, Escape
     js/profile.js    — ism/email/avatar ma'lumoti (`isloh_user` do'koni)
   ========================================================================== */

/* Avatarni menyu ichiga o'ramaymiz emas, ko'chiramiz: shunda inline
   gradient stillari va js/profile.js ning `.topbar-actions .avatar`
   selektori avvalgidek ishlayveradi. */
const ISLOH_USER_MENU_AVATAR_SEL = '.topbar-actions > .avatar';

/* Sahifa roli sidebar'dan olinadi. js/profile.js dagi bir xil nomli
   funksiya har doim ham yuklanmagan bo'lishi mumkin — shuning uchun
   himoyalangan chaqiruv. */
function isloh_userMenuRole() {
  if (typeof isloh_getPageRole === 'function') return isloh_getPageRole();
  const aside = document.querySelector('.sidebar[data-role]');
  return aside ? aside.dataset.role : '';
}

/* Menyu havolalari: roldagi shaxsiy elementlar + umumiy "Chiqish". */
function isloh_userMenuLinks(role) {
  const items = (typeof USER_MENU_CONFIG !== 'undefined' && USER_MENU_CONFIG[role]) || [];
  const footer = (typeof NAV_CONFIG !== 'undefined' && NAV_CONFIG.footer) || [];
  return { items: items, footer: footer };
}

/* Tarjima kaliti havola fayl nomidan olinadi (USER_MENU_CONFIG da `key`
   maydoni yo'q). Tarjimani js/i18n.js bajaradi; topilmasa markupdagi
   o'zbekcha matn qoladi. Footer bandlari (Chiqish) `nav.` prefiksi bilan —
   ular NAV_CONFIG.footer dan keladi va o'sha kalitni ishlatadi. */
function isloh_userMenuI18nKey(item, prefix) {
  const name = String(item.href || '').split('/').pop().replace('.html', '');
  return name ? ' data-i18n="' + prefix + '.' + name + '"' : '';
}

function isloh_userMenuItemHTML(item, extraClass) {
  const cls = 'dropdown-item' + (extraClass ? ' ' + extraClass : '');
  // Footer bandi (`.is-danger`) NAV_CONFIG dan keladi -> nav.* kaliti
  const prefix = extraClass === 'is-danger' ? 'nav' : 'menu';
  const key = item.key ? ' data-i18n="nav.' + item.key + '"' : isloh_userMenuI18nKey(item, prefix);
  return `<a href="${item.href}" class="${cls}" role="menuitem"${key}><i class="bi ${item.icon}"></i> ${item.label}</a>`;
}

/* Ism/email sarlavhasi sahifa ROLINING profilidan olinadi — do'kon rol
   bo'yicha bo'lingani uchun (js/profile.js) talaba ismi instruktor
   sahifasida chiqib qolmaydi. Ilgari bu yerda "rol mos kelmasa sarlavhani
   umuman ko'rsatma" cheklovi bor edi, natijada instruktor va admin
   menyusi doim ismsiz ochilardi.
   Matnlar `data-user-*` atributlari orqali to'ldiriladi, ya'ni profil
   o'zgarganda menyu ham o'zi yangilanadi. */
function isloh_userMenuHeadHTML(role) {
  if (typeof isloh_getUserProfile !== 'function') return '';
  if (!isloh_getUserProfile(role)) return '';

  return '<div class="user-menu-head">'
       + '<div class="user-menu-name" data-user-name></div>'
       + '<div class="user-menu-email" data-user-email></div>'
       + '</div>';
}

function isloh_buildUserMenu(avatar, role) {
  const links = isloh_userMenuLinks(role);

  const wrap = document.createElement('div');
  wrap.className = 'dropdown user-menu';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dropdown-trigger user-menu-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Profil menyusi');

  const panel = document.createElement('div');
  panel.className = 'dropdown-menu dropdown-menu-right user-menu-panel';
  panel.setAttribute('role', 'menu');
  panel.innerHTML = isloh_userMenuHeadHTML(role)
    + links.items.map((item) => isloh_userMenuItemHTML(item)).join('')
    + (links.footer.length ? '<div class="dropdown-sep"></div>' : '')
    + links.footer.map((item) => isloh_userMenuItemHTML(item, 'is-danger')).join('');

  // Avatarni o'z joyidan tugma ichiga ko'chiramiz
  avatar.parentNode.insertBefore(wrap, avatar);
  trigger.appendChild(avatar);
  wrap.appendChild(trigger);
  wrap.appendChild(panel);
}

function isloh_initUserMenu() {
  const role = isloh_userMenuRole();
  if (!role) return;

  document.querySelectorAll(ISLOH_USER_MENU_AVATAR_SEL).forEach((avatar) => {
    isloh_buildUserMenu(avatar, role);
  });

  /* js/profile.js o'z sinxronini DOMContentLoaded'da, ya'ni menyu hali
     qurilmasidan oldin bajaradi — yangi `data-user-*` tugunlarini
     to'ldirish uchun uni bir marta qayta chaqiramiz. */
  if (typeof isloh_syncUserUI === 'function') isloh_syncUserUI();
}

document.addEventListener('DOMContentLoaded', isloh_initUserMenu);
