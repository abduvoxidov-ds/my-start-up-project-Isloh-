/* ==========================================================================
   ISLOH — Provider tomonidagi ikkita "yaratish" oynasi
     1) E'lon joylash        (pages/instructor/discussions.html)
     2) Sessiya rejalashtirish (pages/instructor/live-sessions.html)

   NEGA BIR FAYLDA: ikkalasi ham bir xil naqsh — modaldagi formani o'qish,
   localStorage'ga yozish, ro'yxat boshiga kartochka qo'yish. Ilgari ikkala
   "yuborish" tugmasi ham faqat `isloh_closeModal(...)` chaqirardi: forma
   to'ldirilardi-yu, hech qayerga bormasdi.

   Do'konlar:
     isloh_announcements    — [{ id, title, body, createdAt }]
     isloh_live_sessions    — [{ id, title, startsAt, duration, agenda }]

   Markup shartnomasi (har bir sahifada faqat o'ziniki bo'ladi):
     [data-announce-submit] + #announce-title / #announce-body
       [data-thread-list]   → e'lon qo'shiladigan ro'yxat
     [data-session-submit]  + #ls-title-input / #ls-date-input /
                              #ls-duration-input / #ls-agenda-input
       [data-session-list]  → sessiya qo'shiladigan ro'yxat
   ========================================================================== */

const ISLOH_ANNOUNCEMENTS_KEY = 'isloh_announcements';
const ISLOH_SESSIONS_KEY = 'isloh_live_sessions';

function isloh_readList(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return Array.isArray(stored) ? stored : [];
  } catch (e) {
    return [];
  }
}

function isloh_writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_composeToast(message, type) {
  if (typeof isloh_showToast === 'function') isloh_showToast(message, type || 'success');
}

function isloh_composeValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* --- 1) E'lonlar ---------------------------------------------------------- */

/* E'lon oddiy mavzu kabi ko'rinadi, lekin "qadalgan" holatda — muhokamalar
   ro'yxatidagi mavjud .dt-pinned naqshi qayta ishlatiladi. */
function isloh_announcementHtml(item) {
  return `<div class="card discussion-thread dt-pinned" data-thread data-filter-item data-mtype="pinned" data-filter-text="${item.title}">
    <div class="dt-head">
      <div class="avatar-sm avatar-teach">AY</div>
      <div class="dt-head-main">
        <div class="dt-title-row">
          <div class="dt-title">${item.title}</div>
          <span class="role-badge teacher">O'qituvchi</span>
        </div>
        <div class="dt-meta-row"><span>Akmal Yuldashev</span><span>&middot;</span><span>Hozir</span><span>&middot;</span><span>E'lon</span></div>
        <div class="dt-excerpt">${item.body}</div>
      </div>
    </div>
  </div>`;
}

function isloh_renderAnnouncements() {
  const list = document.querySelector('[data-thread-list]');
  if (!list) return;
  // Eng yangi e'lon tepada tursin
  isloh_readList(ISLOH_ANNOUNCEMENTS_KEY).forEach((item) => {
    list.insertAdjacentHTML('afterbegin', isloh_announcementHtml(item));
  });
}

function isloh_initAnnounceForm() {
  const submit = document.querySelector('[data-announce-submit]');
  if (!submit) return;

  isloh_renderAnnouncements();

  submit.addEventListener('click', () => {
    const title = isloh_composeValue('announce-title');
    const body = isloh_composeValue('announce-body');

    if (!title || !body) {
      isloh_composeToast("Sarlavha va matn to'ldirilishi kerak", 'error');
      return;
    }

    const item = { id: 'ann-' + Date.now(), title: title, body: body, createdAt: new Date().toISOString() };
    const list = isloh_readList(ISLOH_ANNOUNCEMENTS_KEY);
    list.push(item);

    if (!isloh_writeList(ISLOH_ANNOUNCEMENTS_KEY, list)) {
      isloh_composeToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    const mount = document.querySelector('[data-thread-list]');
    if (mount) mount.insertAdjacentHTML('afterbegin', isloh_announcementHtml(item));

    document.getElementById('announce-title').value = '';
    document.getElementById('announce-body').value = '';
    if (typeof isloh_closeModal === 'function') isloh_closeModal('announce-modal');
    isloh_composeToast("E'lon joylandi");
  });
}

/* --- 2) Jonli sessiyalar -------------------------------------------------- */

function isloh_formatSessionDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Sana belgilanmagan';
  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${months[d.getMonth()]}, ${hh}:${mm}`;
}

function isloh_sessionHtml(item) {
  const countdown = item.startsAt ? ` data-countdown="${item.startsAt}"` : '';
  return `<div class="card live-session-card" data-filter-item data-status="upcoming" data-filter-text="${item.title}">
    <div style="flex:1;">
      <span class="ls-status upcoming">Rejalashtirilgan</span>
      <div class="ls-title">${item.title}</div>
      <div class="ls-meta"><span><i class="bi bi-calendar-event"></i> ${isloh_formatSessionDate(item.startsAt)}</span><span><i class="bi bi-clock"></i> ${item.duration}</span></div>
    </div>
    <div style="text-align:center;">
      <div class="ls-countdown"${countdown}>--:--:--</div>
    </div>
  </div>`;
}

function isloh_renderSessions() {
  const list = document.querySelector('[data-session-list]');
  if (!list) return;
  isloh_readList(ISLOH_SESSIONS_KEY).forEach((item) => {
    list.insertAdjacentHTML('afterbegin', isloh_sessionHtml(item));
  });
}

function isloh_initSessionForm() {
  const submit = document.querySelector('[data-session-submit]');
  if (!submit) return;

  isloh_renderSessions();

  submit.addEventListener('click', () => {
    const title = isloh_composeValue('ls-title-input');
    const startsAt = isloh_composeValue('ls-date-input');

    if (!title) {
      isloh_composeToast('Sessiya sarlavhasini kiriting', 'error');
      return;
    }
    if (!startsAt) {
      isloh_composeToast('Sana va vaqtni tanlang', 'error');
      return;
    }

    const item = {
      id: 'ls-' + Date.now(),
      title: title,
      startsAt: startsAt,
      duration: isloh_composeValue('ls-duration-input') || '60 daqiqa',
      agenda: isloh_composeValue('ls-agenda-input')
    };

    const list = isloh_readList(ISLOH_SESSIONS_KEY);
    list.push(item);
    if (!isloh_writeList(ISLOH_SESSIONS_KEY, list)) {
      isloh_composeToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
      return;
    }

    const mount = document.querySelector('[data-session-list]');
    if (mount) mount.insertAdjacentHTML('afterbegin', isloh_sessionHtml(item));

    ['ls-title-input', 'ls-date-input', 'ls-agenda-input'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    if (typeof isloh_closeModal === 'function') isloh_closeModal('schedule-session-modal');
    isloh_composeToast('Sessiya rejalashtirildi');

    /* Sanoqni alohida ulash shart emas: js/live-session.js har tikda
       [data-countdown] elementlarini qaytadan qidiradi. */
  });
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_initAnnounceForm();
  isloh_initSessionForm();
});
