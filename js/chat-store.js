/* ==========================================================================
   ISLOH — Xabarlar do'koni (chat-store)
   Uchala rol (talaba / instruktor / admin) uchun YAGONA suhbat grafi.

   MODEL: thread `members[]` ro'yxatiga ega, "men" esa haqiqiy
   foydalanuvchi id'si. Bitta suhbat ikki tomondan ko'rinadi — talaba
   yozgan xabar instruktor qutisida o'qilmagan bo'lib paydo bo'ladi.

   --- M8 (backend): MANBA ENDI SERVER ------------------------------------

   Ilgari butun graf `localStorage` da yashardi va shu sababli suhbat
   FAQAT bitta brauzerda mavjud edi: "talaba yozgan xabar instruktorga
   boradi" degan gap aslida bir odam ikki rolni almashtirib ko'rgandagina
   to'g'ri edi. Endi manba — server:

       GET    /chat/threads                    suhbatlar (massiv)
       GET    /chat/users?q=                   kontaktlar katalogi (massiv)
       GET    /chat/threads/{id}/messages      KURSOR bo'yicha (?before=)
       POST   /chat/threads/{id}/messages      yuborish
       POST   /chat/threads/{id}/read          o'qilgan deb belgilash
       PATCH  /chat/threads/{id}               arxiv / ovoz / e'lon
       POST   /chat/threads/direct             1-ga-1 suhbat ochish
       POST   /chat/threads/course/{id}        kurs guruhini ochish
       GET    /chat/unread-count               yon menyu nishoni

   `localStorage` ning roli o'zgardi: u endi MANBA emas, OFFLINE NUSXA
   (js/api.js dagi fabrika bilan bir xil qoida). Namunaviy ma'lumot esa
   faqat `file://` va tarmoq uzilganda ko'rinadi.

   --- NEGA UMUMIY FABRIKA (isloh_createStoreCache) ISHLATILMADI ----------

   Sabab js/discussion-store.js dagi bilan bir xil, lekin bu yerda
   kuchliroq: fabrika BITTA yassi massiv ustida ishlaydi, chat esa uchta
   bog'liq to'plam (suhbatlar + katalog + har bir suhbatning xabarlari) va
   har bir amal o'z manziliga boradi. Bundan tashqari xabarlar
   SAHIFALANADI — fabrikada bunday tushuncha yo'q.

   Fabrikaning naqshi esa saqlanadi: sinxron o'qish, optimistik yozish,
   xatoda ortga qaytarish, `isloh:*-updated` hodisasi.

   --- SINXRON SHARTNOMA SAQLANDI -----------------------------------------

   `isloh_chatThreads()`, `isloh_chatMessages()` va boshqalar AVVALGIDEK
   sinxron: sahifalar (js/chat.js) o'zgarmadi. Ma'lumot kelmagan bo'lsa
   ular kesh (yoki demo) qaytaradi va fonda yuklashni boshlaydi; javob
   kelgach `isloh:chat-updated` hodisasi qayta chizishga sabab bo'ladi.

   Ikkitasi ISTISNO va ular Promise qaytaradi, chunki natijasi serverdan
   keladi: `isloh_chatOpenDirect` va `isloh_chatOpenCourseGroup`.

   fetch() to'g'ridan-to'g'ri chaqirilmaydi — hammasi js/api.js orqali
   (CLAUDE.md §2, §3).
   ========================================================================== */

const ISLOH_CHAT_USERS_KEY = 'isloh_chat_users';
const ISLOH_CHAT_THREADS_KEY = 'isloh_chat_threads';
const ISLOH_CHAT_MESSAGES_KEY = 'isloh_chat_messages';
const ISLOH_CHAT_EVENT = 'isloh:chat-updated';

/* Bir sahifada ko'rsatiladigan xabarlar soni — serverdagi
   ISLOH_MESSAGE_PAGE bilan bir xil (apps/messaging/views.py). */
const ISLOH_CHAT_PAGE_SIZE = 50;

/* Rol → demo hisob id'si. FAQAT zaxira yo'lda ishlatiladi (`file://`,
   tarmoq yo'q): serverga ulangan holatda "men" — JWT ichidagi haqiqiy
   foydalanuvchi. */
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

/* Avatar ranglari — dizayn qarori, shuning uchun FRONTENDDA qoladi
   (CLAUDE.md §2). Server odamning rasm havolasini beradi, chat oynasi esa
   bosh harflarni rangli fon ustida chizadi: rang id'dan hisoblanadi, ya'ni
   bir odam har doim bir xil rangda ko'rinadi. */
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

const ISLOH_CHAT_AVATAR_KEYS = ['violet', 'sky', 'green', 'emerald', 'teal', 'pink', 'purple', 'orange'];

/* Id'dan barqaror rang. Tasodifiy tanlash yaramaydi: sahifa har
   yangilanganda odam boshqa rangda ko'rinardi. */
function isloh_chatAvatarFor(id) {
  const text = String(id || '');
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) sum = (sum + text.charCodeAt(i)) % 997;
  return ISLOH_CHAT_AVATARS[ISLOH_CHAT_AVATAR_KEYS[sum % ISLOH_CHAT_AVATAR_KEYS.length]];
}

/* --- 0) Past darajadagi o'qish/yozish ------------------------------------ */

function isloh_chatRead(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

/* Kvota to'lganda jim yiqilmaslik uchun natija qaytariladi (js/profile.js
   dagi bir xil naqsh). */
function isloh_chatWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/* Hodisa `document` ga yuboriladi — loyihadagi barcha obunachilar shu
   yerda tinglaydi (js/api.js dagi fabrikadagi bir xil izoh). */
function isloh_chatEmit() {
  document.dispatchEvent(new CustomEvent(ISLOH_CHAT_EVENT, { detail: ISLOH_CHAT.threads }));
}

/* --- 1) Joriy foydalanuvchi ("men") -------------------------------------- */

/* Sahifa roli yon menyudan olinadi. Aynan shu naqsh js/theme.js,
   js/settings-store.js va js/profile.js da ham ishlatiladi. */
function isloh_chatRole() {
  const aside = document.querySelector('.sidebar[data-role]');
  const role = aside ? aside.dataset.role : '';
  return ISLOH_CHAT_ROLE_IDS[role] ? role : ISLOH_CHAT_DEFAULT_ROLE;
}

/* "Men" — tokendagi haqiqiy id, u yo'q bo'lsa demo rol hisobi.

   ROL BO'YICHA ANIQLASH SERVERDA ISHLAMAYDI: bitta odam ham talaba, ham
   o'qituvchi bo'lishi mumkin va u ikkala sahifada ham AYNI shaxs. Id esa
   access token ichida yotadi (js/api.js — isloh_currentUserId), ya'ni
   qo'shimcha so'rov talab qilmaydi. */
function isloh_chatMeId() {
  const serverId = typeof islohApi !== 'undefined' ? islohApi.currentUserId() : '';
  return serverId || ISLOH_CHAT_ROLE_IDS[isloh_chatRole()];
}

/* --- 2) Namunaviy ma'lumot (faqat zaxira) -------------------------------- */

/* Ko'rinadigan joyi ikkita: `file://` ostida ochilgan sahifa va tarmoq
   uzilishi. Server javob bersa bu massivlar umuman ishlatilmaydi. */
function isloh_chatSeedUsers() {
  return [
    { id: 'std-001', name: 'Samar Mirzayev', email: 'samar@example.com', role: 'student', presence: 'online' },
    { id: 'inst-001', name: 'Akmal Yusupov', email: 'akmal@example.com', role: 'instructor', presence: 'online' },
    /* Admin chatda shaxs emas, qo'llab-quvvatlash xizmati sifatida
       ko'rinadi — talaba "Admin" bilan emas, "Isloh Support" bilan
       yozishadi. */
    { id: 'adm-001', name: 'Isloh Support', email: 'support@isloh.uz', role: 'admin', presence: 'busy' },
    { id: 's-javohir', name: 'Javohir Rasimov', email: 'javohir@example.com', role: 'student', presence: 'online' },
    { id: 's-bekzod', name: 'Bekzod Odilov', email: 'bekzod@example.com', role: 'student', presence: 'offline' },
    { id: 's-nodira', name: 'Nodira Yusupova', email: 'nodira@example.com', role: 'student', presence: 'online' }
  ].map(isloh_chatNormalizeUser);
}

function isloh_chatSeedThreads() {
  const now = Date.now();
  return [
    { id: 'th1', type: 'direct', members: ['std-001', 'inst-001'], lastMessage: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", lastSenderId: 'inst-001', timestamp: now - 24 * 60000, unread: { 'std-001': 2 } },
    { id: 'th3', type: 'direct', members: ['std-001', 'adm-001'], lastMessage: 'Qanday yordam bera olamiz?', lastSenderId: 'adm-001', timestamp: now - 26 * 3600000, unread: {} },
    {
      id: 'thg1', type: 'group', title: 'Python Backend', courseId: 'py-101',
      members: ['inst-001', 'std-001', 's-nodira', 's-bekzod'],
      pinnedNote: '6-modul (Deployment) darsi ertaga soat 18:00 da boshlanadi',
      lastMessage: 'Rahmat ustoz, tushundim!',
      lastSenderId: 's-bekzod', timestamp: now - 10 * 60000, unread: { 'inst-001': 1, 'std-001': 1 }
    },
    { id: 'th4', type: 'direct', members: ['inst-001', 's-javohir'], lastMessage: 'Sertifikat uchun rahmat!', lastSenderId: 's-javohir', timestamp: now - 27 * 3600000, unread: {} },
    { id: 'th6', type: 'direct', members: ['inst-001', 's-bekzod'], lastMessage: 'Kurs yakunlandi, omad!', lastSenderId: 'inst-001', timestamp: now - 21 * 86400000, unread: {}, archived: true },
    { id: 'th7', type: 'direct', members: ['adm-001', 's-nodira'], lastMessage: "Kursimni ko'rib chiqishni so'ragan edim", lastSenderId: 's-nodira', timestamp: now - 5 * 3600000, unread: { 'adm-001': 1 } }
  ].map(isloh_chatNormalizeThread);
}

function isloh_chatSeedMessages() {
  const now = Date.now();
  return {
    th1: [
      { id: 'm1', senderId: 'inst-001', text: "Salom! Bugungi darslar materiallarini yukladim, ko'rib chiqing 📂", timestamp: now - 30 * 60000 },
      { id: 'm2', senderId: 'std-001', text: "Rahmat, hozir tekshirib ko'raman!", timestamp: now - 27 * 60000 },
      { id: 'm3', senderId: 'inst-001', text: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", timestamp: now - 24 * 60000 }
    ],
    th3: [{ id: 'm5', senderId: 'adm-001', text: 'Qanday yordam bera olamiz?', timestamp: now - 26 * 3600000 }],
    thg1: [
      { id: 'm6', senderId: 's-nodira', text: 'Ustoz, ManyToMany maydonlarni serializerda qanday ko\'rsataman?', timestamp: now - 22 * 60000 },
      { id: 'm7', senderId: 'inst-001', text: 'Salom Nodira! SlugRelatedField yoki nested serializer ishlatishingiz mumkin 👍', timestamp: now - 17 * 60000 },
      { id: 'm9', senderId: 's-bekzod', text: 'Rahmat ustoz, tushundim!', timestamp: now - 10 * 60000 }
    ],
    th4: [{ id: 'm11', senderId: 's-javohir', text: 'Sertifikat uchun rahmat!', timestamp: now - 27 * 3600000 }],
    th6: [{ id: 'm13', senderId: 'inst-001', text: 'Kurs yakunlandi, omad!', timestamp: now - 21 * 86400000 }],
    th7: [{ id: 'm14', senderId: 's-nodira', text: "Kursimni ko'rib chiqishni so'ragan edim", timestamp: now - 5 * 3600000 }]
  };
}

/* --- 3) Server shakli → frontend shakli ----------------------------------
   Ikki shakl FAQAT shu uchta funksiyada uchrashadi (js/api.js dagi
   `normalize`/`serialize` juftligi bilan bir xil qoida). Frontend ichki
   shakli o'zgarmadi, ya'ni js/chat.js ga tegilmagan. */

function isloh_chatIsServerRow(row) {
  return row && (('last_message_at' in row) || ('pinned_note' in row) || ('created_at' in row));
}

function isloh_chatNormalizeUser(row) {
  const user = row || {};
  return {
    id: String(user.id || ''),
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'student',
    presence: user.presence || 'offline',
    /* Rasm havolasi saqlanadi (kelajakda kerak), fon esa id'dan */
    photo: user.photo || user.avatar_url || '',
    avatar: isloh_chatAvatarFor(user.id)
  };
}

/* Serverda `unread` — BITTA son (meniki), frontendda esa xarita: eski
   shakl shunday edi va js/chat.js undan `unread[meId]` ni o'qiydi. */
function isloh_chatNormalizeThread(row) {
  const thread = row || {};
  if (!isloh_chatIsServerRow(thread)) {
    return Object.assign(
      { type: 'direct', members: [], title: '', courseId: '', pinnedNote: '', lastMessage: '', lastSenderId: '', timestamp: Date.now(), unread: {}, archived: false, muted: false },
      thread
    );
  }

  const unread = {};
  unread[isloh_chatMeId()] = thread.unread || 0;
  const stamp = thread.last_message_at || thread.created_at;

  return {
    id: String(thread.id || ''),
    type: thread.type || 'direct',
    members: (thread.members || []).map(String),
    title: thread.title || '',
    courseId: thread.course ? String(thread.course) : '',
    pinnedNote: thread.pinned_note || '',
    lastMessage: thread.last_message || '',
    lastSenderId: thread.last_sender ? String(thread.last_sender) : '',
    timestamp: stamp ? new Date(stamp).getTime() : Date.now(),
    unread: unread,
    archived: !!thread.archived,
    muted: !!thread.muted
  };
}

function isloh_chatNormalizeMessage(row) {
  const msg = row || {};
  if (!msg.created_at) return msg;
  return {
    id: String(msg.id || ''),
    senderId: msg.sender ? String(msg.sender) : '',
    text: msg.text || '',
    timestamp: new Date(msg.created_at).getTime()
  };
}

/* --- 4) Kesh va yuklash --------------------------------------------------- */

/* Butun do'kon holati bitta obyektda: uchta to'plam bir-biriga bog'liq va
   ular alohida global o'zgaruvchilar bo'lganda qaysi biri yuklanganini
   kuzatish tarqoq bo'lardi. */
const ISLOH_CHAT = {
  users: [],
  threads: [],
  messages: {},       // { threadId: [msg] }
  pages: {},          // { threadId: { before, hasMore } }
  usersLoaded: false,
  threadsLoaded: false,
  usersPromise: null,
  threadsPromise: null,
  messagePromises: {},
  seeded: false
};

/* Offline nusxa; yo'q bo'lsa demo. Bu yerda localStorage'ga YOZILMAYDI —
   js/api.js dagi fabrikadagi bir xil sabab: seed yozilsa bo'sh holat
   hech qachon ko'rinmasdi va demo yozuvlar serverga ketib qolardi. */
function isloh_chatFallback() {
  if (ISLOH_CHAT.seeded) return;
  ISLOH_CHAT.seeded = true;

  const users = isloh_chatRead(ISLOH_CHAT_USERS_KEY);
  const threads = isloh_chatRead(ISLOH_CHAT_THREADS_KEY);
  const messages = isloh_chatRead(ISLOH_CHAT_MESSAGES_KEY);

  ISLOH_CHAT.users = Array.isArray(users) && users.length ? users.map(isloh_chatNormalizeUser) : isloh_chatSeedUsers();
  ISLOH_CHAT.threads = Array.isArray(threads) && threads.length ? threads.map(isloh_chatNormalizeThread) : isloh_chatSeedThreads();
  ISLOH_CHAT.messages = (messages && typeof messages === 'object') ? messages : isloh_chatSeedMessages();
}

function isloh_chatCacheLocally() {
  isloh_chatWrite(ISLOH_CHAT_USERS_KEY, ISLOH_CHAT.users);
  isloh_chatWrite(ISLOH_CHAT_THREADS_KEY, ISLOH_CHAT.threads);
  isloh_chatWrite(ISLOH_CHAT_MESSAGES_KEY, ISLOH_CHAT.messages);
}

/* Tarmoq xatosi bannerini bir marta ko'rsatadi (js/ui-feedback.js).
   `file://` da API umuman yo'q — bu kutilgan holat, banner shovqin
   bo'lardi (CLAUDE.md §3). */
function isloh_chatNetworkError(err, retry) {
  if (err && err.code === 'file_protocol') return;
  if (typeof islohUI !== 'undefined') islohUI.showNetworkError(retry, err && err.error);
}

function isloh_chatLoadUsers() {
  if (ISLOH_CHAT.usersPromise) return ISLOH_CHAT.usersPromise;

  ISLOH_CHAT.usersPromise = islohApi.get('/chat/users')
    .then((data) => {
      ISLOH_CHAT.users = (data || []).map(isloh_chatNormalizeUser);
      ISLOH_CHAT.usersLoaded = true;
      isloh_chatCacheLocally();
    })
    .catch((err) => {
      isloh_chatFallback();
      isloh_chatNetworkError(err, isloh_chatRetry);
    })
    .then(() => { isloh_chatEmit(); return ISLOH_CHAT.users; });

  return ISLOH_CHAT.usersPromise;
}

function isloh_chatLoadThreads() {
  if (ISLOH_CHAT.threadsPromise) return ISLOH_CHAT.threadsPromise;

  ISLOH_CHAT.threadsPromise = islohApi.get('/chat/threads')
    .then((data) => {
      ISLOH_CHAT.threads = (data || []).map(isloh_chatNormalizeThread);
      ISLOH_CHAT.threadsLoaded = true;
      isloh_chatCacheLocally();
    })
    .catch((err) => {
      isloh_chatFallback();
      isloh_chatNetworkError(err, isloh_chatRetry);
    })
    .then(() => { isloh_chatEmit(); return ISLOH_CHAT.threads; });

  return ISLOH_CHAT.threadsPromise;
}

function isloh_chatRetry() {
  ISLOH_CHAT.usersPromise = null;
  ISLOH_CHAT.threadsPromise = null;
  ISLOH_CHAT.seeded = false;
  return Promise.all([isloh_chatLoadUsers(), isloh_chatLoadThreads()]).then(() => {
    if (!ISLOH_CHAT.threadsLoaded) throw new Error('/chat/threads reload failed');
  });
}

/* Sahifa boshlanishida bir marta. Nomi eski shartnomadan qoldi, lekin
   endi u EKMAYDI — yuklashni boshlaydi. */
function isloh_chatEnsureStore() {
  if (ISLOH_CHAT.usersPromise) return;
  isloh_chatLoadUsers();
  isloh_chatLoadThreads();
}

/* Suhbat xabarlari — TALAB BO'YICHA. Ro'yxatdagi har bir suhbat uchun
   oldindan yuklash o'nlab so'rov bo'lardi. */
function isloh_chatLoadMessages(threadId, before) {
  if (!threadId) return Promise.resolve([]);
  if (!before && ISLOH_CHAT.messagePromises[threadId]) return ISLOH_CHAT.messagePromises[threadId];

  const params = { limit: ISLOH_CHAT_PAGE_SIZE };
  if (before) params.before = before;

  const request = islohApi.get('/chat/threads/' + threadId + '/messages', params)
    .then((page) => {
      const rows = ((page && page.results) || []).map(isloh_chatNormalizeMessage);
      const existing = ISLOH_CHAT.messages[threadId] || [];
      /* Eskiroq sahifa OLDINGA qo'shiladi, birinchi sahifa esa
         mavjudini almashtiradi */
      ISLOH_CHAT.messages[threadId] = before ? rows.concat(existing) : rows;
      ISLOH_CHAT.pages[threadId] = {
        before: (page && page.next_before) || '',
        hasMore: !!(page && page.has_more)
      };
      isloh_chatCacheLocally();
      isloh_chatEmit();
      return ISLOH_CHAT.messages[threadId];
    })
    .catch((err) => {
      isloh_chatFallback();
      isloh_chatNetworkError(err, () => isloh_chatLoadMessages(threadId));
      isloh_chatEmit();
      return ISLOH_CHAT.messages[threadId] || [];
    });

  if (!before) ISLOH_CHAT.messagePromises[threadId] = request;
  return request;
}

/* "Eskiroq xabarlar" — chat oynasi tepasiga chiqilganda. */
function isloh_chatLoadOlderMessages(threadId) {
  const page = ISLOH_CHAT.pages[threadId];
  if (!page || !page.hasMore || !page.before) return Promise.resolve(null);
  return isloh_chatLoadMessages(threadId, page.before);
}

function isloh_chatHasOlderMessages(threadId) {
  const page = ISLOH_CHAT.pages[threadId];
  return !!(page && page.hasMore);
}

/* --- 5) O'qish ----------------------------------------------------------- */

function isloh_chatUsers() {
  if (!ISLOH_CHAT.usersLoaded) { if (!ISLOH_CHAT.users.length) isloh_chatFallback(); isloh_chatLoadUsers(); }
  return ISLOH_CHAT.users;
}

function isloh_chatUser(id) {
  return isloh_chatUsers().find((u) => u.id === String(id)) || null;
}

/* Email bo'yicha qidiruv ATAYLAB YO'Q: mahalliy katalogda faqat
   KONTAKTLAR bor va u yerda topilmagan odam "mavjud emas" degani emas.
   "Yangi suhbat" oynasi email'ni to'g'ridan-to'g'ri serverga yuboradi
   (`isloh_chatOpenDirect({ email })`) — javobni faqat server bera oladi. */

function isloh_chatAllThreads() {
  if (!ISLOH_CHAT.threadsLoaded) { if (!ISLOH_CHAT.threads.length) isloh_chatFallback(); isloh_chatLoadThreads(); }
  return ISLOH_CHAT.threads;
}

/* Menga tegishli suhbatlar, eng yangisi tepada.
   Filtr: { archived: false, type: 'group', courseId: '...' } — berilmagan
   maydon tekshirilmaydi. `archived` sukut bo'yicha false, ya'ni arxiv
   alohida so'ralmasa ro'yxatga tushmaydi.

   A'ZOLIK BO'YICHA FILTR SAQLANDI, garchi server faqat menikini
   qaytarsa ham: zaxira (demo) grafda hamma suhbat bor va u yerda filtr
   kerak bo'ladi. */
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
  return isloh_chatAllThreads().find((t) => t.id === String(id)) || null;
}

/* Suhbat ochilganda chaqiriladi. Kesh bo'sh bo'lsa yuklash boshlanadi va
   javob kelgach `isloh:chat-updated` qayta chizadi. */
function isloh_chatMessages(threadId) {
  if (!threadId) return [];
  if (!(threadId in ISLOH_CHAT.messages)) {
    isloh_chatFallback();
    isloh_chatLoadMessages(threadId);
  }
  return ISLOH_CHAT.messages[threadId] || [];
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
  if (thread.type === 'group') return isloh_chatAvatarFor(thread.courseId || thread.id);
  const peer = isloh_chatPeer(thread);
  return peer ? peer.avatar : 'var(--ink-300)';
}

/* Sarlavha ostidagi qator: guruhda a'zolar soni, 1-ga-1 da suhbatdosh
   holati. Onlayn soni katalogdagi `presence` dan sanaladi — u endi
   HAQIQIY: WebSocket ulanishi holatni serverda yozadi
   (apps/messaging/consumers.py). */
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

/* --- Yon menyudagi o'qilmaganlar nishoni ---------------------------------
   Bu modul yon menyusi bor barcha sahifalarga ulangan, shuning uchun
   nishon platforma bo'ylab ko'rinadi. js/sidebar.js menyuni chizib
   bo'lgach `isloh_chatMountNavBadge` ni chaqiradi.

   MUHIM: bu yerda butun ro'yxat YUKLANMAYDI. Nishon 60+ sahifada turadi,
   suhbatlar esa faqat uchtasida kerak — shuning uchun yengil
   `/chat/unread-count` endpoint'i (M7 dagi bildirishnoma nuqtasi bilan
   bir xil qaror). Ro'yxat allaqachon yuklangan bo'lsa undan sanaladi. */
function isloh_chatBadgeCount() {
  const me = isloh_chatMeId();
  return ISLOH_CHAT.threads.reduce((sum, t) => {
    if (t.archived) return sum;
    if (!t.members || t.members.indexOf(me) === -1) return sum;
    return sum + ((t.unread && t.unread[me]) || 0);
  }, 0);
}

/* Nishon qaysi menyu bandiga qo'yilishi rolga bog'liq: talabada `chat`,
   instruktorda `messages`, adminda `admin-messages` (js/navigation.js). */
const ISLOH_CHAT_NAV_KEYS = { student: 'chat', instructor: 'messages', admin: 'admin-messages' };
const ISLOH_CHAT_BADGE_MAX = 99;

function isloh_chatShowNavBadge(count) {
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

/* "Nechta o'qilmagan xabar bor?" — YAGONA javob beruvchi.

   Ro'yxat allaqachon yuklangan bo'lsa keshdan sanaladi, aks holda yengil
   endpoint'ga boradi. Ikkita chaqiruvchisi bor va ikkalasi ham chat
   sahifasidan TASHQARIDA ishlaydi: yon menyudagi nishon va o'qituvchi
   boshqaruv panelidagi "tezkor amallar" (js/instructor-dashboard.js).

   Xato bo'lsa 0: yolg'on "yangi xabar bor" dan ko'ra yaxshiroq
   (js/notification-store.js dagi bir xil qaror). */
function isloh_chatFetchUnread() {
  if (ISLOH_CHAT.threadsLoaded) return Promise.resolve(isloh_chatBadgeCount());
  if (typeof islohApi === 'undefined') return Promise.resolve(0);
  return islohApi.get('/chat/unread-count')
    .then((data) => (data && data.unread) || 0)
    .catch(() => 0);
}

function isloh_chatMountNavBadge() {
  isloh_chatFetchUnread().then(isloh_chatShowNavBadge);
}

/* --- 7) Yozish -----------------------------------------------------------
   Naqsh js/api.js dagi fabrikadan olingan: o'zgarish DARHOL keshga
   yoziladi (interfeys kutmaydi), so'rov ketadi, xato bo'lsa eski holat
   qaytariladi va foydalanuvchiga aytiladi. */

function isloh_chatToastError(err, fallback) {
  if (typeof islohUI !== 'undefined') islohUI.toast((err && err.error) || fallback, 'error');
}

/* --- Yozuv navbati --------------------------------------------------------
   Yozish so'rovlari BIRIN-KETIN yuboriladi, parallel emas — js/api.js dagi
   fabrikadagi bir xil qaror va shu yerda ham ZARUR bo'ldi (brauzerda
   o'lchandi): "arxivdan qaytar" va "ovozni yoq" ketma-ket bosilganda ikki
   `PATCH` bir vaqtda ketardi va ikkinchisi birinchisining natijasini
   bekor qilardi.

   Optimistik o'zgarish navbatda TURMAYDI — u sinxron bajariladi, shuning
   uchun interfeys darhol javob beradi. */
let ISLOH_CHAT_WRITES = Promise.resolve();

function isloh_chatEnqueue(task) {
  const run = ISLOH_CHAT_WRITES.then(task, task);
  // Navbat xato tufayli uzilib qolmasin
  ISLOH_CHAT_WRITES = run.then(() => {}, () => {});
  return run;
}

/* Bitta threadni topib o'zgartiradi. `mutate` false qaytarsa hodisa
   yuborilmaydi (o'zgarish bo'lmadi). */
function isloh_chatUpdateThread(threadId, mutate) {
  const thread = isloh_chatThread(threadId);
  if (!thread) return null;
  if (mutate(thread) === false) return thread;
  isloh_chatCacheLocally();
  isloh_chatEmit();
  return thread;
}

/* Xabar yuborish. Vaqtinchalik id bilan darhol ko'rinadi, server javobi
   kelgach haqiqiy yozuv bilan almashadi (fabrikadagi bir xil qadam).

   Sinxron qaytaradi — js/chat.js puffakni darhol chizadi. */
function isloh_chatSend(threadId, text) {
  const clean = String(text || '').trim();
  if (!clean) return null;

  const thread = isloh_chatThread(threadId);
  if (!thread) return null;

  const me = isloh_chatMeId();
  const temp = { id: 'tmp-' + Date.now(), senderId: me, text: clean, timestamp: Date.now(), pending: true };

  ISLOH_CHAT.messages[threadId] = (ISLOH_CHAT.messages[threadId] || []).concat(temp);
  const previous = { lastMessage: thread.lastMessage, lastSenderId: thread.lastSenderId, timestamp: thread.timestamp, archived: thread.archived };

  thread.lastMessage = clean;
  thread.lastSenderId = me;
  thread.timestamp = temp.timestamp;
  thread.unread = thread.unread || {};
  thread.unread[me] = 0;
  /* Arxivlangan suhbatga yozilsa, u qaytadan faol bo'ladi */
  thread.archived = false;
  isloh_chatCacheLocally();
  isloh_chatEmit();

  isloh_chatEnqueue(() => islohApi.post('/chat/threads/' + threadId + '/messages', { text: clean }))
    .then((saved) => {
      const list = ISLOH_CHAT.messages[threadId] || [];
      const at = list.findIndex((m) => m.id === temp.id);
      if (at !== -1 && saved) list[at] = isloh_chatNormalizeMessage(saved);
      isloh_chatCacheLocally();
      isloh_chatEmit();
    })
    .catch((err) => {
      /* Yuborilmagan xabar ro'yxatda QOLMAYDI: aks holda foydalanuvchi
         uni yetkazilgan deb o'ylardi. */
      ISLOH_CHAT.messages[threadId] = (ISLOH_CHAT.messages[threadId] || []).filter((m) => m.id !== temp.id);
      Object.assign(thread, previous);
      isloh_chatCacheLocally();
      isloh_chatEmit();
      isloh_chatToastError(err, "Xabar yuborilmadi");
    });

  return temp;
}

function isloh_chatMarkRead(threadId) {
  const me = isloh_chatMeId();
  const thread = isloh_chatThread(threadId);
  if (!thread || !thread.unread || !thread.unread[me]) return;

  const previous = thread.unread[me];
  thread.unread[me] = 0;
  isloh_chatCacheLocally();
  isloh_chatEmit();

  isloh_chatEnqueue(() => islohApi.post('/chat/threads/' + threadId + '/read', {})).catch(() => {
    thread.unread[me] = previous;
    isloh_chatEmit();
  });
}

/* Shaxsiy sozlamalar (arxiv, ovoz) va guruh e'loni — bitta PATCH.
   Serverda ular ikki xil egaga tegishli, lekin frontend uchun bu bitta
   "suhbatni o'zgartirish" amali. */
function isloh_chatPatchThread(threadId, patch, fallbackMessage) {
  const thread = isloh_chatThread(threadId);
  if (!thread) return;

  const previous = {};
  Object.keys(patch).forEach((key) => { previous[key] = thread[key]; });
  Object.assign(thread, patch);
  isloh_chatCacheLocally();
  isloh_chatEmit();

  const body = {};
  if ('archived' in patch) body.archived = patch.archived;
  if ('muted' in patch) body.muted = patch.muted;
  if ('pinnedNote' in patch) body.pinned_note = patch.pinnedNote;

  isloh_chatEnqueue(() => islohApi.patch('/chat/threads/' + threadId, body)).catch((err) => {
    Object.assign(thread, previous);
    isloh_chatCacheLocally();
    isloh_chatEmit();
    isloh_chatToastError(err, fallbackMessage);
  });
}

function isloh_chatSetArchived(threadId, archived) {
  isloh_chatPatchThread(threadId, { archived: Boolean(archived) }, "Arxivlab bo'lmadi");
}

function isloh_chatSetMuted(threadId, muted) {
  isloh_chatPatchThread(threadId, { muted: Boolean(muted) }, "Saqlab bo'lmadi");
}

function isloh_chatSetPinnedNote(threadId, note) {
  isloh_chatPatchThread(threadId, { pinnedNote: String(note || '') }, "E'lonni saqlab bo'lmadi");
}

/* --- Suhbat ochish (PROMISE) ----------------------------------------------
   Bu ikki funksiya sinxron bo'la olmaydi: suhbat SERVERDA yaratiladi va
   uning id'sini faqat javob beradi. Chaqiruv joylari (js/chat.js
   "Yangi suhbat" oynasi va js/instructor-messages.js chuqur havolasi)
   shunga moslangan. */

function isloh_chatAdoptThread(row) {
  const thread = isloh_chatNormalizeThread(row);
  const at = ISLOH_CHAT.threads.findIndex((t) => t.id === thread.id);
  if (at === -1) ISLOH_CHAT.threads.push(thread); else ISLOH_CHAT.threads[at] = thread;
  isloh_chatCacheLocally();
  isloh_chatEmit();
  return thread;
}

/* `target` — foydalanuvchi id'si yoki `{ email }`. */
function isloh_chatOpenDirect(target) {
  const body = (target && target.email) ? { email: target.email } : { user_id: String(target || '') };
  if (!body.email && (!body.user_id || body.user_id === isloh_chatMeId())) {
    return Promise.reject({ error: "O'zingiz bilan suhbat boshlab bo'lmaydi" });
  }
  return islohApi.post('/chat/threads/direct', body).then(isloh_chatAdoptThread);
}

/* Kurs guruhi — talab bo'yicha yaratiladi va a'zolar serverda
   sinxronlanadi (apps/messaging/services.py). */
function isloh_chatOpenCourseGroup(courseId) {
  return islohApi.post('/chat/threads/course/' + courseId, {}).then(isloh_chatAdoptThread);
}

/* --- 8) Real vaqt (WebSocket) --------------------------------------------
   js/realtime.js ulanishni boshqaradi va kelgan hodisani shu yerga
   uzatadi. Do'kon soketni O'ZI ochmaydi: ulanish holati (qayta ulanish,
   token yangilanishi) alohida mas'uliyat va u yerda turishi kerak. */

/* O'Z XABARIM IKKI YO'LDAN KELADI va bu brauzerda ko'rindi: puffak ikki
   marta chizilardi.

   Yuborganimda do'kon darhol VAQTINCHALIK xabar qo'yadi (`pending`), REST
   javobi kelgach uni haqiqiysi bilan almashtiradi. Ayni paytda server
   WebSocket orqali ham yuboradi — va u paytda ro'yxatdagi nusxaning id'si
   hali `tmp-...` bo'lgani uchun id bo'yicha solishtirish yordam bermaydi.

   Shuning uchun ikki tekshiruv: id bo'yicha (odatiy takror) va "mening
   kutayotgan xabarim" bo'yicha. BOSHQA TABDA kutayotgan nusxa yo'q, ya'ni
   u yerda xabar odatdagidek qo'shiladi. */
function isloh_chatIsDuplicate(list, message) {
  if (list.some((m) => m.id === message.id)) return true;
  if (message.senderId !== isloh_chatMeId()) return false;
  return list.some((m) => m.pending && m.text === message.text);
}

function isloh_chatApplyMessage(payload) {
  const threadId = String(payload.thread_id || '');
  const message = isloh_chatNormalizeMessage(payload.message);
  const thread = isloh_chatThread(threadId);

  /* Suhbat keshda yo'q bo'lsa (yangi suhbat ochildi) ro'yxat qayta
     yuklanadi — aks holda xabar hech qayerda ko'rinmasdi. */
  if (!thread) {
    ISLOH_CHAT.threadsPromise = null;
    isloh_chatLoadThreads();
    return;
  }

  const list = ISLOH_CHAT.messages[threadId];
  /* Xabarlar yuklangan bo'lsagina qo'shiladi: yuklanmagan suhbatga
     qo'shilsa, keyin ochilganda ro'yxat yarim bo'lib qolardi. */
  if (list && !isloh_chatIsDuplicate(list, message)) list.push(message);

  thread.lastMessage = message.text;
  thread.lastSenderId = message.senderId;
  thread.timestamp = message.timestamp;
  thread.unread = thread.unread || {};
  thread.unread[isloh_chatMeId()] = payload.unread || 0;

  isloh_chatCacheLocally();
  isloh_chatEmit();
}

function isloh_chatApplyPresence(payload) {
  const user = isloh_chatUser(payload.user_id);
  if (!user || user.presence === payload.presence) return;
  user.presence = payload.presence;
  isloh_chatEmit();
}

function isloh_chatApplyThreadPatch(payload) {
  const thread = isloh_chatThread(payload.thread_id);
  if (!thread) return;
  const patch = payload.patch || {};
  if ('pinned_note' in patch) thread.pinnedNote = patch.pinned_note;
  isloh_chatCacheLocally();
  isloh_chatEmit();
}

/* Bitta kirish nuqtasi — js/realtime.js turlarni bilmasin. */
function isloh_chatApplyIncoming(payload) {
  if (!payload || !payload.event) return;
  if (payload.event === 'message') isloh_chatApplyMessage(payload);
  else if (payload.event === 'presence') isloh_chatApplyPresence(payload);
  else if (payload.event === 'thread') isloh_chatApplyThreadPatch(payload);
}

/* Nishon do'kon o'zgarganda ham yangilanadi (xabar kelganda ham). */
document.addEventListener(ISLOH_CHAT_EVENT, () => {
  if (ISLOH_CHAT.threadsLoaded) isloh_chatShowNavBadge(isloh_chatBadgeCount());
});
