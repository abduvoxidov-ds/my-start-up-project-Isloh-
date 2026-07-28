/* ==========================================================================
   ISLOH — Dashboard module
   Renders pages/student/dashboard.html from a single data object shaped
   exactly like the future REST response (GET /api/dashboard). Under
   file:// fetch() throws a CORS error, so isloh_fetchDashboardData()
   returns a resolved Promise around an inline mock — swap its body for a
   real fetch('/api/dashboard').then(r => r.json()) once served over http(s).

   API contract:
     {
       user_summary: { name, avatar },
       stats: { completion_rate, hours_spent, tasks_completed },
       active_courses: [{ id, title, progress, next_lesson_url }],
       today_schedule: [{ time, title, type, duration }],
       ai_recommendation: { message }
     }

   Field mapping to this page's widgets:
     - active_courses[0]            -> "O'rganishni davom ettirish" card
                                        (title, progress bar, continue link)
     - stats.completion_rate        -> same card's featured completion %
                                        (kept alongside active_courses[].progress
                                        for when multiple course cards exist)
     - active_courses.length        -> "Jarayondagi kurslar" stat card
     - stats.hours_spent            -> "Bugungi maqsad" stat card
     - stats.tasks_completed        -> badge next to "Bugungi reja"
     - today_schedule                -> "Bugungi reja" list (re-rendered)
     - ai_recommendation.message    -> "AI Tavsiyasi" card text
     - user_summary.name            -> greeting heading
   "O'rganish seriyasi" va "Yakunlangan kurslar" statistikalari hozirgi
   kontraktda yo'q — backend shu maydonlarni qo'shguncha statik qoladi.
   ========================================================================== */

const ISLOH_DASHBOARD_DATA = {
  user_summary: {
    name: 'Samar',
    avatar: ''
  },
  stats: {
    completion_rate: 63,
    hours_spent: 3,
    tasks_completed: 8
  },
  active_courses: [
    {
      id: 'py-101',
      title: 'Python Backend Development',
      progress: 63,
      next_lesson_url: 'course-detail.html?id=py-101'
    }
  ],
  today_schedule: [
    { time: '10:00', title: 'Django modellari', type: 'lesson', duration: '45 min' },
    { time: '14:00', title: 'DRF ViewSets', type: 'lesson', duration: '30 min' },
    { time: '16:00', title: '4-uy vazifasi', type: 'task', duration: '1 soat' }
  ],
  ai_recommendation: {
    message: "Odatda soat 16:30 dan keyin biroz tanaffus qilasiz. Hozir mavzuni takrorlab qo'ying."
  }
};

// Kelajakda: fetch('/api/dashboard').then(r => r.json()) bilan almashtiriladi.
function isloh_fetchDashboardData() {
  return Promise.resolve(ISLOH_DASHBOARD_DATA);
}

function isloh_renderDashboardSchedule(items) {
  const list = document.getElementById('dash-schedule-list');
  if (!list) return;
  list.innerHTML = items.map((item) => `
    <div class="plan-row">
      <span><i class="bi bi-circle" style="color:var(--violet-500);"></i>&nbsp; ${item.time} — ${item.title}</span>
      <span class="badge badge-neutral">${item.duration || ''}</span>
    </div>`).join('');
}

function isloh_renderDashboard(data) {
  const nameEl = document.getElementById('dash-user-name');
  if (nameEl) nameEl.textContent = data.user_summary.name;

  const hoursEl = document.getElementById('dash-hours-spent');
  if (hoursEl) hoursEl.textContent = data.stats.hours_spent;

  const activeCountEl = document.getElementById('dash-active-courses-count');
  if (activeCountEl) activeCountEl.textContent = data.active_courses.length;

  const tasksBadge = document.getElementById('dash-tasks-completed-badge');
  if (tasksBadge) tasksBadge.textContent = `${data.stats.tasks_completed} bajarildi`;

  const course = data.active_courses[0];
  if (course) {
    const titleEl = document.getElementById('dash-course-title');
    const progressEl = document.getElementById('dash-course-progress');
    const linkEl = document.getElementById('dash-course-link');
    if (titleEl) titleEl.textContent = course.title;
    if (progressEl) progressEl.style.width = (course.progress ?? data.stats.completion_rate) + '%';
    if (linkEl) linkEl.href = course.next_lesson_url;
  }

  isloh_renderDashboardSchedule(data.today_schedule);

  const aiEl = document.getElementById('dash-ai-message');
  if (aiEl) aiEl.textContent = data.ai_recommendation.message;
}

document.addEventListener('DOMContentLoaded', () => {
  isloh_fetchDashboardData().then(isloh_renderDashboard);
});
