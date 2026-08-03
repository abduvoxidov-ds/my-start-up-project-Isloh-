/* ==========================================================================
   ISLOH — Dars videosi pleeri  (2-bosqich)

   Ilgari "video" — bu gradient div, qotib qolgan "2:14 / 8:24" matni va CSS
   dan keladigan `width:38%` chizig'i edi; sahifada bitta ham <video>
   elementi yo'q edi. Bu modul o'sha maketni haqiqiy HTML5 media API bilan
   almashtiradi.

   MUHIM: butun sahifada BITTA <video> bo'ladi, dars almashganda faqat
   manba (src) o'zgaradi. Har bir dars uchun alohida <video> yaratilsa,
   brauzer har biri uchun dekoder va bufer ushlab turadi — bu aynan
   rendering bottleneck'ining klassik sababi.

   Markup shartnomasi (js/course-player.js chizadi):
     [data-video-stage]        → o'ram (to'liq ekran va klaviatura shu yerda)
     [data-lesson-video]       → <video>
     [data-video-bigplay]      → markazdagi katta tugma
     [data-video-controls]     → boshqaruvlar paneli
     [data-video-toggle]       → o'ynatish/pauza
     [data-video-seek="±10"]   → oldinga/orqaga
     [data-video-scrub]        → input[type=range], pozitsiya
     [data-video-current/duration] → vaqt
     [data-video-mute] / [data-video-volume]
     [data-video-speed]        → select, tezlik
     [data-video-captions]     → subtitr yoqish/o'chirish
     [data-video-pip] / [data-video-fullscreen]
     [data-video-loading] / [data-video-error] / [data-video-offline]

   Saqlanadigan holat: ISLOH_VIDEO_POS_KEY — { "courseId::lessonId": soniya }
   ========================================================================== */

const ISLOH_VIDEO_POS_KEY = 'isloh_video_positions';
const ISLOH_AUTOCOMPLETE_RATIO = 0.9;   // 90% ko'rilsa dars avtomat yakunlanadi
const ISLOH_CONTROLS_HIDE_MS = 3000;

let isloh_videoLesson = null;           // hozir yuklangan dars
let isloh_videoHideTimer = null;
let isloh_videoLastSaved = 0;

function isloh_videoEl() { return document.querySelector('[data-lesson-video]'); }
function isloh_videoStage() { return document.querySelector('[data-video-stage]'); }

/* --- Yordamchilar --------------------------------------------------------- */

function isloh_formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function isloh_videoShow(selector, on) {
  const el = document.querySelector(selector);
  if (el) el.hidden = !on;
}

function isloh_videoPosKey() {
  if (!isloh_videoLesson) return null;
  return String(isloh_videoLesson.courseId) + '::' + String(isloh_videoLesson.id);
}

function isloh_videoPositions() {
  try { return JSON.parse(localStorage.getItem(ISLOH_VIDEO_POS_KEY)) || {}; } catch (e) { return {}; }
}

function isloh_saveVideoPosition(seconds) {
  const key = isloh_videoPosKey();
  if (!key) return;
  const all = isloh_videoPositions();
  all[key] = Math.floor(seconds);
  // Kvota to'lsa jim o'tamiz — pozitsiya yo'qolishi darsni to'xtatmaydi
  try { localStorage.setItem(ISLOH_VIDEO_POS_KEY, JSON.stringify(all)); } catch (e) { /* ignored */ }
}

function isloh_getVideoPosition() {
  const key = isloh_videoPosKey();
  return key ? (isloh_videoPositions()[key] || 0) : 0;
}

/* --- Darsni yuklash ------------------------------------------------------- */

/* course-player.js dars almashganda chaqiradi. lesson = { id, courseId,
   src, poster, captions, title } */
function isloh_videoLoadLesson(lesson) {
  const video = isloh_videoEl();
  if (!video) return;

  // Avvalgi darsning pozitsiyasini yo'qotmaslik uchun — almashishdan oldin
  if (isloh_videoLesson && !video.paused) video.pause();
  if (isloh_videoLesson && video.currentTime > 0) isloh_saveVideoPosition(video.currentTime);

  isloh_videoLesson = lesson;
  isloh_videoLastSaved = 0;

  isloh_videoShow('[data-video-error]', false);
  video.poster = lesson.poster || '';

  // Subtitr trekini darsga moslaymiz (har bir video o'z .vtt fayliga ega).
  // Subtitri yo'q darsda CC tugmasi butunlay ko'rsatilmaydi.
  const track = video.querySelector('track');
  if (track) track.src = lesson.captions || '';
  isloh_videoShow('[data-video-captions]', !!lesson.captions);

  video.src = lesson.src || '';
  video.load();
}

/* --- Boshqaruvlar --------------------------------------------------------- */

function isloh_videoSyncToggle() {
  const video = isloh_videoEl();
  if (!video) return;
  const playing = !video.paused && !video.ended;

  document.querySelectorAll('[data-video-toggle]').forEach((btn) => {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-play-fill', !playing);
      icon.classList.toggle('bi-pause-fill', playing);
    }
    btn.setAttribute('aria-label', playing ? 'Pauza' : "O'ynatish");
  });
  isloh_videoShow('[data-video-bigplay]', !playing);
  isloh_videoStage()?.classList.toggle('is-playing', playing);
}

function isloh_videoTogglePlay() {
  const video = isloh_videoEl();
  if (!video || !video.src) return;
  if (video.paused) video.play().catch(() => { /* avtoplay to'silgan bo'lishi mumkin */ });
  else video.pause();
}

function isloh_videoSeekBy(delta) {
  const video = isloh_videoEl();
  if (!video || !isFinite(video.duration)) return;
  video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration);
}

/* Boshqaruvlar o'ynatish paytida 3 soniyadan keyin yashiriladi; sichqoncha
   qimirlasa yoki fokus ichkarida bo'lsa qaytadi. Fokus ichkarida bo'lganda
   YASHIRILMAYDI — aks holda klaviatura foydalanuvchisi ko'rinmaydigan
   tugmaga fokuslanib qolardi. */
function isloh_videoShowControls() {
  const stage = isloh_videoStage();
  if (!stage) return;
  stage.classList.remove('controls-hidden');
  clearTimeout(isloh_videoHideTimer);
  isloh_videoHideTimer = setTimeout(() => {
    const video = isloh_videoEl();
    if (!video || video.paused) return;
    if (stage.contains(document.activeElement)) return;
    stage.classList.add('controls-hidden');
  }, ISLOH_CONTROLS_HIDE_MS);
}

/* --- 90% qoidasi ---------------------------------------------------------- */

function isloh_videoMaybeAutoComplete(video) {
  if (!isFinite(video.duration) || !video.duration) return;
  if (video.currentTime / video.duration < ISLOH_AUTOCOMPLETE_RATIO) return;
  const row = document.querySelector('[data-cps-lesson].active');
  if (!row || row.classList.contains('is-done')) return;
  if (typeof isloh_markLessonDone !== 'function') return;

  if (isloh_markLessonDone(row) === true && typeof isloh_showToast === 'function') {
    isloh_showToast('Dars ko\'rildi — yakunlangan deb belgilandi', 'success');
  }
}

/* --- Klaviatura ----------------------------------------------------------- */

/* Matn kiritilayotgan joyda tezkor tugmalar ishlamasligi kerak — aks holda
   izoh yozayotganda "k" bosilsa video pauza bo'lib qolardi. */
function isloh_videoTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function isloh_initVideoKeyboard() {
  document.addEventListener('keydown', (e) => {
    const video = isloh_videoEl();
    if (!video || !video.src) return;
    if (isloh_videoTypingTarget(e.target)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const stage = isloh_videoStage();
    // Video ko'rinmayotgan bo'lsa (maqola/test darsi) — aralashmaymiz
    if (!stage || stage.hidden) return;

    const key = e.key.toLowerCase();
    const actions = {
      ' ': () => isloh_videoTogglePlay(),
      k: () => isloh_videoTogglePlay(),
      arrowright: () => isloh_videoSeekBy(5),
      arrowleft: () => isloh_videoSeekBy(-5),
      l: () => isloh_videoSeekBy(10),
      j: () => isloh_videoSeekBy(-10),
      arrowup: () => { video.volume = Math.min(1, video.volume + 0.1); },
      arrowdown: () => { video.volume = Math.max(0, video.volume - 0.1); },
      m: () => { video.muted = !video.muted; },
      f: () => isloh_videoToggleFullscreen(),
      c: () => isloh_videoToggleCaptions()
    };
    const run = actions[key];
    if (!run) return;
    e.preventDefault();
    run();
    isloh_videoShowControls();
  });
}

/* --- To'liq ekran / PiP / subtitr ------------------------------------------ */

function isloh_videoToggleFullscreen() {
  const stage = isloh_videoStage();
  if (!stage) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
}

/* Tugma holatini trekning HAQIQIY holatiga moslaydi. Kerak, chunki
   <track default> treki boshidanoq "showing" bo'ladi — tugmadagi
   aria-pressed="false" esa buni noto'g'ri ko'rsatib turardi. */
function isloh_videoSyncCaptionsBtn() {
  const video = isloh_videoEl();
  const track = video && video.textTracks && video.textTracks[0];
  const on = !!track && track.mode === 'showing';
  document.querySelectorAll('[data-video-captions]').forEach((btn) => {
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

function isloh_videoToggleCaptions() {
  const video = isloh_videoEl();
  const track = video && video.textTracks && video.textTracks[0];
  if (!track) return;
  track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
  isloh_videoSyncCaptionsBtn();
}

/* --- Asosiy ulanish ------------------------------------------------------- */

function isloh_initLessonVideo() {
  const video = isloh_videoEl();
  if (!video) return;

  const scrub = document.querySelector('[data-video-scrub]');
  const volume = document.querySelector('[data-video-volume]');

  /* --- Yuklanish holatlari --- */
  video.addEventListener('loadstart', () => {
    isloh_videoShow('[data-video-loading]', true);
    isloh_videoShow('[data-video-error]', false);
  });
  video.addEventListener('waiting', () => isloh_videoShow('[data-video-loading]', true));
  ['canplay', 'playing', 'pause'].forEach((ev) =>
    video.addEventListener(ev, () => isloh_videoShow('[data-video-loading]', false))
  );

  /* --- Xatoliklar: HTMLMediaElement.error kodlari bo'yicha aniq xabar --- */
  video.addEventListener('error', () => {
    isloh_videoShow('[data-video-loading]', false);
    isloh_videoShow('[data-video-error]', true);
    const codes = {
      1: 'Yuklash bekor qilindi.',
      2: "Tarmoq xatosi — internet aloqasini tekshiring.",
      3: "Videoni dekodlab bo'lmadi (fayl buzilgan bo'lishi mumkin).",
      4: "Bu video formati qo'llab-quvvatlanmaydi yoki fayl topilmadi."
    };
    const sub = document.querySelector('[data-video-error-sub]');
    if (sub) sub.textContent = codes[video.error && video.error.code] || "Noma'lum xatolik.";
  });

  document.querySelector('[data-video-retry]')?.addEventListener('click', () => {
    isloh_videoShow('[data-video-error]', false);
    video.load();
  });

  /* --- Vaqt, scrub va davom ettirish --- */
  video.addEventListener('loadedmetadata', () => {
    isloh_videoSyncCaptionsBtn();
    const dur = document.querySelector('[data-video-duration]');
    if (dur) dur.textContent = isloh_formatTime(video.duration);
    if (scrub) { scrub.max = String(Math.floor(video.duration) || 0); scrub.value = '0'; }

    /* Oxiriga yaqin joyda to'xtatilgan bo'lsa boshidan boshlaymiz — aks holda
       foydalanuvchi darsni qayta ochganda darhol tugagan videoni ko'radi. */
    const pos = isloh_getVideoPosition();
    if (pos > 5 && pos < video.duration - 10) {
      video.currentTime = pos;
      if (typeof isloh_showToast === 'function') {
        isloh_showToast('Qoldirgan joyingizdan davom etmoqda — ' + isloh_formatTime(pos), 'info');
      }
    }
  });

  video.addEventListener('timeupdate', () => {
    const cur = document.querySelector('[data-video-current]');
    if (cur) cur.textContent = isloh_formatTime(video.currentTime);
    if (scrub && document.activeElement !== scrub) scrub.value = String(Math.floor(video.currentTime));
    scrub?.setAttribute('aria-valuetext', isloh_formatTime(video.currentTime));

    const fill = document.querySelector('[data-video-progress]');
    if (fill && isFinite(video.duration) && video.duration) {
      fill.style.width = (video.currentTime / video.duration * 100) + '%';
    }

    // Pozitsiya har 5 soniyada saqlanadi — har timeupdate'da yozish ortiqcha
    if (video.currentTime - isloh_videoLastSaved >= 5) {
      isloh_videoLastSaved = video.currentTime;
      isloh_saveVideoPosition(video.currentTime);
      isloh_videoMaybeAutoComplete(video);
    }
  });

  video.addEventListener('ended', () => {
    isloh_saveVideoPosition(0);          // tugadi — keyingi safar boshidan
    isloh_videoMaybeAutoComplete(video);
    isloh_videoSyncToggle();
    isloh_videoShowControls();
  });

  scrub?.addEventListener('input', () => {
    video.currentTime = Number(scrub.value);
  });

  /* --- O'ynatish/pauza --- */
  ['play', 'pause'].forEach((ev) => video.addEventListener(ev, isloh_videoSyncToggle));
  document.querySelectorAll('[data-video-toggle], [data-video-bigplay]').forEach((btn) => {
    btn.addEventListener('click', isloh_videoTogglePlay);
  });
  video.addEventListener('click', isloh_videoTogglePlay);

  document.querySelectorAll('[data-video-seek]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_videoSeekBy(Number(btn.dataset.videoSeek)));
  });

  /* --- Ovoz --- */
  volume?.addEventListener('input', () => {
    video.volume = Number(volume.value);
    video.muted = Number(volume.value) === 0;
  });
  document.querySelector('[data-video-mute]')?.addEventListener('click', () => {
    video.muted = !video.muted;
  });
  video.addEventListener('volumechange', () => {
    const off = video.muted || video.volume === 0;
    if (volume && document.activeElement !== volume) volume.value = String(off ? 0 : video.volume);
    document.querySelectorAll('[data-video-mute]').forEach((btn) => {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-volume-up-fill', !off);
        icon.classList.toggle('bi-volume-mute-fill', off);
      }
      btn.setAttribute('aria-label', off ? 'Ovozni yoqish' : "Ovozni o'chirish");
    });
  });

  /* --- Tezlik: <select> tanlandi, chunki u klaviatura va skrin-rider bilan
     hech qanday qo'shimcha kodsiz to'g'ri ishlaydi (popup menyu uchun esa
     fokus boshqaruvini qo'lda yozish kerak bo'lardi). --- */
  document.querySelector('[data-video-speed]')?.addEventListener('change', (e) => {
    video.playbackRate = Number(e.target.value);
  });

  /* --- Subtitr / PiP / to'liq ekran --- */
  document.querySelector('[data-video-captions]')?.addEventListener('click', isloh_videoToggleCaptions);
  document.querySelector('[data-video-fullscreen]')?.addEventListener('click', isloh_videoToggleFullscreen);

  const pipBtn = document.querySelector('[data-video-pip]');
  if (pipBtn) {
    // Brauzer PiP'ni qo'llab-quvvatlamasa tugma umuman ko'rsatilmaydi
    if (!document.pictureInPictureEnabled) pipBtn.hidden = true;
    else pipBtn.addEventListener('click', () => {
      if (document.pictureInPictureElement) document.exitPictureInPicture();
      else video.requestPictureInPicture().catch(() => {});
    });
  }

  /* --- Boshqaruvlarni ko'rsatish/yashirish --- */
  const stage = isloh_videoStage();
  ['pointermove', 'pointerdown', 'focusin'].forEach((ev) =>
    stage?.addEventListener(ev, isloh_videoShowControls)
  );
  stage?.addEventListener('pointerleave', () => {
    if (!video.paused) stage.classList.add('controls-hidden');
  });

  /* --- Oflayn ko'rsatkichi --- */
  const syncOnline = () => isloh_videoShow('[data-video-offline]', !navigator.onLine);
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);
  syncOnline();

  /* --- Sahifa yopilganda oxirgi pozitsiyani yozib qolamiz --- */
  window.addEventListener('pagehide', () => {
    if (video.currentTime > 0) isloh_saveVideoPosition(video.currentTime);
  });

  isloh_initVideoKeyboard();
  isloh_videoSyncToggle();
}

document.addEventListener('DOMContentLoaded', isloh_initLessonVideo);
