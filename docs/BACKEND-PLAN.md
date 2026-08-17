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
| **M2** | Kurslar va tarkib (`courses`) | ✅ **tayyor** | `course-store`, `content-store`, katalog |
| **M3** | O'qish oqimi (`learning`) | ✅ **tayyor** | `enrollment-store`, `notes`, `tasks`, progress, sertifikatlar |
| **M4** | Baholash (`assessment`) | ✅ **tayyor** | `quiz-store`, `question-store`, `assignment-store` |
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

**Brauzerda uchidan-uchiga tekshirildi (2026-08-16)** — 6-mezon:
ro'yxatdan o'tish → dashboard'ga otish → `me` → `refresh` (httpOnly cookie
orqali, tanasiz) → `sessions` (massiv) → profil `PATCH` → chiqish →
himoyalangan sahifa login'ga qaytardi → qayta kirish. Noto'g'ri parol
`fields.form` da **satr** qaytardi, ya'ni §0.2 saqlanadi.

**Shu tekshiruvda topilgan va tuzatilgan xato:** `/api/` ostidagi 404
(va DEBUG'da 500) **HTML sahifa** qaytarardi. `js/api.js` uni JSON deb
o'qib `code=parse_error` berardi — foydalanuvchi "So'ralgan ma'lumot
topilmadi" o'rniga "Server noto'g'ri javob qaytardi" ko'rardi. Bu M1
emas, **butun API** ga tegishli edi: har bir kelajakdagi modulda noto'g'ri
manzil shu tarzda tushunarsiz xato berardi.

Yechim ikki qatlamda (`apps/core/exceptions.py` + `middleware.py`):
`handler400/403/404/500` — ishlab chiqarish yo'li; `ApiJsonErrorMiddleware`
— `DEBUG=True` yo'li, chunki Django debug rejimida handler'larni umuman
chaqirmaydi. `/api/` dan tashqari yo'llar HTML'da qoladi (brauzer sahifa
kutadi). 4 ta test qulfladi. **Jami 37 ta test.**

**M1 ga qaytib qo'shiladigan (M13 bilan):** parol tiklash (email talab
qiladi), OAuth (`/auth/oauth/{google|apple}` — tugmalar frontendda bor),
email tasdiqlash, `/users/me/settings`, `/users/me/avatar` (M5 dan keyin),
`DELETE /users/me`, `/users/me/export`.

> **Diqqat:** `pages/auth/forgot-password.html` va `reset-password.html`
> hozir 404 oladi (endpoint'lar yo'q). Xato endi to'g'ri ko'rsatiladi,
> lekin oqimning o'zi ishlamaydi — M1 ochadi deyilgan 6 ta auth
> sahifasidan 4 tasi to'liq ishlaydi.

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

### M2 holati (2026-08-16)

**Modul yopildi: 78 ta test o'tadi, `check` toza, oqim brauzerda o'tkazildi.**

| Qism | Holat |
|---|---|
| Modellar: `Category`, `Course`, `CourseSettings`, `CourseTag`, `CourseModule`, `Lesson` | ✅ |
| `/instructor/courses` CRUD + `duplicate`, `publish`, `status` | ✅ |
| `/instructor/courses/{id}/modules` (+`reorder`), `/instructor/modules/{id}/lessons` (+`reorder`) | ✅ |
| `/instructor/modules/{id}/duplicate`, `/instructor/lessons/{id}/duplicate` | ✅ |
| `/catalog` (sahifalanadi), `/catalog/{slug}` (tarkib bilan) | ✅ |
| `js/course-store.js` serverdan | ✅ |
| `js/content-store.js` serverdan | ✅ |
| `js/marketplace.js` katalogni `/catalog` dan oladi | ✅ |

**Brauzerda o'tkazilgan oqim:** o'qituvchi ro'yxatdan o'tdi → kurs yaratdi
(narx `49.00` → `price_cents: 4900` → qaytib `49`) → modul va dars qo'shdi
→ modulni nusxaladi → tartibni o'zgartirdi → kursni nashr etdi → talaba
sifatida kirilganda kurs katalogda `617,400 so'm` bilan chiqdi. Har bosqichda
kesh va server holati solishtirildi.

**`content-store` uchun alohida qaror — umumiy fabrika ishlatilmadi.**
Fabrika (js/api.js) bitta endpoint va yassi massiv ustida ishlaydi; tarkib
esa kurs bo'yicha bo'lingan va har amal o'z manziliga boradi (modul
qo'shish, dars tahriri, tartib — beshta boshqa endpoint). Shu sababli
sinxron o'qish + optimistik yozish + rollback naqshi shu faylda kurs
bo'yicha qo'lda yozildi. Modul/dars nusxasi esa SERVERDA bajariladi:
mijozda u N+1 ta so'rov bo'lardi va yarmida uzilsa yarim nusxa qolardi.

**Qabul qilingan qarorlar:**

1. **`price_cents` + `currency`, valyuta sukut bo'yicha USD.** O'qituvchi
   formasi aynan USD so'raydi ("Narxni kiriting (USD)") va o'qituvchi
   tomonidagi 5 ta modul `$` bilan chizadi. `ISLOH_USD_TO_UZS = 12600`
   **o'chirilmadi** (reja shuni ko'zlagan edi): talaba katalogi so'mda
   ishlaydi va haqiqiy kurs bo'yicha o'girish — to'lov ishi. Koeffitsient
   endi FAQAT katalogga ko'prikda qoldi va **M9 ga ko'chdi**.
2. **API snake_case, frontend camelCase.** Ikkalasi faqat ikki funksiyada
   uchrashadi: `isloh_normalizeCourse` (serverdan) va `isloh_serializeCourse`
   (serverga). Shu maqsadda `js/api.js` fabrikasiga `serialize` ilgagi
   qo'shildi — qolgan 21 do'konga ham shu naqsh.
3. **Nashr tekshiruvi HAR QANDAY yozuv yo'lida.** Faqat `/publish` da
   emas: do'kon fabrikasi butun obyektni `PUT` bilan yuboradi, ya'ni
   `status: "published"` o'sha yerdan ham kelardi va tekshiruv chetlab
   o'tilardi. Endi `CourseSerializer.validate` da, so'rovdan KEYINGI
   holatga qo'llanadi.
4. **Begona kurs 404, 403 emas** — 403 javobning o'zi kurs borligini
   oshkor qilardi.

**Shu modulda topilgan va tuzatilgan M1 xatosi:** eskirgan access token
bilan **ro'yxatdan o'tish va kirish 401 qaytarardi**. DRF autentifikatsiyani
ruxsatdan oldin bajaradi, ya'ni `AllowAny` ga yetib bormasdan yiqilardi;
js/api.js esa 401 ni ko'rib login sahifasiga otardi — u yerda ham xuddi shu
401. Chiqib bo'lmaydigan halqa, yagona yechim brauzer ma'lumotlarini qo'lda
tozalash edi. Ochiq auth ko'rinishlariga `authentication_classes = []`
qo'shildi, 2 ta test qulfladi.

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

### M3 holati (2026-08-16)

**Backend yozildi va testlar bilan qulflandi (109 ta test, `check` toza).**

| Qism | Holat |
|---|---|
| Modellar: `Enrollment`, `LessonProgress`, `Note`, `NoteTag`, `Task`, `Certificate` | ✅ |
| `/student/enrollments` (+ `DELETE`), `/student/courses/{id}/progress`, `/student/lessons/{id}/progress` | ✅ |
| `/student/notes`, `/student/tasks` (CRUD), `/student/certificates` | ✅ |
| `GET /certificates/verify/{code}` — auth'siz | ✅ |
| `/instructor/enrollments`, `/instructor/courses/{id}/students` | ✅ |
| `js/enrollment-store.js`, `js/notes-store.js`, `js/tasks.js` serverdan | ✅ brauzerda tekshirildi |

**Qabul qilingan qarorlar:**

1. **`LessonProgress` ikki frontend kalitini birlashtirdi.** Ilgari
   `isloh_course_progress` (`{lessonId: bool}`) va `isloh_video_positions`
   (`{"courseId::lessonId": soniya}`) alohida yashardi va bir-biridan
   xabarsiz edi — dars "yakunlangan" bo'lib, video pozitsiyasi 0 da qolishi
   mumkin edi. Endi bitta qator: `completed_at` + `position_sec`.
2. **`state` serverda hisoblanadi**, saqlanmaydi. Chegaralar
   (`ACTIVE_MAX_IDLE_DAYS = 3`, `IDLE_MAX_IDLE_DAYS = 10`) endi yagona
   joyda; frontenddagi `isloh_enrollmentState` serverning qiymatini oladi
   va o'z hisobini faqat zaxira sifatida ishlatadi (`file://`, offline).
3. **`progress` esa SAQLANADI** (denormalizatsiya) va dars holati
   o'zgarganda qayta hisoblanadi. Sabab: talabalar ro'yxati yuzlab
   qatordan iborat bo'lishi mumkin va har biri uchun darslarni sanash
   N+1 so'rov berardi.
4. **Jarayonni mijoz yoza olmaydi.** `progress`, `avg_score`, `completed_at`
   — `read_only`. Aks holda talaba o'ziga 100% qo'yib sertifikat olardi.
   Sertifikat berishda ham server 100% ni o'zi tekshiradi.
5. **Sertifikat kodi UUID emas.** U odam tomonidan o'qiladi va qo'lda
   kiritiladi, shuning uchun qisqa (`ISLOH-XXXXXXXXXX`), chalkashadigan
   belgilarsiz (0/O, 1/I) va `secrets` bilan — kod bo'yicha kimningdir
   sertifikati ochiladi, taxmin qilib bo'lmasin.
6. **Tekshiruv javobida shaxsiy ma'lumot yo'q** — faqat ism, kurs,
   o'qituvchi va sana. Email chiqmasligi test bilan qulflangan.
7. **Ikki xil "talaba"** alohida nom bilan: `students_count` (sotuvdan) va
   `enrolled_count` (haqiqiy yozuvlar) — `/instructor/courses/{id}/students`.

**Do'konlarni ulashdagi ikki qaror:**

- `js/notes-store.js` tashqi API'si O'ZGARMADI — `isloh_getNotes()` hamon
  MAP qaytaradi va `isloh_upsertNote` qisman yamoqni qabul qiladi, ya'ni
  `js/notes.js` va `js/lesson-viewer.js` ga tegilmadi. Faqat dars izohi
  endi id bo'yicha emas, `courseId` + `lessonId` MAYDONLARI bo'yicha
  topiladi: ilgari id deterministik edi (`courseId::lessonId`), serverda
  esa u UUID. Buni `UNIQUE(user, lesson)` cheklovi qo'riqlaydi.
- `js/tasks.js` da yozish naqshi butun massivni saqlash edi
  (`isloh_saveTasks(tasks)`, 4 ta chaqiruv joyi). `saveTasks` endi massivni
  keshdagi holat bilan SOLISHTIRADI va faqat farqni yuboradi — chaqiruv
  joylariga tegilmadi.

### Shu bosqichda topilgan jiddiy xato — yozuv navbati

Uchta vazifa birdan qo'shilganda ikkitasi saqlanib, uchinchisi
**`database is locked`** bilan 500 berdi va foydalanuvchi buni yo'qolgan
yozuv sifatida ko'rardi. Sabab: do'kon fabrikasi o'zgargan har bir yozuvni
alohida so'rov bilan va PARALLEL yuborardi.

Ikki oqibati bor edi: (1) SQLite'da bitta yozuvchi bo'ladi; (2) tartib
kafolatlanmasdi — "hammasini o'chir, keyin yangisini qo'sh" amalida DELETE
va POST aralashib ketdi.

Yechim `js/api.js` fabrikasida: yozish so'rovlari **navbat** bilan,
birin-ketin yuboriladi. Optimistik yangilanish navbatda turmaydi, shuning
uchun interfeys avvalgidek darhol javob beradi. Navbat bazadan mustaqil —
PostgreSQL'da ham amallar tartibi saqlanishi kerak.

Qo'shimcha chora sifatida SQLite `timeout=20` va WAL rejimi yoqildi
(`config/settings/base.py`), lekin bu vaqtinchalik: reja M4 dan
PostgreSQL'ni talab qiladi.

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

### M4 holati (2026-08-16)

**Backend yozildi va testlar bilan qulflandi (144 ta test, `check` toza).**

| Qism | Holat |
|---|---|
| Modellar: `Question`, `QuestionOption`, `QuestionTag`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`, `Assignment`, `AssignmentRubric`, `Submission`, `SubmissionFile` | ✅ |
| Serverdagi baholash (`grading.py`) — 8 turdan 7 tasi avtomatik | ✅ |
| O'qituvchi: `/instructor/questions`, `/instructor/quizzes`, `/instructor/assignments` | ✅ |
| Baholash navbati + `/instructor/submissions/{id}/grade`, `/instructor/attempts/{id}/grade` | ✅ |
| Talaba: test ko'rish, urinish, yuborish, topshiriq topshirish | ✅ |
| `question-store`, `quiz-store`, `assignment-store` serverdan | ✅ brauzerda tekshirildi |

**Brauzerda o'tkazilgan oqim:** o'qituvchi savol yaratdi → unga variantlar
qo'shdi → test tuzdi va nashr etdi → topshiriq yaratdi (mezonlari bilan) →
talaba testni ochdi (**javobda `is_correct` yo'q**) → noto'g'ri javob berdi
(0%) → ikkinchi urinishda to'g'ri javob berdi (100%, o'tdi) → topshiriqni
yubordi → o'qituvchi baholash navbatida ko'rdi, 85 ball qo'ydi → navbat
bo'shadi → talaba o'z ballini va izohni ko'rdi.

**Uchala do'kon ham fabrikaga o'tkazildi** (`isloh_createStoreCache`) —
ilgari uchalasi ham to'g'ridan-to'g'ri `localStorage` bilan ishlardi.
Savol nusxalash serverda VARIANTLARSIZ bajariladi: frontend variantlarni
umuman bilmaydi (ular savol muharriri DOM'ida yashaydi), shuning uchun
ularni nusxalash alohida server endpoint'i ishi bo'ladi.

**Javob sizib chiqishiga qarshi qaror — IKKI SERIALIZER OILASI.**
`Instructor*` sinflarida `is_correct`, `explanation`, `notes` bor;
`Student*` sinflarida bu maydonlar **umuman e'lon qilinmagan**. Nega
"e'lon qilinmagan", "yashirilgan" emas: `write_only` yoki `exclude` keyin
biror joyda bekor qilinishi mumkin, alohida sinf esa tasodifan sizib
chiqishga imkon bermaydi. Uchta test qulfladi:

- talaba javobida `is_correct` satri umuman yo'q;
- `explanation` urinishdan OLDIN berilmaydi (u javobni oshkor qiladi);
- moslashtirish savolida `match_text` chiqmaydi — o'ng ustun alohida,
  **aralashtirilgan** ro'yxatda keladi (tartibda berilsa javob variantlar
  tartibidan o'qilardi).

**Boshqa qarorlar:**

1. **Ball hech qachon mijozdan qabul qilinmaydi.** Talaba `points_awarded`
   yoki `score` yuborsa ham e'tiborga olinmaydi — test buni qulflaydi.
2. **Foiz BARCHA savollar bo'yicha** hisoblanadi, javob berilganlar
   bo'yicha emas: aks holda bitta savolga javob berib qolganini tashlab
   ketgan talaba 100% olardi.
3. **`long` turi qo'lda baholanadi** va `is_correct = None` bo'ladi —
   `False` emas. `False` qo'yilsa talaba nolni ko'rib turardi, o'qituvchi
   tekshirgunicha shunday qolardi. Qo'lda baholanadigan savol bo'lsa
   "o'tdi" hukmi ham kechiktiriladi (`needs_review`).
4. **`multi` da qisman ball yo'q** — to'liq moslik talab qilinadi. Qoida
   o'zgarsa `grading.py` da, bitta joyda.
5. **Testga begona savol qo'shib bo'lmaydi** — `question_ids` dagi o'zga
   o'qituvchining savollari jimgina tushiriladi.

**PostgreSQL kutilmadi.** Reja M4 dan uni talab qilgan edi (`ArrayField`,
JSON indekslari), lekin muhitda WSL2 yo'q. `ArrayField` o'rniga munosabat
jadvallari (`QuestionOption`, `AssignmentRubric`, `QuestionTag`) va erkin
shakldagi javob uchun `JSONField` ishlatildi — ikkalasi ham SQLite'da
ishlaydi. Ya'ni M4 bazani almashtirishni kutmaydi va keyin migratsiya
talab qilmaydi. PostgreSQL M11 (analitika) da haqiqatan kerak bo'ladi —
u yerda murakkab agregatsiya bor.

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

> Yangilandi: 2026-08-16 — baza **PostgreSQL** ga o'tkazildi.

| | |
|---|---|
| Python | 3.12.0, `backend/.venv` ✅ |
| Django 5.1.5, DRF 3.15.2, SimpleJWT 5.3.1 | ✅ |
| Baza | **PostgreSQL 17.11** ✅ — `postgres://isloh@localhost:5432/isloh` |
| Docker | ❌ ishlatilmaydi (pastga qarang) |

### Nega Docker emas, mahalliy o'rnatish

Windows'da Docker Desktop Linux konteynerlarini **WSL2** orqali yurgizadi,
u esa bu mashinada o'rnatilmagan (`wsl --status` → "Подсистема Windows для
Linux не установлена"). Docker CLI (29.7.2) bor, lekin demon ishga
tushmaydi.

Bu to'siq emas: `backend/docker-compose.yml` faqat **bazani olish** uchun
yozilgan edi, PostgreSQL esa to'g'ridan-to'g'ri o'rnatildi. Compose fayli
o'chirilmadi — Docker mavjud muhitda (masalan CI yoki Linux) foydali
qoladi, lekin mahalliy ish uchun kerak emas.

### O'rnatishda bajarilgan qadamlar

Standart o'rnatgich faqat `postgres` superuserini yaratadi, loyiha esa
`isloh` rolini kutadi:

```sql
CREATE ROLE isloh LOGIN PASSWORD 'isloh';
CREATE DATABASE isloh OWNER isloh ENCODING 'UTF8' TEMPLATE template0;
ALTER ROLE isloh CREATEDB;   -- test bazasini yaratish uchun
```

`TEMPLATE template0` **majburiy**: server ruscha locale bilan o'rnatilgan
(`Russian_Russia.1251`), shuning uchun `template1` dan UTF8 baza yaratib
bo'lmaydi — "new encoding is incompatible with the encoding of the
template database" xatosi chiqadi.

`ALTER ROLE isloh CREATEDB` ham shart: Django test yurgizishda alohida
`test_isloh` bazasini yaratadi va oddiy rolda bu huquq yo'q.

### O'tishda topilgan XATO — sahifalash beqaror edi

PostgreSQL'ga o'tgach test paketi ogohlantirish berdi:

> `UnorderedObjectListWarning: Pagination may yield inconsistent results
> with an unordered object_list: Course QuerySet`

Tekshirilganda ma'lum bo'ldi: katalog so'rovida **ORDER BY umuman yo'q
edi**. Sabab — `isloh_course_queryset()` dagi `annotate()` guruhlash
qo'shadi va Django shunda modelning `Meta.ordering` ini SQL'ga
chiqarmaydi.

SQLite'da qatorlar tasodifan qo'shilish tartibida qaytardi, shuning uchun
muammo ko'rinmasdi. PostgreSQL'da esa tartib **aniqlanmagan**: bitta kurs
1- va 2-sahifada takrorlanishi yoki umuman biror sahifaga tushmasligi
mumkin edi — ya'ni talaba katalogni varaqlaganda kurslarni yo'qotardi.

Tuzatildi: `.order_by("-created_at", "id")`. `id` — teng qiymatlar uchun
ajratuvchi (bir vaqtda yaratilgan kurslarda faqat `created_at` yetarli
emas). 3 ta test qulfladi: so'rov tartiblanganmi, sahifalar orasida
takror/yo'qolish bormi, takroriy so'rov bir xil tartib beradimi.

**Bu aynan bazani almashtirish ochib bergan xato** — SQLite'da 144 ta
test yashil edi.

### Diqqat qilinadigan joy — saralash tartibi

Baza kodlashi UTF8, lekin **collation `Russian_Russia.1251`** (server
o'rnatilgan locale). Ya'ni `ORDER BY` matn ustida rus tili qoidalari
bo'yicha ishlaydi. Kurs va foydalanuvchi nomlari lotin va kirill aralash
bo'lgani uchun bu hozircha muammo bermaydi, lekin alifbo bo'yicha saralash
kutilganidan farq qilsa, sabab shu. Tuzatish yo'li — bazani
`--locale=C` yoki `uz-UZ-x-icu` collation bilan qayta yaratish
(ma'lumot ko'chirishni talab qiladi), shuning uchun M13 gacha
qoldirildi.

### SQLite'dagi ma'lumot ko'chirilmadi

Eski `backend/db.sqlite3` joyida qoldi, lekin endi ishlatilmaydi. Undagi
yozuvlar sinov ma'lumoti edi (test hisoblari, namuna kurslar), shuning
uchun ko'chirilmadi. Kerak bo'lsa `dumpdata`/`loaddata` bilan ko'chirish
mumkin.

### Endi olib tashlash mumkin bo'lgan vaqtinchalik chora

`config/settings/base.py` da SQLite uchun `timeout=20` + WAL sozlamasi bor
(M3 dagi `database is locked` xatosiga qarshi). U faqat SQLite yo'lida
ishlaydi va PostgreSQL'da umuman qo'llanmaydi, shuning uchun zarar
bermaydi — SQLite'ga qaytish ehtimoli uchun qoldirildi.

**Yozuv navbati esa (`js/api.js`) QOLADI** — u qulf muammosi uchun emas,
amallar TARTIBI uchun ham kerak edi (M3 izohiga qarang).
