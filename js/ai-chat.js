/* ==========================================================================
   ISLOH — AI Chat interactions  (Sprint 8A)
   Runtime behavior for the drawer rendered by js/ai-panel.js. Frontend
   only — "AI replies" are canned content from js/ai-assistant.js's
   ISLOH_AI_CONTEXTS, no network calls.

   Markup contract (all inside #ai-drawer-panel, rendered by ai-panel.js):
     [data-ai-run="<templateKey>"]   → suggestion / prompt-template card
     [data-ai-input] / [data-ai-send] → free-text prompt box
     [data-ai-minimize] / [data-ai-clear] → head actions
     [data-ai-quick="<context>:<templateKey>"] → inline chip anywhere on the
       page (e.g. next to an editor-toolbar) that opens the drawer and runs
       that template immediately
     [data-ai-context-label]        → jonli kontekst yorlig'i (joriy dars)
     [data-ai-history-list]         → saqlangan suhbatlar ro'yxati

   2-navbat: suhbat js/ai-store.js orqali localStorage'ga saqlanadi va
   kontekst joriy darsga bog'lanadi (`isloh:lesson-change`).
   ========================================================================== */

function isloh_aiPanel() { return document.getElementById('ai-drawer-panel'); }
function isloh_aiContextKey() { return isloh_aiPanel()?.dataset.aiContextKey || null; }

/* `isloh_aiT` js/ai-assistant.js da — u birinchi yuklanadi va js/ai-panel.js
   ham undan foydalanadi (drawer markupi parse vaqtida yasaladi). */

function isloh_aiToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type);
}

/* --- Joriy kontekst (kurs / dars) ---------------------------------------- */

/* Kurs pleerida faol dars qatoridan, boshqa sahifalarda esa bo'sh qaytadi.
   Manba bitta — sahifadagi markup, ya'ni dars ma'lumoti bu yerda qayta
   ta'riflanmaydi (js/course-player.js chizgan qatorlardan o'qiladi). */
function isloh_aiCurrentLesson() {
  const row = document.querySelector('[data-cps-lesson].active');
  const title = document.querySelector('[data-lesson-title]');
  return {
    courseId: document.querySelector('[data-course-id]')?.dataset.courseId || '',
    courseTitle: document.querySelector('.cps-course-title')?.textContent.trim() || '',
    lessonId: row?.dataset.lessonId || '',
    lessonTitle: (title?.textContent || '').trim()
  };
}

/* Thread meta — do'kon uchun ham, tarix qatori sarlavhasi uchun ham.

   Ikki xil suhbat mavjud:
     • darsga bog'langan (kurs pleeri) — id deterministik, bitta dars = bitta
       suhbat, sarlavha dars nomi;
     • erkin (to'liq sahifali AI Yordamchi) — id do'konda saqlangan faol
       suhbatdan olinadi, sarlavha esa birinchi savoldan tuziladi.

   Ilgari ikkinchi holat umuman yo'q edi: `instructor-chat` uchun id har doim
   `instructor-chat::::` chiqardi, ya'ni bittadan ortiq suhbat texnik jihatdan
   mumkin emasdi — tarix ro'yxati ham, "Yangi suhbat" ham shu sabab
   ma'nosiz edi. */
function isloh_aiThreadMeta() {
  const ctxKey = isloh_aiContextKey();
  const cur = isloh_aiCurrentLesson();
  const threadId = cur.lessonId
    ? isloh_aiThreadId(ctxKey, cur.courseId, cur.lessonId)
    : (typeof isloh_aiGetActiveThreadId === 'function'
        ? isloh_aiGetActiveThreadId(ctxKey)
        : isloh_aiThreadId(ctxKey, '', ''));

  return {
    threadId: threadId,
    contextKey: ctxKey,
    courseId: cur.courseId,
    lessonId: cur.lessonId,
    title: cur.lessonTitle || ''
  };
}

/* Shablon javoblaridagi {lesson} / {course} o'rin egallovchilari.
   Shu sabab javob endi "qaysidir dars" emas, ochilgan darsni nomlaydi. */
function isloh_aiFillPlaceholders(html) {
  const cur = isloh_aiCurrentLesson();
  return String(html || '')
    .replace(/\{lesson\}/g, cur.lessonTitle || 'joriy dars')
    .replace(/\{course\}/g, cur.courseTitle || 'joriy kurs');
}

/* Kontekst qatorini joriy darsga moslaydi */
function isloh_aiSyncContextLabel() {
  const el = document.querySelector('[data-ai-context-label]');
  const ctxKey = isloh_aiContextKey();
  const ctx = (typeof isloh_aiContext === 'function' && ctxKey) ? isloh_aiContext(ctxKey) : null;
  if (!el || !ctx) return;
  const lessonTitle = isloh_aiCurrentLesson().lessonTitle;
  const label = isloh_aiT('ai.ctx.' + ctxKey, ctx.label);
  el.textContent = isloh_aiT('ai.context', 'Kontekst: {label}', { label: label })
    + (lessonTitle ? ' · ' + lessonTitle : '');
}

/* Foydalanuvchi bosh harflari — profil do'konidan (js/profile.js), qattiq
   kodlangan "SM" emas. profile.js ulanmagan sahifada ham yiqilmaydi. */
function isloh_aiUserInitials() {
  if (typeof isloh_getUserProfile === 'function' && typeof isloh_getUserInitials === 'function') {
    return isloh_getUserInitials(isloh_getUserProfile().name);
  }
  return '?';
}

/* Salomlashuvdagi ism. Ilgari "Salom, Akmal!" markupga qattiq yozilgan edi:
   profil sahifasida ism o'zgartirilsa ham AI paneli eski ismni aytaverardi.
   Avatar bosh harflari allaqachon do'kondan olinardi — endi ism ham. */
function isloh_aiSyncGreeting() {
  const el = document.querySelector('[data-ai-greeting]');
  if (!el || typeof isloh_getUserProfile !== 'function') return;
  const firstName = String(isloh_getUserProfile().name || '').trim().split(/\s+/)[0];
  if (!firstName) return;
  el.textContent = isloh_aiT('ai.greeting', 'Salom, {name}! ✨', { name: firstName });
}

function isloh_aiAvatar(role) {
  return role === 'ai'
    ? '<div class="avatar-sm"><i class="bi bi-stars"></i></div>'
    : `<div class="avatar-sm">${isloh_aiUserInitials()}</div>`;
}

/* Suhbat ikki xil qobiqda yashaydi: drawer'da skroller `.ai-drawer-body`,
   to'liq sahifali AI Yordamchida esa `.ai-body`. Ilgari faqat birinchisi
   qidirilardi — natijada to'liq sahifada oyna hech qachon pastga tushmasdi
   va yangi javob ekrandan tashqarida qolib ketardi. */
function isloh_aiScrollToBottom() {
  const body = document.querySelector('.ai-drawer-body, .ai-body');
  if (body) body.scrollTop = body.scrollHeight;
}

/* `data-ai-empty-extra` — bo'sh holatda ko'rinadigan qo'shimcha blok
   (to'liq sahifadagi "Barcha shablonlar" ro'yxati). Suhbat boshlangach u ham
   yig'ishtiriladi, aks holda javoblar ro'yxat ostida qolib ketardi. */
function isloh_aiSetEmptyVisible(visible) {
  ['[data-ai-empty]', '[data-ai-suggestions]', '[data-ai-empty-extra]'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.hidden = !visible;
  });
}

/* Do'konga yozish. `persist=false` — saqlangan suhbatni qayta chizayotganda
   (aks holda har ochilishda xabarlar ikkilanardi). */
/* Kvota to'lganda ogohlantirish bir marta beriladi — har bir xabarda
   takrorlansa suhbat toast'lar ostida qolib ketardi. Ilgari do'kon `false`
   qaytarardi, lekin buni hech kim tekshirmasdi: yozishma jimgina
   saqlanmay qo'yardi va foydalanuvchi buni sahifani yangilagandagina
   bilardi. */
let isloh_aiQuotaWarned = false;

function isloh_aiPersist(message) {
  if (typeof isloh_aiAppendMessage !== 'function') return;

  const saved = isloh_aiAppendMessage(isloh_aiThreadMeta(), message);
  if (!saved && !isloh_aiQuotaWarned) {
    isloh_aiQuotaWarned = true;
    isloh_aiToast(isloh_aiT('ai.quota', "Xotira to'ldi — suhbat saqlanmayapti. Eski suhbatlarni o'chiring."), 'error');
  }
  // Tarix ro'yxati har yangi xabardan keyin yangilanadi (xabar soni, vaqti)
  isloh_aiRenderHistory();
}

function isloh_aiAppendUserMessage(text, persist) {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return;
  isloh_aiSetEmptyVisible(false);
  const row = document.createElement('div');
  row.className = 'msg user';
  row.innerHTML = `${isloh_aiAvatar('user')}<div class="msg-bubble"></div>`;
  row.querySelector('.msg-bubble').textContent = text;
  list.appendChild(row);
  isloh_aiScrollToBottom();

  if (persist !== false) isloh_aiPersist({ role: 'user', text: text });
}

function isloh_aiAppendTyping() {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return null;
  const row = document.createElement('div');
  row.className = 'msg ai';
  row.dataset.aiTyping = '';
  // Nuqtachalar bezak — skrin-rider uchun matnli muqobili ham bo'lsin
  row.innerHTML = `${isloh_aiAvatar('ai')}<div class="msg-bubble">
    <div class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>
    <span class="sr-only">Javob yozilmoqda</span>
  </div>`;
  list.appendChild(row);
  isloh_aiScrollToBottom();
  return row;
}

function isloh_aiFlashcardsHtml() {
  const cards = [
    { front:"Docker image", back:"Konteyner ishga tushirish uchun o'zgarmas andoza (shablon)." },
    { front:"Konteyner", back:"Image asosida ishga tushirilgan, izolyatsiyalangan jonli jarayon." },
    { front:"Dockerfile", back:"Image qanday qurilishini belgilaydigan matnli ko'rsatmalar fayli." }
  ];
  const cardHtml = cards.map((c) => `
    <div class="flashcard" data-flashcard tabindex="0" role="button" aria-label="Fleshkartani ag'darish">
      <div class="flashcard-inner">
        <div class="flashcard-face front">${c.front}</div>
        <div class="flashcard-face back">${c.back}</div>
      </div>
    </div>`).join('');
  return `<div class="flashcard-stack">${cardHtml}</div>`;
}

function isloh_aiInsertIntoEditor(sourceEl) {
  const target = document.querySelector('[data-ai-insert-target]') || document.querySelector('.editor-textarea');
  if (!target) {
    isloh_aiToast(isloh_aiT('ai.insert.nospot', "Muharrirda joy topilmadi"), 'error');
    return;
  }
  target.value = (target.value ? target.value + '\n\n' : '') + sourceEl.innerText.trim();
  target.dispatchEvent(new Event('input', { bubbles: true }));
  isloh_aiToast(isloh_aiT('ai.insert.done', "Muharrirga qo'shildi"), 'success');
}

function isloh_aiAppendAiMessage(templateKey, html, persist) {
  const list = document.querySelector('[data-ai-messages]');
  if (!list) return;

  if (persist !== false) isloh_aiPersist({ role: 'ai', html: html, templateKey: templateKey || '' });

  if (html === '__FLASHCARDS__') html = isloh_aiFlashcardsHtml();
  // {lesson}/{course} o'rin egallovchilari chizishdan oldin to'ldiriladi
  html = isloh_aiFillPlaceholders(html);

  const isGenerate = ['outline','generate-lesson','generate-quiz','generate-assignment','outcomes','seo','rubric'].includes(templateKey);
  const row = document.createElement('div');
  row.className = 'msg ai';
  const bubbleClass = isGenerate ? 'response-card' + (isloh_aiPanel()?.classList.contains('theme-teach') ? ' teach' : '') : 'msg-bubble';
  row.innerHTML = `${isloh_aiAvatar('ai')}<div>
    <div class="${bubbleClass}" data-ai-response>${html}</div>
    <div class="msg-actions">
      <button data-ai-copy><i class="bi bi-clipboard"></i> ${isloh_aiT('ai.act.copy', 'Nusxalash')}</button>
      ${isGenerate ? `<button data-ai-insert><i class="bi bi-box-arrow-in-down"></i> ${isloh_aiT('ai.act.insert', "Muharrirga qo'shish")}</button>` : ''}
      <button data-ai-regen data-key="${templateKey || ''}"><i class="bi bi-arrow-clockwise"></i> ${isloh_aiT('ai.act.regen', 'Qayta yaratish')}</button>
    </div>
  </div>`;
  list.appendChild(row);
  isloh_aiScrollToBottom();

  /* Toast faqat nusxalash HAQIQATAN bajarilgach chiqadi. Ilgari toast
     shartsiz ko'rsatilardi — clipboard yo'q yoki ruxsat berilmagan holatda
     ham "Nusxalandi" deb yolg'on aytardi. */
  row.querySelector('[data-ai-copy]')?.addEventListener('click', () => {
    const text = row.querySelector('[data-ai-response]').innerText;
    if (!navigator.clipboard) {
      isloh_aiToast(isloh_aiT('ai.copy.unsupported', "Brauzer nusxalashni qo'llab-quvvatlamaydi"), 'error');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => isloh_aiToast(isloh_aiT('ai.copy.done', 'Nusxalandi'), 'success'))
      .catch(() => isloh_aiToast(isloh_aiT('ai.copy.fail', "Nusxalab bo'lmadi"), 'error'));
  });
  row.querySelector('[data-ai-insert]')?.addEventListener('click', () => {
    isloh_aiInsertIntoEditor(row.querySelector('[data-ai-response]'));
  });
  row.querySelector('[data-ai-regen]')?.addEventListener('click', () => {
    if (templateKey) isloh_aiRunTemplate(templateKey, false);
  });

  row.querySelectorAll('[data-flashcard]').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('flipped'); }
    });
  });
}

/* `echo=false` — "Qayta yaratish"da savol bubble'i qayta chiqmaydi.
   Ilgari regen butun juftlikni takrorlab, suhbatni ikkilantirardi. */
function isloh_aiRunTemplate(templateKey, echo) {
  const ctxKey = isloh_aiContextKey();
  const template = (typeof isloh_aiFindTemplate === 'function') ? isloh_aiFindTemplate(ctxKey, templateKey) : null;
  if (!template) return;

  if (echo !== false) isloh_aiAppendUserMessage(isloh_aiTplTitle(template));
  isloh_aiSetEmptyVisible(false);
  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    isloh_aiAppendAiMessage(template.key, template.response);
  }, 900);
}

/* Mos shablon topilmaganda: demo ekani ochiq aytiladi va eng yaqin ikki
   shablon tugma sifatida taklif qilinadi (kartochkalar registrdan chiziladi,
   ya'ni matn ikki joyda takrorlanmaydi). */
function isloh_aiFallbackHtml(nearest) {
  const cards = (nearest || []).map(isloh_aiRenderPromptCard).join('');
  const lead = isloh_aiT('ai.demo.lead', 'Bu savolga aniq javob berish uchun real AI ulanishi kerak — hozir demo rejim ishlayapti.');
  const hint = isloh_aiT('ai.demo.hint', 'Shu oraliqda quyidagilardan biri yordam berishi mumkin:');
  return `<p>${lead}</p>` +
    (cards ? `<p class="ai-hint">${hint}</p><div class="ai-prompt-grid">${cards}</div>` : '');
}

/* Erkin matn. Ilgari savol nima bo'lishidan qat'i nazar bitta va o'sha
   paragraf qaytarilardi — hatto savol aynan mavjud shablon haqida bo'lsa
   ham. Endi matn kalit so'zlar bo'yicha shablonga yo'naltiriladi. */
function isloh_aiSendFreeText() {
  const input = document.querySelector('[data-ai-input]');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  isloh_aiAppendUserMessage(text);

  const match = (typeof isloh_aiMatchTemplate === 'function')
    ? isloh_aiMatchTemplate(isloh_aiContextKey(), text)
    : { best: null, nearest: [] };

  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    if (match.best) isloh_aiAppendAiMessage(match.best.key, match.best.response);
    else isloh_aiAppendAiMessage(null, isloh_aiFallbackHtml(match.nearest));
  }, 900);
}

/* --- Saqlangan suhbatni tiklash ------------------------------------------ */

/* Joriy thread'ni do'kondan o'qib qayta chizadi. Dars almashganda va panel
   birinchi marta yuklanganda chaqiriladi. */
function isloh_aiRestoreThread() {
  const list = document.querySelector('[data-ai-messages]');
  if (!list || typeof isloh_aiGetThread !== 'function') return;

  list.innerHTML = '';
  const thread = isloh_aiGetThread(isloh_aiThreadMeta().threadId);
  const messages = thread ? thread.messages : [];

  messages.forEach((m) => {
    if (m.role === 'user') isloh_aiAppendUserMessage(m.text, false);
    else isloh_aiAppendAiMessage(m.templateKey, m.html, false);
  });

  isloh_aiSetEmptyVisible(messages.length === 0);
}

/* --- Tarix tabi ---------------------------------------------------------- */

function isloh_aiRenderHistory() {
  const mount = document.querySelector('[data-ai-history-list]');
  const empty = document.querySelector('[data-ai-history-empty]');
  if (!mount || typeof isloh_aiListThreads !== 'function') return;

  const threads = isloh_aiListThreads(isloh_aiContextKey());
  const activeId = isloh_aiThreadMeta().threadId;

  mount.innerHTML = '';
  if (empty) empty.hidden = threads.length > 0;

  threads.forEach((t) => {
    const isActive = t.id === activeId;
    const row = document.createElement('div');
    row.className = 'ai-history-row' + (isActive ? ' active' : '');
    row.setAttribute('role', 'listitem');
    /* aria-current: skrin-rider qaysi suhbat ochiqligini eshitadi —
       ilgari buni faqat fon rangi bildirardi */
    row.innerHTML = `
      <button class="ai-history-open" type="button" data-ai-history-open${isActive ? ' aria-current="true"' : ''}>
        <i class="bi bi-chat-left-text" aria-hidden="true"></i>
        <span class="ahr-body">
          <span class="ahr-title"></span>
          <span class="ahr-meta"></span>
        </span>
      </button>
      <button class="icon-btn ai-history-del" type="button" data-ai-history-del aria-label="${isloh_aiT('ai.history.del', "Suhbatni o'chirish")}"><i class="bi bi-trash3"></i></button>`;

    row.dataset.threadId = t.id;
    row.dataset.lessonId = t.lessonId || '';
    row.querySelector('.ahr-title').textContent = t.title || isloh_aiT('ai.thread', 'Suhbat');
    row.querySelector('.ahr-meta').textContent =
      isloh_aiT('ai.history.meta', '{n} xabar', { n: (t.messages || []).length })
      + ' · ' + isloh_aiRelativeTime(t.updatedAt);
    mount.appendChild(row);
  });
}

/* Tarix qatori bosilganda uch xil holat bor:

   1. Bosilgan suhbat allaqachon ochiq — faqat Suhbat tabiga qaytiladi.
   2. Suhbat darsga bog'langan — avval o'sha darsga o'tiladi (pleer
      `isloh:lesson-change` yuboradi → suhbat o'zi tiklanadi). Dars shu
      sahifada bo'lmasa, ochib bo'lmasligi ochiq aytiladi.
   3. Erkin suhbat (to'liq sahifali AI Yordamchi) — faol suhbat almashadi va
      yozishmalar darhol qayta chiziladi. Ilgari bu tarmoq umuman yo'q edi:
      har qanday boshqa suhbat "boshqa kursga tegishli" deb rad etilardi. */
function isloh_aiOpenHistoryThread(row) {
  const threadId = row.dataset.threadId;
  const lessonId = row.dataset.lessonId;
  const meta = isloh_aiThreadMeta();

  if (threadId !== meta.threadId) {
    if (lessonId) {
      const lessonRow = document.querySelector(`[data-cps-lesson][data-lesson-id="${lessonId}"]`);
      if (!lessonRow || typeof isloh_setActiveLesson !== 'function') {
        isloh_aiToast(isloh_aiT('ai.thread.other', 'Bu suhbat boshqa kursga tegishli'), 'info');
        return;
      }
      isloh_setActiveLesson(lessonId);
    } else {
      if (typeof isloh_aiSetActiveThreadId === 'function') {
        isloh_aiSetActiveThreadId(meta.contextKey, threadId);
      }
      isloh_aiRestoreThread();
      isloh_aiRenderHistory();
    }
  }

  // Suhbat tabiga qaytish (drawer'da; to'liq sahifada tab yo'q)
  document.querySelector('.ai-drawer-tabs .tab-item[data-tab-target="ai-tab-chat"]')?.click();
}

/* Sahifalararo kirish nuqtasi: `ai-assistant.html?run=<templateKey>`.

   Nega kerak: Dashboard'dagi "AI tahlili" kartochkalari shu paytgacha
   shunchaki matn edi — o'qituvchi "Xavf ostidagi talabalar" degan xulosani
   ko'rardi-yu, uni ochib ko'ra olmasdi. `data-ai-quick` faqat BIR sahifa
   ichida ishlaydi, chunki drawer o'sha sahifada bo'lishi kerak.

   Query satri `file://` ostida ham ishlaydi (CLAUDE.md §3), shuning uchun
   bu yondashuv serversiz ham buziladigan joyi yo'q. */
function isloh_aiRunFromQuery() {
  const key = new URLSearchParams(window.location.search).get('run');
  if (!key) return;
  if (typeof isloh_aiFindTemplate !== 'function') return;
  if (!isloh_aiFindTemplate(isloh_aiContextKey(), key)) return;

  /* Yangi suhbatda ochiladi — mavjud yozishmaning oxiriga jimgina
     qo'shilib qolmasin */
  if (typeof isloh_aiStartNewThread === 'function') {
    isloh_aiStartNewThread(isloh_aiContextKey());
    isloh_aiRestoreThread();
  }
  isloh_aiRunTemplate(key);
  isloh_aiRenderHistory();
}

function isloh_aiOpenAndRun(contextKey, templateKey) {
  const panelCtx = isloh_aiContextKey();
  if (panelCtx !== contextKey) return; // drawer on this page is scoped to a different context
  isloh_openModal('ai-drawer-overlay');
  document.getElementById('ai-drawer-panel')?.classList.remove('minimized');
  isloh_aiRunTemplate(templateKey);
}

/* --- Suhbatni o'chirishni tasdiqlash -------------------------------------
   O'chirish qaytarib bo'lmaydi, shuning uchun bir bosishda ketmasin.
   Dialog markupi JS'da yasaladi: u drawer'ning "Tarix" tabida ham, ikkala
   to'liq sahifada ham kerak — uchta joyda takrorlashning ma'nosi yo'q.
   Fon bosish, Escape va fokus tuzog'i js/modal.js zimmasida. */

const ISLOH_AI_CONFIRM_ID = 'ai-delete-confirm';
let isloh_aiPendingDeleteId = null;

function isloh_aiEnsureConfirmDialog() {
  if (document.getElementById(ISLOH_AI_CONFIRM_ID)) return;

  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay';
  wrap.id = ISLOH_AI_CONFIRM_ID;
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-delete-confirm-title">
      <div class="modal-head">
        <h3 id="ai-delete-confirm-title">${isloh_aiT('ai.del.title', "Suhbatni o'chirish")}</h3>
        <button class="icon-btn" data-modal-close="${ISLOH_AI_CONFIRM_ID}" aria-label="${isloh_aiT('ai.close', 'Yopish')}"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="modal-body">
        <p class="modal-note" data-ai-del-note></p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-modal-close="${ISLOH_AI_CONFIRM_ID}" data-modal-autofocus>${isloh_aiT('ai.cancel', 'Bekor qilish')}</button>
        <button class="btn btn-danger" data-ai-del-confirm>${isloh_aiT('ai.del.ok', "O'chirish")}</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function isloh_aiAskDeleteThread(row) {
  isloh_aiPendingDeleteId = row.dataset.threadId;

  const title = row.querySelector('.ahr-title')?.textContent || isloh_aiT('ai.thread', 'Suhbat');
  const message = isloh_aiT('ai.del.note',
    '"{title}" suhbati butunlay o\'chiriladi. Bu amalni qaytarib bo\'lmaydi.', { title: title });

  /* js/modal.js ulanmagan sahifada dialog ko'rinmasdi va savat tugmasi
     jimgina hech narsa qilmasdi. Zaxira sifatida brauzer tasdig'i —
     amal hech qachon "o'lik" bo'lib qolmasin. */
  if (typeof isloh_openModal !== 'function') {
    if (window.confirm(message)) isloh_aiConfirmDeleteThread();
    else isloh_aiPendingDeleteId = null;
    return;
  }

  isloh_aiEnsureConfirmDialog();
  const note = document.querySelector('[data-ai-del-note]');
  if (note) note.textContent = message;
  isloh_openModal(ISLOH_AI_CONFIRM_ID);
}

function isloh_aiConfirmDeleteThread() {
  if (typeof isloh_closeModal === 'function') isloh_closeModal(ISLOH_AI_CONFIRM_ID);
  const threadId = isloh_aiPendingDeleteId;
  isloh_aiPendingDeleteId = null;
  if (!threadId) return;

  const wasActive = threadId === isloh_aiThreadMeta().threadId;
  if (typeof isloh_aiDeleteThread === 'function') isloh_aiDeleteThread(threadId);
  if (wasActive) isloh_aiRestoreThread();
  isloh_aiRenderHistory();
  isloh_aiToast(isloh_aiT('ai.del.done', "Suhbat o'chirildi"), 'info');
}

/* --- Tor ekranda suhbatlar ustuni ---------------------------------------
   ≤900px da ustun `display:none` edi va uni qaytaradigan hech narsa yo'q
   edi — ya'ni telefonda saqlangan suhbatlarga umuman kirib bo'lmasdi. */
function isloh_aiSetHistoryOpen(open) {
  const col = document.getElementById('ai-history-col');
  const backdrop = document.querySelector('[data-ai-history-backdrop]');
  const toggle = document.querySelector('[data-ai-history-toggle]');
  if (!col) return;

  col.classList.toggle('open', open);
  if (backdrop) backdrop.hidden = !open;
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
  // Yopilganda fokus ochgan tugmaga qaytadi
  if (open) col.querySelector('.new-chat-btn')?.focus();
  else toggle?.focus();
}

function isloh_initAiDrawerEvents() {
  const mount = document.getElementById('ai-drawer-mount');
  if (!mount) return;

  mount.addEventListener('click', (e) => {
    const runBtn = e.target.closest('[data-ai-run]');
    if (runBtn) { isloh_aiRunTemplate(runBtn.dataset.aiRun); return; }

    if (e.target.closest('[data-ai-send]')) { isloh_aiSendFreeText(); return; }

    const tplBtn = e.target.closest('[data-ai-templates-toggle]');
    if (tplBtn) { isloh_aiToggleTemplates(tplBtn); return; }

    const minBtn = e.target.closest('[data-ai-minimize]');
    if (minBtn) {
      const panel = isloh_aiPanel();
      const minimized = panel?.classList.toggle('minimized');
      minBtn.setAttribute('aria-expanded', String(!minimized));
      minBtn.setAttribute('aria-label', minimized ? 'Kengaytirish' : 'Kichraytirish');
      const icon = minBtn.querySelector('i');
      if (icon) icon.className = minimized ? 'bi bi-chevron-up' : 'bi bi-dash-lg';
      return;
    }

    /* "Yangi suhbat" — tozalashdan farqli o'laroq eskisini O'CHIRMAYDI,
       shunchaki yangi faol suhbat ochadi va eskisi tarixda qoladi. */
    if (e.target.closest('[data-ai-new-thread]')) {
      if (typeof isloh_aiStartNewThread === 'function') {
        isloh_aiStartNewThread(isloh_aiContextKey());
      }
      isloh_aiRestoreThread();
      isloh_aiRenderHistory();
      document.querySelector('[data-ai-input]')?.focus();
      return;
    }

    // Tozalash endi do'kondan ham o'chiradi — aks holda sahifa yangilanganda
    // "tozalangan" suhbat qaytib kelardi
    if (e.target.closest('[data-ai-clear]')) {
      const list = document.querySelector('[data-ai-messages]');
      if (list) list.innerHTML = '';
      if (typeof isloh_aiDeleteThread === 'function') isloh_aiDeleteThread(isloh_aiThreadMeta().threadId);
      isloh_aiSetEmptyVisible(true);
      isloh_aiRenderHistory();
      isloh_aiToast(isloh_aiT('ai.cleared', 'Suhbat tozalandi'), 'info');
      return;
    }

    // O'chirish endi darhol bajarilmaydi — avval tasdiqlash so'raladi
    const delBtn = e.target.closest('[data-ai-history-del]');
    if (delBtn) { isloh_aiAskDeleteThread(delBtn.closest('.ai-history-row')); return; }

    const histBtn = e.target.closest('[data-ai-history-open]');
    if (histBtn) {
      isloh_aiOpenHistoryThread(histBtn.closest('.ai-history-row'));
      // Telefonda suhbat tanlangach ustun yopiladi
      if (document.getElementById('ai-history-col')?.classList.contains('open')) {
        isloh_aiSetHistoryOpen(false);
      }
      return;
    }

    if (e.target.closest('[data-ai-history-toggle]')) {
      isloh_aiSetHistoryOpen(!document.getElementById('ai-history-col')?.classList.contains('open'));
      return;
    }
    if (e.target.closest('[data-ai-history-backdrop]')) { isloh_aiSetHistoryOpen(false); return; }
  });

  /* Tasdiqlash dialogi <body> ga qo'shiladi (mount ichida emas), shuning
     uchun uning tugmasi hujjat darajasida tinglanadi */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-ai-del-confirm]')) isloh_aiConfirmDeleteThread();
  });

  // Escape ustunni ham yopsin (modal.js faqat overlay'lar bilan ishlaydi)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('ai-history-col')?.classList.contains('open')) {
      isloh_aiSetHistoryOpen(false);
    }
  });

  mount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-ai-input]')) { e.preventDefault(); isloh_aiSendFreeText(); }
  });
}

/* To'liq sahifali AI Yordamchida takliflar va shablonlar ro'yxati ham
   registrdan chiziladi. Drawer'da buni js/ai-panel.js bajaradi — endi ikkala
   qobiq ham bir manbadan oziqlanadi va markupda kartochka takrorlanmaydi. */
function isloh_aiRenderShellTemplates(force) {
  const ctxKey = isloh_aiContextKey();
  const ctx = (typeof isloh_aiContext === 'function' && ctxKey) ? isloh_aiContext(ctxKey) : null;
  if (!ctx) return;

  /* Drawer'da bu joy js/ai-panel.js tomonidan allaqachon to'ldirilgan —
     ikki marta chizilmasin. `force` faqat til almashganda beriladi. */
  const suggestMount = document.querySelector('[data-ai-suggestions]');
  if (suggestMount && (force || !suggestMount.children.length)) {
    suggestMount.innerHTML = ctx.templates.slice(0, 3).map(isloh_aiRenderSuggestCard).join('');
  }

  const grid = document.querySelector('[data-ai-template-grid]');
  if (grid) grid.innerHTML = isloh_aiRenderPromptGroups(ctx);

  /* Drawer'ning "Shablonlar" tabi ham registrdan — u markupda emas,
     ai-panel.js yasagan HTML'da, ya'ni `data-i18n` unga yetib bormaydi */
  const drawerPanel = document.querySelector('[data-tab-panel="ai-tab-templates"]');
  if (drawerPanel && force) drawerPanel.innerHTML = isloh_aiRenderPromptGroups(ctx);

  const count = document.querySelector('[data-ai-template-count]');
  if (count) count.textContent = ctx.templates.length;
}

/* Til almashganda registrdan chizilgan hamma narsa qayta chiziladi.
   `data-i18n` faqat markupdagi matnni almashtiradi — kartochkalar,
   suhbat tarixi va yozishmalar esa JS bilan yasalgan. */
function isloh_aiOnLanguageApplied() {
  if (!isloh_aiPanel()) return;
  isloh_aiRenderShellTemplates(true);
  isloh_aiSyncContextLabel();
  isloh_aiSyncGreeting();
  isloh_aiRestoreThread();
  isloh_aiRenderHistory();
}

/* Shablonlar ro'yxatini ochish/yopish (to'liq sahifada tab yo'q) */
function isloh_aiToggleTemplates(btn) {
  const panel = document.querySelector('[data-ai-templates-panel]');
  if (!panel) return;
  const show = panel.hidden;
  panel.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  const icon = btn.querySelector('i');
  if (icon) icon.className = show ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
}

function isloh_initAiQuickChips() {
  document.querySelectorAll('[data-ai-quick]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const [ctxKey, tplKey] = chip.dataset.aiQuick.split(':');
      isloh_aiOpenAndRun(ctxKey, tplKey);
    });
  });
}

/* Dars almashganda: kontekst yorlig'i, saqlangan suhbat va tarix — uchalasi
   ham yangi darsga moslanadi. Panel ochiq bo'lsa ham, yopiq bo'lsa ham
   ishlaydi, shuning uchun keyingi ochilishda to'g'ri suhbat turadi. */
function isloh_aiSyncToLesson() {
  isloh_aiSyncContextLabel();
  isloh_aiRestoreThread();
  isloh_aiRenderHistory();
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initAiDrawerEvents();
  isloh_initAiQuickChips();
  isloh_aiRenderShellTemplates();
  isloh_aiSyncGreeting();

  /* Pleer darslarni chizgandan keyin ishlashi uchun hodisaga ulanamiz;
     dastlabki holat esa darhol tiklanadi (dars yo'q sahifalar uchun). */
  document.addEventListener('isloh:lesson-change', isloh_aiSyncToLesson);
  document.addEventListener('isloh:i18n-applied', isloh_aiOnLanguageApplied);
  isloh_aiSyncToLesson();
  isloh_aiRunFromQuery();
});
