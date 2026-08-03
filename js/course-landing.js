/* ==========================================================================
   ISLOH — Do'kondagi kurs sahifasi (pages/student/course-landing.html)
   Sahifa bitta kursga qattiq bog'lanmagan: Marketplace'dagi kartochka
   bosilganda `course-landing.html?id=<kurs-id>` ochiladi va mazmun
   js/marketplace.js (katalog) + js/course-content.js (kurs tarkibi)
   ma'lumotidan to'ldiriladi — kursni sotib olmasdan ko'rib chiqish mumkin.

   Markup shartnomasi:
     [data-landing-title]      -> kurs nomi (bir necha joyda bo'lishi mumkin)
     [data-landing-badge]      -> "Yo'nalish · Daraja"
     [data-landing-summary]    -> qisqa tavsif
     [data-landing-rating]     -> reyting
     [data-landing-students]   -> talabalar soni
     [data-landing-lessons]    -> darslar soni
     [data-landing-duration]   -> davomiyligi
     [data-landing-instructor] -> o'qituvchi
     [data-landing-price]      -> joriy narx
     [data-landing-price-old]  -> chegirmagacha bo'lgan narx (chegirma bo'lsa)
     [data-landing-cover]      -> muqova foni
     [data-landing-icon]       -> muqova ikonkasi
     [data-landing-outcomes]   -> "Bu kursda o'rganasiz" ro'yxati
     [data-landing-requirements] -> "Talab qilinadigan bilimlar" ro'yxati
     [data-landing-modules]    -> kurs dasturining dastlabki modullari
     [data-landing-syllabus-meta] -> "N modul · M dars" nishoni
   ========================================================================== */

// `?id=` berilmagan yoki noto'g'ri bo'lsa shu kurs ko'rsatiladi
const ISLOH_LANDING_FALLBACK_ID = 'docker-for-beginners';

const ISLOH_LANDING_BINDINGS = {
  'data-landing-title': (c) => c.title,
  'data-landing-badge': (c) => [c.category, c.level].filter(Boolean).join(' · '),
  'data-landing-summary': (c) => c.summary,
  'data-landing-rating': (c) => c.rating,
  'data-landing-students': (c) => isloh_formatCount(c.students || 0),
  'data-landing-lessons': (c) => c.lessons,
  'data-landing-duration': (c) => c.duration,
  'data-landing-instructor': (c) => c.instructor,
  'data-landing-price': (c) => isloh_formatSom(c.discount_price || c.price) + " so'm"
};

/* Do'kon sahifasida faqat birinchi modul darslari ochiq ko'rinadi, qolgani
   qulflangan — sotib olingandan keyin ochiladi. */
function isloh_landingLessonHtml(lesson, moduleIndex) {
  const lessonType = ISLOH_LESSON_TYPES[lesson.type] || ISLOH_LESSON_TYPES.video;
  // Ikonka qulflangan bo'lishi mumkin, yozuv esa har doim darsning asl turi
  const icon = (moduleIndex === 0 ? lessonType : ISLOH_LESSON_TYPES.locked).icon;
  return `<div class="module-preview-item"><i class="${icon}"></i> ${lesson.title} (${lessonType.label} · ${lesson.duration})</div>`;
}

function isloh_landingModuleHtml(module, index) {
  // Birinchi modul ochiq, qolganlari yig'ilgan holda ko'rsatiladi
  const collapsed = index === 0 ? '' : ' collapsed';
  const preview = module.preview.map((lesson) => isloh_landingLessonHtml(lesson, index)).join('');

  return `
    <div class="module-card landing-module">
      <div class="module-header landing-module-header">
        <button class="module-toggle${collapsed}" data-cps-module-toggle aria-label="Yig'ish/Yoyish"><i class="bi bi-chevron-down"></i></button>
        <div class="module-info">
          <div class="module-title-row"><span class="module-title">${index + 1}-modul: ${module.title}</span></div>
          <div class="module-desc">${module.desc}</div>
        </div>
        <div class="module-meta"><span><i class="bi bi-journal-text"></i> ${module.lessons} dars</span><span><i class="bi bi-clock"></i> ${module.duration}</span></div>
      </div>
      <div class="module-body${collapsed}">
        <div class="module-preview-list">${preview}</div>
      </div>
    </div>`;
}

function isloh_renderLandingDetails(course) {
  const details = isloh_getCourseDetails(course.id);
  if (!details) return;

  isloh_renderIconList('[data-landing-outcomes]', details.outcomes, 'outcome-row', 'bi bi-check2');
  isloh_renderIconList('[data-landing-requirements]', details.requirements, 'requirement-row', 'bi bi-dot');

  const meta = document.querySelector('[data-landing-syllabus-meta]');
  if (meta) meta.textContent = `${details.modules_total} modul · ${course.lessons} dars`;

  const modules = document.querySelector('[data-landing-modules]');
  if (!modules) return;
  modules.innerHTML = details.modules.map(isloh_landingModuleHtml).join('');
  /* Modullar dinamik chizilgani uchun yig'ish/yoyish tugmalari qayta
     bog'lanadi — mantiq js/lesson-viewer.js'da, takrorlanmaydi. */
  if (typeof isloh_initModuleToggles === 'function') isloh_initModuleToggles();
}

function isloh_renderLandingCourse() {
  const course = isloh_getCourseFromQuery(ISLOH_LANDING_FALLBACK_ID);
  if (!course) return;

  isloh_applyCourseBindings(ISLOH_LANDING_BINDINGS, course);

  // Eski narx faqat chegirmali kurslarda ko'rinadi
  document.querySelectorAll('[data-landing-price-old]').forEach((el) => {
    el.hidden = !course.discount_price;
    el.textContent = course.discount_price ? isloh_formatSom(course.price) : '';
  });

  document.querySelectorAll('[data-landing-cover]').forEach((el) => { el.style.background = course.cover; });
  document.querySelectorAll('[data-landing-icon]').forEach((el) => { el.className = course.icon; });

  isloh_renderLandingDetails(course);
  document.title = course.title + ' — Isloh';
}

document.addEventListener('DOMContentLoaded', isloh_renderLandingCourse);
