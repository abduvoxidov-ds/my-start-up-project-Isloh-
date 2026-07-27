# CLAUDE.md — Isloh loyihasi bo'yicha ko'rsatmalar

Bu fayl Claude Code uchun Isloh loyihasida ishlashda amal qilinadigan qoidalar va ko'rsatmalarni belgilaydi.

## 1. Loyiha haqida va strategiya

- **Loyiha nomi:** Isloh — SaaS ta'lim platformasi (LMS).
- **Strategiya:** Dastlab frontend qismini (67 ta HTML sahifa, CSS va JS) to'liq interaktiv, toza va tayyor holatga keltirish, so'ngra backend integratsiyasiga o'tish.
- **Texnologik stek:** Sof Vanilla HTML/CSS/JavaScript. Framework va bundler ishlatilmaydi (React, Vue va h.k. yo'q), npm/Node.js talab qilinmaydi.

## 2. Kodlash standartlari va qoidalari

- **DRY va Clean Code:** Kod takrorlanishidan qat'iy qochish, har bir mantiq yagona joyda ta'riflanishi kerak.
- **HTML:**
  - Sahifa ichida inline `<style>` bloklaridan qochish — barcha stillar `css/` papkasidagi tegishli fayllarga chiqarilsin.
  - Inline `onclick` va shunga o'xshash inline event-attributlardan qochish — hodisalar `js/` fayllarida `addEventListener` orqali bog'lansin.
- **CSS:**
  - `css/tokens.css`dagi design token'lardan (ranglar, spacing, soyalar, radius va h.k.) unumli foydalanish, qattiq kodlangan (hardcoded) qiymatlar yozmaslik.
  - Mavjud qatlamli CSS arxitekturasini (`tokens → base → layout → components → widgets → utilities → animations → responsive`) buzmaslik — yangi stillar tegishli qatlamga qo'shilsin.
- **JS:**
  - Kod modular va DRY uslubida yozilsin.
  - Qayta ishlatiladigan mantiqlar (masalan validatsiya, formatlash, umumiy DOM funksiyalari) `js/` ichida markazlashtirilgan umumiy fayllarda saqlansin, har bir sahifada qayta yozilmasin.
- **Izohlar:** Koddagi asosiy funksiya va mantiqiy bloklarga o'zbek tilida qisqa va tushunarli izohlar yoziladi.

## 3. Cheklovlar va xususiyatlar

- Loyiha `file://` protokoli orqali ham brauzerda to'g'ridan-to'g'ri ochilishi kerak — server shart emas. Shu sababli runtime'da `fetch()` ishlatilmaydi (`file://` ostida CORS xatosi beradi); mahalliy JSON/partial fayllarni yuklash kerak bo'lsa, muqobil yondashuv (masalan JS obyekt sifatida inline ma'lumot) qo'llanilsin.
- Vaqtinchalik holat (state) va ma'lumotlarni saqlash uchun `localStorage`dan foydalaniladi.

## 4. Frontend rejasi (hozirgi ustuvor vazifalar)

1. **1-bosqich:** Inline CSS va takroriy JS kodlarini refactoring qilish.
2. **2-bosqich:** `localStorage` orqali Mock Auth (student, instructor, admin) va interaktiv ma'lumotlarni bog'lash.
3. **3-bosqich:** Navigatsiya va UI/UX mantiqlarini to'liq yakunlash (taxt qilish).
