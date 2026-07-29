/* ==========================================================================
   ISLOH — Calendar module
   Renders the month grid, mini-calendar, "Bugungi jadval" and "Yaqinlashayotgan"
   sidebar widgets — all derived from the same isloh_tasks state that
   js/tasks.js owns (via isloh_getTasks/isloh_taskStatus/isloh_todayISO), so
   the Calendar and Vazifalar halves of this page share one source of truth.
   isloh_renderCalendarAll() is exposed globally so js/tasks.js can call it
   after any add/edit/delete/toggle to keep the calendar in sync.

   Expected markup on the page:
     data-cal-month-label, #cal-grid, #cal-weekdays  (full calendar)
     #mini-cal-grid, #mini-cal-month                  (mini calendar, optional)
     [data-today-timeline]                            (today's schedule, optional)
     [data-upcoming-rail]                              (upcoming list, optional)
     .view-switch button[data-view]                   (Month/Week/Day switch, optional)
     [data-cal-prev] / [data-cal-next] / [data-cal-today]
   ========================================================================== */

const ISLOH_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const ISLOH_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

const ISLOH_UPCOMING_ICON = {
  lesson:   { bg: 'var(--violet-100)', color: 'var(--violet-600)', icon: 'bi-journal-bookmark-fill' },
  deadline: { bg: '#FDEBEC',           color: 'var(--danger)',     icon: 'bi-flag-fill' },
  exam:     { bg: '#FEF3E2',           color: 'var(--warning)',    icon: 'bi-mortarboard-fill' },
  personal: { bg: 'var(--teach-green-100)', color: 'var(--teach-green)', icon: 'bi-person-fill' }
};

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
    (events[t.dueDate] = events[t.dueDate] || []).push({ title, type: t.type || 'personal' });
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

  let cells = '';
  // leading days from previous month
  for (let i = firstIdx; i > 0; i--) {
    cells += `<div class="cal-day muted"><div class="cal-daynum">${daysInPrev - i + 1}</div></div>`;
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const key = isloh_isoDate(y, m, d);
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const dayEvents = events[key] || [];
    let evHtml = dayEvents.slice(0, 2).map((e) => `<div class="cal-event ev-${e.type}" title="${e.title}">${e.title}</div>`).join('');
    if (dayEvents.length > 2) evHtml += `<div class="cal-more">+${dayEvents.length - 2} ko'proq</div>`;
    cells += `<div class="cal-day${isToday ? ' today' : ''}"><div class="cal-daynum">${d}</div>${evHtml}</div>`;
  }
  // trailing days to fill the last row
  const total = firstIdx + daysInMonth;
  const trailing = (7 - (total % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    cells += `<div class="cal-day muted"><div class="cal-daynum">${d}</div></div>`;
  }
  grid.innerHTML = cells;
}

function isloh_renderMiniCal(viewDate) {
  const grid = document.getElementById('mini-cal-grid');
  const monthEl = document.getElementById('mini-cal-month');
  if (!grid) return;

  const events = isloh_buildCalEventsFromTasks();
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  if (monthEl) monthEl.textContent = `${ISLOH_MONTHS[m]} ${y}`;

  const today = new Date();
  const firstIdx = isloh_startOffset(new Date(y, m, 1).getDay());
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  let html = ISLOH_WEEKDAYS.map((d) => `<div class="mc-wd">${d[0]}</div>`).join('');
  for (let i = 0; i < firstIdx; i++) html += `<div class="mc-day muted"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = isloh_isoDate(y, m, d);
    const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
    const hasEvent = (events[key] || []).length > 0;
    html += `<div class="mc-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}">${d}</div>`;
  }
  grid.innerHTML = html;
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
    wrap.innerHTML = `<div style="font-size:12.5px; color:var(--ink-500); text-align:center; padding:12px 0;">Bugun uchun rejalashtirilgan tadbir yo'q.</div>`;
    return;
  }
  wrap.innerHTML = items.map((t) => {
    const cls = t.isCompleted ? 'tl-green' : (t.priority === 'high' ? 'tl-warning' : '');
    return `<div class="timeline-item ${cls}">
      <div class="timeline-time">${t.dueTime || 'Kun davomida'}</div>
      <div class="timeline-title">${t.title}</div>
    </div>`;
  }).join('');
}

// --- Right rail: "Yaqinlashayotgan" — next incomplete tasks after today ---
function isloh_renderUpcomingRail() {
  const wrap = document.querySelector('[data-upcoming-rail]');
  if (!wrap) return;
  if (typeof isloh_getTasks !== 'function') { wrap.innerHTML = ''; return; }

  const today = isloh_todayISO();
  const items = isloh_getTasks()
    .filter((t) => !t.isCompleted && t.dueDate && t.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  if (!items.length) {
    wrap.innerHTML = `<div style="font-size:12.5px; color:var(--ink-500); text-align:center; padding:12px 0;">Yaqin kunlarda rejalashtirilgan narsa yo'q.</div>`;
    return;
  }
  wrap.innerHTML = items.map((t) => {
    const cfg = ISLOH_UPCOMING_ICON[t.type || 'personal'];
    return `<div class="upcoming-row">
      <div class="upcoming-icon" style="background:${cfg.bg}; color:${cfg.color};"><i class="bi ${cfg.icon}"></i></div>
      <div class="upcoming-body">
        <div class="upcoming-title">${t.title}</div>
        <div class="upcoming-sub">${isloh_upcomingDaysLabel(t)}</div>
      </div>
    </div>`;
  }).join('');
}

function isloh_renderCalendarAll() {
  isloh_renderMonth(isloh_calViewDate);
  isloh_renderMiniCal(isloh_calViewDate);
  isloh_renderTodayTimeline();
  isloh_renderUpcomingRail();
}

function isloh_initCalendar() {
  const hasFull = document.getElementById('cal-grid');
  const hasMini = document.getElementById('mini-cal-grid');
  const hasTimeline = document.querySelector('[data-today-timeline]');
  const hasUpcoming = document.querySelector('[data-upcoming-rail]');
  if (!hasFull && !hasMini && !hasTimeline && !hasUpcoming) return;

  isloh_renderCalendarAll();

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
