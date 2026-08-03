/* ==========================================================================
   ISLOH — Dars transkripti  (3-bosqich)

   Sharhda aytilgan "qolgan eng qimmatli funksiya": video matni ro'yxat
   ko'rinishida ko'rsatiladi, qatorni bosish videoni o'sha joyga olib
   boradi, o'ynayotgan qator esa ajratib turiladi.

   MUHIM: alohida ma'lumot manbai YO'Q. Transkript videoning o'z subtitr
   trekidan (WebVTT cues) chiziladi — ya'ni bitta .vtt fayl ham subtitr,
   ham transkript, ham dars ichidagi qidiruv uchun xizmat qiladi. Shu bois
   o'qituvchi qo'shimcha hech narsa yozmaydi.

   Markup shartnomasi:
     [data-transcript-list]   → qatorlar shu yerga chiziladi
     [data-transcript-empty]  → video bo'lmagan/subtitri yo'q darsda ko'rinadi
     [data-transcript-search] → ixtiyoriy qidiruv maydoni
   ========================================================================== */

function isloh_transcriptEls() {
  return {
    list: document.querySelector('[data-transcript-list]'),
    empty: document.querySelector('[data-transcript-empty]'),
    search: document.querySelector('[data-transcript-search]')
  };
}

function isloh_transcriptCues() {
  const video = document.querySelector('[data-lesson-video]');
  const track = video && video.textTracks && video.textTracks[0];
  // mode "disabled" bo'lsa brauzer cue'larni umuman yuklamaydi
  if (track && track.mode === 'disabled') track.mode = 'hidden';
  return track && track.cues ? [...track.cues] : [];
}

function isloh_renderTranscript() {
  const { list, empty, search } = isloh_transcriptEls();
  if (!list) return;

  const stage = document.querySelector('[data-video-stage]');
  const isVideoLesson = stage && !stage.hidden;
  const cues = isVideoLesson ? isloh_transcriptCues() : [];

  list.textContent = '';
  if (empty) empty.hidden = cues.length > 0;
  if (search) search.hidden = cues.length === 0;
  if (!cues.length) return;

  cues.forEach((cue) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tr-line';
    row.dataset.trStart = String(cue.startTime);
    row.innerHTML = `<span class="tr-time"></span><span class="tr-text"></span>`;
    row.querySelector('.tr-time').textContent = isloh_formatTime(cue.startTime);
    // Cue matni HTML sifatida talqin qilinmasin
    row.querySelector('.tr-text').textContent = cue.text.replace(/<[^>]+>/g, '');
    list.appendChild(row);
  });
}

/* O'ynayotgan qatorni ajratadi va ko'rinish maydoniga suradi.
   `scrollIntoView` faqat ro'yxat ichida ishlaydi (block:'nearest') —
   aks holda butun sahifa sakrab ketardi. */
function isloh_highlightTranscript() {
  const video = document.querySelector('[data-lesson-video]');
  const track = video && video.textTracks && video.textTracks[0];
  const active = track && track.activeCues && track.activeCues[0];
  const list = document.querySelector('[data-transcript-list]');
  if (!list) return;

  list.querySelectorAll('.tr-line').forEach((row) => {
    const on = !!active && Number(row.dataset.trStart) === active.startTime;
    row.classList.toggle('active', on);
    if (on) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
    if (on && !isloh_transcriptUserScrolling) row.scrollIntoView({ block: 'nearest' });
  });
}

/* Foydalanuvchi transkriptni o'zi aylantirayotganda avtomatik surish
   to'xtaydi — aks holda o'qiyotgan joyidan uzluksiz otib yuborardi. */
let isloh_transcriptUserScrolling = false;
let isloh_transcriptScrollTimer = null;

function isloh_initTranscript() {
  const { list, search } = isloh_transcriptEls();
  if (!list) return;

  // Qatorni bosish -> videoni o'sha joyga olib borish
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.tr-line');
    const video = document.querySelector('[data-lesson-video]');
    if (!row || !video) return;
    video.currentTime = Number(row.dataset.trStart);
    if (video.paused) video.play().catch(() => {});
  });

  list.addEventListener('scroll', () => {
    isloh_transcriptUserScrolling = true;
    clearTimeout(isloh_transcriptScrollTimer);
    isloh_transcriptScrollTimer = setTimeout(() => { isloh_transcriptUserScrolling = false; }, 4000);
  }, { passive: true });

  // Dars ichidagi qidiruv — transkriptning ikkinchi foydasi
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    list.querySelectorAll('.tr-line').forEach((row) => {
      const text = row.querySelector('.tr-text').textContent.toLowerCase();
      row.hidden = q.length > 0 && !text.includes(q);
    });
  });

  const video = document.querySelector('[data-lesson-video]');
  if (video) {
    // Cue'lar .vtt yuklangandan keyin paydo bo'ladi
    video.querySelector('track')?.addEventListener('load', isloh_renderTranscript);
    video.addEventListener('loadedmetadata', isloh_renderTranscript);
    const track = video.textTracks && video.textTracks[0];
    track?.addEventListener('cuechange', isloh_highlightTranscript);
  }

  // Dars almashganda qayta chiziladi (video bo'lmasa — bo'sh holat)
  document.addEventListener('isloh:lesson-change', () => {
    isloh_transcriptUserScrolling = false;
    isloh_renderTranscript();
  });

  isloh_renderTranscript();
}

document.addEventListener('DOMContentLoaded', isloh_initTranscript);
