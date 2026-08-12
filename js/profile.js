/* ==========================================================================
   ISLOH — Profil / foydalanuvchi do'koni

   Loyihadagi foydalanuvchi ma'lumoti uchun YAGONA manba: localStorage'dagi
   `isloh_profiles` kaliti. Sahifalar ma'lumotni `data-user-*` atributlari
   orqali "so'raydi", JS esa uni to'ldiradi (CLAUDE.md §2 — DRY).

   Do'kon ROL bo'yicha bo'lingan:
     isloh_profiles = { student: {...}, instructor: {...}, admin: {...} }

   Ilgari bitta `isloh_user` yozuvi bor edi, shuning uchun instruktor va admin
   sahifalari o'z profilini ko'rsata olmasdi — natijada ular ma'lumotni HTML
   ichiga qo'lda yozardi, kod esa "sahifa roli saqlangan rolga mos kelsagina
   ko'rsat" degan cheklov bilan ishlardi. Endi har rolning o'z yozuvi bor va
   sahifa o'z rolini `.sidebar[data-role]`dan e'lon qiladi.

   `isloh_user` kaliti saqlanib qoldi — u aktiv rolning NUSXASI. Uni
   js/certificate-engine.js (sertifikat egasi) va js/settings-danger.js
   (sessiyani tozalash) biladi, shuning uchun tashqi shartnoma buzilmaydi.

   Uchta vazifa:
     1) Do'kon      — isloh_getUserProfile(role) / isloh_updateUserProfile()
     2) DOM sinxron — topbar avatari, profil sahifasi, shaxsiy ma'lumotlar
     3) Formalar    — account.html "Hisob" sahifasi + avatar yuklash

   fetch() ishlatilmaydi (CLAUDE.md §3 — file:// protokoli), hamma narsa
   localStorage va DOM orqali.
   ========================================================================== */

const ISLOH_PROFILES_KEY = 'isloh_profiles';
const ISLOH_USER_KEY = 'isloh_user'; // aktiv rol nusxasi (orqaga moslik)
const ISLOH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/* Oy nomlari jadvali js/datetime.js ga ko'chirildi (bitta nusxa, til
   sozlamasiga bo'ysunadi). */
const ISLOH_DEFAULT_ROLE = 'student';

/* Avatar localStorage'da data URL sifatida yotadi, shuning uchun rasm
   saqlashdan oldin kvadrat qilib kichraytiriladi — aks holda bir nechta
   megabaytlik surat butun do'kon kvotasini to'ldirib qo'yadi. */
const ISLOH_AVATAR_MAX_PX = 256;
const ISLOH_AVATAR_MAX_BYTES = 4 * 1024 * 1024;

/* --- Standart profil sxemasi (rol bo'yicha) ------------------------------
   Saqlangan yozuv shu obyekt ustiga birlashtiriladi, shuning uchun eski yoki
   qisman yozuvlar (masalan certificate-engine ekkan {id, name, role}) ham
   buzilmaydi — yetishmagan maydonlar shu yerdan to'ldiriladi.

   Bio matnlarida kurs/talaba soni ataylab yozilmagan: bu raqamlar
   js/profile-stats.js tomonidan haqiqiy do'konlardan hisoblanadi. */
const ISLOH_PROFILE_DEFAULTS = {
  student: {
    id: 'std-001',
    role: 'student',
    name: 'Samar Mirzayev',
    email: 'samar@example.com',
    headline: "Backend dasturchi bo'lishga intilayotgan talaba",
    bio: "Python va Django yordamida backend dasturlashni o'rganyapman. Maqsad — 6 oyda to'liq stack loyihasini mustaqil qura olish. Har kuni kamida 2 soat mashg'ulot.",
    location: "Toshkent, O'zbekiston",
    languages: "O'zbek, Ingliz",
    joined: '2025-09-01',
    avatar: '', // data: URL yoki bo'sh — bo'sh bo'lsa bosh harflar ko'rsatiladi
    /* Quyidagi ro'yxatlarni js/profile-sections.js chizadi. Maqsad `courseId`
       bilan bog'langan bo'lsa, bajarilgani kurs jarayonidan hisoblanadi. */
    skills: [
      { name: 'Python', level: "Ilg'or" },
      { name: 'Django', level: "O'rta" },
      { name: 'JavaScript', level: "O'rta" },
      { name: 'SQL', level: "O'rta" },
      { name: 'Git', level: "Ilg'or" },
      { name: 'HTML/CSS', level: "Ilg'or" }
    ],
    goals: [
      { text: 'Python asoslarini yakunlash', courseId: 'py-101' },
      { text: "Docker asoslarini o'zlashtirish", courseId: 'docker-for-beginners' },
      { text: "To'liq stack portfolio loyihasi" }
    ],
    categories: ['Backend', 'Web dasturlash', "Ma'lumotlar bazasi", 'DevOps']
  },
  instructor: {
    id: 'inst-001',
    role: 'instructor',
    name: 'Akmal Yusupov',
    email: 'akmal@example.com',
    headline: "Backend & DevOps o'qituvchisi",
    bio: "5 yildan ortiq tajribaga ega backend dasturchi va o'qituvchi. Python, Django va PostgreSQL bo'yicha kurslar yarataman va amaliy loyihalar orqali o'rgataman.",
    location: "Toshkent, O'zbekiston",
    languages: "O'zbek, Ingliz, Rus",
    joined: '2024-02-01',
    avatar: '',
    /* Provayderda "yo'nalishlar" saqlanmaydi — ular nashr etilgan
       kurslarning kategoriyalaridan chiqadi (js/profile-sections.js). */
    skills: [
      { name: 'Python', level: 'Ekspert' },
      { name: 'Django / DRF', level: 'Ekspert' },
      { name: 'PostgreSQL', level: "Ilg'or" },
      { name: 'Docker', level: "Ilg'or" },
      { name: 'CI/CD', level: "O'rta" },
      { name: 'System Design', level: "O'rta" }
    ],
    goals: [
      { text: '"Docker for Beginners" kursini nashr etish', courseId: 'docker-for-beginners' },
      { text: '"Advanced API Design" kursini nashr etish', courseId: 'advanced-api-design' },
      { text: "3 000 talabaga yetkazish", stat: 'students', goal: 3000 }
    ]
  },
  admin: {
    id: 'adm-001',
    role: 'admin',
    name: 'Admin',
    email: 'admin@isloh.uz',
    headline: 'Platforma administratori',
    bio: '',
    location: '',
    languages: '',
    joined: '2024-01-01',
    avatar: ''
  }
};

/* --- 1) Do'kon ----------------------------------------------------------- */

/* Hisob o'chirilganda profil qayta ekilmasligi kerak: aks holda tozalashdan
   keyingi har qanday o'qish uni darhol tiklab qo'yadi (sahifa hali ochiq
   turganda). js/settings-danger.js shu bayroqni ko'taradi. */
let isloh_userSeedSuppressed = false;

function isloh_suppressUserSeeding() {
  isloh_userSeedSuppressed = true;
}

/* Sahifa roli sidebar'dan olinadi (student / instructor / admin). */
function isloh_getPageRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  return aside ? aside.dataset.role : '';
}

/* Aktiv rol: sahifa roli ustuvor. Sidebar'siz sahifalarda (auth va h.k.)
   oxirgi saqlangan nusxaning roli, u ham bo'lmasa — talaba. */
function isloh_getActiveRole() {
  const pageRole = isloh_getPageRole();
  if (ISLOH_PROFILE_DEFAULTS[pageRole]) return pageRole;

  const legacy = isloh_readJson(ISLOH_USER_KEY);
  const storedRole = legacy && legacy.role;
  return ISLOH_PROFILE_DEFAULTS[storedRole] ? storedRole : ISLOH_DEFAULT_ROLE;
}

function isloh_readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

/* Butun do'konni o'qiydi. Yozuv yo'q bo'lsa null — chaqiruvchi shundan
   "hali ekilmagan" degan xulosa chiqaradi. */
function isloh_readProfiles() {
  const stored = isloh_readJson(ISLOH_PROFILES_KEY);
  if (stored && typeof stored === 'object') return stored;
  return isloh_migrateLegacyUser();
}

/* Eski bitta foydalanuvchili yozuv (`isloh_user`) rol bo'yicha do'konga
   ko'chiriladi — foydalanuvchi tahrirlagan ism yoki yuklagan avatar
   yangilanishdan keyin yo'qolib ketmasin.

   Ko'chirish darhol yoziladi ham: aks holda eski kalit manba bo'lib qolar
   va migratsiya har o'qishda qaytadan bajarilaverardi. */
function isloh_migrateLegacyUser() {
  const legacy = isloh_readJson(ISLOH_USER_KEY);
  if (!legacy || typeof legacy !== 'object') return null;

  const role = ISLOH_PROFILE_DEFAULTS[legacy.role] ? legacy.role : ISLOH_DEFAULT_ROLE;
  const migrated = {};
  migrated[role] = legacy;

  if (!isloh_userSeedSuppressed) {
    try { localStorage.setItem(ISLOH_PROFILES_KEY, JSON.stringify(migrated)); } catch (e) { /* kvota */ }
  }
  return migrated;
}

/* Do'kondan faqat o'qiydi — hech qachon yozmaydi. `stored` null bo'lishi
   shu rol uchun yozuv yo'qligini bildiradi. */
function isloh_readUserProfile(role) {
  const activeRole = role || isloh_getActiveRole();
  const profiles = isloh_readProfiles();
  const stored = (profiles && profiles[activeRole]) || null;
  const defaults = ISLOH_PROFILE_DEFAULTS[activeRole] || ISLOH_PROFILE_DEFAULTS[ISLOH_DEFAULT_ROLE];
  return { role: activeRole, stored: stored, user: Object.assign({}, defaults, stored || {}) };
}

/* Joriy (yoki so'ralgan rolning) profilini qaytaradi. Birinchi chaqiruvda
   standart profil ekiladi, shunda demo sahifalar hech qachon bo'sh
   ko'rinmaydi. */
function isloh_getUserProfile(role) {
  const result = isloh_readUserProfile(role);
  if (!result.stored && !isloh_userSeedSuppressed) isloh_persistUserProfile(result.user, result.role);
  return result.user;
}

/* Yozishning o'zi. Kvota to'lgan bo'lsa (katta avatar) false qaytaradi —
   chaqiruvchi foydalanuvchiga xabar beradi, jim yiqilmaydi. */
function isloh_persistUserProfile(user, role) {
  const activeRole = role || user.role || isloh_getActiveRole();
  const profiles = isloh_readProfiles() || {};
  profiles[activeRole] = user;

  try {
    localStorage.setItem(ISLOH_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) {
    return false;
  }
  isloh_mirrorActiveUser(user, activeRole);
  return true;
}

/* `isloh_user` — aktiv rol profilining nusxasi. Uni o'qiydigan modullar
   (certificate-engine, settings-danger) rol haqida bilmasligi uchun shu
   ko'prik saqlanadi. Nusxa yozilmasa ham asosiy do'kon buzilmaydi. */
function isloh_mirrorActiveUser(user, role) {
  if (role !== isloh_getActiveRole()) return;
  try { localStorage.setItem(ISLOH_USER_KEY, JSON.stringify(user)); } catch (e) { /* kvota */ }
}

/* Profilni qisman yangilaydi va butun sahifani qayta sinxronlaydi.
   Muvaffaqiyatda yangilangan obyektni, kvota xatosida null qaytaradi. */
function isloh_updateUserProfile(newData, role) {
  const activeRole = role || isloh_getActiveRole();
  const user = Object.assign({}, isloh_getUserProfile(activeRole), newData || {});
  if (!isloh_persistUserProfile(user, activeRole)) return null;

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
  return isloh_dtMonthYear(value) || String(value);
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
     [data-user-avatar]    -> rasm yoki bosh harflar

   Qo'shimcha bayroq:
     [data-user-hide-empty] -> qiymat bo'sh bo'lsa shu o'ram yashiriladi.
     Bo'sh joylashuv yonida yolg'iz geo-ikonka yoki qiymatsiz "Til" yorlig'i
     osilib qolmasligi uchun. O'ramning o'zida ham turishi mumkin.        */
const ISLOH_USER_TEXT_BINDINGS = {
  'data-user-name': (u) => u.name,
  /* Salomlashish uchun faqat ism ("Salom, Akmal!") — to'liq ism juda uzun. */
  'data-user-firstname': (u) => String(u.name || '').trim().split(/\s+/)[0],
  'data-user-email': (u) => u.email,
  'data-user-headline': (u) => u.headline,
  'data-user-role-line': (u) => [u.headline, u.location].filter(Boolean).join(' · '),
  'data-user-bio': (u) => u.bio,
  'data-user-location': (u) => u.location,
  'data-user-languages': (u) => u.languages,
  'data-user-joined': (u) => isloh_formatJoinedDate(u.joined)
};

/* Binding atributi QIYMATSIZ bayroq bo'lishi shart: `<h2 data-user-name>`.
   Qiymatli atribut boshqa modulning ma'lumoti (masalan admin jadvalidagi
   `data-user-row-name="Bekzod Odilov"`) — unga tegilmaydi, aks holda bu
   sinxron begona bo'limlarning matnini o'chirib yuborardi. */
function isloh_bindingTargets(attr) {
  return [...document.querySelectorAll('[' + attr + ']')]
    .filter((el) => el.getAttribute(attr) === '');
}

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

/* `options.noSeed` — do'kon bo'sh bo'lsa ham standart profil YOZILMAYDI.
   Boshqa tabdagi o'zgarishga javob berganda shu rejim ishlatiladi: aks holda
   bir tabda hisob o'chirilganda, ikkinchi tab uni darhol tiklab qo'yardi. */
function isloh_syncUserUI(options) {
  const result = isloh_readUserProfile();
  const user = (options && options.noSeed) ? result.user : isloh_getUserProfile(result.role);

  Object.keys(ISLOH_USER_TEXT_BINDINGS).forEach((attr) => {
    isloh_bindingTargets(attr).forEach((el) => {
      const value = ISLOH_USER_TEXT_BINDINGS[attr](user) || '';
      el.textContent = value;

      const holder = el.closest('[data-user-hide-empty]');
      if (holder) holder.hidden = !value;
    });
  });

  isloh_bindingTargets('data-user-avatar').forEach((el) => isloh_renderUserAvatar(el, user));

  /* Topbar avatari hali `data-user-avatar` qo'yilmagan sahifalarda ham
     avtomatik yangilanadi. Har sahifa endi O'Z rolining profilini
     ko'rsatgani uchun ilgarigi "rol mos kelsagina" cheklovi kerak emas.

     Selektor `.topbar` emas, `.topbar-actions` bo'yicha: ba'zi sahifalarda
     (masalan student dashboard) avatar alohida topbar ichida emas, sahifa
     sarlavhasi yonidagi `.topbar-actions` blokida turadi. */
  document.querySelectorAll('.topbar-actions .avatar:not([data-user-avatar])')
    .forEach((el) => isloh_renderUserAvatar(el, user));

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

/* --- 4) "Hisob" formasi (account.html) ------------------------------------
   Markup shartnomasi:
     [data-user-field="name|email|bio|headline|location"] -> input/textarea
     [data-user-save]                                     -> saqlash tugmasi
   Forma har doim SAHIFA ROLINING profilini tahrirlaydi. */
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

/* Sahifa ochilganda `isloh_user` nusxasi shu sahifaning roliga tenglashadi.
   Aks holda nusxa oxirgi EKILGAN roldan qolib ketardi: instruktor sahifasidan
   talaba sahifasiga o'tilganda nusxada hali instruktor turardi. */
function isloh_refreshActiveMirror() {
  if (isloh_userSeedSuppressed) return;
  const result = isloh_readUserProfile();
  if (result.stored) isloh_mirrorActiveUser(result.user, result.role);
}

function isloh_initProfileModule() {
  isloh_syncUserUI();
  isloh_refreshActiveMirror();
  isloh_initAvatarUpload();
  isloh_initAccountForm();
}

/* Boshqa tabda profil o'zgarsa, bu sahifa ham yangilanadi — lekin do'konga
   hech narsa yozmasdan (yuqoridagi noSeed izohiga qarang). */
window.addEventListener('storage', (e) => {
  if (e.key === ISLOH_PROFILES_KEY || e.key === ISLOH_USER_KEY) isloh_syncUserUI({ noSeed: true });
});

document.addEventListener('DOMContentLoaded', isloh_initProfileModule);
