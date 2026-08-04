/* ==========================================================================
   ISLOH — Tasks module
   Single source of truth for the "Vazifalar" section merged into
   pages/student/calendar.html: ISLOH_TASKS_KEY in localStorage. js/calendar.js
   reads the same functions (isloh_getTasks, isloh_taskStatus, isloh_todayISO)
   to render the month grid and the "Bugungi jadval" rail from these same
   tasks — there is no separate calendar event dataset anymore.

   Task shape: { id, title, dueDate ('YYYY-MM-DD'|null), dueTime ('HH:MM'|null),
                 category, priority ('high'|'medium'|'low'),
                 type ('lesson'|'deadline'|'exam'|'personal'),
                 courseId, lessonId, isCompleted }
   `type` drives calendar event color AND matches the right-rail "Turkumlar"
   legend (Darslar/Muddatlar/Imtihonlar/Shaxsiy = lesson/deadline/exam/personal).

   courseId/lessonId — ixtiyoriy bog'lanish (js/course-data.js dagi id'lar).
   Faqat id saqlanadi, nom emas: kurs nomi o'zgarsa vazifa o'zi bilan
   yangilanadi. Bo'sh bo'lsa vazifa mustaqil (shaxsiy reja).

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
     #task-form-modal (.modal-overlay)             → qo'shish/tahrirlash shakli
       [data-quick-add-event]                       → yangi vazifa uchun ochadi
       [data-task-form-cancel] / [data-task-form-save]
       #task-form-title-input / -date / -priority / -type / -course / -lesson
     #delete-task-modal                            → o'chirishni tasdiqlash
       [data-delete-task-cancel] / [data-delete-task-confirm]
       [data-delete-task-title]                     → o'chiriladigan vazifa nomi
     [data-ai-suggestion] [data-ai-suggestion-add] [data-ai-suggestion-reject]
       [data-ai-suggestion-text]                    → matn do'kondan tuziladi
     #task-count-total/-today/-overdue/-done, #task-progress-fill/-label
     .view-switch button[data-view="list|kanban"]
     .task-card [data-task-edit] / [data-task-delete] (.row-action buttons)
   ========================================================================== */

const ISLOH_TASKS_KEY = 'isloh_tasks';

/* Rang endi bu yerda emas, css/widgets.css dagi `.task-group-head .ic-*`
   qoidalarida — CLAUDE.md §2 inline stillarni taqiqlaydi */
const ISLOH_TASK_STATUS_META = {
  overdue:   { label: "Muddati o'tgan", icon: 'bi-exclamation-circle' },
  today:     { label: 'Bugun',          icon: 'bi-calendar-day' },
  upcoming:  { label: 'Kelgusi',        icon: 'bi-calendar-week' },
  completed: { label: 'Bajarilgan',     icon: 'bi-check2-circle' }
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

/* Namuna vazifalar. Kurs bilan bog'langanlari js/course-data.js dagi
   HAQIQIY kurs va dars id'lariga ishora qiladi — ilgari bu yerda
   loyihada mavjud bo'lmagan kurslar (Django, UI/UX) sanalgan edi. */
const ISLOH_SEED_COURSE = 'docker-for-beginners';

function isloh_seedTasks() {
  return [
    { id: 't1', title: "\"Docker image nima?\" darsini yakunlash", dueDate: isloh_offsetISO(0), dueTime: '16:00', category: 'Darslar', priority: 'high', type: 'lesson', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-images', isCompleted: false },
    { id: 't2', title: 'Birinchi Dockerfile amaliyotini bajarish', dueDate: isloh_offsetISO(0), dueTime: '18:00', category: 'Darslar', priority: 'medium', type: 'lesson', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-code', isCompleted: false },
    { id: 't3', title: 'Terminal buyruqlarini takrorlash', dueDate: isloh_offsetISO(0), dueTime: null, category: 'Shaxsiy', priority: 'low', type: 'personal', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-terminal', isCompleted: false },
    { id: 't4', title: "Amaliy topshiriqni yuborish", dueDate: isloh_offsetISO(-1), dueTime: null, category: 'Muddatlar', priority: 'high', type: 'deadline', courseId: ISLOH_SEED_COURSE, lessonId: '', isCompleted: false },
    { id: 't5', title: 'Loyiha hujjatlarini tayyorlash', dueDate: isloh_offsetISO(3), dueTime: null, category: 'Muddatlar', priority: 'medium', type: 'deadline', courseId: '', lessonId: '', isCompleted: false },
    { id: 't6', title: 'Bilimni tekshirish testiga tayyorgarlik', dueDate: isloh_offsetISO(7), dueTime: null, category: 'Imtihonlar', priority: 'high', type: 'exam', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-quiz1', isCompleted: false },
    { id: 't7', title: 'Kursga kirish darsi', dueDate: isloh_offsetISO(-6), dueTime: null, category: 'Darslar', priority: 'low', type: 'lesson', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-intro', isCompleted: true },
    { id: 't8', title: 'Muhitni sozlash', dueDate: isloh_offsetISO(-5), dueTime: null, category: 'Darslar', priority: 'medium', type: 'lesson', courseId: ISLOH_SEED_COURSE, lessonId: 'lesson-setup', isCompleted: true }
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
/* Kvota to'lganda istisno chiqmasin — chaqiruvchi false qaytganini ko'rib
   foydalanuvchini ogohlantiradi (notes-store.js / ai-store.js bilan bir xil
   naqsh). Ilgari setItem qo'riqlanmasdi va amal yarim yo'lda uzilardi. */
function isloh_saveTasks(tasks) {
  try {
    localStorage.setItem(ISLOH_TASKS_KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    if (typeof isloh_showToast === 'function') {
      isloh_showToast("Saqlab bo'lmadi — xotira to'lgan", 'error');
    }
    return false;
  }
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
  if (status === 'overdue') return `<span class="task-due-overdue"><i class="bi bi-clock-history"></i> ${isloh_overdueLabel(task)}</span>`;
  if (status === 'today') return `<span><i class="bi bi-clock"></i> Bugun${task.dueTime ? ' ' + task.dueTime : ''}</span>`;
  if (status === 'upcoming' && task.dueDate) return `<span><i class="bi bi-clock"></i> ${isloh_upcomingDaysLabel(task)}</span>`;
  return '';
}

/* MUHIM — foydalanuvchi kiritgan matn (sarlavha, turkum) HECH QACHON
   innerHTML orqali qo'yilmaydi. Ilgari `<img src=x onerror=...>` nomli
   vazifa haqiqiy element sifatida chizilib, kod ishga tushardi. Karkas
   HTML bo'lib qoladi, matn esa textContent bilan joylanadi — aynan
   js/course-player.js dagi naqsh. */
function isloh_taskPriorityHtml(task) {
  return `<span class="priority-badge priority-${task.priority}"><span class="priority-dot ${task.priority}"></span> ${ISLOH_PRIORITY_LABEL[task.priority]}</span>`;
}

/* Matnli span — ikona + xavfsiz matn */
function isloh_taskTextSpan(iconClass, text) {
  const span = document.createElement('span');
  if (iconClass) span.innerHTML = `<i class="bi ${iconClass}"></i> `;
  span.appendChild(document.createTextNode(text));
  return span;
}

/* Kursga bog'langan vazifada — pleerga olib boruvchi havola. Dars ham
   tanlangan bo'lsa uning nomi ko'rsatiladi. Nomlar do'kondan emas,
   js/course-data.js dan olinadi (vazifada faqat id saqlanadi). */
function isloh_taskCourseLink(task) {
  if (!task.courseId) return null;
  const course = isloh_taskCourse(task.courseId);
  if (!course) return null;

  const lesson = task.lessonId ? isloh_taskLesson(task.courseId, task.lessonId) : null;
  const link = document.createElement('a');
  link.className = 'task-course-link';
  link.href = 'course-player.html?id=' + encodeURIComponent(task.courseId);
  link.innerHTML = '<i class="bi bi-play-circle"></i> ';
  link.appendChild(document.createTextNode(lesson ? lesson.title : course.title));
  link.title = lesson ? course.title + ' · ' + lesson.title : course.title;
  return link;
}

function isloh_fillTaskMeta(metaEl, task, status) {
  metaEl.textContent = '';
  metaEl.insertAdjacentHTML('beforeend', isloh_taskPriorityHtml(task));
  if (task.category) metaEl.appendChild(isloh_taskTextSpan('bi-journal-bookmark', task.category));

  const courseLink = isloh_taskCourseLink(task);
  if (courseLink) metaEl.appendChild(courseLink);

  metaEl.insertAdjacentHTML('beforeend', isloh_taskDueLabel(task, status));
}

function isloh_taskCardEl(task) {
  const status = isloh_taskStatus(task);
  const done = task.isCompleted;

  const card = document.createElement('div');
  card.className = 'task-card' + (done ? ' done' : '');
  card.dataset.taskId = task.id;
  card.dataset.priority = task.priority;
  card.innerHTML = `
    <div class="task-check${done ? ' checked' : ''}" role="checkbox" aria-checked="${done}" tabindex="0">${done ? '<i class="bi bi-check-lg"></i>' : ''}</div>
    <div class="task-body">
      <div class="task-title"></div>
      <div class="task-meta"></div>
    </div>
    <div class="row-actions">
      <button type="button" class="row-action" data-task-edit aria-label="Tahrirlash"><i class="bi bi-pencil"></i></button>
      <button type="button" class="row-action" data-task-delete aria-label="O'chirish"><i class="bi bi-trash"></i></button>
    </div>`;

  card.querySelector('.task-title').textContent = task.title;
  isloh_fillTaskMeta(card.querySelector('.task-meta'), task, status);
  return card;
}

function isloh_kanbanCardEl(task) {
  const status = isloh_taskStatus(task);
  let right = '';
  if (status === 'completed') right = '<span class="text-green"><i class="bi bi-check-lg"></i></span>';
  else if (status === 'overdue') right = `<span class="task-due-overdue">${isloh_overdueLabel(task)}</span>`;
  else if (status === 'today') right = `<span>${task.dueTime || 'Bugun'}</span>`;
  else right = `<span>${isloh_upcomingDaysLabel(task)}</span>`;

  /* Tugma, `div` emas: kartochka bosilganda vazifa holati o'zgaradi, ya'ni
     u haqiqiy boshqaruv elementi — klaviaturadan ham ishlashi kerak.
     Sudralish yo'q, shuning uchun CSS'dagi `cursor:grab` ham olib tashlandi. */
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'kanban-card';
  card.dataset.taskId = task.id;
  card.setAttribute('aria-label',
    task.title + (task.isCompleted ? ' — qayta ochish' : " — bajarildi deb belgilash"));
  card.innerHTML = `
    <div class="kanban-card-title"></div>
    <div class="kanban-card-meta">${isloh_taskPriorityHtml(task)}${right}</div>`;
  card.querySelector('.kanban-card-title').textContent = task.title;
  return card;
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

/* Guruh karkasi bitta joyda — to'liq qayta chizish ham, bitta kartochkani
   ko'chirish ham (isloh_ensureGroupEl) shu funksiyani ishlatadi */
function isloh_buildGroupEl(status) {
  const meta = ISLOH_TASK_STATUS_META[status];
  const group = document.createElement('div');
  group.className = 'task-group';
  group.dataset.taskGroup = status;
  group.innerHTML = `
    <div class="task-group-head"><i class="bi ${meta.icon} ic-${status}"></i> ${meta.label} <span class="grp-count">0</span></div>
    <div class="task-group-body"></div>`;
  return group;
}

// --- List view (full rebuild — used for initial load, filter/search changes) ---
function isloh_renderTasks() {
  const mount = document.querySelector('[data-task-list]');
  if (!mount) return;

  const tasks = isloh_getTasks();
  const buckets = isloh_bucketTasks(tasks, true);

  mount.textContent = '';
  ISLOH_TASK_GROUP_ORDER.forEach((status) => {
    const items = buckets[status];
    if (!items.length) return;

    const group = isloh_buildGroupEl(status);
    const body = group.querySelector('.task-group-body');
    items.forEach((t) => body.appendChild(isloh_taskCardEl(t)));
    group.querySelector('.grp-count').textContent = items.length;
    mount.appendChild(group);
  });
  isloh_syncEmptyState();
  isloh_updateTaskStats(tasks);
}

function isloh_syncEmptyState() {
  const mount = document.querySelector('[data-task-list]');
  const empty = document.querySelector('[data-tasks-empty]');
  if (!mount || !empty) return;
  // `hidden` atributi — css/base.css dagi umumiy qoida zimmasida (inline style emas)
  empty.hidden = mount.children.length > 0;
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

/* --- Kanban view -----------------------------------------------------------
   Muhimlik filtri Kanban'da ham qo'llanadi. Ilgari filtr faqat ro'yxatga
   ta'sir qilardi: "Yuqori" tanlab Kanban'ga o'tilsa, filtr chipi faol
   ko'rinib turgani holda hamma vazifalar qaytib chiqardi. */
function isloh_renderKanban() {
  const board = document.querySelector('[data-kanban-board]');
  if (!board) return;

  const tasks = isloh_getTasks();
  const buckets = isloh_bucketTasks(tasks, true);

  board.textContent = '';
  ISLOH_TASK_GROUP_ORDER.forEach((status) => {
    const meta = ISLOH_TASK_STATUS_META[status];
    const items = buckets[status];

    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.dataset.kanbanCol = status;
    col.innerHTML = `<div class="kanban-col-head">${meta.label} <span class="kanban-count">${items.length}</span></div>`;

    if (items.length) items.forEach((t) => col.appendChild(isloh_kanbanCardEl(t)));
    else col.insertAdjacentHTML('beforeend', `<div class="kanban-empty">Bo'sh</div>`);

    board.appendChild(col);
  });
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

  group = isloh_buildGroupEl(status);

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
  if (metaEl) isloh_fillTaskMeta(metaEl, task, status);
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

/* --- O'chirish: avval tasdiqlash ------------------------------------------
   Ilgari o'chirish tugmasi darhol ishlardi — bitta tasodifiy bosish
   qaytarilmas edi. Endi tasdiqlash modali oraliqda turadi; modal yo'q
   sahifada brauzer confirm'i zaxira sifatida ishlaydi. */
let isloh_pendingDeleteTaskId = null;

function isloh_requestDeleteTask(id) {
  const overlay = document.getElementById('delete-task-modal');
  const task = isloh_getTasks().find((t) => t.id === id);
  if (!task) return;

  if (!overlay || typeof isloh_openModal !== 'function') {
    if (window.confirm(`"${task.title}" vazifasi o'chirilsinmi?`)) isloh_deleteTaskById(id);
    return;
  }

  isloh_pendingDeleteTaskId = id;
  const titleEl = overlay.querySelector('[data-delete-task-title]');
  if (titleEl) titleEl.textContent = task.title;
  isloh_openModal('delete-task-modal');
}

function isloh_initDeleteTaskModal() {
  const overlay = document.getElementById('delete-task-modal');
  if (!overlay) return;

  overlay.querySelectorAll('[data-delete-task-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      isloh_pendingDeleteTaskId = null;
      if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-task-modal');
    });
  });

  overlay.querySelector('[data-delete-task-confirm]')?.addEventListener('click', () => {
    const id = isloh_pendingDeleteTaskId;
    isloh_pendingDeleteTaskId = null;
    if (typeof isloh_closeModal === 'function') isloh_closeModal('delete-task-modal');
    if (id) isloh_deleteTaskById(id);
  });
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

/* --- Vazifa shakli: qo'shish va tahrirlash bitta modalda ------------------
   Ilgari qo'shish modal orqali, tahrirlash esa window.prompt() orqali edi
   va faqat sarlavhani o'zgartira olardi. Endi ikkalasi bitta shaklda:
   sarlavha, muddat, muhimlik va turkum. Turkum kalendar rangini va o'ng
   paneldagi "Turkumlar" afsonasini boshqaradi — ilgari foydalanuvchi uni
   umuman tanlay olmasdi (har doim "personal" qo'yilardi). */
const ISLOH_TASK_TYPE_CATEGORY = {
  lesson: 'Darslar', deadline: 'Muddatlar', exam: 'Imtihonlar', personal: 'Shaxsiy'
};

let isloh_taskFormMode = 'add';
let isloh_taskFormId = null;

function isloh_taskFormEls() {
  return {
    overlay: document.getElementById('task-form-modal'),
    heading: document.getElementById('task-form-title'),
    title: document.getElementById('task-form-title-input'),
    date: document.getElementById('task-form-date'),
    priority: document.getElementById('task-form-priority'),
    type: document.getElementById('task-form-type'),
    course: document.getElementById('task-form-course'),
    lesson: document.getElementById('task-form-lesson')
  };
}

/* --- Kurs/dars bog'lanishi ------------------------------------------------
   Ma'lumot manbai — js/course-data.js (ISLOH_COURSE_DATA). Vazifa faqat
   id saqlaydi, nom emas: kurs nomi o'zgarsa vazifa ham o'zi bilan
   yangilanadi va ma'lumot ikki joyda takrorlanmaydi. */
function isloh_taskCourses() {
  return (typeof ISLOH_COURSE_DATA === 'object' && ISLOH_COURSE_DATA) ? ISLOH_COURSE_DATA : {};
}

function isloh_taskCourse(courseId) {
  return isloh_taskCourses()[courseId] || null;
}

function isloh_taskLesson(courseId, lessonId) {
  const course = isloh_taskCourse(courseId);
  if (!course) return null;
  for (const module of course.modules || []) {
    const found = (module.lessons || []).find((l) => l.id === lessonId);
    if (found) return found;
  }
  return null;
}

function isloh_fillCourseSelect(select, courseId) {
  const courses = isloh_taskCourses();
  select.innerHTML = '<option value="">— Bog\'lanmagan —</option>';
  Object.keys(courses).forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = courses[id].title;
    select.appendChild(opt);
  });
  select.value = courseId || '';
}

/* Dars ro'yxati tanlangan kursga bog'liq; kurs tanlanmagan bo'lsa o'chiq */
function isloh_fillLessonSelect(select, courseId, lessonId) {
  const course = isloh_taskCourse(courseId);
  select.innerHTML = '<option value="">— Butun kurs —</option>';
  select.disabled = !course;

  (course ? course.modules || [] : []).forEach((module) => {
    const group = document.createElement('optgroup');
    group.label = module.title;
    (module.lessons || []).forEach((lesson) => {
      const opt = document.createElement('option');
      opt.value = lesson.id;
      opt.textContent = lesson.title;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
  select.value = lessonId || '';
}

/* `mode` — 'add' | 'edit'. 'add' uchun preset {dueDate} berilishi mumkin
   (kalendar katakchasi bosilganda o'sha sana qo'yiladi). */
function isloh_openTaskForm(mode, preset) {
  const els = isloh_taskFormEls();
  if (!els.overlay || typeof isloh_openModal !== 'function') return;

  const task = mode === 'edit' ? isloh_getTasks().find((t) => t.id === (preset && preset.id)) : null;
  if (mode === 'edit' && !task) return;

  isloh_taskFormMode = mode;
  isloh_taskFormId = task ? task.id : null;

  els.heading.textContent = mode === 'edit' ? 'Vazifani tahrirlash' : "Yangi vazifa qo'shish";
  els.title.value = task ? task.title : '';
  els.date.value = task ? (task.dueDate || '') : ((preset && preset.dueDate) || isloh_todayISO());
  els.priority.value = task ? task.priority : 'medium';
  els.type.value = task ? (task.type || 'personal') : 'personal';

  if (els.course && els.lesson) {
    isloh_fillCourseSelect(els.course, task ? task.courseId : (preset && preset.courseId));
    isloh_fillLessonSelect(els.lesson, els.course.value, task ? task.lessonId : '');
  }

  isloh_openModal('task-form-modal');
  els.title.focus();
}

function isloh_saveTaskForm() {
  const els = isloh_taskFormEls();
  const title = (els.title?.value || '').trim();
  if (!title) { els.title?.focus(); return; }

  const tasks = isloh_getTasks();
  const type = els.type.value;
  const isEdit = isloh_taskFormMode === 'edit';
  const courseId = els.course ? els.course.value : '';
  const lessonId = (els.lesson && courseId) ? els.lesson.value : '';

  if (isEdit) {
    const task = tasks.find((t) => t.id === isloh_taskFormId);
    if (!task) return;
    task.title = title;
    task.dueDate = els.date.value || null;
    task.priority = els.priority.value;
    task.type = type;
    task.category = ISLOH_TASK_TYPE_CATEGORY[type];
    task.courseId = courseId;
    task.lessonId = lessonId;
  } else {
    tasks.unshift({
      id: 'task-' + Date.now(),
      title,
      dueDate: els.date.value || isloh_todayISO(),
      dueTime: null,
      category: ISLOH_TASK_TYPE_CATEGORY[type],
      priority: els.priority.value,
      type,
      courseId,
      lessonId,
      isCompleted: false
    });
  }

  if (!isloh_saveTasks(tasks)) return;   // kvota xatosi — toast saqlovchida

  isloh_taskFormId = null;
  isloh_renderTasks();
  isloh_syncSecondaryViews();
  if (typeof isloh_closeModal === 'function') isloh_closeModal('task-form-modal');
  if (typeof isloh_showToast === 'function') {
    isloh_showToast(isEdit ? 'Vazifa yangilandi' : "Vazifa qo'shildi", 'success');
  }
}

/* --- AI tavsiya kartochkasi ----------------------------------------------
   Matn endi qattiq kodlanmagan: birinchi yakunlanmagan darsdan tuziladi,
   ya'ni haqiqiy kursga ishora qiladi (ilgari loyihada yo'q "Django kursi"
   haqida yozilardi). */
function isloh_aiSuggestedLesson() {
  const linkedIds = isloh_getTasks().filter((t) => t.lessonId).map((t) => t.lessonId);
  const course = isloh_taskCourse(ISLOH_SEED_COURSE) || isloh_taskCourses()[Object.keys(isloh_taskCourses())[0]];
  if (!course) return null;

  for (const module of course.modules || []) {
    for (const lesson of module.lessons || []) {
      if (!lesson.done && !linkedIds.includes(lesson.id)) return { course, lesson };
    }
  }
  return null;
}

function isloh_initAiSuggestion() {
  const card = document.querySelector('[data-ai-suggestion]');
  if (!card) return;

  const suggestion = isloh_aiSuggestedLesson();
  if (!suggestion) { card.remove(); return; }

  const textEl = card.querySelector('[data-ai-suggestion-text]');
  if (textEl) {
    textEl.textContent = `"${suggestion.course.title}" kursida davom eting — keyingi qadam: "${suggestion.lesson.title}".`;
  }

  const addBtn = card.querySelector('[data-ai-suggestion-add]');
  const rejectBtn = card.querySelector('[data-ai-suggestion-reject]');

  if (addBtn) addBtn.addEventListener('click', () => {
    const tasks = isloh_getTasks();
    tasks.unshift({
      id: 'task-' + Date.now(),
      title: suggestion.lesson.title,
      dueDate: isloh_todayISO(),
      dueTime: null,
      category: ISLOH_TASK_TYPE_CATEGORY.lesson,
      priority: 'medium',
      type: 'lesson',
      courseId: suggestion.course.id,
      lessonId: suggestion.lesson.id,
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
      document.querySelectorAll('[data-priority-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      isloh_renderTasks();
      isloh_renderKanban();   // filtr ikkala ko'rinishga ham qo'llanadi
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
      switchWrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      document.querySelectorAll('[data-task-view-panel]').forEach((p) => {
        p.hidden = p.dataset.taskViewPanel !== btn.dataset.view;
      });
      if (btn.dataset.view === 'kanban') isloh_renderKanban();
    });
  });
}

function isloh_initTaskFormModal() {
  document.querySelectorAll('[data-quick-add-event]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_openTaskForm('add'));
  });

  const overlay = document.getElementById('task-form-modal');
  if (!overlay) return;

  overlay.querySelectorAll('[data-task-form-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      isloh_taskFormId = null;
      if (typeof isloh_closeModal === 'function') isloh_closeModal('task-form-modal');
    });
  });
  overlay.querySelector('[data-task-form-save]')?.addEventListener('click', isloh_saveTaskForm);

  // Kurs almashsa — dars ro'yxati o'sha kursnikiga qayta chiziladi
  document.getElementById('task-form-course')?.addEventListener('change', (e) => {
    const lessonSelect = document.getElementById('task-form-lesson');
    if (lessonSelect) isloh_fillLessonSelect(lessonSelect, e.target.value, '');
  });

  // Enter bilan saqlash — sarlavha maydonida
  document.getElementById('task-form-title-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); isloh_saveTaskForm(); }
  });
}

/* Kalendardagi tadbir bosilganda: ro'yxat ko'rinishiga qaytadi, kerak
   bo'lsa filtrni tozalaydi (aks holda vazifa yashiringan bo'lishi mumkin)
   va kartochkani ko'rinish maydoniga surib, qisqa vaqt ajratib turadi. */
function isloh_focusTaskInList(taskId) {
  const task = isloh_getTasks().find((t) => t.id === taskId);
  if (!task) return;

  const listBtn = document.querySelector('.view-switch button[data-view="list"]');
  if (listBtn && !listBtn.classList.contains('active')) listBtn.click();

  const prio = isloh_activeFilterValue('[data-priority-filter]', 'priorityFilter');
  if (prio !== 'all' && prio !== task.priority) {
    document.querySelector('[data-priority-filter="all"]')?.click();
  }

  const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (!card) return;
  card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  card.classList.add('is-flash');
  setTimeout(() => card.classList.remove('is-flash'), 1600);
}

function isloh_initTasks() {
  const mount = document.querySelector('[data-task-list]');
  if (mount) {
    mount.addEventListener('click', (e) => {
      const card = e.target.closest('[data-task-id]');
      if (!card) return;
      if (e.target.closest('[data-task-edit]')) { isloh_openTaskForm('edit', { id: card.dataset.taskId }); return; }
      if (e.target.closest('[data-task-delete]')) { isloh_requestDeleteTask(card.dataset.taskId); return; }
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
  isloh_initTaskFormModal();
  isloh_initDeleteTaskModal();
  isloh_initAiSuggestion();

  isloh_renderTasks();
  isloh_renderKanban();
}

document.addEventListener('DOMContentLoaded', isloh_initTasks);
