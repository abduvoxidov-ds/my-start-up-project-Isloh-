/* ==========================================================================
   ISLOH — Real vaqt ulanishi (WebSocket)   [M8]

   Ikkita kanal:
     /ws/chat           → yangi xabar, onlayn holat, e'lon o'zgarishi
     /ws/notifications  → M7 bildirishnomalari

   NEGA ALOHIDA FAYL: do'konlar (js/chat-store.js, js/notification-store.js)
   MA'LUMOTNI biladi, ulanish esa butunlay boshqa mas'uliyat — qayta
   ulanish, token, sahifa fonga o'tishi. Ular aralashsa har bir do'kon
   o'z soketini ochib, bir xil qayta ulanish mantig'ini takrorlardi
   (CLAUDE.md §2).

   --- TOKEN SARLAVHADA, MANZILDA EMAS -------------------------------------

   `new WebSocket(url)` `Authorization` sarlavhasini qo'yishga imkon
   bermaydi. Yechim — SUB-PROTOKOL:

       new WebSocket(url, ['isloh-jwt', token])

   Brauzer buni `Sec-WebSocket-Protocol` sarlavhasida yuboradi, ya'ni
   token manzil qatorida, server jurnalida va brauzer tarixida
   QOLMAYDI. Server tomoni: backend/apps/messaging/auth.py.

   --- ULANMASA NIMA BO'LADI ------------------------------------------------

   Hech narsa buzilmaydi. WebSocket — TEZLIK, ishonchlilik emas: xabar
   baribir bazaga yozilgan va sahifa yangilanganda ko'rinadi. Shuning
   uchun bu yerda hech qanday xato banneri yo'q — u faqat shovqin
   bo'lardi.

   `file://` ostida umuman ulanmaydi (CLAUDE.md §3).
   ========================================================================== */

const ISLOH_WS_SUBPROTOCOL = 'isloh-jwt';

/* Qayta ulanish oralig'i: 1s dan boshlab ikkilanadi, 30s da to'xtaydi.
   Doimiy 1 soniya bo'lsa server o'chganda brauzer uni soniyada bir marta
   urib turardi. */
const ISLOH_WS_RETRY_MIN = 1000;
const ISLOH_WS_RETRY_MAX = 30000;

/* Jim turgan ulanishni ba'zi proksilar uzadi — vaqti-vaqti bilan `ping`. */
const ISLOH_WS_PING_MS = 45000;

/* Ochiq ulanishlar: { path: { socket, retry, timer, ping } } */
const ISLOH_WS_LINKS = {};

function isloh_wsUrl(path) {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${path}`;
}

function isloh_wsCanConnect() {
  if (location.protocol === 'file:') return false;
  if (typeof islohApi === 'undefined') return false;
  return !!islohApi.getToken();
}

function isloh_wsClose(path) {
  const link = ISLOH_WS_LINKS[path];
  if (!link) return;
  clearTimeout(link.timer);
  clearInterval(link.ping);
  if (link.socket) {
    /* `onclose` qayta ulanishni boshlab yubormasin */
    link.socket.onclose = null;
    link.socket.close();
  }
  delete ISLOH_WS_LINKS[path];
}

/* Bitta kanalni ochadi va uzilganda o'zi qayta ulanadi. */
function isloh_wsConnect(path, onMessage) {
  if (!isloh_wsCanConnect()) return null;
  if (ISLOH_WS_LINKS[path]) return ISLOH_WS_LINKS[path].socket;

  const link = { socket: null, retry: ISLOH_WS_RETRY_MIN, timer: 0, ping: 0 };
  ISLOH_WS_LINKS[path] = link;

  let socket;
  try {
    socket = new WebSocket(isloh_wsUrl(path), [ISLOH_WS_SUBPROTOCOL, islohApi.getToken()]);
  } catch (e) {
    delete ISLOH_WS_LINKS[path];
    return null;
  }
  link.socket = socket;

  socket.onopen = () => {
    link.retry = ISLOH_WS_RETRY_MIN;
    link.ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'ping' }));
    }, ISLOH_WS_PING_MS);
  };

  socket.onmessage = (e) => {
    let payload;
    try { payload = JSON.parse(e.data); } catch (err) { return; }
    if (payload && payload.event === 'pong') return;
    onMessage(payload);
  };

  socket.onclose = (e) => {
    clearInterval(link.ping);
    delete ISLOH_WS_LINKS[path];

    /* 4401 — token yaroqsiz (apps/messaging/consumers.py). Qayta urinish
       ma'nosiz: yangi token kelmaguncha natija bir xil bo'ladi. Sessiya
       tugagan bo'lsa buni REST so'rovi aniqlaydi va login'ga otadi
       (js/api.js), ya'ni bu yerda hech narsa qilmaymiz. */
    if (e && e.code === 4401) return;

    link.timer = setTimeout(() => {
      link.retry = Math.min(link.retry * 2, ISLOH_WS_RETRY_MAX);
      const next = isloh_wsConnect(path, onMessage);
      if (next && ISLOH_WS_LINKS[path]) ISLOH_WS_LINKS[path].retry = link.retry;
    }, link.retry);
  };

  return socket;
}

/* --- Kanallar ------------------------------------------------------------- */

/* Chat kanali FAQAT chat sahifasida ochiladi: xabarlar ro'yxati boshqa
   sahifada ko'rinmaydi va ochiq soket u yerda bekorga turardi. Yon
   menyudagi nishon esa yengil `/chat/unread-count` bilan ishlaydi
   (js/chat-store.js). */
function isloh_wsChatNeeded() {
  return !!document.querySelector('[data-chat-list]');
}

/* Bildirishnoma kanali yon menyusi BOR har bir sahifada: qizil nuqta
   hamma joyda turadi va u jonli yangilanishi kerak. */
function isloh_wsNotificationsNeeded() {
  return !!document.querySelector('.topbar-actions .icon-btn .dot');
}

function isloh_wsStart() {
  if (!isloh_wsCanConnect()) return;

  if (isloh_wsChatNeeded() && typeof isloh_chatApplyIncoming === 'function') {
    isloh_wsConnect('/ws/chat', isloh_chatApplyIncoming);
  }
  if (isloh_wsNotificationsNeeded() && typeof isloh_notifApplyIncoming === 'function') {
    isloh_wsConnect('/ws/notifications', isloh_notifApplyIncoming);
  }
}

function isloh_wsStop() {
  Object.keys(ISLOH_WS_LINKS).forEach(isloh_wsClose);
}

/* Sahifa yopilayotganda ulanish TOZA uziladi — server onlayn holatni
   darhol yangilaydi (aks holda u `ISLOH_PRESENCE_TTL` tugaguncha
   "onlayn" bo'lib turardi). */
window.addEventListener('pagehide', isloh_wsStop);

document.addEventListener('DOMContentLoaded', isloh_wsStart);
