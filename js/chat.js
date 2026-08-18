/* ==========================================================================
   ISLOH — Chat ko'rinishi (view)
   Xabarlar oynasining DOM qismi: ro'yxatni chizish, thread ochish, xabar
   yuborish, qidirish. MA'LUMOT bu yerda saqlanmaydi — u js/chat-store.js
   dagi yagona do'konda yashaydi, shu sababli bu fayl talaba, instruktor va
   admin sahifalari uchun bir xil ishlaydi (CLAUDE.md §2 — DRY).

   Skript tartibi muhim: chat-store.js chat.js dan OLDIN ulanadi.

   Markup shartnomasi:
     [data-chat-list]                    → suhbatlar ro'yxati joylashadi
       [data-chat-list-empty]            → ro'yxat bo'sh bo'lganda
     [data-chat-empty-state]             → hech qanday thread ochilmaganda
     [data-chat-active-thread]           → thread ochilganda ko'rinadi
       [data-thread-avatar/-presence/-name/-status]
       [data-thread-pin]                 → qadalgan e'lon (ixtiyoriy)
       [data-thread-body]                → xabar puffaklari joylashadi
     #chat-search-input                  → ro'yxatni filtrlaydi
     #chat-message-input, [data-chat-send], [data-chat-attach]
     [data-new-chat] → #new-chat-modal ni ochadi
       #new-chat-email, [data-new-chat-submit], [data-modal-close]

   Ro'yxat filtri `isloh_chatListFilter` obyektida turadi — 3-bosqichda
   instruktor tab'lari (Suhbatlar / Kurs guruhlari / Arxiv) shuni
   o'zgartiradi, chizish mantiqi esa o'zgarmaydi.
   ========================================================================== */

let isloh_activeChatThreadId = null;
let isloh_chatListFilter = {};

/* Tor ekranda ro'yxat va suhbat bir vaqtda sig'maydi — ular navbat bilan
   ko'rsatiladi (css/widgets.css, ≤700px). Shu chegara JS'da ham kerak:
   sahifa ochilganda avtomatik suhbat OCHILMAYDI, foydalanuvchi avval
   ro'yxatni ko'radi. */
const ISLOH_CHAT_NARROW_MQ = '(max-width: 700px)';

function isloh_isChatNarrow() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(ISLOH_CHAT_NARROW_MQ).matches
    : false;
}

/* --- Formatlash ----------------------------------------------------------- */

/* Tarjima qisqartmasi. Mantiq js/chat-store.js da (u chat.js dan oldin
   ulanadi), bu yerda takrorlanmaydi — CLAUDE.md §2. */
function isloh_chatText(key, uz, vars) {
  return isloh_chatT(key, uz, vars);
}

function isloh_chatToast(key, uz, type, vars) {
  if (typeof isloh_showToast === 'function') isloh_showToast(isloh_chatText(key, uz, vars), type || 'success');
}

/* M6: ekranlash endi js/escape.js da, YAGONA joyda.

   Bu yerdagi eski nusxa faqat `<` va `>` ni almashtirardi — atribut ichida
   yetarli emas edi (`"` qolib ketardi). Nom saqlandi, chunki uni shu
   faylda 5 ta chaqiruv joyi ishlatadi va ular xabar matni uchun ataylab
   o'qiladi; ish esa endi umumiy funksiyaga topshiriladi. */
function isloh_escapeChatText(str) {
  return isloh_escapeHtml(str);
}

function isloh_chatRelativeTime(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return isloh_chatText('chat.time.now', 'hozir');
  if (diffMin < 60) return isloh_chatText('chat.time.min', '{n} daq', { n: diffMin });
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return isloh_chatText('chat.time.hour', '{n} soat', { n: diffHour });
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return isloh_chatText('chat.time.yesterday', 'Kecha');
  return isloh_chatText('chat.time.day', '{n} kun', { n: diffDay });
}

/* Xabar vaqti — tanlangan mintaqada (js/datetime.js) */
function isloh_chatBubbleTime(ts) {
  return isloh_dtTime(ts);
}

/* --- Suhbatlar ro'yxati --------------------------------------------------- */

/* Guruhda oxirgi xabar oldiga yuboruvchi ismi qo'yiladi ("Nodira: ...").
   Do'konda `lastMessage` sof matn bo'lib turadi, prefiks faqat shu yerda
   yasaladi — aks holda ism ikki joyda saqlanardi. */
function isloh_chatLastMessagePreview(thread) {
  const text = thread.lastMessage || '';
  if (!text || thread.type !== 'group') return text;
  if (thread.lastSenderId === isloh_chatMeId()) return isloh_chatText('chat.you', 'Siz') + ': ' + text;
  const sender = isloh_chatUser(thread.lastSenderId);
  return sender ? sender.name.split(' ')[0] + ': ' + text : text;
}

/* Ro'yxat `role="listbox"`, bandlar esa `role="option"` — ular oddiy
   <div> emas, klaviatura bilan tanlanadigan elementlar. Faqat aktiv band
   Tab bilan fokusga tushadi, qolganlariga strelkalar bilan o'tiladi. */
function isloh_chatItemHtml(thread) {
  const unread = isloh_chatUnread(thread);
  const presence = isloh_chatThreadPresence(thread);
  const title = isloh_chatThreadTitle(thread);
  const isActive = thread.id === isloh_activeChatThreadId;
  /* Guruhda holat nuqtasi ko'rsatilmaydi — a'zolar ko'p, bitta rang
     yolg'on bo'lardi (isloh_chatThreadPresence bo'sh qaytaradi). */
  const dotHtml = presence ? `<span class="presence-dot ${presence}"></span>` : '';

  return `<div class="chat-item${isActive ? ' active' : ''}" data-thread-id="${thread.id}" role="option" tabindex="${isActive ? 0 : -1}" aria-selected="${isActive}">
    <div class="presence-wrap"><div class="avatar" style="background:${isloh_chatThreadAvatar(thread)};">${isloh_chatInitials(title)}</div>${dotHtml}</div>
    <div class="chat-item-main">
      <div class="name">${isloh_escapeChatText(title)}</div>
      <div class="last-msg">${isloh_escapeChatText(isloh_chatLastMessagePreview(thread))}</div>
    </div>
    <div class="meta">${isloh_chatRelativeTime(thread.timestamp)}${unread ? `<div class="unread">${unread}</div>` : ''}</div>
  </div>`;
}

function isloh_renderChatList(query) {
  const mount = document.querySelector('[data-chat-list]');
  if (!mount) return;

  const q = (query || '').trim().toLowerCase();
  const filtered = isloh_chatThreads(isloh_chatListFilter).filter((t) => {
    if (!q) return true;
    return `${isloh_chatThreadTitle(t)} ${t.lastMessage || ''}`.toLowerCase().includes(q);
  });

  mount.innerHTML = filtered.map(isloh_chatItemHtml).join('');
  const empty = document.querySelector('[data-chat-list-empty]');
  if (empty) empty.hidden = filtered.length > 0;
}

/* --- Thread ichidagi xabarlar --------------------------------------------- */

/* Guruhda kim yozganini bilish kerak, 1-ga-1 da esa bu ortiqcha takror —
   shuning uchun yuboruvchi ismi faqat guruhda chiqadi. */
function isloh_chatBubbleHtml(msg, thread, meId) {
  const isMe = msg.senderId === meId;
  const sender = isMe ? null : isloh_chatUser(msg.senderId);
  const avatarHtml = isMe ? '' : `<div class="avatar bubble-avatar" style="background:${(sender && sender.avatar) || 'var(--ink-300)'};">${sender ? isloh_chatInitials(sender.name) : ''}</div>`;
  const nameHtml = (!isMe && thread.type === 'group' && sender) ? `<div class="bubble-sender">${isloh_escapeChatText(sender.name)}</div>` : '';

  return `<div class="bubble-row${isMe ? ' me' : ''}">
    ${avatarHtml}
    <div>
      ${nameHtml}
      <div class="bubble">${isloh_escapeChatText(msg.text)}</div>
      <div class="bubble-time${isMe ? ' bubble-time-me' : ''}">${isloh_chatBubbleTime(msg.timestamp)}</div>
    </div>
  </div>`;
}

function isloh_renderThreadMessages(threadId) {
  const body = document.querySelector('[data-thread-body]');
  if (!body) return;
  const thread = isloh_chatThread(threadId);
  if (!thread) return;

  const meId = isloh_chatMeId();

  /* Butun suhbat qayta chizilganda ekran o'quvchi barcha eski xabarlarni
     birdaniga o'qib chiqmasligi kerak — jonli e'lon vaqtincha o'chiriladi
     va chizib bo'lingach qayta yoqiladi. Yangi xabar esa (yuborilganda)
     alohida qo'shiladi va e'lon qilinadi. */
  body.setAttribute('aria-live', 'off');
  body.innerHTML = isloh_chatMessages(threadId).map((m) => isloh_chatBubbleHtml(m, thread, meId)).join('');
  body.scrollTop = body.scrollHeight;
  setTimeout(() => body.setAttribute('aria-live', 'polite'), 0);
}

/* Yuborilgan xabar butun ro'yxatni qayta chizmaydi: bitta puffak
   qo'shiladi. Shu sababli `aria-live` faqat YANGI xabarni e'lon qiladi. */
function isloh_appendChatBubble(msg, thread) {
  const body = document.querySelector('[data-thread-body]');
  if (!body) return;
  body.insertAdjacentHTML('beforeend', isloh_chatBubbleHtml(msg, thread, isloh_chatMeId()));
  body.scrollTop = body.scrollHeight;
}

function isloh_openThread(threadId) {
  const thread = isloh_chatThread(threadId);
  if (!thread) return;

  isloh_activeChatThreadId = threadId;
  isloh_chatMarkRead(threadId);

  const emptyState = document.querySelector('[data-chat-empty-state]');
  const activePane = document.querySelector('[data-chat-active-thread]');
  if (emptyState) emptyState.hidden = true;
  if (activePane) activePane.hidden = false;
  /* Tor ekranda suhbat ro'yxatning o'rnini egallaydi (css/widgets.css) */
  document.querySelector('.chat-shell')?.classList.add('is-thread-open');

  const avatarEl = document.querySelector('[data-thread-avatar]');
  const title = isloh_chatThreadTitle(thread);
  if (avatarEl) { avatarEl.style.background = isloh_chatThreadAvatar(thread); avatarEl.textContent = isloh_chatInitials(title); }

  const presenceEl = document.querySelector('[data-thread-presence]');
  if (presenceEl) {
    const presence = isloh_chatThreadPresence(thread);
    presenceEl.className = presence ? `presence-dot ${presence}` : 'presence-dot';
    presenceEl.hidden = !presence;
  }

  const nameEl = document.querySelector('[data-thread-name]');
  if (nameEl) nameEl.textContent = title;
  const statusEl = document.querySelector('[data-thread-status]');
  if (statusEl) statusEl.textContent = isloh_chatThreadSubtitle(thread);

  /* Qadalgan e'lon faqat u bor threadda ko'rinadi (instruktor guruhlari) */
  const pinEl = document.querySelector('[data-thread-pin]');
  if (pinEl) {
    pinEl.hidden = !thread.pinnedNote;
    if (thread.pinnedNote) pinEl.querySelector('[data-thread-pin-text]').textContent = thread.pinnedNote;
  }

  isloh_syncChatThreadMenu(thread);
  isloh_renderThreadMessages(threadId);
  isloh_renderChatList(document.getElementById('chat-search-input')?.value);

  /* Rolga xos qatlamlar (js/instructor-messages.js) shu hodisadan ushlab
     o'z boshqaruvlarini yangilaydi — chat.js ular haqida bilmaydi. */
  document.dispatchEvent(new CustomEvent('isloh:chat-thread-opened', { detail: { threadId: threadId } }));
}

/* --- Suhbat menyusi: arxivlash va ovoz -----------------------------------
   Umumiy qatlamda, chunki bu ikki amal instruktorda ham, admin support
   qutisida ham bir xil ma'noga ega. Rolga xos amallar (e'lon joylash)
   esa alohida modulda — js/instructor-messages.js.

   Bitta tugma ikki holatni boshqaradi: nomi holatga qarab almashadi.
   Ikkita alohida tugma ko'rsatish biri doim ma'nosiz turishini bildirardi. */
function isloh_syncChatThreadMenu(thread) {
  const archiveLabel = document.querySelector('[data-thread-archive-label]');
  if (archiveLabel) {
    archiveLabel.textContent = thread.archived
      ? isloh_chatText('chat.unarchive', 'Arxivdan qaytarish')
      : isloh_chatText('chat.archive', 'Arxivlash');
  }

  const muteLabel = document.querySelector('[data-thread-mute-label]');
  if (muteLabel) {
    muteLabel.textContent = thread.muted
      ? isloh_chatText('chat.unmute', 'Ovozni yoqish')
      : isloh_chatText('chat.mute', "Ovozni o'chirish");
  }
}

function isloh_activeChatThread() {
  return isloh_activeChatThreadId ? isloh_chatThread(isloh_activeChatThreadId) : null;
}

function isloh_toggleChatArchive() {
  const thread = isloh_activeChatThread();
  if (!thread) return;

  const next = !thread.archived;
  isloh_chatSetArchived(thread.id, next);
  if (next) isloh_chatToast('chat.toast.archived', 'Suhbat arxivlandi');
  else isloh_chatToast('chat.toast.unarchived', 'Suhbat arxivdan qaytarildi');

  /* Arxivlangan suhbat joriy ro'yxatdan chiqib ketadi — ro'yxat qayta
     chiziladi, panel esa keyingi suhbatga o'tadi yoki bo'shaydi. */
  isloh_refreshChatView();
}

function isloh_toggleChatMute() {
  const thread = isloh_activeChatThread();
  if (!thread) return;

  const next = !thread.muted;
  isloh_chatSetMuted(thread.id, next);
  isloh_syncChatThreadMenu(isloh_chatThread(thread.id));
  if (next) isloh_chatToast('chat.toast.muted', "Bildirishnomalar o'chirildi");
  else isloh_chatToast('chat.toast.unmuted', 'Bildirishnomalar yoqildi');
}

/* Ochiq thread ro'yxatdan chiqib ketsa (masalan boshqa tab tanlansa),
   o'ng panel bo'sh holatga qaytadi — aks holda ko'rinmayotgan suhbat
   ochiqligicha qolardi. */
function isloh_closeThread() {
  isloh_activeChatThreadId = null;
  const emptyState = document.querySelector('[data-chat-empty-state]');
  const activePane = document.querySelector('[data-chat-active-thread]');
  if (emptyState) emptyState.hidden = false;
  if (activePane) activePane.hidden = true;
  document.querySelector('.chat-shell')?.classList.remove('is-thread-open');
}

/* Tor ekrandagi "orqaga" tugmasi: suhbatdan ro'yxatga qaytaradi. Ochiq
   thread esda qoladi — kengroq ekranda u yana ko'rinaveradi. */
function isloh_backToChatList() {
  document.querySelector('.chat-shell')?.classList.remove('is-thread-open');
  const active = document.querySelector(`[data-thread-id="${isloh_activeChatThreadId}"]`);
  if (active) active.focus();
}

/* --- Ro'yxat tab'lari -----------------------------------------------------
   Tab nomi → do'kon filtri. Chizish mantiqi o'zgarmaydi: tab faqat
   `isloh_chatListFilter` ni almashtiradi.

   Markup tab'siz sahifada (talaba chati) bu qism umuman ishga tushmaydi. */

const ISLOH_CHAT_TAB_FILTERS = {
  all: {},                      // arxivdan tashqari barcha suhbatlar
  groups: { type: 'group' },    // faqat kurs guruhlari
  archive: { archived: true }
};

const ISLOH_CHAT_DEFAULT_TAB = 'all';

function isloh_syncChatTabUI(name) {
  document.querySelectorAll('[data-chat-tab]').forEach((tab) => {
    const isActive = tab.dataset.chatTab === name;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    /* Faqat aktiv tab Tab tugmasi bilan fokusga tushadi, qolganlariga
       strelkalar orqali o'tiladi — `role="tablist"` odatiy tartibi. */
    tab.tabIndex = isActive ? 0 : -1;
  });
}

function isloh_setChatTab(name) {
  const filter = ISLOH_CHAT_TAB_FILTERS[name];
  if (!filter) return;

  isloh_chatListFilter = filter;
  isloh_syncChatTabUI(name);

  /* Tab almashganda qidiruv matni qolib ketmasin: aks holda yangi
     ro'yxat sababsiz bo'sh ko'rinardi. */
  const search = document.getElementById('chat-search-input');
  if (search) search.value = '';

  isloh_refreshChatView();
}

function isloh_initChatTabs() {
  const tabs = [...document.querySelectorAll('[data-chat-tab]')];
  if (!tabs.length) return;

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => isloh_setChatTab(tab.dataset.chatTab));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      isloh_setChatTab(next.dataset.chatTab);
    });
  });

  isloh_syncChatTabUI(ISLOH_CHAT_DEFAULT_TAB);
}

/* Ro'yxatni qayta chizadi va birinchi suhbatni ochadi. */
function isloh_refreshChatView() {
  const query = document.getElementById('chat-search-input')?.value || '';
  isloh_renderChatList(query);
  const visible = isloh_chatThreads(isloh_chatListFilter);
  if (!visible.length) { isloh_closeThread(); return; }
  if (visible.some((t) => t.id === isloh_activeChatThreadId)) return;

  /* Tor ekranda avtomatik ochilmaydi: foydalanuvchi avval ro'yxatni
     ko'rishi kerak, aks holda sahifa doim birinchi suhbat bilan ochilib,
     ro'yxatga faqat "orqaga" orqali borilardi. */
  if (isloh_isChatNarrow()) { isloh_closeThread(); return; }
  isloh_openThread(visible[0].id);
}

/* --- Yuborish ------------------------------------------------------------- */

function isloh_sendChatMessage() {
  const input = document.getElementById('chat-message-input');
  const text = (input?.value || '').trim();
  if (!text || !isloh_activeChatThreadId) return;

  const threadId = isloh_activeChatThreadId;
  const msg = isloh_chatSend(threadId, text);
  if (!msg) {
    isloh_chatToast('chat.toast.quota', "Xabarni saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    return;
  }

  input.value = '';
  isloh_appendChatBubble(msg, isloh_chatThread(threadId));
  isloh_renderChatList(document.getElementById('chat-search-input')?.value);
}

function isloh_startChatByEmail(email) {
  const normalized = (email || '').trim();
  if (!normalized) return;

  const user = isloh_chatUserByEmail(normalized);
  if (!user) {
    isloh_chatToast('chat.toast.notFound', 'Bunday email bilan foydalanuvchi topilmadi', 'error');
    return;
  }
  if (user.id === isloh_chatMeId()) {
    isloh_chatToast('chat.toast.self', "O'zingiz bilan suhbat boshlab bo'lmaydi", 'error');
    return;
  }

  const thread = isloh_chatOpenDirect(user.id);
  if (!thread) {
    isloh_chatToast('chat.toast.createFail', "Suhbatni yaratib bo'lmadi", 'error');
    return;
  }

  if (typeof isloh_closeModal === 'function') isloh_closeModal('new-chat-modal');
  const emailInput = document.getElementById('new-chat-email');
  if (emailInput) emailInput.value = '';

  /* Yangi suhbat arxivda emas, oddiy ro'yxatda — filtr tiklanadi, aks
     holda arxiv tab'i ochiq turganda yaratilgan thread ko'rinmay qolardi. */
  isloh_chatListFilter = ISLOH_CHAT_TAB_FILTERS[ISLOH_CHAT_DEFAULT_TAB];
  isloh_syncChatTabUI(ISLOH_CHAT_DEFAULT_TAB);
  isloh_renderChatList('');
  isloh_openThread(thread.id);
  isloh_chatToast('chat.toast.started', '{name} bilan chat boshlandi', 'success', { name: user.name });
}

/* --- Ishga tushirish ------------------------------------------------------ */

function isloh_initChat() {
  const mount = document.querySelector('[data-chat-list]');
  if (!mount) return;

  mount.setAttribute('role', 'listbox');
  mount.setAttribute('aria-label', isloh_chatText('chat.title', 'Xabarlar'));

  mount.addEventListener('click', (e) => {
    const item = e.target.closest('[data-thread-id]');
    if (item) isloh_openThread(item.dataset.threadId);
  });

  /* Klaviatura: Enter/Bo'shliq — ochish, strelkalar — bandlar orasida
     yurish, Home/End — chekkalarga. Ilgari ro'yxat faqat sichqoncha bilan
     ishlardi. */
  mount.addEventListener('keydown', (e) => {
    const item = e.target.closest('[data-thread-id]');
    if (!item) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      isloh_openThread(item.dataset.threadId);
      return;
    }

    const items = [...mount.querySelectorAll('[data-thread-id]')];
    const at = items.indexOf(item);
    let next = -1;
    if (e.key === 'ArrowDown') next = at + 1;
    else if (e.key === 'ArrowUp') next = at - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0 || next >= items.length) return;

    e.preventDefault();
    items[next].focus();
  });

  const search = document.getElementById('chat-search-input');
  if (search) search.addEventListener('input', () => isloh_renderChatList(search.value));

  document.querySelector('[data-chat-back]')?.addEventListener('click', isloh_backToChatList);

  const sendBtn = document.querySelector('[data-chat-send]');
  if (sendBtn) sendBtn.addEventListener('click', isloh_sendChatMessage);
  const msgInput = document.getElementById('chat-message-input');
  if (msgInput) msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') isloh_sendChatMessage(); });

  document.querySelector('[data-thread-archive]')?.addEventListener('click', isloh_toggleChatArchive);
  document.querySelector('[data-thread-mute]')?.addEventListener('click', isloh_toggleChatMute);

  /* "Fayl biriktirish" endi soxta "muvaffaqiyat" toast'i ko'rsatmaydi:
     fayl yuklash server talab qiladi, shuning uchun tugma o'chirilgan
     holatda turadi va sababini o'zi aytadi (js/backend-pending.js). */

  document.querySelectorAll('[data-new-chat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_openModal === 'function') isloh_openModal('new-chat-modal');
      document.getElementById('new-chat-email')?.focus();
    });
  });
  /* "Bekor qilish" / "×" tugmalari alohida ulanmaydi — ular [data-modal-close]
     atributiga ega va uni js/modal.js o'zi ushlaydi. */
  const submitBtn = document.querySelector('[data-new-chat-submit]');
  if (submitBtn) submitBtn.addEventListener('click', () => isloh_startChatByEmail(document.getElementById('new-chat-email').value));
  const emailInput = document.getElementById('new-chat-email');
  if (emailInput) emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') isloh_startChatByEmail(emailInput.value); });

  isloh_initChatTabs();
  isloh_refreshChatView();

  /* Til almashganda ro'yxat va suhbat qayta chiziladi: ular ichidagi
     matnlar (nisbiy vaqt, "Siz:", a'zolar soni) JS bilan yasaladi, ya'ni
     `data-i18n` ularga yetib bormaydi. */
  document.addEventListener('isloh:i18n-applied', () => {
    isloh_renderChatList(document.getElementById('chat-search-input')?.value);
    const thread = isloh_activeChatThread();
    if (thread) isloh_openThread(thread.id);
  });

  /* Ekran kengaygan-torayganda ham holat to'g'ri qolsin: tor rejimdan
     chiqilganda ro'yxat va suhbat yana yonma-yon ko'rinadi. */
  if (window.matchMedia) {
    const mq = window.matchMedia(ISLOH_CHAT_NARROW_MQ);
    const onChange = (e) => { if (!e.matches) isloh_refreshChatView(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);   // eski Safari
  }
}

document.addEventListener('DOMContentLoaded', isloh_initChat);
