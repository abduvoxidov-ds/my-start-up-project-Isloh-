# ISLOH — Birlashtirilgan UI/UX Loyihasi

## 1. Loyiha haqida (Project Overview)

ISLOH — bu to'liq frontend-only Learning Management System (LMS) prototipi:
Talaba, O'qituvchi va Admin uchun uchta alohida ish maydoni, o'z ichiga
Marketplace (savdo), Kurs muallifligi, Talaba o'quv tajribasi, AI Yordamchi
va Hamkorlik/Muloqot tizimlarini oladi. Loyiha 10 ta sprint davomida,
qat'iy arxitektura qoidalariga rioya qilgan holda, bosqichma-bosqich
qurilgan.

**Holat: Production Ready (frontend).** Barcha 10 sprint yakunlandi.
Backend, autentifikatsiya, to'lov va real-time xizmatlar hali ulanmagan —
bu ataylab shunday: loyiha **frontend-only statik prototip** sifatida
loyihalashtirilgan, keyinchalik istalgan backend bilan bog'lanishga tayyor.

## 2. Arxitektura

- **Rol-asosli papka strukturasi** — `pages/student/`, `pages/instructor/`,
  `pages/admin/` (Sprint 9'dan), `pages/shared/`, `pages/auth/`.
- **Bitta manbadan render qilinadigan sidebar** — `js/navigation.js` dagi
  `NAV_CONFIG` + `js/sidebar.js`. `NAV_CONFIG` uchta rolni qamrab oladi:
  `student`, `instructor`, `admin` (har biri o'z tema modifikatoriga ega).
  Yordamchi/ichki sahifalar (masalan Course Builder, Lesson Editor,
  Discussions, Live Sessions, Cart/Checkout/Orders/Wishlist) atayin asosiy
  navigatsiya elementlari emas — ular tegishli "hub" sahifalaridan (Course
  Details, Course Player, Dashboard, Marketplace) havolalar orqali
  ochiladi.
- **Bo'lingan CSS arxitekturasi** — `css/style.css` faqat quyidagilarni shu
  tartibda import qiladi: `tokens → base → layout → components → widgets →
  utilities → animations → responsive`. Har bir sprintning yangi vizual
  komponentlari `css/widgets.css` oxiriga qo'shiladi (sprint izohlari
  bilan bo'lib ko'rsatilgan), yangi CSS fayllar yaratilmaydi.
- **Deklarativ, data-attribute asosidagi JavaScript** — filtrlash, tablar,
  modallar, bulk-select, wizard qadamlar va h.k. barchasi qayta
  ishlatiladigan umumiy modullar orqali ishlaydi (§11'ga qarang), shu
  sababli deyarli hech bir yangi sahifa o'ziga xos JS yozishga muhtoj
  emas.
- **Frontend-only, holatsiz (stateless) prototip** — hech qanday sahifa
  `localStorage`/`sessionStorage`/cookie orqali ma'lumot saqlamaydi;
  barcha "savat", "xohishlar ro'yxati" kabi holat DOM ichida, sahifa
  yangilanguncha yashaydi. Bu — Sprint 1'dan beri ongli tanlov, backend
  ulanganda osongina almashtirish uchun.

## 3. Papka strukturasi

```
isloh_project/
├── index.html                     → pages/auth/login.html ga yo'naltiradi
├── docs/                          → arxitektura tahlillari va sprint rejalari (tarixiy)
├── css/
│   ├── style.css                  → import tartibi (tartib muhim!)
│   ├── tokens.css                 → ranglar, spacing, radius, shadow, z-index
│   ├── base.css                   → reset, tipografiya, fokus holatlari
│   ├── layout.css                 → app-shell, sidebar, topbar (+ theme-teach/theme-admin)
│   ├── components.css             → tugma, karta, badge, dropdown, modal
│   ├── widgets.css                → sprintlar davomida qo'shilgan barcha
│   │                                 murakkab vidjetlar (1358 qator, bo'limlarga bo'lingan)
│   ├── utilities.css              → yordamchi klasslar
│   ├── animations.css             → spinner/skeleton/fade keyframe'lari
│   └── responsive.css             → umumiy breakpoint qoidalari
├── js/                             → §11 "JavaScript arxitekturasi"ga qarang (48 modul)
├── assets/{icons,images}/
├── components/                    → statik komponent referens fayllari
└── pages/
    ├── auth/        → login, register-role, register-student (3 sahifa)
    ├── shared/      → components.html (vizual katalog), notifications.html,
    │                   coming-soon.html (3 sahifa)
    ├── student/     → 25 sahifa
    ├── instructor/  → 30 sahifa
    └── admin/       → 5 sahifa (Sprint 9 — yangi rol)
```

## 4. Dizayn tizimi (Design System)

Barcha vizual token'lar `css/tokens.css`da markazlashtirilgan va boshqa
hech qayerda qattiq kodlanmaydi (hard-code qilinmaydi):

- **Ranglar** — `--violet-*` (talaba/standart brend rangi), `--teach-green*`
  (instructor), `--indigo-*` (admin urg'usi), `--ink-*` (matn/neytral
  shkalasi), `--danger`/`--warning` (holat ranglari).
  Yordamchi rang doim mavjud badge/rang klasslari orqali qo'llaniladi
  (`.badge-green/-warning/-danger/-neutral`) — inline rang qiymatlarini
  qo'lda qaytarish o'rniga.
- **Spacing/Radius/Shadow** — `--r-sm/-md/-lg/-pill`, soyalar va oraliqlar
  komponent darajasida emas, token darajasida belgilanadi.
- **Tipografiya ierarxiyasi** — sahifa sarlavhalari (`h1`, `page-header`),
  bo'lim sarlavhalari (`section-header h3`, 15–17px), karta matni
  (13–14.5px), yordamchi/meta matn (12–12.5px, `--ink-500`) — barcha
  sahifalarda izchil qo'llaniladi.
- **Ikonografiya** — faqat Bootstrap Icons (`bi bi-*`), CDN orqali;
  loyihada boshqa ikonka kutubxonasi ishlatilmaydi.
- **Tugmalar ierarxiyasi** — `.btn-primary` (talaba, binafsha), `.btn-teach`
  (instructor, yashil), `.btn-outline` (ikkinchi darajali amal),
  `.btn-sm`/`.btn-block` o'lcham modifikatorlari. Admin sahifalari
  `.btn-primary`/`.btn-outline`ni o'zgarishsiz qayta ishlatadi — alohida
  "admin tugma" varianti yaratilmagan.

## 5. Tema tizimi (Theme System)

Uchta rol — uchta vizual urg'u, bitta struktura:

| Rol | Sidebar aktiv holat rangi | CSS klass | Qayerda belgilanadi |
|---|---|---|---|
| Student (standart) | Binafsha (`--violet-600`) | (modifikatorsiz) | `css/layout.css` |
| Instructor | Yashil (`--teach-green`) | `.sidebar.theme-teach` | `css/layout.css` + `js/sidebar.js` |
| Admin | Indigo (`--indigo-800`) | `.sidebar.theme-admin` | `css/layout.css` + `js/sidebar.js` |

Tema — faqat sidebar aktiv holatiga ta'sir qiladigan yupqa (thin) qatlam;
karta, tugma, badge kabi barcha boshqa komponentlar uch rolda ham bir xil
struktura va o'lchamlarni saqlaydi. Yangi rol qo'shish uchun uchta qadam
kifoya: (1) `NAV_CONFIG`ga yangi kalit, (2) `sidebar.js`da tema klassi
qo'shish, (3) `layout.css`da bitta qoida — boshqa hech narsa o'zgarmaydi.

## 6. Routing

Sidebar faqat `js/navigation.js` dagi `NAV_CONFIG` orqali render qilinadi;
uni o'zgartirish uchun boshqa hech qanday sahifani tahrirlash shart emas.
Quyidagi turdagi sahifalar **atayin** asosiy navigatsiyada emas — ular
kontekstli havolalar orqali ochiladi (Sprint 2'dan beri qat'iy amal
qilingan naqsh):

- Course/Lesson/Quiz/Assignment Builder va Editor sahifalari →
  Courses/Course Details'dan ochiladi
- Course Publish/Preview → Course Details'dan
- Discussions/Live Sessions/Notes → Course Player, Course Details va
  Dashboard'lardan
- Cart/Checkout/Orders/Wishlist (Sprint 9) → Marketplace'dan va topbar
  savat/yurak belgilaridan; asosiy sidebar'da alohida element emas
- AI Drawer → har doim joriy sahifaning o'zida (alohida route yo'q)

Admin roli — yagona istisno: uning sidebar'i talaba/o'qituvchi
sidebar'idan **butunlay mustaqil** (`NAV_CONFIG.admin`), chunki 5 ta admin
sahifasining barchasi asosiy navigatsiya elementlari.

**Sprint 10 routing tekshiruvi:** barcha sahifalardagi `<a href>` va
`<script src>` yo'llari statik tekshiruvdan o'tkazildi (§14ga qarang).
Bitta eskirgan havola topildi va tuzatildi: `pages/shared/notifications.html`
dagi "Bildirishnoma sozlamalari" havolasi (`settings.html` →
`../student/settings.html`).

## 7. Modullar

### 7.1 Student modul (`pages/student/`, 25 sahifa)
- **Boshqaruv**: dashboard, courses, course-detail, analytics, bookmarks,
  tasks, calendar, profile, settings
- **Marketplace (Sprint 9)**: marketplace (kategoriya/qidiruv/filtr/
  saralash/solishtirish/tavsiya/yaqinda ko'rilgan bilan), cart, checkout,
  orders, wishlist
- **Kurs muallifligi natijasi (talaba tomonidan iste'mol)**: course-landing,
  course-player, lesson-player, learning-progress, certificate-preview,
  certificates
- **AI**: ai-assistant
- **Hamkorlik**: discussions, live-sessions, notes, chat

### 7.2 Instructor modul (`pages/instructor/`, 30 sahifa)
- **Boshqaruv**: dashboard, courses, course-details, course-create,
  course-edit, course-settings, students, analytics, revenue ("Eng faol
  xaridor talabalar" — Instructor Sales Dashboard bilan kengaytirilgan),
  reviews, profile, settings
- **Kurs muallifligi**: course-builder, lesson-builder, lesson-editor,
  quiz-builder, quiz-editor, question-bank, question-editor,
  assignment-builder, assignment-editor, resource-manager,
  resource-library
- **Nashr etish va ko'rib chiqish**: course-publish, course-preview
- **AI**: ai-assistant
- **Hamkorlik**: discussions, live-sessions, messages
- **Bildirishnomalar**: notifications.html

### 7.3 Admin modul (`pages/admin/`, 5 sahifa — Sprint 9)
Butunlay yangi rol, mavjud rol-arxitekturasi naqshiga to'liq mos qo'shildi:

- **admin-dashboard.html** — Overview cards, Platform Statistics, Recent
  Activity, System Health (placeholder), Revenue/Course/User Overview.
- **admin-users.html** — Foydalanuvchilar ro'yxati, qidiruv, rol/holat
  filtri, bulk-select (`js/courses.js` orqali, o'zgarishsiz qayta
  ishlatilgan), Suspend/Activate (`js/admin-users.js` + tasdiqlash
  modali).
- **admin-courses.html** — Approval Queue, Kurslar jadvali, Featured
  toggle (`.switch`, JS talab qilmaydi), Archive (`js/admin-courses.js` +
  tasdiqlash modali).
- **admin-marketplace.html** — Categories, Coupons, Featured Courses,
  Banners, Collections (`js/admin-marketplace.js`).
- **admin-settings.html** — General/Branding/Languages (faol) va
  Email/Security/Storage/Maintenance Mode (aniq belgilangan
  `.placeholder-note` bilan) — vertikal tab (`js/tabs.js`, o'zgarishsiz).

### 7.4 Marketplace (Sprint 9)
Mavjud kurs kartasi va narx naqshlarini qayta ishlatadi, yangi ma'lumot
strukturasi kiritmaydi:
- Kategoriya/qidiruv/filtr — `js/filterable.js` (o'zgarishsiz).
- Xohishlar ro'yxati — `.fav-toggle` (mavjud) + `js/wishlist.js`.
- Savat/checkout/buyurtmalar — `js/cart.js`, `js/checkout.js`,
  `js/orders.js`; barchasi frontend-only, hech narsa saqlanmaydi.
- Instructor Sales Dashboard — alohida sahifa emas, mavjud
  `revenue.html` kengaytirildi.

### 7.5 Learning Experience (Sprint 7)
`course-landing` (sotib olishdan oldingi sahifa) → `course-player` →
`lesson-player` → `learning-progress` → `certificate-preview`/
`certificates`. Progress, bookmark va navigatsiya `js/lesson-viewer.js`da;
yozilish oqimi `js/enrollment.js`da.

### 7.6 Kurs muallifligi (Course Authoring, Sprint 4A–7)
To'liq muallif zanjiri: `course-builder` → `lesson-builder`/
`lesson-editor` → `quiz-builder`/`quiz-editor`/`question-bank`/
`question-editor` → `assignment-builder`/`assignment-editor` →
`resource-manager`/`resource-library` → `course-publish`/`course-preview`.
Qadam-basqichli formalar `js/course-wizard.js` orqali, drag-and-drop
qayta tartiblash `js/sortable.js` orqali ishlaydi.

## 8. AI integratsiyasi (Sprint 8A)

AI alohida sahifa yoki panel sifatida emas, balki mavjud ish jarayoniga
o'rnatilgan: har bir tegishli sahifada **AI Yordamchi** tugmasi bitta
qayta ishlatiladigan **AI Drawer**'ni (o'ngdan chiquvchi panel) ochadi.

- `js/ai-assistant.js` — `ISLOH_AI_CONTEXTS` — har bir sahifa uchun prompt
  shablonlari va tayyor javoblar ro'yxati.
- `js/ai-panel.js` — drawer HTML'ini `#ai-drawer-mount` ichiga bir marta
  render qiladi (xuddi `js/sidebar.js` kabi).
- `js/ai-chat.js` — drawer ichidagi barcha interaktivlik.
- Integratsiya qilingan sahifalar: Course Builder, Lesson Editor, Quiz
  Builder, Assignment Builder (instructor) va Course Player, Lesson
  Player, Learning Progress (student).

## 9. Hamkorlik va muloqot tizimi (Collaboration, Sprint 8B)

Barcha hamkorlik interfeyslari mavjud LMS ichiga o'rnatilgan — alohida
platforma emas.

- **Muhokama va Savol-Javob** — mavzular ro'yxati, ichma-ich javoblar,
  qadash, "hal qilindi" belgisi, layk, mualliflik nishonlari. Ro'yxat
  filtri `js/filterable.js`dan, tab almashish `js/tabs.js`dan qayta
  ishlatiladi; `js/discussion.js` + `js/comments.js`.
- **Jonli sessiyalar** — Upcoming/Live/Ended holatlari, countdown,
  qo'shilish tugmasi, agenda. `js/live-session.js`.
- **Hamkorlikdagi izohlar** (`notes.html`) — shaxsiy/bo'lishilgan/
  qadalgan izohlar, teglar, qidiruv. `js/notes.js`.
- **Onlayn holat (Presence)** — `.presence-dot` (online/offline/busy).
- **Bildirishnomalar markazi** — `js/notifications.js` + **Arxiv**.
- **Faoliyat lentasi** — mavjud `.activity-row`/`.timeline` kengaytirildi.
- **Realtime Chat UI** — `chat.html`/`messages.html`.

## 10. Qayta ishlatiladigan komponentlar tizimi (Reusable Component System)

| Komponent | Joylashuvi | Izoh |
|---|---|---|
| `page-header`, `card`, `badge`, `avatar`/`avatar-sm` | components.css | Barcha sahifalarda |
| `module-card`, `lesson-item`, `resource-card` | widgets.css | Course/Lesson Builder |
| `wizard-stepper` + `js/course-wizard.js` | widgets.css / js | Course Edit, Course Publish |
| `course-player-sidebar`, `lesson-viewer` | widgets.css | Course/Lesson Player |
| `ai-drawer`, `ai-prompt-card`, `response-card` | widgets.css | AI integratsiyasi |
| `discussion-thread`, `comment-card`, `qa-card` | widgets.css | Hamkorlik |
| `live-session-card`, `presence-dot` | widgets.css | Hamkorlik |
| `shared-note-card` | widgets.css | Collaborative Notes |
| `notif-row`, `filter-col` | widgets.css | Bildirishnomalar markazi |
| `activity-row`, `timeline` | widgets.css | Faoliyat lentasi (ikkala rol) |
| `cart-item`, `checkout-summary`, `payment-card`, `order-card`, `compare-table` | widgets.css | Marketplace |
| `approval-card`, `coupon-card`, `banner-card`, `settings-vtabs`, `health-row` | widgets.css | Admin Foundation |

Barcha jadvallar (`.itable`), modallar (`.modal-overlay`), dropdown'lar
(`.dropdown`), tablar (`.tab-strip`/`.tab-item`) va bulk-select
(`data-bulk-scope`/`data-bulk-bar`) — rol yoki sprintdan qat'i nazar bir
xil qayta ishlatiladi. Masalan `js/courses.js`dagi bulk-select mantiqi
Sprint 9'da Admin foydalanuvchilar/kurslar jadvalida **hech qanday
o'zgarishsiz** ishlatildi, chunki u umumiy yozilgan edi, kurslarga xos
emas.

## 11. CSS arxitekturasi

`css/widgets.css` — loyihaning eng katta fayli (1358 qator) — har bir
sprintning yangi vidjetlarini o'z ichiga oladi va fayl ichida aniq
izohlangan bo'limlarga bo'lingan (masalan `/* SPRINT 7 */`,
`/* SPRINT 8A — AI Integration */`, `/* Sprint 9 — Marketplace & Admin
Foundation */`). Yangi sprint boshlanganda navbatdagi bo'lim shu faylning
oxiriga qo'shiladi — mavjud qoidalar hech qachon qayta yozilmaydi yoki
ko'chirilmaydi.

**Sprint 10 CSS tozalash natijalari:**
- Loyiha bo'ylab CSS fayllarida haqiqiy takrorlangan selektor
  aniqlanmadi (`css/layout.css`dagi `.topbar-search` va
  `css/utilities.css`dagi `.hide-mobile`/`.show-mobile` — bular haqiqiy
  dublikat emas, balki asosiy qoida + `@media` ichidagi qonuniy
  override'lar).
- `css/style.css` boshidagi import tartibi izohi `widgets.css`ni
  o'z ichiga olmagan edi (`@import` ro'yxatining o'zi to'g'ri edi) —
  izoh haqiqiy holatga mos tuzatildi.
- Bir nechta sahifada (`orders.html`, `revenue.html`, `assignments.html`,
  `students.html`) badge uchun mavjud `.badge-warning`/`.badge-danger`
  klasslari o'rniga ularning aynan bir xil qiymatlarini takrorlaydigan
  inline `style=""` ishlatilgan edi — barchasi mavjud klasslarga
  almashtirildi (vizual natija o'zgarmadi).

## 12. JavaScript arxitekturasi

Umumiy, deklarativ dvigatellar (bir marta yozilib, hamma joyda qayta
ishlatiladi), jami **48 modul**:

| Modul | Vazifasi |
|---|---|
| `navigation.js` + `sidebar.js` | Sidebar — yagona manba (`NAV_CONFIG`), 3 rol |
| `filterable.js` | Filtr chip + qidiruv + bo'sh holat |
| `tabs.js` | `.tab-strip`/`.tab-item` almashish |
| `modal.js` | `.modal-overlay` ochish/yopish, Escape |
| `dropdown.js` | `.dropdown` ochish/yopish (delegatsiya orqali) |
| `sortable.js` | Drag-and-drop qayta tartiblash |
| `course-wizard.js` | `[data-wizard]` qadam-basqichli forma dvigateli |
| `toast.js` | Vaqtinchalik bildirishnoma (`isloh_showToast`) |
| `unsaved-guard.js` | Saqlanmagan o'zgarishlar ogohlantirishi |
| `notifications.js` | Bildirishnoma markazi: o'qilgan/o'chirish/hammasi/arxiv |
| `lesson-viewer.js` | Course/Lesson Player: progress, bookmark, izoh |
| `enrollment.js` | Kursga yozilish oqimi |
| `ai-assistant.js` / `ai-panel.js` / `ai-chat.js` | AI Drawer |
| `discussion.js` / `comments.js` | Muhokama/Q&A mavzu va izoh amallari |
| `live-session.js` | Countdown, qo'shilish holati, agenda |
| `notes.js` | Yangi izoh yaratish, sevimli/qadash, teg filtri |
| `cart.js` | Savat: miqdor, o'chirish, keyinga saqlash, kupon, hisob-kitob |
| `wishlist.js` | Yurak belgisi — Marketplace va Wishlist ro'yxati |
| `checkout.js` | 3 bosqichli checkout, to'lov usuli, promo-kod, success/failure |
| `orders.js` | Kvitansiya yuklab olish, qaytarish so'rovi modali |
| `admin-users.js` | Suspend/Activate tasdiqlash modali |
| `admin-courses.js` | Approval queue, arxivlash modali |
| `admin-marketplace.js` | Kupon o'chirish, banner faollashtirish/o'chirish |

Yangi sahifa qo'shilganda, avval shu jadvaldan mos keladigan modul
borligini tekshiring — deyarli har doim bor.

**Sprint 10 JavaScript tozalash natijalari:**
- Modullar orasida bitta ham funksiya nomi to'qnashuvi (duplicate
  function name) topilmadi.
- `js/search.js` — hech qaysi sahifa tomonidan yuklanmagan, chaqirilmagan
  "kelajak uchun" stub fayl (Sprint 2'dan qolgan, "TODO: Marketplace
  qidiruvi tayyor bo'lganda" izohi bilan) — bu TODO endi
  `js/filterable.js` orqali (Sprint 5B'dan buyon Courses/Students'da,
  Sprint 9'dan Marketplace/Admin'da) hal qilingani uchun **o'chirildi**.
- `js/discussion.js` ichidagi bo'sh, hech qayerdan chaqirilmaydigan
  `isloh_initDiscussionTabs()` funksiyasi (o'z izohida "tabs.js allaqachon
  bularni bajaradi" deb yozilgan edi) — **o'chirildi**.
- Barcha ommaviy (public) API'lar — funksiya imzolari, global funksiya
  nomlari, data-attribute shartnomalari — o'zgarishsiz qoldirildi.

## 13. Accessibility (Kirish imkoniyati)

- **Semantik HTML** — `<header>`, `<aside>`, `<main>`, `<nav>`, jadval
  tuzilmalari (`<table>/<thead>/<tbody>`) izchil ishlatiladi.
- **ARIA va accessible tugmalar** — Sprint 10 davomida loyiha bo'ylab
  har bir faqat-ikonka tugma (icon-only button) tekshirildi; topilgan
  **27 ta** `aria-label`siz tugma (components katalogi, AI Assistant,
  Chat/Messages, Course Detail ulashish tugmalari, Courses pagination)
  tegishli o'zbekcha `aria-label` bilan to'ldirildi. Loyiha bo'ylab
  qolgan barcha ikonka-tugmalarda `aria-label` mavjud (statik tekshiruv
  — §14ga qarang).
- **Rasm alt-matnlari** — loyihada `alt` atributisiz `<img>` topilmadi.
- **Klaviatura navigatsiyasi** — `js/tabs.js` `role="tab"` +
  `tabindex="0"` + Enter/Space bilan faollashtirishni qo'llab-quvvatlaydi;
  `js/modal.js` Escape orqali yopiladi; `js/dropdown.js` fokusni
  boshqaradi.
- **Fokus holatlari** — `css/base.css`da global `:focus-visible` qoidasi.
- **Formalar** — aksariyat forma maydonlari `<label for>`/`id` bog'lanishi
  yoki vizual `<label>` bilan ta'minlangan. **Ma'lum cheklov**: bir nechta
  eski (Sprint 4–6) muallif/sozlamalar sahifasidagi (`course-settings`,
  `course-publish`, `assignment-editor`, `question-bank`, `quiz-editor`,
  `settings.html`) ~50 ta input — vizual `<label>` matni bilan
  ta'minlangan, lekin `for`/`id` orqali dasturiy bog'lanmagan. Bu — kichik,
  keng tarqalgan naqsh; "no large refactor" siyosatiga ko'ra Sprint 10'da
  ushbu keng qamrovli (50+ fayl) o'zgarishga qo'l urilmadi, lekin
  keyingi (backend bilan bog'laydigan) sprint uchun aniq belgilab
  qo'yilgan.

## 14. Responsive strategiyasi

Rasmiy breakpoint konventsiyasi (`css/responsive.css`da hujjatlashtirilgan,
Sprint 1 §8):

| Breakpoint | Vazifasi |
|---|---|
| `1100px` | Ko'p ustunli grid'lar kamayadi (masalan course-grid 3→2, mkt-grid 4→2) |
| `900px` | Topbar/sidebar zichligi moslashtiriladi (qidiruv maydoni torayadi, 2 ustunli layout'lar 1 ustunga tushadi) |
| `700px` | Grid'lar bitta ustunga tushadi, content padding kamayadi |

Sahifaga xos grid breakpoint'lari (`course-grid`, `mkt-grid`, `wl-grid`
va h.k.) hozircha har bir sahifaning o'z `<style>` blokida qoladi —
bu Sprint 1'dan beri qat'iy amal qilingan bosqichma-bosqich migratsiya
qarori, bir martalik qayta yozish emas.

**Sprint 10 responsiv audit natijasi:** Sprint 9'da qo'shilgan uchta
sahifada (`cart.html`, `checkout.html`, `admin-marketplace.html`)
konventsiyaga mos kelmaydigan `1000px` breakpoint aniqlandi (yangi qiymat
o'ylab topilgan edi, mavjudlaridan foydalanish o'rniga) — barchasi
rasmiy `900px`ga normallashtirildi. Qolgan barcha sahifalar (Desktop →
Laptop → Tablet → Mobile) mavjud konventsiyaga mos ekanligi tasdiqlandi.

## 15. Frontend texnologiyalari

- **Toza HTML/CSS/JavaScript** — hech qanday build tizimi, bundler yoki
  freymvork ishlatilmaydi (React/Vue/Angular yo'q); barcha sahifalar
  to'g'ridan-to'g'ri brauzerda ochiladi.
- **Bootstrap Icons** — CDN orqali (`bootstrap-icons@1.11.3`).
- **CSS Custom Properties (o'zgaruvchilar)** — butun dizayn tizimi
  `css/tokens.css`da.
- **Vanilla JavaScript (ES6+)** — modul yo'q (`<script>` teglar orqali),
  global `isloh_*` prefiksli funksiyalar, deklarativ `data-*` atribut
  shartnomalari.
- Tashqi JS kutubxonasi ishlatilmaydi.

## 16. Ishlab chiqish qoidalari (Development Rules)

1. Yangi vizual komponent kerak bo'lsa — avval §10 jadvalidan mos
   keladiganini qidiring; faqat haqiqiy ehtiyoj bo'lganda yangisini
   yarating.
2. Yangi CSS — faqat mavjud fayllarning oxiriga, aniq sprint izohi bilan;
   yangi CSS fayl yaratilmaydi.
3. Yangi JS — avval §12 jadvalini tekshiring; deklarativ, `data-*`
   atributga asoslangan, sahifadan mustaqil modul sifatida yozing.
4. Yangi sahifa — mavjud rol papkasiga, mavjud nomlash konventsiyasiga
   (kebab-case) muvofiq qo'shiladi; yangi top-level papka yaratilmaydi.
5. Yordamchi/ichki sahifalar asosiy sidebar navigatsiyasiga qo'shilmaydi
   — faqat "hub" sahifalardan kontekstli havola orqali ochiladi.
6. Backend/API/autentifikatsiya/to'lov mantig'i hech qachon
   amalga oshirilmaydi — faqat interfeys va aniq belgilangan
   placeholder'lar.

## 17. Loyiha statistikasi (Project Statistics)

| Ko'rsatkich | Qiymat |
|---|---|
| Jami sahifalar (`pages/**/*.html`) | 66 |
| — Student | 25 |
| — Instructor | 30 |
| — Admin | 5 |
| — Shared | 3 |
| — Auth | 3 |
| JavaScript modullari (`js/*.js`) | 48 |
| CSS fayllari (`css/*.css`) | 9 |
| `css/widgets.css` hajmi | 1358 qator |
| Rollar (sidebar temalari) | 3 (Student/binafsha, Instructor/yashil, Admin/indigo) |
| Yakunlangan sprintlar | 10 |

## 18. Yakuniy sprint tarixi (1–10)

| Sprint | Nomi | Natija |
|---|---|---|
| 1 | Arxitektura tahlili | Roadmap va boshlang'ich dizayn tili |
| 2 | Struktura | Rol-asosli papkalar, bo'lingan CSS, yagona sidebar manbasi |
| 3A/3B | Student/Instructor Workspace | Dashboard, kurslar, bildirishnomalar, sozlamalar |
| 4A | Course/Lesson/Quiz/Assignment Builder | To'liq muallif tizimi |
| 4B | Chat va AI Assistant (statik) | `.chat-shell`, `.ai-shell` vizual tili |
| 5A/5B | Resource Manager, Tabs dvigateli | `filterable.js`, `tabs.js` umumiy modullari |
| 6A/6B | Wizard va sozlamalar chuqurlashtirildi | `course-wizard.js`, sozlamalar sahifalari |
| 7 | Course Publishing + Learning Experience | course-publish, course-preview, course-landing, course-player, lesson-player, learning-progress, certificate-preview |
| 8A | AI Integration | `ai-drawer` — Course Builder → Learning Progress gacha barcha ish jarayoniga o'rnatildi |
| 8B | Collaboration & Communication | Discussions, Q&A, Live Sessions, Collaborative Notes, Presence, kengaytirilgan Notifications va Activity Feed |
| 9 | Marketplace & Admin Foundation | Cart, Checkout, Orders, Wishlist, Course Comparison; yangi Admin roli — Dashboard, Users, Courses, Marketplace, Settings |
| 10 | Production Polish & Final QA | UI/CSS/JS tozalash, accessibility va responsiv audit, o'lik havola va o'lik kod olib tashlash, yakuniy README |

## 19. Production Ready holati

**✅ Frontend Production Ready.**

- Barcha 10 sprint yakunlandi, arxitektura, routing, dizayn va tema
  tizimi butun loyiha bo'ylab izchil.
- Statik tekshiruv (§6, §14) barcha sahifalarda o'tkazildi: haqiqiy
  o'lik havola yo'q, barcha CSS/JS import'lari to'g'ri yo'llarga
  ishora qiladi, HTML teglari muvozanatli.
- Ma'lum, ataylab qoldirilgan cheklovlar: backend/API/to'lov/autentifikatsiya
  yo'q (bu — loyihaning ataylab qilingan doirasi, nuqson emas); ~50 ta
  eski forma maydonida `label[for]` dasturiy bog'lanishi yo'q (§13).
- Loyiha keyingi bosqich — backend integratsiyasi — uchun tayyor.

## 20. Ochish

`index.html` faylini brauzerda oching (yoki to'g'ridan-to'g'ri `pages/`
ichidagi istalgan sahifani). Barcha havolalar nisbiy yo'llar orqali
ishlaydi, build qadamisiz.
