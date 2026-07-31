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
                             category, rating, duration, level, cover, icon }],
       categories: [ "Barchasi", "Backend", ... ],
       user_cart: { items_count, items }
     }

   Storage:
     isloh_cart_items       — array of { id, title, cover, icon, price,
                              instructor, duration, level } added via
                              "Savatga qo'shish", cleared on checkout submit.
     isloh_purchased_courses — array of { id, title, cover, icon }, read by
                              js/my-courses.js under "Boshlangan kurslar".
     isloh_saved_courses    — array of { id, date }; only the course id is
                              persisted, the card data is looked up from
                              ISLOH_MARKETPLACE_DATA so nothing is duplicated.
                              Rendered by js/my-courses.js ("Saqlangan
                              kurslar"). NOTE: kurs darajasidagi ma'lumot
                              "Saqlanganlar" (bookmarks.html) sahifasiga
                              KIRMAYDI — u faqat dars materiallari uchun.
   ========================================================================== */

const ISLOH_MARKETPLACE_DATA = {
  featured_courses: [
    { id: 'py-101', title: 'Python Backend Development', instructor: 'Akmal Yuldashev', price: 420000, discount_price: 249000, category: 'Backend', rating: 4.9, duration: '42 soat', level: 'Barcha darajalar', cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py' },
    { id: 'react-201', title: 'React — The Complete Guide', instructor: 'Malika Tosheva', price: 299000, discount_price: null, category: 'Frontend', rating: 4.8, duration: '38 soat', level: "O'rta daraja", cover: 'linear-gradient(135deg,#0EA5E9,#1E3A8A)', icon: 'bi bi-atom' },
    { id: 'uiux-301', title: 'UI/UX Design Fundamentals', instructor: 'Dilnoza R.', price: 250000, discount_price: 189000, category: 'Dizayn', rating: 4.7, duration: '26 soat', level: "Boshlang'ich", cover: 'linear-gradient(135deg,#8E44EC,#3B82F6)', icon: 'bi bi-palette-fill' },
    { id: 'ml-401', title: 'Machine Learning A-Z', instructor: 'Aziz Karimov', price: 349000, discount_price: null, category: 'Backend', rating: 4.6, duration: '56 soat', level: 'Yuqori daraja', cover: 'linear-gradient(135deg,#06B6D4,#0E7490)', icon: 'bi bi-cpu-fill' },
    { id: 'flutter-501', title: 'Flutter Mobile Development', instructor: 'Javlon Rahimov', price: 320000, discount_price: 219000, category: 'Mobile', rating: 4.7, duration: '34 soat', level: "O'rta daraja", cover: 'linear-gradient(135deg,#02569B,#13B9FD)', icon: 'bi bi-phone-fill' },
    { id: 'devops-601', title: 'Docker & Kubernetes DevOps', instructor: 'Sardor Aliyev', price: 380000, discount_price: null, category: 'DevOps', rating: 4.8, duration: '46 soat', level: 'Yuqori daraja', cover: 'linear-gradient(135deg,#2496ED,#326CE5)', icon: 'bi bi-boxes' },
    /* Talaba yozilgan demo kurs — course-player.html, course-landing.html,
       notes/discussions/live-sessions sahifalari shu kursni ko'rsatadi.
       Ilgari katalogda yo'q edi, shuning uchun pleerdagi progress
       sertifikatlar sahifasiga umuman chiqmasdi (js/certificate-engine.js
       sarlavhasida ham shu kamchilik qayd etilgan edi). Qiymatlar
       course-landing.html dagi ma'lumotdan olindi. */
    { id: 'docker-for-beginners', title: 'Docker for Beginners', instructor: 'Akmal Yuldashev', price: 159000, discount_price: null, category: 'DevOps', rating: 4.7, duration: '18 soat', level: "Boshlang'ich", cover: 'linear-gradient(135deg,#F97316,#EA580C)', icon: 'bi bi-boxes' }
  ],
  categories: ['Barchasi', 'Backend', 'Frontend', 'Mobile', 'Dizayn', 'DevOps'],
  user_cart: { items_count: 0, items: [] }
};

// Buyurtmalar tarixining yagona manbai — pages/student/orders.html shu bilan
// mos bo'lishi kerak; marketplace.html "Xaridlar tarixi" shu ro'yxatdan
// so'nggi to'langan buyurtmalarni render qiladi.
const ISLOH_ORDER_HISTORY = [
  { id: '10312', date: '18-iyul, 2026', status: 'paid', items: [
      { title: 'Python Backend Development', cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py', price: 249000 },
      { title: 'React — The Complete Guide', cover: 'linear-gradient(135deg,#0EA5E9,#1E3A8A)', icon: 'bi bi-atom', price: 299000 }
    ] },
  { id: '10245', date: '12-iyul, 2026', status: 'paid', items: [
      { title: 'Python Backend Development', cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py', price: 249000 }
    ] },
  { id: '10198', date: '2-iyul, 2026', status: 'pending', items: [
      { title: 'Machine Learning A-Z', cover: 'linear-gradient(135deg,#06B6D4,#0E7490)', icon: 'bi bi-cpu-fill', price: 349000 }
    ] },
  { id: '10102', date: '20-iyun, 2026', status: 'refunded', items: [
      { title: 'UI/UX Design Fundamentals', cover: 'linear-gradient(135deg,#8E44EC,#3B82F6)', icon: 'bi bi-palette-fill', price: 189000 }
    ] }
];
const ISLOH_ORDER_STATUS_LABEL = { paid: "To'landi", pending: 'Kutilmoqda', refunded: 'Qaytarilgan' };
const ISLOH_ORDER_STATUS_BADGE = { paid: 'badge-green', pending: 'badge-warning', refunded: 'badge-danger' };

// Savat/checkout/marketplace kuponi — bitta joyda, cart.js va checkout.js
// shu obyektdan foydalanadi (avval ikkalasida alohida-alohida yozilgan edi).
const ISLOH_COUPON = { code: 'ISLOH2026', percent: 15 };

const ISLOH_CART_KEY = 'isloh_cart_items';
const ISLOH_PURCHASED_KEY = 'isloh_purchased_courses';
const ISLOH_SAVED_KEY = 'isloh_saved_courses';

function isloh_categorySlug(name) {
  return name === 'Barchasi' ? 'all' : name.toLowerCase();
}

// Kurs ma'lumotini ID bo'yicha yagona manbadan oladi — saqlanganlar ro'yxati
// faqat ID saqlagani uchun kartochka shu yerdan to'ldiriladi.
function isloh_findCourseById(id) {
  return ISLOH_MARKETPLACE_DATA.featured_courses.find((c) => c.id === id) || null;
}

function isloh_formatSom(n) {
  return Math.round(n).toLocaleString('uz-UZ');
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

// --- Saqlangan kurslar (Marketplace kartochkasidagi xatcho'p tugmasi) ---
// localStorage'da faqat { id, date } saqlanadi; qolgan hamma narsa
// ISLOH_MARKETPLACE_DATA'dan olinadi. Eslatma: hozircha bu do'kon uchun
// alohida ko'rish sahifasi yo'q — "Mening kurslarim"da faqat sotib
// olingan kurslar chiqadi.
function isloh_getSavedCourses() {
  try { return JSON.parse(localStorage.getItem(ISLOH_SAVED_KEY)) || []; } catch (e) { return []; }
}
function isloh_setSavedCourses(items) {
  localStorage.setItem(ISLOH_SAVED_KEY, JSON.stringify(items));
}
function isloh_isSavedCourse(id) {
  return isloh_getSavedCourses().some((c) => c.id === id);
}
function isloh_removeSavedCourse(id) {
  isloh_setSavedCourses(isloh_getSavedCourses().filter((c) => c.id !== id));
}

// Global toggle — istalgan sahifadagi kurs kartochkasi shu funksiyani chaqiradi.
// Qaytaradi: true — saqlandi, false — saqlanganlardan olib tashlandi.
function isloh_toggleSaveCourse(courseId) {
  const items = isloh_getSavedCourses();
  const idx = items.findIndex((c) => c.id === courseId);
  if (idx > -1) {
    items.splice(idx, 1);
    isloh_setSavedCourses(items);
    return false;
  }
  items.push({ id: courseId, date: new Date().toISOString().slice(0, 10) });
  isloh_setSavedCourses(items);
  return true;
}

// Tugmaning vizual holati (ikonka + .active) — bitta joyda
function isloh_syncSaveToggle(btn, saved) {
  btn.classList.toggle('active', saved);
  const icon = btn.querySelector('i');
  if (icon) {
    icon.classList.toggle('bi-bookmark', !saved);
    icon.classList.toggle('bi-bookmark-fill', saved);
  }
}

// Tugma qaysi kursga tegishli ekanini aniqlaydi: o'z data-course-id'si yoki
// eng yaqin [data-course-id] kartochkasidan.
function isloh_saveToggleCourseId(btn) {
  return btn.dataset.courseId || btn.closest('[data-course-id]')?.dataset.courseId || null;
}

// [data-save-toggle] tugmalari uchun yagona delegatsiyalangan hodisa —
// marketplace.js yuklangan har qanday sahifada ishlaydi.
function isloh_initSaveToggles() {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save-toggle]');
    if (!btn) return;
    const id = isloh_saveToggleCourseId(btn);
    if (!id) return;

    const saved = isloh_toggleSaveCourse(id);
    // Bir kurs sahifada bir necha marta ko'rinishi mumkin — hammasini yangilaymiz
    document.querySelectorAll('[data-save-toggle]').forEach((el) => {
      if (isloh_saveToggleCourseId(el) === id) isloh_syncSaveToggle(el, saved);
    });
    if (typeof isloh_showToast === 'function') {
      isloh_showToast(saved ? "Saqlanganlarga qo'shildi" : 'Saqlanganlardan olib tashlandi', 'success');
    }
  });
}

// checkout.js "Buyurtmani tasdiqlash"da shu funksiyani chaqiradi:
// savatdagi barcha kurslarni sotib olingan deb belgilaydi va savatni bo'shatadi.
function isloh_finalizeCartCheckout() {
  isloh_getCartItems().forEach((item) => isloh_addPurchasedCourse(item));
  isloh_saveCartItems([]);
  isloh_updateCartBadge();
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

function isloh_courseActionHtml(course) {
  if (isloh_isPurchased(course.id)) {
    return `<a href="course-detail.html?id=${course.id}" class="btn btn-primary btn-sm btn-block" style="margin-top:10px;">Darsni boshlash</a>`;
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
    const saved = isloh_isSavedCourse(course.id);

    return `
      <div class="card mkt-card" data-filter-item data-category="${isloh_categorySlug(course.category)}" data-filter-text="${course.title}"
           data-course-id="${course.id}" data-course-title="${course.title}" data-course-cover="${course.cover}" data-course-icon="${course.icon}"
           data-course-price="${course.price}"${course.discount_price ? ` data-course-discount-price="${course.discount_price}"` : ''}>
        <div class="mkt-cover" style="background:${course.cover};">
          <i class="${course.icon}"></i>
          <div class="card-fav-actions">
            <button class="fav-toggle fav-save${saved ? ' active' : ''}" data-save-toggle aria-label="Saqlanganlarga qo'shish"><i class="bi ${saved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i></button>
            <button class="fav-toggle${wishlisted ? ' active' : ''}" data-wishlist-toggle aria-label="Xohishlar ro'yxatiga qo'shish"><i class="bi ${wishlisted ? 'bi-heart-fill' : 'bi-heart'}"></i></button>
          </div>
        </div>
        <div class="card-pad" style="padding-top:14px;">
          <div style="font-weight:700; font-size:14px;" class="filter-title">${course.title}</div>
          <div class="price-row">${priceRow}</div>
          ${isloh_courseActionHtml(course)}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-mkt-add-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const course = ISLOH_MARKETPLACE_DATA.featured_courses.find((c) => c.id === btn.dataset.courseId);
      if (!course) return;
      isloh_addToCart(course);
      isloh_updateCartBadge();
      isloh_renderMarketplaceCourses(ISLOH_MARKETPLACE_DATA.featured_courses);
      if (typeof isloh_showToast === 'function') isloh_showToast(`"${course.title}" savatga qo'shildi`, 'success');
    });
  });
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
    const sorted = isloh_sortCourses(ISLOH_MARKETPLACE_DATA.featured_courses, select.value);
    isloh_renderMarketplaceCourses(sorted);
    const scope = document.querySelector('[data-filterable]');
    if (scope && typeof isloh_applyFilterable === 'function') isloh_applyFilterable(scope);
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

// --- Xaridlar tarixi (marketplace.html), ISLOH_ORDER_HISTORY'dan ---
function isloh_renderRecentOrders(selector, limit) {
  const el = document.querySelector(selector);
  if (!el) return;
  const recent = ISLOH_ORDER_HISTORY.filter((o) => o.status === 'paid').slice(0, limit || 2);
  el.innerHTML = recent.map((order, i) => {
    const total = order.items.reduce((sum, it) => sum + it.price, 0);
    const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : '';
    const border = i < recent.length - 1 ? 'border-bottom:1px solid var(--border-soft);' : '';
    return `<div style="display:flex; align-items:center; gap:14px; padding:14px 20px; ${border}">
      <div class="mkt-cover" style="width:44px; height:44px; border-radius:10px; background:${order.items[0].cover}; font-size:14px;"><i class="${order.items[0].icon}"></i></div>
      <div style="flex:1;"><div style="font-weight:600; font-size:13.5px;">${order.items[0].title}${extra}</div><div style="font-size:12px; color:var(--ink-500);">Buyurtma #${order.id} &middot; ${order.date}</div></div>
      <span class="badge ${ISLOH_ORDER_STATUS_BADGE[order.status]}">${ISLOH_ORDER_STATUS_LABEL[order.status]}</span>
      <span style="font-weight:700; font-size:13.5px;">${isloh_formatSom(total)} so'm</span>
    </div>`;
  }).join('');
}

function isloh_initMarketplace() {
  isloh_renderMarketplaceCategories(ISLOH_MARKETPLACE_DATA.categories);
  isloh_renderMarketplaceCourses(ISLOH_MARKETPLACE_DATA.featured_courses);
  isloh_updateCartBadge();
  isloh_renderRecentOrders('[data-mkt-recent-orders]', 2);
  isloh_initMarketplaceSort();
  isloh_initCompareTable();
  isloh_initBundleBuy();
  isloh_initMarketplaceCoupon();
  isloh_initSaveToggles(); // sahifadan qat'i nazar ishlaydi
}

document.addEventListener('DOMContentLoaded', isloh_initMarketplace);
