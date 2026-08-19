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
| **M5** | Fayllar (`resources`) | ✅ **tayyor** | `resource-store`, avatar, video, topshiriq fayli |
| **M6** | Ijtimoiy (`social`) | ✅ **tayyor** | `review-store` + `discussion-store` |
| **M7** | Bildirishnomalar | ✅ **tayyor** | `notification-store` |
| **M8** | Xabarlar (`messaging`) | ✅ **tayyor** | `chat-store` (3 kalit) + WebSocket, `presence` |
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
email tasdiqlash, `/users/me/settings`, `DELETE /users/me`,
`/users/me/export`. (`/users/me/avatar` M5 da yozildi.)

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

### M5 holati (2026-08-17)

**Backend yozildi va testlar bilan qulflandi (200 ta test, `check` toza,
oqim brauzerda o'tkazildi).**

| Qism | Holat |
|---|---|
| Modellar: `File`, `Resource` | ✅ |
| Saqlash qatlami `storage.py` — imzolangan URL, backend almashtiriladi | ✅ |
| `POST /uploads/presign` → `PUT <upload_url>` → `POST /uploads/{id}/complete` | ✅ |
| `GET /files/{id}/download` — ruxsat tekshiruvi bilan | ✅ |
| `/instructor/resources` (CRUD + `duplicate`), `/student/courses/{id}/resources` | ✅ |
| `PUT/DELETE /users/me/avatar` (M1 dan qolgan) | ✅ |
| `PUT /instructor/lessons/{id}/video` + `Lesson.video_file` | ✅ |
| `SubmissionFile.file` — topshiriq fayli endi haqiqiy | ✅ |
| `js/upload.js` (umumiy yordamchi), `js/resource-store.js` serverdan | ✅ brauzerda tekshirildi |

**Brauzerda o'tkazilgan oqim:** o'qituvchi ro'yxatdan o'tdi → kurs yaratdi →
resurs yukladi (`presign` → `PUT` → `complete`, jarayon ko'rsatkichi bilan)
→ kutubxonada `PDF · 4 KB` bo'lib chiqdi → nusxaladi va aslini arxivladi →
tashqi havola qo'shdi → `localStorage` tozalanib sahifa yangilanganda uchala
yozuv ham SERVERDAN qaytadi → avatar yukladi va u `<img>` da ko'rindi →
darsga video biriktirdi → talaba kursga yozilmasdan faylni so'radi (**404**)
→ yozilgach o'sha manzil **200** qaytardi va ro'yxatda faqat FAOL resurslar
ko'rindi.

**Qabul qilingan qarorlar:**

1. **Uch qadamli yuklash, S3 shartnomasi bilan.** Reja imzolangan URL
   orqali to'g'ridan-to'g'ri yuklashni talab qilgan edi; muhitda S3 yo'q
   (Docker/PostgreSQL bilan bir xil vaziyat). Shu sababli SHARTNOMA
   qoldirildi, backend esa almashtiriladigan qilindi
   (`ISLOH_STORAGE_BACKEND`). Mahalliy backend `upload_url` sifatida o'z
   endpoint'ini beradi va uni `TimestampSigner` bilan imzolaydi — URL ning
   O'ZI vaqtinchalik kalit, xuddi S3 presigned PUT dagidek. S3 ga o'tish
   bitta sozlama: endpoint'lar ham, frontend ham o'zgarmaydi.
2. **`File` va `Resource` ajratildi.** `File` — baytlar haqidagi yozuv va
   u hech qayerga tegishli emas (avatar ham, video ham, topshiriq fayli
   ham bir xil). `Resource` — kutubxona yozuvi (papka, turkum, sevimli,
   arxiv) va unda fayl BO'LMASLIGI ham mumkin (`type="url"`). Birlashtirilsa
   avatar ham "resurs" bo'lib, papka/turkum maydonlarini ko'tarib yurardi.
3. **`pending` → `ready`.** Presign yozuv yaratadi, baytlar esa keyin
   keladi. Tugallanmagan fayl hech qayerda ko'rinmaydi va yuklab olinmaydi
   — aks holda kutubxonada ochib bo'lmaydigan qator paydo bo'lardi.
4. **Chegara IKKI marta tekshiriladi.** `presign` da — mijoz E'LON QILGAN
   hajm bo'yicha (2 GB ni yuklab bo'lgandan keyin rad etish behuda);
   `complete` da — DISKDAGI haqiqiy hajm bo'yicha (e'lon qilingani
   shunchaki mijoz aytgan son). Yuklash paytida ham oqim bo'lak-bo'lak
   sanaladi, ya'ni yolg'on `Content-Length` bilan diskni to'ldirib
   bo'lmaydi.
5. **Qaror MIME bo'yicha emas, KENGAYTMA bo'yicha.** `Content-Type` ni
   mijoz o'zi yozadi; kengaytma esa faylning qanday ochilishini belgilaydi.
   Oq ro'yxatda bajariladigan formatlar (`.exe`, `.bat`, `.msi`) va `.html`
   YO'Q — `.html` yuklab olinganda emas, ochilganda va BIZNING domenimizda
   ishga tushadi.
6. **`.svg` avatar sifatida qabul qilinmaydi.** SVG — XML va ichida
   `<script>` bo'lishi mumkin; avatar esa yagona INLINE ko'rsatiladigan
   tur (qolgan hammasi `Content-Disposition: attachment` +
   `X-Content-Type-Options: nosniff` bilan ketadi). Boshqa odamning
   profilini ochgan foydalanuvchi o'sha skriptni o'z sessiyasida ishga
   tushirardi. Resurs sifatida `.svg` mumkin — u ilova bo'lib yuklanadi.
7. **`type` va `size_kb` ni SERVER qo'yadi**, mijozdan qabul qilinmaydi.
   Aks holda 4 KB lik matn fayli "PDF · 2 GB" bo'lib ko'rinishi va
   kutubxona statistikasi yolg'on ko'rsatishi mumkin edi.
8. **Nusxa BAYTLARNI ko'chirmaydi** — ikkala yozuv bitta `File` ga ishora
   qiladi. Fayl o'zgarmas (tayyor faylni qayta yozib bo'lmaydi), shuning
   uchun ulashish xavfsiz va 200 MB lik arxiv ikki marta saqlanmaydi.
9. **Rad etish 404, 403 emas** — 403 javobning o'zi "bunday fayl bor" deb
   aytardi (M2 dagi "begona kurs 404" qarori bilan bir xil sabab).
10. **Topshiriq fayli endi haqiqiy.** M4 da `{name, size_bytes}` shunchaki
    metama'lumot edi va o'qituvchi baholash navbatida ochib bo'lmaydigan
    "ish.zip" ni ko'rardi. Endi fayl YO yuklangan (`{file: "<id>"}`), YO
    tashqi havola. Nom va hajm MIJOZDAN olinmaydi — ular `File` yozuvidan
    ko'chiriladi, aks holda talaba 2 GB lik faylni "12 KB" deb ko'rsatib
    topshiriq chegarasidan o'tib ketardi.

### Brauzerda topilgan xato — avatar hech qachon ko'rinmasdi

Birinchi yozilishida `/files/{id}/download` HAR DOIM token talab qilardi.
Avatar esa `<img src>` orqali ko'rsatiladi (js/profile.js →
`isloh_renderUserAvatar`), rasm so'rovi bo'lsa `Authorization` sarlavhasini
YUBORA OLMAYDI. Natijada rasm `error` bilan tugab, profil doim bosh
harflarga tushib qolardi: avatar yuklanardi, saqlanardi, lekin hech qachon
ekranga chiqmasdi.

Yechim: avatar — YAGONA ochiq tur (`isloh_is_public_file`). Yo'qotish
kichik, chunki avatar baribir har bir kirgan foydalanuvchiga ochiq edi
(sharhlar, chat, katalogdagi o'qituvchi), manzilda esa taxmin qilib
bo'lmaydigan UUID turadi — S3 dagi `public-read` avatar bilan bir xil
model. Qolgan hamma tur kirishni talab qiladi va ruxsat oldingidek
hisoblanadi; kirmagan foydalanuvchi ular uchun **401** oladi, 404 emas —
sessiya tugagani "topilmadi" degani emas.

### Shu modulda topilgan `ATOMIC_REQUESTS` tuzog'i

Chegaradan o'tmagan yuklashni yakunlashda baytlar ham, `pending` yozuvi ham
o'chiriladi. Lekin DRF istisnoni ushlaganda `set_rollback()` ni chaqiradi
va `ATOMIC_REQUESTS = True` ostida BUTUN so'rovni orqaga qaytaradi: baytlar
diskdan ketgan, bazadagi qator esa qolgan bo'lardi.

Ikki chora: `CompleteUploadView` va `LocalUploadView` ga
`transaction.non_atomic_requests` (ikkinchisida yana bir sabab bor —
200 MB ni diskka yozish davomida tranzaksiya ochiq turmasin), hamda
`apps/core/exceptions.py` da `isloh_validation_response` — xatoni OTMASDAN
§0.2 shakliga keltiradi.

### M5 dan keyin ham qoladigan joylar

- **Dars muharriri videoni yuklamaydi.** Serverda `Lesson.video_file` va
  `PUT /instructor/lessons/{id}/video` bor va ishlaydi, lekin frontenddagi
  dars formasi ularga ulanmagan; pleer hamon `js/course-data.js` dagi
  namuna faylni ko'rsatadi. Bu M5 emas, pleerni serverga o'tkazish ishi.
- **Topshiriq topshirish formasi** ham `js/upload.js` ga ulanmagan —
  endpoint tayyor, sahifa hali eski.
- **Tashlab ketilgan `pending` yuklashlar** yig'ilib boradi (mijoz
  presign qilib, keyin voz kechsa). Ularni tozalash fon vazifasi — M13
  dagi Celery. O'sha yerda `/uploads/presign` ga **rate limit** ham
  qo'yiladi: hozir bir foydalanuvchi cheksiz bo'sh yozuv yarata oladi
  (baytlarsiz, ya'ni disk to'lmaydi, lekin jadval o'sadi).

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

### M6 holati (2026-08-17)

**Backend yozildi va testlar bilan qulflandi (253 ta test, `check` toza,
oqim brauzerda o'tkazildi).**

| Qism | Holat |
|---|---|
| Modellar: `Review`, `ReviewReply`, `DiscussionThread`, `DiscussionReply`, `Reaction` | ✅ |
| `/courses/{id}/reviews` (o'qish ochiq, yozish yozilganlarga), `/reviews/{id}` | ✅ |
| `/instructor/reviews` + `/instructor/reviews/{id}/reply` | ✅ |
| `/discussions` CRUD + `like`, `pin`, `solve`, `replies` | ✅ |
| `/discussion-replies/{id}` + `like`, `accept`, `pin` | ✅ |
| Kurs reytingi sharhlardan (`Course.rating`, `reviews_count`) | ✅ |
| Serverda sanitizatsiya (`apps/social/sanitize.py`) | ✅ |
| Frontendda yagona `isloh_escapeHtml` (`js/escape.js`, 72 sahifa) | ✅ |
| `js/review-store.js`, YANGI `js/discussion-store.js` serverdan | ✅ brauzerda tekshirildi |

**Brauzerda o'tkazilgan oqim:** talaba mavzu ochdi (sarlavhada `<script>`
bo'lgan — server uni **tegsiz** saqladi) → yoqtirdi → o'z mavzusiga javob
yozdi → "hal qilindi" deb belgiladi → kursga sharh qoldirdi → **ikkinchi
sharh rad etildi** va kurs reytingi `5.00 / 1` bo'ldi → o'qituvchi sifatida
kirilganda mavzu qadaldi, e'lon joylandi (u ham oddiy mavzu) va sharhga
javob yozildi → `localStorage` tozalanib sahifa yangilanganda hammasi
SERVERDAN qaytdi.

**Qabul qilingan qarorlar:**

1. **Sharh va mavzu — ikki alohida model.** Qoidalari qarama-qarshi: sharh
   YAGONA (`UNIQUE(course, user)`) va reytingga ta'sir qiladi, mavzu esa
   cheksiz va reytingga umuman aloqasi yo'q. Bitta jadvalda ikkalasining
   ham qoidasi buzilardi.
2. **Kurs reytingi DENORMALIZATSIYA qilinadi** (`rating` + `reviews_count`)
   va har sharh amalida qayta hisoblanadi. Sabab M3 dagi `progress` bilan
   bir xil: katalog o'nlab kursni bir so'rovda chizadi.
3. **`Reaction` da `GenericForeignKey` EMAS.** Ikkita nullable FK
   (`thread`, `reply`) + baza darajasidagi `CheckConstraint`: `contenttypes`
   har sanoqqa qo'shimcha JOIN qo'shardi, ikkita FK esa oddiy indeksga
   tushadi. "Aynan bittasi to'ldirilgan" shartini BAZA qo'riqlaydi, ya'ni
   uni ko'rinishda unutib bo'lmaydi.
4. **Sanoqlar so'rovda (`annotate`), mijozda emas.** Ilgari like soni
   `textContent` dan o'qilib bittaga oshirilardi (js/discussion.js) — hech
   qayerda saqlanmasdi va tugmani ikki marta bosish uni ikki marta
   oshirardi. Endi `UNIQUE(user, thread)` bir odamni bir marta sanaydi.
5. **Javoblar mavzu bilan BIRGA keladi** (`replies[]`). Har mavzu uchun
   alohida so'rov ro'yxatda o'nlab so'rov bo'lardi.
6. **Ichma-ich javob IKKI daraja bilan cheklangan.** Frontendda faqat
   `.comment-card` va `.comment-card.nested` sinflari bor — uchinchi daraja
   sahifadan chiqib ketardi. Nevara javob RAD ETILMAYDI, u bobosiga
   biriktiriladi: foydalanuvchi yozganini yo'qotmasligi kerak.
7. **Moderatsiya kurs egasida, tahrir esa muallifda.** O'qituvchi o'z
   kursidagi istalgan mavzu/javobni o'chiradi, qadaydi va "hal qilindi"
   deb belgilaydi; muallif faqat O'ZINIKINI tahrirlaydi. "Hal qilindi" ni
   mavzu muallifi ham qo'ya oladi — javobni olganini u o'zi biladi.
8. **E'lon alohida tushuncha emas.** U `isloh_announcements` kalitida
   yashardi, ya'ni FAQAT o'qituvchining brauzerida ko'rinardi — talabalar
   e'lonni umuman ko'rmasdi. Endi u oddiy mavzu va "Qadash" bilan tepaga
   chiqariladi.

### XSS — ikki qatlam va ularning rollari HAR XIL

M6 dan boshlab ekranda BOSHQA foydalanuvchining matni chiziladi. Shu
paytgacha frontenddagi deyarli barcha matn o'z egasining ma'lumoti edi:
eng yomon holatda odam o'z sahifasini buzardi.

| Qatlam | Qayerda | Nima uchun javob beradi |
|---|---|---|
| **Chizishda ekranlash** | `js/escape.js` | ASOSIY himoya — har qanday manbadagi matn uchun ishlaydi |
| **Saqlashda tozalash** | `apps/social/sanitize.py` | bazaga teg tushmasin: matnni ekranlashni unutgan KELAJAKDAGI ko'rinish ham zarar bermasin |

`strip_tags` ni yagona himoya deb hisoblash mumkin emas va Django hujjati
buni ochiq aytadi — aynan shuning uchun u ikkinchi qatlam.

**Ekranlash ilgari IKKI JOYDA alohida yozilgan va ular BIR XIL
ISHLAMASDI:** `js/chat.js` faqat `<` va `>` ni almashtirardi (atribut
ichida yetarli emas), `js/profile-sections.js` esa `'` ni qoldirardi (bir
tirnoqli atributda yetarli). Endi qoida bitta joyda va `js/escape.js` 72
sahifaga qo'shildi. Uchta funksiya bor: `isloh_escapeHtml` (matn),
`isloh_escapeAttr` (atribut) va `isloh_safeCssValue`.

**`isloh_safeCssValue` — bu ekranlash EMAS, OQ RO'YXAT.** Avatar rangi va
kurs muqovasi do'kondan keladigan MATN maydoni, ya'ni unga istalgan narsa
yozilishi mumkin. CSS ichida ekranlash yetarli emas: `url(javascript:...)`
va `expression(...)` umuman teg ochmasdan ish bajaradi. Shuning uchun
faqat kutilgan belgilar qoldiriladi.

### Brauzerda topilgan xato — "meniki" ISM bo'yicha aniqlanardi

Tahrirlash va o'chirish tugmalari faqat muallifga chiziladi. Birinchi
yozilishida muallif `isloh_getUserProfile().name` bilan solishtirilardi va
brauzerda yiqildi: mahalliy profildagi ism serverdagi ism bilan mos
kelmasa, muallif O'Z mavzusida hech qanday tugma ko'rmasdi. Ikki xil
odamning ismi bir xil bo'lishi ham mumkin.

Yechim: `islohApi.currentUserId()` — id access token ichida yotadi
(SimpleJWT `user_id`), ya'ni qo'shimcha so'rov kerak emas. Bu tekshiruv
XAVFSIZLIK emas, KO'RINISH uchun; ruxsatni server baribir qayta tekshiradi.

### Testda topilgan xato — `annotate()` YANA `Meta.ordering` ni yo'q qildi

`DiscussionThread.Meta.ordering = ["-is_pinned", "-created_at"]` yozilgan
edi, lekin so'rovda `annotate()` bor (`like_count`, `reply_count`) va
Django shunda modelning tartibini SQL'ga umuman chiqarmaydi. Natija:
o'qituvchi mavzuni qadab qo'yardi, lekin u ro'yxat tepasiga chiqmasdi.

**Bu AYNAN M2 dagi katalog sahifalash xatosining ikkinchi ko'rinishi**
(§"O'tishda topilgan XATO"). Tuzatildi: `.order_by("-is_pinned",
"-created_at", "id")` oshkora. Qoida: `annotate()` bo'lgan har bir so'rovda
`order_by` OSHKORA yoziladi.

### M6 dan keyin ham qoladigan joylar

- **Dars ichidagi izohlar** (`course-player.html`) hamon `js/comments.js`
  bilan, ya'ni faqat DOM'da. U ham muhokama, lekin boshqa kontekstda
  (dars bo'yicha) — uni serverga o'tkazish pleerni serverga ko'chirish
  bilan birga bo'ladi.
- **Sharh YOZISH formasi** talaba tomonida hali yo'q: endpoint va do'kon
  funksiyalari (`isloh_submitCourseReview`) tayyor, lekin kurs sahifasida
  forma chizilmagan.
- **158 ta `innerHTML`** ning hammasi tekshirilmadi. M6 da boshqa
  foydalanuvchi matni chiziladigan joylar (sharh, muhokama, javob, avatar)
  yopildi; qolganlari o'z egasining ma'lumoti bilan ishlaydi va M13 dagi
  umumiy audit paytida ko'rib chiqiladi.

---

## M7 — Bildirishnomalar

**Model:** `Notification` (rol bo'yicha ajratilgan).

Voqealar boshqa modullardan keladi: yangi ro'yxatga olish (M3), topshiriq
topshirildi (M4), sharh yozildi (M6), to'lov o'tdi (M9).
`isloh_addNotification` frontendda shu uchun tayyor.

**Yetkazish:** REST + WebSocket (`/ws/notifications` — M8 da ulandi).

---

### M7 holati (2026-08-19)

**Backend yozildi va testlar bilan qulflandi (272 ta test, `check` toza.)**

| Qism | Holat |
|---|---|
| Model: `Notification` (rol bo'yicha ajratilgan) | ✅ |
| `GET /notifications?role=`, `/notifications/unread-count` | ✅ |
| `POST /notifications/{id}/read`, `/notifications/read-all`, `DELETE` | ✅ |
| Voqealar: yozilish (M3), topshirish va baholash (M4), sharh, sharhga javob, muhokama javobi (M6) | ✅ |
| `js/notification-store.js` fabrikaga va serverga | ✅ |
| `pages/shared/notifications.html` do'kondan chiziladi | ✅ |

**Qabul qilingan qarorlar:**

1. **Voqealar OSHKORA chaqiriladi, signal bilan emas.** `post_save`
   ishlatilsa bildirishnoma yashirin yon ta'sir bo'lib qolardi:
   `Enrollment.objects.create(...)` yozgan odam uni ko'rmaydi va testlarda
   har bir yozuv kutilmagan qatorlar yasardi. Butun mantiq
   `apps/notifications/events.py` da — "qaysi voqea kimga boradi" savoli
   BITTA joyda.
2. **O'zingga bildirishnoma kelmaydi.** Tekshiruv `isloh_notify` ning
   ichida, har chaqiruv joyida emas — o'qituvchi o'z mavzusiga javob
   yozsa yoki o'z kursiga o'zi yozilsa ro'yxat shovqinga to'lmaydi.
3. **Bildirishnoma hech qachon so'rovni yiqitmaydi.** U yon ta'sir: xabar
   yozilmasa ham talabaning topshirig'i topshirilishi kerak. Har chaqiruv
   `try/except` ichida va jurnalga yoziladi (test bilan qulflangan).
4. **`read_at`, `read` EMAS.** "Qachon o'qidi" keyin kerak bo'ladi (M11),
   bayroqdan esa vaqtni tiklab bo'lmaydi. Ikkinchi marta belgilash vaqtni
   O'ZGARTIRMAYDI — birinchi o'qish vaqti saqlanadi.
5. **Xabarni mijoz YARATA OLMAYDI** — `POST /notifications` umuman yo'q va
   serializerdagi hamma maydon `read_only`. Aks holda istalgan odam o'ziga
   yolg'on xabar yozib qo'yardi.
6. **O'qilmaganlar soni ALOHIDA endpoint'da.** Qizil nuqta 60+ sahifada
   turadi, ro'yxat esa faqat ikkitasida kerak. Do'kon fabrikasiga
   `isLoaded()` qo'shildi: ro'yxat allaqachon yuklangan bo'lsa nuqta
   undan sanaydi, aks holda yengil `unread-count` ga boradi.
7. **`isloh_addNotification` OLIB TASHLANDI.** U mahalliy yolg'on xabar
   yasardi; endi xabarni faqat server yozadi.

**Matn bu yerda ham ekranlanadi.** Xabar matnini server yozadi, lekin
ichida boshqa foydalanuvchining ismi va kurs nomi bor — ya'ni M6 qoidasi
shu yerga ham tegishli. `href` esa atributga tushadi va u oddiy ekranlash
bilan yetarli emas (`javascript:` ekranlangandan keyin ham ishlaydi),
shuning uchun u OQ RO'YXATdan o'tadi: faqat `*.html` fayl nomi.

**M7 dan keyin ham qoladigan joylar:**

- **`js/notif-panel.js` — o'lik kod.** Qo'ng'iroq menyusi bironta sahifaga
  ULANMAGAN (0 ta sahifa) va ichida rol bo'yicha o'z namunaviy ma'lumoti
  bor. Uni do'konga ko'chirish yoki butunlay olib tashlash — alohida
  qaror; hozircha tegilmadi, chunki u hech qayerda ishlamaydi va zarar
  keltirmaydi.
- ~~**WebSocket** M8 dan keyin~~ ✅ M8 da ulandi: `/ws/notifications`
  yangi bildirishnomani darhol yetkazadi (`isloh_notifApplyIncoming`).
- **To'lov voqeasi (`payment`)** M9 da ulanadi — tur allaqachon bor.

---

## M8 — Xabarlar ✅

**Modellar:** `ChatThread`, `ChatMember` (`unread_count`, `archived`,
`muted`), `ChatMessage`, `Presence`.

Frontenddagi model allaqachon to'g'ri edi: `members[]` ro'yxati, rolga
qarab "men" — ya'ni bitta suhbat ikki tomondan ko'rinadi. Serverda ham
xuddi shunday.

**`ChatMember` nega alohida jadval:** uchta maydon SUHBATGA emas, ODAMGA
tegishli — o'qituvchida 3 ta o'qilmagan, talabada 0 ta; men arxivladim,
suhbatdoshim uchun suhbat faol qolaveradi. Frontend ularni thread maydoni
deb ko'radi, serializer esa joriy foydalanuvchining a'zoligidan o'qiydi.

**Endpoint'lar:**

```
GET    /chat/threads                    do'kon endpoint'i (MASSIV, §0.1)
POST   /chat/threads/direct             {user_id | email} -> suhbat
POST   /chat/threads/course/{id}        kurs guruhi (a'zolar sinxronlanadi)
GET    /chat/threads/{id}               bitta suhbat
PATCH  /chat/threads/{id}               archived / muted / pinned_note
POST   /chat/threads/{id}/read          o'qilmaganlarni nollash
GET    /chat/threads/{id}/messages      KURSOR (?before=&limit=)
POST   /chat/threads/{id}/messages      yuborish
GET    /chat/users?q=                   kontaktlar katalogi (MASSIV)
GET    /chat/unread-count               yon menyu nishoni
```

**Kursor:** `"<vaqt>|<id>"`. Faqat vaqt yetarli emas — bir mikrosoniyada
yozilgan ikki xabar chegaraga tushsa, `<` bilan biri yo'qolardi, `<=`
bilan ikki marta kelardi.

**Real vaqt:** Django Channels. `WS /ws/chat` (xabar, `presence`,
e'lon), `WS /ws/notifications` (M7). Kanal qatlami: dev'da xotira
(Redis'siz ham ishlaydi), ishlab chiqarishda Redis
(`config/settings/prod.py`, `docker-compose.yml` da `redis` xizmati).

**Token sarlavhada:** brauzer `new WebSocket(...)` ga `Authorization`
qo'yishga imkon bermaydi, refresh cookie esa `path=/api/` bilan
yozilgan. Yechim — sub-protokol: `new WebSocket(url, ['isloh-jwt',
token])`. Brauzer buni `Sec-WebSocket-Protocol` sarlavhasida yuboradi,
ya'ni token manzil qatorida, jurnalda va brauzer tarixida qolmaydi.
`?token=` ham qabul qilinadi — faqat qo'lda sinash uchun.

**Kanal FAQAT O'QIYDI.** Yozish REST'da qoladi: ikki yozish yo'li vaqt
o'tishi bilan farq qila boshlardi, va mijoz optimistik yozuvni SERVER
bergan id bilan almashtirishi kerak (fabrikadagi naqsh) — WebSocket'da
buning uchun qo'shimcha "correlation id" mexanizmi kerak bo'lardi.

**Ruxsat:** suhbatga faqat A'ZO kiradi, begona uchun **404** (403 ning
o'zi suhbat borligini oshkor qilardi — M2 dan beri saqlanadigan qaror).
Chat ochiq katalog emas: yozish mumkin bo'lgan odamlar — mavjud
suhbatdoshlar, o'quv aloqasi (o'qituvchi ↔ o'z talabalari) va
administratorlar (qo'llab-quvvatlash).

**Frontend:** `js/chat-store.js` butunlay qayta yozildi — manba endi
server, `localStorage` esa OFFLINE NUSXA. Sinxron shartnoma saqlandi
(`isloh_chatThreads()` va boshqalar avvalgidek sinxron), shuning uchun
js/chat.js ning chizish mantiqi o'zgarmadi. Ikkita funksiya Promise
qaytaradi — `isloh_chatOpenDirect` va `isloh_chatOpenCourseGroup`:
suhbat SERVERDA yaratiladi va id'sini faqat javob beradi.

Yangi: `js/realtime.js` (ikkala WebSocket kanali, qayta ulanish,
`ping`), `[data-chat-older]` tugmasi (kursor sahifalash), kurs
guruhiga chuqur havola (`messages.html?course=<id>`, kurslar
menyusidan).

**Testlar: 41 ta** (jami 313). Ular ichida `channels.testing` bilan
haqiqiy WebSocket ulanishi: token yo'q → rad, begona `Origin` → rad,
sub-protokol → qabul, xabar yetkazish, `presence` yozilishi.

### Brauzerda topilgan va tuzatilgan uchta xato

Uchalasi ham **testda ko'rinmasdi** — shuning uchun 6-mezon (brauzerda
uchidan-uchiga oqim) qog'ozdagi shart emas:

1. **UUID JSON'ga o'girilmasdi.** DRF serializeri `.data` ichida UUID
   OBYEKTINI qoldirardi. REST yo'lida `JSONRenderer` uni o'girib
   yuborardi, WebSocket yo'lida esa `json.dumps` yiqilardi — xabar
   bazada bor edi, lekin suhbatdoshga YETMASDI va ekranda hech qanday
   xato yo'q edi. Ikki qatlamda tuzatildi: serializerlarda `UUIDField`
   va `apps/messaging/realtime.py` dagi markaziy `isloh_json_safe`.
2. **O'z xabarim ikki marta chizilardi.** U ikki yo'ldan keladi:
   optimistik nusxa (`pending`) va WebSocket eshittirishi. Id bo'yicha
   solishtirish yordam bermaydi — optimistik nusxaning id'si hali
   `tmp-...`. `isloh_chatIsDuplicate` ikkala holatni ham tekshiradi.
3. **Ikki `PATCH` bir-birini bekor qilardi.** "Arxivdan qaytar" va
   "ovozni yoq" ketma-ket bosilganda ikkinchi so'rov birinchisidan OLDIN
   o'qigan nusxani saqlab, uning natijasini yo'qotardi. Serverda
   `update_fields` (har so'rov faqat o'z ustuniga tegadi), mijozda esa
   yozuv navbati — fabrikadagi bir xil qaror.

Yana bittasi ko'rinishga tegishli edi: suhbat sarlavhasi faqat suhbat
OCHILGANDA chizilardi, ya'ni katalog suhbatlardan keyin kelganda
"Noma'lum foydalanuvchi" turib qolardi (`isloh_paintThreadHeader`).

### Bu modulda YOPILMAGAN

- **Fayl biriktirish** — tugma hali `data-backend-pending`. Yuklash
  zanjiri M5 da tayyor (presign → PUT → complete), lekin `ChatMessage`
  da hali fayl maydoni yo'q.
- **Chat xabari uchun bildirishnoma.** `message` turi M7 da bor, lekin
  har bir xabarga bildirishnoma yozilsa ro'yxat shovqinga to'lardi.
  To'g'ri qoida — "ulanmagan odamga yozish" va u ulanish holatini
  bilishni talab qiladi (M13 dagi fon vazifasi bilan).
- **Guruhga qo'lda a'zo qo'shish.** Guruh a'zoligi kursga yozilishdan
  KELIB CHIQADI (`isloh_open_course_group` har ochishda sinxronlaydi).
  Ixtiyoriy guruh — alohida xususiyat.
- **Xabarni tahrirlash va o'chirish** — frontendda ham boshqaruv yo'q.
- **Eski yozishmalarni tozalash** — M13 dagi fon vazifasi.

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
| **Rate limiting** | `/auth/login`, `/auth/register`, `/auth/forgot-password` — brute force'ga qarshi; `/uploads/presign` — bo'sh yozuv toshqiniga qarshi (DRF throttling) |
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
| Qolgan **19 do'konni** fabrikaga o'tkazish | har modul bilan birga |
| **Obunachilarni tekshirish** — har do'kon uchun majburiy | har modul bilan |
| ~~`isloh_escapeHtml` birlashtirish~~ | ✅ M6 da bajarildi (`js/escape.js`) |
| ~~Muhokama do'koni~~ / jonli sessiya / admin do'konlari | ✅ M6 (`js/discussion-store.js`); jonli sessiya va admin — M12 |
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
