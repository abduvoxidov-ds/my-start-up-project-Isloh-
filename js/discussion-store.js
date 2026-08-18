/* ==========================================================================
   ISLOH — Muhokamalar do'koni  (M6)

   NEGA BU FAYL BOR: muhokamalar butunlay DOM'da yashardi. Mavzu
   kartochkalari HTML ichiga qo'lda yozilgan edi (talaba sahifasida 5 ta,
   o'qituvchida 2 ta), like soni `textContent` dan o'qilib bittaga
   oshirilardi va hech qayerda saqlanmasdi — sahifa yangilanishi bilan
   yo'qolardi. "Qadash", "Hal qilindi" va "Yangi mavzu" tugmalari ham
   faqat sinf almashtirardi yoki umuman hech narsa qilmasdi: oyna yopilib,
   mavzu paydo bo'lmasdi.

   NEGA UMUMIY FABRIKA (js/api.js) ISHLATILMADI — sabab js/content-store.js
   dagi bilan bir xil. Fabrika bitta endpoint va yassi massiv ustida
   ishlaydi (`POST /x`, `PUT /x/{id}`, `DELETE /x/{id}`), muhokamada esa
   har amal O'Z manziliga boradi va SERVER yangilangan mavzuni qaytaradi:

     yoqtirish  -> POST /discussions/{id}/like
     qadash     -> POST /discussions/{id}/pin
     hal qilindi-> POST /discussions/{id}/solve
     javob      -> POST /discussions/{id}/replies
     javob amali-> POST /discussion-replies/{id}/{like|accept|pin}

   Shuning uchun bu yerda o'sha naqsh qo'lda yozilgan: sinxron o'qish +
   optimistik yozish + rollback.

   MAVZU JAVOBLARI BILAN BIRGA KELADI (`replies[]`) — ro'yxatdagi har bir
   mavzu uchun alohida so'rov o'nlab so'rov bo'lardi va "6 ta javobni
   ko'rish" bosilganda kutish paydo bo'lardi.

   MATN BOSHQA FOYDALANUVCHIDAN KELADI. Chizishda hammasi
   `isloh_escapeHtml` (js/escape.js) orqali o'tadi; server ham matnni
   teglarsiz saqlaydi (apps/social/sanitize.py).
   ========================================================================== */

const ISLOH_DISCUSSIONS_KEY = 'isloh_discussions';

const ISLOH_THREAD_KINDS = {
  discussion: { label: 'Muhokama' },
  qa: { label: 'Savol-Javob' }
};

const ISLOH_THREAD_DEFAULTS = {
  id: '',
  courseId: '',
  moduleId: '',
  moduleTitle: '',
  kind: 'discussion',      // discussion | qa
  title: '',
  body: '',
  category: '',
  author: null,            // { id, name, avatar, role }
  isPinned: false,
  isSolved: false,
  likeCount: 0,
  replyCount: 0,
  liked: false,
  replies: [],
  createdAt: ''
};

/* --- Demo ma'lumot --------------------------------------------------------
   Faqat `file://` va tarmoq uzilganda ko'rinadi. Ilgari bu yozuvlar ikkala
   sahifaning MARKUPIDA turardi va bir-biridan bexabar edi. */

function isloh_dsHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function isloh_dsAuthor(name, role, avatar) {
  return { id: '', name: name, role: role, avatar: avatar || '' };
}

function isloh_discussionSeed() {
  const teacher = isloh_dsAuthor('Akmal Yuldashev', 'instructor', 'linear-gradient(135deg,#6C5DD3,#4B3FA8)');
  const student = isloh_dsAuthor('Samar Mirzayev', 'student', '');

  return [
    {
      id: 'th-modul-1', courseId: 'docker-for-beginners', kind: 'discussion',
      title: "1-modul uchun umumiy eslatma va qo'shimcha materiallar",
      body: "Assalomu alaykum! 1-modul bo'yicha barcha qo'shimcha o'qish materiallari va foydali havolalar shu yerda to'planadi.",
      moduleTitle: '1-modul: Kirish', author: teacher,
      isPinned: true, likeCount: 18, replyCount: 2, createdAt: isloh_dsHoursAgo(48),
      replies: [
        { id: 'rp-1', text: "Rahmat, materiallar juda foydali bo'ldi!", author: student, likeCount: 3, createdAt: isloh_dsHoursAgo(24) },
        { id: 'rp-2', text: "Arzimaydi! Savollaringiz bo'lsa shu yerga yozavering.", author: teacher, likeCount: 5, createdAt: isloh_dsHoursAgo(20) }
      ]
    },
    {
      id: 'th-compose-xato', courseId: 'docker-for-beginners', kind: 'discussion',
      title: 'Docker compose ishga tushmayapti — port band xatosi',
      body: "docker-compose up bosganimda 5432 porti band deb xato beryapti.",
      moduleTitle: '2-modul: Docker asoslari', author: student,
      isSolved: true, likeCount: 9, replyCount: 1, createdAt: isloh_dsHoursAgo(30),
      replies: [
        { id: 'rp-3', text: '5432 portini boshqa PostgreSQL jarayoni band qilib turgan bo\'lishi mumkin — docker ps orqali tekshiring.', author: teacher, likeCount: 4, createdAt: isloh_dsHoursAgo(28) }
      ]
    },
    {
      id: 'th-volumes', courseId: 'docker-for-beginners', kind: 'discussion',
      title: 'Volumes haqida qo\'shimcha misol bo\'ladimi?',
      body: 'Named volume va bind mount farqini amaliy misolda ko\'rsak yaxshi bo\'lardi.',
      author: student, likeCount: 4, replyCount: 0, createdAt: isloh_dsHoursAgo(6), replies: []
    },
    {
      id: 'th-qa-version', courseId: 'docker-for-beginners', kind: 'qa', category: 'compose',
      title: 'docker-compose.yml faylida "version" maydoni kerakmi?',
      author: student, likeCount: 7, replyCount: 1, isSolved: true, createdAt: isloh_dsHoursAgo(24),
      replies: [
        { id: 'rp-4', text: 'Yangi Compose versiyalarida version maydoni ixtiyoriy — uni olib tashlashingiz mumkin.', author: teacher, likeCount: 6, isAccepted: true, createdAt: isloh_dsHoursAgo(22) }
      ]
    },
    {
      id: 'th-qa-deploy', courseId: 'docker-for-beginners', kind: 'qa', category: 'deploy',
      title: 'Production serverga Docker orqali joylashtirish uchun eng yaxshi amaliyot qaysi?',
      author: isloh_dsAuthor('Farrux Rustamov', 'student', ''),
      likeCount: 2, replyCount: 0, createdAt: isloh_dsHoursAgo(4), replies: []
    }
  ];
}

/* --- Server <-> frontend --------------------------------------------------- */

function isloh_replyFromServer(row) {
  return {
    id: row.id,
    parentId: row.parent || '',
    text: row.text || '',
    author: row.author || null,
    isAccepted: !!row.is_accepted,
    isPinned: !!row.is_pinned,
    likeCount: row.like_count || 0,
    liked: !!row.liked,
    createdAt: row.created_at || ''
  };
}

function isloh_threadFromServer(row) {
  return {
    id: row.id,
    courseId: row.course,
    moduleId: row.module || '',
    moduleTitle: row.module_title || '',
    kind: row.kind || 'discussion',
    title: row.title || '',
    body: row.body || '',
    category: row.category || '',
    author: row.author || null,
    isPinned: !!row.is_pinned,
    isSolved: !!row.is_solved,
    likeCount: row.like_count || 0,
    replyCount: row.reply_count || 0,
    liked: !!row.liked,
    replies: (row.replies || []).map(isloh_replyFromServer),
    createdAt: row.created_at || ''
  };
}

function isloh_normalizeThread(thread) {
  const source = (thread && ('like_count' in thread || 'is_pinned' in thread))
    ? isloh_threadFromServer(thread)
    : (thread || {});
  const merged = Object.assign({}, ISLOH_THREAD_DEFAULTS, source);
  merged.replies = Array.isArray(merged.replies)
    ? merged.replies.map((r) => Object.assign({
        id: '', parentId: '', text: '', author: null, isAccepted: false,
        isPinned: false, likeCount: 0, liked: false, createdAt: ''
      }, r))
    : [];
  return merged;
}

/* Serverga faqat MUALLIF yozadigan maydonlar ketadi. `is_pinned`,
   `is_solved`, sanoqlar — alohida amal yoki server hisobi
   (apps/social/serializers.py da `read_only`). */
function isloh_threadToServer(thread) {
  const body = {
    title: thread.title,
    body: thread.body || '',
    kind: thread.kind || 'discussion',
    category: thread.category || ''
  };
  if (isloh_dsIsUuid(thread.courseId)) body.course = thread.courseId;
  if (isloh_dsIsUuid(thread.moduleId)) body.module = thread.moduleId;
  return body;
}

/* Demo yozuvlarda id — slug (`docker-for-beginners`), serverda esa UUID
   (js/assignment-store.js dagi bilan bir xil shart). */
function isloh_dsIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

/* --- Kesh ------------------------------------------------------------------ */

let ISLOH_THREAD_CACHE = [];
let ISLOH_THREADS_LOADED = false;
let ISLOH_THREADS_LOADING = null;

function isloh_dsFallback() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_DISCUSSIONS_KEY)); } catch (e) { stored = null; }
  if (Array.isArray(stored)) return stored.map(isloh_normalizeThread);
  return isloh_discussionSeed().map(isloh_normalizeThread);
}

function isloh_dsWriteCopy() {
  try { localStorage.setItem(ISLOH_DISCUSSIONS_KEY, JSON.stringify(ISLOH_THREAD_CACHE)); } catch (e) { /* kvota */ }
}

function isloh_dsEmit() {
  document.dispatchEvent(new CustomEvent('isloh:discussions-updated', { detail: ISLOH_THREAD_CACHE }));
}

function isloh_loadDiscussions() {
  if (ISLOH_THREADS_LOADING) return ISLOH_THREADS_LOADING;

  ISLOH_THREADS_LOADING = islohApi.get('/discussions')
    .then((rows) => {
      ISLOH_THREAD_CACHE = (rows || []).map(isloh_normalizeThread);
      isloh_dsWriteCopy();
    })
    .catch((err) => {
      ISLOH_THREAD_CACHE = isloh_dsFallback();
      if (err && err.code !== 'file_protocol' && typeof islohUI !== 'undefined') {
        islohUI.showNetworkError(() => {
          ISLOH_THREADS_LOADING = null;
          ISLOH_THREADS_LOADED = false;
          return isloh_loadDiscussions();
        }, err.error);
      }
    })
    .then(() => {
      ISLOH_THREADS_LOADED = true;
      isloh_dsEmit();
      return ISLOH_THREAD_CACHE;
    });

  return ISLOH_THREADS_LOADING;
}

/* SINXRON — sahifalar shuni chaqiradi. */
function isloh_getThreads() {
  if (!ISLOH_THREADS_LOADED) {
    if (!ISLOH_THREAD_CACHE.length) ISLOH_THREAD_CACHE = isloh_dsFallback();
    isloh_loadDiscussions();
  }
  return ISLOH_THREAD_CACHE;
}

function isloh_getThread(id) {
  if (!id) return null;
  return isloh_getThreads().find((t) => t.id === id) || null;
}

/* Kurs va tur bo'yicha. Qadalgan mavzu doim tepada — server ham shu
   tartibda qaytaradi, bu yerda zaxira uchun takrorlanadi. */
function isloh_getCourseThreads(courseId, kind) {
  let list = isloh_getThreads();
  if (courseId) list = list.filter((t) => t.courseId === courseId);
  if (kind) list = list.filter((t) => t.kind === kind);

  return list.slice().sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

function isloh_findReply(replyId) {
  const threads = isloh_getThreads();
  for (let i = 0; i < threads.length; i++) {
    const reply = threads[i].replies.find((r) => r.id === replyId);
    if (reply) return { thread: threads[i], reply: reply };
  }
  return null;
}

/* --- Yozish yordamchilari -------------------------------------------------- */

function isloh_dsSnapshot() {
  return JSON.parse(JSON.stringify(ISLOH_THREAD_CACHE));
}

function isloh_dsRollback(snapshot, err) {
  ISLOH_THREAD_CACHE = snapshot.map(isloh_normalizeThread);
  isloh_dsWriteCopy();
  isloh_dsEmit();
  if (typeof islohUI !== 'undefined') islohUI.toast((err && err.error) || "Saqlab bo'lmadi", 'error');
}

function isloh_dsChanged() {
  isloh_dsWriteCopy();
  isloh_dsEmit();
}

/* Serverdan qaytgan mavzuni keshdagi o'rniga qo'yadi. Har amal
   yangilangan mavzuni to'liq qaytaradi, ya'ni sanoqlarni mijozda qayta
   hisoblash kerak emas. */
function isloh_dsReplace(row) {
  const thread = isloh_normalizeThread(row);
  const index = ISLOH_THREAD_CACHE.findIndex((t) => t.id === thread.id);
  if (index === -1) ISLOH_THREAD_CACHE.unshift(thread);
  else ISLOH_THREAD_CACHE[index] = thread;
  isloh_dsChanged();
  return thread;
}

function isloh_dsTempId() {
  return 'th-yangi-' + Date.now().toString(36);
}

/* --- Mavzu amallari -------------------------------------------------------- */

function isloh_saveThread(patch) {
  const data = patch || {};
  const snapshot = isloh_dsSnapshot();
  const index = data.id ? ISLOH_THREAD_CACHE.findIndex((t) => t.id === data.id) : -1;

  if (index === -1) {
    const thread = isloh_normalizeThread(data);
    thread.id = isloh_dsTempId();
    thread.createdAt = new Date().toISOString();
    ISLOH_THREAD_CACHE.unshift(thread);
    isloh_dsChanged();

    islohApi.post('/discussions', isloh_threadToServer(thread))
      .then((row) => {
        // Vaqtinchalik yozuv server javobiga almashadi
        ISLOH_THREAD_CACHE = ISLOH_THREAD_CACHE.filter((t) => t.id !== thread.id);
        isloh_dsReplace(row);
      })
      .catch((err) => isloh_dsRollback(snapshot, err));
    return thread;
  }

  const updated = isloh_normalizeThread(Object.assign({}, ISLOH_THREAD_CACHE[index], data));
  ISLOH_THREAD_CACHE[index] = updated;
  isloh_dsChanged();

  islohApi.put('/discussions/' + updated.id, isloh_threadToServer(updated))
    .then(isloh_dsReplace)
    .catch((err) => isloh_dsRollback(snapshot, err));
  return updated;
}

function isloh_deleteThread(id) {
  const snapshot = isloh_dsSnapshot();
  ISLOH_THREAD_CACHE = ISLOH_THREAD_CACHE.filter((t) => t.id !== id);
  isloh_dsChanged();

  islohApi.delete('/discussions/' + id).catch((err) => isloh_dsRollback(snapshot, err));
  return true;
}

/* Yoqtirish, qadash va "hal qilindi" — bir xil naqsh: mahalliy holat
   darhol almashadi, server javobi kelgach yozuv butunlay almashtiriladi
   (sanoq SERVERDA hisoblanadi, mijozda emas). */
function isloh_dsThreadAction(id, verb, optimistic) {
  const thread = isloh_getThread(id);
  if (!thread) return null;

  const snapshot = isloh_dsSnapshot();
  optimistic(thread);
  isloh_dsChanged();

  islohApi.post('/discussions/' + id + '/' + verb, {})
    .then(isloh_dsReplace)
    .catch((err) => isloh_dsRollback(snapshot, err));
  return thread;
}

function isloh_toggleThreadLike(id) {
  return isloh_dsThreadAction(id, 'like', (thread) => {
    thread.liked = !thread.liked;
    thread.likeCount = Math.max(0, thread.likeCount + (thread.liked ? 1 : -1));
  });
}

function isloh_toggleThreadPin(id) {
  return isloh_dsThreadAction(id, 'pin', (thread) => { thread.isPinned = !thread.isPinned; });
}

function isloh_toggleThreadSolved(id) {
  return isloh_dsThreadAction(id, 'solve', (thread) => { thread.isSolved = !thread.isSolved; });
}

/* --- Javob amallari -------------------------------------------------------- */

function isloh_addThreadReply(threadId, text, parentId) {
  const thread = isloh_getThread(threadId);
  const clean = String(text || '').trim();
  if (!thread || !clean) return null;

  const snapshot = isloh_dsSnapshot();
  const reply = {
    id: 'rp-yangi-' + Date.now().toString(36),
    parentId: parentId || '',
    text: clean,
    author: isloh_dsCurrentAuthor(),
    isAccepted: false, isPinned: false, likeCount: 0, liked: false,
    createdAt: new Date().toISOString()
  };
  thread.replies.push(reply);
  thread.replyCount += 1;
  isloh_dsChanged();

  const body = { text: clean };
  if (isloh_dsIsUuid(parentId)) body.parent = parentId;

  islohApi.post('/discussions/' + threadId + '/replies', body)
    .then(isloh_dsReplace)
    .catch((err) => isloh_dsRollback(snapshot, err));
  return reply;
}

/* Joriy foydalanuvchi — optimistik javobda ism darhol ko'rinsin.
   Server javobi kelgach yozuv baribir almashtiriladi. */
function isloh_dsCurrentAuthor() {
  if (typeof isloh_getUserProfile !== 'function') return { id: '', name: 'Siz', role: 'student', avatar: '' };
  const user = isloh_getUserProfile();
  return { id: '', name: user.name || 'Siz', role: user.role || 'student', avatar: user.avatar || '' };
}

function isloh_deleteReply(replyId) {
  const found = isloh_findReply(replyId);
  if (!found) return false;

  const snapshot = isloh_dsSnapshot();
  found.thread.replies = found.thread.replies.filter((r) => r.id !== replyId);
  found.thread.replyCount = Math.max(0, found.thread.replyCount - 1);
  isloh_dsChanged();

  islohApi.delete('/discussion-replies/' + replyId)
    .catch((err) => isloh_dsRollback(snapshot, err));
  return true;
}

function isloh_saveReplyText(replyId, text) {
  const found = isloh_findReply(replyId);
  const clean = String(text || '').trim();
  if (!found || !clean) return false;

  const snapshot = isloh_dsSnapshot();
  found.reply.text = clean;
  isloh_dsChanged();

  islohApi.put('/discussion-replies/' + replyId, { text: clean })
    .catch((err) => isloh_dsRollback(snapshot, err));
  return true;
}

/* Javob amallari mavzuni emas, JAVOBNI qaytaradi — shuning uchun natija
   keshdagi javobga yoziladi (mavzu butunlay almashtirilmaydi). */
function isloh_dsReplyAction(replyId, verb, optimistic) {
  const found = isloh_findReply(replyId);
  if (!found) return null;

  const snapshot = isloh_dsSnapshot();
  optimistic(found.reply, found.thread);
  isloh_dsChanged();

  islohApi.post('/discussion-replies/' + replyId + '/' + verb, {})
    .then((row) => {
      const target = isloh_findReply(replyId);
      if (target) Object.assign(target.reply, isloh_replyFromServer(row));
      isloh_dsChanged();
    })
    .catch((err) => isloh_dsRollback(snapshot, err));
  return found.reply;
}

function isloh_toggleReplyLike(replyId) {
  return isloh_dsReplyAction(replyId, 'like', (reply) => {
    reply.liked = !reply.liked;
    reply.likeCount = Math.max(0, reply.likeCount + (reply.liked ? 1 : -1));
  });
}

function isloh_acceptReply(replyId) {
  return isloh_dsReplyAction(replyId, 'accept', (reply, thread) => {
    /* Mavzuda bittadan ortiq qabul qilingan javob bo'lmaydi — server ham
       shunday qiladi, bu yerda faqat ekran darhol to'g'ri ko'rinsin. */
    thread.replies.forEach((r) => { r.isAccepted = false; });
    reply.isAccepted = true;
    thread.isSolved = true;
  });
}

function isloh_toggleReplyPin(replyId) {
  return isloh_dsReplyAction(replyId, 'pin', (reply) => { reply.isPinned = !reply.isPinned; });
}

/* --- Hisoblanadigan qiymatlar ---------------------------------------------- */

/* O'qituvchi sahifasidagi 4 ta kartochka. "Javobsiz" — hech kim javob
   bermagan mavzular; ilgari bu sonlar (34 / 3 / 28) markupda qotib
   turardi va ro'yxat bilan hech qanday aloqasi yo'q edi. */
function isloh_discussionStats(courseId) {
  const list = courseId ? isloh_getThreads().filter((t) => t.courseId === courseId) : isloh_getThreads();
  return {
    total: list.length,
    unanswered: list.filter((t) => t.replyCount === 0).length,
    solved: list.filter((t) => t.isSolved).length,
    pinned: list.filter((t) => t.isPinned).length,
    avgResponse: isloh_avgResponseLabel(list)
  };
}

/* "O'rtacha javob vaqti" — mavzu ochilgani bilan BIRINCHI javob orasidagi
   vaqt. Ilgari bu kartochkada "1.4 soat" qotib turardi va hech narsadan
   hisoblanmasdi.

   Javobsiz mavzular hisobga OLINMAYDI: ular hali javob kutmoqda, ya'ni
   ularning "javob vaqti" mavjud emas — nolga qo'shilsa ko'rsatkich
   sun'iy ravishda yaxshi ko'rinardi. */
function isloh_avgResponseLabel(list) {
  const spans = list.map((thread) => {
    if (!thread.replies.length || !thread.createdAt) return null;
    const first = thread.replies
      .map((r) => new Date(r.createdAt || 0).getTime())
      .filter((t) => t > 0)
      .sort((a, b) => a - b)[0];
    const opened = new Date(thread.createdAt).getTime();
    return first && first > opened ? first - opened : null;
  }).filter((ms) => ms !== null);

  if (!spans.length) return '—';

  const hours = spans.reduce((sum, ms) => sum + ms, 0) / spans.length / 3600000;
  if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' daq';
  if (hours < 48) return (Math.round(hours * 10) / 10) + ' soat';
  return Math.round(hours / 24) + ' kun';
}

/* Filtr chiplari uchun holat: qadalgan / hal qilingan / javobsiz / ochiq.
   `js/filterable.js` aniq moslikni tekshiradi, shuning uchun element
   atributi bitta qiymat oladi. */
function isloh_threadState(thread) {
  if (thread.isPinned) return 'pinned';
  if (thread.isSolved) return 'solved';
  if (!thread.replyCount) return 'unanswered';
  return 'open';
}

function isloh_threadTimeLabel(thread) {
  if (!thread || !thread.createdAt) return '';
  return typeof isloh_relativeTime === 'function' ? isloh_relativeTime(thread.createdAt) : thread.createdAt;
}
