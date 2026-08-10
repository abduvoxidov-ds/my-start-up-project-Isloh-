/* ==========================================================================
   ISLOH — Lesson Viewer module  (Sprint 7)
   Powers pages/student/course-player.html and pages/student/lesson-player.html.
   Lesson switching itself reuses js/tabs.js (each [data-cps-lesson] carries
   the .tab-item + data-tab-target contract, each content panel carries
   data-tab-panel) — this module only adds the behaviors tabs.js doesn't
   cover: module collapse, mark-complete, bookmark toggle, prev/next,
   frontend-only notes save and progress recompute.

   Markup contract:
     [data-cps-module-toggle]      → collapses a .cps-lesson-list
     [data-course-id]              → anywhere on the page, identifies the
       course for the persisted-progress schema below
     [data-cps-lesson]             → sidebar lesson row (also a .tab-item);
       its data-tab-target doubles as the lesson id for that schema
       [data-lesson-done]          → optional, marks the row already complete
     [data-mark-complete]          → button inside the active lesson panel
     [data-lesson-bookmark]        → bookmark toggle button
     [data-lesson-prev] / [data-lesson-next] → step to sibling lesson
     [data-course-progress-fill] / [data-course-progress-pct] → recomputed
       whenever a lesson is marked complete
     [data-notes-input] / [data-notes-save] / [data-notes-status]
       → per-lesson notes, persisted under ISLOH_NOTES_KEY (see below).
         Avtosaqlash bilan ishlaydi — "Saqlash" tugmasi majburiy emas.
     [data-lesson-announcer]       → aria-live doirasi; dars almashganda
       yangi dars nomi shu yerga yoziladi (skrin-rider e'loni)
     [role="progressbar"]          → [data-course-progress-fill] o'ramasi;
       aria-valuenow foizga qarab yangilanadi

   Persisted progress: localStorage key ISLOH_COURSE_PROGRESS_KEY holds
   { [courseId]: { [lessonId]: true } } so completed lessons survive a
   reload instead of resetting to whatever is-done classes are baked into
   the HTML — mirrors the {courseId: {lessonId: true}} shape planned for
   the future backend API, so swapping the storage layer later doesn't
   require redesigning the schema.
   ========================================================================== */

const ISLOH_COURSE_PROGRESS_KEY = 'isloh_course_progress';

function isloh_lessonRows() {
  return [...document.querySelectorAll('[data-cps-lesson]')];
}

/* Kurs identifikatori: `?id=` ustuvor, sahifadagi data-course-id — zaxira.
   Xatcho'plar `course-player.html?id=<kurs>` havolasini yozadi (pastdagi
   isloh_activeLessonMaterial), lekin ilgari bu parametr hech qachon
   o'qilmasdi — natijada jarayon/izohlar doim sahifaga qattiq yozilgan
   kurs ostida saqlanardi. Dars MAZMUNINI `?id=` bo'yicha chizish 2-bosqich
   vazifasi; bu yerda faqat saqlash identifikatori to'g'rilanadi. */
function isloh_courseId() {
  const fromQuery = new URLSearchParams(window.location.search).get('id');
  if (fromQuery) return fromQuery;
  const el = document.querySelector('[data-course-id]');
  return el ? el.dataset.courseId : null;
}

/* data-lesson-id — js/course-player.js chizgan qatorlar; data-tab-target —
   eski qo'lda yozilgan qatorlar (course-landing.html kabi sahifalarda hali
   ishlatiladi). Saqlangan jarayon kalitlari o'zgarmasligi uchun ikkalasi
   ham bir xil dars id'sini beradi. */
function isloh_lessonId(row) {
  return row ? (row.dataset.lessonId || row.dataset.tabTarget || null) : null;
}

function isloh_getCourseProgress() {
  let all = null;
  try { all = JSON.parse(localStorage.getItem(ISLOH_COURSE_PROGRESS_KEY)); } catch (e) { all = null; }
  return all || {};
}

/* Kvota to'lganda yoki maxfiy rejimda setItem xato tashlaydi. Ilgari bu
   xato ushlanmasdi va bosish o'rtasida uzilardi: ekranda ✓ turar, lekin
   hech narsa saqlanmasdi. Endi js/notes-store.js bilan bir xil shartnoma —
   muvaffaqiyat/xato qaytariladi, chaqiruvchi UI'ni orqaga qaytaradi. */
function isloh_saveCourseProgress(all) {
  try {
    localStorage.setItem(ISLOH_COURSE_PROGRESS_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

function isloh_persistLessonDone(row) {
  const courseId = isloh_courseId();
  const lessonId = isloh_lessonId(row);
  if (!courseId || !lessonId) return false;
  const all = isloh_getCourseProgress();
  if (!all[courseId]) all[courseId] = {};
  all[courseId][lessonId] = true;
  return isloh_saveCourseProgress(all);
}

/* Runs before isloh_updateCourseProgress() so the first paint already
   reflects real history. First time a course is seen on this device there's
   nothing stored yet, so whatever is-done classes are already baked into
   the HTML become the seeded baseline instead of being silently discarded. */
function isloh_restoreLessonProgress() {
  const courseId = isloh_courseId();
  if (!courseId) return;
  const all = isloh_getCourseProgress();
  const courseProgress = all[courseId] || {};
  let seeded = false;

  /* Faqat BAJARILGAN darslar saqlanadi. Ilgari har bir dars uchun `false`
     ham yozilardi va do'kon kursdagi darslar soniga teng ravishda o'sardi
     (96 darsli kursda — 96 ta keraksiz yozuv). Eski `false` yozuvlari shu
     yerda bir marta tozalanadi. */
  Object.keys(courseProgress).forEach((lessonId) => {
    if (!courseProgress[lessonId]) { delete courseProgress[lessonId]; seeded = true; }
  });

  isloh_lessonRows().forEach((row) => {
    const lessonId = isloh_lessonId(row);
    if (!lessonId) return;
    const stored = courseProgress[lessonId] === true;
    const markupDone = row.classList.contains('is-done');

    // Markupda bajarilgan, lekin do'konda yo'q — birinchi ochilish, urug' qilamiz
    if (markupDone && !stored) { courseProgress[lessonId] = true; seeded = true; return; }
    if (stored === markupDone) return;
    row.classList.add('is-done');
    const check = row.querySelector('[data-cps-lesson-check]');
    if (check) check.hidden = false;
  });

  if (seeded) {
    all[courseId] = courseProgress;
    isloh_saveCourseProgress(all);
  }
}

/* --- Faol dars sarlavhasi va hisoblagichlar ------------------------------
   Ilgari sarlavha, meta va "Dars N / M" markupda qattiq yozilgan edi va
   dars almashganda o'zgarmay qolardi — foydalanuvchi qaysi darsni ochganini
   bilmasdi. Modul hisoblagichlari ("3/6") va kursdagi jami darslar soni ham
   qo'lda yozilgani uchun haqiqiy darslar soniga mos kelmasdi. Endi hammasi
   dars qatorlaridan hisoblanadi.

   Markup shartnomasi:
     [data-lesson-title]        -> faol dars nomi
     [data-lesson-module]       -> modul nomi
     [data-lesson-time]         -> davomiylik
     [data-lesson-meta-item]    -> meta bandining o'ramasi; ichidagi qiymat
                                   bo'sh bo'lsa butun band yashiriladi
                                   (lesson-player.html da vaqt/modul yo'q)
     [data-lesson-counter]      -> "Dars N / M"
     [data-module-counter]      -> modul ichida "bajarilgan/jami"
     [data-course-lesson-total] -> kursdagi jami darslar                  */

function isloh_activeLessonRow() {
  return document.querySelector('[data-cps-lesson].active');
}

function isloh_setLessonMeta(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value || '';
    const item = el.closest('[data-lesson-meta-item]');
    if (item) item.hidden = !value;
  });
}

function isloh_syncLessonHeader() {
  const rows = isloh_lessonRows();
  const row = isloh_activeLessonRow();
  if (!row) return;

  const title = row.querySelector('.cps-lesson-name');
  const time = row.querySelector('.cps-lesson-time');
  const moduleTitle = row.closest('.cps-module')?.querySelector('.cps-module-title');

  document.querySelectorAll('[data-lesson-title]').forEach((el) => {
    el.textContent = title ? title.textContent.trim() : '';
  });
  isloh_setLessonMeta('[data-lesson-module]', moduleTitle ? moduleTitle.textContent.trim() : '');
  isloh_setLessonMeta('[data-lesson-time]', time ? time.textContent.trim() : '');

  const index = rows.indexOf(row);
  document.querySelectorAll('[data-lesson-counter]').forEach((el) => {
    el.textContent = index === -1 ? '' : 'Dars ' + (index + 1) + ' / ' + rows.length;
  });
}

/* Har bir modul yonidagi "bajarilgan/jami" va kursdagi umumiy darslar soni */
function isloh_updateLessonCounters(rows) {
  document.querySelectorAll('[data-module-counter]').forEach((el) => {
    const scope = el.closest('.cps-module');
    const moduleRows = scope ? [...scope.querySelectorAll('[data-cps-lesson]')] : [];
    const done = moduleRows.filter((r) => r.classList.contains('is-done')).length;
    el.textContent = done + '/' + moduleRows.length;
  });

  document.querySelectorAll('[data-course-lesson-total]').forEach((el) => {
    el.textContent = rows.length + ' dars';
  });
}

function isloh_updateCourseProgress() {
  const rows = isloh_lessonRows();
  if (!rows.length) return;
  const done = rows.filter((r) => r.classList.contains('is-done')).length;
  const pct = Math.round((done / rows.length) * 100);

  document.querySelectorAll('[data-course-progress-fill]').forEach((el) => {
    el.style.width = pct + '%';
    // Vizual holat bilan birga ARIA qiymati ham yangilanadi — aks holda
    // skrin-rider progressni har doim 0% deb o'qiydi
    const track = el.closest('[role="progressbar"]');
    if (track) track.setAttribute('aria-valuenow', String(pct));
  });
  document.querySelectorAll('[data-course-progress-pct]').forEach((el) => { el.textContent = pct + '%'; });
  isloh_updateLessonCounters(rows);

  const banner = document.querySelector('[data-completion-banner]');
  if (banner) banner.hidden = pct < 100;
}

/* Dars almashganda bajariladigan hamma narsa shu yerda to'planadi.
   Tartib muhim: avval eski darsning izohi saqlanadi, keyingina textarea
   yangi dars izohi bilan almashtiriladi. */
function isloh_handleLessonChange() {
  isloh_persistCurrentNote();
  isloh_syncLessonHeader();
  isloh_loadLessonNote();
  isloh_syncLessonBookmarkBtn();
  isloh_announceLesson();
}

/* Dars almashganini skrin-riderga e'lon qiladi. Ilgari "Keyingi" tugmasi
   yashirin qatorni click() qilardi — fokus ko'chmasdi, hech qanday e'lon
   ham bo'lmasdi, ya'ni skrin-rider foydalanuvchisi uchun sahifa jim qolardi. */
function isloh_announceLesson() {
  const row = isloh_activeLessonRow();
  if (!row) return;
  const name = row.querySelector('.cps-lesson-name')?.textContent.trim() || '';

  document.querySelectorAll('[data-lesson-announcer]').forEach((el) => { el.textContent = name; });

  // Ro'yxatda qaysi dars ochiqligi — faqat rang bilan emas, ARIA bilan ham
  isloh_lessonRows().forEach((r) => {
    if (r === row) r.setAttribute('aria-current', 'true');
    else r.removeAttribute('aria-current');
  });
}

/* Bitta hodisa — bitta tinglovchi. Ilgari har bir dars qatoriga alohida
   click tinglovchisi qo'yilardi (bu faylda ikkita, js/tabs.js da yana bitta)
   va ularning ishlash tartibi <script> teglari tartibiga bog'liq edi —
   shu sababli xatcho'p tugmasi uchun `setTimeout(..., 0)` xakisi kerak
   bo'lgan. Endi js/course-player.js `.active` ni ko'chirib bo'lgach
   `isloh:lesson-change` yuboradi va hamma narsa shundan keyin ishlaydi. */
function isloh_initLessonChangeSync() {
  document.addEventListener('isloh:lesson-change', isloh_handleLessonChange);

  // course-player.js ulanmagan sahifalar (eski qo'lda yozilgan qatorlar)
  // uchun zaxira: qator bosilganda hodisa hech kim yubormaydi
  if (!document.querySelector('[data-player-modules]')) {
    document.querySelectorAll('[data-cps-lesson]').forEach((row) => {
      row.addEventListener('click', isloh_handleLessonChange);
    });
  }
  isloh_handleLessonChange();
}

function isloh_initModuleToggles() {
  document.querySelectorAll('[data-cps-module-toggle]').forEach((btn, i) => {
    const container = btn.closest('.cps-module, .module-card');
    const list = container?.querySelector('.cps-lesson-list, .module-body');
    if (!list) return;

    /* ARIA: tugma qaysi ro'yxatni boshqarishini va u ochiq/yopiqligini
       bildiradi. Ilgari yopiq modul skrin-riderga umuman ko'rinmasdi —
       ro'yxat borligi haqida hech qanday belgi yo'q edi. */
    if (!list.id) list.id = 'cps-module-list-' + (i + 1);
    btn.setAttribute('aria-controls', list.id);
    btn.setAttribute('aria-expanded', String(!list.classList.contains('collapsed')));

    btn.addEventListener('click', () => {
      const icon = btn.querySelector('.cps-module-toggle') || btn;
      const open = !list.classList.toggle('collapsed');
      icon.classList.toggle('collapsed', !open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
}

/* Saqlash muvaffaqiyatsiz bo'lsa belgi orqaga qaytariladi — ekrandagi ✓
   bilan haqiqiy holat bir-biridan ajralib qolmasligi uchun.
   Qaytaradi: true — belgilandi, false — saqlanmadi, undefined — o'zgarish yo'q. */
function isloh_markLessonDone(row) {
  if (!row || row.classList.contains('is-done')) return;
  const check = row.querySelector('[data-cps-lesson-check]');

  row.classList.add('is-done');
  if (check) check.hidden = false;

  if (!isloh_persistLessonDone(row)) {
    row.classList.remove('is-done');
    if (check) check.hidden = true;
    isloh_updateCourseProgress();
    if (typeof isloh_showToast === 'function') {
      isloh_showToast("Jarayonni saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    }
    return false;
  }

  isloh_updateCourseProgress();
  if (typeof isloh_recordLessonCompleted === 'function') isloh_recordLessonCompleted();
  return true;
}

function isloh_initMarkComplete() {
  document.querySelectorAll('[data-mark-complete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Toast faqat haqiqatan saqlangandan keyin — xato bo'lsa o'z xabari chiqadi
      if (isloh_markLessonDone(isloh_activeLessonRow()) === true && typeof isloh_showToast === 'function') {
        isloh_showToast('Dars yakunlandi deb belgilandi', 'success');
      }
    });
  });
}

// Dars qatoridagi .lt-* klassi material turini bildiradi — "Saqlanganlar"
// sahifasidagi filtr chiplariga shu yerda moslanadi.
const ISLOH_LESSON_TYPE_MAP = { 'lt-video': 'lesson', 'lt-article': 'article', 'lt-code': 'code', 'lt-quiz': 'lesson' };

function isloh_lessonMaterialType(row) {
  const ic = row?.querySelector('.cps-lesson-ic');
  const hit = ic && [...ic.classList].find((c) => ISLOH_LESSON_TYPE_MAP[c]);
  return hit ? ISLOH_LESSON_TYPE_MAP[hit] : 'lesson';
}

// Faol darsdan "Saqlanganlar" uchun material obyektini yig'adi
function isloh_activeLessonMaterial() {
  const row = document.querySelector('[data-cps-lesson].active');
  if (!row) return null;
  const courseId = isloh_courseId();
  const lessonId = isloh_lessonId(row);
  const title = row.querySelector('.cps-lesson-name')?.textContent.trim() || 'Dars';
  const time = row.querySelector('.cps-lesson-time')?.textContent.trim() || '';
  const course = document.querySelector('.cps-course-title')?.textContent.trim() || '';

  return {
    id: `${courseId || 'course'}:${lessonId || title}`,
    type: isloh_lessonMaterialType(row),
    title,
    sub: [time, course].filter(Boolean).join(' · '),
    // `?lesson=` bilan aniq darsga qaytadi — ilgari havola faqat kursni
    // ko'rsatardi va xatcho'p har doim birinchi darsni ochardi
    href: `course-player.html?id=${encodeURIComponent(courseId || '')}` +
          (lessonId ? '&lesson=' + encodeURIComponent(lessonId) : '')
  };
}

// Faol darsning xatcho'p holatini tugmada ko'rsatadi
function isloh_syncLessonBookmarkBtn() {
  if (typeof isloh_isBookmarked !== 'function') return;
  const material = isloh_activeLessonMaterial();
  const on = material ? isloh_isBookmarked(material.id) : false;
  document.querySelectorAll('[data-lesson-bookmark]').forEach((btn) => {
    btn.classList.toggle('active', on);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-bookmark', !on);
      icon.classList.toggle('bi-bookmark-fill', on);
    }
  });
}

function isloh_initBookmarkToggle() {
  document.querySelectorAll('[data-lesson-bookmark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const material = isloh_activeLessonMaterial();
      // js/bookmarks.js yuklanmagan bo'lsa — eski vizual xatti-harakat
      if (!material || typeof isloh_toggleBookmark !== 'function') {
        btn.classList.toggle('active');
        return;
      }
      const on = isloh_toggleBookmark(material);
      isloh_syncLessonBookmarkBtn();
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(on ? "Darsga xatcho'p qo'yildi" : "Xatcho'p olib tashlandi", 'info');
      }
    });
  });

  // Dars almashganda tugma holati isloh_handleLessonChange ichida yangilanadi
  isloh_syncLessonBookmarkBtn();
}

function isloh_initPrevNext() {
  document.querySelectorAll('[data-lesson-prev], [data-lesson-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rows = isloh_lessonRows();
      const activeIndex = rows.findIndex((r) => r.classList.contains('active'));
      if (activeIndex === -1) return;
      const dir = btn.hasAttribute('data-lesson-next') ? 1 : -1;
      const target = rows[activeIndex + dir];
      if (!target) return;
      target.click();

      /* Fokusni yangi dars sarlavhasiga ko'chiramiz. lesson-player.html'da
         dars qatorlari display:none — fokus hech qayerga ketmasdi va
         klaviatura foydalanuvchisi qayerdaligini bilmay qolardi. */
      const title = document.querySelector('[data-lesson-title]');
      if (title) title.focus();
    });
  });
}

/* --- Dars izohlari -------------------------------------------------------
   Ilgari "Izohni saqlash" faqat toast chiqarardi va matn hech qayerga
   yozilmasdi: foydalanuvchi izohi saqlandi deb o'ylab sahifani yopar va
   hammasini yo'qotardi.

   Do'konning o'zi js/notes-store.js da (u "Izohlarim" sahifasi bilan
   umumiy), bu yerda faqat DOM bilan bog'lash qoladi. Shu sababli hamma
   chaqiruvlar typeof bilan himoyalangan — notes-store.js ulanmagan
   sahifada pleer baribir ishlashda davom etadi.

   Markup shartnomasi:
     [data-notes-input]  -> textarea
     [data-notes-save]   -> saqlash tugmasi
     [data-notes-status] -> oxirgi saqlangan vaqt (ixtiyoriy)              */

function isloh_notesStoreReady() {
  return typeof isloh_setLessonNote === 'function' && typeof isloh_getLessonNote === 'function';
}

/* Izoh kartochkasida ko'rinadigan sarlavha/kurs nomi — dars qatoridan */
function isloh_activeLessonNoteMeta() {
  const row = isloh_activeLessonRow();
  const lessonTitle = row?.querySelector('.cps-lesson-name')?.textContent.trim() || '';
  const courseTitle = document.querySelector('.cps-course-title')?.textContent.trim() || '';
  return { title: lessonTitle, lessonTitle, courseTitle };
}

/* Vaqt ko'rsatilgani uchun mintaqa muhim: ilgari `getHours()` brauzerning
   mahalliy mintaqasini olardi va sozlamadagi tanlovga bo'ysunmasdi. */
function isloh_formatNoteDate(iso) {
  return isloh_dtDateTime(iso);
}

function isloh_renderNoteStatus(note) {
  document.querySelectorAll('[data-notes-status]').forEach((el) => {
    const stamp = note ? isloh_formatNoteDate(note.updatedAt) : '';
    el.textContent = stamp ? 'Oxirgi saqlangan: ' + stamp : '';
    el.hidden = !stamp;
  });
}

/* --- Izohni yo'qotmaslik mexanizmi --------------------------------------
   MUAMMO: dars almashganda isloh_loadLessonNote() textarea qiymatini
   yangi darsning izohi bilan almashtirardi. Foydalanuvchi yozgan, lekin
   "Saqlash" tugmasini bosmagan matn hech qanday ogohlantirishsiz yo'qolardi.

   YECHIM ikki qismli:
     1) Avtosaqlash — yozishdan 800 ms keyin, shuningdek sahifa yopilishi
        va tab fonga o'tishida darhol.
     2) Textarea "bog'lanish" (isloh_noteBinding) bilan ishlaydi: matn
        FAOL qatorga emas, textarea to'ldirilgan darsga yoziladi. Shu
        sababli hodisalar tartibi (tabs.js .active'ni qachon ko'chirishi)
        endi ahamiyatsiz — izoh har doim o'z darsiga tushadi.                */

const ISLOH_NOTE_AUTOSAVE_MS = 800;
let isloh_noteAutosaveTimer = null;
let isloh_noteBinding = null;   // { courseId, lessonId, meta, savedText }

/* Dars almashganda o'sha darsning izohi textarea'ga qaytariladi va
   bog'lanish yangilanadi */
function isloh_loadLessonNote() {
  const input = document.querySelector('[data-notes-input]');
  if (!input || !isloh_notesStoreReady()) return;
  const courseId = isloh_courseId();
  const lessonId = isloh_lessonId(isloh_activeLessonRow());
  const note = isloh_getLessonNote(courseId, lessonId);

  input.value = note ? note.text : '';
  isloh_noteBinding = { courseId, lessonId, meta: isloh_activeLessonNoteMeta(), savedText: input.value };
  isloh_renderNoteStatus(note);
}

/* Textarea'dagi matnni BOG'LANGAN darsga yozadi. Qaytaradi: true — saqlandi
   yoki o'zgarish yo'q edi, false — saqlab bo'lmadi. */
function isloh_persistCurrentNote() {
  clearTimeout(isloh_noteAutosaveTimer);
  const input = document.querySelector('[data-notes-input]');
  const bind = isloh_noteBinding;
  if (!input || !bind || !bind.courseId || !bind.lessonId || !isloh_notesStoreReady()) return false;
  if (input.value === bind.savedText) return true;   // o'zgarmagan — yozish shart emas

  if (!isloh_setLessonNote(bind.courseId, bind.lessonId, input.value, bind.meta)) {
    if (typeof isloh_showToast === 'function') isloh_showToast("Saqlab bo'lmadi — brauzer xotirasi to'lgan", 'error');
    return false;
  }
  bind.savedText = input.value;
  isloh_renderNoteStatus(isloh_getLessonNote(bind.courseId, bind.lessonId));
  return true;
}

function isloh_initNotesAutosave() {
  const input = document.querySelector('[data-notes-input]');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(isloh_noteAutosaveTimer);
    isloh_noteAutosaveTimer = setTimeout(isloh_persistCurrentNote, ISLOH_NOTE_AUTOSAVE_MS);
  });

  // Sahifa yopilishi / boshqa tabga o'tish — debounce'ni kutmasdan yozamiz
  window.addEventListener('pagehide', isloh_persistCurrentNote);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) isloh_persistCurrentNote();
  });
}

function isloh_initNotesSave() {
  document.querySelectorAll('[data-notes-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector('[data-notes-input]');
      const hadText = input ? input.value.trim().length > 0 : false;
      if (!isloh_persistCurrentNote()) return;   // xato bo'lsa o'z toast'i chiqqan
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(hadText ? 'Izoh saqlandi' : "Izoh o'chirildi", 'success');
      }
    });
  });
}

/* Haqiqiy o'qish vaqtini js/progress-metrics.js ga uzatadi.
   Ilgari shart faqat `!document.hidden` edi — ochiq qoldirilgan tab tunda
   480 "o'qish daqiqasi" yozib qo'yardi va Analitika ma'nosini yo'qotardi.
   Endi daqiqa faqat haqiqiy faollik bo'lganda hisoblanadi: video o'ynayotgan
   bo'lsa yoki oxirgi daqiqada foydalanuvchi harakat qilgan bo'lsa.
   clearInterval ham qo'shildi — sahifa yopilganda taymer to'xtaydi. */
function isloh_initStudyTimer() {
  if (typeof isloh_recordStudyMinutes !== 'function') return;

  let lastActivity = Date.now();
  const bump = () => { lastActivity = Date.now(); };
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => {
    document.addEventListener(ev, bump, { passive: true });
  });

  const timer = setInterval(() => {
    if (document.hidden) return;
    // 2-bosqichda haqiqiy <video> qo'shilganda bu shart o'z-o'zidan ishlaydi
    const video = document.querySelector('[data-tab-panel]:not([hidden]) video');
    const playing = video && !video.paused && !video.ended;
    if (playing || Date.now() - lastActivity < 60000) isloh_recordStudyMinutes(1);
  }, 60000);

  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}

function isloh_initLessonViewer() {
  // Module expand/collapse is reused on plain curriculum previews (e.g.
  // course-landing.html) too, so it always initializes.
  isloh_initModuleToggles();
  if (!isloh_lessonRows().length) return;
  isloh_restoreLessonProgress();
  isloh_initMarkComplete();
  isloh_initBookmarkToggle();
  isloh_initPrevNext();
  isloh_initNotesSave();
  isloh_initNotesAutosave();
  isloh_initLessonChangeSync();
  isloh_updateCourseProgress();
  isloh_initStudyTimer();
}

document.addEventListener('DOMContentLoaded', isloh_initLessonViewer);
