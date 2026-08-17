# Mobil moslashuv — nima o'zgardi va nega

Isloh frontendi 71 ta sahifada telefon ekranida (375px) tekshirildi va
vizual muammolar bartaraf qilindi. Bu hujjat sabablarni va keyingi
sahifalar uchun amal qilinadigan qoidalarni yozib qo'yadi.

Barcha qoidalar `css/` qatlamida: tartib — `css/widgets.css`, tor ekran
o'zgarishlari — `css/responsive.css`. Sahifalarning o'z `<style>` bloklari
qolmadi (`pages/shared/components.html` — komponentlar galereyasi bundan
mustasno, u ataylab sahifa-lokal).

---

## 1. Eng ko'p uchragan sabab: grid "blowout"

CSS'da `1fr` aslida `minmax(auto, 1fr)` degani — trek o'z ichidagi eng keng
**min-content** dan kichrayolmaydi. Ichida o'ralmaydigan qator (uchta tugma,
uzun sarlavha, kupon kodi) bo'lsa, bitta ustunga tushgan grid ham 375px
o'rniga 430–455px bo'lib qolar va **butun sahifani** gorizontal skrollga
majbur qilardi.

Shuning uchun loyihadagi barcha `grid-template-columns` fr-treklari
`minmax(0, …)` ga o'tkazildi:

```css
/* noto'g'ri */   grid-template-columns: repeat(4, 1fr);
/* to'g'ri  */   grid-template-columns: repeat(4, minmax(0,1fr));
```

**Qoida:** yangi grid yozganda fr-trekni doim `minmax(0,1fr)` deb yozing.

## 2. `.topbar-search` — telefonda qidiruv umuman yo'qolib qolardi

`css/responsive.css` da `@media (max-width:700px) { .topbar-search { display:none } }`
qoidasi bor edi. Lekin bu klass 20 dan ortiq sahifada **sahifa ichidagi
filtr qidiruvi** uchun ham qayta ishlatiladi (bookmarks, discussions,
admin-users, instructor/students va h.k.) — natijada telefonda ularning
hech biri ko'rinmasdi.

Endi:

```css
.topbar .topbar-search { display: none; }   /* faqat sarlavha satridagisi */
.content .topbar-search { width: 100%; }    /* sahifa ichidagisi qoladi */
```

**Qoida:** umumiy klassni yashirayotganda o'ramni (`.topbar`, `.content`)
albatta ko'rsating.

## 3. Auth sahifalari

`.auth-split` faqat `display:flex` edi — telefonda ham ikki ustun bo'lib
qolar, chapdagi indigo panel formani siqib, shior kesilib qolardi
("Aql…"). ≤820px da panel formadan yuqoridagi ixcham sarlavha blokiga
aylanadi (`css/responsive.css` → "AUTH SAHIFALARI").

Shu bilan birga auth sahifalaridagi inline stillar klasslarga ko'chirildi:
`.auth-panel-teach`, `.auth-step-label`, `.auth-legal`, `.auth-panel-title`,
`.auth-panel-text`.

## 4. Amal qatorlari o'ralmasdi

`flex-shrink:0` yoki `margin-left:auto` bilan yozilgan tugma qatorlari tor
ekranda na kichrayar, na o'ralar edi. ≤700px da o'ralaydigan qilindi:
`.approval-card .ac-actions`, `.fs-topbar-actions`, `.preview-bar-actions`,
`.dt-stats`, `.coupon-row`, `.discussion-toolbar`.

**Qoida:** yonma-yon turgan tugmalar qatoriga `flex-wrap: wrap` bering.

## 5. Mobil ergonomika

| Muammo | Yechim |
|---|---|
| iOS Safari 16px dan kichik maydonga bosilganda sahifani kattalashtiradi va qaytarmaydi | ≤700px da barcha `input/select/textarea` → `font-size:16px` |
| `100vh` mobil brauzerda manzil satrini ham qo'shib hisoblaydi — sahifa etagi kesiladi | `height:100vh; height:100dvh;` juftligi (`.app-shell`, `.sidebar`, `.auth-split`, `.page-wrap`) |
| Chat/AI ekrani `calc(100vh - 68px)` — mobilda yuqorida 68px topbar emas, 58px `.mobile-nav-bar` turadi | ≤700px da `calc(100dvh - 58px)` |
| `.dt-stat-btn` (padding 2px), `.category-chip` — WCAG 2.5.8 dagi 24px dan kichik teginish maydoni | ≤700px da padding kattalashtirildi (ko'rinish o'zgarmaydi) |
| `.itable` `min-width:660px` — skroll borligi bilinmasdi | `.itable-wrap` sahifa chetigacha cho'ziladi + `-webkit-overflow-scrolling:touch` |
| `.heatmap` 26 x 12px = 387px, sig'masdi | ≤700px da katakchalar suyuq (`minmax(0,1fr)` + `aspect-ratio:1`) |
| Tarmoq xatosi banneri uch qatorga bo'linardi | ≤700px da chetdan chetgacha "snackbar" |

Zaxira to'siq sifatida ≤900px da `body { overflow-x: hidden }` qo'yilgan —
keyin qo'shiladigan markup e'tibordan chetda qolsa ham telefonda sahifa
yon tomonga surilmaydi. Ichki skroll kerak joylar (`.itable-wrap`,
`.mkt-strip`, `.tab-strip`) o'z `overflow-x:auto` iga ega, ular buzilmaydi.

---

## 6. Qanday tekshirilgan (va qayta tekshirish mumkin)

71 sahifa 375px kenglikdagi `<iframe>` ga navbat bilan yuklanib, har bir
elementning `getBoundingClientRect().right` i ko'rish maydoni bilan
solishtirildi. Skroll konteyneri (`overflow-x: auto/scroll/hidden`) ichidagi
elementlar hisobga olinmadi — ular hujjatni kengaytirmaydi.

Ikki muhim nuqta:

1. **Tekshiruv `document.scrollWidth` ga tayanmasligi kerak** — yuqoridagi
   `body { overflow-x:hidden }` uni yashiradi. Elementlarni birma-bir
   o'lchash shart.
2. **Kesh.** Statik server ustidagi preview qatlami javoblarni URL bo'yicha
   keshlaydi va `Cache-Control` ni inobatga olmaydi. Sahifani `?v=<vaqt>`
   qo'shib yuklash kerak, CSS uchun esa `css/style.css` dagi `@import`
   larga ham versiya qo'shilishi kerak — aks holda **eski CSS bilan
   o'lchab, "hammasi joyida" degan yolg'on natija olinadi**.

## 7. Breakpoint konvensiyasi

| Kenglik | Nima o'zgaradi |
|---|---|
| 1100px | ko'p ustunli gridlar 2 ustunga tushadi |
| 1000px | `.detail-grid` bir ustunga |
| 900px | sidebar off-canvas drawer'ga aylanadi; ikki ustunli tartiblar bir ustunga |
| 820px | auth sahifalari ustunga tushadi |
| 700px | gridlar bir ustunga; teginish maydonlari, shrift o'lchami, amal qatorlari |
| 640px / 380px | rol tanlash to'ri; juda tor ekranda ijtimoiy tugmalar |

Yangi breakpoint o'ylab topmang — shu ro'yxatdagisidan foydalaning.
