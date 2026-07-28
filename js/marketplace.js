/* ==========================================================================
   ISLOH — Marketplace module
   Renders pages/student/marketplace.html's course grid + category chips
   from a single mock object shaped like the future REST response (GET
   /api/marketplace). Also owns the shared cart/purchased localStorage
   helpers used by js/checkout.js (finalizes a purchase on submit) and
   js/bookmarks.js (reads purchased courses) — so this file is loaded on
   marketplace.html, checkout.html and bookmarks.html; every render
   function below guards on its target element so loading it purely for
   the helpers, on a page without #mkt-grid, is a safe no-op.

   API contract:
     {
       featured_courses: [{ id, title, instructor, price, discount_price,
                             category, rating, cover, icon, is_purchased }],
       categories: [ "Barchasi", "Backend", ... ],
       user_cart: { items_count, items }
     }

   Storage:
     isloh_cart_items       — array of { id, title, cover, icon } added via
                              "Savatga qo'shish", cleared on checkout submit.
     isloh_purchased_courses — array of { id, title, cover, icon }, read by
                              js/bookmarks.js under "Mening kurslarim".
   ========================================================================== */

const ISLOH_MARKETPLACE_DATA = {
  featured_courses: [
    { id: 'py-101', title: 'Python Backend Development', instructor: 'Akmal Yuldashev', price: 420000, discount_price: 249000, category: 'Backend', rating: 4.9, cover: 'linear-gradient(135deg,#306998,#FFD43B)', icon: 'bi bi-filetype-py' },
    { id: 'react-201', title: 'React — The Complete Guide', instructor: 'Dilnoza R.', price: 299000, discount_price: null, category: 'Frontend', rating: 4.8, cover: 'linear-gradient(135deg,#0EA5E9,#1E3A8A)', icon: 'bi bi-atom' },
    { id: 'uiux-301', title: 'UI/UX Design Fundamentals', instructor: 'Dilnoza R.', price: 250000, discount_price: 189000, category: 'Dizayn', rating: 4.7, cover: 'linear-gradient(135deg,#8E44EC,#3B82F6)', icon: 'bi bi-palette-fill' },
    { id: 'ml-401', title: 'Machine Learning A-Z', instructor: 'Aziz Karimov', price: 349000, discount_price: null, category: 'Backend', rating: 4.6, cover: 'linear-gradient(135deg,#06B6D4,#0E7490)', icon: 'bi bi-cpu-fill' }
  ],
  categories: ['Barchasi', 'Backend', 'Frontend', 'Mobile', 'Dizayn', 'DevOps'],
  user_cart: { items_count: 0, items: [] }
};

const ISLOH_CART_KEY = 'isloh_cart_items';
const ISLOH_PURCHASED_KEY = 'isloh_purchased_courses';

function isloh_categorySlug(name) {
  return name === 'Barchasi' ? 'all' : name.toLowerCase();
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
  items.push({ id: course.id, title: course.title, cover: course.cover, icon: course.icon });
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

// checkout.js "Buyurtmani tasdiqlash"da shu funksiyani chaqiradi:
// savatdagi barcha kurslarni sotib olingan deb belgilaydi va savatni bo'shatadi.
function isloh_finalizeCartCheckout() {
  isloh_getCartItems().forEach((item) => isloh_addPurchasedCourse(item));
  isloh_saveCartItems([]);
  isloh_updateCartBadge();
}

// --- Rendering ---
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

    return `
      <div class="card mkt-card" data-filter-item data-category="${isloh_categorySlug(course.category)}" data-filter-text="${course.title}">
        <div class="mkt-cover" style="background:${course.cover};">
          <i class="${course.icon}"></i>
          <button class="fav-toggle" data-wishlist-toggle aria-label="Xohishlar ro'yxatiga qo'shish"><i class="bi bi-heart"></i></button>
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

function isloh_initMarketplace() {
  isloh_renderMarketplaceCategories(ISLOH_MARKETPLACE_DATA.categories);
  isloh_renderMarketplaceCourses(ISLOH_MARKETPLACE_DATA.featured_courses);
  isloh_updateCartBadge();
}

document.addEventListener('DOMContentLoaded', isloh_initMarketplace);
