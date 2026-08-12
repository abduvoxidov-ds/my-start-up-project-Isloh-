/* ==========================================================================
   ISLOH — Instruktor dashboard'i (pages/instructor/dashboard.html)

   NEGA BU FAYL BOR: dashboard instruktorning bosh sahifasi edi, lekin unda
   sahifaga xos bironta JS yo'q edi — hamma raqam, kurs nomi va talaba
   ismi HTML ichiga qo'lda yozilgan edi. Natijada yangi kurs yaratilsa yoki
   kurs nashr etilsa, bosh sahifada hech narsa o'zgarmasdi va u boshqa
   sahifalar bilan ziddiyatga tushardi ("6 nashr etilgan kurs" derdi,
   do'konda esa 3 tasi nashr etilgan).

   Mehnat taqsimoti (CLAUDE.md §2 — DRY):
     RAQAMLAR  -> js/profile-stats.js, `[data-stat="<kalit>"]` shartnomasi.
                  Bu yerda bironta hisoblagich qayta yozilmagan.
     RO'YXATLAR -> shu fayl: eng yaxshi kurslar, qoralamalar, so'nggi
                  o'zgarishlar — hammasi js/course-store.js dan.
     PROFIL    -> js/profile.js (`data-user-firstname`, topbar avatari).

   Markup shartnomasi:
     [data-dash-top-courses]   → eng yaxshi kurslar ro'yxati
     [data-dash-drafts]        → qoralama kurslar ro'yxati
     [data-dash-activity]      → so'nggi o'zgarishlar tasmasi
     [data-dash-unread]        → o'qilmagan xabarlar soni (tezkor amal izohi)

   O'YLAB TOPILGAN RAQAM YO'Q: daromad dinamikasi, haftalik ro'yxatga olish
   va talabalar faolligi kabi vaqt qatorlari hech qanday do'konda yo'q,
   shuning uchun ular markupda `.placeholder-note` bilan ochiq belgilangan
   (CLAUDE.md §4 — backend bosqichi).
   ========================================================================== */

const ISLOH_DASH_TOP_LIMIT = 3;      // "Eng yaxshi kurslar" kartochkasi
const ISLOH_DASH_DRAFT_LIMIT = 3;    // "Qoralama kurslar" kartochkasi
const ISLOH_DASH_ACTIVITY_LIMIT = 4; // "So'nggi o'zgarishlar" tasmasi

/* Ro'yxat bo'sh bo'lganda kartochka bo'm-bo'sh qolmasin — nima qilish
   kerakligini aytadigan bitta qator chiqadi. */
function isloh_dashEmptyHtml(text) {
  return `<p class="placeholder-note"><i class="bi bi-info-circle"></i> ${text}</p>`;
}

/* --- Eng yaxshi kurslar ---------------------------------------------------
   "Eng yaxshi" = talaba soni bo'yicha eng yuqori nashr etilgan kurslar.
   Reyting bo'yicha saralash ham mumkin edi, lekin yangi kursda reyting 0
   bo'ladi va ro'yxat tasodifiy ko'rinardi. */

function isloh_dashTopCourseHtml(course) {
  const rating = course.rating ? ` · ${course.rating} ★` : '';
  const students = (course.students || 0).toLocaleString('en-US');
  const revenue = course.revenue
    ? `<div class="perf-metric-val cell-revenue">${isloh_formatUsd(course.revenue)}</div><div class="perf-metric-lbl">daromad</div>`
    : `<div class="perf-metric-val">—</div><div class="perf-metric-lbl">daromad</div>`;

  return `<div class="perf-row">
    <div class="perf-cover" style="background:${course.cover};"><i class="bi ${course.icon}"></i></div>
    <div class="perf-info">
      <div class="perf-title"><a class="text-inherit" href="course-details.html?id=${encodeURIComponent(course.id)}">${course.title}</a></div>
      <div class="perf-sub">${students} talaba${rating}</div>
    </div>
    <div class="perf-metric">${revenue}</div>
  </div>`;
}

function isloh_renderDashTopCourses(courses) {
  const mount = document.querySelector('[data-dash-top-courses]');
  if (!mount) return;

  const top = courses
    .filter((c) => c.status === 'published')
    .sort((a, b) => (b.students || 0) - (a.students || 0))
    .slice(0, ISLOH_DASH_TOP_LIMIT);

  mount.innerHTML = top.length
    ? top.map(isloh_dashTopCourseHtml).join('')
    : isloh_dashEmptyHtml("Hali nashr etilgan kurs yo'q — qoralamani nashr eting.");
}

/* --- Qoralama kurslar -----------------------------------------------------
   Qoralamada `completion` "necha foizi tayyor" degani (nashr etilgan
   kursdagi yakunlash darajasi emas) — shuning uchun izoh ham shunga mos. */

function isloh_dashDraftHtml(course) {
  const done = course.completion || 0;
  const id = encodeURIComponent(course.id);

  return `<div class="perf-row">
    <div class="perf-cover tint-muted"><i class="bi bi-hourglass-split"></i></div>
    <div class="perf-info">
      <div class="perf-title">${course.title}</div>
      <div class="perf-sub">${done}% tayyor</div>
      <div class="progress-track mt-4"><div class="progress-fill${isloh_courseFillClass(course.status)}" style="width:${done}%;"></div></div>
    </div>
    <a href="course-edit.html?id=${id}" class="btn btn-outline btn-sm">Davom</a>
  </div>`;
}

function isloh_renderDashDrafts(courses) {
  const mount = document.querySelector('[data-dash-drafts]');
  if (!mount) return;

  const drafts = courses
    .filter((c) => c.status === 'draft')
    .sort((a, b) => (b.completion || 0) - (a.completion || 0))
    .slice(0, ISLOH_DASH_DRAFT_LIMIT);

  mount.innerHTML = drafts.length
    ? drafts.map(isloh_dashDraftHtml).join('')
    : isloh_dashEmptyHtml("Tugallanmagan qoralama yo'q.");
}

/* --- So'nggi o'zgarishlar -------------------------------------------------
   Ilgari bu blok "talaba ro'yxatga oldi", "sharh qoldirdi" kabi voqealarni
   ko'rsatardi — bunday voqealar tasmasi hech qanday do'konda yo'q va
   hammasi o'ylab topilgan edi. Endi tasma HAQIQIY manbadan chiziladi:
   kurs do'konidagi `updatedAt` bo'yicha oxirgi tegilgan kurslar.
   Ro'yxatga olish va sharh voqealari backend ulangach qo'shiladi. */

const ISLOH_DASH_STATUS_ICON = {
  published: { icon: 'bi-rocket-takeoff-fill', tint: 'tint-green',   verb: 'nashr etilgan holatda yangilandi' },
  draft:     { icon: 'bi-pencil-fill',         tint: 'tint-warning', verb: 'qoralamasi tahrirlandi' },
  archived:  { icon: 'bi-archive-fill',        tint: 'tint-muted',   verb: 'arxivga olindi' }
};

function isloh_dashActivityHtml(course) {
  const meta = ISLOH_DASH_STATUS_ICON[course.status] || ISLOH_DASH_STATUS_ICON.draft;
  const id = encodeURIComponent(course.id);

  return `<div class="activity-row">
    <div class="activity-ic ${meta.tint}"><i class="bi ${meta.icon}"></i></div>
    <div class="activity-main">
      <div class="activity-text"><a class="text-inherit" href="course-details.html?id=${id}"><b>${course.title}</b></a> ${meta.verb}</div>
      <div class="activity-time">${isloh_relativeDate(course.updatedAt)}</div>
    </div>
  </div>`;
}

function isloh_renderDashActivity(courses) {
  const mount = document.querySelector('[data-dash-activity]');
  if (!mount) return;

  const recent = courses
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, ISLOH_DASH_ACTIVITY_LIMIT);

  mount.innerHTML = recent.length
    ? recent.map(isloh_dashActivityHtml).join('')
    : isloh_dashEmptyHtml("Hali o'zgarish yo'q — birinchi kursingizni yarating.");
}

/* --- Tezkor amallar izohi -------------------------------------------------
   O'qilmagan xabarlar soni js/chat-store.js dagi isloh_chatBadgeCount()
   orqali olinadi — u do'konni EKMAYDI. isloh_chatTotalUnread() chaqirilsa,
   chat sahifasini hech qachon ochmagan foydalanuvchida dashboard namuna
   suhbatlarni yaratib yuborardi. */
function isloh_renderDashUnread() {
  const el = document.querySelector('[data-dash-unread]');
  if (!el) return;

  const count = typeof isloh_chatBadgeCount === 'function' ? isloh_chatBadgeCount() : 0;
  el.textContent = count ? `${count} ta yangi xabar` : "Yangi xabar yo'q";
}

/* --- Render --------------------------------------------------------------- */

function isloh_renderInstructorDashboard() {
  if (!document.querySelector('[data-dash-top-courses]')) return; // bu sahifa emas

  const courses = isloh_getCourses();
  isloh_renderDashTopCourses(courses);
  isloh_renderDashDrafts(courses);
  isloh_renderDashActivity(courses);
  isloh_renderDashUnread();
}

/* Kurs do'koni boshqa modul tomonidan o'zgartirilsa (masalan boshqa tabda
   nashr etilsa) dashboard ham yangilanadi — js/instructor-courses.js
   bilan bir xil naqsh. Raqamlarni js/profile-stats.js o'zi qayta chizadi. */
document.addEventListener('isloh:courses-updated', isloh_renderInstructorDashboard);
document.addEventListener('DOMContentLoaded', isloh_renderInstructorDashboard);
