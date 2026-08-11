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
  /* To'liq sahifali AI Yordamchi kontekstlari (student-chat / instructor-chat).
     Drawer kontekstlaridan farqi — ular bitta ekranga bog'lanmagan, shuning
     uchun shablonlar ro'yxati kengroq va `group` bo'yicha bo'lingan.

     `match` — erkin matnni shablonga yo'naltirish uchun kalit so'zlar
     (js/ai-chat.js `isloh_aiMatchTemplate`). Sarlavhadan avtomatik chiqarish
     ham bor, lekin o'zbek tilida qo'shimchalar ko'p ("kursimni", "rejaga"),
     shu bois o'zak so'zlar shu yerda ochiq yoziladi. */
  'student-chat': {
    role: 'student',
    label: "AI Yordamchi",
    templates: [
      { key:'today-plan', icon:'bi-lightbulb-fill', group:"Kundalik", title:"Bugun nima o'rganay?", sub:"O'quv rejangiz asosida bugungi darslarni taklif qiladi",
        match:['bugun','nima o\'rgan','reja','boshla'],
        response:"<p>Ajoyib reja! Bugungi darslar asosida quyidagilarni tavsiya qilaman:</p><ul><li>DRF Views va Serializers</li><li>Permissions bo'limi</li><li>Taxminiy vaqt: 1 soat 20 daqiqa</li></ul>" },
      { key:'focus-check', icon:'bi-clipboard-check', group:"Kundalik", title:"E'tiborimni qanday tekshiray?", sub:"So'nggi sessiyalar asosida diqqat darajangizni tahlil qiladi",
        match:['e\'tibor','diqqat','fokus','charcha'],
        response:"<p>Mana DRF'da ValidationError ushlashning odatiy usuli — shu kabi amaliy mashqlar diqqatni sinash uchun yaxshi:</p><div class=\"code-block\"><div class=\"head\"><span>python</span><span><i class=\"bi bi-clipboard\"></i></span></div>def validate_email(self, value):\n    if User.objects.filter(email=value).exists():\n        raise serializers.ValidationError(\n            \"Bu email allaqachon ro'yxatdan o'tgan.\"\n        )\n    return value</div>" },
      { key:'motivation', icon:'bi-graph-up-arrow', group:"Kundalik", title:"Motivatsiyani tahlil qil", sub:"So'nggi faollik va progressga qarab motivatsiya darajasini baholaydi",
        match:['motivatsiya','ruhiy','tashla','davom eta'],
        response:"<p><b>Motivatsiya tahlili:</b></p><ul><li>So'nggi 7 kunda faollik: yuqori</li><li>O'rtacha kunlik davomiylik: 42 daqiqa</li><li>Tavsiya: joriy sur'atni saqlang, kichik tanaffuslar bilan</li></ul>" },

      { key:'explain-topic', icon:'bi-lightbulb', group:"O'rganish", title:"Mavzuni sodda tilda tushuntir", sub:"Tushunmagan tushunchani boshqacha misollar bilan qayta tushuntiradi",
        match:['tushuntir','tushunmadim','sodda','nima degani','ma\'nosi'],
        response:"<p><b>Sodda tushuntirish:</b></p><p>Serializer — bu tarjimon. Django obyekti (Python) bilan JSON (brauzer tushunadigan matn) o'rtasida ikki tomonlama tarjima qiladi: chiqishda obyektni JSON'ga, kirishda JSON'ni tekshirib obyektga aylantiradi.</p><p>Shuning uchun validatsiya ham aynan serializer ichida yoziladi — u \"chegaradagi nazorat punkti\".</p>" },
      { key:'practice-me', icon:'bi-patch-question', group:"O'rganish", title:"Mashq savollari ber", sub:"So'nggi o'rganilgan mavzu bo'yicha 3 ta savol tuzadi",
        match:['mashq','savol','sinab','test qil','tekshir'],
        response:"<p><b>Mashq savollari:</b></p><ol><li>ModelSerializer va Serializer o'rtasidagi asosiy farq nima?</li><li><code>validate_&lt;field&gt;</code> metodi qachon chaqiriladi?</li><li>Nested serializer'da <code>many=True</code> nimani anglatadi?</li></ol><p class=\"ai-hint\">Javoblaringizni yozing — demo rejimda tekshirilmaydi, lekin o'zingizni sinash uchun foydali.</p>" },
      { key:'exam-plan', icon:'bi-calendar2-check', group:"O'rganish", title:"Imtihonga tayyorgarlik rejasi", sub:"Qolgan vaqtga qarab takrorlash jadvalini tuzadi",
        match:['imtihon','tayyorgarlik','takrorla','jadval'],
        response:"<p><b>2 haftalik takrorlash rejasi:</b></p><ul><li>1-hafta: nazariya + qisqa konspektlar (kuniga 40 daqiqa)</li><li>2-hafta: faqat amaliyot va eski testlar (kuniga 1 soat)</li><li>Oxirgi 2 kun: yangi mavzu yo'q, faqat zaif joylarni takrorlash</li></ul>" },

      { key:'week-summary', icon:'bi-card-text', group:"Xulosa", title:"Shu haftani xulosala", sub:"Hafta davomida o'rganilganlarni qisqa xulosaga jamlaydi",
        match:['hafta','xulosa','qisqacha','umumiy'],
        response:"<p><b>Haftalik xulosa:</b></p><ul><li>Yakunlangan darslar: 7 ta</li><li>Umumiy vaqt: 4 soat 55 daqiqa</li><li>Eng ko'p vaqt ketgan mavzu: Permissions</li><li>Yakunlanmagan: 1 ta topshiriq</li></ul>" },
      { key:'next-course', icon:'bi-signpost-split', group:"Xulosa", title:"Keyin qaysi kursni olay?", sub:"Tugatgan kurslaringizga mos keyingi qadamni taklif qiladi",
        match:['keyin','qaysi kurs','tavsiya qil','nima olay'],
        response:"<p><b>Keyingi qadam uchun tavsiya:</b></p><ul><li>\"Django REST: Advanced\" — joriy bilimingizning tabiiy davomi</li><li>\"PostgreSQL optimallashtirish\" — backend yo'nalishini mustahkamlaydi</li><li>\"Docker for Beginners\" — loyihani joylashtirish uchun</li></ul>" }
    ]
  },
  'instructor-chat': {
    role: 'instructor',
    label: "AI Yordamchi",
    templates: [
      { key:'at-risk', icon:'bi-exclamation-triangle', group:"Talabalar", title:"Xavf ostidagi talabalarni topib ber", sub:"Faolligi pasaygan talabalarni tahlil qilib topadi",
        match:['xavf','faol emas','tashlab','tark et','yo\'qolgan'],
        response:"<p><b>Xavf ostidagi talabalar tahlili:</b></p><ul><li>4-bo'lim (Permissions & Auth): tark etish 34%</li><li>5 ta talaba 7 kundan beri faol emas</li><li>Umumiy yakunlash darajasi: 85%</li></ul>" },
      { key:'nudge-message', icon:'bi-send', group:"Talabalar", title:"Faol bo'lmagan talabaga xabar yoz", sub:"Bosim o'tkazmaydigan, qisqa eslatma matnini tayyorlaydi",
        match:['xabar yoz','eslatma','murojaat','yozib ber'],
        response:"<p><b>Taklif etilgan xabar:</b></p><p>Assalomu alaykum! Kursda bir muddat ko'rinmadingiz — hammasi joyidami? 4-bo'lim biroz og'irroq, shuning uchun u yerda to'xtab qolish odatiy hol. Savolingiz bo'lsa yozing, birga ko'rib chiqamiz.</p>" },
      { key:'review-reply', icon:'bi-star', group:"Talabalar", title:"Sharhga javob yozib ber", sub:"Tanqidiy sharhga xotirjam va foydali javob tuzadi",
        match:['sharh','izoh','javob yoz','reyting','baho berdi'],
        response:"<p><b>Taklif etilgan javob:</b></p><p>Fikringiz uchun rahmat — 4-bo'lim haqiqatan uzunroq chiqqan. Uni ikkiga bo'lib, amaliy misollar qo'shmoqdaman. Yangilanish tayyor bo'lgach, sizga xabar beraman.</p>" },

      { key:'rubric-chat', icon:'bi-clipboard-check', group:"Kurs ustida ish", title:"Topshiriq uchun rubrika tuz", sub:"Amaliy topshiriq uchun baholash mezonlarini shakllantiradi",
        match:['rubrika','mezon','baholash','ball'],
        response:"<p><b>Baholash mezonlari:</b></p><ul><li>To'g'ri ishlaydigan yechim — 50%</li><li>Kod tozaligi va izohlar — 20%</li><li>Muddatga rioya qilish — 30%</li></ul>" },
      { key:'improve-course', icon:'bi-graph-up-arrow', group:"Kurs ustida ish", title:"Kursimni qanday yaxshilay?", sub:"Kurs statistikasiga asoslangan yaxshilash takliflari beradi",
        match:['yaxshila','kurs','takomil','nima qilay'],
        response:"<p><b>Tavsiyalar:</b></p><ul><li>4-bo'lim video darsini 2 qismga bo'ling (hozirgi 22 daqiqa juda uzun)</li><li>2-bo'limdagi test savollarini yangilang — o'tish darajasi past</li><li>Amaliy topshiriqlar sonini oshiring</li></ul>" },
      { key:'lesson-ideas', icon:'bi-lightbulb', group:"Kurs ustida ish", title:"Yangi dars mavzularini taklif qil", sub:"Mavjud kursga mos qo'shimcha mavzular ro'yxatini beradi",
        match:['yangi dars','mavzu','g\'oya','qo\'shsam'],
        response:"<p><b>Taklif etilgan mavzular:</b></p><ul><li>Throttling va rate limiting</li><li>JWT bilan autentifikatsiya</li><li>API versiyalash strategiyalari</li><li>Testlarni CI'da avtomatlashtirish</li></ul>" },

      { key:'weekly-report', icon:'bi-bar-chart', group:"Hisobot", title:"Haftalik xulosa tayyorla", sub:"Kurs statistikasini qisqa hisobotga jamlaydi",
        match:['hisobot','hafta','xulosa','statistika'],
        response:"<p><b>Haftalik hisobot:</b></p><ul><li>Yangi ro'yxatdan o'tganlar: 12 ta</li><li>Yakunlangan darslar: 348 ta</li><li>O'rtacha sharh bahosi: 4.7</li><li>Javobsiz savollar: 3 ta</li></ul>" },
      { key:'announcement', icon:'bi-megaphone', group:"Hisobot", title:"Talabalarga e'lon matnini yoz", sub:"Kurs yangilanishi haqidagi e'lonni tayyorlaydi",
        match:['e\'lon','xabarnoma','announcement','ogohlantir'],
        response:"<p><b>Taklif etilgan e'lon:</b></p><p>Salom! Kursga 3 ta yangi dars qo'shildi: throttling, JWT va API versiyalash. Ular 5-bo'lim ichida — allaqachon sotib olganlar uchun bepul. Savollaringizni Muhokama bo'limiga yozing.</p>" }
    ]
  }
};

/* JS ichida yasaladigan matnlar uchun tarjima (js/i18n.js `isloh_tx`).
   Aynan shu faylda, chunki u AI fayllaridan birinchi yuklanadi —
   js/ai-panel.js drawer markupini parse vaqtida yasaydi va o'sha paytda
   js/ai-chat.js hali yuklanmagan bo'ladi. i18n.js ulanmagan sahifada ham
   yiqilmaydi: o'zbekcha matn qaytadi. */
function isloh_aiT(key, uz, vars) {
  if (typeof isloh_tx === 'function') return isloh_tx(key, uz, vars);
  if (!vars) return uz;
  return String(uz).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/* Shablon matnlari tarjimasi. Kalitlar shablon `key`idan tuziladi —
   ular butun registr bo'ylab noyob, shuning uchun kontekst prefiksi shart
   emas. Tarjimasi bo'lmagan shablon o'zbekcha qolaveradi. */
function isloh_aiTplTitle(t) { return isloh_aiT('ai.tpl.' + t.key + '.title', t.title); }
function isloh_aiTplSub(t) { return isloh_aiT('ai.tpl.' + t.key + '.sub', t.sub); }

function isloh_aiContext(key) {
  return ISLOH_AI_CONTEXTS[key] || null;
}

function isloh_aiFindTemplate(contextKey, templateKey) {
  const ctx = isloh_aiContext(contextKey);
  if (!ctx) return null;
  return ctx.templates.find((t) => t.key === templateKey) || null;
}

/* --- Shablon kartochkalari ----------------------------------------------
   Bu ikki render funksiyasi ilgari js/ai-panel.js ichida edi, ya'ni faqat
   drawer'da ishlatilardi. To'liq sahifali AI Yordamchi esa xuddi shu
   kartochkalarni markupda QO'LDA takrorlardi (CLAUDE.md §2 DRY). Endi
   ular registr yonida — drawer ham, to'liq sahifa ham shu yerdan oladi. */

function isloh_aiRenderSuggestCard(t) {
  return `<button class="suggest-card" type="button" data-ai-run="${t.key}"><i class="bi ${t.icon}"></i><div class="txt">${isloh_aiTplTitle(t)}</div></button>`;
}

function isloh_aiRenderPromptCard(t) {
  return `<button class="ai-prompt-card" type="button" data-ai-run="${t.key}">
    <i class="bi ${t.icon}"></i>
    <div><div class="apc-title">${isloh_aiTplTitle(t)}</div><div class="apc-sub">${isloh_aiTplSub(t)}</div></div>
  </button>`;
}

/* Shablonlarni `group` bo'yicha bo'lib chizadi. Guruhsiz kontekstlarda
   (drawer kontekstlari) bitta sarlavhasiz blok qaytadi. */
function isloh_aiRenderPromptGroups(ctx) {
  if (!ctx) return '';
  const groups = [];
  ctx.templates.forEach((t) => {
    const name = t.group || '';
    const found = groups.find((g) => g.name === name);
    (found || groups[groups.push({ name: name, items: [] }) - 1]).items.push(t);
  });
  return groups.map((g) => {
    const label = g.name ? isloh_aiT('ai.group.' + g.name, g.name) : '';
    const head = label ? `<div class="ai-template-group">${label}</div>` : '';
    return head + `<div class="ai-prompt-grid">${g.items.map(isloh_aiRenderPromptCard).join('')}</div>`;
  }).join('');
}

/* --- Erkin matnni shablonga yo'naltirish ---------------------------------
   Ilgari har qanday savolga bitta va o'sha "demo rejim" paragrafi
   qaytarilardi — hatto savol aynan mavjud shablon haqida bo'lsa ham.
   Endi matn kalit so'zlar bo'yicha baholanadi va eng mos shablon ishga
   tushadi. Bu real AI emas, shuning uchun taxmin qilinmaydi: mos keladigan
   shablon topilmasa, javob buni ochiq aytadi (js/ai-chat.js). */

/* Apostrof variantlari (o' / o‘ / o`) bir ko'rinishga keltiriladi */
function isloh_aiNormalize(text) {
  return String(text || '').toLowerCase().replace(/[’‘`´]/g, "'");
}

/* Sarlavhadan olinadigan zaxira kalit so'zlar — 4 harfdan uzunlari */
function isloh_aiTitleKeywords(t) {
  return isloh_aiNormalize(t.title).split(/[^a-z'çğışöü0-9]+/).filter((w) => w.length > 4);
}

function isloh_aiScoreTemplate(t, text) {
  let score = 0;
  (t.match || []).forEach((kw) => { if (text.includes(isloh_aiNormalize(kw))) score += 2; });
  isloh_aiTitleKeywords(t).forEach((w) => { if (text.includes(w)) score += 1; });
  return score;
}

/* Eng mos shablon va yaqin muqobillar. `best` null bo'lishi mumkin. */
function isloh_aiMatchTemplate(contextKey, rawText) {
  const ctx = isloh_aiContext(contextKey);
  if (!ctx) return { best: null, nearest: [] };

  const text = isloh_aiNormalize(rawText);
  const ranked = ctx.templates
    .map((t) => ({ t: t, score: isloh_aiScoreTemplate(t, text) }))
    .sort((a, b) => b.score - a.score);

  return {
    best: ranked[0] && ranked[0].score >= 2 ? ranked[0].t : null,
    nearest: ranked.slice(0, 2).map((r) => r.t)
  };
}

/* Eslatma: bu yerda `isloh_initAiWidgetToggles()` bo'lgan — `[data-ai-widget-
   toggle]` / `[data-ai-widget-more]` juftligini ochib-yopardi. Bu atributlar
   67 sahifaning birortasida ham ishlatilmagan, ya'ni funksiya hech qachon
   chaqirilmagan. O'lik kod olib tashlandi; vidjet kerak bo'lsa naqsh
   `js/tabs.js` va `js/dropdown.js` kabi umumiy modullardan olinadi. */
