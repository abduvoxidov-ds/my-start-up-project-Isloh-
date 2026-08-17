/* ==========================================================================
   ISLOH — Kurs tarkibi do'koni (modullar va darslar)

   M2 da SERVERGA ulandi. Ilgari butun daraxt `isloh_course_content`
   kalitida yotardi va har o'zgarishda to'liq qayta yozilardi; endi manba —
   API, `localStorage` esa faqat offline nusxa (CLAUDE.md §3 — `file://`
   ostida API yo'q).

   NEGA UMUMIY FABRIKA (js/api.js) ISHLATILMADI: fabrika BITTA endpoint va
   yassi massiv ustida ishlaydi. Tarkib esa kurs bo'yicha bo'lingan
   (`{ courseId: modules[] }`) va har amal o'z manziliga boradi:
     modul qo'shish  -> POST   /instructor/courses/{id}/modules
     modul tahriri   -> PATCH  /instructor/modules/{id}
     modul nusxasi   -> POST   /instructor/modules/{id}/duplicate
     tartib          -> POST   .../modules/reorder
     dars qo'shish   -> POST   /instructor/modules/{id}/lessons
     dars tahriri    -> PATCH  /instructor/lessons/{id}
   Shu sababli bu yerda o'sha naqshning kurs bo'yicha bo'lingan varianti
   qo'lda yozilgan: sinxron o'qish + optimistik yozish + rollback.

   Do'kon shakli (o'zgarmadi — 5 ta modul shunga tayanadi):
     { "<courseId>": [ { id, title, desc, status, lessons: [
         { id, title, type, duration, visibility, status } ] } ] }
   ========================================================================== */

const ISLOH_CONTENT_KEY = 'isloh_course_content';

const ISLOH_LESSON_TYPE_META = {
  video:      { icon: 'bi-play-circle-fill',        bg: 'linear-gradient(135deg,#0EA5E9,#0369A1)', label: 'Video' },
  article:    { icon: 'bi-file-text-fill',          bg: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', label: 'Maqola' },
  quiz:       { icon: 'bi-patch-question-fill',     bg: 'linear-gradient(135deg,#F59E0B,#D97706)', label: 'Test' },
  assignment: { icon: 'bi-file-earmark-text-fill',  bg: 'linear-gradient(135deg,#EA580C,#C2410C)', label: 'Topshiriq' },
  resource:   { icon: 'bi-paperclip',               bg: 'linear-gradient(135deg,#059669,#10B981)', label: 'Resurs' }
};

function isloh_lessonTypeMeta(type) {
  return ISLOH_LESSON_TYPE_META[type] || ISLOH_LESSON_TYPE_META.video;
}

/* Demo tarkib — faqat `file://` va tarmoq uzilganda ko'rinadi. */
const ISLOH_CONTENT_SEED = {
  'py-101': [
    {
      id: 'mod-1', title: 'Kirish va sozlash', status: 'published',
      desc: "Docker, Git va muhitni sozlash bo'yicha boshlang'ich modul.",
      lessons: [
        { id: 'les-1', title: 'Kursga kirish', type: 'video', duration: '8 daq', visibility: 'public', status: 'published' },
        { id: 'les-2', title: 'Muhitni sozlash (VS Code, Git, Docker)', type: 'article', duration: '12 daq', visibility: 'public', status: 'published' },
        { id: 'les-3', title: 'Terminal buyruqlari asoslari', type: 'video', duration: '15 daq', visibility: 'public', status: 'published' },
        { id: 'les-4', title: 'Docker cheat sheet (PDF)', type: 'resource', duration: '—', visibility: 'public', status: 'published' },
        { id: 'les-5', title: 'Bilimni tekshirish: 1-modul', type: 'quiz', duration: '5 daq', visibility: 'hidden', status: 'draft' },
        { id: 'les-6', title: 'Amaliy topshiriq: muhitni sozlash', type: 'assignment', duration: '—', visibility: 'public', status: 'published' }
      ]
    },
    {
      id: 'mod-2', title: 'Python asoslari', status: 'published',
      desc: "O'zgaruvchilar, funksiyalar va OOP asoslari.",
      lessons: [
        { id: 'les-7', title: "O'zgaruvchilar va turlar", type: 'video', duration: '14 daq', visibility: 'public', status: 'published' },
        { id: 'les-8', title: 'Funksiyalar', type: 'video', duration: '18 daq', visibility: 'public', status: 'published' },
        { id: 'les-9', title: 'OOP asoslari', type: 'article', duration: '20 daq', visibility: 'public', status: 'published' }
      ]
    },
    {
      id: 'mod-3', title: 'Django va DRF', status: 'published',
      desc: 'Modellar, serializerlar va REST API yaratish.',
      lessons: [
        { id: 'les-10', title: 'Django modellari', type: 'video', duration: '22 daq', visibility: 'public', status: 'published' },
        { id: 'les-11', title: 'DRF serializerlari', type: 'video', duration: '25 daq', visibility: 'public', status: 'published' }
      ]
    },
    {
      id: 'mod-4', title: 'Deployment va DevOps', status: 'draft',
      desc: "Docker, CI/CD va production'ga chiqarish.",
      lessons: [
        { id: 'les-12', title: 'Docker Compose', type: 'video', duration: '16 daq', visibility: 'hidden', status: 'draft' }
      ]
    }
  ]
};

/* --- Shakl o'girish (API <-> frontend) ------------------------------------
   Yagona farq: serverda `description`, frontendda `desc`. Nomni frontendda
   o'zgartirish 5 ta modulga tegardi, shuning uchun o'girish shu yerda. */

function isloh_moduleFromServer(row) {
  return {
    id: row.id,
    title: row.title,
    desc: row.description || '',
    status: row.status,
    lessons: (row.lessons || []).map(isloh_lessonFromServer)
  };
}

function isloh_lessonFromServer(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    duration: row.duration,
    visibility: row.visibility,
    status: row.status
  };
}

/* Faqat berilgan maydonlar yuboriladi — PATCH qisman yangilaydi */
function isloh_moduleToServer(patch) {
  const body = {};
  if ('title' in patch) body.title = patch.title;
  if ('desc' in patch) body.description = patch.desc;
  if ('status' in patch) body.status = patch.status;
  return body;
}

function isloh_lessonToServer(patch) {
  const body = {};
  ['title', 'type', 'duration', 'visibility', 'status'].forEach((f) => {
    if (f in patch) body[f] = patch[f];
  });
  return body;
}

/* --- Kesh ----------------------------------------------------------------- */

const ISLOH_CONTENT_CACHE = {};   // courseId -> modules[]
const ISLOH_CONTENT_LOADED = {};  // courseId -> true
const ISLOH_CONTENT_LOADING = {}; // courseId -> promise

function isloh_readContentCopy() {
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_CONTENT_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch (e) {
    return {};
  }
}

function isloh_writeContentCopy() {
  try {
    localStorage.setItem(ISLOH_CONTENT_KEY, JSON.stringify(ISLOH_CONTENT_CACHE));
  } catch (e) { /* kvota */ }
}

/* Offline nusxa; yo'q bo'lsa demo. Do'kon fabrikasidagi bilan bir xil
   qoida: bu yerda localStorage'ga YOZILMAYDI, aks holda demo yozuvlar
   backend ulanganda serverga ketib qolardi. */
function isloh_contentFallback(courseId) {
  const stored = isloh_readContentCopy();
  if (Array.isArray(stored[courseId])) return stored[courseId];
  const seed = ISLOH_CONTENT_SEED[courseId];
  return seed ? JSON.parse(JSON.stringify(seed)) : [];
}

function isloh_emitContent(courseId) {
  document.dispatchEvent(new CustomEvent('isloh:content-updated', {
    detail: { courseId: courseId, modules: ISLOH_CONTENT_CACHE[courseId] || [] }
  }));
}

function isloh_loadContent(courseId) {
  if (ISLOH_CONTENT_LOADING[courseId]) return ISLOH_CONTENT_LOADING[courseId];

  ISLOH_CONTENT_LOADING[courseId] = islohApi
    .get('/instructor/courses/' + encodeURIComponent(courseId) + '/modules')
    .then((rows) => {
      ISLOH_CONTENT_CACHE[courseId] = (rows || []).map(isloh_moduleFromServer);
      isloh_writeContentCopy();
    })
    .catch((err) => {
      ISLOH_CONTENT_CACHE[courseId] = isloh_contentFallback(courseId);
      if (err && err.code !== 'file_protocol' && typeof islohUI !== 'undefined') {
        islohUI.showNetworkError(() => {
          ISLOH_CONTENT_LOADING[courseId] = null;
          ISLOH_CONTENT_LOADED[courseId] = false;
          return isloh_loadContent(courseId);
        }, err.error);
      }
    })
    .then(() => {
      ISLOH_CONTENT_LOADED[courseId] = true;
      isloh_emitContent(courseId);
      return ISLOH_CONTENT_CACHE[courseId];
    });

  return ISLOH_CONTENT_LOADING[courseId];
}

/* SINXRON — sahifalar shuni chaqiradi (5 ta modul). Kesh bo'sh bo'lsa
   zaxira qaytariladi va yuklash fonda boshlanadi; tugagach
   `isloh:content-updated` keladi va sahifa o'zini qayta chizadi. */
function isloh_getModules(courseId) {
  if (!courseId) return [];
  if (!ISLOH_CONTENT_LOADED[courseId]) {
    if (!ISLOH_CONTENT_CACHE[courseId]) ISLOH_CONTENT_CACHE[courseId] = isloh_contentFallback(courseId);
    isloh_loadContent(courseId);
  }
  return ISLOH_CONTENT_CACHE[courseId] || [];
}

function isloh_getModule(courseId, moduleId) {
  return isloh_getModules(courseId).find((m) => m.id === moduleId) || null;
}

function isloh_getLessons(courseId, moduleId) {
  const module = isloh_getModule(courseId, moduleId);
  return module && Array.isArray(module.lessons) ? module.lessons : [];
}

function isloh_countLessons(courseId, modules) {
  const list = modules || isloh_getModules(courseId);
  return list.reduce((sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0);
}

/* --- Yozish yordamchilari -------------------------------------------------- */

/* Vaqtinchalik id — server javobida o'z id'siga almashadi (do'kon
   fabrikasidagi bilan bir xil naqsh). */
function isloh_tempId(prefix) {
  return prefix + '-yangi-' + Date.now().toString(36);
}

function isloh_contentChanged(courseId) {
  isloh_writeContentCopy();
  isloh_emitContent(courseId);
  /* Kurs kartochkasidagi "N dars" endi SERVERDA hisoblanadi
     (`lessons_count`) — kurs yozuvi qaytadan o'qiladi. */
  if (typeof isloh_refreshCourses === 'function') isloh_refreshCourses();
}

/* Xato bo'lsa keshni so'rovdan OLDINGI holatiga qaytaradi. Nusxa chuqur:
   dars ro'yxati ham o'zgargan bo'lishi mumkin. */
function isloh_contentSnapshot(courseId) {
  return JSON.parse(JSON.stringify(ISLOH_CONTENT_CACHE[courseId] || []));
}

function isloh_contentRollback(courseId, snapshot, err) {
  ISLOH_CONTENT_CACHE[courseId] = snapshot;
  isloh_writeContentCopy();
  isloh_emitContent(courseId);
  if (typeof islohUI !== 'undefined') islohUI.toast((err && err.error) || "Saqlab bo'lmadi", 'error');
}

/* --- Modul amallari ------------------------------------------------------- */

function isloh_saveModule(courseId, patch) {
  const modules = isloh_getModules(courseId);
  const data = patch || {};
  const snapshot = isloh_contentSnapshot(courseId);
  const index = data.id ? modules.findIndex((m) => m.id === data.id) : -1;

  if (index === -1) {
    const module = Object.assign({ title: 'Yangi modul', desc: '', status: 'draft', lessons: [] }, data);
    module.id = isloh_tempId('mod');
    modules.push(module);
    isloh_contentChanged(courseId);

    islohApi.post('/instructor/courses/' + encodeURIComponent(courseId) + '/modules', isloh_moduleToServer(module))
      .then((row) => {
        const at = modules.findIndex((m) => m.id === module.id);
        if (at !== -1) modules[at] = isloh_moduleFromServer(row);
        isloh_contentChanged(courseId);
      })
      .catch((err) => isloh_contentRollback(courseId, snapshot, err));

    return module;
  }

  modules[index] = Object.assign({}, modules[index], data);
  isloh_contentChanged(courseId);

  islohApi.patch('/instructor/modules/' + encodeURIComponent(modules[index].id), isloh_moduleToServer(data))
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));

  return modules[index];
}

function isloh_deleteModule(courseId, moduleId) {
  const modules = isloh_getModules(courseId);
  const snapshot = isloh_contentSnapshot(courseId);
  const index = modules.findIndex((m) => m.id === moduleId);
  if (index === -1) return false;

  modules.splice(index, 1);
  isloh_contentChanged(courseId);

  islohApi.delete('/instructor/modules/' + encodeURIComponent(moduleId))
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));
  return true;
}

function isloh_duplicateModule(courseId, moduleId) {
  const modules = isloh_getModules(courseId);
  const snapshot = isloh_contentSnapshot(courseId);
  const index = modules.findIndex((m) => m.id === moduleId);
  if (index === -1) return null;

  /* Nusxa serverda yasaladi (darslari bilan, bitta tranzaksiyada) — bu
     yerda faqat optimistik ko'rinish. */
  const copy = JSON.parse(JSON.stringify(modules[index]));
  copy.id = isloh_tempId('mod');
  copy.title += ' (nusxa)';
  copy.status = 'draft';
  copy.lessons = (copy.lessons || []).map((l, i) => Object.assign({}, l, { id: isloh_tempId('les') + '-' + i }));
  modules.splice(index + 1, 0, copy);
  isloh_contentChanged(courseId);

  islohApi.post('/instructor/modules/' + encodeURIComponent(moduleId) + '/duplicate', {})
    .then((row) => {
      const at = modules.findIndex((m) => m.id === copy.id);
      if (at !== -1) modules[at] = isloh_moduleFromServer(row);
      isloh_contentChanged(courseId);
    })
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));

  return copy;
}

/* ID tartibiga qarab qayta joylashtiradi (js/sortable.js dan keyin). */
function isloh_reorderModules(courseId, ids) {
  const modules = isloh_getModules(courseId);
  const snapshot = isloh_contentSnapshot(courseId);

  const byId = {};
  modules.forEach((m) => { byId[m.id] = m; });
  const ordered = ids.map((id) => byId[id]).filter(Boolean);
  // Ro'yxatda bo'lmagan modul yo'qolib qolmasin
  modules.forEach((m) => { if (ordered.indexOf(m) === -1) ordered.push(m); });

  ISLOH_CONTENT_CACHE[courseId] = ordered;
  isloh_contentChanged(courseId);

  islohApi.post('/instructor/courses/' + encodeURIComponent(courseId) + '/modules/reorder', { ids: ordered.map((m) => m.id) })
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));
  return true;
}

/* --- Dars amallari -------------------------------------------------------- */

function isloh_saveLesson(courseId, moduleId, patch) {
  const module = isloh_getModule(courseId, moduleId);
  if (!module) return null;

  const snapshot = isloh_contentSnapshot(courseId);
  const data = patch || {};
  const index = data.id ? module.lessons.findIndex((l) => l.id === data.id) : -1;

  if (index === -1) {
    const lesson = Object.assign(
      { title: 'Yangi dars', type: 'video', duration: '—', visibility: 'public', status: 'draft' },
      data
    );
    lesson.id = isloh_tempId('les');
    module.lessons.push(lesson);
    isloh_contentChanged(courseId);

    islohApi.post('/instructor/modules/' + encodeURIComponent(moduleId) + '/lessons', isloh_lessonToServer(lesson))
      .then((row) => {
        const at = module.lessons.findIndex((l) => l.id === lesson.id);
        if (at !== -1) module.lessons[at] = isloh_lessonFromServer(row);
        isloh_contentChanged(courseId);
      })
      .catch((err) => isloh_contentRollback(courseId, snapshot, err));

    return lesson;
  }

  module.lessons[index] = Object.assign({}, module.lessons[index], data);
  isloh_contentChanged(courseId);

  islohApi.patch('/instructor/lessons/' + encodeURIComponent(module.lessons[index].id), isloh_lessonToServer(data))
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));

  return module.lessons[index];
}

function isloh_deleteLesson(courseId, moduleId, lessonId) {
  const module = isloh_getModule(courseId, moduleId);
  if (!module) return null;

  const snapshot = isloh_contentSnapshot(courseId);
  module.lessons = module.lessons.filter((l) => l.id !== lessonId);
  isloh_contentChanged(courseId);

  islohApi.delete('/instructor/lessons/' + encodeURIComponent(lessonId))
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));
  return true;
}

function isloh_duplicateLesson(courseId, moduleId, lessonId) {
  const module = isloh_getModule(courseId, moduleId);
  if (!module) return null;

  const snapshot = isloh_contentSnapshot(courseId);
  const index = module.lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;

  const copy = Object.assign({}, module.lessons[index]);
  copy.id = isloh_tempId('les');
  copy.title += ' (nusxa)';
  module.lessons.splice(index + 1, 0, copy);
  isloh_contentChanged(courseId);

  islohApi.post('/instructor/lessons/' + encodeURIComponent(lessonId) + '/duplicate', {})
    .then((row) => {
      const at = module.lessons.findIndex((l) => l.id === copy.id);
      if (at !== -1) module.lessons[at] = isloh_lessonFromServer(row);
      isloh_contentChanged(courseId);
    })
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));

  return copy;
}

function isloh_reorderLessons(courseId, moduleId, ids) {
  const module = isloh_getModule(courseId, moduleId);
  if (!module) return null;

  const snapshot = isloh_contentSnapshot(courseId);
  const byId = {};
  module.lessons.forEach((l) => { byId[l.id] = l; });
  const ordered = ids.map((id) => byId[id]).filter(Boolean);
  module.lessons.forEach((l) => { if (ordered.indexOf(l) === -1) ordered.push(l); });
  module.lessons = ordered;
  isloh_contentChanged(courseId);

  islohApi.post('/instructor/modules/' + encodeURIComponent(moduleId) + '/lessons/reorder', { ids: ordered.map((l) => l.id) })
    .catch((err) => isloh_contentRollback(courseId, snapshot, err));
  return true;
}
