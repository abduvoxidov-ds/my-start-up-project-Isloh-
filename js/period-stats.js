/* ==========================================================================
   ISLOH — Davr bo'yicha ko'rsatkichlar (Analitika sahifasi)

   QAROR: DAVR TANLOVI SAQLANDI, LEKIN FAQAT SANALI DO'KONLAR USTIDA.

   Eski holat: bu modul markupdagi tayyor satrlarni almashtirardi —
   `data-period-value='{"30":"$3,245","7":"$812","365":"$28,940"}'`. Ya'ni
   "hisob" degani HTML ichiga uchta qo'lda yozilgan raqam qo'yish edi;
   qaysi davr tanlansa ham hech narsa hisoblanmasdi. Shu mexanizm butunlay
   olib tashlandi.

   Modulni saqlab qolishning sababi: loyihada UCHTA do'kon voqealarni SANASI
   bilan saqlaydi va ular ustida davr oynasi haqiqiy ma'noga ega:
     `isloh_enrollments` -> enrolledAt   (kim qachon ro'yxatga olindi)
     `isloh_submissions` -> submittedAt  (ish qachon topshirildi)
     `isloh_reviews`     -> createdAt    (sharh qachon yozildi)

   Daromad esa sanali emas: kurs yozuvida faqat umrbod `revenue` scalari
   turadi, kunlik/oylik tarix hech qayerda saqlanmaydi. Shuning uchun
   revenue.html dan davr tanlovi OLIB TASHLANDI — u yerda tanlov nima
   tanlansa ham bir xil raqamni ko'rsatib turardi, bu esa foydalanuvchini
   aldash bo'lardi. Daromadning davr kesimi `.placeholder-note` bilan ochiq
   belgilangan (CLAUDE.md §4 — backend bosqichi).

   Markup shartnomasi:
     [data-period-select]              → <select>, <option value="30|7|365">
     [data-period-stat="<kalit>"]      → hisoblangan qiymat yoziladi
     [data-period-trend="<kalit>"]     → oldingi shuncha kunlik oyna bilan
                                         solishtirish nishoni (trend-pill)
     [data-period-label]               → tanlangan davr nomi ("Oxirgi 7 kun")
   ========================================================================== */

const ISLOH_PERIOD_DEFAULT = '30';

/* Sanali yozuvni oynaga solishtirish. `offset` — necha oyna orqaga:
   0 = joriy davr, 1 = undan oldingi shuncha kunlik davr (trend uchun). */
function isloh_periodCount(list, field, days, offset) {
  const span = Number(days) * 86400000;
  const to = Date.now() - (offset || 0) * span;
  const from = to - span;

  return (list || []).filter((item) => {
    const at = new Date(item && item[field]).getTime();
    return !isNaN(at) && at > from && at <= to;
  }).length;
}

/* Do'kon ulanmagan sahifada resolver null qaytaradi — raqam "—" bo'lib
   qoladi, sahifa buzilmaydi (js/profile-stats.js dagi bir xil qoida). */
function isloh_periodStoreCount(getter, field, days, offset) {
  if (typeof getter !== 'function') return null;
  return isloh_periodCount(getter(), field, days, offset);
}

/* Kalit → (kunlar, oyna siljishi) => son. Yangi davrga bog'liq ko'rsatkich
   kerak bo'lsa, shu jadvalga qo'shiladi — sahifa o'zi sanamaydi. */
const ISLOH_PERIOD_STATS = {
  newStudents: (days, offset) =>
    isloh_periodStoreCount(typeof isloh_getEnrollments === 'function' ? isloh_getEnrollments : null, 'enrolledAt', days, offset),
  newSubmissions: (days, offset) =>
    isloh_periodStoreCount(typeof isloh_getSubmissions === 'function' ? isloh_getSubmissions : null, 'submittedAt', days, offset),
  newReviews: (days, offset) =>
    isloh_periodStoreCount(typeof isloh_getReviews === 'function' ? isloh_getReviews : null, 'createdAt', days, offset)
};

/* O'sish foizi faqat OLDINGI oynada ham voqea bo'lgan bo'lsa hisoblanadi.
   Noldan o'sishni foizda ko'rsatib bo'lmaydi ("+∞%"), shuning uchun bunday
   holatda nishon umuman chizilmaydi — o'ylab topilgan foiz yozilmaydi. */
function isloh_periodTrend(current, previous) {
  if (current === null || previous === null || !previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* Nishon ko'rinishi js/progress-metrics.js dagi isloh_trendPillHtml bilan
   bir xil (bitta CSS: .trend-pill / .trend-up / .trend-down), lekin u modul
   talaba analitikasiga tegishli va instruktor sahifalarida yuklanmaydi. */
function isloh_periodTrendHtml(percent) {
  const up = percent >= 0;
  return `<span class="trend-pill ${up ? 'trend-up' : 'trend-down'}">
    <i class="bi bi-arrow-${up ? 'up' : 'down'}-short"></i> ${Math.abs(percent)}%</span>`;
}

function isloh_applyPeriod(period) {
  const cache = {};
  const value = (key, offset) => {
    const cacheKey = key + ':' + offset;
    if (!(cacheKey in cache)) {
      cache[cacheKey] = ISLOH_PERIOD_STATS[key] ? ISLOH_PERIOD_STATS[key](period, offset) : null;
    }
    return cache[cacheKey];
  };

  /* Qiymat — oynadagi VOQEALAR SONI (o'zgarish emas), shuning uchun "+"
     prefiksi yo'q: "+0" degan yozuv mantiqsiz ko'rinardi. O'zgarishni
     yonidagi trend nishoni ko'rsatadi. Ming ajratgichi butun loyihada
     bitta funksiyadan (js/profile-stats.js). */
  const format = typeof isloh_formatStatCount === 'function' ? isloh_formatStatCount : String;
  document.querySelectorAll('[data-period-stat]').forEach((el) => {
    const current = value(el.dataset.periodStat, 0);
    el.textContent = current === null ? '—' : format(current);
  });

  document.querySelectorAll('[data-period-trend]').forEach((el) => {
    const key = el.dataset.periodTrend;
    const trend = isloh_periodTrend(value(key, 0), value(key, 1));
    /* Solishtirish uchun ma'lumot yetmasa nishon bo'sh qoladi. */
    el.innerHTML = trend === null ? '' : isloh_periodTrendHtml(trend);
  });

  const select = document.querySelector('[data-period-select]');
  const label = select ? select.options[select.selectedIndex].textContent : '';
  document.querySelectorAll('[data-period-label]').forEach((el) => { el.textContent = label; });
}

function isloh_initPeriodStats() {
  const select = document.querySelector('[data-period-select]');
  if (!select) return; // bu sahifa emas — no-op

  select.addEventListener('change', () => isloh_applyPeriod(select.value));
  isloh_applyPeriod(select.value || ISLOH_PERIOD_DEFAULT);
}

/* Do'konlardan biri o'zgarsa (masalan sharhga javob yozilsa emas, balki
   yangi sharh/ish qo'shilsa) raqamlar qayta hisoblanadi. */
['isloh:enrollments-updated', 'isloh:submissions-updated', 'isloh:reviews-updated'].forEach((event) => {
  document.addEventListener(event, () => {
    const select = document.querySelector('[data-period-select]');
    if (select) isloh_applyPeriod(select.value || ISLOH_PERIOD_DEFAULT);
  });
});

document.addEventListener('DOMContentLoaded', isloh_initPeriodStats);
