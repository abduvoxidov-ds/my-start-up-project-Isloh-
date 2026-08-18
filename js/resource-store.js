/* ==========================================================================
   ISLOH — Resurslar do'koni  (`isloh_resources`)

   BITTA HAVZA, ikki ko'rinish:
     resource-manager.html  — BOSHQARISH (papkalar, yuklash, arxivlash,
                              o'chirish) — bitta kursning resurslari
     resource-library.html  — TANLASH (sevimlilar, kolleksiyalar, "Tanlash"
                              tugmasi) — barcha kurslar bo'ylab

   NEGA BU FAYL BOR: ikkala sahifa ham HTML ichiga qo'lda yozilgan
   kartochkalar bilan ishlardi va bir-biridan bexabar edi. Boshqaruvchida
   11 ta fayl IKKI MARTA (katakcha + jadval) yozilgan, kutubxonada esa
   boshqa 6 tasi — bir xil `architecture-diagram.png` ikkala ro'yxatda
   turli ma'lumot bilan ko'rinardi. Nusxalash, arxivlash va o'chirish
   faqat DOM'da bo'lardi; sevimli yulduzchasi ham sahifa yangilanishi
   bilan so'nardi. Papka kafellaridagi sonlar (18 / 9 / 4 / 6) va
   statistika (37 / 1.8 GB / 4 / 3) hech qanday faylga bog'liq emas edi.

   Naqsh js/assignment-store.js va js/quiz-store.js bilan bir xil
   (2- va 3-bosqich).

   HAJM `sizeKb` da butun son sifatida saqlanadi va faqat ko'rsatishda
   formatlanadi — "340 KB" matnini saqlash yig'indini hisoblashni
   imkonsiz qilardi.

   M5 (backend): manba endi `/instructor/resources`, `isloh_resources` esa
   OFFLINE NUSXA. Do'kon umumiy fabrikaga (`isloh_createStoreCache`)
   o'tkazildi va tashqi API'si O'ZGARMADI — sahifalar avvalgidek sinxron
   `isloh_getResources()` chaqiradi.

   IKKI MAYDONNI ENDI SERVER QO'YADI: `type` va `sizeKb`. Ular faylning
   o'zidan kelib chiqadi (apps/resources/serializers.py), shuning uchun
   bu yerdan yuborilmaydi — aks holda 4 KB lik matn fayli "PDF · 2 GB"
   bo'lib ko'rinishi va kutubxona statistikasi yolg'on ko'rsatishi mumkin
   edi. Fayl BAYTLARI ham bu do'konda emas: ular js/upload.js orqali uch
   qadamda saqlanadi va bu yerga faqat `fileId` bilan qaytadi.
   ========================================================================== */

const ISLOH_RESOURCES_KEY = 'isloh_resources';

/* Fayl turi -> ikonka, rang va yorliq. Ilgari har bir kartochkada
   `style="background:#DC2626"` qo'lda yozilardi (CLAUDE.md §2). */
const ISLOH_RESOURCE_TYPE_META = {
  pdf:          { icon: 'bi-file-earmark-pdf-fill',   bg: '#DC2626',        label: 'PDF' },
  zip:          { icon: 'bi-file-earmark-zip-fill',   bg: 'var(--ink-500)', label: 'ZIP' },
  video:        { icon: 'bi-camera-video-fill',       bg: '#0369A1',        label: 'Video' },
  audio:        { icon: 'bi-music-note-beamed',       bg: '#7C3AED',        label: 'Audio' },
  image:        { icon: 'bi-image-fill',              bg: '#0EA5E9',        label: 'Rasm' },
  presentation: { icon: 'bi-easel2-fill',             bg: '#EA580C',        label: 'Taqdimot' },
  spreadsheet:  { icon: 'bi-file-earmark-spreadsheet-fill', bg: '#059669',  label: 'Jadval' },
  document:     { icon: 'bi-file-earmark-word-fill',  bg: '#2563EB',        label: 'Hujjat' },
  code:         { icon: 'bi-file-earmark-code-fill',  bg: '#374151',        label: 'Kod' },
  url:          { icon: 'bi-link-45deg',              bg: '#14B8A6',        label: 'Tashqi havola' }
};

/* Papkalar — boshqaruvchidagi kafellar va kutubxonadagi qamrov tablari
   AYNI shu jadvaldan chiziladi, shuning uchun ular hech qachon farq
   qilmaydi. */
const ISLOH_RESOURCE_FOLDERS = {
  lessons:     { label: 'Dars resurslari',          icon: 'bi-journal-text',      bg: 'var(--violet-600)' },
  assignments: { label: 'Topshiriq resurslari',     icon: 'bi-file-earmark-text', bg: '#0EA5E9' },
  quizzes:     { label: 'Test resurslari',          icon: 'bi-patch-question',    bg: '#F59E0B' },
  general:     { label: 'Umumiy kurs resurslari',   icon: 'bi-mortarboard',       bg: 'var(--teach-green)' }
};

/* Kutubxonadagi kolleksiyalar kategoriya bo'yicha yig'iladi
   (js/question-store.js dagi kategoriya slug'lari bilan bir xil uslub). */
const ISLOH_RESOURCE_CATEGORIES = {
  python: { label: 'Python asoslari',  icon: 'bi-mortarboard-fill', bg: 'var(--violet-600)' },
  django: { label: 'Django va DRF',    icon: 'bi-database-fill',    bg: '#0EA5E9' },
  devops: { label: 'DevOps va Docker', icon: 'bi-box-fill',         bg: '#0F766E' },
  umumiy: { label: 'Umumiy',           icon: 'bi-folder-fill',      bg: 'var(--ink-500)' }
};

const ISLOH_RESOURCE_DEFAULTS = {
  id: '',
  courseId: 'py-101',
  fileId: '',         // saqlangan fayl (M5); tashqi havolada bo'sh
  downloadUrl: '',    // ruxsat tekshiradigan manzil, baytlarga to'g'ridan-to'g'ri emas
  name: '',
  type: 'pdf',
  folder: 'general',
  category: 'umumiy',
  sizeKb: 0,          // tashqi havolada 0
  url: '',
  favorite: false,
  status: 'active',   // active | archived
  uploadedAt: '',
  usedAt: ''          // "Oxirgi ishlatilgan" ro'yxati shu maydondan
};

function isloh_resShift(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isloh_resHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

/* Demo resurslar — ilgari resource-manager.html (11 ta) va
   resource-library.html (6 ta) markupiga alohida yozilgan fayllar. Bir xil
   nomdagilar (architecture-diagram.png) endi BITTA yozuv. */
function isloh_resourceSeed() {
  return [
    { id: 'res-docker-cheat',   name: 'Docker_cheat_sheet.pdf',      type: 'pdf',          folder: 'lessons',     category: 'devops', sizeKb: 340,   uploadedAt: isloh_resShift(-3),  usedAt: isloh_resHoursAgo(6) },
    { id: 'res-starter-files',  name: 'starter-files.zip',            type: 'zip',          folder: 'general',     category: 'python', sizeKb: 1229,  uploadedAt: isloh_resShift(-8),  usedAt: isloh_resHoursAgo(30) },
    { id: 'res-intro-video',    name: 'intro-video.mp4',              type: 'video',        folder: 'lessons',     category: 'python', sizeKb: 43008, uploadedAt: isloh_resShift(-12), usedAt: isloh_resHoursAgo(52) },
    { id: 'res-podcast-intro',  name: 'podcast-intro.mp3',            type: 'audio',        folder: 'lessons',     category: 'python', sizeKb: 8602,  uploadedAt: isloh_resShift(-14) },
    { id: 'res-architecture',   name: 'architecture-diagram.png',     type: 'image',        folder: 'general',     category: 'python', sizeKb: 220,   uploadedAt: isloh_resShift(-6),  favorite: true },
    { id: 'res-slides',         name: 'slides.pptx',                  type: 'presentation', folder: 'general',     category: 'python', sizeKb: 3174,  uploadedAt: isloh_resShift(-9) },
    { id: 'res-grading-sheet',  name: 'baholash-jadvali.xlsx',        type: 'spreadsheet',  folder: 'assignments', category: 'umumiy', sizeKb: 48,    uploadedAt: isloh_resShift(-4) },
    { id: 'res-transcript',     name: 'lesson-transcript.docx',       type: 'document',     folder: 'assignments', category: 'umumiy', sizeKb: 90,    uploadedAt: isloh_resShift(-5) },
    { id: 'res-docker-docs',    name: 'docs.docker.com',              type: 'url',          folder: 'general',     category: 'devops', url: 'https://docs.docker.com', uploadedAt: isloh_resShift(-20) },
    { id: 'res-grading-script', name: 'grading-script.py',            type: 'code',         folder: 'quizzes',     category: 'python', sizeKb: 6,     uploadedAt: isloh_resShift(-2) },
    { id: 'res-old-task',       name: 'eski-topshiriq-2024.pdf',      type: 'pdf',          folder: 'general',     category: 'umumiy', sizeKb: 210,   uploadedAt: isloh_resShift(-400), status: 'archived' },
    { id: 'res-starter-models', name: 'starter-models.zip',           type: 'zip',          folder: 'assignments', category: 'django', sizeKb: 220,   uploadedAt: isloh_resShift(-7),  usedAt: isloh_resHoursAgo(28) },

    /* Kutubxonadan kelgan, boshqaruvchida bo'lmagan yozuvlar */
    { id: 'res-python-cheat',   name: 'Python_cheat_sheet.pdf',       type: 'pdf',          folder: 'lessons',     category: 'python', sizeKb: 280,   uploadedAt: isloh_resShift(-16), favorite: true },
    { id: 'res-orm-intro',      name: 'django-orm-intro.mp4',         type: 'video',        folder: 'lessons',     category: 'django', sizeKb: 128000, courseId: 'django-rest-masterclass', uploadedAt: isloh_resShift(-18) },
    { id: 'res-compose-tpl',    name: 'docker-compose-template.yml',  type: 'code',         folder: 'general',     category: 'devops', sizeKb: 4,     uploadedAt: isloh_resShift(-11) },
    { id: 'res-django-docs',    name: 'docs.djangoproject.com',       type: 'url',          folder: 'general',     category: 'django', url: 'https://docs.djangoproject.com', courseId: 'django-rest-masterclass', uploadedAt: isloh_resShift(-22) },
    { id: 'res-devops-roadmap', name: 'devops-roadmap.pdf',           type: 'pdf',          folder: 'general',     category: 'devops', sizeKb: 1536,  uploadedAt: isloh_resShift(-25) },
    { id: 'res-rubric-pdf',     name: 'baholash-mezoni.pdf',          type: 'pdf',          folder: 'assignments', category: 'umumiy', sizeKb: 90,    uploadedAt: isloh_resShift(-7) }
  ];
}

/* --- Do'kon: server (M5) --------------------------------------------------
   Ilgari manba `isloh_resources` kaliti edi; endi u offline nusxa.
   Serverdagi shakl snake_case (`size_kb`, `used_at`), frontendniki
   camelCase — ikkalasi FAQAT quyidagi ikki funksiyada uchrashadi. */

function isloh_isServerResource(row) {
  return row && (('size_kb' in row) || ('used_at' in row) || ('download_url' in row));
}

function isloh_fromServerResource(row) {
  return {
    id: row.id,
    courseId: row.course,
    fileId: row.file || '',
    downloadUrl: row.download_url || '',
    name: row.name,
    type: row.type,
    folder: row.folder,
    category: row.category,
    sizeKb: row.size_kb || 0,
    url: row.url || '',
    favorite: !!row.favorite,
    status: row.status,
    uploadedAt: (row.created_at || '').slice(0, 10),
    usedAt: row.used_at || ''
  };
}

/* `type` va `sizeKb` YUBORILMAYDI — ularni server faylning o'zidan
   aniqlaydi (fayl boshidagi izoh). */
function isloh_serializeResource(resource) {
  const body = {
    name: resource.name,
    folder: resource.folder,
    category: resource.category,
    url: resource.url || '',
    favorite: !!resource.favorite,
    status: resource.status,
    used_at: resource.usedAt || null
  };
  if (resource.fileId) body.file = resource.fileId;

  /* Demo yozuvlarda `courseId` — slug (`py-101`), serverda esa UUID.
     Slug yuborilsa 400 bo'lardi, shuning uchun faqat haqiqiy kalit
     o'tkaziladi (js/assignment-store.js dagi bilan bir xil shart). */
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(resource.courseId || ''))) {
    body.course = resource.courseId;
  }
  return body;
}

function isloh_normalizeResource(resource) {
  const source = isloh_isServerResource(resource)
    ? isloh_fromServerResource(resource)
    : (resource || {});
  return Object.assign({}, ISLOH_RESOURCE_DEFAULTS, source);
}

const ISLOH_RESOURCE_CACHE = isloh_createStoreCache({
  key: ISLOH_RESOURCES_KEY,
  endpoint: '/instructor/resources',
  event: 'isloh:resources-updated',
  normalize: isloh_normalizeResource,
  serialize: isloh_serializeResource,
  seed: isloh_resourceSeed
});

function isloh_loadResources() { return ISLOH_RESOURCE_CACHE.load(); }
function isloh_getResources()  { return ISLOH_RESOURCE_CACHE.get(); }

function isloh_getResource(id) {
  if (!id) return null;
  return isloh_getResources().find((r) => r.id === id) || null;
}

/* Boshqaruvchi bitta kursning resurslarini ko'rsatadi, kutubxona esa
   hammasini — shuning uchun filtr ixtiyoriy. */
function isloh_getCourseResources(courseId) {
  if (!courseId) return isloh_getResources();
  return isloh_getResources().filter((r) => r.courseId === courseId);
}

function isloh_uniqueResourceId(base, list) {
  const taken = list.map((r) => r.id);
  const slug = typeof isloh_slugify === 'function' ? isloh_slugify(base) : '';
  const root = 'res-' + (slug || String(Date.now())).slice(0, 40);
  if (taken.indexOf(root) === -1) return root;

  let n = 2;
  while (taken.indexOf(root + '-' + n) !== -1) n += 1;
  return root + '-' + n;
}

/* Yaratadi yoki yangilaydi. Sinxron qaytadi (sahifalar shunga tayanadi),
   server javobi kelgach fabrika keshni yangilab hodisa yuboradi. */
function isloh_saveResource(patch) {
  const list = isloh_getResources();
  const data = patch || {};
  const index = data.id ? list.findIndex((r) => r.id === data.id) : -1;

  if (index === -1) {
    const resource = isloh_normalizeResource(data);
    resource.id = isloh_uniqueResourceId(data.name || 'resurs', list);
    resource.uploadedAt = isloh_resShift(0);
    ISLOH_RESOURCE_CACHE.persist(resource).catch(() => {});
    return resource;
  }

  const updated = isloh_normalizeResource(Object.assign({}, list[index], data));
  ISLOH_RESOURCE_CACHE.persist(updated).catch(() => {});
  return updated;
}

function isloh_deleteResource(id) {
  return ISLOH_RESOURCE_CACHE.remove(id);
}

/* Nusxa BAYTLARNI ko'chirmaydi — ikkala yozuv bitta `fileId` ga ishora
   qiladi. Fayl o'zgarmas (uni qayta yozib bo'lmaydi), shuning uchun
   ulashish xavfsiz va 200 MB lik arxiv ikki marta saqlanmaydi. */
function isloh_duplicateResource(id) {
  const list = isloh_getResources();
  const source = list.find((r) => r.id === id);
  if (!source) return null;

  const copy = isloh_normalizeResource(Object.assign({}, source));
  /* Nusxa nomi kengaytmadan OLDIN qo'shiladi: "slides (nusxa).pptx",
     "slides.pptx (nusxa)" emas. */
  const dot = source.name.lastIndexOf('.');
  copy.name = dot > 0
    ? source.name.slice(0, dot) + ' (nusxa)' + source.name.slice(dot)
    : source.name + ' (nusxa)';
  copy.id = isloh_uniqueResourceId(copy.name, list);
  copy.status = 'active';
  copy.favorite = false;
  copy.usedAt = '';
  copy.uploadedAt = isloh_resShift(0);

  ISLOH_RESOURCE_CACHE.persist(copy).catch(() => {});
  return copy;
}

function isloh_setResourceStatus(id, status) {
  if (status !== 'active' && status !== 'archived') return null;
  return isloh_saveResource({ id: id, status: status });
}

function isloh_moveResource(id, folder) {
  if (!ISLOH_RESOURCE_FOLDERS[folder]) return null;
  return isloh_saveResource({ id: id, folder: folder });
}

function isloh_toggleResourceFavorite(id) {
  const resource = isloh_getResource(id);
  if (!resource) return null;
  return isloh_saveResource({ id: id, favorite: !resource.favorite });
}

/* "Tanlash" bosilganda ishlatilgan vaqti yangilanadi — kutubxonadagi
   "Oxirgi ishlatilgan" ro'yxati shundan chiziladi. */
function isloh_markResourceUsed(id) {
  return isloh_saveResource({ id: id, usedAt: new Date().toISOString() });
}

/* --- Yordamchilar --------------------------------------------------------- */

function isloh_resourceTypeMeta(type) {
  return ISLOH_RESOURCE_TYPE_META[type] || ISLOH_RESOURCE_TYPE_META.document;
}

function isloh_resourceFolderMeta(folder) {
  return ISLOH_RESOURCE_FOLDERS[folder] || ISLOH_RESOURCE_FOLDERS.general;
}

function isloh_resourceCategoryMeta(category) {
  return ISLOH_RESOURCE_CATEGORIES[category] || ISLOH_RESOURCE_CATEGORIES.umumiy;
}

/* 340 -> "340 KB", 1229 -> "1.2 MB", 1258291 -> "1.2 GB". Tashqi havolada
   hajm yo'q — "—" qaytadi. */
function isloh_formatResourceSize(sizeKb) {
  const kb = Number(sizeKb) || 0;
  if (!kb) return '—';
  if (kb < 1024) return kb + ' KB';
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1).replace(/\.0$/, '') + ' MB';
  return (kb / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + ' GB';
}

/* Kartochka/qatordagi izoh qatori: "PDF · 340 KB" yoki "Tashqi havola". */
function isloh_resourceMetaLabel(resource) {
  const type = isloh_resourceTypeMeta(resource.type);
  if (resource.type === 'url') return type.label;
  return type.label + ' · ' + isloh_formatResourceSize(resource.sizeKb);
}

/* --- Hisoblanadigan qiymatlar --------------------------------------------- */

function isloh_resourceStats(courseId) {
  const list = isloh_getCourseResources(courseId);
  const active = list.filter((r) => r.status === 'active');

  return {
    total: active.length,
    size: isloh_formatResourceSize(active.reduce((sum, r) => sum + (r.sizeKb || 0), 0)),
    folders: Object.keys(ISLOH_RESOURCE_FOLDERS).length,
    archived: list.filter((r) => r.status === 'archived').length
  };
}

/* Kutubxona statistikasi — barcha kurslar bo'ylab. */
function isloh_libraryStats() {
  const active = isloh_getResources().filter((r) => r.status === 'active');
  return {
    total: active.length,
    collections: new Set(active.map((r) => r.category)).size,
    favorites: active.filter((r) => r.favorite).length,
    recent: active.filter((r) => r.usedAt).length
  };
}

/* Papkadagi fayllar soni — kafellardagi "N ta fayl" uchun. */
function isloh_folderCount(folder, courseId) {
  return isloh_getCourseResources(courseId)
    .filter((r) => r.status === 'active' && r.folder === folder).length;
}

function isloh_categoryCount(category) {
  return isloh_getResources()
    .filter((r) => r.status === 'active' && r.category === category).length;
}

/* Oxirgi ishlatilgan resurslar, eng yangisi tepada. */
function isloh_recentResources(limit) {
  return isloh_getResources()
    .filter((r) => r.status === 'active' && r.usedAt)
    .sort((a, b) => String(b.usedAt).localeCompare(String(a.usedAt)))
    .slice(0, limit || 3);
}
