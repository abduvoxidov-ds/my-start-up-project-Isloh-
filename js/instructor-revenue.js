/* ==========================================================================
   ISLOH — Daromad sahifasi (pages/instructor/revenue.html)

   NEGA O'ZGARDI: sahifadagi HAMMA raqam HTML ichida qo'lda yozilgan edi —
   $2,140 balans, $3,245 oylik daromad, $28,940 jami daromad, uchta kurs
   daromadi va beshta "tranzaksiya". Ularning hech biri hech qanday
   do'konga tayanmasdi: kurs do'konida jami daromad $3,250, bu sahifada
   esa $28,940 turardi.

   NIMA HAQIQIY, NIMA YO'Q:
     HAQIQIY  → kurs yozuvidagi `revenue` maydonidan hisoblanadigan hamma
                narsa: jami daromad, kurslar bo'yicha daromad va ulush,
                daromad keltirgan kurslar soni, o'rtacha kurs narxi.
     YO'Q     → SANALI to'lovlar. Loyihada tranzaksiyalar do'koni yo'q
                (`isloh_courses` faqat umrbod summani biladi), shuning
                uchun kunlik/oylik dinamika, kutilayotgan to'lov, o'rtacha
                buyurtma, tranzaksiyalar jurnali va yechib olish balansi
                `.placeholder-note` bilan ochiq belgilangan. Soxta raqam
                qo'yilmadi (CLAUDE.md §4).

   Shu sababli sahifadan DAVR TANLOVI ham olib tashlandi — sababi
   js/period-stats.js sarlavhasida batafsil yozilgan.

   To'lov AMALLARI (pul yechish, usul qo'shish/boshqarish) allaqachon
   `data-backend-pending` bilan ishlangan — js/backend-pending.js ularni
   o'chirib, sababini tooltipda ko'rsatadi. O'sha yondashuv tegilmadi.

   Markup shartnomasi:
     [data-revenue-courses] → kurslar bo'yicha daromad ro'yxati
   ========================================================================== */

/* Bitta kurs qatori. Ulush = shu kursning umumiy daromaddagi foizi —
   qo'lda yozilgan foiz emas, ikkala son ham bitta manbadan. */
function isloh_revenueCourseHtml(course, total) {
  const share = total ? Math.round((course.revenue / total) * 100) : 0;
  const students = (course.students || 0).toLocaleString('en-US');
  const rating = course.rating ? ` · ${course.rating} ★` : '';
  const status = ISLOH_COURSE_STATUSES[course.status] || ISLOH_COURSE_STATUSES.draft;
  /* Arxivlangan kurs ham ro'yxatda qoladi (pul ishlangan), lekin holati
     ko'rinib tursin — aks holda ro'yxat "hali ham sotilyapti" deb tuyulardi. */
  const archived = course.status === 'archived' ? ` <span class="badge ${status.badge}">${status.label}</span>` : '';

  return `<div class="perf-row">
    <div class="perf-cover" style="background:${course.cover};"><i class="bi ${course.icon}"></i></div>
    <div class="perf-info">
      <div class="perf-title"><a class="text-inherit" href="course-details.html?id=${encodeURIComponent(course.id)}">${course.title}</a>${archived}</div>
      <div class="perf-sub">${students} talaba${rating} · umumiy daromadning ${share}%</div>
      <div class="progress-track mt-4"><div class="progress-fill${isloh_courseFillClass(course.status)}" style="width:${share}%;"></div></div>
    </div>
    <div class="perf-metric">
      <div class="perf-metric-val cell-revenue">${isloh_formatUsd(course.revenue)}</div>
      <div class="perf-metric-lbl">daromad</div>
    </div>
  </div>`;
}

function isloh_renderRevenueCourses() {
  const mount = document.querySelector('[data-revenue-courses]');
  if (!mount) return; // bu sahifa emas

  /* Daromad keltirgan kurslar, eng kattasi tepada. Nol daromadli kurslar
     ro'yxatga tushmaydi — "0$" qatorlar sahifani chalg'itardi. */
  const earning = isloh_getCourses()
    .filter((course) => (course.revenue || 0) > 0)
    .sort((a, b) => b.revenue - a.revenue);

  if (!earning.length) {
    mount.innerHTML = `<p class="placeholder-note"><i class="bi bi-info-circle"></i> Hali biror kurs daromad keltirmagan.</p>`;
    return;
  }

  const total = earning.reduce((sum, course) => sum + course.revenue, 0);
  mount.innerHTML = earning.map((course) => isloh_revenueCourseHtml(course, total)).join('');
}

document.addEventListener('isloh:courses-updated', isloh_renderRevenueCourses);
document.addEventListener('DOMContentLoaded', isloh_renderRevenueCourses);
