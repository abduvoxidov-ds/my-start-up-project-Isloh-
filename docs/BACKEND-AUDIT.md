# Backend'ga tayyorlik: audit va ish rejasi

> Dastlabki audit: 2026-08-13 · Oxirgi yangilanish: 2026-08-14
> Qamrov: 69 ta HTML sahifa, 105 ta JS moduli, 9 ta CSS qatlami.

**Holat: 4 ta bloker yopildi. Qolgan asosiy ish — 21 ta do'konni o'tkazish.**

Dastlabki baho 7/10 edi. Uchta tizimli to'siq (HTTP qatlami yo'q, do'konlar
sinxron, auth yo'q) va Loading/Error UI yo'qligi endi hal qilingan; ularning
har biri brauzerda tekshirilgan.

---

## 1. Bajarilgan ishlar

| # | Bloker | Yechim | Holat |
|---|---|---|---|
| 1 | HTTP qatlami yo'q | `js/api.js` — `islohFetch` + `islohApi` | ✅ 68 sahifada |
| 2 | Do'konlar sinxron | Sync-over-Async kesh + `isloh_createStoreCache` fabrikasi | 🟡 **2/23 do'kon** |
| 3 | Auth va route guard yo'q | `js/auth-guard.js` | ✅ tasdiqlangan |
| 4 | Loading / Error UI yo'q | `js/ui-feedback.js` + CSS | ✅ tasdiqlangan |

### 1.1 `js/api.js` — tarmoq qatlami

```
islohFetch(endpoint, options)
islohApi.get / post / put / patch / delete
islohApi.setToken / clearToken / getToken / setBaseUrl
isloh_createStoreCache(config)          ← do'kon fabrikasi
```

- **Muvaffaqiyat** → parse qilingan `data` (204 → `null`)
- **Xato** → `reject({ success:false, error, status, code, fields })`.
  `fields` to'g'ridan-to'g'ri `[data-error-for="<maydon>"]` ga tushadi.
- **401** → token o'chadi + login'ga. Login formasida `skipAuthRedirect: true`
  (u yerda 401 — noto'g'ri parol, sessiya tugashi emas).
- **`file://`** birinchi qatorda tekshiriladi (CLAUDE.md §3) — brauzerning
  tushunarsiz "Failed to fetch" xabari o'rniga aniq sabab.
- **`cache: 'no-store'`** — API javoblari brauzer keshiga tushmasin.
  Tekshiruvda aniqlangan: keshsiz holatda o'chirilgan endpoint hamon `200`
  qaytarardi va "Qayta urinish" serverga bormay "tuzaldi" deb ko'rsatardi.
- 15s timeout (`AbortController`), `FormData` da `Content-Type` qo'yilmaydi,
  `Accept-Language` — `isloh_i18nLang()` dan.

### 1.2 Sync-over-Async kesh

Muammo: sahifalar `isloh_getCourses()` ni **sinxron** chaqiradi (~150 joyda),
API esa async. Yechim — chaqiruv joylariga umuman tegmaslik:

1. `get()` keshdan **darhol** javob beradi (localStorage nusxasi yoki demo);
2. `load()` fonda ketadi;
3. tugagach `isloh:<nom>-updated` yuboriladi va sahifalar qayta chiziladi.

`localStorage` endi **manba emas, offline nusxa**. Seed o'qishda yozilmaydi —
aks holda bo'sh holat hech qachon ko'rinmasdi va demo ma'lumot serverga
ketib qolardi.

Yozish **optimistik**: kesh darhol yangilanadi, server rad etsa orqaga
qaytariladi (o'chirilgan yozuv o'sha o'ringa qaytadi).

Fabrika (`js/api.js`):

```js
const ISLOH_ENROLLMENT_CACHE = isloh_createStoreCache({
  key: ISLOH_ENROLLMENTS_KEY,        // localStorage kaliti
  endpoint: '/enrollments',
  event: 'isloh:enrollments-updated',
  normalize: isloh_normalizeEnrollment,
  seed: isloh_enrollmentSeed          // massiv YOKI funksiya
});
// { get, load, retry, persist, remove, fallback }
```

**Uchta nozik joy (ularsiz jimgina buziladi):**

1. Hodisa **`document`** ga yuboriladi, `window` ga emas — loyihadagi barcha
   obunachilar `document.addEventListener` yozadi.
2. `retry()` nosozlikda **qayta otadi** — `load()` xatoni yutadi va reject
   qilmaydi, shu sababli banner "tuzaldi" deb yopilib ketardi.
3. `persist()` da `isNew` **keshdagi id bo'yicha** aniqlanadi, tashqaridan
   berilmaydi — aks holda ro'yxatda ikki nusxa paydo bo'lardi.

### 1.3 Auth va route guard

`js/auth-guard.js` — himoyalangan papkalar (`/student/`, `/instructor/`,
`/admin/`) da token yo'q bo'lsa `login.html` ga. Guard `DOMContentLoaded` ni
kutmaydi (sahifa "ko'rinib-yo'qolmasin") va `file://` da o'chirilgan.

Auth formalari `islohApi.post` ga ulandi; inline `onsubmit` **atribut sifatida
olib tashlanadi** — `addEventListener` uni to'xtatmaydi va u tokensiz ham
dashboard'ga otib yuborardi.

Inputlarga `required` + `data-auth-field` qo'shildi (validator ularsiz hech
narsa tekshirmasdi), formalarga `novalidate` (brauzerning native tooltip'i
`.field-error` blokidan oldin chiqardi).

### 1.4 Loading / Error UI

`js/ui-feedback.js` → `window.islohUI`:

- `setButtonLoading(btn, bool, text)` — spinner; asl markup `data-prev-html`
  da saqlanadi (ikonkali tugma buzilmasin).
- `showNetworkError(retryCallback, message)` — bitta banner + "Qayta urinish";
  takroriy xatolar ustma-ust to'planmaydi.
- `validateForm(form)` → `{ valid, errors }`; bo'sh `required` maydonlarni
  `data-error-for` + `.is-invalid` orqali belgilaydi, birinchisiga fokus.
  Maydon kaliti istalgan `data-*-field` dan olinadi (CSS atribut selektori
  nom bo'yicha wildcard qo'llab-quvvatlamaydi — `dataset` kaliti tekshiriladi).

CSS: `.spinner-sm` → `css/animations.css`, `.net-error*` → `css/widgets.css`.
Alohida `<link>` **kerak emas** — `css/style.css` ikkalasini ham `@import`
qiladi.

---

## 2. Qolgan ish: 21 ta do'kon

`course-store` va `enrollment-store` o'tkazildi. Har bir do'kon uchun
**uch qadam** (3-qadam amalda eng ko'p unutiladigani):

1. `isloh_createStoreCache({...})` + yupqa o'ramlar (~15 qator)
2. Yozish amallarini `persist` / `remove` ga bog'lash; sinxron qaytaruvchi
   funksiyalar (`isloh_save*`) sinxron **qoladi** — chaqiruvchilar natijani
   darhol kutadi
3. **O'qiydigan HAR BIR modul `isloh:<nom>-updated` ga obuna ekanini
   tekshirish**

> 3-qadam bo'yicha ogohlantirish: kurslar do'konida to'rtta modul
> (`instructor-courses`, `marketplace`, `market-insights`, `profile-sections`)
> obuna emas edi va API javobi kelgach ham zaxira ma'lumotni ko'rsatib
> turardi — bu sync-over-async'ning butun ma'nosini yo'qqa chiqaradi.
> `marketplace` da render va listener ulash aralash edi: butun `init` ni
> obuna qilish kupon tugmasini ikki marta ishlatib yuborardi.

Navbat (bog'liqlik bo'yicha):

```
content-store      assignment-store   quiz-store        question-store
resource-store     review-store       notification-store
chat-store (4 kalit)   ai-store       notes-store       tasks
certificate-engine     settings-store  platform-settings  profile
marketplace (cart/orders/purchased)    draft-store       progress-metrics
lesson-viewer (course_progress + video_positions)
```

---

## 3. API endpoint'lar

```
Base URL:  /api/v1
Auth:      Authorization: Bearer <access_token>  (JWT, 15 daq)
           Refresh: httpOnly cookie, 30 kun
Til:       Accept-Language: uz | en | ru
Sahifalash: ?page=1&per_page=20 → { data: [...], meta: { page, per_page, total } }
Xato:       { error: { code, message, fields: { "<maydon>": "<xabar>" } } }
```

Pul qiymatlari — **butun son, eng kichik birlikda** + `currency`. Hozir
frontend USD (provider) va so'm (talaba) bilan ishlaydi va
`ISLOH_USD_TO_UZS = 12600` koeffitsientini `js/course-store.js:30` da saqlaydi;
backend ikkala qiymatni bersa bu koeffitsient o'chadi.

### Auth va sessiya

| Metod | URL |
|---|---|
| `POST` | `/auth/register` — `{ full_name, email, password, role, organization? }` |
| `POST` | `/auth/login` — `{ email, password, remember }` |
| `POST` | `/auth/refresh`, `/auth/logout` |
| `POST` | `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` |
| `GET` | `/auth/me` — `{ id, email, roles: [], active_role, profile }` |
| `GET`/`DELETE` | `/auth/sessions[/{id}]` |
| `POST` | `/auth/oauth/{google\|apple}` |

> Frontend `res.access_token` va `res.user.role` ni kutadi — rolga qarab
> dashboard'ga yo'naltiradi (`ISLOH_ROLE_HOME`).

### Profil va sozlamalar

`GET`/`PATCH` `/users/me/profile?role=` · `POST` `/users/me/avatar`
(multipart) · `GET`/`PATCH` `/users/me/settings` va `/users/me/settings/{role}`
· `DELETE` `/users/me` · `GET` `/users/me/export`

### Kurslar va tarkib

`GET`/`POST` `/instructor/courses` · `GET`/`PATCH`/`DELETE`
`/instructor/courses/{id}` · `POST` `/instructor/courses/{id}/duplicate`,
`/publish` · `PATCH` `/instructor/courses/{id}/status` · `GET`/`PUT`
`/instructor/courses/{id}/settings`

`GET`/`POST`/`PATCH`/`DELETE` `/instructor/courses/{id}/modules[/{moduleId}]`
· `PATCH` `.../modules/reorder` — `{ order: [id] }` · shu naqsh darslar uchun
ham (`/instructor/modules/{id}/lessons`) · `POST` `/instructor/lessons/{id}/video`

### Testlar, topshiriqlar, resurslar

`/instructor/quizzes[/{id}]` · `PUT` `/instructor/quizzes/{id}/questions` —
`{ questionIds: [] }` (tartib muhim) · `/questions[/{id}]` ·
`POST` `/student/quizzes/{id}/attempts`, `/student/quiz-attempts/{id}/submit`

`/instructor/assignments[/{id}]` · `GET` `/instructor/submissions?status=pending`
· `POST` `/instructor/submissions/{id}/grade` · `POST`
`/student/assignments/{id}/submissions` (multipart)

`/resources[/{id}]` (multipart) · `GET` `/resources/{id}/download`

### Katalog va savdo

`GET` `/catalog`, `/catalog/{courseId}` · `/cart[/items/{courseId}]` ·
`POST` `/cart/coupon` · `/orders[/{id}/refund-request]` · `/wishlist` ·
`/bookmarks` · `POST` `/payments/webhook`

### O'qish jarayoni

`/student/enrollments` · `GET` `/student/courses/{id}/progress` —
`{ [lessonId]: true }` · `PUT` `/student/lessons/{id}/progress` —
`{ done, position_seconds }` · `/student/notes` · `/student/tasks` ·
`/student/certificates` · `GET` `/certificates/verify/{code}` (**ochiq**)

### Ijtimoiy va xabarlar

`/courses/{id}/reviews` · `/reviews/{id}/reply` ·
`/courses/{id}/threads`, `/threads/{id}/replies`, `/replies/{id}`,
reaksiya/pin/solve · `/chat/threads[/{id}/messages]`, `/read` ·
`WS /ws/chat` (presence) · `/notifications`, `WS|SSE /ws/notifications`

### AI

`/ai/threads[/{id}]` · `POST` `/ai/threads/{id}/messages` —
**`text/event-stream`** · `POST` `/ai/templates/{key}/run`

### Analitika va admin

`GET` `/instructor/analytics/overview?period=` ·
`GET` `/instructor/analytics/timeseries?metric=&period=` ← **barcha
`.placeholder-note` bilan belgilangan grafiklar shuni kutmoqda** ·
`/instructor/students`, `/instructor/revenue/*`, `/instructor/payouts`,
`/market/insights`

`/admin/stats`, `/admin/users`, `/admin/courses?status=pending`,
`/approve`, `/reject`, `/archive`, `/admin/coupons`, `/admin/banners`,
`/admin/settings`, `/admin/audit-log`

**Jami: ~110 endpoint.**

---

## 4. Ma'lumotlar bazasi (~55 jadval)

**Identifikatsiya:** `users`, `user_roles`, `user_profiles` (bio/headline rol
bo'yicha farq qiladi), `user_skills`, `user_goals`, `user_settings`, `sessions`

**Kurslar:** `categories`, `courses`, `course_tags`, `course_modules`
(`position`), `lessons` (`position`, `type`), `course_settings`

**O'qish:** `enrollments`, `lesson_progress` (`completed_at` + `position_sec` —
`isloh_course_progress` va `isloh_video_positions` **birlashadi**), `notes`,
`tasks`, `certificates`

**Baholash:** `quizzes`, `questions`, `question_options`, `quiz_questions`,
`quiz_attempts`, `quiz_answers`, `assignments`, `assignment_rubric`,
`submissions`, `submission_files`

**Fayllar:** `files` (yangi — hozir faqat metama'lumot saqlanadi), `resources`

**Ijtimoiy:** `reviews`, `review_replies`, `discussion_threads` (yangi),
`discussion_replies`, `reactions`

**Xabarlar:** `chat_threads`, `chat_members` (`unread_count`), `chat_messages`

**AI:** `ai_threads` (deterministik id: `contextKey::courseId::lessonId`),
`ai_messages`

**Savdo:** `cart_items`, `wishlist_items`, `bookmarks`, `coupons`, `orders`,
`order_items`, `payouts`, `payout_methods`

**Platforma:** `notifications`, `live_sessions`, `session_participants`,
`announcements`, `platform_settings`, `audit_log`

**Analitika (eng katta bo'shliq):** `events`, `daily_course_stats` — hozir
hech qanday do'kon vaqt qatorini saqlamaydi, do'konlar faqat joriy HOLATNI
biladi.

---

## 5. Backend ro'yxatiga kiritilgan vazifalar

### 5.1 Statik fayllar kesh nazorati ⚠️

Backend routerda `/js/*` va `/css/*` fayllarga **`Cache-Control: no-cache`**
berilishi hamda HTML importlarda **versiyalangan URL** (`api.js?v=<hash>`)
qo'llanilishi shart.

**Nega:** lokal tekshiruv paytida brauzer o'zgartirilgan JS fayllarni keshdan
olishda davom etdi — `?bust=` parametri ham, majburiy reload ham yordam
bermadi, chunki server `Cache-Control` yubormaydi va brauzer evristik
keshlashga o'tadi. Ishlab chiqarishda bu deploy'dan keyin foydalanuvchilarni
eski JS bilan qoldiradi: yangi `api.js` bilan eski `course-store.js`
aralashib, tashxis qo'yish qiyin nosozlik beradi.

### 5.2 Kelishuv talab qiladigan joylar

1. **Hisoblangan holat qayerda?** `isloh_enrollmentState()` (Faol/Sust/Faol
   emas) va `isloh_submissionState()` hozir frontendda hisoblanadi. Ikki
   tomonda takrorlanmasin — **tavsiya:** backend `state` maydonini javobda
   bersin, frontend faqat ko'rsatsin.
2. **"Talabalar" ikki xil ma'noda:** `courses.students` (sotuv soni) va
   `enrollments` (yozuvlar soni) ataylab farq qiladi
   ([INSTRUCTOR-FRONTEND.md](INSTRUCTOR-FRONTEND.md) §4). Backend bitta
   ta'rifni tanlab, ikkinchisini alohida nom bilan qaytarsin.
3. **`data-stat` resolverlari:** 25 ta ko'rsatkich frontendda hisoblanadi
   (`js/profile-stats.js`). Ro'yxatlar sahifalanadigan bo'lsa frontend butun
   to'plamni ko'rmaydi va hisoblay olmaydi — ular
   `GET /instructor/analytics/overview` javobiga ko'chishi shart.
4. **ID formati:** hozir slug ham, id ham bir xil (`py-101`). Backend uuid
   bersa, frontendda `id` (uuid) va `slug` (URL) ajratilishi kerak — `?id=`
   parametri 20 dan ortiq sahifada ishlatiladi.
5. **AI oqimi:** `text/event-stream` + so'rov bilan til yuborilsin
   ([AI-LAYER.md](AI-LAYER.md) §6).
6. **Real vaqt:** chat va bildirishnomalar uchun WebSocket; `presence` hozir
   statik namuna.
7. **Fayl saqlash:** S3-mos xizmat, imzolangan URL orqali to'g'ridan-to'g'ri
   yuklash (avatar, resurs, topshiriq fayli, kurs videosi).

---

## 6. Frontendda qolgan kamchiliklar

Bloker emas, lekin backend ulanishidan oldin/keyin hal qilinadi:

| Nima | Qayerda |
|---|---|
| **Admin moduli markupda** — 6 sahifa, do'kon yo'q (`admin-users.js` faqat DOM qatorini `.remove()` qiladi) | `pages/admin/` |
| **Muhokamalar DOM'da** — like soni `textContent` dan o'qiladi, saqlanmaydi | `discussions` (2 sahifa) |
| **Jonli sessiyalar markupda** | `live-sessions` (2 sahifa) |
| **`innerHTML` + escape yo'q** — 158 ta yozuv, escape yordamchisi faqat 5 ta modulda (`chat`, `notes`, `bookmarks`, `profile-editor`, `profile-sections`). Sharh/muhokama matni **boshqa foydalanuvchidan** kelganda saqlangan XSS yuzasi (`js/instructor-reviews.js:60` — `<div class="review-text">${review.text}</div>`) | butun loyiha |
| **Klient tomonda ID yasash** — `isloh_uniqueCourseId`, `'en-' + Date.now()`. Vaqtinchalik id sifatida ishlaydi (server javobida almashadi), lekin shartnoma yozib qo'yilsin | do'konlar |
| **Filtr/qidiruv DOM'da** (`js/filterable.js`) — server tomonda sahifalash joriy qilinsa qayta ko'rib chiqiladi | 22 sahifa |
| **Tarjima qamrovi** — instruktor sahifalari `data-i18n` bilan belgilangan, lekin lug'atda `en`/`ru` yozuvlari yo'q | `js/i18n.js` |
