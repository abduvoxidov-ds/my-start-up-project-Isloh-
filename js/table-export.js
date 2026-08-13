/* ==========================================================================
   ISLOH — Jadvalni CSV'ga eksport qilish
   "Eksport" tugmalari shu paytgacha hech narsa qilmasdi. Endi ular ekranda
   ko'rinib turgan jadvalni CSV fayl sifatida yuklab beradi — ya'ni filtr
   yoki qidiruv qo'llangan bo'lsa, faqat o'sha qatorlar tushadi.

   Markup shartnomasi:
     [data-export-csv="<fayl-nomi>"]  → tugma
     [data-export-table]              → eksport qilinadigan <table>
     <th data-export-skip>            → CSV'ga tushmaydigan ustun
                                        (masalan tanlash yoki "Amallar")

   Backend shart emas: fayl brauzerda Blob sifatida yig'iladi, shuning uchun
   file:// protokolida ham ishlaydi (CLAUDE.md §3).
   ========================================================================== */

/* Excel/Sheets uchun: qo'shtirnoq ikkilantiriladi, maydon qo'shtirnoqqa
   olinadi — vergul va yangi qatorlar ustunni buzmasin. */
function isloh_csvCell(text) {
  return '"' + String(text == null ? '' : text).replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';
}

/* Katakning "ma'noli" matni. Ikki maxsus holat bor:
     - jarayon chizig'ida matn yo'q, qiymat CSS kengligida turadi;
     - avatar ichidagi bosh harflar ismning oldiga yopishib qoladi. */
function isloh_cellText(cell) {
  const progress = cell.querySelector('.progress-fill');
  if (progress) return progress.style.width || '';

  const clone = cell.cloneNode(true);
  clone.querySelectorAll('.avatar, .avatar-sm, .cell-thumb').forEach((el) => el.remove());
  return clone.innerText.trim();
}

function isloh_exportSkipIndexes(table) {
  const skip = [];
  table.querySelectorAll('thead th').forEach((th, i) => {
    if (th.hasAttribute('data-export-skip')) skip.push(i);
  });
  return skip;
}

/* Faqat ko'rinib turgan qatorlar (js/filterable.js yashirganlari tushmaydi). */
function isloh_visibleRows(table) {
  return [...table.querySelectorAll('tbody tr')].filter((tr) => tr.offsetParent !== null);
}

function isloh_tableToCsv(table) {
  const skip = isloh_exportSkipIndexes(table);
  const keep = (cells) => cells.filter((_, i) => skip.indexOf(i) === -1);

  const head = keep([...table.querySelectorAll('thead th')]).map((th) => isloh_csvCell(th.textContent));
  const body = isloh_visibleRows(table).map((tr) =>
    keep([...tr.children]).map((td) => isloh_csvCell(isloh_cellText(td))).join(',')
  );

  return [head.join(',')].concat(body).join('\r\n');
}

/* BOM qo'shiladi — aks holda Excel kirill/lotin harflarni buzib ochadi. */
function isloh_downloadCsv(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.csv$/i, '') + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isloh_initTableExport() {
  document.querySelectorAll('[data-export-csv]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = document.querySelector('[data-export-table]');
      if (!table) return;

      const rows = isloh_visibleRows(table).length;
      if (!rows) {
        if (typeof isloh_showToast === 'function') isloh_showToast('Eksport qilinadigan qator yo\'q', 'error');
        return;
      }

      isloh_downloadCsv(btn.dataset.exportCsv, isloh_tableToCsv(table));
      if (typeof isloh_showToast === 'function') {
        isloh_showToast(rows + ' ta qator CSV faylga yuklab olindi', 'success');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', isloh_initTableExport);
