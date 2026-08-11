/* ==========================================================================
   ISLOH — Talabalar ro'yxati (pages/instructor/students.html)
   Bu sahifada faqat "Ko'rish" tugmasi qoldi: u talabaning qatoridagi
   ma'lumotni tafsilot oynasida ko'rsatadi.

   NEGA shu yondashuv: hozircha alohida "talaba sahifasi" yo'q va talabalar
   uchun do'kon ham yo'q, shuning uchun oyna qatordagi HAQIQIY ma'lumotni
   ko'rsatadi — o'ylab topilgan raqamlar emas. Backend ulangach (CLAUDE.md
   §4) bu oyna to'liq profilga almashadi.

   "Eksport" js/table-export.js zimmasida, "Xabar" esa oddiy havola.

   Markup shartnomasi:
     [data-student-view]  → qatordagi "ko'z" tugmasi
     #student-detail-modal + [data-student-detail-*] → tafsilot oynasi
   ========================================================================== */

/* Qatordagi kataklarni sarlavhalar bo'yicha o'qiydi — ustunlar tartibi
   o'zgarsa ham ishlayveradi. */
function isloh_readStudentRow(row) {
  const table = row.closest('table');
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  const data = {};

  [...row.children].forEach((cell, i) => {
    const key = heads[i];
    if (!key || cell.querySelector('.row-actions')) return;
    // Katak matnini o'qish js/table-export.js dagi yagona funksiyada
    data[key] = isloh_cellText(cell);
  });

  data.name = row.querySelector('.cell-title') ? row.querySelector('.cell-title').textContent.trim() : '';
  data.email = row.querySelector('.cell-sub') ? row.querySelector('.cell-sub').textContent.trim() : '';
  /* Xabarlar do'konidagi hisob id'si (js/chat-store.js) — "Xabar yozish"
     havolasi shu orqali aynan mana shu talaba bilan suhbatni ochadi. */
  data.studentId = row.dataset.studentId || '';
  return data;
}

function isloh_renderStudentDetail(data) {
  const nameEl = document.querySelector('[data-student-detail-name]');
  const mailEl = document.querySelector('[data-student-detail-email]');
  const listEl = document.querySelector('[data-student-detail-rows]');
  const mailLink = document.querySelector('[data-student-detail-message]');

  if (nameEl) nameEl.textContent = data.name;
  if (mailEl) mailEl.textContent = data.email;
  /* Ilgari bu havola doim bo'sh `messages.html` edi — qaysi talabani
     tanlaganingizdan qat'i nazar bir xil suhbat ochilardi. */
  if (mailLink) mailLink.href = data.studentId ? 'messages.html?u=' + encodeURIComponent(data.studentId) : 'messages.html';

  if (!listEl) return;
  /* Ism/email va ichki id allaqachon sarlavhada yoki havolada — qolgan
     ustunlar ro'yxatga tushadi. */
  listEl.innerHTML = Object.keys(data)
    .filter((key) => key !== 'name' && key !== 'email' && key !== 'studentId' && key !== 'Talaba' && data[key])
    .map((key) => `<div class="review-summary-row"><span class="lbl">${key}</span><span class="val">${data[key]}</span></div>`)
    .join('');
}

function isloh_initStudentDetails() {
  const table = document.querySelector('[data-export-table]');
  if (!table || !document.getElementById('student-detail-modal')) return;

  table.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-student-view]');
    if (!btn) return;
    isloh_renderStudentDetail(isloh_readStudentRow(btn.closest('tr')));
    if (typeof isloh_openModal === 'function') isloh_openModal('student-detail-modal');
  });
}

document.addEventListener('DOMContentLoaded', isloh_initStudentDetails);
