/* ==========================================================================
   ISLOH — Izohlar do'koni  (pages/student/notes.html + course/lesson player)

   Ikki vazifasi bor — js/bookmarks.js bilan bir xil naqsh:
     1) ISLOH_NOTES_KEY do'koni: course-player.html darsga izoh yozadi,
        notes.html esa hammasini ro'yxat qilib ko'rsatadi. Shu sababli bu
        fayl faqat helper sifatida ham yuklanishi mumkin.
     2) notes.html gridini to'liq do'kondan chizish — sahifada statik demo
        kartochka qolmaydi.

   NEGA YASSI RO'YXAT: dastlab dars izohlari {courseId: {lessonId: {...}}}
   ko'rinishida edi, lekin notes.html da darsga bog'lanmagan shaxsiy
   izohlar ham bor. Yassi map ikkalasini ham bir xil saqlaydi; dars izohi
   uchun id deterministik (`courseId::lessonId`), shuning uchun pleer uni
   to'g'ridan-to'g'ri topa oladi.

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
function isloh_normalizeNote(note) {
  return Object.assign({
    id: '', title: '', text: '', source: 'personal',
    courseId: '', lessonId: '', courseTitle: '', lessonTitle: '',
    tags: [], scope: 'personal', favorite: false, pinned: false,
    updatedAt: new Date().toISOString()
  }, note || {});
}

/* Eski ichma-ich sxemani ({courseId: {lessonId: {text, updatedAt}}}) yassi
   ro'yxatga o'tkazadi — bir marta, birinchi o'qishda. */
function isloh_migrateNotes(raw) {
  const map = {};
  let changed = false;

  Object.keys(raw || {}).forEach((key) => {
    const value = raw[key];
    if (!value || typeof value !== 'object') return;

    if (typeof value.id === 'string' && value.id) { map[key] = value; return; }

    Object.keys(value).forEach((lessonId) => {
      const old = value[lessonId];
      if (!old || typeof old.text !== 'string') return;
      const id = isloh_lessonNoteId(key, lessonId);
      map[id] = isloh_normalizeNote({
        id, title: lessonId, text: old.text, source: 'lesson',
        courseId: key, lessonId, updatedAt: old.updatedAt
      });
      changed = true;
    });
  });

  return { map, changed };
}

function isloh_getNotes() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(ISLOH_NOTES_KEY)); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object') return {};

  const result = isloh_migrateNotes(raw);
  if (result.changed) isloh_setNotes(result.map);
  return result.map;
}

function isloh_setNotes(map) {
  try {
    localStorage.setItem(ISLOH_NOTES_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    return false; // kvota to'lgan
  }
}

function isloh_getNote(id) {
  if (!id) return null;
  return isloh_getNotes()[id] || null;
}

/* Yozuvni qo'shadi yoki yangilaydi. Mavjud yozuv ustiga birlashtiriladi,
   shuning uchun sevimli/qadalgan holati matn tahrirlanganda yo'qolmaydi. */
function isloh_upsertNote(note) {
  if (!note || !note.id) return false;
  const map = isloh_getNotes();
  const merged = isloh_normalizeNote(Object.assign({}, map[note.id], note));
  merged.updatedAt = new Date().toISOString();
  map[note.id] = merged;
  return isloh_setNotes(map);
}

function isloh_removeNote(id) {
  const map = isloh_getNotes();
  if (!map[id]) return true;
  delete map[id];
  return isloh_setNotes(map);
}

/* Qadalganlar tepada, keyin yangilanish vaqti bo'yicha yangidan eskiga */
function isloh_notesNewestFirst() {
  return Object.values(isloh_getNotes()).sort((a, b) => {
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

/* --- Dars izohlari uchun qulaylik ---------------------------------------- */

function isloh_getLessonNote(courseId, lessonId) {
  if (!courseId || !lessonId) return null;
  return isloh_getNote(isloh_lessonNoteId(courseId, lessonId));
}

/* Bo'sh matn yozuvni o'chiradi — do'kon bo'sh izohlar bilan to'lmasin */
function isloh_setLessonNote(courseId, lessonId, text, meta) {
  if (!courseId || !lessonId) return false;
  const id = isloh_lessonNoteId(courseId, lessonId);
  const trimmed = String(text || '').trim();
  if (!trimmed) return isloh_removeNote(id);

  return isloh_upsertNote(Object.assign({
    id, text: trimmed, source: 'lesson', courseId, lessonId, scope: 'personal'
  }, meta || {}));
}
