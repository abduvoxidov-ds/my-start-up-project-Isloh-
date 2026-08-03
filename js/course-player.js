/* ==========================================================================
   ISLOH — Kurs pleeri: ro'yxat va sahna chizuvchi  (2-bosqich)

   Vazifasi: js/course-data.js dagi ma'lumotdan (1) yon paneldagi modul/dars
   ro'yxatini va (2) faol darsning sahnasini chizish.

   NEGA KERAK: ilgari har bir dars uchun sahifaga qo'lda `data-tab-panel`
   yozilardi va dars almashishi js/tabs.js orqali panel ko'rsatish/yashirish
   bilan bo'lardi. Ikkita muammo bor edi:
     1) 96 darsli kursda 96 ta panel (va 96 ta video) DOM'da turardi;
     2) yon paneldagi dars qatorlari `.tab-item` shartnomasini ishlatgani
        uchun ularga role="tab" tegib ketardi — ular esa tab emas,
        navigatsiya ro'yxati.
   Endi dars almashishi shu modulda, tabs.js esa faqat haqiqiy tablar
   (Izohlar/Yuklab olishlar/Resurslar/Muhokama) uchun qoladi.

   YUKLANISH TARTIBI: bu fayl js/lesson-viewer.js dan OLDIN ulanishi shart —
   lesson-viewer.js mavjud dars qatorlarini kuchaytiradi, shuning uchun
   qatorlar undan avval chizilgan bo'lishi kerak.

   Chiqaradigan hodisa:
     isloh:lesson-change  → { lessonId, lesson }  (document'da, bubbles)
   ========================================================================== */

let isloh_playerActiveCourse = null;

/* --- Yon paneldagi ro'yxat ------------------------------------------------ */

function isloh_renderLessonRow(lesson, index) {
  const meta = ISLOH_PLAYER_LESSON_ICONS[lesson.type] || ISLOH_PLAYER_LESSON_ICONS.video;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cps-lesson' + (lesson.done ? ' is-done' : '');
  btn.dataset.cpsLesson = '';
  btn.dataset.lessonId = lesson.id;
  btn.dataset.lessonIndex = String(index);

  btn.innerHTML =
    `<span class="cps-lesson-ic ${meta.cls}"><i class="bi ${meta.icon}" aria-hidden="true"></i></span>` +
    `<span class="cps-lesson-name"></span>` +
    `<i class="bi bi-check-circle-fill cps-lesson-check" data-cps-lesson-check aria-hidden="true"></i>` +
    `<span class="cps-lesson-time"></span>`;

  // Matn textContent bilan qo'yiladi — kurs nomlari HTML sifatida talqin
  // qilinmasligi kerak (kelajakda ma'lumot backend'dan kelganda ham xavfsiz)
  btn.querySelector('.cps-lesson-name').textContent = lesson.title;
  btn.querySelector('.cps-lesson-time').textContent = lesson.duration || '';
  btn.querySelector('[data-cps-lesson-check]').hidden = !lesson.done;
  return btn;
}

function isloh_renderCourseSidebar(course) {
  const mount = document.querySelector('[data-player-modules]');
  if (!mount) return;
  mount.textContent = '';   // skeletonni almashtiradi

  /* Bo'sh kurs holati: ilgari darslar bo'lmasa yon panel jimgina bo'sh
     qolardi va foydalanuvchi sahifa buzilgan deb o'ylardi. */
  if (!isloh_flatLessons(course).length) {
    mount.innerHTML =
      `<div class="empty-state">
         <div class="empty-icon"><i class="bi bi-collection-play"></i></div>
         <div class="empty-title">Bu kursda hali darslar yo'q</div>
         <div class="empty-sub">O'qituvchi darslarni qo'shgach, ular shu yerda paydo bo'ladi.</div>
       </div>`;
    return;
  }

  let index = 0;
  course.modules.forEach((mod) => {
    const wrap = document.createElement('div');
    wrap.className = 'cps-module';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'cps-module-head';
    head.dataset.cpsModuleToggle = '';
    head.innerHTML =
      `<i class="bi bi-chevron-down cps-module-toggle${mod.collapsed ? ' collapsed' : ''}" aria-hidden="true"></i>` +
      `<span class="cps-module-title"></span>` +
      `<span class="cps-module-meta" data-module-counter></span>`;
    head.querySelector('.cps-module-title').textContent = mod.title;

    const list = document.createElement('div');
    list.className = 'cps-lesson-list' + (mod.collapsed ? ' collapsed' : '');
    mod.lessons.forEach((lesson) => { list.appendChild(isloh_renderLessonRow(lesson, index++)); });

    wrap.appendChild(head);
    wrap.appendChild(list);
    mount.appendChild(wrap);
  });

  const title = document.querySelector('.cps-course-title');
  if (title) title.textContent = course.title;
}

/* --- Sahna (faol dars mazmuni) -------------------------------------------- */

function isloh_showStage(name) {
  document.querySelectorAll('[data-stage]').forEach((el) => {
    el.hidden = el.dataset.stage !== name;
  });
}

function isloh_renderLessonStage(lesson) {
  if (!lesson) return;

  if (lesson.type === 'video') {
    isloh_showStage('video');
    // Bitta <video> qayta ishlatiladi — faqat manba almashadi
    if (typeof isloh_videoLoadLesson === 'function') isloh_videoLoadLesson(lesson);
    return;
  }

  // Video bo'lmagan darsga o'tganda o'ynayotgan videoni to'xtatamiz
  const video = document.querySelector('[data-lesson-video]');
  if (video && !video.paused) video.pause();

  if (lesson.type === 'article') {
    isloh_showStage('article');
    const body = document.querySelector('[data-stage="article"] .lv-article-body');
    if (body) body.innerHTML = lesson.html || '';
    return;
  }

  if (lesson.type === 'code') {
    isloh_showStage('code');
    const label = document.querySelector('[data-stage="code"] .editor-block-label');
    const block = document.querySelector('[data-stage="code"] .lv-code-block');
    if (label) label.innerHTML = `<i class="bi bi-file-code" aria-hidden="true"></i> ` + (lesson.label || 'Kod');
    if (block) block.innerHTML = lesson.html || '';
    return;
  }

  // quiz / assignment — ikkalasi ham "ishga tushirish" kartochkasi
  isloh_showStage('launch');
  const meta = ISLOH_PLAYER_LESSON_ICONS[lesson.type] || ISLOH_PLAYER_LESSON_ICONS.quiz;
  const launch = lesson.launch || {};
  const icon = document.querySelector('[data-stage="launch"] .lv-launch-icon');
  const title = document.querySelector('[data-stage="launch"] .lv-launch-title');
  const sub = document.querySelector('[data-stage="launch"] .lv-launch-sub');
  const action = document.querySelector('[data-stage="launch"] [data-launch-action]');
  if (icon) { icon.className = 'lv-launch-icon ' + meta.cls; icon.innerHTML = `<i class="bi ${meta.icon}" aria-hidden="true"></i>`; }
  if (title) title.textContent = lesson.title;
  if (sub) sub.textContent = launch.sub || '';
  if (action) action.innerHTML = `<i class="bi ${launch.icon || 'bi-play-fill'}" aria-hidden="true"></i> ` + (launch.action || 'Ochish');
}

/* --- Faol darsni almashtirish --------------------------------------------- */

function isloh_setActiveLesson(lessonId) {
  const course = isloh_playerActiveCourse;
  if (!course) return;
  const lesson = isloh_findLesson(course, lessonId);
  if (!lesson) return;

  document.querySelectorAll('[data-cps-lesson]').forEach((row) => {
    row.classList.toggle('active', row.dataset.lessonId === lessonId);
  });

  lesson.courseId = course.id;
  isloh_renderLessonStage(lesson);

  /* Boshqa modullar (izohlar, xatcho'p, e'lon, hisoblagichlar) shu hodisaga
     ulanadi — ilgari har bir dars qatoriga alohida click tinglovchisi
     qo'yilardi va ular js/tabs.js dan keyin ishlashiga ishonib, natijada
     `setTimeout(..., 0)` xakisi kerak bo'lardi. */
  document.dispatchEvent(new CustomEvent('isloh:lesson-change', {
    detail: { lessonId, lesson }, bubbles: true
  }));
}

/* --- Ishga tushirish ------------------------------------------------------ */

function isloh_initCoursePlayer() {
  if (typeof isloh_playerCourse !== 'function') return;
  const fallback = document.querySelector('[data-course-id]')?.dataset.courseId;
  const course = isloh_playerCourse(fallback);
  if (!course || !document.querySelector('[data-player-modules]')) return;

  isloh_playerActiveCourse = course;
  isloh_renderCourseSidebar(course);

  // Dars qatorlari dinamik chizilgani uchun delegatsiya ishlatiladi
  document.querySelector('[data-player-modules]').addEventListener('click', (e) => {
    const row = e.target.closest('[data-cps-lesson]');
    if (row) isloh_setActiveLesson(row.dataset.lessonId);
  });

  /* `?lesson=` bilan aniq darsga chuqur havola qilish mumkin (xatcho'p va
     "Izohlarim" sahifasidagi havolalar shundan foydalanadi). */
  const lessons = isloh_flatLessons(course);
  const wanted = new URLSearchParams(window.location.search).get('lesson');
  const start = lessons.find((l) => l.id === wanted) || lessons[0];
  if (start) isloh_setActiveLesson(start.id);
}

document.addEventListener('DOMContentLoaded', isloh_initCoursePlayer);
