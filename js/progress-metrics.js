/* ==========================================================================
   ISLOH — Progress metrics module (Student "Analitika" dashboard)
   Single source of truth: localStorage key ISLOH_ANALYTICS_KEY. Renders stat
   cards, the weekly bars, the category donut+legend and the activity heatmap
   from state instead of each page hardcoding its own numbers — same pattern
   js/marketplace.js uses to drive Marketplace/Cart/Checkout from one shared
   localStorage source.
   File deliberately NOT named analytics.js — ad blockers (uBlock/AdBlock/
   Brave Shields) commonly block any local path matching that exact filename
   as a heuristic against self-hosted trackers, which silently blanks the
   whole page for a chunk of real users if that name is used.
   ========================================================================== */

const ISLOH_ANALYTICS_KEY = 'isloh_analytics';
const ISLOH_ANALYTICS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ISLOH_ANALYTICS_DAY_LABELS = { Mon: "Dush", Tue: "Sesh", Wed: "Chor", Thu: "Pay", Fri: "Jum", Sat: "Shan", Sun: "Yak" };

function isloh_analyticsDefaultState() {
  return {
    totalStudyMinutes: 2530, // 42s 10m
    averageAttentionScore: 86,
    completedLessons: 57,
    trends: { totalStudyMinutes: 12, averageAttentionScore: 4, completedLessons: -3 },
    weeklyStats: {
      Mon: { study: 70, break: 15 },
      Tue: { study: 85, break: 10 },
      Wed: { study: 50, break: 20 },
      Thu: { study: 95, break: 10 },
      Fri: { study: 80, break: 15 },
      Sat: { study: 40, break: 10 },
      Sun: { study: 30, break: 10 }
    },
    categoryBreakdown: [
      { name: "Dasturlash", percentage: 46, color: 'var(--violet-600)' },
      { name: "Dizayn", percentage: 26, color: '#A79CEE' },
      { name: "Boshqa", percentage: 28, color: 'var(--border-soft)' }
    ],
    activityHeatmap: [] // 26 weeks x 7 days, seeded once below, then persisted
  };
}

/* Deterministic (not Math.random) so the heatmap stops repainting itself on
   every reload, and stays visually consistent with the weekly bars above it. */
function isloh_analyticsGenerateHeatmap(weeklyStats) {
  const cells = [];
  for (let week = 0; week < 26; week++) {
    ISLOH_ANALYTICS_DAYS.forEach((day, dayIndex) => {
      const base = weeklyStats[day].study;
      const wobble = ((week * 7 + dayIndex) * 37) % 20 - 10;
      const score = Math.max(0, Math.min(100, base + wobble));
      let level = 0;
      if (score > 80) level = 3;
      else if (score > 55) level = 2;
      else if (score > 30) level = 1;
      cells.push(level);
    });
  }
  return cells;
}

function isloh_getAnalytics() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(ISLOH_ANALYTICS_KEY)); } catch (e) { state = null; }
  if (!state) state = isloh_analyticsDefaultState();
  if (!state.activityHeatmap || state.activityHeatmap.length === 0) {
    state.activityHeatmap = isloh_analyticsGenerateHeatmap(state.weeklyStats);
  }
  isloh_saveAnalytics(state);
  return state;
}

function isloh_saveAnalytics(state) {
  localStorage.setItem(ISLOH_ANALYTICS_KEY, JSON.stringify(state));
}

function isloh_formatStudyDuration(totalMinutes) {
  return `${Math.floor(totalMinutes / 60)}s ${totalMinutes % 60}m`;
}

function isloh_trendPillHtml(percentage) {
  const isUp = percentage >= 0;
  return `<span class="trend-pill ${isUp ? 'trend-up' : 'trend-down'}"><i class="bi bi-arrow-${isUp ? 'up' : 'down'}-short"></i> ${Math.abs(percentage)}%</span>`;
}

function isloh_renderStatCards(state) {
  document.querySelectorAll('[data-metric]').forEach((card) => {
    const metric = card.dataset.metric;
    const valueEl = card.querySelector('[data-stat-value]');
    const trendEl = card.querySelector('[data-stat-trend]');
    if (!valueEl) return;
    valueEl.textContent = metric === 'totalStudyMinutes' ? isloh_formatStudyDuration(state.totalStudyMinutes) : state[metric];
    if (trendEl) trendEl.innerHTML = isloh_trendPillHtml(state.trends[metric]);
  });
}

function isloh_renderWeeklyBars(state) {
  const container = document.querySelector('[data-weekly-bars]');
  if (!container) return;
  container.innerHTML = ISLOH_ANALYTICS_DAYS.map((day) => {
    const { study, break: rest } = state.weeklyStats[day];
    return `<div class="col"><div class="stack"><div class="seg-a" style="height:${study}%;"></div><div class="seg-b" style="height:${rest}%;"></div></div><div class="lbl">${ISLOH_ANALYTICS_DAY_LABELS[day]}</div></div>`;
  }).join('');
}

/* Donut stops are computed from the same percentages the legend renders, so
   the two can never drift out of sync the way two hand-tuned values could. */
function isloh_renderCategoryDonut(state) {
  const donut = document.querySelector('[data-category-donut]');
  const totalEl = document.querySelector('[data-category-total]');
  const legend = document.querySelector('[data-category-legend]');
  if (!donut) return;

  let acc = 0;
  const stops = state.categoryBreakdown.map((cat) => {
    const start = acc;
    acc += cat.percentage;
    return `${cat.color} ${start}% ${acc}%`;
  });
  donut.style.background = `conic-gradient(${stops.join(', ')})`;

  if (totalEl) totalEl.textContent = `${Math.floor(state.totalStudyMinutes / 60)}s`;
  if (legend) {
    legend.innerHTML = state.categoryBreakdown.map((cat) =>
      `<div class="legend-row"><span class="legend-dot" style="background:${cat.color};"></span> ${cat.name} — ${cat.percentage}%</div>`
    ).join('');
  }
}

function isloh_renderHeatmap(state) {
  const el = document.getElementById('heatmap');
  if (!el) return;
  el.innerHTML = '';
  const fragment = document.createDocumentFragment();
  state.activityHeatmap.forEach((level) => {
    const cell = document.createElement('div');
    cell.className = level > 0 ? `cell lvl-${level}` : 'cell';
    fragment.appendChild(cell);
  });
  el.appendChild(fragment);
}

function isloh_renderBestDay(state) {
  const el = document.querySelector('[data-best-day]');
  if (!el) return;
  const bestDay = ISLOH_ANALYTICS_DAYS.reduce((best, day) =>
    state.weeklyStats[day].study > state.weeklyStats[best].study ? day : best, ISLOH_ANALYTICS_DAYS[0]);
  el.textContent = ISLOH_ANALYTICS_DAY_LABELS[bestDay];
}

/* Dashboard's existing "E'tibor bali" progress-ring (r=31, circumference
   194.8) — wired here instead of duplicating the ring markup/math anywhere
   else. */
function isloh_renderAttentionRing(state) {
  const circle = document.querySelector('[data-attention-circle]');
  if (!circle) return;
  const circumference = 194.8;
  const offset = circumference * (1 - state.averageAttentionScore / 100);
  circle.setAttribute('stroke-dashoffset', offset.toFixed(1));

  const valueEl = document.querySelector('[data-attention-value]');
  if (valueEl) valueEl.textContent = state.averageAttentionScore;

  const trendEl = document.querySelector('[data-attention-trend]');
  if (trendEl) {
    const t = state.trends.averageAttentionScore;
    const color = t >= 0 ? 'var(--teach-green)' : 'var(--danger)';
    trendEl.innerHTML = `<span style="color:${color}; font-weight:700;">${t >= 0 ? '+' : ''}${t}%</span>`;
  }
}

function isloh_renderAnalytics() {
  if (!document.querySelector('[data-metric], [data-weekly-bars], [data-category-donut], [data-attention-circle], #heatmap')) return;
  const state = isloh_getAnalytics();
  isloh_renderStatCards(state);
  isloh_renderWeeklyBars(state);
  isloh_renderCategoryDonut(state);
  isloh_renderHeatmap(state);
  isloh_renderBestDay(state);
  isloh_renderAttentionRing(state);
}

/* --- Write API, called from js/lesson-viewer.js so course-player /
       lesson-player feed real activity into this same state instead of it
       staying frozen at the seeded defaults forever. Callers on other pages
       guard with `typeof isloh_recordX === 'function'` since this script
       isn't loaded everywhere. --- */

/* "Today" = the last column of the last heatmap week; bumps one intensity
   level per call (capped at 3) rather than jumping straight to full. */
function isloh_bumpTodayHeatmapCell(state, minutes) {
  if (!minutes || !state.activityHeatmap.length) return;
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  const dayIndex = (jsDay + 6) % 7; // 0=Mon..6=Sun, matches ISLOH_ANALYTICS_DAYS
  const cellIndex = state.activityHeatmap.length - 7 + dayIndex;
  const current = state.activityHeatmap[cellIndex] || 0;
  if (current < 3) state.activityHeatmap[cellIndex] = current + 1;
}

function isloh_recordStudyMinutes(minutes) {
  if (!minutes || minutes <= 0) return;
  const state = isloh_getAnalytics();
  state.totalStudyMinutes += minutes;
  isloh_bumpTodayHeatmapCell(state, minutes);
  isloh_saveAnalytics(state);
  isloh_renderAnalytics();
}

function isloh_recordLessonCompleted() {
  const state = isloh_getAnalytics();
  state.completedLessons += 1;
  isloh_saveAnalytics(state);
  isloh_renderAnalytics();
}

document.addEventListener('DOMContentLoaded', isloh_renderAnalytics);
