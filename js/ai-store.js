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

/* Bitta thread'da saqlanadigan xabarlar chegarasi. localStorage ~5MB —
   cheklovsiz o'sish kvotani to'ldirib, boshqa modullarni ham yiqitardi. */
const ISLOH_AI_MAX_MESSAGES = 60;

/* Deterministik id: bir xil dars har doim bir xil thread'ga tushadi */
function isloh_aiThreadId(contextKey, courseId, lessonId) {
  return [contextKey || 'general', courseId || '', lessonId || ''].join('::');
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
  thread.title = meta.title || thread.title || '';
  thread.messages = (thread.messages || []).concat([
    Object.assign({ role: 'ai', text: '', html: '', templateKey: '' , at: new Date().toISOString() }, message)
  ]).slice(-ISLOH_AI_MAX_MESSAGES);
  thread.updatedAt = new Date().toISOString();

  map[meta.threadId] = thread;
  return isloh_aiWriteChats(map);
}

function isloh_aiDeleteThread(threadId) {
  const map = isloh_aiReadChats();
  if (!map[threadId]) return false;
  delete map[threadId];
  return isloh_aiWriteChats(map);
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

/* "3 daqiqa oldin" ko'rinishidagi nisbiy vaqt — tarix qatorlari uchun */
function isloh_aiRelativeTime(iso) {
  const then = new Date(iso || '').getTime();
  if (isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'hozirgina';
  if (mins < 60) return mins + ' daqiqa oldin';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' soat oldin';
  const days = Math.floor(hours / 24);
  return days === 1 ? 'kecha' : days + ' kun oldin';
}
