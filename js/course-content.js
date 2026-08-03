/* ==========================================================================
   ISLOH — Kurs tarkibi (yagona manba)
   course-landing.html (do'kondagi kurs sahifasi) va course-detail.html
   (sotib olingan kurs sahifasi) bir xil ma'lumotdan foydalanadi: katalog
   qatorlari js/marketplace.js'da (nom, narx, reyting...), kurs ichidagi
   mazmun esa shu yerda (natijalar, talablar, dastur). Ikkala sahifa ham
   `?id=<kurs-id>` bilan ochiladi.

   fetch() ishlatilmaydi (CLAUDE.md §3) — ma'lumot JS obyekti sifatida.
   ========================================================================== */

/* Dars turi -> ikonka va yozuv. "locked" — do'kon sahifasida hali ochilmagan
   dars (sotib olingandan keyin ochiladi). */
const ISLOH_LESSON_TYPES = {
  video: { icon: 'bi bi-play-circle-fill', label: 'Video' },
  article: { icon: 'bi bi-file-text-fill', label: 'Maqola' },
  locked: { icon: 'bi bi-lock-fill', label: 'Yopiq' }
};

/* `modules` — dastur namunasi: sahifada dastlabki modullar ko'rsatiladi.
   `modules_total` / `quizzes` / `projects` — kurs tarkibi ko'rsatkichlari. */
const ISLOH_COURSE_DETAILS = {
  'py-101': {
    modules_total: 12, quizzes: 12, projects: 5,
    outcomes: ['Django bilan REST API qurish va hujjatlash', "Ma'lumotlar bazasi modellari va migratsiyalar", 'Autentifikatsiya, ruxsatlar va deploy'],
    requirements: ["Python sintaksisi bilan boshlang'ich tanishlik", 'Terminal buyruqlarining asoslari', 'Internetga ulangan kompyuter'],
    modules: [
      { title: 'Python va muhitni tayyorlash', desc: 'Virtual muhit, paketlar va loyiha tuzilmasi', lessons: 8, duration: '3s 20d', preview: [
        { type: 'video', title: 'Kursga kirish', duration: '9 daq' },
        { type: 'article', title: 'Muhitni sozlash', duration: '12 daq' },
        { type: 'video', title: 'Loyiha tuzilmasi', duration: '14 daq' }
      ] },
      { title: 'Django asoslari', desc: 'Model, view, template va URL marshrutlari', lessons: 10, duration: '4s 40d', preview: [
        { type: 'video', title: 'Birinchi Django ilovasi', duration: '16 daq' },
        { type: 'video', title: 'ORM bilan ishlash', duration: '21 daq' }
      ] }
    ]
  },
  'react-201': {
    modules_total: 10, quizzes: 10, projects: 4,
    outcomes: ['Komponentlar va hooks bilan ishlash', "Holat boshqaruvi va ma'lumot oqimi", 'Ishlab chiqarishga tayyor ilovani yig\'ish'],
    requirements: ['JavaScript (ES6) asoslari', 'HTML va CSS bilan tanishlik', "Node.js o'rnatilgan kompyuter"],
    modules: [
      { title: 'React bilan tanishuv', desc: 'JSX, komponentlar va props', lessons: 9, duration: '3s 50d', preview: [
        { type: 'video', title: 'React nima va nega kerak', duration: '11 daq' },
        { type: 'article', title: 'Loyihani ishga tushirish', duration: '10 daq' },
        { type: 'video', title: 'Birinchi komponent', duration: '15 daq' }
      ] },
      { title: 'Hooks va holat', desc: 'useState, useEffect va maxsus hooklar', lessons: 11, duration: '5s 05d', preview: [
        { type: 'video', title: 'useState amaliyoti', duration: '18 daq' },
        { type: 'video', title: "Effektlar va yon ta'sirlar", duration: '22 daq' }
      ] }
    ]
  },
  'uiux-301': {
    modules_total: 7, quizzes: 6, projects: 3,
    outcomes: ['Foydalanuvchi tadqiqoti va persona tuzish', "Figma'da prototip yaratish", 'Dizayn tizimi va komponentlar kutubxonasi'],
    requirements: ['Dizayn tajribasi shart emas', "Figma'ning bepul akkaunti", 'Vizual misollarga qiziqish'],
    modules: [
      { title: 'UX asoslari', desc: 'Foydalanuvchi ehtiyoji va tadqiqot usullari', lessons: 7, duration: '2s 40d', preview: [
        { type: 'video', title: 'UX va UI farqi', duration: '8 daq' },
        { type: 'article', title: 'Tadqiqot savollari', duration: '9 daq' },
        { type: 'video', title: 'Persona tuzish', duration: '13 daq' }
      ] },
      { title: 'Figma amaliyoti', desc: 'Freym, komponent va prototip', lessons: 9, duration: '4s 10d', preview: [
        { type: 'video', title: 'Figma interfeysi', duration: '12 daq' },
        { type: 'video', title: 'Interaktiv prototip', duration: '19 daq' }
      ] }
    ]
  },
  'ml-401': {
    modules_total: 14, quizzes: 16, projects: 6,
    outcomes: ["Ma'lumotni tozalash va tahlil qilish", 'Klassifikatsiya va regressiya modellari', 'Model sifatini baholash va joylashtirish'],
    requirements: ['Python asoslari', 'Maktab darajasidagi matematika', 'Jupyter Notebook bilan tanishlik'],
    modules: [
      { title: "Ma'lumotlar bilan ishlash", desc: 'NumPy, pandas va vizualizatsiya', lessons: 10, duration: '4s 30d', preview: [
        { type: 'video', title: 'Kurs qanday tuzilgan', duration: '7 daq' },
        { type: 'article', title: "Ma'lumotni yuklash", duration: '11 daq' },
        { type: 'video', title: 'Tozalash amaliyoti', duration: '20 daq' }
      ] },
      { title: 'Birinchi modellar', desc: 'Chiziqli regressiya va qaror daraxtlari', lessons: 12, duration: '6s 15d', preview: [
        { type: 'video', title: 'Regressiya nazariyasi', duration: '17 daq' },
        { type: 'video', title: 'Modelni baholash', duration: '23 daq' }
      ] }
    ]
  },
  'flutter-501': {
    modules_total: 9, quizzes: 8, projects: 4,
    outcomes: ['Flutter widgetlari bilan interfeys qurish', 'Navigatsiya va holat boshqaruvi', 'API bilan ishlash va ilovani chiqarish'],
    requirements: ['Dasturlash asoslari (istalgan tilda)', 'Android Studio yoki VS Code', '8 GB operativ xotira tavsiya etiladi'],
    modules: [
      { title: 'Flutter va Dart asoslari', desc: 'Muhit, sintaksis va birinchi ekran', lessons: 8, duration: '3s 10d', preview: [
        { type: 'video', title: 'Nega Flutter?', duration: '9 daq' },
        { type: 'article', title: "Muhitni o'rnatish", duration: '14 daq' },
        { type: 'video', title: 'Birinchi ekran', duration: '16 daq' }
      ] },
      { title: 'Widget va navigatsiya', desc: "Layout, ro'yxatlar va sahifalar orasida o'tish", lessons: 10, duration: '4s 25d', preview: [
        { type: 'video', title: 'Layout widgetlari', duration: '18 daq' },
        { type: 'video', title: 'Navigator bilan ishlash', duration: '15 daq' }
      ] }
    ]
  },
  'devops-601': {
    modules_total: 11, quizzes: 11, projects: 5,
    outcomes: ['Docker image va konteynerlarni boshqarish', 'Kubernetes klasterida ilova joylashtirish', 'CI/CD quvuri va monitoring'],
    requirements: ['Linux terminali bilan ishonchli ishlash', 'Tarmoq asoslari haqida tushuncha', 'Bulutli xizmat akkaunti (bepul tarif yetadi)'],
    modules: [
      { title: 'Konteynerlar asoslari', desc: 'Docker, image va registry', lessons: 9, duration: '4s 00d', preview: [
        { type: 'video', title: 'Konteyner nima?', duration: '10 daq' },
        { type: 'article', title: 'Dockerfile anatomiyasi', duration: '13 daq' },
        { type: 'video', title: 'Image qurish', duration: '18 daq' }
      ] },
      { title: 'Kubernetes bilan tanishuv', desc: 'Pod, Deployment va Service', lessons: 12, duration: '5s 30d', preview: [
        { type: 'video', title: 'Klaster arxitekturasi', duration: '20 daq' },
        { type: 'video', title: 'Birinchi Deployment', duration: '24 daq' }
      ] }
    ]
  },
  'docker-for-beginners': {
    modules_total: 4, quizzes: 5, projects: 2,
    outcomes: ['Docker konteynerlarini yaratish va boshqarish', 'Dockerfile yozish va image quratish', "Docker Compose bilan ko'p konteynerli ilovalar"],
    requirements: ['Linux terminali bilan asosiy tanishlik', 'Har qanday matn muharriri (VS Code tavsiya etiladi)', 'Internetga ulangan kompyuter'],
    modules: [
      { title: 'Kirish va sozlash', desc: 'Docker, Git va muhitni sozlash', lessons: 6, duration: '2s 10d', preview: [
        { type: 'video', title: 'Kursga kirish', duration: '8 daq' },
        { type: 'article', title: 'Muhitni sozlash', duration: '12 daq' },
        { type: 'video', title: 'Terminal buyruqlari', duration: '10 daq' }
      ] },
      { title: 'Docker asoslari', desc: 'Image, konteyner va registry tushunchalari', lessons: 7, duration: '3s 40d', preview: [
        { type: 'video', title: 'Docker image nima?', duration: '9 daq' },
        { type: 'video', title: 'Konteynerlarni boshqarish', duration: '14 daq' }
      ] }
    ]
  }
};

/* `?id=` bo'yicha kursni qaytaradi; id yo'q yoki noto'g'ri bo'lsa zaxira
   kurs ochiladi, shunda sahifa hech qachon bo'sh ko'rinmaydi. */
function isloh_getCourseFromQuery(fallbackId) {
  if (typeof isloh_findCourseById !== 'function') return null;
  const id = new URLSearchParams(window.location.search).get('id');
  return isloh_findCourseById(id) || isloh_findCourseById(fallbackId);
}

function isloh_getCourseDetails(courseId) {
  return ISLOH_COURSE_DETAILS[courseId] || null;
}

/* Bir xil tuzilishdagi ikonkali ro'yxatlar (natijalar, talablar, kurs
   tarkibi) — ikkala sahifa ham shu funksiyani ishlatadi.
   `items` elementi oddiy matn ham, { icon, text } obyekti ham bo'lishi
   mumkin: birinchi holatda `defaultIcon` qo'yiladi. */
function isloh_renderIconList(selector, items, rowClass, defaultIcon) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = (items || []).map((item) => {
    const isText = typeof item === 'string';
    const text = isText ? item : item.text;
    const icon = (isText ? defaultIcon : item.icon) || defaultIcon;
    return `<div class="${rowClass}"><i class="${icon}"></i> ${text}</div>`;
  }).join('');
}

/* Sahifa sarlavhasi va matn bog'lamalarini bir joyda to'ldiradi.
   `bindings` — { 'data-atributi': (course) => qiymat } ko'rinishida. */
function isloh_applyCourseBindings(bindings, course) {
  Object.keys(bindings).forEach((attr) => {
    document.querySelectorAll('[' + attr + ']').forEach((el) => {
      const value = bindings[attr](course);
      el.textContent = (value === undefined || value === null) ? '' : String(value);
    });
  });
}
