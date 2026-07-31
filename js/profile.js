/* ==========================================================================
   ISLOH — Profil / foydalanuvchi do'koni  (Sprint 6C)
   Loyihadagi foydalanuvchi ma'lumoti uchun YAGONA manba: localStorage'dagi
   `isloh_user` kaliti. Ilgari bu kalit faqat js/certificate-engine.js ichida
   e'lon qilingan edi va ism/avatar har bir HTML faylda qo'lda yozilardi —
   endi sahifalar ma'lumotni `data-user-*` atributlari orqali "so'raydi",
   JS esa uni to'ldiradi (CLAUDE.md §2 — DRY).

   Uchta vazifa:
     1) Do'kon      — isloh_getUserProfile() / isloh_updateUserProfile()
     2) DOM sinxron — topbar avatari, profil sahifasi, shaxsiy ma'lumotlar
     3) Formalar    — settings.html "Hisob" paneli + avatar yuklash

   fetch() ishlatilmaydi (CLAUDE.md §3 — file:// protokoli), hamma narsa
   localStorage va DOM orqali.
   ========================================================================== */

const ISLOH_USER_KEY = 'isloh_user';
const ISLOH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISLOH_MONTH_LABELS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

/* Avatar localStorage'da data URL sifatida yotadi, shuning uchun rasm
   saqlashdan oldin kvadrat qilib kichraytiriladi — aks holda bir nechta
   megabaytlik surat butun do'kon kvotasini to'ldirib qo'yadi. */
const ISLOH_AVATAR_MAX_PX = 256;
const ISLOH_AVATAR_MAX_BYTES = 4 * 1024 * 1024;

/* --- Standart profil sxemasi --------------------------------------------
   Saqlangan yozuv shu obyekt ustiga birlashtiriladi, shuning uchun eski yoki
   qisman yozuvlar (masalan certificate-engine ekkan {id, name, role}) ham
   buzilmaydi — yetishmagan maydonlar shu yerdan to'ldiriladi. */
const ISLOH_USER_DEFAULTS = {
  id: 'std-001',
  role: 'student',
  name: 'Samar Mirzayev',
  email: 'samar@example.com',
  headline: "Backend dasturchi bo'lishga intilayotgan talaba",
  bio: "Python va Django yordamida backend dasturlashni o'rganyapman. Maqsad — 6 oyda to'liq stack loyihasini mustaqil qura olish. Har kuni kamida 2 soat mashg'ulot.",
  location: "Toshkent, O'zbekiston",
  languages: "O'zbek, Ingliz",
  joined: '2025-09-01',
  avatar: '' // data: URL yoki bo'sh — bo'sh bo'lsa bosh harflar ko'rsatiladi
};

/* --- 1) Do'kon ----------------------------------------------------------- */

/* Joriy profilni qaytaradi. Birinchi chaqiruvda standart profil ekiladi,
   shunda demo sahifalar hech qachon bo'sh ko'rinmaydi. */
function isloh_getUserProfile() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_USER_KEY)); } catch (e) { stored = null; }

  const user = Object.assign({}, ISLOH_USER_DEFAULTS, stored || {});
  if (!stored) isloh_persistUserProfile(user);
  return user;
}

/* Yozishning o'zi. Kvota to'lgan bo'lsa (katta avatar) false qaytaradi —
   chaqiruvchi foydalanuvchiga xabar beradi, jim yiqilmaydi. */
function isloh_persistUserProfile(user) {
  try {
    localStorage.setItem(ISLOH_USER_KEY, JSON.stringify(user));
    return true;
  } catch (e) {
    return false;
  }
}

/* Profilni qisman yangilaydi va butun sahifani qayta sinxronlaydi.
   Muvaffaqiyatda yangilangan obyektni, kvota xatosida null qaytaradi. */
function isloh_updateUserProfile(newData) {
  const user = Object.assign({}, isloh_getUserProfile(), newData || {});
  if (!isloh_persistUserProfile(user)) return null;

  isloh_syncUserUI();
  document.dispatchEvent(new CustomEvent('isloh:user-updated', { detail: user }));
  return user;
}

/* --- Kichik yordamchilar -------------------------------------------------- */

/* "Samar Mirzayev" -> "SM". Ism bo'sh bo'lsa ham hech qachon bo'sh qaytmaydi. */
function isloh_getUserInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
}

function isloh_formatJoinedDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.getFullYear() + '-yil ' + ISLOH_MONTH_LABELS[d.getMonth()];
}

/* toast.js har bir sahifada ulanmagan bo'lishi mumkin — himoyalangan chaqiruv. */
function isloh_toast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

/* --- 2) DOM sinxronizatsiyasi --------------------------------------------
   Markup shartnomasi (sahifa qaysi maydonni ko'rsatishini o'zi e'lon qiladi):
     [data-user-name]      -> to'liq ism
     [data-user-email]     -> email
     [data-user-headline]  -> qisqa sarlavha
     [data-user-role-line] -> "sarlavha · joylashuv" (profil sarlavhasi ostida)
     [data-user-bio]       -> bio matni
     [data-user-location]  -> joylashuv
     [data-user-languages] -> tillar
     [data-user-joined]    -> qo'shilgan sana (formatlangan)
     [data-user-avatar]    -> rasm yoki bosh harflar                        */
const ISLOH_USER_TEXT_BINDINGS = {
  'data-user-name': (u) => u.name,
  'data-user-email': (u) => u.email,
  'data-user-headline': (u) => u.headline,
  'data-user-role-line': (u) => [u.headline, u.location].filter(Boolean).join(' · '),
  'data-user-bio': (u) => u.bio,
  'data-user-location': (u) => u.location,
  'data-user-languages': (u) => u.languages,
  'data-user-joined': (u) => isloh_formatJoinedDate(u.joined)
};

/* Avatar chizish. Avval bosh harflar qo'yiladi, rasm esa faqat muvaffaqiyatli
   yuklangandan keyin almashtiriladi — shuning uchun buzuq yoki yo'q rasm
   layoutni buzmaydi, shunchaki bosh harflar qolib ketadi. */
function isloh_renderUserAvatar(el, user) {
  const initials = isloh_getUserInitials(user.name);
  el.textContent = initials;
  el.setAttribute('title', user.name || '');
  if (!user.avatar) return;

  const img = document.createElement('img');
  img.className = 'avatar-img';
  img.alt = '';
  img.addEventListener('load', () => { el.textContent = ''; el.appendChild(img); });
  img.addEventListener('error', () => { el.textContent = initials; });
  img.src = user.avatar;
}

/* Sahifa roli sidebar'dan olinadi (student / instructor / admin). */
function isloh_getPageRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  return aside ? aside.dataset.role : '';
}

function isloh_syncUserUI() {
  const user = isloh_getUserProfile();

  Object.keys(ISLOH_USER_TEXT_BINDINGS).forEach((attr) => {
    document.querySelectorAll('[' + attr + ']').forEach((el) => {
      el.textContent = ISLOH_USER_TEXT_BINDINGS[attr](user) || '';
    });
  });

  document.querySelectorAll('[data-user-avatar]').forEach((el) => isloh_renderUserAvatar(el, user));

  /* Topbar avatari hali `data-user-avatar` qo'yilmagan sahifalarda ham
     avtomatik yangilanadi — lekin faqat sahifa roli joriy foydalanuvchi
     roliga mos kelganda, aks holda talaba ismi instruktor sahifasida
     chiqib qolardi. */
  if (isloh_getPageRole() === user.role) {
    document.querySelectorAll('.topbar .avatar:not([data-user-avatar])')
      .forEach((el) => isloh_renderUserAvatar(el, user));
  }

  /* Avatar tiklash tugmasi faqat rasm o'rnatilgan bo'lsa ko'rinadi. */
  document.querySelectorAll('[data-avatar-reset]').forEach((btn) => { btn.hidden = !user.avatar; });
}

/* --- 3) Avatar yuklash ----------------------------------------------------
   Markup shartnomasi:
     [data-avatar-upload] -> <input type="file">
     [data-user-avatar]   -> jonli ko'rinish (yuqoridagi sinxron orqali)
     [data-avatar-reset]  -> rasmni olib tashlash (ixtiyoriy)               */

/* Rasmni markazidan kvadrat qilib kesib, ISLOH_AVATAR_MAX_PX ga kichraytiradi. */
function isloh_downscaleAvatar(dataUrl, done) {
  const img = new Image();
  img.addEventListener('load', () => {
    const size = ISLOH_AVATAR_MAX_PX;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);

    /* file:// ostida ba'zi brauzerlar canvas'ni "tainted" deb hisoblab
       toDataURL'ni bloklaydi — bunday holda asl rasm o'zi saqlanadi. */
    let out;
    try { out = canvas.toDataURL('image/jpeg', 0.85); } catch (e) { out = dataUrl; }
    done(out);
  });
  img.addEventListener('error', () => done(null));
  img.src = dataUrl;
}

function isloh_readAvatarFile(file, done) {
  const reader = new FileReader();
  reader.addEventListener('load', () => isloh_downscaleAvatar(reader.result, done));
  reader.addEventListener('error', () => done(null));
  reader.readAsDataURL(file);
}

function isloh_initAvatarUpload() {
  const input = document.querySelector('[data-avatar-upload]');

  if (input) {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;

      if (file.type.indexOf('image/') !== 0) {
        input.value = '';
        isloh_toast('Faqat rasm fayli yuklash mumkin', 'error');
        return;
      }
      if (file.size > ISLOH_AVATAR_MAX_BYTES) {
        input.value = '';
        isloh_toast("Rasm hajmi 4 MB dan oshmasligi kerak", 'error');
        return;
      }

      isloh_readAvatarFile(file, (dataUrl) => {
        input.value = ''; // bir xil faylni qayta tanlash ham hodisa bersin
        if (!dataUrl) { isloh_toast("Rasmni o'qib bo'lmadi", 'error'); return; }
        if (!isloh_updateUserProfile({ avatar: dataUrl })) {
          isloh_toast("Rasm saqlanmadi — brauzer xotirasi to'lgan", 'error');
          return;
        }
        isloh_toast('Profil rasmi yangilandi');
      });
    });
  }

  document.querySelectorAll('[data-avatar-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      isloh_updateUserProfile({ avatar: '' });
      isloh_toast('Profil rasmi olib tashlandi');
    });
  });
}

/* --- 4) "Hisob" formasi (settings.html) -----------------------------------
   Markup shartnomasi:
     [data-user-field="name|email|bio|headline|location"] -> input/textarea
     [data-user-save]                                     -> saqlash tugmasi */
function isloh_initAccountForm() {
  const fields = document.querySelectorAll('[data-user-field]');
  if (!fields.length) return;

  const user = isloh_getUserProfile();
  fields.forEach((field) => { field.value = user[field.dataset.userField] || ''; });

  const saveBtn = document.querySelector('[data-user-save]');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    const patch = {};
    fields.forEach((field) => { patch[field.dataset.userField] = field.value.trim(); });

    if (!patch.name) { isloh_toast("Ism bo'sh bo'lishi mumkin emas", 'error'); return; }
    if (patch.email && !ISLOH_EMAIL_RE.test(patch.email)) {
      isloh_toast("Email manzil noto'g'ri kiritilgan", 'error');
      return;
    }

    if (!isloh_updateUserProfile(patch)) {
      isloh_toast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }
    isloh_toast("O'zgarishlar saqlandi");
  });
}

/* settings.html'ga `#bo'lim` bilan kelinganda o'sha panel ochiladi (profil
   sahifasidagi "Profilni tahrirlash" tugmasi shu yo'l bilan ishlaydi).
   js/settings.js'ga tegilmaydi — shunchaki mos nav elementi bosiladi, ya'ni
   mavjud tab almashish mantiqi o'zgarishsiz qoladi. */
function isloh_openSettingsSectionFromHash() {
  const id = (location.hash || '').replace('#', '');
  if (!id || !/^[a-z][a-z0-9-]*$/i.test(id)) return;

  const item = document.querySelector('.settings-nav-item[data-settings-target="' + id + '"]');
  if (item) item.click();
}

function isloh_initProfileModule() {
  isloh_syncUserUI();
  isloh_initAvatarUpload();
  isloh_initAccountForm();
  isloh_openSettingsSectionFromHash();
}

/* Boshqa tabda profil o'zgarsa, bu sahifa ham yangilanadi. */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_USER_KEY) isloh_syncUserUI();
});

document.addEventListener('DOMContentLoaded', isloh_initProfileModule);
