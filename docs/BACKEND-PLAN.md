# Backend rejasi — Django + DRF + PostgreSQL

> Tuzildi: 2026-08-14 · Asos: [BACKEND-AUDIT.md](BACKEND-AUDIT.md)
> Stek: Django 5 + Django REST Framework + PostgreSQL 16
> Joylashuv: shu repo, `/backend` papkasi

Bu hujjat **nima qurilishini va qanday tartibda** belgilaydi. Endpoint va
jadval ro'yxatining o'zi audit hujjatida; bu yerda ular Django ilovalariga
bo'lingan, har biriga tayyorlik mezoni va qaysi frontend do'konini ochishi
yozilgan.

---

## 0. Eng muhim uchta shartnoma

Bularni birinchi kun hal qilmasak, keyin har bir endpoint'da qayta-qayta
chiqadi.

### 0.1 Ro'yxat javobi — **bevosita massiv** ⚠️

`js/api.js` dagi fabrika shunday yozilgan:

```js
_cache = (data || []).map(normalize);
```

DRF ning standart sahifalash javobi (`{count, next, previous, results}`) yoki
audit'dagi `{data, meta}` o'rami kelsa, `.map` mavjud bo'lmaydi → `TypeError`
→ uni `.catch` ushlaydi → sahifa **jimgina zaxira (demo) ma'lumotga tushadi**.
Xato ekranda ko'rinmaydi, foydalanuvchi demo ma'lumotni haqiqiy deb o'ylaydi.

**Qaror:** do'kon bilan ishlaydigan ro'yxat endpoint'lari (`/courses`,
`/enrollments`, `/notes`, `/tasks` ...) **sahifalanmaydi va bevosita massiv
qaytaradi**. Sahifalash faqat katalog, jadval va tarixlar uchun
(`/catalog`, `/orders`, `/chat/threads/{id}/messages`, `/admin/users`) —
u yerda frontend `data`/`meta` ni ataylab o'qiydi.

Sahifalash keyinroq do'kon endpoint'lariga ham kerak bo'lsa, avval
`isloh_createStoreCache` ga `unwrap` konfiguratsiyasi qo'shiladi — kodni
o'zgartirmasdan shakl o'zgartirilmaydi.

### 0.2 Xato formati — `{ error: { code, message, fields } }`

`islohFetch` aynan shu shaklni parse qiladi va `fields` ni
`[data-error-for="<maydon>"]` ga tarqatadi. DRF ning standart xato javobi
(`{"detail": "..."}` / `{"email": ["..."]}`) mos kelmaydi.

**Qaror:** `core/exceptions.py` da maxsus `EXCEPTION_HANDLER`. Bu 1-sprintning
birinchi vazifasi — usiz auth formasidagi validatsiya xatolari maydonga
tushmaydi.

### 0.3 Autentifikatsiya — Bearer + httpOnly refresh

`js/api.js` allaqachon shunday ishlaydi:
`Authorization: Bearer <access_token>` (localStorage) + `credentials: 'include'`
(refresh — httpOnly cookie). 401 → token o'chadi + login'ga.

**Qaror:** SimpleJWT; access 15 daqiqa (javob tanasida), refresh 30 kun
(httpOnly, `SameSite=Lax`, `Secure` — prod'da). `/auth/login` 401 qaytarganda
frontend `skipAuthRedirect: true` yuboradi, ya'ni "noto'g'ri parol" va
"sessiya tugadi" aralashmaydi.

---

## 1. Loyiha skeleti

```
backend/
├── manage.py
├── pyproject.toml            # yoki requirements.txt
├── .env.example
├── config/
│   ├── settings/{base,dev,prod}.py
│   ├── urls.py               # /api/v1/... + statik frontend
│   └── asgi.py               # WebSocket uchun (5-bosqich)
└── apps/
    ├── core/                 # umumiy: BaseModel, exception handler,
    │                         # pagination, permissions, mixins
    ├── accounts/             # user, rol, profil, sessiya, sozlamalar
    ├── courses/              # kurs, modul, dars, kategoriya
    ├── learning/             # enrollment, progress, note, task, sertifikat
    ├── assessment/           # quiz, savol, topshiriq, submission
    ├── resources/            # fayl, resurs
    ├── commerce/             # savat, buyurtma, to'lov, payout
    ├── social/               # sharh, muhokama, reaksiya
    ├── messaging/            # chat
    ├── assistant/            # AI
    ├── notifications/
    ├── analytics/            # events, daily stats
    └── administration/       # platforma sozlamalari, moderatsiya, audit
```

**Frontend qanday xizmat qiladi:** Django `pages/`, `js/`, `css/`, `assets/`
ni statik sifatida beradi (`config/urls.py` + `WhiteNoise`). Sabab —
`credentials: 'include'` va httpOnly cookie **bir xil origin** talab qiladi;
alohida portda CORS + `SameSite=None` kerak bo'lardi. `file://` rejimi
saqlanadi: `api.js` uni birinchi qatorda tekshiradi va demo ma'lumotga
tushadi.

**Statik fayl keshi** (audit §5.1): `/js/*` va `/css/*` ga
`Cache-Control: no-cache`, HTML importlarida `?v=<hash>`. Bu 1-sprintga
kiritilgan — deploydan keyin eski `course-store.js` yangi `api.js` bilan
aralashmasin.

---

## 2. Modullar va tartib

Har bir modulning **tayyorlik mezoni** bir xil:
migratsiya + serializer + permission + testlar (happy path va 401/403/422) +
**frontendda tegishli do'kon zaxirasiz, haqiqiy ma'lumot bilan ishlashi**.

### 1-sprint — `core` + `accounts` (yadro)

| Vazifa | Tafsilot |
|---|---|
| Loyiha skeleti | settings bo'linishi, `.env`, PostgreSQL, WhiteNoise |
| `core.exceptions` | `{ error: { code, message, fields } }` — **§0.2** |
| `core.pagination` | `{ data, meta }` — faqat sahifalanadigan endpoint'lar uchun |
| `core.models.BaseModel` | `id` (uuid), `created_at`, `updated_at` |
| Statik kesh sarlavhalari | **§1** |
| `User` + `UserRole` | bitta foydalanuvchi bir nechta rolga ega bo'lishi mumkin (frontend `isloh_profiles = {student, instructor, admin}`) |
| `UserProfile` | rol bo'yicha: `headline`, `bio`, `location`, `languages` |
| `UserSkill`, `UserGoal` | profil sahifasi bo'limlari |
| `UserSetting` | umumiy + rol bo'yicha (`isloh_settings`, `isloh_role_settings`) |
| `Session` | qurilma ro'yxati va bekor qilish |
| SimpleJWT | access/refresh, httpOnly cookie — **§0.3** |
| Endpoint'lar | `/auth/*` (11 ta), `/users/me/*` (6 ta) |

**Ochadi:** `pages/auth/` (6 sahifa) — hozir `js/auth-guard.js` tayyor turibdi,
lekin urishga server yo'q. Route guard haqiqiy tokenda ishlaydi.

**Tekshiruv:** ro'yxatdan o'tish → login → dashboard → sahifa yangilash →
sessiya saqlanadi; noto'g'ri parol → `data-error-for="password"` ga tushadi;
token o'chirilsa → login'ga otadi.

---

### 2-sprint — `courses`

| Model | Izoh |
|---|---|
| `Category`, `Course`, `CourseTag` | `slug` alohida, `id` — uuid (audit §5.2.4) |
| `CourseModule`, `Lesson` | `position` maydoni — `js/sortable.js` tartibni o'zgartiradi |
| `CourseSettings` | sertifikat qoidalari |

Endpoint'lar: `/instructor/courses` (CRUD + `duplicate`, `publish`, `status`),
`/instructor/courses/{id}/modules` (+ `reorder`), `/instructor/modules/{id}/lessons`
(+ `reorder`), `/catalog` (sahifalanadi).

**Diqqat — nashr etish tekshiruvi.** `pages/instructor/course-publish.html`
frontendda tekshiruv ro'yxatini chizadi. O'sha qoidalar **serverda ham**
bo'lishi shart — aks holda API orqali bo'sh kursni nashr etib bo'ladi.

**Diqqat — narx.** `price_cents` + `currency`. Frontend hozir USD (provider) va
so'm (talaba) ni `ISLOH_USD_TO_UZS = 12600` bilan o'giradi
([course-store.js:30](../js/course-store.js:30)); backend ikkalasini bersa
o'sha koeffitsient o'chadi.

**Ochadi:** `course-store` (allaqachon fabrikada) zaxirasiz ishlaydi;
`content-store` fabrikaga o'tkaziladi.

---

### 3-sprint — `learning`

| Model | Izoh |
|---|---|
| `Enrollment` | `progress`, `avg_score`, `streak`, `last_active_at` |
| `LessonProgress` | `completed_at` + `position_sec` — `isloh_course_progress` va `isloh_video_positions` **birlashadi** |
| `Note` | dars + vaqt belgisi |
| `Task` | kalendar ham shundan chiziladi |
| `Certificate` | `code` — ochiq tekshiruv uchun |

Endpoint'lar: `/student/enrollments`, `/student/courses/{id}/progress`,
`/student/lessons/{id}/progress`, `/student/notes`, `/student/tasks`,
`/student/certificates`, `GET /certificates/verify/{code}` (**auth'siz**).

**Kelishuv (audit §5.2.1):** `state` (Faol/Sust/Faol emas/Yakunladi) —
**backend hisoblaydi va javobda beradi**. Hozir `isloh_enrollmentState()`
frontendda; ikki tomonda ikki xil qoida bo'lib qolmasin. Frontend funksiyasi
o'chirilmaydi, lekin javobdagi `state` ustun turadi.

**Kelishuv (audit §5.2.2):** "Talabalar" ikki ma'noda —
`courses.students_count` (sotuv) va `enrollments` (yozuvlar). Backend ikkalasini
**alohida nom bilan** qaytaradi.

**Ochadi:** `enrollment-store` (fabrikada), `notes-store`, `tasks`,
`lesson-viewer`, `certificate-engine`.

---

### 4-sprint — `assessment` + `resources`

Eng ko'p jadval: `Quiz`, `Question` (8 tur), `QuestionOption`, `QuizQuestion`
(tartibli), `QuizAttempt`, `QuizAnswer`, `Assignment`, `AssignmentRubric`,
`Submission`, `SubmissionFile`, `File`, `Resource`.

**Diqqat — baholash serverda.** To'g'ri javoblar hech qachon talabaga
yuborilmasin: `GET /student/quizzes/{id}` javobida `is_correct` bo'lmasligi
kerak. Hozir frontend `question-store` da hamma narsani biladi — bu demo uchun
maqbul, prod uchun yo'q.

**Fayl saqlash:** S3-mos xizmat, imzolangan URL. Hozir faqat metama'lumot
saqlanadi (`resource-manager` da `.placeholder-note` bilan belgilangan).

---

### 5-sprint — `social` + `notifications` + `messaging`

`Review`, `ReviewReply`, `DiscussionThread`, `DiscussionReply`, `Reaction`,
`Notification`, `ChatThread`, `ChatMember`, `ChatMessage`.

**Real vaqt:** Django Channels + Redis; `WS /ws/chat`, `WS /ws/notifications`.
`presence` hozir statik namuna.

**Frontend ishi ham bor:** muhokamalar va jonli sessiyalar hali DOM'da —
do'kon yozilishi kerak (audit §6).

**Xavfsizlik — bu sprintning eng muhim qismi.** Shu paytdan boshlab matn
**boshqa foydalanuvchidan** keladi. Loyihada 158 ta `innerHTML` yozuvi bor,
escape yordamchisi esa faqat 5 ta modulda
([instructor-reviews.js:60](../js/instructor-reviews.js:60) —
`<div class="review-text">${review.text}</div>`). Ikki tomonlama himoya:
serverda sanitizatsiya + frontendda yagona `isloh_escapeHtml` (5 ta mavjud
nusxa birlashtiriladi).

---

### 6-sprint — `commerce`

`CartItem`, `WishlistItem`, `Bookmark`, `Coupon`, `Order`, `OrderItem`,
`Payout`, `PayoutMethod` + to'lov provayderi (Payme/Click/Stripe) va
`POST /payments/webhook`.

Buyurtma holatlari frontendda allaqachon belgilangan:
`paid | pending | refund_pending | refunded`.

`data-backend-pending` bilan o'chirilgan 12 ta tugmaning ko'pchiligi shu
sprintda yoqiladi.

---

### 7-sprint — `analytics` + `administration` + `assistant`

`Event`, `DailyCourseStat` — **audit'dagi eng katta bo'shliq**: hozir hech
qanday do'kon vaqt qatorini saqlamaydi, shuning uchun dashboard, analytics,
revenue va course-details dagi grafiklar `.placeholder-note` bilan "namuna"
deb belgilangan. Ular shu sprintda haqiqiy bo'ladi.

`data-stat` resolverlari (audit §5.2.3): 25 ta ko'rsatkich hozir frontendda
hisoblanadi. Ro'yxatlar sahifalansa frontend butun to'plamni ko'rmaydi —
ular `GET /instructor/analytics/overview` javobiga ko'chadi.

`administration`: `PlatformSetting`, `AuditLog`, moderatsiya. **Frontend ishi:**
6 ta admin sahifasi hali markupda, do'kon yozilishi kerak.

`assistant`: `AiThread`, `AiMessage`, `POST /ai/threads/{id}/messages` —
`text/event-stream`. Til so'rov bilan yuboriladi
([AI-LAYER.md](AI-LAYER.md) §6).

---

## 3. Frontend tomonidagi parallel ish

Backend sprintlariga bog'liq, lekin alohida bajariladi:

| Ish | Qachon | Nega |
|---|---|---|
| Qolgan **21 do'konni** fabrikaga o'tkazish | har bir modul bilan birga | `isloh_createStoreCache` tayyor; do'kon ~15 qatorda ulanadi |
| Obunachilarni tekshirish | **har bir do'kon uchun majburiy** | kurslar do'konida 4 ta modul obuna emas edi va API javobi kelgach ham zaxirani ko'rsatardi |
| `isloh_escapeHtml` birlashtirish | 5-sprintdan oldin | 158 ta `innerHTML`, 5 ta alohida escape nusxasi |
| Admin / muhokama / jonli sessiya do'konlari | 5–7-sprint | hozir markupda, ulash nuqtasi yo'q |
| `id` va `slug` ajratish | 2-sprint bilan | `?id=` 20+ sahifada ishlatiladi, uuid'ga o'tishda sinadi |

---

## 4. Nima qilinmaydi (ataylab)

- **Frontend freymvorkka o'tkazish** — CLAUDE.md §1 bo'yicha sof vanilla
  qoladi.
- **`file://` rejimini buzish** — `api.js` dagi tekshiruv saqlanadi, demo
  ma'lumot bilan ochilishi kerak.
- **Do'kon sxemasini o'zgartirish** — yozuvlar allaqachon API javobiga mos
  shaklda; backend shu shaklga moslashadi, teskarisi emas.
- **Markup shartnomalari** (`[data-stat]`, `[data-error-for]`,
  `[data-*-field]`) — o'zgarmaydi.

---

## 5. Boshlashdan oldin

1. **PostgreSQL 16** o'rnatilishi (yoki Docker Compose bilan ko'tarilishi).
2. **pip mavjud emas** — bu muhitda `python -m ensurepip` yoki `uv` kerak
   bo'ladi (Python 3.12.0 bor).
3. `backend/.env.example` — `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`,
   `JWT_*`, keyinroq `S3_*` va `PAYMENT_*`.
4. CLAUDE.md ga **backend bo'limi** qo'shiladi: `/backend` tuzilishi, ilova
   chegaralari, migratsiya va test buyruqlari.

Birinchi qadam — 1-sprint: `core` + `accounts`. U tugaganda `pages/auth/`
haqiqiy serverga ulanadi va route guard demo emas, chinakam himoyaga aylanadi.
