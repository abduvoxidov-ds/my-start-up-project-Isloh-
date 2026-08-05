/* ==========================================================================
   ISLOH — Davr bo'yicha ko'rsatkichlar
   Analitika va Daromad sahifalaridagi "Oxirgi 30 kun / 7 kun / Bu yil"
   tanlovi hech narsaga ulanmagan edi: qaysi davr tanlansa ham raqamlar
   o'zgarmasdi.

   Markup shartnomasi (deklarativ — JS'da sahifaga xos raqam yo'q):
     [data-period-select]                          → <select>
       <option value="30|7|365">
     [data-period-value='{"30":"$3,245","7":"$820"}'] → raqam ko'rsatuvchi element

   Qiymatlar markupda turadi, chunki bu hali ham mock ma'lumot — backend
   ulangach shu atributlar API javobiga almashadi (CLAUDE.md §4).
   ========================================================================== */

function isloh_applyPeriod(period) {
  document.querySelectorAll('[data-period-value]').forEach((el) => {
    let map;
    try { map = JSON.parse(el.dataset.periodValue); } catch (e) { return; }
    if (map && map[period] !== undefined) el.textContent = map[period];
  });
}

function isloh_initPeriodStats() {
  const select = document.querySelector('[data-period-select]');
  if (!select) return;

  select.addEventListener('change', () => isloh_applyPeriod(select.value));
  isloh_applyPeriod(select.value);
}

document.addEventListener('DOMContentLoaded', isloh_initPeriodStats);
