/* ==========================================================================
   ISLOH — Marketplace module
   Renders pages/student/marketplace.html's course grid + category chips
   from a single mock object shaped like the future REST response (GET
   /api/marketplace). Also owns the shared cart/coupon/order-history
   helpers used by js/cart.js, js/checkout.js (finalizes a purchase on
   submit) and js/my-courses.js (reads purchased + saved courses) — so this
   file is loaded on marketplace.html, cart.html, checkout.html,
   wishlist.html and courses.html; every render function below guards on its target
   element so loading it purely for the helpers, on a page without that
   element, is a safe no-op.

   API contract:
     {
       featured_courses: [{ id, title, instructor, price, discount_price,
                             category, rating, views, duration, level,
                             cover, icon, summary, lessons, students }],
       categories: [ "Barchasi", "Backend", ... ],
       user_cart: { items_count, items }
     }

   Storage:
     isloh_cart_items       — array of { id, title, cover, icon, price,
                              instructor, duration, level } added via
                              "Savatga qo'shish", cleared on checkout submit.
     isloh_purchased_courses — array of { id, title, cover, icon }, read by
                              js/my-courses.js under "Boshlangan kurslar".
     isloh_orders           — buyurtmalar tarixi: { id, date, status, items }.
                              Checkout tasdiqlanganda yangi yozuv qo'shiladi;
                              orders.html va marketplace "Xaridlar tarixi"
                              ikkalasi ham SHU do'kondan o'qiydi.
   ========================================================================== */

/* `views` — kurs sahifasi necha marta ochilgani (mock analitika). "Ko'p
   ko'rilgan" ro'yxati aynan shu maydon bo'yicha saralanadi; backend ulangach
   bu qiymat API'dan keladi.
   `summary` / `lessons` / `students` — kurs sahifasi (course-landing.html)
   sarlavhasi shu maydonlardan to'ldiriladi, ya'ni har bir kurs o'z ma'lumoti
   bilan ochiladi. */
const ISLOH_MARKETPLACE_DATA = {
  featured_courses: [
    { id: 'py-101', title: 'Python Backend Development', instructor: 'Akmal Yuldashev', price: 420000, discount_price: 249000, category: 'Backend', rating: 4.9, views: 18420, lessons: 96, students: 2140, duration: '42 soat', level: 'Barcha darajalar', summary: "Python va Django yordamida real backend loyihalarni noldan quring: REST API, ma'lumotlar bazasi, autentifikatsiya va deploy.", cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py' },
    { id: 'react-201', title: 'React — The Complete Guide', instructor: 'Malika Tosheva', price: 299000, discount_price: null, category: 'Frontend', rating: 4.8, views: 15230, lessons: 84, students: 1760, duration: '38 soat', level: "O'rta daraja", summary: "Zamonaviy React: hooks, komponentlar arxitekturasi, holat boshqaruvi va ishlab chiqarishga tayyor ilova.", cover: 'linear-gradient(135deg,#0EA5E9,#1E3A8A)', icon: 'bi bi-atom' },
    { id: 'uiux-301', title: 'UI/UX Design Fundamentals', instructor: 'Dilnoza R.', price: 250000, discount_price: 189000, category: 'Dizayn', rating: 4.7, views: 9840, lessons: 52, students: 1240, duration: '26 soat', level: "Boshlang'ich", summary: "Foydalanuvchi tadqiqotidan tayyor prototipgacha: Figma, dizayn tizimi va interfeys mantiqi asoslari.", cover: 'linear-gradient(135deg,#8E44EC,#3B82F6)', icon: 'bi bi-palette-fill' },
    { id: 'ml-401', title: 'Machine Learning A-Z', instructor: 'Aziz Karimov', price: 349000, discount_price: null, category: 'Backend', rating: 4.6, views: 12760, lessons: 120, students: 980, duration: '56 soat', level: 'Yuqori daraja', summary: "Mashinali o'qitish algoritmlari amaliyotda: ma'lumotni tayyorlash, model qurish, baholash va joylashtirish.", cover: 'linear-gradient(135deg,#06B6D4,#0E7490)', icon: 'bi bi-cpu-fill' },
    { id: 'flutter-501', title: 'Flutter Mobile Development', instructor: 'Javlon Rahimov', price: 320000, discount_price: 219000, category: 'Mobile', rating: 4.7, views: 7310, lessons: 72, students: 860, duration: '34 soat', level: "O'rta daraja", summary: "Bitta koddan iOS va Android ilova: Flutter widgetlari, navigatsiya, API bilan ishlash va do'konga chiqarish.", cover: 'linear-gradient(135deg,#02569B,#13B9FD)', icon: 'bi bi-phone-fill' },
    { id: 'devops-601', title: 'Docker & Kubernetes DevOps', instructor: 'Sardor Aliyev', price: 380000, discount_price: null, category: 'DevOps', rating: 4.8, views: 11150, lessons: 88, students: 1120, duration: '46 soat', level: 'Yuqori daraja', summary: "Konteynerdan klastergacha: Docker, Kubernetes, CI/CD quvuri va ishlab chiqarishdagi monitoring.", cover: 'linear-gradient(135deg,#2496ED,#326CE5)', icon: 'bi bi-boxes' },
    /* Talaba yozilgan demo kurs — course-player.html, course-landing.html,
       notes/discussions/live-sessions sahifalari shu kursni ko'rsatadi.
       Ilgari katalogda yo'q edi, shuning uchun pleerdagi progress
       sertifikatlar sahifasiga umuman chiqmasdi (js/certificate-engine.js
       sarlavhasida ham shu kamchilik qayd etilgan edi). Qiymatlar
       course-landing.html dagi ma'lumotdan olindi. */
    { id: 'docker-for-beginners', title: 'Docker for Beginners', instructor: 'Akmal Yuldashev', price: 159000, discount_price: null, category: 'DevOps', rating: 4.7, views: 20480, lessons: 24, students: 890, duration: '18 soat', level: "Boshlang'ich", summary: "Konteynerlashtirish asoslarini noldan o'rganing — Docker, Dockerfile va Docker Compose yordamida zamonaviy ilovalarni joylashtiring.", cover: 'linear-gradient(135deg,#F97316,#EA580C)', icon: 'bi bi-boxes' }
  ],
  categories: ['Barchasi', 'Backend', 'Frontend', 'Mobile', 'Dizayn', 'DevOps'],
  user_cart: { items_count: 0, items: [] }
};

/* Buyurtmalar boshlang'ich (demo) ro'yxati. Bu massiv — faqat URUG': birinchi
   o'qishda `isloh_orders` do'koniga ekiladi, keyin haqiqiy buyurtmalar shu
   do'konga qo'shiladi. Ilgari bu ro'yxat orders.html ichida ham qo'lda
   takrorlangan edi va checkout'dan keyin yangi buyurtma umuman ko'rinmasdi.
   Sana ISO ko'rinishida saqlanadi (saralash mumkin bo'lsin), foydalanuvchiga
   isloh_formatOrderDate() orqali ko'rsatiladi. */
const ISLOH_ORDER_SEED = [
  { id: '10312', date: '2026-07-18', status: 'paid', items: [
      { id: 'py-101', title: 'Python Backend Development', cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py', price: 249000 },
      { id: 'react-201', title: 'React — The Complete Guide', cover: 'linear-gradient(135deg,#0EA5E9,#1E3A8A)', icon: 'bi bi-atom', price: 299000 }
    ] },
  { id: '10245', date: '2026-07-12', status: 'paid', items: [
      { id: 'py-101', title: 'Python Backend Development', cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py', price: 249000 }
    ] },
  { id: '10198', date: '2026-07-02', status: 'pending', items: [
      { id: 'ml-401', title: 'Machine Learning A-Z', cover: 'linear-gradient(135deg,#06B6D4,#0E7490)', icon: 'bi bi-cpu-fill', price: 349000 }
    ] },
  { id: '10102', date: '2026-06-20', status: 'refunded', items: [
      { id: 'uiux-301', title: 'UI/UX Design Fundamentals', cover: 'linear-gradient(135deg,#8E44EC,#3B82F6)', icon: 'bi bi-palette-fill', price: 189000 }
    ] }
];
/* Buyurtma holatlari. `refund_pending` — foydalanuvchi qaytarish so'rovini
   yuborgan, lekin hali ko'rib chiqilmagan holat: ilgari "Qaytarish" tugmasi
   hech qanday holatni o'zgartirmasdi va so'rovdan iz qolmasdi. */
const ISLOH_ORDER_STATUS_LABEL = {
  paid: "To'landi",
  pending: 'Kutilmoqda',
  refund_pending: "Qaytarish so'ralgan",
  refunded: 'Qaytarilgan'
};
const ISLOH_ORDER_STATUS_BADGE = {
  paid: 'badge-green',
  pending: 'badge-warning',
  refund_pending: 'badge-warning',
  refunded: 'badge-danger'
};

/* Oy nomlari uchun uchta alohida jadval bor edi (bu fayl, js/profile.js va
   js/certificate-engine.js) — ikkitasi bosh harfli, biri kichik harfli,
   ya'ni bir xil sana ikki joyda turlicha ko'rinardi. Hammasi js/datetime.js
   dagi bitta jadvalga birlashtirildi (o'zbek tilida oy nomi kichik harf
   bilan yoziladi) va u til sozlamasiga bo'ysunadi. */

// Savat/checkout/marketplace kuponi — bitta joyda, cart.js va checkout.js
// shu obyektdan foydalanadi (avval ikkalasida alohida-alohida yozilgan edi).
const ISLOH_COUPON = { code: 'ISLOH2026', percent: 15 };

const ISLOH_CART_KEY = 'isloh_cart_items';
const ISLOH_PURCHASED_KEY = 'isloh_purchased_courses';
const ISLOH_ORDERS_KEY = 'isloh_orders';

// Tavsiyalar / "Ko'p ko'rilgan" lentalarida nechta kurs ko'rsatiladi
const ISLOH_STRIP_LIMIT = 4;

function isloh_categorySlug(name) {
  return name === 'Barchasi' ? 'all' : name.toLowerCase();
}

/* --- Katalog: server manbasi (M2) -----------------------------------------
   Ilgari katalog demo ro'yxat + O'QITUVCHINING O'Z kurslari edi
   (js/course-store.js). Bu talaba uchun noto'g'ri: `course-store` endi
   `/instructor/courses` ga boradi, ya'ni talabada u bo'sh va boshqa
   o'qituvchilarning kurslari umuman ko'rinmasdi.

   Endi manba — `/catalog`: barcha nashr etilgan va ochiq kurslar.

   NEGA DO'KON FABRIKASI EMAS: `/catalog` SAHIFALANADI va `{data, meta}`
   qaytaradi (§0.1) — fabrika esa bevosita massiv kutadi. Shuning uchun
   shu yerda o'z keshi: sinxron o'qish + fonda yuklash + hodisa. */

const ISLOH_CATALOG_PER_PAGE = 60;

let _islohCatalog = null;      // serverdan kelgan ro'yxat
let _islohCatalogLoading = null;

/* Server kursini katalog sxemasiga o'giradi. Narx serverda USD sentda,
   katalog esa so'mda ko'rsatadi — koeffitsient js/course-store.js da va
   M9 (savdo) da haqiqiy kursga almashadi. */
function isloh_catalogFromServer(row) {
  const usd = (Number(row.price_cents) || 0) / 100;
  const rate = typeof ISLOH_USD_TO_UZS === 'number' ? ISLOH_USD_TO_UZS : 1;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    instructor: (row.instructor && row.instructor.full_name) || '',
    price: row.free ? 0 : Math.round(usd * rate),
    discount_price: null,
    category: row.category || '',
    rating: Number(row.rating) || 0,
    // Ko'rishlar hisoblagichi M11 (analitika) da paydo bo'ladi
    views: 0,
    lessons: row.lessons_count || 0,
    students: row.students_count || 0,
    duration: row.estimate || row.duration || '',
    level: row.level || '',
    summary: row.description || row.subtitle || '',
    cover: row.cover,
    icon: 'bi ' + (row.icon || 'bi-journal-bookmark-fill')
  };
}

function isloh_loadCatalog() {
  if (_islohCatalogLoading) return _islohCatalogLoading;

  _islohCatalogLoading = islohApi
    .get('/catalog', { per_page: ISLOH_CATALOG_PER_PAGE })
    .then((body) => {
      // Sahifalangan javob: massiv `data` ichida
      const rows = (body && body.data) || [];
      _islohCatalog = rows.map(isloh_catalogFromServer);
    })
    .catch((err) => {
      _islohCatalog = ISLOH_MARKETPLACE_DATA.featured_courses;
      if (err && err.code !== 'file_protocol' && typeof islohUI !== 'undefined') {
        islohUI.showNetworkError(() => {
          _islohCatalogLoading = null;
          return isloh_loadCatalog();
        }, err.error);
      }
    })
    .then(() => {
      document.dispatchEvent(new CustomEvent('isloh:catalog-updated', { detail: _islohCatalog }));
      return _islohCatalog;
    });

  return _islohCatalogLoading;
}

/* Katalogning yagona kirish nuqtasi. SINXRON — 8 ta joy shuni chaqiradi;
   kesh bo'sh bo'lsa demo ro'yxat qaytadi va yuklash fonda boshlanadi. */
function isloh_getCatalog() {
  if (_islohCatalog === null) {
    isloh_loadCatalog();
    return ISLOH_MARKETPLACE_DATA.featured_courses;
  }
  return _islohCatalog;
}

// Kurs ma'lumotini ID bo'yicha yagona manbadan oladi — savat/xohishlar
// ro'yxati faqat ID saqlagani uchun kartochka shu yerdan to'ldiriladi.
function isloh_findCourseById(id) {
  return isloh_getCatalog().find((c) => c.id === id) || null;
}

// Raqamni mahalliy formatda ("18 420") ko'rsatadi — narx ham, ko'rishlar ham
function isloh_formatCount(n) {
  return Math.round(n).toLocaleString('uz-UZ');
}
function isloh_formatSom(n) {
  return isloh_formatCount(n);
}

/* Kartochka bosilganda qayerga o'tishi: sotib olingan kurs — o'quv sahifasiga,
   qolganlari — do'kondagi kurs sahifasiga. */
function isloh_courseLinkHref(course) {
  return isloh_isPurchased(course.id)
    ? `course-detail.html?id=${course.id}`
    : `course-landing.html?id=${course.id}`;
}

// --- Cart (Savatga qo'shish -> checkout'gacha) ---
function isloh_getCartItems() {
  try { return JSON.parse(localStorage.getItem(ISLOH_CART_KEY)) || []; } catch (e) { return []; }
}
function isloh_saveCartItems(items) {
  localStorage.setItem(ISLOH_CART_KEY, JSON.stringify(items));
}
function isloh_isInCart(id) {
  return isloh_getCartItems().some((c) => c.id === id);
}
function isloh_addToCart(course) {
  const items = isloh_getCartItems();
  if (items.some((c) => c.id === course.id)) return items;
  items.push({
    id: course.id,
    title: course.title,
    cover: course.cover,
    icon: course.icon,
    price: course.discount_price || course.price || 0,
    instructor: course.instructor,
    duration: course.duration,
    level: course.level
  });
  isloh_saveCartItems(items);
  return items;
}
function isloh_updateCartBadge() {
  const count = isloh_getCartItems().length;
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = count;
    el.classList.toggle('badge-empty', count === 0);
  });
}

// --- Purchased / "Mening kurslarim" (checkout tasdiqlangandan keyin) ---
function isloh_getPurchasedCourses() {
  try { return JSON.parse(localStorage.getItem(ISLOH_PURCHASED_KEY)) || []; } catch (e) { return []; }
}
function isloh_isPurchased(id) {
  return isloh_getPurchasedCourses().some((c) => c.id === id);
}
function isloh_addPurchasedCourse(course) {
  const list = isloh_getPurchasedCourses();
  if (list.some((c) => (course.id && c.id === course.id) || c.title === course.title)) return;
  list.push(course);
  localStorage.setItem(ISLOH_PURCHASED_KEY, JSON.stringify(list));
}

/* --- Buyurtmalar do'koni (orders.html + marketplace "Xaridlar tarixi") ---
   Yagona manba: localStorage'dagi `isloh_orders`. Yozuv shakli:
     { id, date: 'YYYY-MM-DD', status: 'paid'|'pending'|'refunded',
       items: [{ id, title, cover, icon, price }] }
   Jami summa saqlanmaydi — u har doim qatorlardan hisoblanadi, shunda
   qo'lda yozilgan "Jami" bilan haqiqiy qatorlar bir-biriga zid bo'lmaydi. */

function isloh_saveOrders(list) {
  try {
    localStorage.setItem(ISLOH_ORDERS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/* Buyurtmalar ro'yxati, yangisidan eskisiga qarab saralangan. Do'kon bo'sh
   bo'lsa demo urug'i ekiladi — shunda sahifalar hech qachon bo'sh ko'rinmaydi.
   Urug' faqat BIR MARTA ekiladi: foydalanuvchi hammasini o'chirsa ham
   (bo'sh massiv saqlangan bo'lsa) qaytib kelmaydi. */
function isloh_getOrders() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(ISLOH_ORDERS_KEY)); } catch (e) { stored = null; }

  if (!Array.isArray(stored)) {
    stored = ISLOH_ORDER_SEED.slice();
    isloh_saveOrders(stored);
  }
  return stored.slice().sort((a, b) => (a.date === b.date ? Number(b.id) - Number(a.id) : (a.date < b.date ? 1 : -1)));
}

// Buyurtma summasi — qatorlardan hisoblanadi
function isloh_orderTotal(order) {
  return (order.items || []).reduce((sum, item) => sum + (item.price || 0), 0);
}

// '2026-07-18' -> '18-iyul, 2026' (til sozlamasiga qarab boshqa shaklda)
function isloh_formatOrderDate(value) {
  return isloh_dtShortDate(value) || String(value || '');
}

// Keyingi buyurtma raqami — mavjudlarining eng kattasidan bittaga ko'p
function isloh_nextOrderId(orders) {
  const max = orders.reduce((n, order) => Math.max(n, Number(order.id) || 0), 10000);
  return String(max + 1);
}

// Bitta buyurtmani ID bo'yicha topadi
function isloh_findOrderById(id) {
  return isloh_getOrders().find((order) => order.id === String(id)) || null;
}

/* Buyurtma holatini o'zgartiradi va do'konga saqlaydi (qaytarish so'rovi shu
   orqali yoziladi). Yangilangan buyurtmani qaytaradi, topilmasa null. */
function isloh_setOrderStatus(id, status) {
  const orders = isloh_getOrders();
  const order = orders.find((o) => o.id === String(id));
  if (!order) return null;

  order.status = status;
  isloh_saveOrders(orders);
  return order;
}

/* Savat tarkibidan yangi (to'langan) buyurtma yaratadi va uni do'konga
   qo'shadi. Yaratilgan buyurtmani qaytaradi, savat bo'sh bo'lsa null. */
function isloh_createOrderFromCart(cartItems) {
  const items = (cartItems || []).map((item) => ({
    id: item.id,
    title: item.title,
    cover: item.cover,
    icon: item.icon,
    price: item.price || 0
  }));
  if (!items.length) return null;

  const orders = isloh_getOrders();
  const order = {
    id: isloh_nextOrderId(orders),
    date: new Date().toISOString().slice(0, 10),
    status: 'paid',
    items: items
  };
  orders.unshift(order);
  isloh_saveOrders(orders);
  return order;
}

// checkout.js "Buyurtmani tasdiqlash"da shu funksiyani chaqiradi: savatdan
// buyurtma yozuvini yaratadi, kurslarni sotib olingan deb belgilaydi va
// savatni bo'shatadi. Buyurtma savat tozalanishidan OLDIN yaratiladi.
function isloh_finalizeCartCheckout() {
  const items = isloh_getCartItems();
  isloh_createOrderFromCart(items);
  items.forEach((item) => isloh_addPurchasedCourse(item));
  isloh_saveCartItems([]);
  isloh_updateCartBadge();
}

/* Chip ro'yxati: qo'lda yozilgan kategoriyalar + katalogda haqiqatan
   uchraydiganlari. O'qituvchi yangi kategoriyada kurs nashr etsa, uning
   chipi ham o'zi paydo bo'ladi — aks holda kurs faqat "Barchasi" da
   ko'rinib, filtrlab bo'lmasdi. */
function isloh_catalogCategories() {
  const list = ISLOH_MARKETPLACE_DATA.categories.slice();
  isloh_getCatalog().forEach((course) => {
    if (course.category && list.indexOf(course.category) === -1) list.push(course.category);
  });
  return list;
}

// --- Rendering: kategoriya chiplar va kurs katakchalari ---
function isloh_renderMarketplaceCategories(categories) {
  const bar = document.querySelector('[data-filter-group="category"]');
  if (!bar) return;
  bar.innerHTML = categories.map((name, i) => {
    const value = isloh_categorySlug(name);
    return `<button class="filter-chip${i === 0 ? ' active' : ''}" data-filter-value="${value}">${name}</button>`;
  }).join('');
}

/* Qidiruv uchun matn: sarlavhadan tashqari o'qituvchi, yo'nalish va daraja
   ham hisobga olinadi — "akmal", "devops" yoki "boshlang'ich" deb qidirganda
   ham mos kurslar chiqsin (js/filterable.js data-filter-text'ni o'qiydi). */
function isloh_courseSearchText(course) {
  return [course.title, course.instructor, course.category, course.level]
    .filter(Boolean).join(' ').replace(/"/g, '&quot;');
}

function isloh_courseActionHtml(course) {
  if (isloh_isPurchased(course.id)) {
    return `<a href="${isloh_courseLinkHref(course)}" class="btn btn-primary btn-sm btn-block" style="margin-top:10px;">Darsni boshlash</a>`;
  }
  if (isloh_isInCart(course.id)) {
    return `<button class="btn btn-outline btn-sm btn-block" style="margin-top:10px;" disabled>Savatda</button>`;
  }
  return `<button class="btn btn-primary btn-sm btn-block" style="margin-top:10px;" data-mkt-add-cart data-course-id="${course.id}">Savatga qo'shish</button>`;
}

function isloh_renderMarketplaceCourses(courses) {
  const grid = document.getElementById('mkt-grid');
  if (!grid) return;

  grid.innerHTML = courses.map((course) => {
    const priceRow = course.discount_price
      ? `<span class="price-now">${isloh_formatSom(course.discount_price)} so'm</span><span class="price-old">${isloh_formatSom(course.price)}</span><span class="discount-badge">-${Math.round((1 - course.discount_price / course.price) * 100)}%</span>`
      : `<span class="price-now">${isloh_formatSom(course.price)} so'm</span>`;
    const wishlisted = typeof isloh_isInWishlist === 'function' && isloh_isInWishlist(course.id);
    /* Muqova va sarlavha — havola: kartochka bosilganda kurs sahifasi ochiladi
       va kursni sotib olmasdan turib baholash mumkin. Yurak tugmasi havolaning
       ichida emas, yonida turadi, shuning uchun u bosilganda o'tish bo'lmaydi. */
    const href = isloh_courseLinkHref(course);

    return `
      <div class="card mkt-card" data-filter-item data-category="${isloh_categorySlug(course.category)}" data-filter-text="${isloh_courseSearchText(course)}"
           data-course-id="${course.id}" data-course-title="${course.title}" data-course-cover="${course.cover}" data-course-icon="${course.icon}"
           data-course-price="${course.price}"${course.discount_price ? ` data-course-discount-price="${course.discount_price}"` : ''}>
        <div class="mkt-cover" style="background:${course.cover};">
          <a class="mkt-cover-link" href="${href}" aria-label="${course.title}"><i class="${course.icon}"></i></a>
          <div class="card-fav-actions">
            <button class="fav-toggle${wishlisted ? ' active' : ''}" data-wishlist-toggle aria-label="Xohishlar ro'yxatiga qo'shish"><i class="bi ${wishlisted ? 'bi-heart-fill' : 'bi-heart'}"></i></button>
          </div>
        </div>
        <div class="card-pad" style="padding-top:14px;">
          <a class="mkt-card-title filter-title" href="${href}">${course.title}</a>
          <div class="mkt-card-meta"><i class="bi bi-star-fill"></i> ${course.rating} · ${course.instructor}</div>
          <div class="price-row">${priceRow}</div>
          ${isloh_courseActionHtml(course)}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-mkt-add-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const course = isloh_getCatalog().find((c) => c.id === btn.dataset.courseId);
      if (!course) return;
      isloh_addToCart(course);
      isloh_updateCartBadge();
      isloh_renderMarketplaceCourses(isloh_getCatalog());
      isloh_renderMarketplaceStrips(); // savat o'zgardi — tavsiyalar ham yangilanadi
      if (typeof isloh_showToast === 'function') isloh_showToast(`"${course.title}" savatga qo'shildi`, 'success');
    });
  });

  /* Katakcha qayta chizilgach joriy filtr va qidiruv holati tiklanadi —
     aks holda savatga qo'shishdan keyin qidiruv natijasi "unutilib",
     butun katalog qaytib chiqardi. */
  const scope = grid.closest('[data-filterable]');
  if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
}

/* --- Lentalar: "Tavsiya etilgan siz uchun" va "Ko'p ko'rilgan" -------------
   Ikkalasi ham ISLOH_MARKETPLACE_DATA'dan render qilinadi (ilgari HTML'ga
   qo'lda yozilgan, katalogda umuman mavjud bo'lmagan kurslar turardi va
   bosilganda hech narsa bo'lmasdi). Markup shartnomasi:
     [data-mkt-recommended]  -> tavsiyalar lentasi
     [data-mkt-most-viewed]  -> ko'p ko'rilganlar lentasi                    */

/* Foydalanuvchi qiziqishi: savat + xohishlar ro'yxati + sotib olingan
   kurslarning yo'nalishlari. Hech qanday signal bo'lmasa bo'sh qaytadi —
   u holda tavsiya reyting bo'yicha beriladi. */
function isloh_getInterestCategories() {
  const ids = isloh_getCartItems().map((c) => c.id)
    .concat(isloh_getPurchasedCourses().map((c) => c.id))
    .concat(typeof isloh_getWishlistItems === 'function' ? isloh_getWishlistItems().map((c) => c.id) : []);

  const categories = [];
  ids.forEach((id) => {
    const course = isloh_findCourseById(id);
    if (course && categories.indexOf(course.category) === -1) categories.push(course.category);
  });
  return categories;
}

/* Tavsiya: allaqachon sotib olingan yoki savatdagi kurslar chiqmaydi;
   qiziqish yo'nalishiga mos kurslar oldinga, keyin reyting bo'yicha. */
function isloh_getRecommendedCourses(limit) {
  const interests = isloh_getInterestCategories();
  return isloh_getCatalog()
    .filter((c) => !isloh_isPurchased(c.id) && !isloh_isInCart(c.id))
    .sort((a, b) => {
      const match = (interests.indexOf(b.category) > -1) - (interests.indexOf(a.category) > -1);
      return match !== 0 ? match : b.rating - a.rating;
    })
    .slice(0, limit || ISLOH_STRIP_LIMIT);
}

// Ko'p ko'rilgan: butun katalog bo'yicha ko'rishlar soni (umumiy reyting)
function isloh_getMostViewedCourses(limit) {
  return [...isloh_getCatalog()]
    .sort((a, b) => b.views - a.views)
    .slice(0, limit || ISLOH_STRIP_LIMIT);
}

// Lenta kartochkasi — ikkala lenta uchun yagona shablon (DRY)
function isloh_courseStripCardHtml(course, metaHtml) {
  const price = course.discount_price || course.price;
  return `
    <a class="card mkt-strip-card" href="${isloh_courseLinkHref(course)}">
      <div class="mkt-cover" style="background:${course.cover};"><i class="${course.icon}"></i></div>
      <div class="card-pad mkt-strip-body">
        <div class="mkt-strip-title">${course.title}</div>
        <div class="mkt-strip-meta">${metaHtml}</div>
        <div class="price-row"><span class="price-now mkt-strip-price">${isloh_formatSom(price)} so'm</span></div>
      </div>
    </a>`;
}

function isloh_renderCourseStrip(selector, courses, metaFn) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!courses.length) {
    el.innerHTML = '<div class="mkt-strip-empty">Hozircha ko\'rsatadigan kurs yo\'q.</div>';
    return;
  }
  el.innerHTML = courses.map((course) => isloh_courseStripCardHtml(course, metaFn(course))).join('');
}

function isloh_renderMarketplaceStrips() {
  isloh_renderCourseStrip('[data-mkt-recommended]', isloh_getRecommendedCourses(),
    (c) => `<i class="bi bi-star-fill"></i> ${c.rating} · ${c.category}`);

  isloh_renderCourseStrip('[data-mkt-most-viewed]', isloh_getMostViewedCourses(),
    (c) => `<i class="bi bi-eye-fill"></i> ${isloh_formatCount(c.views)} ko'rish`);
}

// --- Saralash (Sort) ---
function isloh_sortCourses(courses, mode) {
  const list = [...courses];
  const finalPrice = (c) => c.discount_price || c.price;
  if (mode === 'price-asc') return list.sort((a, b) => finalPrice(a) - finalPrice(b));
  if (mode === 'price-desc') return list.sort((a, b) => finalPrice(b) - finalPrice(a));
  if (mode === 'rating') return list.sort((a, b) => b.rating - a.rating);
  if (mode === 'newest') return list.reverse();
  return list; // "Mashhurligi bo'yicha" — asl tartib
}

function isloh_initMarketplaceSort() {
  const select = document.getElementById('mkt-sort');
  if (!select) return;
  select.addEventListener('change', () => {
    // Filtr/qidiruv holatini render funksiyasining o'zi tiklaydi
    isloh_renderMarketplaceCourses(isloh_sortCourses(isloh_getCatalog(), select.value));
  });
}

// --- Kurslarni solishtirish jadvali: ustunni olib tashlash ---
function isloh_initCompareTable() {
  document.querySelectorAll('[data-compare-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const th = btn.closest('th');
      const table = th?.closest('table');
      if (!th || !table) return;
      const index = [...th.parentElement.children].indexOf(th);
      table.querySelectorAll('tr').forEach((row) => row.children[index]?.remove());
      if (typeof isloh_showToast === 'function') isloh_showToast('Solishtirishdan olib tashlandi', 'success');
    });
  });
}

// --- To'plam (Bundle) sotib olish ---
function isloh_initBundleBuy() {
  document.querySelectorAll('[data-bundle-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bundle = {
        id: btn.dataset.bundleId,
        title: btn.dataset.bundleTitle,
        price: Number(btn.dataset.bundlePrice) || 0,
        cover: btn.dataset.bundleCover,
        icon: btn.dataset.bundleIcon
      };
      if (isloh_isInCart(bundle.id)) {
        if (typeof isloh_showToast === 'function') isloh_showToast("To'plam allaqachon savatda", 'error');
        return;
      }
      isloh_addToCart(bundle);
      isloh_updateCartBadge();
      if (typeof isloh_showToast === 'function') isloh_showToast(`"${bundle.title}" savatga qo'shildi`, 'success');
    });
  });
}

// --- Marketplace sahifasidagi kupon qatori (vizual tekshiruv) ---
function isloh_initMarketplaceCoupon() {
  const btn = document.getElementById('mkt-coupon-apply');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const input = document.getElementById('mkt-coupon-input');
    const value = (input?.value || '').trim().toUpperCase();
    if (typeof isloh_showToast !== 'function') return;
    if (value === ISLOH_COUPON.code) {
      isloh_showToast(`Kupon qo'llandi: −${ISLOH_COUPON.percent}% (savatga o'tganda hisoblanadi)`, 'success');
    } else {
      isloh_showToast("Kupon kodi noto'g'ri", 'error');
    }
  });
}

/* --- Xaridlar tarixi (marketplace.html) ---
   orders.html bilan bir xil do'kondan o'qiydi, shuning uchun ikkala ro'yxat
   hech qachon bir-biriga zid bo'lmaydi. */
function isloh_renderRecentOrders(selector, limit) {
  const el = document.querySelector(selector);
  if (!el) return;

  const recent = isloh_getOrders().filter((o) => o.status === 'paid').slice(0, limit || 2);
  if (!recent.length) {
    el.innerHTML = '<div class="mkt-orders-empty">Hozircha xarid qilinmagan.</div>';
    return;
  }

  el.innerHTML = recent.map((order, i) => {
    const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : '';
    const last = i === recent.length - 1 ? ' is-last' : '';
    return `<div class="mkt-order-row${last}">
      <div class="mkt-cover mkt-order-cover" style="background:${order.items[0].cover};"><i class="${order.items[0].icon}"></i></div>
      <div class="mkt-order-info">
        <div class="mkt-order-title">${order.items[0].title}${extra}</div>
        <div class="mkt-order-meta">Buyurtma #${order.id} &middot; ${isloh_formatOrderDate(order.date)}</div>
      </div>
      <span class="badge ${ISLOH_ORDER_STATUS_BADGE[order.status]}">${ISLOH_ORDER_STATUS_LABEL[order.status]}</span>
      <span class="mkt-order-total">${isloh_formatSom(isloh_orderTotal(order))} so'm</span>
    </div>`;
  }).join('');
}

/* Katalogga bog'liq bo'lgan qism — ALOHIDA, chunki u qayta chaqiriladi.
   `isloh_initMarketplace` ni butunlay qayta ishga tushirib bo'lmaydi: u
   listener ham ulaydi (saralash, kupon, solishtirish), takror chaqirilsa
   ular ikkilanib, bitta bosishga ikki marta javob berardi.

   Saralash tanlovi saqlanadi — aks holda API yuklangach ro'yxat jimgina
   standart tartibga qaytib qolardi. */
function isloh_renderMarketplaceCatalog() {
  const sort = document.getElementById('mkt-sort');
  const catalog = isloh_getCatalog();
  isloh_renderMarketplaceCategories(isloh_catalogCategories());
  isloh_renderMarketplaceCourses(sort ? isloh_sortCourses(catalog, sort.value) : catalog);
  isloh_renderMarketplaceStrips();
}

function isloh_initMarketplace() {
  isloh_renderMarketplaceCatalog();
  isloh_updateCartBadge();
  isloh_renderRecentOrders('[data-mkt-recent-orders]', 2);
  isloh_initMarketplaceSort();
  isloh_initCompareTable();
  isloh_initBundleBuy();
  isloh_initMarketplaceCoupon();
}

document.addEventListener('DOMContentLoaded', isloh_initMarketplace);

/* Katalog serverdan fonda keladi (isloh_loadCatalog) — kelgach sahifa
   o'zini qayta chizadi. `courses-updated` ham tinglanadi: o'qituvchi o'z
   kursini nashr etsa, u ham katalogga tushishi kerak (server javobi esa
   keyingi yuklashda aniq raqamlarni beradi). */
document.addEventListener('isloh:catalog-updated', isloh_renderMarketplaceCatalog);
document.addEventListener('isloh:courses-updated', isloh_renderMarketplaceCatalog);
