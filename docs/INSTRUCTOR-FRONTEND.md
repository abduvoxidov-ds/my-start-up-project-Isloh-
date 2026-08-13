# Instruktor frontendi — do'konlar, shartnomalar va chegaralar

Isloh'ning o'qituvchi bo'limi (33 ta sahifa, `pages/instructor/`) **frontend
jihatdan tugallangan**: har bir ro'yxat, raqam va amal `localStorage`dagi
do'konlardan chiziladi, sahifa yangilangandan keyin ham joyida qoladi. Backend
yo'q — lekin qayerda ma'lumot, qayerda namuna ekani ochiq belgilangan.

Bu hujjat 1–9 bosqichlar yakuni: qaysi kalit nimani saqlaydi, kim egasi,
sahifalar nimaga tayanadi va backend ulanganda nima o'zgaradi.

---

## 1. Do'konlar (localStorage kalitlari)

Har bir kalitning **bitta egasi** bor: faqat o'sha modul unga yozadi, qolganlar
uning funksiyalari orqali ishlaydi (CLAUDE.md §2 — DRY).

### O'qituvchi bo'limi tayanadigan do'konlar

| Kalit | Nima saqlaydi | Egasi |
|---|---|---|
| `isloh_courses` | Kurs yozuvlari: nom, narx, holat (`draft`/`published`/`archived`), dars soni, talaba soni, reyting, daromad, yakunlash % | `js/course-store.js` |
| `isloh_course_content` | Kurs → modullar → darslar daraxti (nom, tur, davomiylik, holat) | `js/content-store.js` |
| `isloh_assignments` | O'qituvchi **yaratgan** topshiriqlar (muddat, ball, rubrika) | `js/assignment-store.js` |
| `isloh_submissions` | Talaba **topshirgan** ishlar (kim, qachon, ball, izoh) | `js/assignment-store.js` |
| `isloh_quizzes` | Testlar: sozlamalar + tartiblangan `questionIds` ro'yxati | `js/quiz-store.js` |
| `isloh_questions` | Savollar banki — savol matni **bir marta** shu yerda yashaydi | `js/question-store.js` |
| `isloh_resources` | Kurs resurslari (fayl metama'lumoti, papka, kategoriya, arxiv holati) | `js/resource-store.js` |
| `isloh_enrollments` | Kim qaysi kursga qachon yozilgan, jarayoni, oxirgi faolligi | `js/enrollment-store.js` |
| `isloh_reviews` | Sharhlarning o'zi (kim, qaysi kurs, necha yulduz, qachon) | `js/review-store.js` |
| `isloh_review_replies` | O'qituvchining javoblari: `{ "<sharh-id>": "matn" }` | `js/review-store.js` |
| `isloh_notifications` | Bildirishnomalar + o'qildi/o'qilmadi holati (rol bo'yicha ajratilgan) | `js/notification-store.js` |
| `isloh_course_settings` | Kurs sozlamalari (sertifikat qoidalari va h.k.) | `js/certificate-engine.js` |
| `isloh_drafts` | Muharrirlarning saqlanmagan qoralamalari (sahifa + yozuv kaliti bo'yicha) | `js/draft-store.js` |
| `isloh_announcements`, `isloh_live_sessions` | E'lonlar va jonli sessiya yozuvlari | `js/instructor-compose.js` |

### Rollar aro umumiy do'konlar

| Kalit | Nima saqlaydi | Egasi |
|---|---|---|
| `isloh_profiles` (+ eski `isloh_user`) | Uchala rolning profili | `js/profile.js` |
| `isloh_settings`, `isloh_role_settings` | Umumiy va rolga xos sozlamalar | `js/settings-store.js` |
| `isloh_chat_*` (4 ta kalit) | Yagona suhbat grafi: foydalanuvchilar, threadlar, xabarlar, meta | `js/chat-store.js` |
| `isloh_ai_chats`, `isloh_ai_active_threads` | AI suhbatlari — [AI-LAYER.md](AI-LAYER.md) | `js/ai-store.js` |
| `isloh_cart_items`, `isloh_orders`, `isloh_purchased_courses` | Talaba tomonidagi savat/buyurtma zanjiri | `js/marketplace.js` |

**Demo ma'lumot:** har bir do'kon birinchi o'qishda o'zini "ekadi" (seed), ya'ni
sahifalar hech qachon bo'sh ko'rinmaydi. Kalitni `localStorage`dan o'chirish —
demo holatga qaytarishning to'g'ri usuli.

---

## 2. Sahifa → do'kon xaritasi

| Sahifa(lar) | Manba |
|---|---|
| `courses`, `course-create`, `course-edit`, `course-details` | `isloh_courses` |
| `course-builder`, `lesson-builder`, `lesson-editor` | `isloh_course_content` (+ `isloh_courses` dagi dars sanog'i) |
| `quiz-builder`, `quiz-editor`, `question-bank` | `isloh_quizzes` + `isloh_questions` |
| `assignment-builder`, `assignment-editor` | `isloh_assignments` |
| `assignments` (baholash navbati) | `isloh_submissions` + `isloh_assignments` |
| `resource-manager`, `resource-library` | `isloh_resources` |
| `students` | `isloh_enrollments` |
| `reviews`, `course-details` (sharhlar bloki) | `isloh_reviews` + `isloh_review_replies` |
| `notifications` + barcha sahifalardagi qo'ng'iroq nuqtasi | `isloh_notifications` |
| `dashboard`, `analytics`, `revenue` | Yuqoridagilarning hammasidan **hisoblanadi** |
| `messages`, `ai-assistant` | `isloh_chat_*`, `isloh_ai_*` |
| `course-publish` | `isloh_courses` (+ tekshiruv uchun tarkib/test/topshiriq/resurs do'konlari) |

---

## 3. Umumiy shartnomalar

### Statistika: `[data-stat]`

Raqamlar **markupga yozilmaydi** — `js/profile-stats.js` dagi resolverlardan
chiqadi:

```html
<div class="stat-value" data-stat="publishedCourses">—</div>
```

Yangi ko'rsatkich kerak bo'lsa — `ISLOH_PROFILE_STATS` jadvaliga resolver
qo'shiladi, sahifa ichida hech qachon hisoblagich yozilmaydi.

### Davrga bog'liq statistika: `[data-period-stat]`

`js/period-stats.js` faqat **sanali** do'konlar ustida ishlaydi
(`enrolledAt` / `submittedAt` / `createdAt`). Trend nishoni oldingi shuncha
kunlik oyna bilan solishtiriladi; oldingi oyna bo'sh bo'lsa nishon
chizilmaydi (noldan o'sishni foizda ko'rsatib bo'lmaydi).

### Do'kon o'zgarganda: `isloh:*-updated`

Har bir do'kon yozgandan keyin hodisa yuboradi —
`courses-updated`, `content-updated`, `assignments-updated`,
`submissions-updated`, `quizzes-updated`, `questions-updated`,
`resources-updated`, `enrollments-updated`, `reviews-updated`,
`notifications-updated`. Sahifalar shu hodisalarga obuna bo'lib qayta
chiziladi, ya'ni ikkinchi tabda qilingan o'zgarish ham ko'rinadi.

### Halollik belgilari

| Belgi | Ma'nosi |
|---|---|
| `.placeholder-note` | Ko'rsatilayotgan narsa **namuna** yoki umuman hisoblab bo'lmaydi — sababi izohda yozilgan |
| `data-backend-pending="<amal>"` | Tugma ataylab o'chiq: `js/backend-pending.js` uni bloklaydi va sababini tooltipda ko'rsatadi |

Inline `style="..."` faqat **ma'lumot** qiymatlari uchun qoladi (progress
kengligi, grafik ustuni balandligi, resurs turi rangi, kurs muqovasi
gradienti) — sabab `css/utilities.css` oxirida yozilgan.

---

## 4. Ko'rsatkich ta'riflari (bir yorliq — bitta ma'no)

9-bosqich auditi bir xil yorliq ostida turli raqamlarni topdi va ular
tuzatildi. Joriy ta'riflar:

| Yorliq | Ma'nosi | Manba |
|---|---|---|
| **Jami talabalar** | Kurs yozuvlaridagi sotuvdan yig'ilgan umumiy son (nashr etilgan kurslar bo'yicha) | `isloh_courses[].students` |
| **Ro'yxatdagi talabalar** | Ro'yxatga olish **yozuvlari** soni (noyob talaba) | `isloh_enrollments` |
| **O'rtacha reyting** | Kurs yozuvlaridagi reytinglarning o'rtachasi | `isloh_courses[].rating` |
| **Sharhlardan o'rtacha** | Sharhlar do'konidagi yulduzlarning o'rtachasi | `isloh_reviews[].rating` |
| **Baholash navbati** | Baholanmagan topshirilgan ishlar (kechikkanlar ham) | `isloh_submissions` |
| **Jami daromad** | Barcha kurslar (arxiv ham) `revenue` yig'indisi | `isloh_courses[].revenue` |

Ikki son ataylab farq qiladi: kurs yozuvidagi umumiy sotuv soni demo
ro'yxatga olish yozuvlaridan ko'p. Bu farq `students.html` da ochiq
izohlanadi, yashirilmaydi.

---

## 5. Ma'lum chegaralar (backend kutayotgan joylar)

| Nima yo'q | Qayerda belgilangan | Nima kerak |
|---|---|---|
| **Vaqt qatori ma'lumotlari** — kunlik daromad, haftalik ro'yxatga olish, o'sish egri chizig'i | `dashboard`, `analytics`, `revenue`, `course-details` — grafiklar `.placeholder-note` + "Namuna ma'lumot" bilan | Voqealarni sana bilan yozadigan backend |
| **To'lov tizimi** — tranzaksiyalar jurnali, kutilayotgan to'lov, o'rtacha buyurtma, yechib olish balansi, to'lov usullari | `revenue` — `.placeholder-note` + `data-backend-pending` | To'lov provayderi integratsiyasi |
| **Real fayl yuklash** — hozir faqat metama'lumot (nom, tur, hajm) saqlanadi | `resource-manager` — `.placeholder-note` | Fayl saqlash xizmati |
| **Rejalashtirilgan jonli sessiyalar** do'koni | `dashboard` — `.placeholder-note` | Sessiya yozuvlari + kalendar |
| **Real AI javoblari** | `ai-assistant` — [AI-LAYER.md](AI-LAYER.md) §6 | Model API'si |
| **Mock Auth** — login/register hali do'konga bog'lanmagan | `pages/auth/` | Sessiya va rol boshqaruvi |
| **Tarjima qamrovi** — instruktor sahifalarining matnlari `data-i18n` bilan belgilangan, lekin lug'atda `en`/`ru` yozuvlari yo'q | `js/i18n.js` | Tarjimalarni to'ldirish (mexanizm tayyor) |

Talaba tomonidagi ba'zi JS modullari (`cart`, `checkout`, `certificate-engine`,
`comments`) hali inline `style` bilan markup yasaydi — 8-bosqich CSS tozalashi
faqat instruktor sahifalarini qamradi.

---

## 6. Backend ulanganda nima o'zgaradi

**O'zgaradi:** har bir do'kon faylidagi ikki funksiya — o'qish
(`isloh_get*`) va yozish (`isloh_commit*`). `localStorage` o'rniga API
chaqiruvi qo'yiladi.

**O'zgarmaydi:**

- do'kon sxemasi (yozuvlar allaqachon API javobiga o'xshash shaklda),
- markup shartnomalari (`[data-stat]`, `[data-period-stat]`, `[data-*-list]`),
- hisoblangan qiymatlar mantiqi (holat, o'rtachalar, navbat) — ular do'kon
  ichidagi sof funksiyalar,
- sahifa modullari (ular do'konni chaqiradi, kalitni bilmaydi).

Alohida e'tibor talab qiladigan uchta joy:

1. **Hisoblangan holat** (`isloh_submissionState`, `isloh_enrollmentState`)
   frontendda qoladimi yoki backend beradimi — ikki tomonda takrorlanmasin.
2. **Ro'yxatga olish va sotuv sonlari** bitta manbadan kelishi kerak; hozir
   ular ataylab ikki xil ta'rifga ega (4-bo'lim).
3. **Bildirishnomalar** — hozir do'konga faqat demo yozuvlar tushadi;
   voqealarni backend yuboradi (`isloh_addNotification` shu uchun tayyor).

---

## 7. Tekshiruv (9-bosqich)

- **70 ta sahifa** (instruktor + talaba + admin + auth + shared) iframe'da
  yuklandi: **0 ta JS xatosi**, **144 ta havola tekshirildi — 0 ta singan**.
- **Uchdan-uchgacha oqim** brauzerda o'tkazildi: kurs yaratish → modul →
  dars → test + bankdan savol → topshiriq → ishni baholash → resurs →
  nashr etish → talaba Marketplace'ida ko'rinishi. Har bosqichda F5 bilan
  saqlanish tasdiqlandi.
- **Sahifalararo raqamlar** yorliq bo'yicha solishtirildi; topilgan uchta
  ziddiyat 4-bo'limdagi ta'riflar bilan tuzatildi.
