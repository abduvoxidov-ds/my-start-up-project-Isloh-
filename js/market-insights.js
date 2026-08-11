/* ==========================================================================
   ISLOH — Instruktor Marketplace moduli  (pages/instructor/market.html)

   NEGA BU SAHIFA BOR: instruktorga ham katalog kerak, lekin talabanikidan
   BOSHQA maqsadda. Talaba sotib olish uchun ko'radi (savat, xohishlar,
   chegirma banneri), instruktor esa narx qo'yish va raqobatni o'rganish
   uchun. Shuning uchun bu yerda savat ham, xohishlar ham yo'q — faqat
   tahlil (talaba sahifasi — pages/student/marketplace.html).

   Ma'lumot o'ylab topilmaydi, hammasi mavjud do'konlardan hisoblanadi:
     js/marketplace.js  -> isloh_getCatalog()  — birlashgan katalog
                           (demo kurslar + instruktorning nashr etilganlari);
                           narxlar SO'MDA
     js/course-store.js -> isloh_getPublishedCourses() — "menikimi?" savoli
                           shu ro'yxatdagi id'lar bo'yicha hal qilinadi
                           (o'qituvchi ismi satri bo'yicha emas)

   Sahifadagi uch blok:
     1. Kategoriya benchmarki  — tanlangan kategoriya o'rtachalari
     2. Sizning o'rningiz      — o'z kursi vs kategoriya raqobatchilari
     3. Raqobatchilar jadvali  — filtr + qidiruv (js/filterable.js)

   Kategoriya chiplari ikki ishni bajaradi: jadvalni filtrlash (buni
   js/filterable.js qiladi) va benchmark raqamlarini qayta hisoblash (buni
   shu modul qiladi) — shuning uchun bir tugmada ikkita listener bor.

   Markup contract:
     [data-market-categories]  -> chiplar mount nuqtasi (filter-group)
     [data-market-stat="courses|price|rating|students"]
     [data-market-scope]       -> benchmark sarlavhasidagi kategoriya nomi
     [data-market-position]    -> "Sizning o'rningiz" ro'yxati
     [data-market-rows]        -> raqobatchilar jadvali <tbody>
   ========================================================================== */

const ISLOH_MARKET_ALL = 'all';

/* --- Ma'lumot qatlami ---------------------------------------------------- */

/* Egalik ikki darajali, va bu ataylab shunday:

     mine      — kurs umuman instruktorniki (isloh_courses do'konida bor,
                 holatidan qat'i nazar). Jadvalda "Sizniki" nishoni shunga
                 qarab qo'yiladi — aks holda o'z qoralama kursi katalogda
                 raqobatchi bo'lib ko'rinardi (docker-for-beginners aynan
                 shunday: do'konda qoralama, demo katalogda esa bor).
     published — kurs haqiqatan bozorda raqobat qilyapti. "Sizning
                 o'rningiz" bloki faqat shularni oladi: nashr etilmagan
                 kursning kategoriyadagi o'rni haqida gapirish noto'g'ri.

   Ism satri bo'yicha solishtirish ataylab ishlatilmadi — do'kondagi id
   ishonchliroq manba. */
function isloh_marketOwnIds(getter) {
  if (typeof getter !== 'function') return [];
  return getter().map((course) => course.id);
}

/* Katalog + hosila maydonlar: `mine` / `published` (yuqoriga qarang) va
   `effectivePrice` (chegirma bo'lsa — aynan shu narx bozorda ishlaydi,
   taqqoslash ham shunga qarab bo'lishi kerak). */
function isloh_marketCourses() {
  if (typeof isloh_getCatalog !== 'function') return [];
  const mine = isloh_marketOwnIds(typeof isloh_getCourses === 'function' ? isloh_getCourses : null);
  const published = isloh_marketOwnIds(typeof isloh_getPublishedCourses === 'function' ? isloh_getPublishedCourses : null);

  return isloh_getCatalog().map((course) => Object.assign({}, course, {
    mine: mine.indexOf(course.id) !== -1,
    published: published.indexOf(course.id) !== -1,
    effectivePrice: course.discount_price || course.price || 0
  }));
}

// Kategoriyalar ro'yxati katalogdan olinadi — o'qituvchi yangi kategoriya
// qo'shsa (masalan "Ma'lumotlar bazasi") u ham darrov chiqadi.
function isloh_marketCategories(courses) {
  const seen = [];
  courses.forEach((course) => {
    if (course.category && seen.indexOf(course.category) === -1) seen.push(course.category);
  });
  return seen.sort((a, b) => a.localeCompare(b, 'uz'));
}

function isloh_marketByCategory(courses, category) {
  if (!category || category === ISLOH_MARKET_ALL) return courses;
  return courses.filter((course) => course.category === category);
}

/* Bir to'plamning o'rtachalari. Bo'sh to'plamda ham xavfsiz nol qaytadi —
   yangi kategoriyada hali kurs bo'lmasligi mumkin. */
function isloh_marketStats(courses) {
  const count = courses.length;
  if (!count) return { count: 0, avgPrice: 0, avgRating: 0, students: 0 };

  const sum = courses.reduce((acc, course) => ({
    price: acc.price + (course.effectivePrice || 0),
    rating: acc.rating + (course.rating || 0),
    students: acc.students + (course.students || 0)
  }), { price: 0, rating: 0, students: 0 });

  return {
    count,
    avgPrice: Math.round(sum.price / count),
    avgRating: sum.rating / count,
    students: sum.students
  };
}

/* --- Ko'rinish yordamchilari --------------------------------------------- */

function isloh_marketNumber(n) {
  return typeof isloh_formatCount === 'function' ? isloh_formatCount(n) : String(Math.round(n));
}

/* Farq nishoni: "+18%" yashil emas, chunki narxda yuqori bo'lish yaxshi
   ham, yomon ham emas — yo'nalish neytral ko'rsatiladi (`neutral: true`). */
function isloh_marketDiffPill(percent, neutral) {
  const rounded = Math.round(percent);
  if (rounded === 0) return '<span class="trend-pill mk-pill-flat">o\'rtacha bilan bir xil</span>';
  const up = rounded > 0;
  const cls = neutral ? 'mk-pill-flat' : (up ? 'trend-up' : 'trend-down');
  const icon = up ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
  return `<span class="trend-pill ${cls}"><i class="bi ${icon}"></i> ${Math.abs(rounded)}%</span>`;
}

/* --- 1-blok: kategoriya benchmarki --------------------------------------- */
function isloh_renderMarketBenchmark(courses, category) {
  const scoped = isloh_marketByCategory(courses, category);
  const stats = isloh_marketStats(scoped);
  const values = {
    courses: isloh_marketNumber(stats.count),
    price: stats.count ? isloh_marketNumber(stats.avgPrice) : '—',
    rating: stats.count ? stats.avgRating.toFixed(2) : '—',
    students: isloh_marketNumber(stats.students)
  };

  document.querySelectorAll('[data-market-stat]').forEach((el) => {
    el.textContent = values[el.dataset.marketStat] ?? '—';
  });
  document.querySelectorAll('[data-market-scope]').forEach((el) => {
    el.textContent = category === ISLOH_MARKET_ALL ? 'Butun katalog' : category;
  });
}

/* --- 2-blok: sizning o'rningiz -------------------------------------------
   Taqqoslash HAR DOIM kursning O'Z kategoriyasi bo'yicha — yuqoridagi chip
   tanlovidan qat'i nazar. "Backend kursimni Dizayn o'rtachasi bilan
   solishtirish" hech qanday ma'no bermaydi.
   O'rtacha o'zidan tashqari raqobatchilar bo'yicha olinadi: aks holda
   kichik kategoriyada kurs o'zini o'zi bilan taqqoslab, farq yuvilib
   ketardi. */
function isloh_marketPositionRowHtml(course, peers) {
  const rivals = peers.filter((c) => c.id !== course.id);
  const ranked = peers.slice().sort((a, b) => (b.students || 0) - (a.students || 0));
  const rank = ranked.findIndex((c) => c.id === course.id) + 1;

  if (!rivals.length) {
    return `
      <div class="perf-row">
        <div class="perf-cover" style="background:${course.cover};"><i class="${course.icon}"></i></div>
        <div class="perf-info">
          <div class="perf-title">${course.title}</div>
          <div class="perf-sub">${course.category} — kategoriyada boshqa kurs yo'q, taqqoslash uchun ma'lumot yetarli emas</div>
        </div>
        <div class="perf-metric"><div class="perf-metric-val">${isloh_marketNumber(course.effectivePrice)}</div><div class="perf-metric-lbl">so'm</div></div>
      </div>`;
  }

  const rivalStats = isloh_marketStats(rivals);
  const priceDiff = rivalStats.avgPrice ? ((course.effectivePrice - rivalStats.avgPrice) / rivalStats.avgPrice) * 100 : 0;
  const ratingDiff = (course.rating || 0) - rivalStats.avgRating;

  return `
    <div class="perf-row">
      <div class="perf-cover" style="background:${course.cover};"><i class="${course.icon}"></i></div>
      <div class="perf-info">
        <div class="perf-title">${course.title}</div>
        <div class="perf-sub">${course.category} — talabalar bo'yicha ${rank}/${peers.length}-o'rin</div>
        <div class="mk-pos-metrics">
          <span class="mk-pos-metric">Narx ${isloh_marketNumber(course.effectivePrice)} so'm ${isloh_marketDiffPill(priceDiff, true)}</span>
          <span class="mk-pos-metric">Reyting ${(course.rating || 0).toFixed(1)} <span class="mk-pos-vs">o'rtacha ${rivalStats.avgRating.toFixed(2)}</span> ${isloh_marketDiffPill((ratingDiff / (rivalStats.avgRating || 1)) * 100)}</span>
        </div>
      </div>
      <div class="perf-metric">
        <div class="perf-metric-val">${isloh_marketNumber(course.students || 0)}</div>
        <div class="perf-metric-lbl">talaba</div>
      </div>
    </div>`;
}

function isloh_renderMarketPosition(courses) {
  const mount = document.querySelector('[data-market-position]');
  if (!mount) return;

  const mine = courses.filter((course) => course.published);
  if (!mine.length) {
    mount.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="bi bi-shop"></i></div>
        <div class="empty-title">Bozorda hali kursingiz yo'q</div>
        <div class="empty-sub">Kursni nashr etganingizdan keyin uning katalogdagi o'rni shu yerda ko'rinadi.</div>
        <a href="courses.html" class="btn btn-teach btn-sm mk-empty-action"><i class="bi bi-journal-bookmark-fill"></i> Kurslarimga o'tish</a>
      </div>`;
    return;
  }

  mount.innerHTML = mine
    .map((course) => isloh_marketPositionRowHtml(course, isloh_marketByCategory(courses, course.category)))
    .join('');
}

/* --- 3-blok: raqobatchilar jadvali ---------------------------------------
   O'z kursi -> instruktor kurs sahifasiga, raqobatchi -> talaba ko'radigan
   ochiq sahifaga (bozorda u qanday taqdim etilganini ko'rish uchun). */
function isloh_marketRowHref(course) {
  return course.mine
    ? `course-details.html?id=${encodeURIComponent(course.id)}`
    : `../student/course-landing.html?id=${encodeURIComponent(course.id)}`;
}

function isloh_marketPriceCellHtml(course) {
  if (!course.discount_price) return `${isloh_marketNumber(course.price || 0)} so'm`;
  return `${isloh_marketNumber(course.discount_price)} so'm <span class="mk-price-old">${isloh_marketNumber(course.price)}</span>`;
}

function isloh_marketRowHtml(course) {
  const mineBadge = course.mine ? '<span class="badge badge-green mk-mine-tag">Sizniki</span>' : '';
  return `
    <tr class="${course.mine ? 'mk-row-mine' : ''}" data-filter-item data-category="${course.category}"
        data-filter-text="${course.title} ${course.instructor}">
      <td>
        <a class="cell-main mk-row-link" href="${isloh_marketRowHref(course)}">
          <div class="cell-thumb" style="background:${course.cover};"><i class="${course.icon}"></i></div>
          <div>
            <div class="cell-title filter-title">${course.title} ${mineBadge}</div>
            <div class="cell-sub">${course.instructor}</div>
          </div>
        </a>
      </td>
      <td><span class="badge badge-neutral">${course.category}</span></td>
      <td>${isloh_marketPriceCellHtml(course)}</td>
      <td>${(course.rating || 0).toFixed(1)} ★</td>
      <td>${isloh_marketNumber(course.students || 0)}</td>
      <td>${isloh_marketNumber(course.lessons || 0)}</td>
    </tr>`;
}

function isloh_renderMarketTable(courses) {
  const mount = document.querySelector('[data-market-rows]');
  if (!mount) return;
  // Talabalar soni bo'yicha — jadval boshida bozor yetakchilari tursin
  mount.innerHTML = courses
    .slice()
    .sort((a, b) => (b.students || 0) - (a.students || 0))
    .map(isloh_marketRowHtml)
    .join('');
}

/* --- Kategoriya chiplari -------------------------------------------------
   Chiplarni shu modul chizadi (kategoriyalar katalogdan kelgani uchun),
   filtrlashni esa js/filterable.js o'z ustiga oladi — shuning uchun bu
   skript market.html'da filterable.js'dan OLDIN yuklanadi. */
function isloh_renderMarketCategories(courses) {
  const mount = document.querySelector('[data-market-categories]');
  if (!mount) return;

  const chips = [`<button class="filter-chip active" data-filter-value="${ISLOH_MARKET_ALL}">Barchasi</button>`]
    .concat(isloh_marketCategories(courses).map((category) =>
      `<button class="filter-chip" data-filter-value="${category}">${category}</button>`
    ));
  mount.innerHTML = chips.join('');

  // Benchmark raqamlari chip tanloviga ergashadi (jadval filtri — filterable'da)
  mount.querySelectorAll('button[data-filter-value]').forEach((btn) => {
    btn.addEventListener('click', () => isloh_renderMarketBenchmark(courses, btn.dataset.filterValue));
  });
}

function isloh_initMarketInsights() {
  const page = document.querySelector('[data-market-rows]');
  if (!page) return; // bu sahifa emas — no-op

  const courses = isloh_marketCourses();
  isloh_renderMarketCategories(courses);
  isloh_renderMarketBenchmark(courses, ISLOH_MARKET_ALL);
  isloh_renderMarketPosition(courses);
  isloh_renderMarketTable(courses);
}

document.addEventListener('DOMContentLoaded', isloh_initMarketInsights);
