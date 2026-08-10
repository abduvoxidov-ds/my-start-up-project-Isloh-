/* ==========================================================================
   ISLOH — Chat module
   Simple 1-on-1 direct messaging for pages/student/chat.html. No groups/
   channels/tabs — every thread is exactly one other platform user, found by
   email via the "Yangi chat" modal. State lives in three localStorage keys:

     isloh_chat_users    — [{ id, name, email, avatar (css background),
                              role, presence ('online'|'offline'|'busy') }]
     isloh_chat_threads  — [{ id, participantId, lastMessage, timestamp,
                              unreadCount }]
     isloh_chat_messages — { [threadId]: [{ id, senderId, text, timestamp }] }
                            senderId is either a user id or 'me'.

   Markup contract:
     [data-chat-list]                    → thread list mount
       [data-chat-list-empty]            → shown when list is empty
     [data-chat-empty-state]             → shown when no thread is open
     [data-chat-active-thread]           → shown once a thread is open
       [data-thread-avatar/-presence/-name/-status]
       [data-thread-body]                → message bubbles mount
     #chat-search-input                  → filters the thread list
     #chat-message-input, [data-chat-send], [data-chat-attach]
     [data-new-chat] → opens #new-chat-modal
       #new-chat-email, [data-new-chat-submit], [data-modal-close]
   ========================================================================== */

const ISLOH_CHAT_USERS_KEY = 'isloh_chat_users';
const ISLOH_CHAT_THREADS_KEY = 'isloh_chat_threads';
const ISLOH_CHAT_MESSAGES_KEY = 'isloh_chat_messages';
const ISLOH_CHAT_ME = 'me';
const ISLOH_CHAT_PRESENCE_LABEL = { online: 'Onlayn', busy: 'Band', offline: 'Oflayn' };

let isloh_activeChatThreadId = null;

function isloh_seedChatUsers() {
  return [
    { id: 'u1', name: 'Akmal Yuldashev', email: 'akmal@isloh.uz', avatar: 'linear-gradient(135deg,#6C5DD3,#4338CA)', role: 'instructor', presence: 'online' },
    { id: 'u2', name: 'Dilnoza Rakhimova', email: 'dilnoza@isloh.uz', avatar: 'linear-gradient(135deg,#0EA5E9,#0369A1)', role: 'instructor', presence: 'online' },
    { id: 'u3', name: 'Aziz Karimov', email: 'aziz@isloh.uz', avatar: 'linear-gradient(135deg,#1FAE5E,#0F7A3D)', role: 'instructor', presence: 'offline' },
    { id: 'u4', name: 'Isloh Support', email: 'support@isloh.uz', avatar: 'var(--ink-300)', role: 'admin', presence: 'busy' },
    { id: 'u5', name: 'Malika Tosheva', email: 'malika@isloh.uz', avatar: 'linear-gradient(135deg,#DB2777,#F472B6)', role: 'student', presence: 'offline' }
  ];
}

function isloh_seedChatThreads() {
  const now = Date.now();
  return [
    { id: 'th1', participantId: 'u1', lastMessage: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", timestamp: now - 24 * 60000, unreadCount: 2 },
    { id: 'th2', participantId: 'u3', lastMessage: 'Rahmat, qabul qildim!', timestamp: now - 26 * 3600000, unreadCount: 0 },
    { id: 'th3', participantId: 'u4', lastMessage: 'Qanday yordam bera olamiz?', timestamp: now - 26 * 3600000, unreadCount: 0 }
  ];
}

function isloh_seedChatMessages() {
  const now = Date.now();
  return {
    th1: [
      { id: 'm1', senderId: 'u1', text: "Salom! Bugungi darslar materiallarini yukladim, ko'rib chiqing 📂", timestamp: now - 30 * 60000 },
      { id: 'm2', senderId: ISLOH_CHAT_ME, text: "Rahmat, hozir tekshirib ko'raman!", timestamp: now - 27 * 60000 },
      { id: 'm3', senderId: 'u1', text: "Tekshirib ko'ringlar, savol bo'lsa shu yerga yozing 👍", timestamp: now - 24 * 60000 }
    ],
    th2: [
      { id: 'm4', senderId: 'u3', text: 'Rahmat, qabul qildim!', timestamp: now - 26 * 3600000 }
    ],
    th3: [
      { id: 'm5', senderId: 'u4', text: 'Qanday yordam bera olamiz?', timestamp: now - 26 * 3600000 }
    ]
  };
}

function isloh_getChatUsers() {
  try {
    const raw = localStorage.getItem(ISLOH_CHAT_USERS_KEY);
    if (raw === null) {
      const seeded = isloh_seedChatUsers();
      localStorage.setItem(ISLOH_CHAT_USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) || [];
  } catch (e) { return []; }
}

function isloh_getChatThreads() {
  try {
    const raw = localStorage.getItem(ISLOH_CHAT_THREADS_KEY);
    if (raw === null) {
      const seeded = isloh_seedChatThreads();
      localStorage.setItem(ISLOH_CHAT_THREADS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) || [];
  } catch (e) { return []; }
}
function isloh_saveChatThreads(threads) {
  localStorage.setItem(ISLOH_CHAT_THREADS_KEY, JSON.stringify(threads));
}

function isloh_getChatMessages() {
  try {
    const raw = localStorage.getItem(ISLOH_CHAT_MESSAGES_KEY);
    if (raw === null) {
      const seeded = isloh_seedChatMessages();
      localStorage.setItem(ISLOH_CHAT_MESSAGES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}
function isloh_saveChatMessages(messages) {
  localStorage.setItem(ISLOH_CHAT_MESSAGES_KEY, JSON.stringify(messages));
}

function isloh_findChatUser(id) {
  return isloh_getChatUsers().find((u) => u.id === id);
}

function isloh_chatInitials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function isloh_escapeChatText(str) {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isloh_chatRelativeTime(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'hozir';
  if (diffMin < 60) return `${diffMin} daq`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} soat`;
  const diffDay = Math.round(diffHour / 24);
  return diffDay === 1 ? 'Kecha' : `${diffDay} kun`;
}

/* Xabar vaqti — tanlangan mintaqada (js/datetime.js) */
function isloh_chatBubbleTime(ts) {
  return isloh_dtTime(ts);
}

function isloh_chatItemHtml(thread) {
  const user = isloh_findChatUser(thread.participantId);
  if (!user) return '';
  return `<div class="chat-item${thread.id === isloh_activeChatThreadId ? ' active' : ''}" data-thread-id="${thread.id}">
    <div class="presence-wrap"><div class="avatar" style="background:${user.avatar};">${isloh_chatInitials(user.name)}</div><span class="presence-dot ${user.presence}"></span></div>
    <div>
      <div class="name">${user.name}</div>
      <div class="last-msg">${isloh_escapeChatText(thread.lastMessage || '')}</div>
    </div>
    <div class="meta">${isloh_chatRelativeTime(thread.timestamp)}${thread.unreadCount ? `<div class="unread">${thread.unreadCount}</div>` : ''}</div>
  </div>`;
}

function isloh_renderChatList(query) {
  const mount = document.querySelector('[data-chat-list]');
  if (!mount) return;

  const q = (query || '').trim().toLowerCase();
  const threads = [...isloh_getChatThreads()].sort((a, b) => b.timestamp - a.timestamp);
  const filtered = threads.filter((t) => {
    if (!q) return true;
    const user = isloh_findChatUser(t.participantId);
    return `${user?.name || ''} ${t.lastMessage || ''}`.toLowerCase().includes(q);
  });

  mount.innerHTML = filtered.map(isloh_chatItemHtml).join('');
  const empty = document.querySelector('[data-chat-list-empty]');
  if (empty) empty.style.display = filtered.length ? 'none' : '';
}

function isloh_renderThreadMessages(threadId) {
  const body = document.querySelector('[data-thread-body]');
  if (!body) return;
  const messages = isloh_getChatMessages()[threadId] || [];

  body.innerHTML = messages.map((m) => {
    const isMe = m.senderId === ISLOH_CHAT_ME;
    const sender = isMe ? null : isloh_findChatUser(m.senderId);
    const avatarHtml = isMe ? '' : `<div class="avatar" style="width:32px; height:32px; font-size:12px; background:${sender?.avatar || 'var(--ink-300)'};">${sender ? isloh_chatInitials(sender.name) : ''}</div>`;
    return `<div class="bubble-row${isMe ? ' me' : ''}">
      ${avatarHtml}
      <div>
        <div class="bubble">${isloh_escapeChatText(m.text)}</div>
        <div class="bubble-time"${isMe ? ' style="text-align:right;"' : ''}>${isloh_chatBubbleTime(m.timestamp)}</div>
      </div>
    </div>`;
  }).join('');

  body.scrollTop = body.scrollHeight;
}

function isloh_openThread(threadId) {
  const threads = isloh_getChatThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return;
  const user = isloh_findChatUser(thread.participantId);
  if (!user) return;

  isloh_activeChatThreadId = threadId;

  if (thread.unreadCount) {
    thread.unreadCount = 0;
    isloh_saveChatThreads(threads);
  }

  const emptyState = document.querySelector('[data-chat-empty-state]');
  const activePane = document.querySelector('[data-chat-active-thread]');
  if (emptyState) emptyState.style.display = 'none';
  if (activePane) activePane.style.display = 'flex';

  const avatarEl = document.querySelector('[data-thread-avatar]');
  if (avatarEl) { avatarEl.style.background = user.avatar; avatarEl.textContent = isloh_chatInitials(user.name); }
  const presenceEl = document.querySelector('[data-thread-presence]');
  if (presenceEl) presenceEl.className = `presence-dot ${user.presence}`;
  const nameEl = document.querySelector('[data-thread-name]');
  if (nameEl) nameEl.textContent = user.name;
  const statusEl = document.querySelector('[data-thread-status]');
  if (statusEl) statusEl.textContent = ISLOH_CHAT_PRESENCE_LABEL[user.presence] || '';

  isloh_renderThreadMessages(threadId);
  isloh_renderChatList(document.getElementById('chat-search-input')?.value);
}

function isloh_sendChatMessage() {
  const input = document.getElementById('chat-message-input');
  const text = (input?.value || '').trim();
  if (!text || !isloh_activeChatThreadId) return;

  const threadId = isloh_activeChatThreadId;
  const messages = isloh_getChatMessages();
  const msg = { id: 'msg-' + Date.now(), senderId: ISLOH_CHAT_ME, text, timestamp: Date.now() };
  messages[threadId] = messages[threadId] || [];
  messages[threadId].push(msg);
  isloh_saveChatMessages(messages);

  const threads = isloh_getChatThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    thread.lastMessage = text;
    thread.timestamp = msg.timestamp;
    isloh_saveChatThreads(threads);
  }

  input.value = '';
  isloh_renderThreadMessages(threadId);
  isloh_renderChatList(document.getElementById('chat-search-input')?.value);
}

function isloh_startChatByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return;

  const user = isloh_getChatUsers().find((u) => u.email.toLowerCase() === normalized);
  if (!user) {
    if (typeof isloh_showToast === 'function') isloh_showToast('Bunday email bilan foydalanuvchi topilmadi', 'error');
    return;
  }

  const threads = isloh_getChatThreads();
  let thread = threads.find((t) => t.participantId === user.id);
  if (!thread) {
    thread = { id: 'th-' + Date.now(), participantId: user.id, lastMessage: '', timestamp: Date.now(), unreadCount: 0 };
    threads.unshift(thread);
    isloh_saveChatThreads(threads);
  }

  if (typeof isloh_closeModal === 'function') isloh_closeModal('new-chat-modal');
  const emailInput = document.getElementById('new-chat-email');
  if (emailInput) emailInput.value = '';

  isloh_openThread(thread.id);
  if (typeof isloh_showToast === 'function') isloh_showToast(`${user.name} bilan chat boshlandi`, 'success');
}

function isloh_initChat() {
  const mount = document.querySelector('[data-chat-list]');
  if (!mount) return;

  mount.addEventListener('click', (e) => {
    const item = e.target.closest('[data-thread-id]');
    if (item) isloh_openThread(item.dataset.threadId);
  });

  const search = document.getElementById('chat-search-input');
  if (search) search.addEventListener('input', () => isloh_renderChatList(search.value));

  const sendBtn = document.querySelector('[data-chat-send]');
  if (sendBtn) sendBtn.addEventListener('click', isloh_sendChatMessage);
  const msgInput = document.getElementById('chat-message-input');
  if (msgInput) msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') isloh_sendChatMessage(); });

  const attachBtn = document.querySelector('[data-chat-attach]');
  if (attachBtn) attachBtn.addEventListener('click', () => {
    if (typeof isloh_showToast === 'function') isloh_showToast('Fayl biriktirish (namuna)', 'success');
  });

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

  isloh_renderChatList('');
  const threads = [...isloh_getChatThreads()].sort((a, b) => b.timestamp - a.timestamp);
  if (threads.length) isloh_openThread(threads[0].id);
}

document.addEventListener('DOMContentLoaded', isloh_initChat);
