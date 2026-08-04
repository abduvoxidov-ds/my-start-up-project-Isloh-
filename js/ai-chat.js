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

/* Thread meta — do'kon uchun ham, tarix qatori sarlavhasi uchun ham */
function isloh_aiThreadMeta() {
  const ctxKey = isloh_aiContextKey();
  const ctx = (typeof isloh_aiContext === 'function' && ctxKey) ? isloh_aiContext(ctxKey) : null;
  const cur = isloh_aiCurrentLesson();
  return {
    threadId: isloh_aiThreadId(ctxKey, cur.courseId, cur.lessonId),
    contextKey: ctxKey,
    courseId: cur.courseId,
    lessonId: cur.lessonId,
    title: cur.lessonTitle || (ctx ? ctx.label : 'Suhbat')
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
  el.textContent = 'Kontekst: ' + ctx.label + (lessonTitle ? ' · ' + lessonTitle : '');
}

/* Foydalanuvchi bosh harflari — profil do'konidan (js/profile.js), qattiq
   kodlangan "SM" emas. profile.js ulanmagan sahifada ham yiqilmaydi. */
function isloh_aiUserInitials() {
  if (typeof isloh_getUserProfile === 'function' && typeof isloh_getUserInitials === 'function') {
    return isloh_getUserInitials(isloh_getUserProfile().name);
  }
  return '?';
}

function isloh_aiAvatar(role) {
  return role === 'ai'
    ? '<div class="avatar-sm"><i class="bi bi-stars"></i></div>'
    : `<div class="avatar-sm">${isloh_aiUserInitials()}</div>`;
}

function isloh_aiScrollToBottom() {
  const body = document.querySelector('.ai-drawer-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function isloh_aiSetEmptyVisible(visible) {
  const empty = document.querySelector('[data-ai-empty]');
  const suggestions = document.querySelector('[data-ai-suggestions]');
  if (empty) empty.hidden = !visible;
  if (suggestions) suggestions.hidden = !visible;
}

/* Do'konga yozish. `persist=false` — saqlangan suhbatni qayta chizayotganda
   (aks holda har ochilishda xabarlar ikkilanardi). */
function isloh_aiPersist(message) {
  if (typeof isloh_aiAppendMessage !== 'function') return;
  isloh_aiAppendMessage(isloh_aiThreadMeta(), message);
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
    if (typeof isloh_showToast === 'function') isloh_showToast("Muharrirda joy topilmadi", 'error');
    return;
  }
  target.value = (target.value ? target.value + '\n\n' : '') + sourceEl.innerText.trim();
  target.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof isloh_showToast === 'function') isloh_showToast("Muharrirga qo'shildi", 'success');
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
      <button data-ai-copy><i class="bi bi-clipboard"></i> Nusxalash</button>
      ${isGenerate ? '<button data-ai-insert><i class="bi bi-box-arrow-in-down"></i> Muharrirga qo\'shish</button>' : ''}
      <button data-ai-regen data-key="${templateKey || ''}"><i class="bi bi-arrow-clockwise"></i> Qayta yaratish</button>
    </div>
  </div>`;
  list.appendChild(row);
  isloh_aiScrollToBottom();

  /* Toast faqat nusxalash HAQIQATAN bajarilgach chiqadi. Ilgari toast
     shartsiz ko'rsatilardi — clipboard yo'q yoki ruxsat berilmagan holatda
     ham "Nusxalandi" deb yolg'on aytardi. */
  row.querySelector('[data-ai-copy]')?.addEventListener('click', () => {
    const text = row.querySelector('[data-ai-response]').innerText;
    const toast = (msg, type) => { if (typeof isloh_showToast === 'function') isloh_showToast(msg, type); };
    if (!navigator.clipboard) {
      toast('Brauzer nusxalashni qo\'llab-quvvatlamaydi', 'error');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast('Nusxalandi', 'success'))
      .catch(() => toast('Nusxalab bo\'lmadi', 'error'));
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

  if (echo !== false) isloh_aiAppendUserMessage(template.title);
  isloh_aiSetEmptyVisible(false);
  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    isloh_aiAppendAiMessage(template.key, template.response);
  }, 900);
}

function isloh_aiSendFreeText() {
  const input = document.querySelector('[data-ai-input]');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  isloh_aiAppendUserMessage(text);
  const typingRow = isloh_aiAppendTyping();
  setTimeout(() => {
    typingRow?.remove();
    isloh_aiAppendAiMessage(null, `<p>Savolingiz uchun rahmat! Bu demo rejim — real AI javobi hozircha ulanmagan, lekin yuqoridagi shablonlardan birini sinab ko'rishingiz mumkin.</p>`);
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
    const row = document.createElement('div');
    row.className = 'ai-history-row' + (t.id === activeId ? ' active' : '');
    row.innerHTML = `
      <button class="ai-history-open" type="button" data-ai-history-open>
        <i class="bi bi-chat-left-text" aria-hidden="true"></i>
        <span class="ahr-body">
          <span class="ahr-title"></span>
          <span class="ahr-meta"></span>
        </span>
      </button>
      <button class="icon-btn ai-history-del" type="button" data-ai-history-del aria-label="Suhbatni o'chirish"><i class="bi bi-trash3"></i></button>`;

    row.dataset.threadId = t.id;
    row.dataset.lessonId = t.lessonId || '';
    row.querySelector('.ahr-title').textContent = t.title || 'Suhbat';
    row.querySelector('.ahr-meta').textContent =
      (t.messages || []).length + ' xabar · ' + isloh_aiRelativeTime(t.updatedAt);
    mount.appendChild(row);
  });
}

/* Tarix qatori bosilganda: suhbat darsga bog'langani uchun avval o'sha
   darsga o'tiladi (pleer `isloh:lesson-change` yuboradi → suhbat o'zi
   tiklanadi). Dars shu sahifada bo'lmasa (boshqa kurs suhbati) — ochib
   bo'lmasligi ochiq aytiladi, jimgina noto'g'ri suhbat ko'rsatilmaydi. */
function isloh_aiOpenHistoryThread(row) {
  const threadId = row.dataset.threadId;
  const lessonId = row.dataset.lessonId;
  const current = isloh_aiThreadMeta().threadId;

  if (threadId !== current) {
    const lessonRow = lessonId ? document.querySelector(`[data-cps-lesson][data-lesson-id="${lessonId}"]`) : null;
    if (!lessonRow || typeof isloh_setActiveLesson !== 'function') {
      if (typeof isloh_showToast === 'function') isloh_showToast('Bu suhbat boshqa kursga tegishli', 'info');
      return;
    }
    isloh_setActiveLesson(lessonId);
  }

  // Suhbat tabiga qaytish
  document.querySelector('.ai-drawer-tabs .tab-item[data-tab-target="ai-tab-chat"]')?.click();
}

function isloh_aiOpenAndRun(contextKey, templateKey) {
  const panelCtx = isloh_aiContextKey();
  if (panelCtx !== contextKey) return; // drawer on this page is scoped to a different context
  isloh_openModal('ai-drawer-overlay');
  document.getElementById('ai-drawer-panel')?.classList.remove('minimized');
  isloh_aiRunTemplate(templateKey);
}

function isloh_initAiDrawerEvents() {
  const mount = document.getElementById('ai-drawer-mount');
  if (!mount) return;

  mount.addEventListener('click', (e) => {
    const runBtn = e.target.closest('[data-ai-run]');
    if (runBtn) { isloh_aiRunTemplate(runBtn.dataset.aiRun); return; }

    if (e.target.closest('[data-ai-send]')) { isloh_aiSendFreeText(); return; }

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

    // Tozalash endi do'kondan ham o'chiradi — aks holda sahifa yangilanganda
    // "tozalangan" suhbat qaytib kelardi
    if (e.target.closest('[data-ai-clear]')) {
      const list = document.querySelector('[data-ai-messages]');
      if (list) list.innerHTML = '';
      if (typeof isloh_aiDeleteThread === 'function') isloh_aiDeleteThread(isloh_aiThreadMeta().threadId);
      isloh_aiSetEmptyVisible(true);
      isloh_aiRenderHistory();
      if (typeof isloh_showToast === 'function') isloh_showToast('Suhbat tozalandi', 'info');
      return;
    }

    const delBtn = e.target.closest('[data-ai-history-del]');
    if (delBtn) {
      const row = delBtn.closest('.ai-history-row');
      const isActive = row.dataset.threadId === isloh_aiThreadMeta().threadId;
      if (typeof isloh_aiDeleteThread === 'function') isloh_aiDeleteThread(row.dataset.threadId);
      if (isActive) isloh_aiRestoreThread();
      isloh_aiRenderHistory();
      if (typeof isloh_showToast === 'function') isloh_showToast("Suhbat o'chirildi", 'info');
      return;
    }

    const histBtn = e.target.closest('[data-ai-history-open]');
    if (histBtn) { isloh_aiOpenHistoryThread(histBtn.closest('.ai-history-row')); return; }
  });

  mount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-ai-input]')) { e.preventDefault(); isloh_aiSendFreeText(); }
  });
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

  /* Pleer darslarni chizgandan keyin ishlashi uchun hodisaga ulanamiz;
     dastlabki holat esa darhol tiklanadi (dars yo'q sahifalar uchun). */
  document.addEventListener('isloh:lesson-change', isloh_aiSyncToLesson);
  isloh_aiSyncToLesson();
});
