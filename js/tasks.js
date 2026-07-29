/* ==========================================================================
   ISLOH — Tasks module
   Single source of truth for the "Vazifalar" section merged into
   pages/student/calendar.html: ISLOH_TASKS_KEY in localStorage. js/calendar.js
   reads the same functions (isloh_getTasks, isloh_taskStatus, isloh_todayISO)
   to render the month grid / mini-calendar / "Bugungi jadval" / "Yaqinlashayotgan"
   from these same tasks — there is no separate calendar event dataset anymore.

   Task shape: { id, title, dueDate ('YYYY-MM-DD'|null), dueTime ('HH:MM'|null),
                 category, priority ('high'|'medium'|'low'),
                 type ('lesson'|'deadline'|'exam'|'personal'), isCompleted }
   `type` drives calendar event color AND matches the right-rail "Turkumlar"
   legend (Darslar/Muddatlar/Imtihonlar/Shaxsiy = lesson/deadline/exam/personal).

   Status (today/overdue/upcoming/completed) is always derived from
   dueDate + isCompleted — never stored, so it can't drift out of sync.

   Markup contract:
     [data-task-list]                              → List view mount; one
                                                     .task-group per non-empty
                                                     status bucket
     [data-tasks-empty]                            → shown when 0 tasks render
     [data-kanban-board]                           → Kanban mount; one
                                                     .kanban-col per status,
                                                     same data as List view
     [data-priority-filter="all|high|medium|low"]  → only filter left; status
                                                     groups always render, in
                                                     continuous scroll order
     #add-task-modal (.modal-overlay)              → holds the quick-add form
       [data-quick-add-event]                       → opens it
       [data-modal-close]                           → closes it
       #quick-add-input / #quick-add-date / #quick-add-priority, [data-quick-add]
     [data-ai-suggestion] [data-ai-suggestion-add] [data-ai-suggestion-reject]
     #task-count-total/-today/-overdue/-done, #task-progress-fill/-label
     .view-switch button[data-view="list|kanban"]
     .task-card [data-task-edit] / [data-task-delete] (.row-action buttons)
   ========================================================================== */

const ISLOH_TASKS_KEY = 'isloh_tasks';

const ISLOH_TASK_STATUS_META = {
  overdue:   { label: "Muddati o'tgan", icon: 'bi-exclamation-circle', color: 'var(--danger)' },
  today:     { label: 'Bugun',          icon: 'bi-calendar-day',      color: 'var(--violet-600)' },
  upcoming:  { label: 'Kelgusi',        icon: 'bi-calendar-week',     color: 'var(--ink-500)' },
  completed: { label: 'Bajarilgan',     icon: 'bi-check2-circle',     color: 'var(--teach-green)' }
};
const ISLOH_TASK_GROUP_ORDER = ['overdue', 'today', 'upcoming', 'completed'];
const ISLOH_PRIORITY_LABEL = { high: 'Yuqori', medium: "O'rta", low: 'Past' };

function isloh_todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isloh_offsetISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isloh_daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO) - new Date(fromISO)) / 86400000);
}

function isloh_seedTasks() {
  return [
    { id: 't1', title: 'Django modellari darsini yakunlash', dueDate: isloh_offsetISO(0), dueTime: '16:00', category: 'Python Backend', priority: 'high', type: 'lesson', isCompleted: false },
    { id: 't2', title: 'DRF ViewSets amaliyotini bajarish', dueDate: isloh_offsetISO(0), dueTime: '18:00', category: 'Python Backend', priority: 'medium', type: 'lesson', isCompleted: false },
    { id: 't3', title: 'JavaScript eslatmalarini takrorlash', dueDate: isloh_offsetISO(0), dueTime: null, category: 'JavaScript', priority: 'low', type: 'personal', isCompleted: false },
    { id: 't4', title: "UI/UX topshirig'ini yuborish", dueDate: isloh_offsetISO(-1), dueTime: null, category: 'UI/UX', priority: 'high', type: 'deadline', isCompleted: false },
    { id: 't5', title: 'Loyiha hujjatlarini tayyorlash', dueDate: isloh_offsetISO(3), dueTime: null, category: 'Loyiha', priority: 'medium', type: 'deadline', isCompleted: false },
    { id: 't6', title: 'Oraliq imtihonga tayyorgarlik', dueDate: isloh_offsetISO(7), dueTime: null, category: 'Imtihon', priority: 'high', type: 'exam', isCompleted: false },
    { id: 't7', title: 'HTML asoslari darsi', dueDate: isloh_offsetISO(-6), dueTime: null, category: 'Frontend', priority: 'low', type: 'lesson', isCompleted: true },
    { id: 't8', title: 'Git repository sozlash', dueDate: isloh_offsetISO(-5), dueTime: null, category: 'DevOps', priority: 'medium', type: 'personal', isCompleted: true }
  ];
}

function isloh_getTasks() {
  try {
    const raw = localStorage.getItem(ISLOH_TASKS_KEY);
    if (raw === null) {
      const seeded = isloh_seedTasks();
      isloh_saveTasks(seeded);
      return seeded;
    }
    return JSON.parse(raw) || [];
  } catch (e) { return []; }
}
function isloh_saveTasks(tasks) {
  localStorage.setItem(ISLOH_TASKS_KEY, JSON.stringify(tasks));
}

function isloh_taskStatus(task) {
  if (task.isCompleted) return 'completed';
  if (!task.dueDate) return 'upcoming';
  const today = isloh_todayISO();
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return 'upcoming';
}

function isloh_overdueLabel(task) { return `${isloh_daysBetween(task.dueDate, isloh_todayISO())} kun kechikdi`; }
function isloh_upcomingDaysLabel(task) { return `${isloh_daysBetween(isloh_todayISO(), task.dueDate)} kundan keyin`; }

function isloh_taskDueLabel(task, status) {
  if (status === 'overdue') return `<span style="color:var(--danger);"><i class="bi bi-clock-history"></i> ${isloh_overdueLabel(task)}</span>`;
  if (status === 'today') return `<span><i class="bi bi-clock"></i> Bugun${task.dueTime ? ' ' + task.dueTime : ''}</span>`;
  if (status === 'upcoming' && task.dueDate) return `<span><i class="bi bi-clock"></i> ${isloh_upcomingDaysLabel(task)}</span>`;
  return '';
}

function isloh_taskMetaHtml(task, status) {
  const prio = `<span class="priority-badge priority-${task.priority}"><span class="priority-dot ${task.priority}"></span> ${ISLOH_PRIORITY_LABEL[task.priority]}</span>`;
  const cat = task.category ? `<span><i class="bi bi-journal-bookmark"></i> ${task.category}</span>` : '';
  return prio + cat + isloh_taskDueLabel(task, status);
}

function isloh_taskCardHtml(task) {
  const status = isloh_taskStatus(task);
  const done = task.isCompleted;
  return `<div class="task-card${done ? ' done' : ''}" data-task-id="${task.id}" data-priority="${task.priority}">
    <div class="task-check${done ? ' checked' : ''}" role="checkbox" aria-checked="${done}" tabindex="0">${done ? '<i class="bi bi-check-lg"></i>' : ''}</div>
    <div class="task-body">
      <div class="task-title">${task.title}</div>
      <div class="task-meta">${isloh_taskMetaHtml(task, status)}</div>
    </div>
    <div class="row-actions">
      <button type="button" class="row-action" data-task-edit aria-label="Tahrirlash"><i class="bi bi-pencil"></i></button>
      <button type="button" class="row-action" data-task-delete aria-label="O'chirish"><i class="bi bi-trash"></i></button>
    </div>
  </div>`;
}

function isloh_kanbanCardHtml(task) {
  const status = isloh_taskStatus(task);
  let right = '';
  if (status === 'completed') right = '<span><i class="bi bi-check-lg" style="color:var(--teach-green);"></i></span>';
  else if (status === 'overdue') right = `<span style="color:var(--danger);">${isloh_overdueLabel(task)}</span>`;
  else if (status === 'today') right = `<span>${task.dueTime || 'Bugun'}</span>`;
  else right = `<span>${isloh_upcomingDaysLabel(task)}</span>`;

  return `<div class="kanban-card" data-task-id="${task.id}">
    <div class="kanban-card-title">${task.title}</div>
    <div class="kanban-card-meta"><span class="priority-badge priority-${task.priority}"><span class="priority-dot ${task.priority}"></span> ${ISLOH_PRIORITY_LABEL[task.priority]}</span>${right}</div>
  </div>`;
}

function isloh_activeFilterValue(selector, dataAttr) {
  const btn = document.querySelector(`${selector}.active`);
  return btn ? btn.dataset[dataAttr] : 'all';
}

function isloh_bucketTasks(tasks, applyFilters) {
  const prioFilter = applyFilters ? isloh_activeFilterValue('[data-priority-filter]', 'priorityFilter') : 'all';

  const buckets = { overdue: [], today: [], upcoming: [], completed: [] };
  tasks.forEach((t) => {
    if (prioFilter !== 'all' && t.priority !== prioFilter) return;
    buckets[isloh_taskStatus(t)].push(t);
  });
  return buckets;
}

// --- List view (full rebuild — used for initial load, filter/search changes) ---
function isloh_renderTasks() {
  const mount = document.querySelector('[data-task-list]');
  if (!mount) return;

  const tasks = isloh_getTasks();
  const buckets = isloh_bucketTasks(tasks, true);

  let html = '';
  ISLOH_TASK_GROUP_ORDER.forEach((status) => {
    const items = buckets[status];
    if (!items.length) return;
    const meta = ISLOH_TASK_STATUS_META[status];
    html += `<div class="task-group" data-task-group="${status}">
      <div class="task-group-head"><i class="bi ${meta.icon}" style="color:${meta.color};"></i> ${meta.label} <span class="grp-count">${items.length}</span></div>
      <div class="task-group-body">${items.map(isloh_taskCardHtml).join('')}</div>
    </div>`;
  });
  mount.innerHTML = html;
  isloh_syncEmptyState();
  isloh_updateTaskStats(tasks);
}

function isloh_syncEmptyState() {
  const mount = document.querySelector('[data-task-list]');
  const empty = document.querySelector('[data-tasks-empty]');
  if (!mount || !empty) return;
  empty.style.display = mount.children.length ? 'none' : '';
}

function isloh_updateTaskStats(tasks) {
  const total = tasks.length;
  const today = tasks.filter((t) => isloh_taskStatus(t) === 'today').length;
  const overdue = tasks.filter((t) => isloh_taskStatus(t) === 'overdue').length;
  const done = tasks.filter((t) => t.isCompleted).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('task-count-total', total);
  set('task-count-today', today);
  set('task-count-overdue', overdue);
  set('task-count-done', done);

  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('task-progress-fill');
  const lbl = document.getElementById('task-progress-label');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = pct + '%';
}

// --- Kanban view (full rebuild — no filters, always mirrors the same tasks) ---
function isloh_renderKanban() {
  const board = document.querySelector('[data-kanban-board]');
  if (!board) return;

  const tasks = isloh_getTasks();
  const buckets = isloh_bucketTasks(tasks, false);

  board.innerHTML = ISLOH_TASK_GROUP_ORDER.map((status) => {
    const meta = ISLOH_TASK_STATUS_META[status];
    const items = buckets[status];
    const cards = items.length
      ? items.map(isloh_kanbanCardHtml).join('')
      : `<div style="font-size:12px; color:var(--ink-300); text-align:center; padding:14px 0;">Bo'sh</div>`;
    return `<div class="kanban-col" data-kanban-col="${status}">
      <div class="kanban-col-head">${meta.label} <span class="kanban-count">${items.length}</span></div>
      ${cards}
    </div>`;
  }).join('');
}

function isloh_syncSecondaryViews() {
  isloh_renderKanban();
  if (typeof isloh_renderCalendarAll === 'function') isloh_renderCalendarAll();
}

// --- DOM-safe mutations (List view): move/remove one card without rebuilding
// the whole list, so toggling/deleting a task doesn't steal keyboard focus. ---
function isloh_ensureGroupEl(status) {
  const mount = document.querySelector('[data-task-list]');
  if (!mount) return null;
  let group = mount.querySelector(`[data-task-group="${status}"]`);
  if (group) return group;

  const meta = ISLOH_TASK_STATUS_META[status];
  group = document.createElement('div');
  group.className = 'task-group';
  group.dataset.taskGroup = status;
  group.innerHTML = `<div class="task-group-head"><i class="bi ${meta.icon}" style="color:${meta.color};"></i> ${meta.label} <span class="grp-count">0</span></div><div class="task-group-body"></div>`;

  const order = ISLOH_TASK_GROUP_ORDER;
  const idx = order.indexOf(status);
  let nextGroup = null;
  for (let i = idx + 1; i < order.length; i++) {
    nextGroup = mount.querySelector(`[data-task-group="${order[i]}"]`);
    if (nextGroup) break;
  }
  if (nextGroup) mount.insertBefore(group, nextGroup); else mount.appendChild(group);
  return group;
}

function isloh_refreshGroupCount(status) {
  const mount = document.querySelector('[data-task-list]');
  const group = mount?.querySelector(`[data-task-group="${status}"]`);
  if (!group) return;
  const n = group.querySelectorAll('.task-card').length;
  if (n === 0) { group.remove(); return; }
  const countEl = group.querySelector('.grp-count');
  if (countEl) countEl.textContent = n;
}

function isloh_updateCardInPlace(card, task, status) {
  const done = task.isCompleted;
  card.classList.toggle('done', done);
  card.dataset.priority = task.priority;
  const check = card.querySelector('.task-check');
  if (check) {
    check.classList.toggle('checked', done);
    check.setAttribute('aria-checked', String(done));
    check.innerHTML = done ? '<i class="bi bi-check-lg"></i>' : '';
  }
  const titleEl = card.querySelector('.task-title');
  if (titleEl) titleEl.textContent = task.title;
  const metaEl = card.querySelector('.task-meta');
  if (metaEl) metaEl.innerHTML = isloh_taskMetaHtml(task, status);
}

function isloh_toggleTaskById(id) {
  const tasks = isloh_getTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const oldStatus = isloh_taskStatus(task);
  task.isCompleted = !task.isCompleted;
  isloh_saveTasks(tasks);
  const newStatus = isloh_taskStatus(task);

  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  if (card) {
    const prioFilter = isloh_activeFilterValue('[data-priority-filter]', 'priorityFilter');
    const stillVisible = prioFilter === 'all' || prioFilter === task.priority;
    const oldGroupStatus = oldStatus;
    const hadFocus = card.contains(document.activeElement);

    if (!stillVisible) {
      card.remove();
      isloh_refreshGroupCount(oldGroupStatus);
    } else if (newStatus !== oldStatus) {
      isloh_updateCardInPlace(card, task, newStatus);
      card.remove();
      isloh_refreshGroupCount(oldGroupStatus);
      const targetGroup = isloh_ensureGroupEl(newStatus);
      targetGroup.querySelector('.task-group-body').prepend(card);
      isloh_refreshGroupCount(newStatus);
      // remove()+prepend() detaches the node, which drops focus even though
      // it's the same element — restore it so Tab-navigating users don't
      // get bounced back to the top of the page after each toggle.
      if (hadFocus) card.querySelector('.task-check')?.focus();
    } else {
      isloh_updateCardInPlace(card, task, newStatus);
    }
    isloh_syncEmptyState();
  }

  isloh_updateTaskStats(tasks);
  isloh_syncSecondaryViews();
  if (typeof isloh_showToast === 'function') {
    isloh_showToast(task.isCompleted ? 'Vazifa bajarildi deb belgilandi' : 'Vazifa qayta ochildi', 'success');
  }
}

function isloh_deleteTaskById(id) {
  const tasks = isloh_getTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const status = isloh_taskStatus(tasks[idx]);
  tasks.splice(idx, 1);
  isloh_saveTasks(tasks);

  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  if (card) { card.remove(); isloh_refreshGroupCount(status); isloh_syncEmptyState(); }

  isloh_updateTaskStats(tasks);
  isloh_syncSecondaryViews();
  if (typeof isloh_showToast === 'function') isloh_showToast("Vazifa o'chirildi", 'success');
}

function isloh_editTaskById(id) {
  const tasks = isloh_getTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  const next = window.prompt('Vazifa nomini tahrirlang:', task.title);
  if (next === null) return;
  const title = next.trim();
  if (!title) return;
  task.title = title;
  isloh_saveTasks(tasks);

  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  const titleEl = card?.querySelector('.task-title');
  if (titleEl) titleEl.textContent = title;

  isloh_syncSecondaryViews();
  if (typeof isloh_showToast === 'function') isloh_showToast('Vazifa yangilandi', 'success');
}

// --- Quick add (prepends — newest task shows first in its group) ---
function isloh_addTaskFromInput() {
  const input = document.getElementById('quick-add-input');
  const title = (input?.value || '').trim();
  if (!title) return;

  const dateInput = document.getElementById('quick-add-date');
  const prioSelect = document.getElementById('quick-add-priority');

  const tasks = isloh_getTasks();
  tasks.unshift({
    id: 'task-' + Date.now(),
    title,
    dueDate: dateInput?.value || isloh_todayISO(),
    dueTime: null,
    category: 'Shaxsiy',
    priority: prioSelect?.value || 'medium',
    type: 'personal',
    isCompleted: false
  });
  isloh_saveTasks(tasks);

  input.value = '';
  if (dateInput) dateInput.value = '';
  if (prioSelect) prioSelect.value = 'medium';

  isloh_renderTasks();
  isloh_syncSecondaryViews();
  if (typeof isloh_closeModal === 'function') isloh_closeModal('add-task-modal');
  if (typeof isloh_showToast === 'function') isloh_showToast("Vazifa qo'shildi", 'success');
}

// --- AI suggestion card ---
function isloh_initAiSuggestion() {
  const card = document.querySelector('[data-ai-suggestion]');
  if (!card) return;

  const addBtn = card.querySelector('[data-ai-suggestion-add]');
  const rejectBtn = card.querySelector('[data-ai-suggestion-reject]');

  if (addBtn) addBtn.addEventListener('click', () => {
    const tasks = isloh_getTasks();
    tasks.unshift({
      id: 'task-' + Date.now(),
      title: 'REST API asoslarini takrorlash',
      dueDate: isloh_todayISO(),
      dueTime: null,
      category: 'Python Backend',
      priority: 'medium',
      type: 'personal',
      isCompleted: false
    });
    isloh_saveTasks(tasks);
    isloh_renderTasks();
    isloh_syncSecondaryViews();
    card.remove();
    if (typeof isloh_showToast === 'function') isloh_showToast('AI tavsiyasi vazifalarga qo\'shildi', 'success');
  });

  if (rejectBtn) rejectBtn.addEventListener('click', () => {
    card.remove();
    if (typeof isloh_showToast === 'function') isloh_showToast('Tavsiya rad etildi', 'success');
  });
}

function isloh_initTaskFilters() {
  document.querySelectorAll('[data-priority-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-priority-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      isloh_renderTasks();
    });
  });
}

function isloh_initTaskViewSwitch() {
  const listBtn = document.querySelector('.view-switch button[data-view="list"]');
  const switchWrap = listBtn ? listBtn.closest('.view-switch') : null;
  if (!switchWrap) return;
  switchWrap.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchWrap.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('[data-task-view-panel]').forEach((p) => {
        p.hidden = p.dataset.taskViewPanel !== btn.dataset.view;
      });
      if (btn.dataset.view === 'kanban') isloh_renderKanban();
    });
  });
}

function isloh_initAddTaskModal() {
  document.querySelectorAll('[data-quick-add-event]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_openModal === 'function') isloh_openModal('add-task-modal');
      document.getElementById('quick-add-input')?.focus();
    });
  });
  document.querySelectorAll('#add-task-modal [data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof isloh_closeModal === 'function') isloh_closeModal('add-task-modal');
    });
  });
}

function isloh_initTasks() {
  const mount = document.querySelector('[data-task-list]');
  if (mount) {
    mount.addEventListener('click', (e) => {
      const card = e.target.closest('[data-task-id]');
      if (!card) return;
      if (e.target.closest('[data-task-edit]')) { isloh_editTaskById(card.dataset.taskId); return; }
      if (e.target.closest('[data-task-delete]')) { isloh_deleteTaskById(card.dataset.taskId); return; }
      if (e.target.closest('.task-check')) { isloh_toggleTaskById(card.dataset.taskId); return; }
    });
    mount.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const check = e.target.closest('.task-check');
      if (!check) return;
      e.preventDefault();
      const card = check.closest('[data-task-id]');
      if (card) isloh_toggleTaskById(card.dataset.taskId);
    });
  }

  const board = document.querySelector('[data-kanban-board]');
  if (board) {
    board.addEventListener('click', (e) => {
      const card = e.target.closest('[data-task-id]');
      if (card) isloh_toggleTaskById(card.dataset.taskId);
    });
  }

  if (!mount && !board) return;

  isloh_initTaskFilters();
  isloh_initTaskViewSwitch();
  isloh_initAddTaskModal();
  isloh_initAiSuggestion();

  const addBtn = document.querySelector('[data-quick-add]');
  if (addBtn) addBtn.addEventListener('click', isloh_addTaskFromInput);
  const qInput = document.getElementById('quick-add-input');
  if (qInput) qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') isloh_addTaskFromInput(); });

  isloh_renderTasks();
  isloh_renderKanban();
}

document.addEventListener('DOMContentLoaded', isloh_initTasks);
