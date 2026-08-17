/* ==========================================================================
   ISLOH — Kurs do'koni (provider tomoni)
   O'qituvchi yaratgan kurslar uchun YAGONA manba: localStorage'dagi
   `isloh_courses` kaliti.

   NEGA BU FAYL BOR: shu paytgacha provider moduli hech narsani saqlamasdi.
   Sehrgar (course-create) "Kurs muvaffaqiyatli saqlandi" deb toast
   chiqarardi, lekin biror maydonni o'qimasdi ham; kurslar ro'yxati esa
   HTML ichiga qo'lda yozilgan 6 ta qatordan iborat edi. Sahifa yangilansa
   hamma narsa yo'qolardi va nashr etilgan kurs talaba katalogiga hech
   qachon tushmasdi.

   Naqsh js/marketplace.js va js/profile.js bilan bir xil: standart sxema +
   birinchi o'qishda ekiladigan demo ma'lumot + qisman yangilash. fetch()
   ishlatilmaydi (CLAUDE.md §3 — file:// protokoli).

   Kim o'qiydi:
     js/instructor-courses.js  — kurslar ro'yxati (jadval + katakcha + stats)
     js/course-wizard.js       — yaratish / tahrirlash sehrgari
     js/course-publish.js      — nashr etish oqimi
     js/marketplace.js         — nashr etilgan kurslarni talaba katalogiga
                                 qo'shadi (isloh_getCatalog)
   ========================================================================== */

const ISLOH_COURSES_KEY = 'isloh_courses';

/* Provider interfeysi narxni USD'da so'raydi ($49.00), talaba katalogi esa
   so'mda ishlaydi. Konvertatsiya shu yagona koeffitsient orqali —
   sahifalarga tarqalgan sehrli raqamlar bo'lmasin.

   M2 da o'chirilmadi (reja shuni ko'zlagan edi): server endi narxni
   `price_cents` + `currency` da saqlaydi va kurs valyutasi USD (forma
   shuni so'raydi), lekin HAQIQIY kurs bo'yicha o'girish — to'lov ishi.
   Shuning uchun koeffitsient M9 (savdo) gacha shu yerda, FAQAT katalogga
   ko'prikda ishlatiladi; boshqa hech qayerda emas. */
const ISLOH_USD_TO_UZS = 12600;

/* Narx: serverda butun sent, frontendda USD kasr son. Yaxlitlash xatosi
   to'planmasin uchun o'girish faqat shu ikki funksiyada. */
function isloh_centsToPrice(cents) {
  return (Number(cents) || 0) / 100;
}

function isloh_priceToCents(price) {
  return Math.round((Number(price) || 0) * 100);
}

const ISLOH_COURSE_STATUSES = {
  draft:     { label: 'Qoralama',      badge: 'badge-warning' },
  published: { label: 'Nashr etilgan', badge: 'badge-green' },
  archived:  { label: 'Arxiv',         badge: 'badge-neutral' }
};

/* Saqlangan yozuv shu obyekt ustiga birlashtiriladi — eski yoki qisman
   yozuvlarda yetishmagan maydonlar shu yerdan to'ldiriladi. */
const ISLOH_COURSE_DEFAULTS = {
  id: '',
  title: '',
  subtitle: '',
  description: '',
  category: 'Dasturlash',
  level: "Boshlang'ich",
  language: "O'zbek",
  tags: [],
  free: false,
  price: 0,                 // USD
  duration: '',
  estimate: '',
  prerequisites: '',
  certificate: true,
  visibility: 'public',     // public | unlisted | private
  metaTitle: '',
  metaDescription: '',
  slug: '',
  status: 'draft',
  cover: 'linear-gradient(135deg,#4ED88A,#1FAE5E)',
  icon: 'bi-journal-bookmark-fill',
  lessons: 0,
  students: 0,
  rating: 0,
  revenue: 0,               // USD
  completion: 0,            // %
  createdAt: '',
  updatedAt: ''
};

/* Demo ma'lumot — ilgari pages/instructor/courses.html ichida qo'lda
   yozilgan 6 ta kurs. Endi u markupda emas, shu yerda: ro'yxat ham,
   statistika ham shu massivdan chiziladi.

   `py-101` va `docker-for-beginners` ataylab talaba katalogidagi kurslar
   bilan BIR XIL ID'ga ega — bular aynan o'sha kurslar, shunchaki
   o'qituvchi tomonidan ko'rilgani. ID bir xil bo'lgani uchun
   isloh_getCatalog ularni birlashtiradi va katalogda ikki nusxa paydo
   bo'lmaydi. Qolgan yozuvlar esa faqat provider tomonida mavjud. */
const ISLOH_COURSE_SEED = [
  {
    id: 'py-101', title: 'Python Backend Development',
    subtitle: 'Django, DRF va PostgreSQL asoslari', category: 'Backend',
    level: "O'rta daraja", status: 'published', tags: ['Python', 'Django', 'Backend'],
    /* Bu kurs talaba katalogida ham bor (py-101) — dars/talaba sonlari
       ikkala tomonda bir xil turishi uchun o'sha qiymatlar olindi. */
    price: 1480 / 30, lessons: 96, students: 2140, rating: 4.9, revenue: 1480, completion: 78,
    duration: '12 hafta', estimate: '42 soat', slug: 'python-backend-development',
    cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi-filetype-py',
    createdAt: '2026-02-11', updatedAt: '2026-08-02'
  },
  {
    id: 'django-rest-masterclass', title: 'Django REST Masterclass',
    subtitle: "REST API'ni ishlab chiqarish darajasida qurish", category: 'Backend',
    level: "Ilg'or", status: 'published', tags: ['Django', 'REST', 'API'],
    price: 920 / 20, lessons: 36, students: 130, rating: 4.8, revenue: 920, completion: 71,
    duration: '8 hafta', estimate: '30 soat', slug: 'django-rest-masterclass',
    cover: 'linear-gradient(135deg,#0F766E,#14B8A6)', icon: 'bi-database-fill',
    createdAt: '2026-03-20', updatedAt: '2026-07-28'
  },
  {
    id: 'postgresql-complete-guide', title: 'PostgreSQL Complete Guide',
    subtitle: "Ma'lumotlar bazasini loyihalash va optimallashtirish", category: "Ma'lumotlar bazasi",
    level: "O'rta daraja", status: 'published', tags: ['SQL', 'PostgreSQL'],
    price: 540 / 12, lessons: 28, students: 60, rating: 4.7, revenue: 540, completion: 64,
    duration: '6 hafta', estimate: '24 soat', slug: 'postgresql-complete-guide',
    cover: 'linear-gradient(135deg,#8B5CF6,#6C5DD3)', icon: 'bi-box-fill',
    createdAt: '2026-04-02', updatedAt: '2026-07-14'
  },
  {
    id: 'docker-for-beginners', title: 'Docker for Beginners',
    subtitle: "Konteynerlashtirish asoslarini noldan o'rganing", category: 'DevOps',
    level: "Boshlang'ich", status: 'draft', tags: ['Docker', 'DevOps'],
    price: 35, lessons: 24, students: 890, rating: 4.7, revenue: 0, completion: 85,
    duration: '4 hafta', estimate: '18 soat', prerequisites: 'Linux terminal asoslari',
    slug: 'docker-for-beginners',
    cover: 'linear-gradient(135deg,#F97316,#EA580C)', icon: 'bi-boxes',
    createdAt: '2026-07-30', updatedAt: '2026-08-04'
  },
  {
    id: 'advanced-api-design', title: 'Advanced API Design',
    subtitle: 'Versiyalash, kesh va API shartnomalari', category: 'Backend',
    level: "Ilg'or", status: 'draft', tags: ['API', 'Arxitektura'],
    price: 59, lessons: 10, students: 0, rating: 0, revenue: 0, completion: 40,
    duration: '5 hafta', estimate: '20 soat', slug: 'advanced-api-design',
    cover: 'linear-gradient(135deg,#8B5CF6,#3B82F6)', icon: 'bi-diagram-3',
    createdAt: '2026-07-18', updatedAt: '2026-08-01'
  },
  {
    id: 'jquery-asoslari', title: 'jQuery Asoslari',
    subtitle: 'Eski loyihalarni qo\'llab-quvvatlash uchun', category: 'Dasturlash',
    level: "Boshlang'ich", status: 'archived', tags: ['jQuery'],
    price: 310 / 10, lessons: 22, students: 92, rating: 4.5, revenue: 310, completion: 100,
    duration: '3 hafta', estimate: '12 soat', slug: 'jquery-asoslari',
    cover: 'linear-gradient(135deg,#9CA3AF,#6B7280)', icon: 'bi-archive-fill',
    createdAt: '2025-05-04', updatedAt: '2025-06-10'
  }
];

/* --- Do'kon: Sync-over-Async kesh -----------------------------------------
   Sahifalar `isloh_getCourses()` ni SINXRON chaqiradi (16 ta joyda). API esa
   async. Yechim: kesh birinchi chaqiruvda darhol javob beradi (localStorage
   yoki demo), yuklash fonda ketadi, tugagach `isloh:courses-updated`
   yuboriladi va sahifalar o'zini qayta chizadi — chaqiruv joylariga
   tegilmaydi.

   Mexanizmning o'zi js/api.js dagi `isloh_createStoreCache` da (kesh,
   qayta urinish, optimistik yozish, rollback) — bu yerda faqat kurslarga
   XOS qism qoladi: sxema, demo ma'lumot va yozish qoidalari.

   localStorage endi MANBA emas, offline NUSXA: file:// ostida
   (CLAUDE.md §3) va tarmoq uzilganda shu nusxa ishlaydi. */

/* Serverdan kelgan yozuvni frontend sxemasiga o'giradi (M2).

   API snake_case va `price_cents` bilan gapiradi, frontend esa camelCase
   va USD bilan — 16 ta chaqiruv joyi shunga tayanadi. Ikkalasi FAQAT shu
   yerda va `isloh_serializeCourse` da uchrashadi.

   Bir funksiya ikkala shaklni ham qabul qiladi: kesh localStorage'dan
   (frontend shakli) yoki serverdan (API shakli) kelishi mumkin.
   Ajratish belgisi — `price_cents` maydonining borligi. */
function isloh_isServerCourse(course) {
  return course && (('price_cents' in course) || ('created_at' in course));
}

function isloh_fromServerCourse(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    category: row.category,
    level: row.level,
    language: row.language,
    tags: row.tags,
    free: row.free,
    price: isloh_centsToPrice(row.price_cents),
    duration: row.duration,
    estimate: row.estimate,
    prerequisites: row.prerequisites,
    certificate: row.certificate,
    visibility: row.visibility,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    slug: row.slug,
    status: row.status,
    cover: row.cover,
    icon: row.icon,
    lessons: row.lessons_count,
    students: row.students_count,
    // DRF DecimalField'ni SATR sifatida beradi ("4.90") — raqamga o'giriladi,
    // aks holda reyting bo'yicha saralash matn sifatida ishlardi
    rating: Number(row.rating) || 0,
    revenue: isloh_centsToPrice(row.revenue_cents),
    completion: row.completion,
    createdAt: (row.created_at || '').slice(0, 10),
    updatedAt: (row.updated_at || '').slice(0, 10)
  };
}

function isloh_normalizeCourse(course) {
  const source = isloh_isServerCourse(course) ? isloh_fromServerCourse(course) : (course || {});
  const merged = Object.assign({}, ISLOH_COURSE_DEFAULTS, source);
  merged.tags = Array.isArray(merged.tags) ? merged.tags : [];
  return merged;
}

/* Frontend yozuvini API shakliga. Statistik maydonlar (students, rating,
   revenue, completion, lessons) ATAYLAB yuborilmaydi — ularni server
   o'zi yuritadi va serializer ularni baribir rad etadi (read-only). */
function isloh_serializeCourse(course) {
  return {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category,
    level: course.level,
    language: course.language,
    tags: course.tags,
    free: course.free,
    price_cents: isloh_priceToCents(course.price),
    duration: course.duration,
    estimate: course.estimate,
    prerequisites: course.prerequisites,
    certificate: course.certificate,
    visibility: course.visibility,
    meta_title: course.metaTitle,
    meta_description: course.metaDescription,
    slug: course.slug,
    status: course.status,
    cover: course.cover,
    icon: course.icon
  };
}

const ISLOH_COURSE_CACHE = isloh_createStoreCache({
  key: ISLOH_COURSES_KEY,
  /* `/courses` EMAS: bu o'qituvchining O'Z kurslari. Talaba katalogi
     alohida endpoint (`/catalog`) va u sahifalanadi — ikkalasi bitta
     manzilda bo'lsa javob shakli ham, ruxsat qoidasi ham ziddiyatga
     tushardi (docs/BACKEND-PLAN.md §M2). */
  endpoint: '/instructor/courses',
  event: 'isloh:courses-updated',
  normalize: isloh_normalizeCourse,
  serialize: isloh_serializeCourse,
  seed: ISLOH_COURSE_SEED
});

function isloh_loadCourses()      { return ISLOH_COURSE_CACHE.load(); }
/* Kurs tarkibi o'zgargach chaqiriladi (js/content-store.js): dars soni
   endi SERVERDA hisoblanadi (`lessons_count`), shuning uchun uni frontend
   qo'lda yozib qo'ymaydi — kurs yozuvi qaytadan o'qiladi. Xato yutiladi:
   tarkib allaqachon saqlangan, kartochkadagi raqam esa keyingi yuklashda
   baribir to'g'rilanadi. */
function isloh_refreshCourses()   { return ISLOH_COURSE_CACHE.retry().catch(() => {}); }
function isloh_retryLoadCourses() { return ISLOH_COURSE_CACHE.retry(); }
function isloh_getCourses()       { return ISLOH_COURSE_CACHE.get(); }
function isloh_persistCourse(c)   { return ISLOH_COURSE_CACHE.persist(c); }

function isloh_getCourse(id) {
  if (!id) return null;
  return isloh_getCourses().find((c) => c.id === id) || null;
}

/* --- Yordamchilar --------------------------------------------------------- */

/* "Python Backend!" -> "python-backend". Lotin bo'lmagan belgilar tushadi. */
function isloh_slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* Noyob ID: slug band bo'lsa oxiriga raqam qo'shiladi. */
function isloh_uniqueCourseId(base, courses, ignoreId) {
  const taken = courses.filter((c) => c.id !== ignoreId).map((c) => c.id);
  const root = isloh_slugify(base) || 'kurs';
  if (taken.indexOf(root) === -1) return root;

  let n = 2;
  while (taken.indexOf(root + '-' + n) !== -1) n += 1;
  return root + '-' + n;
}

function isloh_todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* Provider tomonidagi pul birligi — USD: 1480 -> "$1,480". Kurslar ro'yxati,
   dashboard va profil statistikasi bir xil ko'rinishdan foydalanadi, shuning
   uchun format shu yerda — do'kon USD/UZS koeffitsientini bilgan joyda. */
function isloh_formatUsd(amount) {
  return '$' + Math.round(Number(amount) || 0).toLocaleString('en-US');
}

/* Bajarilish chizig'i rangi kurs holatidan kelib chiqadi (css/components.css).
   Kurslar ro'yxati ham, dashboard'dagi qoralamalar ro'yxati ham shu jadvalga
   tayanadi — ranglar ikki sahifada ajralib qolmasin. */
function isloh_courseFillClass(status) {
  if (status === 'draft') return ' fill-warning';
  if (status === 'archived') return ' fill-muted';
  return '';
}

/* "2026-08-02" -> "2 kun oldin". Ro'yxatdagi "Yangilangan" ustuni uchun. */
function isloh_relativeDate(value) {
  if (!value) return '—';
  const then = new Date(value);
  if (isNaN(then.getTime())) return String(value);

  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'Bugun';
  if (days === 1) return 'Kecha';
  if (days < 7) return days + ' kun oldin';
  if (days < 31) return Math.floor(days / 7) + ' hafta oldin';
  if (days < 365) return Math.floor(days / 30) + ' oy oldin';
  return String(then.getFullYear());
}

/* --- Yozish amallari ------------------------------------------------------ */

/* Bu uchtasi SINXRON qoladi — chaqiruvchilar (js/course-form.js,
   js/instructor-courses.js) natijani darhol kutadi. Tarmoq qismi fonda;
   xato bo'lsa isloh_persistCourse o'zi orqaga qaytaradi va toast chiqaradi,
   shuning uchun bu yerda promise yutiladi. */

function isloh_saveCourse(patch) {
  const courses = isloh_getCourses();
  const data = patch || {};
  const index = data.id ? courses.findIndex((c) => c.id === data.id) : -1;

  if (index === -1) {
    const course = isloh_normalizeCourse(data);
    // Vaqtinchalik id — server javobida o'z id'siga almashadi
    course.id = isloh_uniqueCourseId(data.id || data.slug || data.title, courses);
    course.slug = course.slug || course.id;
    course.createdAt = isloh_todayISO();
    course.updatedAt = course.createdAt;
    isloh_persistCourse(course).catch(() => {});
    return course;
  }

  const updated = isloh_normalizeCourse(Object.assign({}, courses[index], data));
  updated.updatedAt = isloh_todayISO();
  isloh_persistCourse(updated).catch(() => {});
  return updated;
}

function isloh_setCourseStatus(id, status) {
  if (!ISLOH_COURSE_STATUSES[status]) return null;
  return isloh_saveCourse({ id: id, status: status });
}

/* Optimistik o'chirish (fabrikada: rollback o'sha o'ringa qaytaradi). */
function isloh_deleteCourse(id) {
  return ISLOH_COURSE_CACHE.remove(id);
}

function isloh_duplicateCourse(id) {
  const courses = isloh_getCourses();
  const source = courses.find((c) => c.id === id);
  if (!source) return null;

  const copy = isloh_normalizeCourse(Object.assign({}, source));
  copy.title = source.title + ' (nusxa)';
  copy.id = isloh_uniqueCourseId(copy.title, courses);
  copy.slug = copy.id;
  copy.status = 'draft';
  copy.students = 0;
  copy.rating = 0;
  copy.revenue = 0;
  copy.createdAt = isloh_todayISO();
  copy.updatedAt = copy.createdAt;
  isloh_persistCourse(copy).catch(() => {});
  return copy;
}

/* Sahifadagi `[data-course-link="<sahifa>"]` havolalariga joriy kurs ID'sini
   qo'shadi — aks holda "Kurs tarkibi" yoki "Nashr etish" tugmasi qaysi kurs
   ochilganini bilmay qolardi. Bir nechta provider sahifasi ishlatadi. */
function isloh_applyCourseLinks(courseId) {
  if (!courseId) return;
  document.querySelectorAll('[data-course-link]').forEach((link) => {
    link.href = link.dataset.courseLink + '?id=' + encodeURIComponent(courseId);
  });
}

/* Zaxira: sahifa moduli o'z kursini o'zi bilmasa (masalan dars muharriri),
   havolalar URL'dagi `?course=` dan to'ldiriladi. Bu fayl sahifa
   modullaridan OLDIN yuklanadi, ya'ni modul keyinroq o'z aniqroq
   qiymatini qo'yib chiqadi.

   Ataylab faqat `?course=`: `?id=` sahifadan sahifaga turli narsani
   anglatadi (topshiriq muharririda — topshiriq, test muharririda — test),
   shuning uchun undan kurs id'si sifatida foydalanib bo'lmaydi. */
document.addEventListener('DOMContentLoaded', () => {
  isloh_applyCourseLinks(new URLSearchParams(window.location.search).get('course') || '');
});

/* --- Talaba katalogiga ko'prik -------------------------------------------

   M2 da OLIB TASHLANDI. Ilgari bu yerda uchta funksiya bor edi
   (`isloh_courseOwnedFields`, `isloh_courseToCatalogEntry`,
   `isloh_courseCatalogPatch`) va ular o'qituvchining kurslarini talaba
   katalogi sxemasiga o'girib, demo ro'yxat ustiga qo'yardi.

   Endi katalogning manbasi — server (`/catalog`, js/marketplace.js dagi
   `isloh_loadCatalog`). Bu do'kon esa faqat O'QITUVCHINING o'z kurslarini
   biladi (`/instructor/courses`), ya'ni u talaba katalogini yasay olmaydi
   ham: boshqa o'qituvchilarning kurslari bu yerda umuman yo'q. */

/* Talaba katalogiga chiqadigan kurslar — faqat nashr etilgan va ochiq.
   O'qituvchi tomonidagi statistika (profil, analitika, bozor) shu
   filtrdan foydalanadi. */
function isloh_getPublishedCourses() {
  return isloh_getCourses().filter((c) => c.status === 'published' && c.visibility !== 'private');
}
