/* ==========================================================================
   ISLOH — Profil bo'limlari

   Profil sahifasidagi ro'yxatlarni chizadi: ko'nikmalar, maqsadlar, yutuqlar,
   kurslar, yo'nalishlar va faoliyat tarixi. Ilgari bu bloklar student va
   instructor HTML fayllarida qo'lda, deyarli bir xil qilib yozilgan edi
   (CLAUDE.md §2 — DRY) va hech qanday do'kon bilan bog'lanmagandi: profil
   "248 talaba" desa, kurs do'konida 2 140 turardi.

   Ikki xil manba:
     • Profil ma'lumoti (ko'nikma, maqsad, yo'nalish) — `isloh_profiles`
       do'konidan, ya'ni tahrirlanadigan ma'lumot (js/profile.js).
     • Hisoblanadigan ma'lumot (yutuq, kurs, tarix) — kurs/sertifikat/
       analitika do'konlaridan. Yutuq "qulflangan" bo'lishi endi bezak emas:
       har birining o'lchanadigan sharti bor.

   Manbalar typeof bilan himoyalangan — modul ulanmagan sahifada bo'lim
   shunchaki bo'sh holat matnini ko'rsatadi, sahifa buzilmaydi.

   Markup shartnomasi:
     [data-profile-section="skills|goals|achievements|courses|categories|timeline"]
   ========================================================================== */

const ISLOH_SECTION_MAX_COURSES = 3;
const ISLOH_SECTION_MAX_TIMELINE = 4;

/* Do'kondagi matn foydalanuvchi tahrirlashi mumkin bo'lgan qiymat —
   shablonga qo'yishdan oldin himoyalanadi. */
function isloh_escapeSectionText(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Katalogda ikon "bi bi-x", kurs do'konida esa "bi-x" ko'rinishida yotadi. */
function isloh_sectionIconClass(icon) {
  const value = String(icon || 'bi-journal-bookmark-fill');
  return value.indexOf('bi ') === 0 ? value : 'bi ' + value;
}

function isloh_sectionEmptyHtml(text) {
  return '<div class="profile-empty">' + isloh_escapeSectionText(text) + '</div>';
}

/* --- Kurs holati ---------------------------------------------------------- */

/* Kurs bo'yicha bajarilgan darslar foizi. Do'konda yozuv yo'q bo'lsa null —
   "0%" emas, chunki bu "boshlanmagan" degani. */
function isloh_sectionCoursePct(courseId) {
  if (typeof isloh_getCourseProgress !== 'function') return null;
  const lessons = isloh_getCourseProgress()[courseId];
  if (!lessons) return null;

  const ids = Object.keys(lessons);
  if (!ids.length) return null;
  return Math.round((ids.filter((id) => lessons[id]).length / ids.length) * 100);
}

/* Sertifikat berilgan kurs har doim 100% — sertifikat faqat to'liq
   yakunlanganda beriladi (js/certificate-engine.js). */
function isloh_sectionCourseCompletion(courseId) {
  if (typeof isloh_getCertificates === 'function') {
    const hasCert = Object.values(isloh_getCertificates()).some((c) => c.courseId === courseId);
    if (hasCert) return 100;
  }
  return isloh_sectionCoursePct(courseId);
}

function isloh_sectionCatalogCourse(courseId) {
  if (typeof isloh_getCatalog !== 'function') return null;
  return isloh_getCatalog().find((course) => course.id === courseId) || null;
}

/* --- Statistika ko'prigi -------------------------------------------------- */

/* js/profile-stats.js dagi hisoblagichlarni bir marta ishga tushirib,
   {kalit: qiymat} ko'rinishida qaytaradi — yutuq shartlari va statga
   bog'langan maqsadlar shundan foydalanadi. */
function isloh_sectionStats(role) {
  if (typeof ISLOH_PROFILE_STATS === 'undefined' || !ISLOH_PROFILE_STATS[role]) return {};
  const stats = {};
  Object.keys(ISLOH_PROFILE_STATS[role]).forEach((key) => {
    stats[key] = ISLOH_PROFILE_STATS[role][key]() || 0;
  });
  return stats;
}

/* --- Ko'nikmalar ---------------------------------------------------------- */

function isloh_renderSkillsSection(user) {
  const skills = Array.isArray(user.skills) ? user.skills : [];
  if (!skills.length) return isloh_sectionEmptyHtml("Ko'nikma hali qo'shilmagan.");

  return skills.map((skill) => {
    const level = skill.level ? ' <span class="lvl">' + isloh_escapeSectionText(skill.level) + '</span>' : '';
    return '<span class="skill-tag">' + isloh_escapeSectionText(skill.name) + level + '</span>';
  }).join('');
}

/* --- Maqsadlar ------------------------------------------------------------
   Maqsad uch xil bo'lishi mumkin:
     { text, courseId }      -> holat kurs jarayonidan/nashr holatidan
     { text, stat, goal }    -> holat hisoblangan ko'rsatkichdan
     { text }                -> oddiy reja                                  */

const ISLOH_COURSE_STATUS_LABEL = { draft: 'Qoralama', archived: 'Arxivda', published: 'Nashrda' };

/* `progress` — nishon shunchaki matn emas, o'lchov ekanini bildiradi:
   ekran o'qiydigan dasturlar uchun role="progressbar" qo'yiladi. */
function isloh_studentGoalState(goal) {
  const pct = isloh_sectionCourseCompletion(goal.courseId);
  if (pct === 100) return { done: true };
  if (pct === null) return { done: false, badge: 'Boshlanmagan', tone: 'badge-neutral' };
  return { done: false, badge: pct + '%', tone: 'badge-violet', progress: { now: pct, max: 100 } };
}

function isloh_instructorGoalState(goal) {
  const course = typeof isloh_getCourse === 'function' ? isloh_getCourse(goal.courseId) : null;
  if (!course) return { done: false, badge: 'Topilmadi', tone: 'badge-neutral' };
  if (course.status === 'published') return { done: true };
  return { done: false, badge: ISLOH_COURSE_STATUS_LABEL[course.status] || 'Qoralama', tone: 'badge-neutral' };
}

function isloh_statGoalState(goal, stats) {
  const value = stats[goal.stat] || 0;
  const format = (n) => (typeof isloh_formatStat === 'function' ? isloh_formatStat(goal.stat, n) : String(n));
  if (value >= goal.goal) return { done: true };
  return {
    done: false,
    badge: format(value) + ' / ' + format(goal.goal),
    tone: 'badge-neutral',
    progress: { now: value, max: goal.goal }
  };
}

function isloh_goalState(goal, role, stats) {
  if (goal.courseId) return role === 'instructor' ? isloh_instructorGoalState(goal) : isloh_studentGoalState(goal);
  if (goal.stat) return isloh_statGoalState(goal, stats);
  return { done: false, badge: 'Rejada', tone: 'badge-neutral' };
}

function isloh_renderGoalsSection(user, role, stats) {
  const goals = Array.isArray(user.goals) ? user.goals : [];
  if (!goals.length) return isloh_sectionEmptyHtml("Maqsad hali qo'yilmagan.");

  return goals.map((goal) => {
    const state = isloh_goalState(goal, role, stats);
    const check = state.done
      ? '<div class="goal-check done"><i class="bi bi-check-lg"></i></div>'
      : '<div class="goal-check pending"></div>';
    const meter = state.progress
      ? ' role="progressbar" aria-valuenow="' + state.progress.now + '" aria-valuemin="0" aria-valuemax="' + state.progress.max + '"'
      : '';
    const badge = state.badge
      ? '<span class="badge ' + state.tone + '"' + meter + '>' + isloh_escapeSectionText(state.badge) + '</span>'
      : '';
    return '<div class="goal-item' + (state.done ? ' done' : '') + '">'
         + check
         + '<div class="goal-text">' + isloh_escapeSectionText(goal.text) + '</div>'
         + badge
         + '</div>';
  }).join('');
}

/* --- Yutuqlar -------------------------------------------------------------
   Har bir nishonning o'lchanadigan sharti bor: "qulflangan" holat endi
   bezak emas, haqiqiy ko'rsatkichdan kelib chiqadi. */
const ISLOH_ACHIEVEMENTS = {
  student: [
    { icon: 'bi-trophy-fill',      name: 'Birinchi kurs',      test: (s) => s.completedCourses >= 1 },
    { icon: 'bi-fire',             name: '7 kun seriya',       test: (s) => s.streak >= 7 },
    { icon: 'bi-clock-history',    name: "50 soat o'quv",      test: (s) => s.studyHours >= 50 },
    { icon: 'bi-patch-check-fill', name: '3 sertifikat',       test: (s) => s.certificates >= 3 },
    { icon: 'bi-lightning-fill',   name: '30 kun seriya',      test: (s) => s.streak >= 30 },
    { icon: 'bi-stars',            name: '10 sertifikat',      test: (s) => s.certificates >= 10 }
  ],
  instructor: [
    { icon: 'bi-journal-check',    name: 'Birinchi nashr',     test: (s) => s.publishedCourses >= 1 },
    { icon: 'bi-people-fill',      name: '400+ talaba',        test: (s) => s.students >= 400 },
    { icon: 'bi-star-fill',        name: '4.8+ reyting',       test: (s) => s.rating >= 4.8 },
    { icon: 'bi-clock-history',    name: '90 soat kontent',    test: (s) => s.teachingHours >= 90 },
    { icon: 'bi-trophy-fill',      name: '5 000 talaba',       test: (s) => s.students >= 5000 },
    { icon: 'bi-stars',            name: '10 kurs',            test: (s) => s.publishedCourses >= 10 }
  ]
};

function isloh_renderAchievementsSection(role, stats) {
  const items = ISLOH_ACHIEVEMENTS[role] || [];
  if (!items.length) return isloh_sectionEmptyHtml("Nishonlar hali mavjud emas.");

  return items.map((item) => {
    const unlocked = !!item.test(stats);
    const name = isloh_escapeSectionText(item.name);
    const icon = unlocked ? item.icon : 'bi-lock-fill';
    const label = unlocked ? name : 'Qulflangan — ' + name;
    return '<div class="achievement' + (unlocked ? '' : ' locked') + '" title="' + label + '">'
         + '<div class="achievement-badge' + (unlocked ? '' : ' locked') + '" aria-hidden="true"><i class="bi ' + icon + '"></i></div>'
         + '<div class="achievement-name">' + name + '</div>'
         + '<span class="sr-only">' + label + '</span>'
         + '</div>';
  }).join('');
}

/* --- Kurslar --------------------------------------------------------------
   Talaba: jarayon, sertifikat va sotib olingan kurslar birlashtiriladi —
   davom etayotganlari birinchi, yakunlanganlari keyin, boshlanmaganlari
   oxirida.
   Provayder: nashr etilgan kurslar talaba soni bo'yicha.               */

function isloh_studentCourseRows() {
  const seen = new Set();
  const rows = [];

  const add = (courseId) => {
    if (!courseId || seen.has(courseId)) return;
    seen.add(courseId);
    const course = isloh_sectionCatalogCourse(courseId);
    if (!course) return;
    rows.push({ course: course, pct: isloh_sectionCourseCompletion(courseId) });
  };

  if (typeof isloh_getCourseProgress === 'function') Object.keys(isloh_getCourseProgress()).forEach(add);
  if (typeof isloh_getCertificates === 'function') Object.values(isloh_getCertificates()).forEach((c) => add(c.courseId));
  if (typeof isloh_getPurchasedCourses === 'function') isloh_getPurchasedCourses().forEach((c) => add(c.id));

  const rank = (row) => (row.pct === null ? 2 : (row.pct === 100 ? 1 : 0));
  return rows
    .sort((a, b) => (rank(a) - rank(b)) || ((b.pct || 0) - (a.pct || 0)))
    .slice(0, ISLOH_SECTION_MAX_COURSES);
}

function isloh_studentCourseSub(pct) {
  if (pct === null) return 'Hali boshlanmagan';
  if (pct === 100) return "100% · Yakunlangan";
  return pct + '% · Davom etmoqda';
}

function isloh_courseRowHtml(course, sub, href) {
  return '<div class="upcoming-row">'
       + '<div class="upcoming-icon" style="background:' + isloh_escapeSectionText(course.cover) + ';">'
       + '<i class="' + isloh_sectionIconClass(course.icon) + '"></i></div>'
       + '<div class="upcoming-body">'
       + '<div class="upcoming-title">' + isloh_escapeSectionText(course.title) + '</div>'
       + '<div class="upcoming-sub">' + isloh_escapeSectionText(sub) + '</div>'
       + '</div>'
       + '<a href="' + href + '" class="btn btn-outline btn-sm">Ochish</a>'
       + '</div>';
}

function isloh_renderStudentCourses() {
  const rows = isloh_studentCourseRows();
  if (!rows.length) return isloh_sectionEmptyHtml("Hali biror kurs boshlanmagan.");

  return rows.map((row) => isloh_courseRowHtml(
    row.course,
    isloh_studentCourseSub(row.pct),
    'course-player.html?id=' + encodeURIComponent(row.course.id)
  )).join('');
}

function isloh_renderInstructorCourses() {
  if (typeof isloh_getPublishedCourses !== 'function') return isloh_sectionEmptyHtml("Kurs do'koni ulanmagan.");

  const courses = isloh_getPublishedCourses()
    .slice()
    .sort((a, b) => (b.students || 0) - (a.students || 0))
    .slice(0, ISLOH_SECTION_MAX_COURSES);

  if (!courses.length) return isloh_sectionEmptyHtml("Hali nashr etilgan kurs yo'q.");

  /* Ming ajratgichi stat kartochkalari bilan bir xil bo'lishi uchun
     js/profile-stats.js dagi formatlagich ishlatiladi. */
  const count = (n) => (typeof isloh_formatStatCount === 'function' ? isloh_formatStatCount(n) : String(n));

  return courses.map((course) => isloh_courseRowHtml(
    course,
    count(course.students || 0) + ' talaba · ' + (course.rating || 0) + ' ★',
    'course-details.html?id=' + encodeURIComponent(course.id)
  )).join('');
}

/* --- Yo'nalishlar ---------------------------------------------------------
   Talabada bu — tanlangan qiziqish (profil ma'lumoti), provayderda esa
   haqiqatan o'qitilayotgan yo'nalishlar, ya'ni nashr etilgan kurslarning
   kategoriyalari. */
function isloh_renderCategoriesSection(user, role) {
  let names = [];

  if (role === 'instructor' && typeof isloh_getPublishedCourses === 'function') {
    isloh_getPublishedCourses().forEach((course) => {
      if (course.category && names.indexOf(course.category) === -1) names.push(course.category);
    });
  } else {
    names = Array.isArray(user.categories) ? user.categories : [];
  }

  if (!names.length) return isloh_sectionEmptyHtml("Yo'nalish hali tanlanmagan.");
  return names.map((name) => '<span class="filter-chip">' + isloh_escapeSectionText(name) + '</span>').join('');
}

/* --- Faoliyat tarixi ------------------------------------------------------
   Sana yozilgan haqiqiy hodisalar: talabada sertifikat va buyurtmalar,
   provayderda kurs yangilanishlari. */
function isloh_studentTimelineEvents() {
  const events = [];

  if (typeof isloh_getCertificates === 'function') {
    Object.values(isloh_getCertificates()).forEach((cert) => {
      events.push({ date: cert.issuedAt, tone: 'tl-green', text: '«' + cert.courseTitle + '» sertifikati olindi' });
    });
  }

  if (typeof isloh_getOrders === 'function') {
    isloh_getOrders().forEach((order) => {
      const first = order.items && order.items[0];
      if (!first) return;
      const extra = order.items.length > 1 ? ' +' + (order.items.length - 1) : '';
      events.push({ date: order.date, tone: '', text: '«' + first.title + '»' + extra + ' sotib olindi' });
    });
  }

  return events;
}

function isloh_instructorTimelineEvents() {
  if (typeof isloh_getCourses !== 'function') return [];

  return isloh_getCourses().map((course) => ({
    date: course.updatedAt,
    tone: course.status === 'published' ? 'tl-green' : (course.status === 'draft' ? 'tl-warning' : ''),
    text: '«' + course.title + '» ' + (ISLOH_COURSE_STATUS_LABEL[course.status] || 'Nashrda').toLowerCase() + ' yangilandi'
  }));
}

function isloh_renderTimelineSection(role) {
  const events = (role === 'instructor' ? isloh_instructorTimelineEvents() : isloh_studentTimelineEvents())
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, ISLOH_SECTION_MAX_TIMELINE);

  if (!events.length) return isloh_sectionEmptyHtml("Faoliyat hali qayd etilmagan.");

  const formatDate = (value) => (typeof isloh_relativeDate === 'function' ? isloh_relativeDate(value) : String(value));

  /* "2 kun oldin" — odam uchun, `datetime` esa mashina uchun: shu bilan
     nisbiy sana ekran o'qigichda ham aniq kunga bog'lanadi. */
  return events.map((event) => '<div class="timeline-item' + (event.tone ? ' ' + event.tone : '') + '">'
    + '<time class="timeline-time" datetime="' + isloh_escapeSectionText(String(event.date).slice(0, 10)) + '">'
    + isloh_escapeSectionText(formatDate(event.date)) + '</time>'
    + '<div class="timeline-title">' + isloh_escapeSectionText(event.text) + '</div>'
    + '</div>').join('');
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderProfileSections() {
  const containers = document.querySelectorAll('[data-profile-section]');
  if (!containers.length) return; // bu sahifa emas — no-op
  if (typeof isloh_getUserProfile !== 'function') return;

  const role = isloh_getActiveRole();
  const user = isloh_getUserProfile(role);
  const stats = isloh_sectionStats(role);

  const builders = {
    skills: () => isloh_renderSkillsSection(user),
    goals: () => isloh_renderGoalsSection(user, role, stats),
    achievements: () => isloh_renderAchievementsSection(role, stats),
    courses: () => (role === 'instructor' ? isloh_renderInstructorCourses() : isloh_renderStudentCourses()),
    categories: () => isloh_renderCategoriesSection(user, role),
    timeline: () => isloh_renderTimelineSection(role)
  };

  containers.forEach((el) => {
    const builder = builders[el.dataset.profileSection];
    if (builder) el.innerHTML = builder();
  });
}

/* Profil tahrirlanganda (ko'nikma qo'shildi, maqsad o'zgardi) qayta chiziladi. */
document.addEventListener('isloh:user-updated', isloh_renderProfileSections);
document.addEventListener('DOMContentLoaded', isloh_renderProfileSections);

/* "Mening kurslarim" bo'limi kurs do'konidan chiziladi — API yuklangach
   qayta chizilmasa zaxira ro'yxat qolib ketardi. */
document.addEventListener('isloh:courses-updated', isloh_renderProfileSections);
