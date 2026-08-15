# Backend rejasi — modullar bo'yicha

> Tuzildi: 2026-08-14 · Yangilandi: 2026-08-15 · Asos: [BACKEND-AUDIT.md](BACKEND-AUDIT.md)
> Stek: Django 5.1 + DRF + PostgreSQL · Joylashuv: `/backend`

**14 ta modul. Hammasi bajarilganda backend tugallangan hisoblanadi.**

Har bir modul mustaqil yakunlanadi: modellar → endpoint'lar → testlar →
frontenddagi tegishli do'kon zaxirasiz ishlashi. "Yarim tayyor" modul
qoldirilmaydi — keyingisiga o'tishdan oldin oldingisi to'liq yopiladi.

| # | Modul | Holat | Frontendda nimani ochadi |
|---|---|---|---|
| **M0** | Poydevor (`core`) | ✅ **tayyor** | xato/kesh/sahifalash shartnomalari |
| **M1** | Hisoblar va auth (`accounts`) | ✅ **tayyor** | `pages/auth/` (6), route guard |
| **M2** | Kurslar va tarkib (`courses`) | ⬜ | `course-store`, `content-store` |
| **M3** | O'qish oqimi (`learning`) | ⬜ | `enrollment-store`, `notes`, `tasks`, progress, sertifikatlar |
| **M4** | Baholash (`assessment`) | ⬜ | `quiz-store`, `question-store`, `assignment-store` |
| **M5** | Fayllar (`resources`) | ⬜ | `resource-store`, avatar, video, topshiriq fayli |
| **M6** | Ijtimoiy (`social`) | ⬜ | `review-store` + muhokamalar (do'kon yo'q) |
| **M7** | Bildirishnomalar | ⬜ | `notification-store` |
| **M8** | Xabarlar (`messaging`) | ⬜ | `chat-store` (4 kalit) + WebSocket |
| **M9** | Savdo (`commerce`) | ⬜ | savat/buyurtma zanjiri, `data-backend-pending` tugmalari |
| **M10** | AI (`assistant`) | ⬜ | `ai-store` + oqim (SSE) |
| **M11** | Analitika (`analytics`) | ⬜ | barcha `.placeholder-note` grafiklar |
| **M12** | Administratsiya | ⬜ | 6 ta admin sahifasi (do'kon yo'q) |
| **M13** | Xavfsizlik va ishga tushirish | ⬜ | — (butun tizim) |

Bog'liqlik: M2 → M3 → M4 ketma-ket. M5 ni M4 dan oldin qilish mumkin
(topshiriq fayli unga tayanadi). M6–M12 M3 dan keyin istalgan tartibda.
M13 — oxirida, lekin ba'zi qismlari (email, rate limit) M1 ga qaytib
tegadi.

---

## 0. O'zgarmas shartnomalar

Bular M0 da o'rnatildi va **hech qachon buzilmaydi**. Har yangi endpoint
shularga bo'ysunadi.

### 0.1 Ro'yxat javobi — bevosita massiv

`js/api.js` dagi do'kon fabrikasi:

```js
_cache = (data || []).map(normalize);
```

O'ram (`{count, next, results}` yoki `{data, meta}`) kelsa `.map` topilmaydi
→ `TypeError` → fabrikaning o'z `.catch` i ushlaydi → sahifa **jimgina demo
ma'lumotga tushadi**. Ekranda xato yo'q.

**Qoida:** do'kon endpoint'lari sahifalanmaydi. Sahifalash faqat katalog,
jadval va tarixlar uchun; u yerda view `pagination_class = IslohPagination`
deb ataylab yozadi.

### 0.2 Xato — `{ error: { code, message, fields } }`

`apps/core/exceptions.py`. `fields` qiymati **satr** (ro'yxat emas) —
frontend uni `textContent` ga yozadi. Maydonsiz xatolar `form` kaliti
ostida.

### 0.3 Auth — Bearer + httpOnly refresh

Access token javob tanasida, refresh — httpOnly cookie (`path=/api/`).
Frontend va API bir xil origin'da: Django frontendni o'zi beradi.

### 0.4 Statik kesh

`/js/`, `/css/` → `no-cache, must-revalidate`. Deploy'dan keyin eski JS
yangi API bilan aralashmasin.

---

## M0 — Poydevor ✅

`config/settings/{base,dev,prod}.py`, `apps/core/`:
`exceptions.py`, `pagination.py`, `middleware.py`, `models.py`
(`BaseModel` — UUID + vaqt belgilari), 10 ta test.

Frontend `pages/`, `js/`, `css/`, `assets/` oq ro'yxat orqali beriladi —
repo ildizini ochib qo'ysak `backend/.env` tashqariga chiqardi (test bilan
qulflangan).

---

## M1 — Hisoblar va auth ✅

**Modellar:** `User` (email bilan kirish), `UserRole`, `UserProfile`,
`UserSkill`, `UserGoal`, `UserSetting`, `Session`.

Rol **alohida jadvalda**: frontendda profil rol bo'yicha bo'lingan
(`isloh_profiles = {student, instructor, admin}`) va bitta odam ikki rolda
ikki xil bio ko'rsatadi.

**Endpoint'lar:** `register`, `login`, `refresh`, `logout`, `me`,
`change-password`, `sessions`, `sessions/{id}`, `users/me/profile`.
22 ta test.

**M1 ga qaytib qo'shiladigan (M13 bilan):** parol tiklash (email talab
qiladi), OAuth (`/auth/oauth/{google|apple}` — tugmalar frontendda bor),
email tasdiqlash, `/users/me/settings`, `/users/me/avatar` (M5 dan keyin),
`DELETE /users/me`, `/users/me/export`.

---

## M2 — Kurslar va tarkib

**Modellar:** `Category`, `Course`, `CourseTag`, `CourseModule`, `Lesson`,
`CourseSettings`.

**Endpoint'lar:** `/instructor/courses` (CRUD + `duplicate`, `publish`,
`status`), `/instructor/courses/{id}/modules` (+ `reorder`),
`/instructor/modules/{id}/lessons` (+ `reorder`), `/catalog` (sahifalanadi),
`/catalog/{slug}`.

**Diqqat qilinadigan joylar:**

1. **Nashr etish tekshiruvi serverda ham.** `course-publish.html` ro'yxatni
   frontendda chizadi; server takrorlamasa API orqali bo'sh kursni nashr
   etib bo'ladi.
2. **`id` va `slug` ajratiladi.** Hozir ikkalasi bir xil (`py-101`).
   Frontendda `?id=` 20+ sahifada ishlatiladi — almashuv shu modulda
   rejalashtiriladi.
3. **Narx** — `price_cents` + `currency`. `ISLOH_USD_TO_UZS = 12600`
   ([course-store.js:30](../js/course-store.js:30)) o'chadi.
4. **Tartib** — `position` maydoni; `js/sortable.js` allaqachon tartibni
   o'zgartiradi.

**Tayyorlik:** `pages/instructor/courses.html` va `course-builder` zaxirasiz
ishlaydi; `content-store` fabrikaga o'tkazilgan; talaba katalogi serverdan
chiziladi.

---

## M3 — O'qish oqimi

**Modellar:** `Enrollment`, `LessonProgress` (`completed_at` +
`position_sec` — `isloh_course_progress` va `isloh_video_positions`
**birlashadi**), `Note`, `Task`, `Certificate`.

**Endpoint'lar:** `/student/enrollments`, `/student/courses/{id}/progress`,
`/student/lessons/{id}/progress`, `/student/notes`, `/student/tasks`,
`/student/certificates`, `GET /certificates/verify/{code}` (**auth'siz**).

**Kelishuvlar:**

- `state` (Faol/Sust/Faol emas/Yakunladi) — **backend hisoblaydi**. Hozir
  `isloh_enrollmentState()` frontendda; ikki tomonda ikki xil qoida
  bo'lmasin.
- "Talabalar" ikki ma'noda: `courses.students_count` (sotuv) va
  `enrollments` (yozuvlar). **Alohida nom bilan** qaytariladi.

---

## M4 — Baholash

**Modellar:** `Quiz`, `Question` (8 tur), `QuestionOption`, `QuizQuestion`
(tartibli), `QuizAttempt`, `QuizAnswer`, `Assignment`, `AssignmentRubric`,
`Submission`, `SubmissionFile`.

**Eng muhim qoida — baholash serverda.** To'g'ri javoblar talabaga
**hech qachon** yuborilmaydi: `GET /student/quizzes/{id}` javobida
`is_correct` bo'lmasligi kerak. Hozir `question-store` frontendda hamma
narsani biladi — demo uchun maqbul, prod uchun yo'q. Buni test qulflaydi.

**Endpoint'lar:** o'qituvchi tomoni (CRUD), talaba tomoni
(`attempts`, `submit`, `submissions`), baholash navbati va
`POST /instructor/submissions/{id}/grade`.

---

## M5 — Fayllar va resurslar

**Modellar:** `File` (yangi — hozir faqat metama'lumot saqlanadi),
`Resource`.

**Saqlash:** S3-mos xizmat, **imzolangan URL orqali to'g'ridan-to'g'ri
yuklash** (fayl Django orqali o'tmaydi).

**Qamrov:** avatar (`/users/me/avatar`), kurs resurslari, dars videosi,
topshiriq fayllari.

**Tekshiruvlar:** MIME va hajm chegarasi serverda
(`assignments.max_size_mb`, `file_types` frontendda allaqachon bor),
yuklab olishda ruxsat (kursga yozilmagan talaba resursni ololmasin).

---

## M6 — Ijtimoiy

**Modellar:** `Review`, `ReviewReply`, `DiscussionThread`,
`DiscussionReply`, `Reaction`.

**Frontend ishi ham bor:** muhokamalar hali DOM'da — like soni
`textContent` dan o'qiladi va hech qayerda saqlanmaydi. `discussion-store`
yoziladi.

**Xavfsizlik — shu moduldan boshlab jiddiy.** Matn **boshqa
foydalanuvchidan** kela boshlaydi. Loyihada 158 ta `innerHTML` yozuvi bor,
escape yordamchisi esa faqat 5 ta modulda
([instructor-reviews.js:60](../js/instructor-reviews.js:60) —
`<div class="review-text">${review.text}</div>`). Ikki tomonlama himoya:
serverda sanitizatsiya + frontendda yagona `isloh_escapeHtml`.

**Qoida:** sharh faqat kursga **yozilgan** talabadan qabul qilinadi, bir
kursga bir sharh (`UNIQUE(course, user)`).

---

## M7 — Bildirishnomalar

**Model:** `Notification` (rol bo'yicha ajratilgan).

Voqealar boshqa modullardan keladi: yangi ro'yxatga olish (M3), topshiriq
topshirildi (M4), sharh yozildi (M6), to'lov o'tdi (M9).
`isloh_addNotification` frontendda shu uchun tayyor.

**Yetkazish:** REST + (M8 dan keyin) WebSocket.

---

## M8 — Xabarlar

**Modellar:** `ChatThread`, `ChatMember` (`unread_count`), `ChatMessage`.

Frontenddagi model allaqachon to'g'ri: `members[]` ro'yxati, rolga qarab
"men" — ya'ni bitta thread ikki tomondan ko'rinadi.

**Real vaqt:** Django Channels + Redis. `WS /ws/chat`,
`WS /ws/notifications`. `presence` hozir statik namuna — shu modulda
haqiqiy bo'ladi.

**Sahifalash:** xabarlar kursor bo'yicha (`?before=`), massiv emas — bu
do'kon endpoint'i emas.

---

## M9 — Savdo

**Modellar:** `CartItem`, `WishlistItem`, `Bookmark`, `Coupon`, `Order`,
`OrderItem`, `Payout`, `PayoutMethod`.

**To'lov provayderi:** Payme yoki Click (O'zbekiston) — `POST
/payments/webhook`, idempotentlik kaliti bilan.

Buyurtma holatlari frontendda belgilangan:
`paid | pending | refund_pending | refunded`.

**Qoida:** narx **serverda** hisoblanadi. Frontend yuborgan summaga hech
qachon ishonilmaydi; kupon ham serverda tekshiriladi
(`ISLOH_COUPON` hozir frontendda qattiq yozilgan).

`data-backend-pending` bilan o'chirilgan 12 ta tugmaning ko'pchiligi shu
modulda yoqiladi.

---

## M10 — AI

**Modellar:** `AiThread` (deterministik id:
`contextKey::courseId::lessonId`), `AiMessage`.

**Endpoint:** `POST /ai/threads/{id}/messages` — **`text/event-stream`**.
Til so'rov bilan yuboriladi ([AI-LAYER.md](AI-LAYER.md) §6).

**Frontendda o'zgaradi:** `isloh_aiRunTemplate` va `isloh_aiSendFreeText`
— ikki funksiya. `isloh_aiAppendAiMessage` token-token yozish uchun
bo'linadi.

**Chegara:** foydalanuvchi boshiga so'rov limiti va token hisobi (xarajat
nazorati).

---

## M11 — Analitika

**Modellar:** `Event`, `DailyCourseStat`.

**Auditdagi eng katta bo'shliq:** hozir hech qanday do'kon vaqt qatorini
saqlamaydi — do'konlar faqat joriy HOLATNI biladi. Shu sababli dashboard,
analytics, revenue va course-details grafiklarida `.placeholder-note`
turibdi. Shu modulda ular haqiqiy bo'ladi.

**Endpoint'lar:** `/instructor/analytics/overview?period=`,
`/instructor/analytics/timeseries?metric=&period=`,
`/instructor/revenue/*`, `/market/insights`.

**Ko'chirish:** `data-stat` resolverlari (25 ta ko'rsatkich,
`js/profile-stats.js`) `overview` javobiga o'tadi — ro'yxatlar
sahifalanganda frontend butun to'plamni ko'rmaydi va hisoblay olmaydi.

**Yig'ish:** kunlik agregatsiya fon vazifasi bilan (M13 dagi Celery).

---

## M12 — Administratsiya

**Modellar:** `PlatformSetting`, `AuditLog`.

**Endpoint'lar:** `/admin/stats`, `/admin/users` (+ status o'zgartirish),
`/admin/courses?status=pending` (+ `approve`/`reject`/`archive`),
`/admin/coupons`, `/admin/banners`, `/admin/settings`, `/admin/audit-log`.

**Frontend ishi katta:** 6 ta admin sahifasi hali markupda —
`admin-users.js` faqat DOM qatorini `.remove()` qiladi. `user-store`,
`moderation-store`, `coupon-store` yoziladi.

**Qoida:** har bir admin amali `AuditLog` ga yoziladi (kim, nima, qachon).

---

## M13 — Xavfsizlik va ishga tushirish

Bu modul boshqalarining ustiga qo'yiladi va **backendni tugallangan**
qiladi.

| Ish | Nega |
|---|---|
| **Email yuborish** | Parol tiklash M1 da yozilmagan — u email'siz ishlamaydi. SMTP yoki provayder + shablonlar |
| **Rate limiting** | `/auth/login`, `/auth/register`, `/auth/forgot-password` — brute force'ga qarshi (DRF throttling) |
| **XSS himoyasi** | Serverda sanitizatsiya + frontendda yagona `isloh_escapeHtml` (158 ta `innerHTML`) |
| **CSP sarlavhalari** | inline `style` loyihada ataylab ishlatiladi — siyosat shunga moslanadi |
| **OpenAPI hujjati** | `drf-spectacular` — 110 ta endpoint qo'lda hujjatlanmaydi |
| **Fon vazifalari** | Celery + Redis: email, analitika agregatsiyasi, sertifikat yaratish |
| **Demo ma'lumot buyrug'i** | `manage.py seed_demo` — frontenddagi seed massivlaridan; hozir demo faqat `localStorage` da |
| **Zaxira nusxa** | `pg_dump` jadvali + tiklashni SINAB ko'rish |
| **CI** | har push'da `manage.py test` + `ruff` |
| **Deploy** | Docker (backend + postgres + redis + nginx), `.env` boshqaruvi, HTTPS, `collectstatic` |
| **Monitoring** | Sentry yoki shunga o'xshash; `apps/core/exceptions.py` allaqachon jurnalga yozadi |
| **Yuklama testi** | katalog va dashboard — eng ko'p so'raladigan ikki joy |

---

## Frontend tomonidagi parallel ish

Backend modullariga bog'liq, lekin alohida bajariladi:

| Ish | Qachon |
|---|---|
| Qolgan **21 do'konni** fabrikaga o'tkazish | har modul bilan birga |
| **Obunachilarni tekshirish** — har do'kon uchun majburiy | har modul bilan |
| `isloh_escapeHtml` birlashtirish | M6 dan oldin |
| Muhokama / jonli sessiya / admin do'konlari | M6, M12 |
| `id` va `slug` ajratish | M2 bilan |

> Obunachilar haqida: kurslar do'konida to'rtta modul
> (`instructor-courses`, `marketplace`, `market-insights`,
> `profile-sections`) `isloh:courses-updated` ga obuna emas edi va API
> javobi kelgach ham zaxira ma'lumotni ko'rsatib turardi. Bu
> sync-over-async'ning butun ma'nosini yo'qqa chiqaradi — har do'konda
> tekshiriladi.

---

## Modul tayyorligi mezoni

Modul quyidagilarning **hammasi** bajarilganda yopiladi:

1. Migratsiyalar qo'llanadi, `manage.py check` toza
2. Endpoint'lar §0 shartnomalariga bo'ysunadi (massiv, xato shakli, auth)
3. Testlar: muvaffaqiyat yo'li + 401/403/422 + modulga xos qoidalar
4. **Frontenddagi tegishli do'kon zaxirasiz, serverdan** ishlaydi
5. O'qiydigan har bir modul `isloh:*-updated` ga obuna ekani tekshirilgan
6. Brauzerda uchidan-uchiga oqim o'tkazilgan
7. `docs/BACKEND-PLAN.md` da holat yangilangan

## Backend tugallangan hisoblanadi

M0–M13 yopilganda va:

- barcha 23 ta do'kon serverdan ishlaydi, zaxira faqat `file://` va tarmoq
  uzilishida ishlaydi;
- `data-backend-pending` atributi bironta tugmada qolmaydi;
- `.placeholder-note` faqat haqiqatan hisoblab bo'lmaydigan joyda qoladi;
- CI yashil, deploy ishlaydi, zaxira nusxa tiklanishi sinab ko'rilgan.

---

## Muhit holati

| | |
|---|---|
| Python | 3.12.0, `backend/.venv` ✅ |
| Django 5.1.5, DRF 3.15.2, SimpleJWT 5.3.1 | ✅ |
| Baza | **SQLite** (vaqtincha) |
| PostgreSQL | ⬜ Docker Desktop o'rnatilgan, lekin WSL2 yo'q — `wsl --install` **403** qaytardi (tarmoq bloklagan). `backend/docker-compose.yml` tayyor, `DATABASE_URL` bitta qator |

**PostgreSQL qachon shart bo'ladi:** M4 dan (`ArrayField`, `JSONField`
indekslari, murakkab agregatsiya). M2–M3 SQLite'da to'liq ishlaydi.

Chetlab o'tish yo'llari: `wsl --install --web-download` yoki
`wsl --install --no-distribution` (administrator PowerShell'da).
