/* ==========================================================================
   ISLOH — AI suhbatlari do'koni  (2-navbat)

   NEGA BU FAYL BOR: drawer yopilishi bilan butun suhbat yo'qolardi —
   loyihadagi yagona modul edi holatni saqlamaydigan (CLAUDE.md §3
   localStorage'ni talab qiladi). Endi suhbat js/notes-store.js va
   js/bookmarks.js bilan bir xil naqshda saqlanadi.

   NEGA DARS DARAJASIDA: izohlar ham aynan shunday bo'lingan — talaba
   "Docker image nima?" darsida so'ragan savol keyingi darsga aralashmasin.
   Kontekstda dars bo'lmasa (masalan `learning-progress`), thread faqat
   kontekst kaliti bilan saqlanadi.

   Do'kon shakli (ISLOH_AI_CHATS_KEY):
     { [threadId]: {
         id, contextKey, courseId, lessonId, title,
         messages: [ { role:'user'|'ai', text, html, templateKey, at } ],
         updatedAt
     } }

   Backend ulanganda faqat o'qish/yozish funksiyalari almashadi — shakl
   API javobiga mos (thread + messages), tuzilma qayta loyihalanmaydi.
   ========================================================================== */

const ISLOH_AI_CHATS_KEY = 'isloh_ai_chats';

/* Har bir kontekstda qaysi suhbat ochiq turgani: { [contextKey]: threadId }.
   Darsga bog'langan suhbatlarga bu kerak emas (ularning id'si deterministik),
   lekin darssiz kontekstlarda — to'liq sahifali AI Yordamchida — bittadan
   ortiq suhbat bo'lishi mumkin, ya'ni "qaysi biri ochiq" degan savol paydo
   bo'ladi. Javob shu yerda saqlanadi, aks holda sahifa yangilanganda
   foydalanuvchi har safar boshqa suhbatga tushib qolardi. */
const ISLOH_AI_ACTIVE_KEY = 'isloh_ai_active_threads';

/* Bitta thread'da saqlanadigan xabarlar chegarasi. localStorage ~5MB —
   cheklovsiz o'sish kvotani to'ldirib, boshqa modullarni ham yiqitardi. */
const ISLOH_AI_MAX_MESSAGES = 60;

/* Ro'yxatda ko'rinadigan sarlavha uzunligi */
const ISLOH_AI_TITLE_MAX = 42;

/* Deterministik id: bir xil dars har doim bir xil thread'ga tushadi */
function isloh_aiThreadId(contextKey, courseId, lessonId) {
  return [contextKey || 'general', courseId || '', lessonId || ''].join('::');
}

/* Darssiz kontekst uchun yangi, takrorlanmas id. Shakl deterministik id
   bilan bir xil ("ctx::kurs::dars") + noyob qo'shimcha, shuning uchun eski
   suhbatlar (`ctx::::`) hech qanday ko'chirishsiz o'z joyida qoladi. */
function isloh_aiNewThreadId(contextKey) {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return [contextKey || 'general', '', '', unique].join('::');
}

/* Suhbat sarlavhasi birinchi savoldan olinadi — "AI Yordamchi" deb
   nomlangan o'nta bir xil qator ro'yxatni foydasiz qilardi. */
function isloh_aiTitleFromText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > ISLOH_AI_TITLE_MAX
    ? clean.slice(0, ISLOH_AI_TITLE_MAX - 1).trimEnd() + '…'
    : clean;
}

function isloh_aiReadChats() {
  try {
    const raw = JSON.parse(localStorage.getItem(ISLOH_AI_CHATS_KEY));
    return (raw && typeof raw === 'object') ? raw : {};
  } catch (e) {
    return {};
  }
}

/* Kvota to'lgan bo'lsa false qaytaradi — chaqiruvchi jim yiqilmasin */
function isloh_aiWriteChats(map) {
  try {
    localStorage.setItem(ISLOH_AI_CHATS_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    return false;
  }
}

/* --- Faol suhbat (darssiz kontekstlar uchun) ----------------------------- */

function isloh_aiReadActive() {
  try {
    const raw = JSON.parse(localStorage.getItem(ISLOH_AI_ACTIVE_KEY));
    return (raw && typeof raw === 'object') ? raw : {};
  } catch (e) {
    return {};
  }
}

function isloh_aiSetActiveThreadId(contextKey, threadId) {
  if (!contextKey) return false;
  const map = isloh_aiReadActive();
  map[contextKey] = threadId;
  try {
    localStorage.setItem(ISLOH_AI_ACTIVE_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    return false;
  }
}

/* Faol suhbat id'si. Yo'q bo'lsa yangisi yaratiladi va eslab qolinadi.

   `ctx::::` — 1-bosqichdagi yagona mumkin bo'lgan id. Agar unda yozishmalar
   bo'lsa, u yangi model ostida ham FAOL suhbat sifatida qabul qilinadi:
   foydalanuvchi yangilanishdan keyin o'z suhbatini yo'qotmasin. */
function isloh_aiGetActiveThreadId(contextKey) {
  if (!contextKey) return isloh_aiThreadId(contextKey, '', '');

  const stored = isloh_aiReadActive()[contextKey];
  if (stored) return stored;

  const legacyId = isloh_aiThreadId(contextKey, '', '');
  const legacy = isloh_aiReadChats()[legacyId];
  const adopted = (legacy && (legacy.messages || []).length)
    ? legacyId
    : isloh_aiNewThreadId(contextKey);

  isloh_aiSetActiveThreadId(contextKey, adopted);
  return adopted;
}

/* "Yangi suhbat": faol id almashtiriladi, eskisi do'konda qoladi va
   tarix ro'yxatida ko'rinaveradi. */
function isloh_aiStartNewThread(contextKey) {
  const id = isloh_aiNewThreadId(contextKey);
  isloh_aiSetActiveThreadId(contextKey, id);
  return id;
}

function isloh_aiGetThread(threadId) {
  const thread = isloh_aiReadChats()[threadId];
  if (!thread) return null;
  return Object.assign({ messages: [] }, thread);
}

/* Xabarni thread'ga qo'shadi; thread bo'lmasa yaratadi. `meta` — thread
   sarlavhasi va bog'lanishi (kurs/dars), har safar yangilanadi, chunki
   dars nomi keyinchalik o'zgarishi mumkin. */
function isloh_aiAppendMessage(meta, message) {
  if (!meta || !meta.threadId) return false;

  const map = isloh_aiReadChats();
  const thread = map[meta.threadId] || {
    id: meta.threadId, messages: []
  };

  thread.contextKey = meta.contextKey || thread.contextKey || '';
  thread.courseId = meta.courseId || thread.courseId || '';
  thread.lessonId = meta.lessonId || thread.lessonId || '';
  /* Darsga bog'langan suhbatda sarlavha — dars nomi (meta'dan, chunki dars
     keyinchalik qayta nomlanishi mumkin). Erkin suhbatda esa u birinchi
     savoldan bir marta olinadi va keyin o'zgarmaydi. */
  thread.title = meta.title || thread.title || '';
  if (!thread.title && message && message.role === 'user') {
    thread.title = isloh_aiTitleFromText(message.text);
  }
  thread.messages = (thread.messages || []).concat([
    Object.assign({ role: 'ai', text: '', html: '', templateKey: '' , at: new Date().toISOString() }, message)
  ]).slice(-ISLOH_AI_MAX_MESSAGES);
  thread.updatedAt = new Date().toISOString();

  map[meta.threadId] = thread;
  return isloh_aiWriteChats(map);
}

/* O'chirilgan suhbat faol bo'lsa, faol belgisi ham olib tashlanadi — aks
   holda keyingi savol o'chirilgan id ostida qayta tirilardi. */
function isloh_aiDeleteThread(threadId) {
  const map = isloh_aiReadChats();
  if (!map[threadId]) return false;

  const contextKey = map[threadId].contextKey;
  delete map[threadId];
  const ok = isloh_aiWriteChats(map);

  if (contextKey && isloh_aiReadActive()[contextKey] === threadId) {
    isloh_aiSetActiveThreadId(contextKey, isloh_aiNewThreadId(contextKey));
  }
  return ok;
}

/* Faqat bo'sh bo'lmagan thread'lar, yangisi birinchi. `contextKey` berilsa
   shu kontekstdagilar bilan cheklanadi (drawer "Tarix" tabi shunday
   ishlaydi — o'qituvchi shablonlari talaba tarixiga aralashmasin). */
function isloh_aiListThreads(contextKey) {
  const map = isloh_aiReadChats();
  return Object.keys(map)
    .map((id) => map[id])
    .filter((t) => t && (t.messages || []).length)
    .filter((t) => !contextKey || t.contextKey === contextKey)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/* "3 daqiqa oldin" ko'rinishidagi nisbiy vaqt — tarix qatorlari uchun.
   Matn js/i18n.js orqali tarjima qilinadi (`isloh_aiT` — ai-assistant.js). */
function isloh_aiRelativeTime(iso) {
  const then = new Date(iso || '').getTime();
  if (isNaN(then)) return '';
  const t = (typeof isloh_aiT === 'function') ? isloh_aiT : (k, uz, v) =>
    String(uz).replace(/\{(\w+)\}/g, (m, n) => (v && n in v ? String(v[n]) : m));

  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t('ai.time.now', 'hozirgina');
  if (mins < 60) return t('ai.time.min', '{n} daqiqa oldin', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('ai.time.hour', '{n} soat oldin', { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('ai.time.yesterday', 'kecha') : t('ai.time.day', '{n} kun oldin', { n: days });
}
