# Isloh

**Isloh** — oddiy video-kurs platformasi emas, balki **AI qo'llab-quvvatlaydigan zamonaviy ta'lim ekotizimi** sifatida rejalashtirilgan Online Learning Management System (LMS). G'oya — Coursera + Udemy + Teachable + Notion + AI Assistant elementlarini bitta platformada birlashtirish.

> Hozirgi bosqich: **frontend** (67+ HTML sahifa) to'liq interaktiv holatga keltirilmoqda. Backend/API integratsiyasi keyingi bosqichda qo'shiladi.

## Platforma qanday ishlaydi

**Rollar:** Student (o'qiydi), Instructor (kurs yaratadi va sotadi), Admin (platformani boshqaradi, admin tomonidan tayinlanadi). To'rtinchi qatlam — **AI** — ham student, ham instructor tomonini qo'llab-quvvatlaydi.

### Student oqimi
```
Register → Login → Dashboard
   → Marketplace (qidiruv / filter / wishlist / solishtirish / sotib olish)
   → Cart → Checkout → Order → My Courses
   → Course Landing → Course Player → Lesson Player
        (video / matn / kod / resurslar / quiz / assignment)
   → Progress (streak, achievements, certificates)
```

### Instructor oqimi
```
Create Course → Modules → Lessons → Resources → Quiz → Assignment → Publish
   → kurs Marketplace'da paydo bo'ladi → student sotib oladi → Learning boshlanadi
```

### AI (rejalashtirilgan, hali backendga ulanmagan)
- **Student AI:** savollarga javob beradi, darsni tushuntiradi, quizga tayyorlaydi, o'quv reja va resurs tavsiya qiladi.
- **Instructor AI:** kurs strukturasi va lesson outline yozadi, quiz/assignment generatsiya qiladi, SEO va kurs tavsifini yozib beradi.

Har ikkala rol uchun "AI Yordamchi" sahifasi frontendda allaqachon mavjud (`pages/student/ai-assistant.html`, `pages/instructor/ai-assistant.html`) — hozircha vizual/mock holatda, real AI ulanishi keyingi bosqichda.

## Texnologik stek

- Sof **Vanilla HTML / CSS / JavaScript** — framework yoki bundler yo'q (React, Vue va h.k. ishlatilmaydi), npm/Node.js talab qilinmaydi.
- Loyiha `file://` protokoli orqali to'g'ridan-to'g'ri brauzerda ochiladi — server shart emas. Shu sababli `fetch()` ishlatilmaydi (CORS xatosi beradi); vaqtinchalik holat va ma'lumotlar `localStorage` orqali saqlanadi.

## Ishga tushirish

```
index.html faylini brauzerda oching (yoki to'g'ridan-to'g'ri pages/auth/login.html)
```

Hech qanday `npm install` yoki server kerak emas.

## Papka tuzilishi

```
index.html              — pages/auth/login.html'ga yo'naltiradi
css/                     — qatlamli arxitektura:
  tokens → base → layout → components → widgets → utilities → animations → responsive
js/                      — 50+ modul, har biri bitta mas'uliyat (navigation, sidebar,
                           marketplace, cart, checkout, wishlist, bookmarks, filterable, ...)
pages/
  auth/                  — login, register (rol tanlash: student/instructor)
  student/               — dashboard, marketplace, cart, checkout, kurslar, sertifikatlar, ...
  instructor/            — dashboard, kurs builder, talabalar, daromad, sharhlar, ...
  admin/                 — dashboard, foydalanuvchilar, kurslar, marketplace boshqaruvi, sozlamalar
  shared/                — components, notifications, coming-soon
docs/                    — sprintlar bo'yicha arxitektura va progress hujjatlari
```

## Loyiha holati

- ✅ Student, Instructor, Admin panellari frontendda tayyor (sidebar navigatsiyasi `js/navigation.js`da markazlashtirilgan).
- ✅ Marketplace → Cart → Checkout → My Courses (Bookmarks) zanjiri `localStorage` orqali to'liq bog'langan.
- ✅ Mock Auth va rol asosidagi dashboard ajratish.
- ⏳ Backend/API integratsiyasi — keyingi bosqich.
- ⏳ Real AI Assistant (student va instructor uchun) — keyingi bosqich.

To'liq kodlash qoidalari va sprint bo'yicha rejalar uchun [CLAUDE.md](CLAUDE.md) va [docs/](docs/) papkasiga qarang.
