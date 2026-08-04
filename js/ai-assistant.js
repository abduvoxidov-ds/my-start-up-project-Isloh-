/* ==========================================================================
   ISLOH — AI Assistant registry  (Sprint 8A)
   Single source of truth for what the AI Drawer offers on each page —
   mirrors how js/navigation.js is the one place NAV_CONFIG lives. Include
   this BEFORE js/ai-panel.js (which reads ISLOH_AI_CONTEXTS to render the
   drawer) and js/ai-chat.js (which reads it to answer prompts).

   Markup contract used elsewhere on the page:
     [data-ai-drawer-trigger][data-ai-context="<key>"]  → opens the drawer
       scoped to one of the keys below
     [data-ai-quick] = "<context>:<templateKey>"         → inline action chip
       (e.g. next to an editor-toolbar) that opens the drawer AND immediately
       runs that one template, without the person retyping the prompt
     [data-ai-widget-toggle] → expands/collapses a sibling [data-ai-widget-more]
   ========================================================================== */

const ISLOH_AI_CONTEXTS = {
  'course-builder': {
    role: 'instructor',
    label: "Kurs tarkibi",
    templates: [
      { key:'outline',  icon:'bi-list-check',      title:"Kurs dasturini yaratish",        sub:"Modul va darslar tuzilishini AI yordamida shakllantiring",
        response:"<p><b>Taklif etilgan kurs dasturi:</b></p><ul><li>1-modul: Kirish va muhitni sozlash (4 dars)</li><li>2-modul: Asosiy tushunchalar (6 dars)</li><li>3-modul: Amaliy loyihalar (7 dars)</li><li>4-modul: Joylashtirish va yakunlash (4 dars)</li></ul>" },
      { key:'outcomes',  icon:'bi-bullseye',        title:"O'quv natijalarini taklif qilish", sub:"Kurs tavsifidan kelib chiqib natijalar ro'yxatini yaratadi",
        response:"<p><b>Taklif etilgan o'quv natijalari:</b></p><ul><li>Asosiy tushunchalarni mustaqil qo'llay olish</li><li>Amaliy loyiha qurish va joylashtirish</li><li>Keng tarqalgan xatolarni aniqlash va tuzatish</li></ul>" },
      { key:'seo',       icon:'bi-search',          title:"SEO tavsiyalari",                 sub:"Sarlavha va tavsifni qidiruv tizimlari uchun optimallashtiradi",
        response:"<p><b>SEO tavsiyalari:</b></p><ul><li>Sarlavhaga asosiy kalit so'zni oldinga qo'ying</li><li>Meta tavsifni 150-160 belgi oralig'ida saqlang</li><li>Slug'da defis bilan ajratilgan kalit so'zlardan foydalaning</li></ul>" }
    ]
  },
  'lesson-editor': {
    role: 'instructor',
    label: "Darsni tahrirlash",
    templates: [
      { key:'generate-lesson', icon:'bi-magic',        title:"Dars matnini yaratish",     sub:"Mavzu bo'yicha to'liq dars matnini shakllantiradi",
        response:"<p><b>Taklif etilgan dars matni:</b></p><p>Ushbu darsda siz asosiy tushunchalar bilan tanishasiz, amaliy misollar orqali mustahkamlaysiz va keyingi darsga tayyor bo'lasiz.</p>" },
      { key:'rewrite',   icon:'bi-arrow-repeat',    title:"Matnni qayta yozish",       sub:"Tanlangan matnni aniqroq va ravonroq qilib qayta tuzadi",
        response:"<p><b>Qayta yozilgan matn:</b></p><p>Ushbu bo'limda kursga umumiy kirish qilamiz: nimalarni o'rganishingiz, qanday amaliyot bajarilishi va yakunda erishiladigan natijalar haqida qisqacha to'xtalamiz.</p>" },
      { key:'improve',   icon:'bi-stars',           title:"Tavsifni yaxshilash",       sub:"Qisqa va jozibador tavsif variantlarini taklif qiladi",
        response:"<p><b>Yaxshilangan tavsif:</b></p><p>Docker asoslarini noldan boshlab, amaliy loyihalar orqali chuqur o'zlashtiring — konteynerlashtirish endi qo'rqinchli emas.</p>" },
      { key:'grammar',   icon:'bi-spellcheck',      title:"Grammatikani tekshirish",   sub:"Imlo va grammatik xatolarni aniqlaydi",
        response:"<p><b>Tekshiruv natijasi:</b></p><ul><li>2 ta imlo xatosi topildi va tuzatildi</li><li>1 ta uzun jumla ikkiga bo'lindi</li><li>Umumiy o'qilishi: Yaxshi</li></ul>" },
      { key:'title',     icon:'bi-type',            title:"Sarlavha takliflari",       sub:"Darsga bir nechta muqobil sarlavha taklif qiladi",
        response:"<p><b>Sarlavha takliflari:</b></p><ul><li>\"Kursga kirish: nimadan boshlaymiz?\"</li><li>\"Birinchi qadamlar\"</li><li>\"Boshlashdan oldin bilishingiz kerak bo'lganlar\"</li></ul>" }
    ]
  },
  'quiz-builder': {
    role: 'instructor',
    label: "Testlar",
    templates: [
      { key:'generate-quiz', icon:'bi-patch-question', title:"Test savollarini yaratish", sub:"Modul mavzusidan kelib chiqib savollar generatsiya qiladi",
        response:"<p><b>Taklif etilgan savollar:</b></p><ol><li>Docker image va konteyner o'rtasidagi farq nima?</li><li>Dockerfile'da <code>WORKDIR</code> nima uchun ishlatiladi?</li><li>Konteynerni fon rejimida ishga tushirish uchun qaysi bayroq ishlatiladi?</li></ol>" },
      { key:'difficulty',    icon:'bi-bar-chart',       title:"Qiyinlik darajasi tavsiyasi", sub:"Savollar to'plami uchun muvozanatli qiyinlik taqsimotini taklif qiladi",
        response:"<p><b>Tavsiya etilgan taqsimot:</b></p><ul><li>Oson — 40%</li><li>O'rta — 40%</li><li>Qiyin — 20%</li></ul>" }
    ]
  },
  'assignment-builder': {
    role: 'instructor',
    label: "Topshiriq loyihalari",
    templates: [
      { key:'generate-assignment', icon:'bi-file-earmark-text', title:"Topshiriq yaratish", sub:"Modul mavzusi asosida amaliy topshiriq taklif qiladi",
        response:"<p><b>Taklif etilgan topshiriq:</b></p><p>\"Web\" va \"db\" xizmatlarini o'z ichiga olgan <code>docker-compose.yml</code> faylini yarating. Talaba PostgreSQL konteynerini web ilova bilan bog'lashi kerak.</p>" },
      { key:'rubric',              icon:'bi-list-check',        title:"Baholash mezonlarini taklif qilish", sub:"Topshiriq uchun aniq baholash mezonlarini shakllantiradi",
        response:"<p><b>Baholash mezonlari:</b></p><ul><li>To'g'ri ishlaydigan Compose fayli — 50%</li><li>Kod tozaligi va izohlar — 20%</li><li>Muddatga rioya qilish — 30%</li></ul>" }
    ]
  },
  /* {lesson} va {course} — js/ai-chat.js javobni chizishdan oldin joriy
     dars/kurs nomiga almashtiradi. Ilgari javoblar qaysi dars ochilganidan
     qat'i nazar bir xil matnni qaytarardi. */
  'course-player': {
    role: 'student',
    label: "Kurs darsi",
    templates: [
      { key:'explain',    icon:'bi-lightbulb',   title:"Mavzuni tushuntirib ber",     sub:"Joriy darsni sodda tilda qayta tushuntiradi",
        response:"<p><b>{lesson}</b> — sodda tushuntirish:</p><p>Docker konteyneri — bu ilovangizni barcha kerakli fayllar bilan birga \"qadoqlab\", istalgan kompyuterda bir xil ishlashini ta'minlaydigan yengil, izolyatsiyalangan muhit.</p>" },
      { key:'summarize',  icon:'bi-card-text',   title:"Darsni qisqacha yozib ber",   sub:"Joriy darsning asosiy fikrlarini qisqartiradi",
        response:"<p><b>{lesson}</b> darsining qisqacha xulosasi ({course}):</p><ul><li>Docker konteynerlashtirish vositasi</li><li>Image — konteyner uchun andoza</li><li>Dockerfile orqali image yaratiladi</li></ul>" },
      { key:'notes',      icon:'bi-journal-text',title:"Izoh yozib ber",              sub:"Darsdan avtomatik konspekt tuzadi",
        response:"<p><b>{lesson}</b> bo'yicha avtomatik konspekt:</p><ul><li>Docker = konteynerlashtirish platformasi</li><li>Konteyner vs virtual mashina — resurslarni tejash</li><li>Keyingi darsda: Dockerfile yozish</li></ul>" },
      { key:'keypoints',  icon:'bi-stars',       title:"Asosiy fikrlarni ajrat",      sub:"Eng muhim 3-5 nuqtani ro'yxat qilib beradi",
        response:"<p><b>{lesson}</b> darsidagi asosiy fikrlar:</p><ol><li>Konteyner — izolyatsiyalangan muhit</li><li>Image — o'zgarmas andoza</li><li>Docker Hub — image'lar ombori</li></ol>" },
      { key:'practice',   icon:'bi-clipboard-check', title:"Amaliyot savollarini yarat", sub:"Darsga oid 3 ta amaliy savol tuzadi",
        response:"<p><b>{lesson}</b> bo'yicha amaliyot savollari:</p><ol><li>Konteynerni to'xtatish uchun qaysi buyruq ishlatiladi?</li><li>Image va konteyner farqini tushuntiring.</li><li>Docker Hub'dan image qanday yuklab olinadi?</li></ol>" },
      { key:'quizme',     icon:'bi-patch-question-fill', title:"Meni sinab ko'r (Quiz Me)", sub:"Darsdan bitta savol berib, javobingizni tekshiradi",
        response:"<p><b>{lesson}</b> bo'yicha savol: Docker image nima?</p><p class=\"ai-hint\">Javobingizni pastdagi maydonga yozing (demo rejimi — javob hozircha tekshirilmaydi).</p>" },
      { key:'flashcards', icon:'bi-layers',      title:"Fleshkartalar yarat",         sub:"Darsdan atama-ta'rif fleshkartalarini tuzadi",
        response:"__FLASHCARDS__" }
    ]
  },
  'learning-progress': {
    role: 'student',
    label: "O'quv jarayoni",
    templates: [
      { key:'studyplan', icon:'bi-calendar2-check', title:"Haftalik reja taklif qil",   sub:"Qolgan darslar asosida shaxsiy o'quv rejasi tuzadi",
        response:"<p><b>Haftalik reja taklifi:</b></p><ul><li>Dushanba–Chorshanba: 2-modul (Docker asoslari)</li><li>Payshanba: Amaliy topshiriq</li><li>Juma: Test va takrorlash</li></ul>" },
      { key:'weaktopics', icon:'bi-graph-down',      title:"Zaif mavzularni aniqla",     sub:"Past natijali test/mavzularni tahlil qiladi",
        response:"<p><b>Aniqlangan zaif mavzular:</b></p><span class=\"weak-topic-pill\">Docker Networking</span> <span class=\"weak-topic-pill\">Volumes</span>" },
      { key:'continue',   icon:'bi-play-circle',     title:"Keyingi darsni tavsiya qil", sub:"Progressga mos ravishda keyingi qadamni taklif qiladi",
        response:"<p><b>Tavsiya:</b> \"Docker image nima?\" darsidan davom eting — taxminan 9 daqiqa vaqt talab qiladi.</p>" }
    ]
  },
  'student-chat': {
    role: 'student',
    label: "AI Yordamchi",
    templates: [
      { key:'today-plan', icon:'bi-lightbulb-fill', title:"Bugun nima o'rganay?", sub:"O'quv rejangiz asosida bugungi darslarni taklif qiladi",
        response:"<p>Ajoyib reja! Bugungi darslar asosida quyidagilarni tavsiya qilaman:</p><ul><li>DRF Views va Serializers</li><li>Permissions bo'limi</li><li>Taxminiy vaqt: 1 soat 20 daqiqa</li></ul>" },
      { key:'focus-check', icon:'bi-clipboard-check', title:"E'tiborimni qanday tekshiray?", sub:"So'nggi sessiyalar asosida diqqat darajangizni tahlil qiladi",
        response:"<p>Mana DRF'da ValidationError ushlashning odatiy usuli — shu kabi amaliy mashqlar diqqatni sinash uchun yaxshi:</p><div class=\"code-block\"><div class=\"head\"><span>python</span><span><i class=\"bi bi-clipboard\"></i></span></div>def validate_email(self, value):\n    if User.objects.filter(email=value).exists():\n        raise serializers.ValidationError(\n            \"Bu email allaqachon ro'yxatdan o'tgan.\"\n        )\n    return value</div>" },
      { key:'motivation', icon:'bi-graph-up-arrow', title:"Motivatsiyani tahlil qil", sub:"So'nggi faollik va progressga qarab motivatsiya darajasini baholaydi",
        response:"<p><b>Motivatsiya tahlili:</b></p><ul><li>So'nggi 7 kunda faollik: yuqori</li><li>O'rtacha kunlik davomiylik: 42 daqiqa</li><li>Tavsiya: joriy sur'atni saqlang, kichik tanaffuslar bilan</li></ul>" }
    ]
  },
  'instructor-chat': {
    role: 'instructor',
    label: "AI Yordamchi",
    templates: [
      { key:'at-risk', icon:'bi-exclamation-triangle', title:"Xavf ostidagi talabalarni topib ber", sub:"Faolligi pasaygan talabalarni tahlil qilib topadi",
        response:"<p><b>Xavf ostidagi talabalar tahlili:</b></p><ul><li>4-bo'lim (Permissions & Auth): tark etish 34%</li><li>5 ta talaba 7 kundan beri faol emas</li><li>Umumiy yakunlash darajasi: 85%</li></ul>" },
      { key:'rubric-chat', icon:'bi-clipboard-check', title:"Topshiriq uchun rubrika tuz", sub:"Amaliy topshiriq uchun baholash mezonlarini shakllantiradi",
        response:"<p><b>Baholash mezonlari:</b></p><ul><li>To'g'ri ishlaydigan yechim — 50%</li><li>Kod tozaligi va izohlar — 20%</li><li>Muddatga rioya qilish — 30%</li></ul>" },
      { key:'improve-course', icon:'bi-graph-up-arrow', title:"Kursimni qanday yaxshilay?", sub:"Kurs statistikasiga asoslangan yaxshilash takliflari beradi",
        response:"<p><b>Tavsiyalar:</b></p><ul><li>4-bo'lim video darsini 2 qismga bo'ling (hozirgi 22 daqiqa juda uzun)</li><li>2-bo'limdagi test savollarini yangilang — o'tish darajasi past</li><li>Amaliy topshiriqlar sonini oshiring</li></ul>" }
    ]
  }
};

function isloh_aiContext(key) {
  return ISLOH_AI_CONTEXTS[key] || null;
}

function isloh_aiFindTemplate(contextKey, templateKey) {
  const ctx = isloh_aiContext(contextKey);
  if (!ctx) return null;
  return ctx.templates.find((t) => t.key === templateKey) || null;
}

/* --- Widget expand/collapse (Smart Widgets on Course Player / Learning
   Progress / Dashboard) --- */
function isloh_initAiWidgetToggles() {
  document.querySelectorAll('[data-ai-widget-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const more = btn.closest('.card')?.querySelector('[data-ai-widget-more]');
      if (!more) return;
      const show = more.hidden;
      more.hidden = !show;
      btn.innerHTML = show
        ? '<i class="bi bi-chevron-up"></i> Kamroq'
        : '<i class="bi bi-chevron-down"></i> Ko\'proq';
    });
  });
}

document.addEventListener('DOMContentLoaded', isloh_initAiWidgetToggles);
