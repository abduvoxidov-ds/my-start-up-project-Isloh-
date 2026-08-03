/* ==========================================================================
   ISLOH — Pleer kurs ma'lumotlari  (2-bosqich)

   NEGA BU FAYL BOR: ilgari course-player.html da har bir dars uchun alohida
   `<div data-tab-panel>` qo'lda yozilgan edi — 8 ta dars, 8 ta takrorlangan
   markup bloki. course-detail.html esa "96 ta dars" deb va'da beradi: o'sha
   holatda sahifa ~2000 qatorga chiqar va brauzer 96 ta panelni (shu jumladan
   96 ta <video> elementini) bir vaqtda yuklashga majbur bo'lardi.

   Endi dars ro'yxati ham, dars mazmuni ham shu obyektdan chiziladi
   (js/course-player.js), sahifada esa faqat bitta <video> turadi.

   fetch() ishlatilmaydi (CLAUDE.md §3) — ma'lumot JS obyekti sifatida.
   Backend ulanganda faqat shu obyektning manbasi almashadi, tuzilma emas.

   Dars turlari:
     video      — src / poster / captions
     article    — html
     code       — label + html (kod bloki)
     quiz       — launch { title, sub, action }
     assignment — launch { title, sub, action }
   ========================================================================== */

/* Haqiqiy dars videolari media/ papkasiga qo'yiladi va quyidagi `src`
   yo'llari almashtiriladi. Hozircha hammasi bitta namuna faylga ishora
   qiladi — pleerni offline sinash uchun (CLAUDE.md: server shart emas). */
const ISLOH_SAMPLE_VIDEO = {
  src: '../../media/namuna-dars.webm',
  poster: '../../media/namuna-poster.svg',
  captions: '../../media/namuna-dars.uz.vtt'
};

const ISLOH_COURSE_DATA = {
  'docker-for-beginners': {
    id: 'docker-for-beginners',
    title: 'Docker for Beginners',
    modules: [
      {
        id: 'module-1',
        title: '1-modul: Kirish va sozlash',
        lessons: [
          Object.assign({ id: 'lesson-intro', type: 'video', title: 'Kursga kirish', duration: '8:24', done: true }, ISLOH_SAMPLE_VIDEO),
          {
            id: 'lesson-setup', type: 'article', title: 'Muhitni sozlash', duration: '12 daq', done: true,
            html: `<h2>Muhitni sozlash</h2>
                   <p>Ushbu darsda siz Docker, VS Code va Git'ni o'rnatasiz hamda birinchi konteyneringizni ishga tushirasiz.</p>
                   <h3>1-qadam: Docker Desktop o'rnatish</h3>
                   <p>Rasmiy saytdan operatsion tizimingizga mos versiyani yuklab oling va o'rnating.</p>`
          },
          Object.assign({ id: 'lesson-terminal', type: 'video', title: 'Terminal buyruqlari', duration: '10:05', done: true }, ISLOH_SAMPLE_VIDEO),
          Object.assign({ id: 'lesson-images', type: 'video', title: 'Docker image nima?', duration: '9:40' }, ISLOH_SAMPLE_VIDEO),
          {
            id: 'lesson-code', type: 'code', title: 'Birinchi Dockerfile', duration: '15 daq',
            label: 'Dockerfile',
            html: `<span class="cm"># Asosiy image</span><br><span class="kw">FROM</span> python:3.12-slim<br><span class="kw">WORKDIR</span> /app<br><span class="kw">COPY</span> . .<br><span class="kw">RUN</span> pip install -r requirements.txt<br><span class="kw">CMD</span> [<span class="st">"python"</span>, <span class="st">"app.py"</span>]`
          },
          {
            id: 'lesson-quiz1', type: 'quiz', title: 'Bilimni tekshirish: 1-modul', duration: '5 daq',
            launch: {
              sub: "10 ta savoldan iborat test. O'tish balli: 70%. Cheklanmagan urinish soni.",
              action: 'Testni boshlash', icon: 'bi-play-fill'
            }
          }
        ]
      },
      {
        id: 'module-2',
        title: '2-modul: Docker asoslari',
        collapsed: true,
        lessons: [
          Object.assign({ id: 'lesson-compose', type: 'video', title: 'Docker Compose kirish', duration: '11:20' }, ISLOH_SAMPLE_VIDEO),
          {
            id: 'lesson-assignment1', type: 'assignment', title: 'Amaliy topshiriq: Compose fayli', duration: '1 soat',
            launch: {
              sub: 'Ikki xizmatli (web + db) docker-compose.yml faylini yarating va topshiring. Muddat: 3 kun.',
              action: 'Topshiriqni ochish', icon: 'bi-upload'
            }
          }
        ]
      }
    ]
  }
};

/* Dars turi -> sidebar ikonkasi. Ranglar css/widgets.css dagi .lt-* bilan
   bir xil manbadan keladi (Lesson Builder bilan mos). */
const ISLOH_PLAYER_LESSON_ICONS = {
  video: { cls: 'lt-video', icon: 'bi-play-fill' },
  article: { cls: 'lt-article', icon: 'bi-file-text-fill' },
  code: { cls: 'lt-code', icon: 'bi-code-slash' },
  quiz: { cls: 'lt-quiz', icon: 'bi-patch-question-fill' },
  assignment: { cls: 'lt-assignment', icon: 'bi-file-earmark-text-fill' }
};

/* `?id=` bo'yicha kurs; topilmasa sahifadagi data-course-id, u ham
   bo'lmasa katalogdagi birinchi kurs — sahifa hech qachon bo'sh qolmaydi. */
function isloh_playerCourse(fallbackId) {
  const fromQuery = new URLSearchParams(window.location.search).get('id');
  return ISLOH_COURSE_DATA[fromQuery]
      || ISLOH_COURSE_DATA[fallbackId]
      || ISLOH_COURSE_DATA[Object.keys(ISLOH_COURSE_DATA)[0]]
      || null;
}

/* Modullar ichidagi darslarni bitta yassi ro'yxatga yig'adi — tartib
   raqami, "Dars N / M" va Oldingi/Keyingi shu ro'yxat bo'yicha ishlaydi. */
function isloh_flatLessons(course) {
  if (!course) return [];
  return course.modules.reduce((acc, mod) => acc.concat(
    mod.lessons.map((lesson) => Object.assign({ moduleId: mod.id, moduleTitle: mod.title }, lesson))
  ), []);
}

function isloh_findLesson(course, lessonId) {
  return isloh_flatLessons(course).find((l) => l.id === lessonId) || null;
}
