/* ==========================================================================
   ISLOH — Calendar module  (Sprint 3A)
   Renders the full month grid and the mini-calendar from a small event
   dataset, and wires the Month/Week/Day view switch + prev/next navigation.
   Pure vanilla JS, no dependencies. Data is static sample data for now; a
   later sprint can swap ISLOH_CAL_EVENTS for a real source without touching
   the render code (prepares the "AI scheduling support" hook).

   Expected markup on the page:
     data-cal-month-label, #cal-grid, #cal-weekdays  (full calendar)
     #mini-cal-grid, #mini-cal-month                  (mini calendar, optional)
     .view-switch button[data-view]                   (view switch, optional)
     [data-cal-prev] / [data-cal-next]                (nav buttons, optional)
   ========================================================================== */

const ISLOH_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const ISLOH_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

/* Sample events keyed by ISO date (YYYY-MM-DD). type => .ev-* / .cat class. */
const ISLOH_CAL_EVENTS = {
  // populated relative to "today" at init so the demo always looks current
};

function isloh_isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isloh_seedSampleEvents(base) {
  const y = base.getFullYear(), m = base.getMonth(), d = base.getDate();
  const put = (offset, ev) => {
    const dt = new Date(y, m, d + offset);
    const key = isloh_isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
    (ISLOH_CAL_EVENTS[key] = ISLOH_CAL_EVENTS[key] || []).push(ev);
  };
  put(0,  { title: '10:00 Django darsi',      type: 'lesson' });
  put(0,  { title: '16:00 Uy vazifasi',        type: 'deadline' });
  put(1,  { title: '14:00 DRF amaliyot',       type: 'lesson' });
  put(2,  { title: 'JS test',                  type: 'exam' });
  put(3,  { title: 'Loyiha topshirish',        type: 'deadline' });
  put(5,  { title: 'Mentor uchrashuvi',        type: 'personal' });
  put(-2, { title: 'UI/UX darsi',              type: 'lesson' });
  put(7,  { title: 'Oraliq imtihon',           type: 'exam' });
}

function isloh_startOffset(firstDayIdx) {
  // JS: 0=Sun..6=Sat. We want Monday-first, so Monday=0..Sunday=6.
  return (firstDayIdx + 6) % 7;
}

function isloh_renderMonth(viewDate) {
  const grid = document.getElementById('cal-grid');
  const label = document.querySelector('[data-cal-month-label]');
  const wd = document.getElementById('cal-weekdays');
  if (!grid) return;

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
    const events = ISLOH_CAL_EVENTS[key] || [];
    let evHtml = events.slice(0, 2).map((e) => `<div class="cal-event ev-${e.type}" title="${e.title}">${e.title}</div>`).join('');
    if (events.length > 2) evHtml += `<div class="cal-more">+${events.length - 2} ko'proq</div>`;
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
    const hasEvent = (ISLOH_CAL_EVENTS[key] || []).length > 0;
    html += `<div class="mc-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}">${d}</div>`;
  }
  grid.innerHTML = html;
}

function isloh_initCalendar() {
  const hasFull = document.getElementById('cal-grid');
  const hasMini = document.getElementById('mini-cal-grid');
  if (!hasFull && !hasMini) return;

  const view = new Date();
  isloh_seedSampleEvents(new Date());

  const rerender = () => { isloh_renderMonth(view); isloh_renderMiniCal(view); };
  rerender();

  document.querySelectorAll('[data-cal-prev]').forEach((b) =>
    b.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); rerender(); }));
  document.querySelectorAll('[data-cal-next]').forEach((b) =>
    b.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); rerender(); }));
  document.querySelectorAll('[data-cal-today]').forEach((b) =>
    b.addEventListener('click', () => { const t = new Date(); view.setFullYear(t.getFullYear(), t.getMonth()); rerender(); }));

  // View switch (Month/Week/Day) — Month is functional; Week/Day show a
  // notice for now (full grids are a Sprint 3B scope item).
  const switchWrap = document.querySelector('.view-switch');
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
