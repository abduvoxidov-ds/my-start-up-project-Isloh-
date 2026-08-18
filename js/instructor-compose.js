/* ==========================================================================
   ISLOH — Sessiya rejalashtirish oynasi
     (pages/instructor/live-sessions.html)

   Ilgari bu faylda ikkita oyna bor edi — e'lon va sessiya — chunki
   ikkalasi bir xil naqshda ishlardi: modaldagi formani o'qish,
   localStorage'ga yozish, ro'yxat boshiga kartochka qo'yish. Ikkala
   "yuborish" tugmasi ham dastlab faqat `isloh_closeModal(...)` chaqirardi:
   forma to'ldirilardi-yu, hech qayerga bormasdi.

   E'lon qismi M6 da olib tashlandi (pastdagi izohga qarang) — u endi
   haqiqiy muhokama mavzusi.

   Do'konlar:
     isloh_live_sessions    — [{ id, title, startsAt, duration, agenda }]

   Markup shartnomasi (har bir sahifada faqat o'ziniki bo'ladi):
     [data-session-submit]  + #ls-title-input / #ls-date-input /
                              #ls-duration-input / #ls-agenda-input
       [data-session-list]  → sessiya qo'shiladigan ro'yxat
   ========================================================================== */

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

/* --- 1) E'lonlar — M6 DA OLIB TASHLANDI ------------------------------------
   E'lon shu yerda `isloh_announcements` kalitiga yozilardi va kartochka
   DOM'ga qo'shilardi. Ikki muammo bor edi: (1) e'lon faqat SHU brauzerda
   ko'rinardi, ya'ni talabalar uni umuman ko'rmasdi; (2) sarlavha va matn
   `innerHTML` ga ekranlanmasdan tushardi.

   Endi e'lon — oddiy muhokama mavzusi (js/discussion-store.js). Oyna
   `data-new-thread-form` ga aylandi va uni js/discussion.js boshqaradi;
   o'qituvchi mavzuni "Qadash" tugmasi bilan tepaga chiqaradi. */

/* --- 2) Jonli sessiyalar -------------------------------------------------- */

/* Vaqt ko'rsatiladi, demak mintaqa muhim — formatlash js/datetime.js da */
function isloh_formatSessionDate(iso) {
  return isloh_dtDayTime(iso) || 'Sana belgilanmagan';
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
  isloh_initSessionForm();
});
