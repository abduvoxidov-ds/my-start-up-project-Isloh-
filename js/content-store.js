/* ==========================================================================
   ISLOH — Kurs tarkibi do'koni (modullar va darslar)
   `isloh_course_content` kaliti: kurs ID'si bo'yicha modullar, har bir
   modul ichida darslar.

   NEGA: js/course-store.js kursning o'zini saqlaydi, lekin uning TARKIBI
   hali ham faqat DOM'da yashardi — "Modul qo'shish" yoki "Dars qo'shish"
   bosilganda kartochka ekranda paydo bo'lardi va sahifa yangilanishi
   bilan yo'qolardi. Kursning "dars soni" ham qo'lda yozilgan raqam edi.

   Do'kon shakli:
     { "<courseId>": { modules: [
         { id, title, desc, status, lessons: [
             { id, title, type, duration, visibility, status } ] } ] } }

   Dars turi jadvali ham shu yerda: uni ham modul ro'yxati (oldindan
   ko'rish), ham darslar ro'yxati ishlatadi — ilgari faqat
   js/lesson-builder.js da edi va course-builder unga yeta olmasdi.
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

/* Demo tarkib — ilgari course-builder.html va lesson-builder.html ichiga
   qo'lda yozilgan modullar/darslar. Faqat `py-101` uchun, chunki markupdagi
   namuna ham shu kursniki edi. */
const ISLOH_CONTENT_SEED = {
  'py-101': {
    modules: [
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
  }
};

/* --- Do'kon --------------------------------------------------------------- */

function isloh_readContent() {
  try {
    const stored = JSON.parse(localStorage.getItem(ISLOH_CONTENT_KEY));
    return stored && typeof stored === 'object' ? stored : null;
  } catch (e) {
    return null;
  }
}

function isloh_persistContent(all) {
  try {
    localStorage.setItem(ISLOH_CONTENT_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

/* Barcha kurslar tarkibi. Birinchi o'qishda demo tarkib ekiladi. */
function isloh_getAllContent() {
  const stored = isloh_readContent();
  if (stored) return stored;
  const seed = JSON.parse(JSON.stringify(ISLOH_CONTENT_SEED));
  isloh_persistContent(seed);
  return seed;
}

/* Bitta kurs tarkibi. Kurs uchun yozuv bo'lmasa bo'sh ro'yxat qaytadi —
   yangi yaratilgan kursda tabiiy holat. */
function isloh_getModules(courseId) {
  const all = isloh_getAllContent();
  return (all[courseId] && Array.isArray(all[courseId].modules)) ? all[courseId].modules : [];
}

function isloh_getModule(courseId, moduleId) {
  return isloh_getModules(courseId).find((m) => m.id === moduleId) || null;
}

/* Yozish + kursdagi dars sonini yangilash + sahifalarni xabardor qilish. */
function isloh_commitModules(courseId, modules) {
  const all = isloh_getAllContent();
  all[courseId] = { modules: modules };
  if (!isloh_persistContent(all)) return false;

  /* Kurs kartochkasidagi "N dars" endi haqiqiy tarkibdan hisoblanadi. */
  if (typeof isloh_saveCourse === 'function' && typeof isloh_getCourse === 'function' && isloh_getCourse(courseId)) {
    isloh_saveCourse({ id: courseId, lessons: isloh_countLessons(courseId, modules) });
  }

  document.dispatchEvent(new CustomEvent('isloh:content-updated', { detail: { courseId: courseId, modules: modules } }));
  return true;
}

function isloh_countLessons(courseId, modules) {
  const list = modules || isloh_getModules(courseId);
  return list.reduce((sum, m) => sum + (Array.isArray(m.lessons) ? m.lessons.length : 0), 0);
}

/* --- Modul amallari ------------------------------------------------------- */

function isloh_nextId(prefix, taken) {
  let n = 1;
  while (taken.indexOf(prefix + '-' + n) !== -1) n += 1;
  return prefix + '-' + n;
}

function isloh_saveModule(courseId, patch) {
  const modules = isloh_getModules(courseId).slice();
  const data = patch || {};
  const index = data.id ? modules.findIndex((m) => m.id === data.id) : -1;

  if (index === -1) {
    const module = Object.assign({ title: 'Yangi modul', desc: '', status: 'draft', lessons: [] }, data);
    module.id = isloh_nextId('mod', modules.map((m) => m.id));
    modules.push(module);
    return isloh_commitModules(courseId, modules) ? module : null;
  }

  modules[index] = Object.assign({}, modules[index], data);
  return isloh_commitModules(courseId, modules) ? modules[index] : null;
}

function isloh_deleteModule(courseId, moduleId) {
  return isloh_commitModules(courseId, isloh_getModules(courseId).filter((m) => m.id !== moduleId));
}

function isloh_duplicateModule(courseId, moduleId) {
  const modules = isloh_getModules(courseId).slice();
  const index = modules.findIndex((m) => m.id === moduleId);
  if (index === -1) return null;

  const copy = JSON.parse(JSON.stringify(modules[index]));
  copy.id = isloh_nextId('mod', modules.map((m) => m.id));
  copy.title += ' (nusxa)';
  copy.status = 'draft';
  // Darslar ham nusxalanadi, lekin o'z ID'lari bilan
  const lessonIds = [];
  modules.forEach((m) => (m.lessons || []).forEach((l) => lessonIds.push(l.id)));
  copy.lessons = (copy.lessons || []).map((l) => {
    const id = isloh_nextId('les', lessonIds);
    lessonIds.push(id);
    return Object.assign({}, l, { id: id });
  });

  modules.splice(index + 1, 0, copy);
  return isloh_commitModules(courseId, modules) ? copy : null;
}

/* Tortib ko'chirishdan keyin: ID tartibiga qarab qayta joylashtiradi. */
function isloh_reorderModules(courseId, ids) {
  const modules = isloh_getModules(courseId);
  const byId = {};
  modules.forEach((m) => { byId[m.id] = m; });
  const ordered = ids.map((id) => byId[id]).filter(Boolean);
  // Ro'yxatda bo'lmagan modul yo'qolib qolmasin
  modules.forEach((m) => { if (ordered.indexOf(m) === -1) ordered.push(m); });
  return isloh_commitModules(courseId, ordered);
}

/* --- Dars amallari -------------------------------------------------------- */

function isloh_getLessons(courseId, moduleId) {
  const module = isloh_getModule(courseId, moduleId);
  return module && Array.isArray(module.lessons) ? module.lessons : [];
}

function isloh_allLessonIds(courseId) {
  const ids = [];
  isloh_getModules(courseId).forEach((m) => (m.lessons || []).forEach((l) => ids.push(l.id)));
  return ids;
}

function isloh_withModule(courseId, moduleId, mutate) {
  const modules = isloh_getModules(courseId).map((m) => Object.assign({}, m, { lessons: (m.lessons || []).slice() }));
  const module = modules.find((m) => m.id === moduleId);
  if (!module) return null;

  const result = mutate(module, modules);
  return isloh_commitModules(courseId, modules) ? result : null;
}

function isloh_saveLesson(courseId, moduleId, patch) {
  return isloh_withModule(courseId, moduleId, (module) => {
    const data = patch || {};
    const index = data.id ? module.lessons.findIndex((l) => l.id === data.id) : -1;

    if (index === -1) {
      const lesson = Object.assign(
        { title: 'Yangi dars', type: 'video', duration: '—', visibility: 'public', status: 'draft' },
        data
      );
      lesson.id = isloh_nextId('les', isloh_allLessonIds(courseId));
      module.lessons.push(lesson);
      return lesson;
    }

    module.lessons[index] = Object.assign({}, module.lessons[index], data);
    return module.lessons[index];
  });
}

function isloh_deleteLesson(courseId, moduleId, lessonId) {
  return isloh_withModule(courseId, moduleId, (module) => {
    module.lessons = module.lessons.filter((l) => l.id !== lessonId);
    return true;
  });
}

function isloh_duplicateLesson(courseId, moduleId, lessonId) {
  return isloh_withModule(courseId, moduleId, (module) => {
    const index = module.lessons.findIndex((l) => l.id === lessonId);
    if (index === -1) return null;
    const copy = Object.assign({}, module.lessons[index]);
    copy.id = isloh_nextId('les', isloh_allLessonIds(courseId));
    copy.title += ' (nusxa)';
    module.lessons.splice(index + 1, 0, copy);
    return copy;
  });
}

function isloh_reorderLessons(courseId, moduleId, ids) {
  return isloh_withModule(courseId, moduleId, (module) => {
    const byId = {};
    module.lessons.forEach((l) => { byId[l.id] = l; });
    const ordered = ids.map((id) => byId[id]).filter(Boolean);
    module.lessons.forEach((l) => { if (ordered.indexOf(l) === -1) ordered.push(l); });
    module.lessons = ordered;
    return true;
  });
}
