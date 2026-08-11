# AI qatlami — arxitektura va shartnomalar

Isloh'dagi AI qatlami **frontend jihatdan tugallangan**, lekin real AI'ga
ulanmagan: javoblar `js/ai-assistant.js` registridagi tayyor matnlar
(`setTimeout` bilan "yozilmoqda" taassuroti beriladi). Bu hujjat qatlamning
tuzilishini va backend ulanganda nima o'zgarishini yozib qo'yadi.

---

## 1. Fayllar va mas'uliyat

| Fayl | Nima qiladi |
|---|---|
| `js/ai-assistant.js` | **Registr** — `ISLOH_AI_CONTEXTS`. Qaysi sahifada qanday shablonlar borligi, kartochka renderlari, erkin matnni shablonga yo'naltirish (`isloh_aiMatchTemplate`), tarjima yordamchisi (`isloh_aiT`). |
| `js/ai-panel.js` | **Drawer renderi** — `#ai-drawer-mount` ichiga suriladigan panel markupini yasaydi. Registr talab qiladi, shuning uchun `ai-assistant.js` dan KEYIN ulanadi. |
| `js/ai-store.js` | **Do'kon** — suhbatlar `localStorage`da. Yagona joy: boshqa hech qaysi modul AI kalitlariga tegmaydi. |
| `js/ai-chat.js` | **Xatti-harakat** — xabar yuborish, tiklash, tarix, off-canvas, tasdiqlash dialogi. Ikkala qobiqda ham ishlaydi. |

Ulash tartibi har doim: `ai-assistant.js` → (`ai-panel.js`) → `ai-store.js` → `ai-chat.js`.

## 2. Ikki qobiq

AI ikki xil ko'rinishda chiqadi va **ikkalasi ham bir xil JS bilan ishlaydi**:

1. **Drawer** — 7 sahifada (`course-player`, `lesson-player`, `learning-progress`,
   `course-builder`, `lesson-editor`, `quiz-builder`, `assignment-builder`).
   Markupni `ai-panel.js` yasaydi. Skroller `.ai-drawer-body`.
2. **To'liq sahifa** — `pages/student/ai-assistant.html`, `pages/instructor/ai-assistant.html`.
   Markup sahifada, lekin kartochkalar registrdan chiziladi. Skroller `.ai-body`.

## 3. Markup shartnomasi

```
[data-ai-context="<key>"]        drawer qaysi kontekstda chizilishi (ai-panel.js)
[data-ai-context-key="<key>"]    panel elementining o'zida — barcha JS shundan o'qiydi
[data-ai-drawer-trigger]         drawer'ni ochadi
[data-ai-quick="<ctx>:<tpl>"]    sahifa ichidagi chip: drawer'ni ochib shablonni ishga tushiradi
[data-ai-run="<templateKey>"]    shablonni ishga tushiradi (kartochka)
[data-ai-input] / [data-ai-send] erkin matn maydoni
[data-ai-messages]               yozishmalar; role="log" aria-live="polite"
[data-ai-empty]                  bo'sh holat bloki
[data-ai-empty-extra]            bo'sh holatda ko'rinadigan qo'shimcha blok (shablonlar)
[data-ai-suggestions]            3 ta taklif kartochkasi (registrdan)
[data-ai-template-grid]          barcha shablonlar ro'yxati (registrdan)
[data-ai-templates-toggle/panel] shablonlar ro'yxatini ochish/yopish
[data-ai-template-count]         shablonlar soni
[data-ai-history-list]           suhbatlar ro'yxati (do'kondan)
[data-ai-history-empty]          bo'sh tarix holati
[data-ai-new-thread]             yangi suhbat (eskisini O'CHIRMAYDI)
[data-ai-clear]                  joriy suhbatni tozalash (do'kondan ham o'chiradi)
[data-ai-history-toggle/backdrop] tor ekranda suhbatlar ustuni
[data-ai-greeting]               salomlashuv qatori (profil do'konidan)
[data-ai-context-label]          jonli kontekst yorlig'i
[data-ai-insert-target]          "Muharrirga qo'shish" qayerga yozishi
```

Sahifalararo kirish: `ai-assistant.html?run=<templateKey>` — sahifa ochilib,
yangi suhbatda o'sha shablon darhol ishga tushadi (instructor dashboard'dagi
"AI tahlili" kartochkalari shundan foydalanadi).

## 4. Suhbat modeli (`js/ai-store.js`)

Ikki xil thread bor:

- **Darsga bog'langan** — id deterministik: `contextKey::courseId::lessonId`.
  Bitta dars = bitta suhbat. Sarlavha — dars nomi. Kurs pleeri shundan
  foydalanadi, shuning uchun darsni qayta ochganda o'sha suhbat qaytadi.
- **Erkin** — id `contextKey::::<noyob>`. To'liq sahifali AI Yordamchida
  bittadan ortiq suhbat bo'lishi mumkin. Qaysi biri ochiqligi alohida
  kalitda: `isloh_ai_active_threads` = `{ [contextKey]: threadId }`.
  Sarlavha birinchi savoldan olinadi (42 belgigacha).

`localStorage` kalitlari:

```
isloh_ai_chats            { [threadId]: { id, contextKey, courseId, lessonId,
                                          title, messages[], updatedAt } }
isloh_ai_active_threads   { [contextKey]: threadId }
```

Chegara: bitta thread'da 60 ta xabar (`ISLOH_AI_MAX_MESSAGES`). Kvota
to'lganda `isloh_aiWriteChats` `false` qaytaradi va foydalanuvchi bir marta
ogohlantiriladi — jimgina yo'qotish yo'q.

**Eski ma'lumot:** `contextKey::::` ko'rinishidagi (bitta suhbatli davrdan
qolgan) thread birinchi ochilishda avtomat faol suhbat sifatida qabul
qilinadi. Migratsiya skripti kerak emas.

## 5. Til (i18n)

- Markupdagi matn — `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria-label`.
- JS bilan yasaladigan matn — `isloh_aiT(key, uzbekcha, vars)`.
- Shablon sarlavha/tavsiflari — `ai.tpl.<templateKey>.title` / `.sub`.
  Shablon kalitlari butun registr bo'ylab noyob, shuning uchun kontekst
  prefiksi yo'q.
- Til almashganda registrdan chizilgan hamma narsa qayta chiziladi
  (`isloh:i18n-applied` hodisasi → `isloh_aiOnLanguageApplied`).

**Tarjima qamrovi:** to'liq sahifali AI Yordamchining 16 ta shabloni va
butun interfeys en/ru'ga tarjima qilingan. Drawer kontekstlarining 22 ta
shabloni mexanizmga ulangan, lekin tarjimasi hali yozilmagan — ular
o'zbekcha qolaveradi. Shablon **javoblari** (`response`) ataylab tarjima
qilinmagan: ular demo ma'lumot va real AI ulanganda butunlay almashadi.

## 6. Backend ulanganda nima o'zgaradi

O'zgaradigan joy **ikkita funksiya**:

- `isloh_aiRunTemplate()` — `setTimeout` + `template.response` o'rniga
  API chaqiruvi;
- `isloh_aiSendFreeText()` — `isloh_aiMatchTemplate` o'rniga real so'rov.

O'zgarmaydi: do'kon shakli (thread + messages API javobiga mos),
markup shartnomasi, tarix, kontekst mantiqi, i18n.

Shu bilan birga hal qilinishi kerak bo'lgan narsalar:

- **Oqim (streaming)** — hozir javob bir bo'lak bo'lib qo'shiladi
  (`isloh_aiAppendAiMessage`). Token-token yozish uchun shu funksiya
  bo'linadi.
- **Xatolik holati** — tarmoq xatosi uchun alohida ko'rinish kerak
  (hozir faqat kvota xatosi bor).
- **Fayl biriktirish** — tugma `data-backend-pending` bilan o'chirilgan.
- **Javoblarni tarjima qilish** — real AI javobni foydalanuvchi tilida
  qaytarishi kerak, ya'ni til so'rov bilan birga yuboriladi.
