/* ==========================================================================
   ISLOH — Izohlar do'koni  (pages/student/notes.html + course/lesson player)

   M3 da SERVERGA ulandi (`/student/notes`). Ilgari manba `isloh_notes`
   kaliti edi; endi u offline nusxa (CLAUDE.md §3 — `file://` da API yo'q).

   TASHQI API O'ZGARMADI: `isloh_getNotes()` hamon MAP qaytaradi va
   `isloh_upsertNote` qisman yamoqni qabul qiladi — js/notes.js va
   js/lesson-viewer.js ga tegilmadi. Ichkarida esa do'kon fabrikasining
   massivi turadi (js/api.js), map har chaqiruvda undan yasaladi.

   DARS IZOHI ID'SI O'ZGARDI: ilgari u deterministik edi
   (`courseId::lessonId`) va pleer izohni to'g'ridan-to'g'ri topardi. Endi
   id — serverning UUID'i, izoh esa `courseId` + `lessonId` MAYDONLARI
   bo'yicha topiladi. Serverda buni `UNIQUE(user, lesson)` cheklovi
   qo'riqlaydi (source='lesson' bo'lganda), ya'ni bitta darsga ikkita izoh
   yozib bo'lmaydi.

   Yozuv:
     { id, title, text, source: 'lesson' | 'personal',
       courseId, lessonId, courseTitle, lessonTitle,
       tags: [], scope: 'personal' | 'shared',
       favorite, pinned, updatedAt }
   ========================================================================== */

const ISLOH_NOTES_KEY = 'isloh_notes';

function isloh_lessonNoteId(courseId, lessonId) {
  return String(courseId) + '::' + String(lessonId);
}

/* Bo'sh maydonlarni to'ldiradi, shunda render har doim bir xil shakl bilan
   ishlaydi (do'konga qo'lda yozilgan yoki eski yozuvlar ham buzilmaydi) */
function isloh_noteDefaults(note) {
  return Object.assign({
    id: '', title: '', text: '', source: 'personal',
    courseId: '', lessonId: '', courseTitle: '', lessonTitle: '',
    tags: [], scope: 'personal', favorite: false, pinned: false,
    updatedAt: new Date().toISOString()
  }, note || {});
}

/* --- Shakl o'girish (API <-> frontend) ------------------------------------ */

function isloh_isServerNote(row) {
  return row && (('updated_at' in row) || ('lesson_title' in row));
}

function isloh_fromServerNote(row) {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    source: row.source,
    courseId: row.course || '',
    lessonId: row.lesson || '',
    courseTitle: row.course_title || '',
    lessonTitle: row.lesson_title || '',
    tags: row.tags || [],
    scope: row.scope,
    favorite: row.favorite,
    pinned: row.pinned,
    updatedAt: row.updated_at
  };
}

/* Faqat serverga tegishli maydonlar. `courseId`/`lessonId` UUID bo'lmasa
   (demo ma'lumot: `py-101`) umuman yuborilmaydi — aks holda server
   validatsiya xatosi berardi. */
function isloh_isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function isloh_serializeNote(note) {
  const body = {
    title: note.title,
    text: note.text,
    source: note.source,
    scope: note.scope,
    favorite: !!note.favorite,
    pinned: !!note.pinned,
    tags: note.tags || []
  };
  if (isloh_isUuid(note.courseId)) body.course = note.courseId;
  if (isloh_isUuid(note.lessonId)) body.lesson = note.lessonId;
  return body;
}

function isloh_normalizeNote(note) {
  const source = isloh_isServerNote(note) ? isloh_fromServerNote(note) : (note || {});
  const merged = isloh_noteDefaults(source);
  merged.tags = Array.isArray(merged.tags) ? merged.tags : [];
  return merged;
}

/* --- Eski shakldan ko'chirish ---------------------------------------------
   Do'kon fabrikasi `isloh_notes` kalitida MASSIV kutadi, eski nusxa esa
   MAP edi ({id: izoh}) — hatto undan ham eskisi ikki qavatli
   ({courseId: {lessonId: {...}}}). Massiv bo'lmasa fabrika `seed` ni
   chaqiradi, shuning uchun ko'chirish aynan shu yerda: foydalanuvchining
   mavjud izohlari offline nusxada yo'qolib ketmasin. */
function isloh_migrateStoredNotes() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(ISLOH_NOTES_KEY)); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  const list = [];
  Object.keys(raw).forEach((key) => {
    const value = raw[key];
    if (!value || typeof value !== 'object') return;

    // Yassi map: { "<id>": {id, text, ...} }
    if (typeof value.id === 'string' && value.id) {
      list.push(isloh_normalizeNote(value));
      return;
    }

    // Ikki qavatli: { "<courseId>": { "<lessonId>": {text, updatedAt} } }
    Object.keys(value).forEach((lessonId) => {
      const old = value[lessonId];
      if (!old || typeof old.text !== 'string') return;
      list.push(isloh_normalizeNote({
        id: isloh_lessonNoteId(key, lessonId),
        title: lessonId,
        text: old.text,
        source: 'lesson',
        courseId: key,
        lessonId: lessonId,
        updatedAt: old.updatedAt
      }));
    });
  });

  return list;
}

/* --- Do'kon --------------------------------------------------------------- */

const ISLOH_NOTE_CACHE = isloh_createStoreCache({
  key: ISLOH_NOTES_KEY,
  endpoint: '/student/notes',
  event: 'isloh:notes-updated',
  normalize: isloh_normalizeNote,
  serialize: isloh_serializeNote,
  seed: isloh_migrateStoredNotes
});

function isloh_loadNotes()      { return ISLOH_NOTE_CACHE.load(); }
function isloh_getNotesList()   { return ISLOH_NOTE_CACHE.get(); }

/* Tashqi API o'zgarmadi — MAP qaytaradi (js/notes.js shunga tayanadi) */
function isloh_getNotes() {
  const map = {};
  isloh_getNotesList().forEach((note) => { map[note.id] = note; });
  return map;
}

function isloh_getNote(id) {
  if (!id) return null;
  return isloh_getNotesList().find((n) => n.id === id) || null;
}

/* Yozuvni qo'shadi yoki yangilaydi. Mavjud yozuv ustiga birlashtiriladi,
   shuning uchun sevimli/qadalgan holati matn tahrirlanganda yo'qolmaydi —
   js/notes.js `{ id, favorite: true }` kabi QISMAN yamoq yuboradi. */
function isloh_upsertNote(patch) {
  if (!patch) return false;

  const existing = patch.id ? isloh_getNote(patch.id) : null;
  const merged = isloh_normalizeNote(Object.assign({}, existing, patch));
  merged.updatedAt = new Date().toISOString();

  // Yangi yozuv: vaqtinchalik id, server javobida o'z id'siga almashadi
  if (!existing) merged.id = merged.id || ('note-yangi-' + Date.now().toString(36));

  ISLOH_NOTE_CACHE.persist(merged).catch(() => {});
  return true;
}

function isloh_removeNote(id) {
  return ISLOH_NOTE_CACHE.remove(id);
}

/* Qadalganlar tepada, keyin yangilanish vaqti bo'yicha yangidan eskiga */
function isloh_notesNewestFirst() {
  return isloh_getNotesList().slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

/* Do'kondagi barcha teglar — notes.html teg filtri shundan chiziladi */
function isloh_notesAllTags() {
  const seen = [];
  isloh_notesNewestFirst().forEach((note) => {
    (note.tags || []).forEach((tag) => {
      const clean = String(tag).trim();
      if (clean && seen.indexOf(clean) === -1) seen.push(clean);
    });
  });
  return seen;
}

function isloh_parseNoteTags(value) {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/* --- Dars izohlari uchun qulaylik ----------------------------------------
   Endi id bo'yicha emas, MAYDONLAR bo'yicha topiladi (yuqoridagi izohga
   qarang): serverdagi id — UUID va uni pleer oldindan bila olmaydi. */

function isloh_getLessonNote(courseId, lessonId) {
  if (!courseId || !lessonId) return null;
  return isloh_getNotesList().find(
    (n) => n.source === 'lesson' && n.lessonId === lessonId && n.courseId === courseId
  ) || null;
}

/* Bo'sh matn yozuvni o'chiradi — do'kon bo'sh izohlar bilan to'lmasin */
function isloh_setLessonNote(courseId, lessonId, text, meta) {
  if (!courseId || !lessonId) return false;

  const existing = isloh_getLessonNote(courseId, lessonId);
  const trimmed = String(text || '').trim();

  if (!trimmed) return existing ? isloh_removeNote(existing.id) : true;

  return isloh_upsertNote(Object.assign({
    id: existing ? existing.id : '',
    text: trimmed,
    source: 'lesson',
    courseId: courseId,
    lessonId: lessonId,
    scope: 'personal'
  }, meta || {}));
}
