/* ==========================================================================
   ISLOH — Calendar module
   Renders the month grid and the "Bugungi jadval" rail — ikkalasi ham
   js/tasks.js egalik qiladigan bir xil isloh_tasks holatidan
   (isloh_getTasks/isloh_taskStatus/isloh_todayISO orqali), ya'ni kalendar
   va Vazifalar bo'limi bitta manbadan chiziladi.
   isloh_renderCalendarAll() global — js/tasks.js har qo'shish/tahrirlash/
   o'chirish/belgilashdan keyin uni chaqirib kalendarni sinxron ushlaydi.

   Mini-kalendar, "Yaqinlashayotgan" va "Turkumlar" vidjetlari olib
   tashlangan: uchalasi ham sahifadagi boshqa bloklar (asosiy kalendar,
   "Kelgusi" guruhi, kartochkadagi turkum yorlig'i) bilan bir xil
   ma'lumotni takrorlardi.

   Expected markup on the page:
     data-cal-month-label, #cal-grid, #cal-weekdays  (full calendar)
     [data-today-timeline]                            (today's schedule, optional)
     .view-switch button[data-view]                   (Month/Week/Day switch, optional)
     [data-cal-prev] / [data-cal-next] / [data-cal-today]
   ========================================================================== */

const ISLOH_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const ISLOH_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

let isloh_calViewDate = new Date();

function isloh_isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isloh_startOffset(firstDayIdx) {
  // JS: 0=Sun..6=Sat. We want Monday-first, so Monday=0..Sunday=6.
  return (firstDayIdx + 6) % 7;
}

// --- Build a { 'YYYY-MM-DD': [{title, type}] } map straight from isloh_tasks ---
function isloh_buildCalEventsFromTasks() {
  const events = {};
  if (typeof isloh_getTasks !== 'function') return events;
  isloh_getTasks().forEach((t) => {
    if (!t.dueDate) return;
    const title = (t.dueTime ? t.dueTime + ' ' : '') + t.title;
    (events[t.dueDate] = events[t.dueDate] || []).push({ title, type: t.type || 'personal', taskId: t.id });
  });
  return events;
}

function isloh_renderMonth(viewDate) {
  const grid = document.getElementById('cal-grid');
  const label = document.querySelector('[data-cal-month-label]');
  const wd = document.getElementById('cal-weekdays');
  if (!grid) return;

  const events = isloh_buildCalEventsFromTasks();
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  if (label) label.textContent = `${ISLOH_MONTHS[m]} ${y}`;

  if (wd && !wd.dataset.filled) {
    wd.innerHTML = ISLOH_WEEKDAYS.map((d) => `<div class="cal-weekday">${d}</div>`).join('');
    wd.dataset.filled = '1';
  }

  const today = new Date();
  const firstIdx = isloh_startOffset(new Date(y, m, 1).getDay());
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();

  grid.textContent = '';

  const addMutedDay = (num) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day muted';
    cell.innerHTML = `<div class="cal-daynum">${num}</div>`;
    grid.appendChild(cell);
  };

  /* Kun raqami — tugma: bosilsa o'sha sana bilan vazifa qo'shish oynasi
     ochiladi. Ilgari katakcha ham, tadbir ham, "+N ko'proq" ham hech
     narsa qilmasdi — kalendar faqat ko'rinish edi. */
  const dayNumBtn = (dateISO, num) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-daynum';
    btn.dataset.calAddDate = dateISO;
    btn.textContent = num;
    btn.setAttribute('aria-label', `${num}-kunga vazifa qo'shish`);
    return btn;
  };

  // leading days from previous month
  for (let i = firstIdx; i > 0; i--) addMutedDay(daysInPrev - i + 1);

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const key = isloh_isoDate(y, m, d);
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const dayEvents = events[key] || [];

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isToday ? ' today' : '');
    cell.dataset.calDate = key;
    cell.appendChild(dayNumBtn(key, d));

    /* Tadbir nomi vazifa sarlavhasidan keladi — textContent va `.title`
       xossasi orqali qo'yiladi, innerHTML orqali emas (js/tasks.js dagi
       bir xil xavf: nom ichidagi HTML element sifatida chizilardi).
       Endi har biri tugma: bosilsa ro'yxatdagi vazifasiga olib boradi. */
    dayEvents.forEach((e, i) => {
      const ev = document.createElement('button');
      ev.type = 'button';
      ev.className = 'cal-event ev-' + e.type + (i >= 2 ? ' is-extra' : '');
      ev.dataset.calTaskId = e.taskId;
      ev.title = e.title;
      ev.textContent = e.title;
      cell.appendChild(ev);
    });

    // "+N ko'proq" — yashirilgan tadbirlarni shu katakchada ochadi
    if (dayEvents.length > 2) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'cal-more';
      more.dataset.calMore = '';
      more.textContent = `+${dayEvents.length - 2} ko'proq`;
      more.setAttribute('aria-expanded', 'false');
      cell.appendChild(more);
    }
    grid.appendChild(cell);
  }

  // trailing days to fill the last row
  const total = firstIdx + daysInMonth;
  const trailing = (7 - (total % 7)) % 7;
  for (let d = 1; d <= trailing; d++) addMutedDay(d);
}

// --- Right rail: "Bugungi jadval" — today's tasks, sorted by time ---
function isloh_renderTodayTimeline() {
  const wrap = document.querySelector('[data-today-timeline]');
  if (!wrap) return;
  if (typeof isloh_getTasks !== 'function') { wrap.innerHTML = ''; return; }

  const today = isloh_todayISO();
  const items = isloh_getTasks()
    .filter((t) => t.dueDate === today)
    .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));

  if (!items.length) {
    wrap.innerHTML = `<div class="rail-empty">Bugun uchun rejalashtirilgan tadbir yo'q.</div>`;
    return;
  }
  wrap.textContent = '';
  items.forEach((t) => {
    const cls = t.isCompleted ? 'tl-green' : (t.priority === 'high' ? 'tl-warning' : '');
    const item = document.createElement('div');
    item.className = 'timeline-item ' + cls;
    item.innerHTML = `<div class="timeline-time"></div><div class="timeline-title"></div>`;
    item.querySelector('.timeline-time').textContent = t.dueTime || 'Kun davomida';
    item.querySelector('.timeline-title').textContent = t.title;
    wrap.appendChild(item);
  });
}

function isloh_renderCalendarAll() {
  isloh_renderMonth(isloh_calViewDate);
  isloh_renderTodayTimeline();
}

/* Kalendar interaktivligi. Delegatsiya ishlatiladi, chunki katakchalar har
   oy almashganda qaytadan chiziladi. Vazifa oynasini js/tasks.js ochadi —
   kalendar modul vazifa mantiqini takrorlamaydi. */
function isloh_initCalendarInteractions() {
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-cal-add-date]');
    if (addBtn) {
      if (typeof isloh_openTaskForm === 'function') isloh_openTaskForm('add', { dueDate: addBtn.dataset.calAddDate });
      return;
    }

    const evBtn = e.target.closest('[data-cal-task-id]');
    if (evBtn) {
      if (typeof isloh_focusTaskInList === 'function') isloh_focusTaskInList(evBtn.dataset.calTaskId);
      return;
    }

    const moreBtn = e.target.closest('[data-cal-more]');
    if (moreBtn) {
      const cell = moreBtn.closest('.cal-day');
      const open = cell.classList.toggle('expanded');
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.textContent = open
        ? 'Kamroq'
        : `+${cell.querySelectorAll('.cal-event.is-extra').length} ko'proq`;
    }
  });

  /* Katakchaning bo'sh joyini bosish ham qo'shish oynasini ochadi —
     kun raqami tugmasi bilan bir xil amal (klaviatura uchun o'sha tugma). */
  const grid = document.getElementById('cal-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const cell = e.target.closest('.cal-day[data-cal-date]');
      if (cell && typeof isloh_openTaskForm === 'function') {
        isloh_openTaskForm('add', { dueDate: cell.dataset.calDate });
      }
    });
  }
}

function isloh_initCalendar() {
  const hasFull = document.getElementById('cal-grid');
  const hasTimeline = document.querySelector('[data-today-timeline]');
  if (!hasFull && !hasTimeline) return;

  isloh_renderCalendarAll();
  isloh_initCalendarInteractions();

  document.querySelectorAll('[data-cal-prev]').forEach((b) =>
    b.addEventListener('click', () => { isloh_calViewDate.setMonth(isloh_calViewDate.getMonth() - 1); isloh_renderCalendarAll(); }));
  document.querySelectorAll('[data-cal-next]').forEach((b) =>
    b.addEventListener('click', () => { isloh_calViewDate.setMonth(isloh_calViewDate.getMonth() + 1); isloh_renderCalendarAll(); }));
  document.querySelectorAll('[data-cal-today]').forEach((b) =>
    b.addEventListener('click', () => { const t = new Date(); isloh_calViewDate.setFullYear(t.getFullYear(), t.getMonth()); isloh_renderCalendarAll(); }));

  // View switch (Month/Week/Day) — Month is functional; Week/Day show a
  // notice for now (full grids are a Sprint 3B scope item).
  const monthBtn = document.querySelector('.view-switch button[data-view="month"]');
  const switchWrap = monthBtn ? monthBtn.closest('.view-switch') : null;
  if (switchWrap) {
    switchWrap.querySelectorAll('button[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchWrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-cal-view-panel]').forEach((p) => {
          p.hidden = p.dataset.calViewPanel !== btn.dataset.view;
        });
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', isloh_initCalendar);
