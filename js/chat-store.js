/* ==========================================================================
   ISLOH — Xabarlar do'koni (chat-store)
   Uchala rol (talaba / instruktor / admin) uchun YAGONA suhbat grafi.

   NEGA KERAK BO'LDI: ilgari butun mantiq js/chat.js ichida edi va faqat
   1-ga-1 suhbatni bilardi — `thread.participantId` bitta foydalanuvchi,
   yuboruvchi esa `'me'` degan oddiy satr. Bundan ikkita muammo chiqardi:

     1) Guruh suhbati (kurs oqimi) modelga umuman sig'masdi, shuning uchun
        pages/instructor/messages.html butunlay qattiq yozilgan maket edi.
     2) `'me'` rolni bilmagani uchun instruktor va talaba bir xil uchta
        kalitni bo'lishsa, ikkalasi ham AYNI threadlarni AYNI "men" nomidan
        ko'rardi — ya'ni talaba yozgan xabar instruktorga bormasdi.

   YECHIM: thread endi `members[]` ro'yxatiga ega, "men" esa sahifa rolidan
   kelib chiqadigan haqiqiy foydalanuvchi id'si. Bitta thread ikki tomondan
   ham ko'rinadi: talaba yozgan xabar instruktor qutisida o'qilmagan bo'lib
   paydo bo'ladi.

   DO'KON (localStorage):

     isloh_chat_users    — [{ id, name, email, avatar, role, presence }]
     isloh_chat_threads  — [{ id, type:'direct'|'group', members:[userId],
                              title, avatar, courseId, lastMessage,
                              lastSenderId, timestamp,
                              unread:{ [userId]: n }, archived, muted,
                              pinnedNote }]
     isloh_chat_messages — { [threadId]: [{ id, senderId, text, timestamp }] }
     isloh_chat_meta     — { v: 2 }   ← migratsiya belgisi

   `direct` threadda `title`/`avatar` bo'lmaydi — ular suhbatdoshdan
   olinadi (isloh_chatThreadTitle). `group` threadda esa o'zining nomi va
   rangi bor.

   Rol hisoblari js/profile.js dagi ISLOH_PROFILE_DEFAULTS bilan bir xil
   id'ga ega (std-001 / inst-001 / adm-001), shu sababli profil sahifasida
   o'zgartirilgan ism chatda ham ko'rinadi (isloh_chatSyncMyProfile).

   `presence` — hozircha statik namuna ma'lumot: real onlayn holat WebSocket
   talab qiladi (CLAUDE.md §4, backend bosqichi). Uni "jonli" qilib
   ko'rsatmaymiz, shunchaki do'konda saqlangan qiymat.

   fetch() ishlatilmaydi (CLAUDE.md §3 — file:// protokoli).
   ========================================================================== */

const ISLOH_CHAT_USERS_KEY = 'isloh_chat_users';
const ISLOH_CHAT_THREADS_KEY = 'isloh_chat_threads';
const ISLOH_CHAT_MESSAGES_KEY = 'isloh_chat_messages';
const ISLOH_CHAT_META_KEY = 'isloh_chat_meta';
const ISLOH_CHAT_VERSION = 2;

/* Rol → do'kondagi hisob id'si. Sidebar'siz sahifalarda (auth va h.k.)
   talaba deb qaraladi — js/profile.js dagi ISLOH_DEFAULT_ROLE bilan bir xil. */
const ISLOH_CHAT_ROLE_IDS = { student: 'std-001', instructor: 'inst-001', admin: 'adm-001' };
const ISLOH_CHAT_DEFAULT_ROLE = 'student';

/* Holat nomlari — tarjima kaliti va o'zbekcha asl matn juftligi.
   Tarjimani js/i18n.js beradi (isloh_tx), u ulanmagan bo'lsa o'zbekcha
   qoladi. */
const ISLOH_CHAT_PRESENCE_LABEL = {
  online: ['chat.presence.online', 'Onlayn'],
  busy: ['chat.presence.busy', 'Band'],
  offline: ['chat.presence.offline', 'Oflayn']
};

/* `{n}` kabi o'rinbosarlarni to'ldiradi. js/i18n.js dagi `isloh_tx` ham
   shuni qiladi, lekin bu modul yon menyu nishoni uchun i18n.js ulanmagan
   sahifaga ham borishi mumkin — u holda o'zbekcha matn o'rinbosarlari
   to'ldirilmay, ekranda "{n} ta o'qilmagan xabar" bo'lib qolardi. */
function isloh_chatFill(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/* JS ichida yasaladigan matn uchun qisqartma: tarjimasi bo'lsa — o'sha,
   bo'lmasa o'zbekcha asl matn. */
function isloh_chatT(key, uz, vars) {
  if (typeof isloh_tx === 'function') return isloh_tx(key, uz, vars);
  return isloh_chatFill(uz, vars);
}

/* Avatar ranglari — dizayn token'i emas, foydalanuvchi ma'lumotining bir
   qismi (har bir odam uchun boshqacha). Takrorlanmasligi uchun nomlangan
   ro'yxatda turadi. */
const ISLOH_CHAT_AVATARS = {
  violet: 'linear-gradient(135deg,#6C5DD3,#4338CA)',
  sky: 'linear-gradient(135deg,#0EA5E9,#0369A1)',
  green: 'linear-gradient(135deg,#1FAE5E,#0F7A3D)',
  emerald: 'linear-gradient(135deg,#059669,#10B981)',
  teal: 'linear-gradient(135deg,#0F766E,#14B8A6)',
  pink: 'linear-gradient(135deg,#DB2777,#F472B6)',
  purple: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)',
  orange: 'linear-gradient(135deg,#F97316,#EA580C)',
  python: 'linear-gradient(135deg,#306998,#FFD43B)',
  neutral: 'var(--ink-300)'
};

/* --- 0) Past darajadagi o'qish/yozish ------------------------------------ */

function isloh_chatRead(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

/* Kvota to'lganda jim yiqilmaslik uchun natija qaytariladi (js/profile.js
   dagi bir xil naqsh) — chaqiruvchi foydalanuvchiga xabar bera oladi. */
function isloh_chatWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/* --- 1) Joriy foydalanuvchi ("men") -------------------------------------- */

/* Sahifa roli yon menyudan olinadi. Aynan shu naqsh js/theme.js,
   js/settings-store.js va js/profile.js da ham ishlatiladi — chat sahifalari
   profile.js ni har doim ham ulamagani uchun bu yerda takrorlanadi. */
function isloh_chatRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  const role = aside ? aside.dataset.role : '';
  return ISLOH_CHAT_ROLE_IDS[role] ? role : ISLOH_CHAT_DEFAULT_ROLE;
}

function isloh_chatMeId() {
  return ISLOH_CHAT_ROLE_IDS[isloh_chatRole()];
}

function isloh_chatMe() {
  return isloh_chatUser(isloh_chatMeId());
}

/* --- 2) Ekiladigan namuna ma'lumot --------------------------------------- */

/* Uchta rol hisobi + ular bilan yozishadigan odamlar. Emaillar barcha
   joyda bitta xil bo'lishi muhim: stage 3 dagi "Xabar yozish" havolasi
   talabani aynan email orqali topadi. */
function isloh_chatSeedUsers() {
  return [
    /* --- Rol hisoblari (profile.js dagi id va email bilan bir xil) --- */
    { id: 'std-001', name: 'Samar Mirzayev', email: 'samar@example.com', avatar: ISLOH_CHAT_AVATARS.sky, role: 'student', presence: 'online' },
    { id: 'inst-001', name: 'Akmal Yusupov', email: 'akmal@example.com', avatar: ISLOH_CHAT_AVATARS.violet, role: 'instructor', presence: 'online' },
    /* Admin chatda shaxs emas, qo'llab-quvvatlash xizmati sifatida
       ko'rinadi — talaba "Admin" bilan emas, "Isloh Support" bilan
       yozishadi. Profil sahifasidagi ism bundan mustaqil. */
    { id: 'adm-001', name: 'Isloh Support', email: 'support@isloh.uz', avatar: ISLOH_CHAT_AVATARS.neutral, role: 'admin', presence: 'busy' },

    /* --- Boshqa o'qituvchilar (talaba tomonidan ko'rinadi) --- */
    { id: 'u2', name: 'Dilnoza Rakhimova', email: 'dilnoza@isloh.uz', avatar: ISLOH_CHAT_AVATARS.sky, role: 'instructor', presence: 'online' },
    { id: 'u3', name: 'Aziz Karimov', email: 'aziz@isloh.uz', avatar: ISLOH_CHAT_AVATARS.green, role: 'instructor', presence: 'offline' },
    { id: 'u5', name: 'Malika Tosheva', email: 'malika@isloh.uz', avatar: ISLOH_CHAT_AVATARS.pink, role: 'student', presence: 'offline' },

    /* --- Instruktorning talabalari (pages/instructor/students.html) --- */
    { id: 's-javohir', name: 'Javohir Rasimov', email: 'javohir@example.com', avatar: ISLOH_CHAT_AVATARS.orange, role: 'student', presence: 'online' },
    { id: 's-bekzod', name: 'Bekzod Odilov', email: 'bekzod@example.com', avatar: ISLOH_CHAT_AVATARS.sky, role: 'student', presence: 'offline' },
    { id: 's-alisher', name: 'Alisher Karimov', email: 'alisher@example.com', avatar: ISLOH_CHAT_AVATARS.purple, role: 'student', presence: 'offline' },
    { id: 's-nodira', name: 'Nodira Yusupova', email: 'nodira@example.com', avatar: ISLOH_CHAT_AVATARS.pink, role: 'student', presence: 'online' },
    { id: 's-sardor', name: 'Sardor Aliyev', email: 'sardor@example.com', avatar: ISLOH_CHAT_AVATARS.emerald, role: 'student', presence: 'offline' }
  ];
}

/* Suhbatlar bitta umumiy grafda yashaydi: `th1` talabaning ro'yxatida ham,
   instruktorning ro'yxatida ham chiqadi — faqat qarama-qarshi tomondan. */
function isloh_chatSeedThreads() {
  const now = Date.now();
  return [
    /* Talaba ↔ instruktor (talaba tomonida ilgari ham shu suhbat bor edi) */
    { id: 'th1', type: 'direct', members: ['std-001', 'inst-001'], lastMessage: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", lastSenderId: 'inst-001', timestamp: now - 24 * 60000, unread: { 'std-001': 2 } },
    { id: 'th2', type: 'direct', members: ['std-001', 'u3'], lastMessage: 'Rahmat, qabul qildim!', lastSenderId: 'u3', timestamp: now - 26 * 3600000, unread: {} },
    { id: 'th3', type: 'direct', members: ['std-001', 'adm-001'], lastMessage: 'Qanday yordam bera olamiz?', lastSenderId: 'adm-001', timestamp: now - 26 * 3600000, unread: {} },

    /* Instruktorning kurs guruhlari */
    /* `lastMessage` doim SOF matn — yuboruvchi ismi ro'yxatda chizishda
       qo'shiladi (js/chat.js), do'konda takrorlanmaydi. */
    {
      id: 'thg1', type: 'group', title: 'Python Backend', courseId: 'py-101',
      avatar: ISLOH_CHAT_AVATARS.python,
      members: ['inst-001', 'std-001', 's-nodira', 's-bekzod', 's-sardor'],
      pinnedNote: "6-modul (Deployment) darsi ertaga soat 18:00 da boshlanadi",
      lastMessage: 'Rahmat ustoz, tushundim!',
      lastSenderId: 's-bekzod', timestamp: now - 10 * 60000, unread: { 'inst-001': 1, 'std-001': 1 }
    },
    {
      id: 'thg2', type: 'group', title: 'Django REST', courseId: 'django-rest',
      avatar: ISLOH_CHAT_AVATARS.teal,
      members: ['inst-001', 's-javohir', 's-nodira'],
      lastMessage: 'Serializer xatosini tuzatdim',
      lastSenderId: 's-javohir', timestamp: now - 3 * 3600000, unread: {}
    },

    /* Instruktor ↔ talabalar / support */
    { id: 'th4', type: 'direct', members: ['inst-001', 's-alisher'], lastMessage: 'Sertifikat uchun rahmat!', lastSenderId: 's-alisher', timestamp: now - 27 * 3600000, unread: {} },
    { id: 'th5', type: 'direct', members: ['inst-001', 'adm-001'], lastMessage: "Yangi to'lov usuli tasdiqlandi", lastSenderId: 'adm-001', timestamp: now - 2 * 86400000, unread: {} },
    /* Arxivlangan suhbat — "Arxiv" tab'i bo'sh ko'rinmasligi uchun */
    { id: 'th6', type: 'direct', members: ['inst-001', 's-bekzod'], lastMessage: 'Kurs yakunlandi, omad!', lastSenderId: 'inst-001', timestamp: now - 21 * 86400000, unread: {}, archived: true },

    /* Support qutisi (admin tomoni) */
    { id: 'th7', type: 'direct', members: ['adm-001', 'u2'], lastMessage: "Kursimni ko'rib chiqishni so'ragan edim", lastSenderId: 'u2', timestamp: now - 5 * 3600000, unread: { 'adm-001': 1 } }
  ];
}

function isloh_chatSeedMessages() {
  const now = Date.now();
  return {
    th1: [
      { id: 'm1', senderId: 'inst-001', text: "Salom! Bugungi darslar materiallarini yukladim, ko'rib chiqing 📂", timestamp: now - 30 * 60000 },
      { id: 'm2', senderId: 'std-001', text: "Rahmat, hozir tekshirib ko'raman!", timestamp: now - 27 * 60000 },
      { id: 'm3', senderId: 'inst-001', text: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", timestamp: now - 24 * 60000 }
    ],
    th2: [
      { id: 'm4', senderId: 'u3', text: 'Rahmat, qabul qildim!', timestamp: now - 26 * 3600000 }
    ],
    th3: [
      { id: 'm5', senderId: 'adm-001', text: 'Qanday yordam bera olamiz?', timestamp: now - 26 * 3600000 }
    ],
    thg1: [
      { id: 'm6', senderId: 's-nodira', text: "Ustoz, 5-dars bo'yicha savolim bor edi — ManyToMany maydonlarni serializerda qanday ko'rsataman?", timestamp: now - 22 * 60000 },
      { id: 'm7', senderId: 'inst-001', text: 'Salom Nodira! SlugRelatedField yoki nested serializer ishlatishingiz mumkin. Hozir kodini yuboraman 👍', timestamp: now - 17 * 60000 },
      { id: 'm8', senderId: 'inst-001', text: 'Bu masala bo\'yicha video ham qo\'shdim, "Materiallar" bo\'limini tekshiring.', timestamp: now - 16 * 60000 },
      { id: 'm9', senderId: 's-bekzod', text: 'Rahmat ustoz, tushundim!', timestamp: now - 10 * 60000 }
    ],
    thg2: [
      { id: 'm10', senderId: 's-javohir', text: 'Serializer xatosini tuzatdim', timestamp: now - 3 * 3600000 }
    ],
    th4: [
      { id: 'm11', senderId: 's-alisher', text: 'Sertifikat uchun rahmat!', timestamp: now - 27 * 3600000 }
    ],
    th5: [
      { id: 'm12', senderId: 'adm-001', text: "Yangi to'lov usuli tasdiqlandi", timestamp: now - 2 * 86400000 }
    ],
    th6: [
      { id: 'm13', senderId: 'inst-001', text: 'Kurs yakunlandi, omad!', timestamp: now - 21 * 86400000 }
    ],
    th7: [
      { id: 'm14', senderId: 'u2', text: "Kursimni ko'rib chiqishni so'ragan edim", timestamp: now - 5 * 3600000 }
    ]
  };
}

/* --- 3) Migratsiya (1-versiya → 2-versiya) -------------------------------
   Eski shakl faqat talaba chatida ishlatilgan, shuning uchun egasi har doim
   std-001. Eski `'me'` yuboruvchisi ham shunga aylanadi.

   Eski id'lar yangi rol hisoblariga ko'chiriladi: `u1` (Akmal Yuldashev)
   aslida instruktorning o'zi edi, `u4` esa support. Ko'chirilmasa,
   talabaning saqlangan suhbati instruktor qutisiga hech qachon tushmasdi. */
const ISLOH_CHAT_LEGACY_IDS = { u1: 'inst-001', u4: 'adm-001', me: 'std-001' };

function isloh_chatMapLegacyId(id) {
  return ISLOH_CHAT_LEGACY_IDS[id] || id;
}

function isloh_chatMigrateThreads(oldThreads) {
  return oldThreads.map((t) => {
    const peer = isloh_chatMapLegacyId(t.participantId);
    const unread = {};
    if (t.unreadCount) unread['std-001'] = t.unreadCount;
    return {
      id: t.id,
      type: 'direct',
      members: ['std-001', peer],
      lastMessage: t.lastMessage || '',
      lastSenderId: peer,
      timestamp: t.timestamp || Date.now(),
      unread: unread
    };
  });
}

function isloh_chatMigrateMessages(oldMessages) {
  const out = {};
  Object.keys(oldMessages || {}).forEach((threadId) => {
    out[threadId] = (oldMessages[threadId] || []).map((m) => ({
      id: m.id,
      senderId: isloh_chatMapLegacyId(m.senderId),
      text: m.text,
      timestamp: m.timestamp
    }));
  });
  return out;
}

/* Eski katalogdagi foydalanuvchilar yangi ekilgan ro'yxatga qo'shiladi:
   foydalanuvchi qo'lda boshlagan suhbatning suhbatdoshi yo'qolmasin. */
function isloh_chatMigrateUsers(oldUsers) {
  const seeded = isloh_chatSeedUsers();
  const known = new Set(seeded.map((u) => u.id));
  (oldUsers || []).forEach((u) => {
    const id = isloh_chatMapLegacyId(u.id);
    if (!known.has(id)) {
      seeded.push(Object.assign({}, u, { id: id }));
      known.add(id);
    }
  });
  return seeded;
}

/* --- 4) Do'konni tayyorlash ---------------------------------------------- */

/* Bir sahifa yuklanishida faqat bir marta bajariladi. Uchala kalit ham
   birga tekshiriladi: yarim ko'chirilgan holat qolib ketmasligi kerak. */
let isloh_chatReady = false;

function isloh_chatEnsureStore() {
  if (isloh_chatReady) return;
  isloh_chatReady = true;

  const meta = isloh_chatRead(ISLOH_CHAT_META_KEY);
  /* Profil sinxroni har yuklashda bajariladi — foydalanuvchi ismini
     ekilgandan KEYIN o'zgartirgan bo'lishi mumkin. */
  if (meta && meta.v === ISLOH_CHAT_VERSION) { isloh_chatSyncMyProfile(); return; }

  const oldThreads = isloh_chatRead(ISLOH_CHAT_THREADS_KEY);
  const isLegacy = Array.isArray(oldThreads) && oldThreads.length && oldThreads[0].participantId !== undefined;

  if (isLegacy) {
    /* Foydalanuvchi yozgan xabarlar saqlanib qoladi, ekilgan suhbatlar esa
       ustiga qo'shiladi (id bo'yicha eski nusxa ustuvor). */
    const migrated = isloh_chatMigrateThreads(oldThreads);
    const migratedIds = new Set(migrated.map((t) => t.id));
    const merged = migrated.concat(isloh_chatSeedThreads().filter((t) => !migratedIds.has(t.id)));

    const oldMessages = isloh_chatMigrateMessages(isloh_chatRead(ISLOH_CHAT_MESSAGES_KEY) || {});
    const seededMessages = isloh_chatSeedMessages();
    Object.keys(seededMessages).forEach((id) => {
      if (!oldMessages[id]) oldMessages[id] = seededMessages[id];
    });

    isloh_chatWrite(ISLOH_CHAT_USERS_KEY, isloh_chatMigrateUsers(isloh_chatRead(ISLOH_CHAT_USERS_KEY)));
    isloh_chatWrite(ISLOH_CHAT_THREADS_KEY, merged);
    isloh_chatWrite(ISLOH_CHAT_MESSAGES_KEY, oldMessages);
  } else {
    isloh_chatWrite(ISLOH_CHAT_USERS_KEY, isloh_chatSeedUsers());
    isloh_chatWrite(ISLOH_CHAT_THREADS_KEY, isloh_chatSeedThreads());
    isloh_chatWrite(ISLOH_CHAT_MESSAGES_KEY, isloh_chatSeedMessages());
  }

  isloh_chatWrite(ISLOH_CHAT_META_KEY, { v: ISLOH_CHAT_VERSION });
  isloh_chatSyncMyProfile();
}

/* Profil sahifasida o'zgartirilgan ism/email katalogda ham yangilanadi.
   js/profile.js har bir sahifada ulanmagan, shuning uchun mavjudligi
   tekshiriladi — bo'lmasa do'kon o'zidagi qiymat bilan qolaveradi.
   Admin bundan istisno: uning chatdagi shaxsi — "Isloh Support" xizmati. */
function isloh_chatSyncMyProfile() {
  if (typeof isloh_getUserProfile !== 'function') return;
  const role = isloh_chatRole();
  if (role === 'admin') return;

  let profile;
  try { profile = isloh_getUserProfile(role); } catch (e) { return; }
  if (!profile) return;

  const users = isloh_chatRead(ISLOH_CHAT_USERS_KEY) || [];
  const me = users.find((u) => u.id === ISLOH_CHAT_ROLE_IDS[role]);
  if (!me) return;
  if (me.name === profile.name && me.email === profile.email) return;

  me.name = profile.name || me.name;
  me.email = profile.email || me.email;
  isloh_chatWrite(ISLOH_CHAT_USERS_KEY, users);
}

/* --- 5) O'qish ----------------------------------------------------------- */

function isloh_chatUsers() {
  isloh_chatEnsureStore();
  const users = isloh_chatRead(ISLOH_CHAT_USERS_KEY);
  return Array.isArray(users) ? users : [];
}

function isloh_chatUser(id) {
  return isloh_chatUsers().find((u) => u.id === id) || null;
}

function isloh_chatUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return isloh_chatUsers().find((u) => String(u.email).toLowerCase() === normalized) || null;
}

function isloh_chatAllThreads() {
  isloh_chatEnsureStore();
  const threads = isloh_chatRead(ISLOH_CHAT_THREADS_KEY);
  return Array.isArray(threads) ? threads : [];
}

/* Menga tegishli suhbatlar, eng yangisi tepada.
   Filtr: { archived: false, type: 'group', courseId: '...' } — berilmagan
   maydon tekshirilmaydi. `archived` sukut bo'yicha false, ya'ni arxiv
   alohida so'ralmasa ro'yxatga tushmaydi. */
function isloh_chatThreads(filter) {
  const f = filter || {};
  const me = isloh_chatMeId();
  const wantArchived = f.archived === true;

  return isloh_chatAllThreads()
    .filter((t) => (t.members || []).indexOf(me) !== -1)
    .filter((t) => Boolean(t.archived) === wantArchived)
    .filter((t) => (f.type ? t.type === f.type : true))
    .filter((t) => (f.courseId ? t.courseId === f.courseId : true))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function isloh_chatThread(id) {
  return isloh_chatAllThreads().find((t) => t.id === id) || null;
}

function isloh_chatMessages(threadId) {
  isloh_chatEnsureStore();
  const all = isloh_chatRead(ISLOH_CHAT_MESSAGES_KEY) || {};
  return all[threadId] || [];
}

/* --- 6) Ko'rsatish uchun yordamchilar ------------------------------------ */

function isloh_chatInitials(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/* `direct` threadda suhbatdosh — a'zolar ichidan men bo'lmagani.
   `group` threadda suhbatdosh yo'q (null). */
function isloh_chatPeer(thread) {
  if (!thread || thread.type === 'group') return null;
  const me = isloh_chatMeId();
  const peerId = (thread.members || []).find((id) => id !== me);
  return peerId ? isloh_chatUser(peerId) : null;
}

function isloh_chatThreadTitle(thread) {
  if (!thread) return '';
  if (thread.type === 'group') return thread.title || isloh_chatT('chat.group', 'Guruh');
  const peer = isloh_chatPeer(thread);
  return peer ? peer.name : isloh_chatT('chat.unknownUser', "Noma'lum foydalanuvchi");
}

function isloh_chatThreadAvatar(thread) {
  if (!thread) return 'var(--ink-300)';
  if (thread.type === 'group') return thread.avatar || 'var(--ink-300)';
  const peer = isloh_chatPeer(thread);
  return peer ? peer.avatar : 'var(--ink-300)';
}

/* Sarlavha ostidagi qator: guruhda a'zolar soni, 1-ga-1 da suhbatdosh
   holati. Onlayn soni katalogdagi `presence` dan sanaladi. */
function isloh_chatThreadSubtitle(thread) {
  if (!thread) return '';
  if (thread.type === 'group') {
    const members = thread.members || [];
    const online = members.filter((id) => {
      const u = isloh_chatUser(id);
      return u && u.presence === 'online';
    }).length;
    return isloh_chatT('chat.members', "{n} a'zo · {online} tasi onlayn", { n: members.length, online: online });
  }
  const peer = isloh_chatPeer(thread);
  if (!peer) return '';
  const label = ISLOH_CHAT_PRESENCE_LABEL[peer.presence];
  return label ? isloh_chatT(label[0], label[1]) : '';
}

/* Guruhda suhbatdosh bitta emas, shuning uchun nuqta rangi a'zolardan
   emas — guruh doim "neytral" ko'rinadi. */
function isloh_chatThreadPresence(thread) {
  if (!thread || thread.type === 'group') return '';
  const peer = isloh_chatPeer(thread);
  return peer ? peer.presence : '';
}

function isloh_chatUnread(thread) {
  if (!thread || !thread.unread) return 0;
  return thread.unread[isloh_chatMeId()] || 0;
}

function isloh_chatTotalUnread() {
  return isloh_chatThreads().reduce((sum, t) => sum + isloh_chatUnread(t), 0);
}

/* --- Yon menyudagi o'qilmaganlar nishoni ---------------------------------
   Bu modul yon menyusi bor barcha sahifalarga ulangan, shuning uchun
   nishon platforma bo'ylab ko'rinadi. js/sidebar.js menyuni chizib
   bo'lgach shu funksiyani chaqiradi (himoyalangan chaqiruv — chat-store
   ulanmagan sahifada menyu shunchaki nishonsiz qoladi).

   MUHIM: bu yerda do'kon EKILMAYDI. `isloh_chatTotalUnread()` chaqirilsa,
   chat sahifasini hech qachon ochmagan foydalanuvchida ham namuna
   suhbatlar yaratilib ketardi — sozlamalar yoki savatcha sahifasini
   ochish chat ma'lumotini tug'dirishi noto'g'ri bo'lardi. */
function isloh_chatBadgeCount() {
  const meta = isloh_chatRead(ISLOH_CHAT_META_KEY);
  if (!meta || meta.v !== ISLOH_CHAT_VERSION) return 0;

  const threads = isloh_chatRead(ISLOH_CHAT_THREADS_KEY);
  if (!Array.isArray(threads)) return 0;

  const me = isloh_chatMeId();
  return threads.reduce((sum, t) => {
    if (t.archived) return sum;
    if (!t.members || t.members.indexOf(me) === -1) return sum;
    return sum + ((t.unread && t.unread[me]) || 0);
  }, 0);
}

/* Nishon qaysi menyu bandiga qo'yilishi rolga bog'liq: talabada `chat`,
   instruktorda `messages`, adminda `admin-messages` (js/navigation.js). */
const ISLOH_CHAT_NAV_KEYS = { student: 'chat', instructor: 'messages', admin: 'admin-messages' };
const ISLOH_CHAT_BADGE_MAX = 99;

function isloh_chatMountNavBadge() {
  const count = isloh_chatBadgeCount();
  const key = ISLOH_CHAT_NAV_KEYS[isloh_chatRole()];
  const link = document.querySelector(`#sidebar-nav .nav-item[href*="${key}.html"]`);
  if (!link) return;

  const existing = link.querySelector('.nav-badge');
  if (!count) {
    if (existing) existing.remove();
    return;
  }

  const label = count > ISLOH_CHAT_BADGE_MAX ? ISLOH_CHAT_BADGE_MAX + '+' : String(count);
  const badge = existing || document.createElement('span');
  badge.className = 'nav-badge';
  badge.textContent = label;
  /* Raqamning o'zi ekran o'quvchi uchun ma'nosiz — nima sanalayotgani
     aytiladi. Qisqartirilgan "99+" emas, haqiqiy son o'qiladi. */
  badge.setAttribute('aria-label', isloh_chatT('chat.badge.aria', "{n} ta o'qilmagan xabar", { n: count }));
  if (!existing) link.appendChild(badge);
}

/* --- 7) Yozish ----------------------------------------------------------- */

function isloh_chatSaveThreads(threads) {
  return isloh_chatWrite(ISLOH_CHAT_THREADS_KEY, threads);
}

/* Bitta threadni topib o'zgartiradi va butun ro'yxatni qayta yozadi.
   `mutate` false qaytarsa (o'zgarish yo'q) yozuv bajarilmaydi. */
function isloh_chatUpdateThread(threadId, mutate) {
  const threads = isloh_chatAllThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  if (mutate(thread) === false) return thread;
  isloh_chatSaveThreads(threads);
  return thread;
}

/* Xabar yuborish. Grafda ikkala tomon ham bor, shuning uchun o'qilmagan
   hisoblagich yuboruvchidan boshqa BARCHA a'zolarga oshadi — instruktor
   javob yozsa, talaba uni o'qilmagan holatda ko'radi. */
function isloh_chatSend(threadId, text) {
  const clean = String(text || '').trim();
  if (!clean) return null;

  const thread = isloh_chatThread(threadId);
  if (!thread) return null;

  const me = isloh_chatMeId();
  const msg = { id: 'msg-' + Date.now(), senderId: me, text: clean, timestamp: Date.now() };

  const all = isloh_chatRead(ISLOH_CHAT_MESSAGES_KEY) || {};
  all[threadId] = (all[threadId] || []).concat(msg);
  if (!isloh_chatWrite(ISLOH_CHAT_MESSAGES_KEY, all)) return null;

  isloh_chatUpdateThread(threadId, (t) => {
    t.lastMessage = clean;
    t.lastSenderId = me;
    t.timestamp = msg.timestamp;
    t.unread = t.unread || {};
    (t.members || []).forEach((id) => {
      if (id !== me) t.unread[id] = (t.unread[id] || 0) + 1;
    });
    /* Javob yozgan odam threadni o'qigan bo'ladi — o'zimning hisoblagichim
       nolga tushadi, aks holda yuborgandan keyin ham "o'qilmagan" bo'lib
       turaverardi. */
    t.unread[me] = 0;
    /* Arxivlangan suhbatga yozilsa, u qaytadan faol bo'ladi */
    t.archived = false;
  });

  return msg;
}

function isloh_chatMarkRead(threadId) {
  const me = isloh_chatMeId();
  isloh_chatUpdateThread(threadId, (t) => {
    if (!t.unread || !t.unread[me]) return false;
    t.unread[me] = 0;
    return true;
  });
}

function isloh_chatSetArchived(threadId, archived) {
  isloh_chatUpdateThread(threadId, (t) => { t.archived = Boolean(archived); });
}

function isloh_chatSetMuted(threadId, muted) {
  isloh_chatUpdateThread(threadId, (t) => { t.muted = Boolean(muted); });
}

function isloh_chatSetPinnedNote(threadId, note) {
  isloh_chatUpdateThread(threadId, (t) => { t.pinnedNote = String(note || ''); });
}

/* Berilgan foydalanuvchi bilan 1-ga-1 suhbatni ochadi, bo'lmasa yaratadi.
   O'zim bilan suhbat bo'lmaydi. */
function isloh_chatOpenDirect(userId) {
  const me = isloh_chatMeId();
  if (!userId || userId === me) return null;
  if (!isloh_chatUser(userId)) return null;

  const existing = isloh_chatAllThreads().find((t) =>
    t.type === 'direct' && (t.members || []).indexOf(me) !== -1 && (t.members || []).indexOf(userId) !== -1
  );
  if (existing) return existing;

  const thread = {
    id: 'th-' + Date.now(),
    type: 'direct',
    members: [me, userId],
    lastMessage: '',
    lastSenderId: '',
    timestamp: Date.now(),
    unread: {}
  };
  const threads = isloh_chatAllThreads();
  threads.unshift(thread);
  if (!isloh_chatSaveThreads(threads)) return null;
  return thread;
}
