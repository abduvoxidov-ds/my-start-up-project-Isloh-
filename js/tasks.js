/* ==========================================================================
   ISLOH — Tasks module  (Sprint 3A)
   Interactions for pages/student/tasks.html:
     • toggle a task complete (checkbox) + live stat recount
     • filter by status chip (All / Today / Upcoming / Completed / Overdue)
     • filter by priority
     • search by title
     • switch List <-> Kanban view (UI only)
     • quick-add task (prepends a task card to the "Bugun" list)
   No backend: state lives in the DOM. A later sprint can lift this into a
   real store without changing the markup contract below.

   Markup contract:
     .task-card[data-status][data-priority]  with  .task-check  inside
     [data-task-filter="all|today|upcoming|completed|overdue"]
     [data-priority-filter="all|high|medium|low"]
     #task-search, #task-count-*
     .view-switch button[data-view="list|kanban"]
     [data-task-view-panel="list|kanban"]
     #quick-add-input, [data-quick-add]
   ========================================================================== */

function isloh_recountTasks() {
  const all = document.querySelectorAll('.task-card');
  let done = 0, today = 0, overdue = 0;
  all.forEach((t) => {
    if (t.dataset.status === 'completed' || t.classList.contains('done')) done++;
    if (t.dataset.status === 'today') today++;
    if (t.dataset.status === 'overdue') overdue++;
  });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('task-count-total', all.length);
  set('task-count-done', done);
  set('task-count-today', today);
  set('task-count-overdue', overdue);

  const total = all.length || 1;
  const pct = Math.round((done / total) * 100);
  const bar = document.getElementById('task-progress-fill');
  const lbl = document.getElementById('task-progress-label');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = pct + '%';
}

function isloh_toggleTask(card) {
  const check = card.querySelector('.task-check');
  const nowDone = !card.classList.contains('done');
  card.classList.toggle('done', nowDone);
  if (check) {
    check.classList.toggle('checked', nowDone);
    check.innerHTML = nowDone ? '<i class="bi bi-check-lg"></i>' : '';
  }
  card.dataset.status = nowDone ? 'completed' : (card.dataset.prevStatus || 'today');
  if (nowDone) card.dataset.prevStatus = card.dataset.prevStatus || 'today';
  isloh_recountTasks();
}

function isloh_applyTaskFilters() {
  const statusBtn = document.querySelector('[data-task-filter].active');
  const prioBtn = document.querySelector('[data-priority-filter].active');
  const status = statusBtn ? statusBtn.dataset.taskFilter : 'all';
  const prio = prioBtn ? prioBtn.dataset.priorityFilter : 'all';
  const q = (document.getElementById('task-search')?.value || '').trim().toLowerCase();

  document.querySelectorAll('.task-card').forEach((card) => {
    const st = card.dataset.status;
    const isDone = card.classList.contains('done') || st === 'completed';
    let show = true;
    if (status === 'completed') show = isDone;
    else if (status !== 'all') show = st === status && !isDone;
    if (show && prio !== 'all') show = card.dataset.priority === prio;
    if (show && q) show = (card.querySelector('.task-title')?.textContent || '').toLowerCase().includes(q);
    card.style.display = show ? '' : 'none';
  });

  document.querySelectorAll('[data-task-group]').forEach((group) => {
    const anyVisible = [...group.querySelectorAll('.task-card')].some((c) => c.style.display !== 'none');
    group.style.display = anyVisible ? '' : 'none';
  });
}

function isloh_addQuickTask() {
  const input = document.getElementById('quick-add-input');
  if (!input || !input.value.trim()) return;
  const list = document.querySelector('[data-task-group="today"] .task-group-body') ||
               document.querySelector('[data-task-group="today"]');
  if (!list) return;

  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.status = 'today';
  card.dataset.priority = 'medium';
  card.innerHTML =
    '<div class="task-check" role="checkbox" aria-checked="false" tabindex="0"></div>' +
    '<div class="task-body"><div class="task-title">' + input.value.replace(/</g, '&lt;') + '</div>' +
    '<div class="task-meta"><span class="priority-badge priority-medium"><span class="priority-dot medium"></span> O\'rta</span>' +
    '<span><i class="bi bi-clock"></i> Bugun</span></div></div>';
  list.prepend(card);
  input.value = '';
  isloh_bindTaskCard(card);
  isloh_recountTasks();
  isloh_applyTaskFilters();
}

function isloh_bindTaskCard(card) {
  const check = card.querySelector('.task-check');
  if (!check) return;
  check.addEventListener('click', () => isloh_toggleTask(card));
  check.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); isloh_toggleTask(card); }
  });
}

function isloh_initTasks() {
  if (!document.querySelector('.task-card') && !document.getElementById('quick-add-input')) return;

  document.querySelectorAll('.task-card').forEach(isloh_bindTaskCard);

  document.querySelectorAll('[data-task-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-task-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      isloh_applyTaskFilters();
    });
  });
  document.querySelectorAll('[data-priority-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-priority-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      isloh_applyTaskFilters();
    });
  });

  const search = document.getElementById('task-search');
  if (search) search.addEventListener('input', isloh_applyTaskFilters);

  const switchWrap = document.querySelector('.view-switch');
  if (switchWrap) {
    switchWrap.querySelectorAll('button[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchWrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('[data-task-view-panel]').forEach((p) => {
          p.hidden = p.dataset.taskViewPanel !== btn.dataset.view;
        });
      });
    });
  }

  const addBtn = document.querySelector('[data-quick-add]');
  if (addBtn) addBtn.addEventListener('click', isloh_addQuickTask);
  const qInput = document.getElementById('quick-add-input');
  if (qInput) qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') isloh_addQuickTask(); });

  isloh_recountTasks();
}

document.addEventListener('DOMContentLoaded', isloh_initTasks);
